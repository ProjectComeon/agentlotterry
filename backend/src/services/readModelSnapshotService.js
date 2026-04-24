const DEFAULT_READ_MODEL_SNAPSHOT_REBUILD_DELAY_MS = 1000;
const DEFAULT_READ_MODEL_SNAPSHOT_REFRESH_INTERVAL_MS = 300000;
const DEFAULT_READ_MODEL_SNAPSHOT_STARTUP_DELAY_MS = 30000;
const DEFAULT_READ_MODEL_SNAPSHOT_AGENT_LIMIT = 50;

const READ_MODEL_SNAPSHOT_REBUILD_DELAY_MS = Math.max(
  0,
  Number(process.env.READ_MODEL_SNAPSHOT_REBUILD_DELAY_MS || DEFAULT_READ_MODEL_SNAPSHOT_REBUILD_DELAY_MS)
);
const READ_MODEL_SNAPSHOT_REFRESH_INTERVAL_MS = Math.max(
  0,
  Number(process.env.READ_MODEL_SNAPSHOT_REFRESH_INTERVAL_MS || DEFAULT_READ_MODEL_SNAPSHOT_REFRESH_INTERVAL_MS)
);
const READ_MODEL_SNAPSHOT_STARTUP_DELAY_MS = Math.max(
  0,
  Number(process.env.READ_MODEL_SNAPSHOT_STARTUP_DELAY_MS || DEFAULT_READ_MODEL_SNAPSHOT_STARTUP_DELAY_MS)
);
const READ_MODEL_SNAPSHOT_AGENT_LIMIT = Math.max(
  1,
  Number(process.env.READ_MODEL_SNAPSHOT_AGENT_LIMIT || DEFAULT_READ_MODEL_SNAPSHOT_AGENT_LIMIT)
);
const SNAPSHOT_TARGETS = ['market', 'catalog', 'dashboard'];

let rebuildTimer = null;
let refreshTimer = null;
let running = false;
let pendingOptions = null;
let lastStartedAt = null;
let lastCompletedAt = null;
let lastError = '';
let lastSummary = null;

const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';
const normalizeTargets = (value) => {
  const targetList = Array.isArray(value) ? value : String(value || '').split(',');
  const targets = targetList
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => SNAPSHOT_TARGETS.includes(item));

  return targets.length ? [...new Set(targets)] : [...SNAPSHOT_TARGETS];
};

const mergeOptions = (current = {}, incoming = {}) => {
  const reasons = [
    ...String(current.reason || '').split(',').map((item) => item.trim()).filter(Boolean),
    ...String(incoming.reason || '').split(',').map((item) => item.trim()).filter(Boolean)
  ];
  const agentIds = [
    ...(Array.isArray(current.agentIds) ? current.agentIds : []),
    ...(Array.isArray(incoming.agentIds) ? incoming.agentIds : [])
  ].map(toIdString).filter(Boolean);
  const currentTargets = current.targets ? normalizeTargets(current.targets) : [];
  const incomingTargets = incoming.targets ? normalizeTargets(incoming.targets) : [];
  const targets = currentTargets.length || incomingTargets.length
    ? [...new Set([...currentTargets, ...incomingTargets])]
    : [...SNAPSHOT_TARGETS];

  return {
    reason: [...new Set(reasons)].join(',') || 'unspecified',
    includeAgents: Boolean(current.includeAgents || incoming.includeAgents),
    targets,
    agentIds: [...new Set(agentIds)],
    agentLimit: Math.max(
      Number(current.agentLimit || 0),
      Number(incoming.agentLimit || 0),
      READ_MODEL_SNAPSHOT_AGENT_LIMIT
    )
  };
};

const rebuildReadModelSnapshots = async (options = {}) => {
  const normalizedOptions = mergeOptions({}, options);
  const summary = {
    reason: normalizedOptions.reason,
    startedAt: new Date().toISOString(),
    completedAt: '',
    market: null,
    catalog: null,
    dashboard: null,
    warnings: []
  };

  lastStartedAt = summary.startedAt;
  lastError = '';

  const { rebuildMarketOverviewSnapshot } = require('./marketResultsService');
  const {
    clearCatalogOverviewCache,
    rebuildOperatorCatalogOverviewSnapshots
  } = require('./catalogService');
  const {
    clearDashboardSnapshots,
    rebuildDashboardSnapshots
  } = require('./dashboardSnapshotService');

  if (normalizedOptions.targets.includes('market')) {
    try {
      const marketOverview = await rebuildMarketOverviewSnapshot();
      summary.market = {
        sectionCount: Array.isArray(marketOverview?.sections) ? marketOverview.sections.length : 0,
        marketCount: Array.isArray(marketOverview?.sections)
          ? marketOverview.sections.reduce((sum, section) => sum + (section.markets?.length || 0), 0)
          : 0,
        warningCount: Array.isArray(marketOverview?.warnings) ? marketOverview.warnings.length : 0
      };
    } catch (error) {
      summary.warnings.push(`market: ${error.message}`);
    }
  }

  if (normalizedOptions.targets.includes('catalog')) {
    try {
      await clearCatalogOverviewCache({ includeSnapshots: false });
      summary.catalog = await rebuildOperatorCatalogOverviewSnapshots({
        limit: normalizedOptions.agentLimit
      });
    } catch (error) {
      summary.warnings.push(`catalog: ${error.message}`);
    }
  }

  if (normalizedOptions.targets.includes('dashboard')) {
    try {
      await clearDashboardSnapshots({ includePersistent: false });
      summary.dashboard = await rebuildDashboardSnapshots({
        includeAgents: normalizedOptions.includeAgents,
        agentIds: normalizedOptions.agentIds,
        agentLimit: normalizedOptions.agentLimit
      });
    } catch (error) {
      summary.warnings.push(`dashboard: ${error.message}`);
    }
  }

  summary.completedAt = new Date().toISOString();
  lastCompletedAt = summary.completedAt;
  lastSummary = summary;

  if (summary.warnings.length) {
    lastError = summary.warnings.join('; ');
  }

  return summary;
};

const runScheduledRebuild = async () => {
  if (running) {
    return;
  }

  const options = pendingOptions || { reason: 'scheduled' };
  pendingOptions = null;
  rebuildTimer = null;
  running = true;

  try {
    await rebuildReadModelSnapshots(options);
  } catch (error) {
    lastError = error.message || 'Failed to rebuild read model snapshots';
    lastSummary = {
      reason: options.reason || 'scheduled',
      startedAt: lastStartedAt,
      completedAt: new Date().toISOString(),
      warnings: [lastError]
    };
  } finally {
    running = false;
    if (pendingOptions) {
      const queuedOptions = pendingOptions;
      pendingOptions = null;
      scheduleReadModelSnapshotRebuild({
        ...queuedOptions,
        delayMs: READ_MODEL_SNAPSHOT_REBUILD_DELAY_MS
      });
    }
  }
};

const scheduleReadModelSnapshotRebuild = (options = {}) => {
  const { delayMs = READ_MODEL_SNAPSHOT_REBUILD_DELAY_MS, ...rebuildOptions } = options;
  pendingOptions = mergeOptions(pendingOptions || {}, rebuildOptions);

  if (rebuildTimer || running) {
    return {
      scheduled: true,
      running,
      reason: pendingOptions.reason
    };
  }

  rebuildTimer = setTimeout(runScheduledRebuild, Math.max(0, Number(delayMs) || 0));
  if (typeof rebuildTimer.unref === 'function') {
    rebuildTimer.unref();
  }

  return {
    scheduled: true,
    running,
    reason: pendingOptions.reason
  };
};

const startReadModelSnapshotAutoRefresh = ({
  intervalMs = READ_MODEL_SNAPSHOT_REFRESH_INTERVAL_MS,
  startupDelayMs = READ_MODEL_SNAPSHOT_STARTUP_DELAY_MS
} = {}) => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  scheduleReadModelSnapshotRebuild({
    reason: 'startup',
    delayMs: startupDelayMs
  });

  if (intervalMs <= 0) {
    return null;
  }

  refreshTimer = setInterval(() => {
    scheduleReadModelSnapshotRebuild({
      reason: 'interval-refresh',
      delayMs: READ_MODEL_SNAPSHOT_REBUILD_DELAY_MS
    });
  }, intervalMs);

  if (typeof refreshTimer.unref === 'function') {
    refreshTimer.unref();
  }

  return refreshTimer;
};

const getReadModelSnapshotState = () => ({
  running,
  scheduled: Boolean(rebuildTimer),
  pendingReason: pendingOptions?.reason || '',
  lastStartedAt,
  lastCompletedAt,
  lastError,
  lastSummary,
  refreshIntervalMs: READ_MODEL_SNAPSHOT_REFRESH_INTERVAL_MS
});

module.exports = {
  rebuildReadModelSnapshots,
  scheduleReadModelSnapshotRebuild,
  startReadModelSnapshotAutoRefresh,
  getReadModelSnapshotState,
  __test: {
    mergeOptions,
    normalizeTargets
  }
};
