import { useEffect, useMemo, useState } from 'react';
import { getLotterySyncStatus } from '../../services/api';
import { formatDateTime } from '../../utils/formatters';

const EMPTY_STATUS = {
  running: false,
  lastError: '',
  lastSummary: null,
  mappingCoverage: null,
  feeds: []
};

const formatInteger = (value) => new Intl.NumberFormat('th-TH').format(Number(value || 0));

const formatUpdatedAt = (value) => formatDateTime(value, {
  fallback: '-',
  options: {
    dateStyle: 'medium',
    timeStyle: 'short'
  }
});

const LotteryAdminSyncPanel = ({ ui, refreshKey = 0 }) => {
  const [syncStatus, setSyncStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let idleId = null;
    let timeoutId = null;

    const loadSyncStatus = async () => {
      try {
        const response = await getLotterySyncStatus({ force: refreshKey > 0 });
        if (!cancelled) {
          setSyncStatus(response.data || EMPTY_STATUS);
        }
      } catch (error) {
        if (!cancelled) {
          setSyncStatus({
            ...EMPTY_STATUS,
            lastError: error?.response?.data?.message || error?.message || ui.syncLatestError
          });
        }
      }
    };

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => {
        void loadSyncStatus();
      }, { timeout: 500 });
    } else {
      timeoutId = window.setTimeout(() => {
        void loadSyncStatus();
      }, 120);
    }

    return () => {
      cancelled = true;
      if (idleId !== null && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null && typeof window !== 'undefined') {
        window.clearTimeout(timeoutId);
      }
    };
  }, [refreshKey, ui.syncLatestError]);

  const syncSummary = syncStatus?.lastSummary || null;
  const syncCoverage = syncStatus?.mappingCoverage || syncSummary?.mappingCoverage || null;
  const syncFeedIssues = useMemo(
    () => (syncSummary?.feedSummaries || []).filter((feed) => feed.status !== 'ok'),
    [syncSummary]
  );
  const syncMetrics = useMemo(() => ([
    {
      label: ui.syncConfiguredFeeds,
      value: syncCoverage ? formatInteger(syncCoverage.configuredCount) : '-',
      note: syncStatus?.feeds?.length ? `${formatInteger(syncStatus.feeds.length)} feeds` : ui.syncSummaryEmpty
    },
    {
      label: ui.syncExplicitFeeds,
      value: syncCoverage ? `${formatInteger(syncCoverage.explicitCount)}/${formatInteger(syncCoverage.configuredCount)}` : '-',
      note: syncCoverage?.strictMode ? ui.syncStrictModeOn : ui.syncStrictModeOff
    },
    {
      label: ui.syncProblemFeeds,
      value: syncSummary ? formatInteger((syncSummary.warningFeeds || 0) + (syncSummary.errorFeeds || 0)) : '-',
      note: syncStatus?.lastError ? ui.syncLastError : ui.syncSummaryTitle
    },
    {
      label: ui.syncSettlements,
      value: syncSummary ? formatInteger(syncSummary.settlements) : '-',
      note: syncSummary?.syncedAt
        ? `${ui.syncLastRun} ${formatUpdatedAt(syncSummary.syncedAt)} · ${syncSummary?.mode === 'fetch-store' ? ui.syncModeDeferred : ui.syncModeFull}`
        : ui.syncSummaryEmpty
    }
  ]), [syncCoverage, syncStatus, syncSummary, ui]);

  if (!syncStatus) {
    return null;
  }

  return (
    <>
      <div className="sync-metrics-grid">
        {syncMetrics.map((metric) => (
          <article key={metric.label} className="sync-metric-card">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </article>
        ))}
      </div>

      {syncStatus.lastError ? (
        <div className="sync-feed-panel">
          <div className="sync-feed-title">{ui.syncLastError}</div>
          <div className="sync-feed-list">
            <article className="sync-feed-card is-error">
              <div>
                <strong>{ui.syncSummaryTitle}</strong>
                <span>{ui.syncLatest}</span>
              </div>
              <small>{syncStatus.lastError}</small>
            </article>
          </div>
        </div>
      ) : null}

      {syncFeedIssues.length > 0 ? (
        <div className="sync-feed-panel">
          <div className="sync-feed-title">{ui.syncFeedIssues}</div>
          <div className="sync-feed-list">
            {syncFeedIssues.slice(0, 8).map((feed) => (
              <article key={feed.feedCode} className={`sync-feed-card is-${feed.status}`}>
                <div>
                  <strong>{feed.marketName}</strong>
                  <span>{feed.feedCode} · {feed.mappingMode}</span>
                </div>
                <small>{feed.error || feed.warnings?.[0] || 'ต้องตรวจสอบเพิ่มเติม'}</small>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
};

export default LotteryAdminSyncPanel;
