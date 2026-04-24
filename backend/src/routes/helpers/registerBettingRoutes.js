const { createAuditLog } = require('../../middleware/auditLog');
const { getBetTotals, listBettingRecentItems, clearAnalyticsReadCache } = require('../../services/analyticsService');
const { previewSlip, createSlip, cancelSlipByActor } = require('../../services/betSlipService');
const { getBettingCatalogOverview } = require('../../services/catalogService');
const { scheduleReadModelSnapshotRebuild } = require('../../services/readModelSnapshotService');
const { searchMembersForBetting, getMemberForBettingActor } = require('../../services/memberManagementService');
const { getDraftSession, saveDraftSession, clearDraftSession } = require('../../services/bettingDraftService');
const { buildDraftScopePayload } = require('../../utils/bettingDraftPayload');

const buildSlipAuditPayload = ({ customerId, slip }) => ({
  customerId,
  slipNumber: slip.slipNumber,
  lotteryName: slip.lotteryName,
  roundCode: slip.roundCode,
  itemCount: slip.itemCount,
  totalAmount: slip.totalAmount
});

const mapMemberBettingContext = ({ member, totals, includeAgentId }) => ({
  id: member._id.toString(),
  name: member.name,
  username: member.username,
  phone: member.phone || '',
  creditBalance: member.creditBalance || 0,
  status: member.status,
  isActive: member.isActive,
  ...(includeAgentId ? { agentId: member.agentId?.toString?.() || '' } : {}),
  totals: {
    totalAmount: totals.totalAmount || 0,
    totalWon: totals.totalWon || 0,
    netProfit: totals.netProfit || 0
  }
});

const registerBettingRoutes = (
  router,
  {
    includeMemberAgentId = false,
    buildSearchParams = () => ({}),
    buildMemberTotalsParams,
    createSlipAuditActions,
    cancelSlipOptions = {}
  }
) => {
  router.get('/betting/members/search', async (req, res) => {
    try {
      const members = await searchMembersForBetting({
        actorId: req.user._id,
        actorRole: req.user.role,
        search: req.query.q || req.query.search || '',
        limit: req.query.limit || 20,
        includeTotals: req.query.includeTotals === '1' || req.query.includeTotals === 'true',
        ...buildSearchParams(req)
      });

      res.json(members);
    } catch (error) {
      res.status(500).json({ message: error.message || 'Failed to search members' });
    }
  });

  router.get('/betting/members/:memberId/context', async (req, res) => {
    try {
      const member = await getMemberForBettingActor({
        actorId: req.user._id,
        actorRole: req.user.role,
        memberId: req.params.memberId
      });

      const shouldIncludeTotals = req.query.includeTotals === '1' || req.query.includeTotals === 'true';
      const shouldIncludeCatalog = req.query.includeCatalog !== '0' && req.query.includeCatalog !== 'false';
      const [catalog, totals] = await Promise.all([
        shouldIncludeCatalog
          ? getBettingCatalogOverview(member)
          : Promise.resolve(null),
        shouldIncludeTotals
          ? getBetTotals(buildMemberTotalsParams(req, member))
          : Promise.resolve({})
      ]);

      res.json({
        member: mapMemberBettingContext({ member, totals, includeAgentId: includeMemberAgentId }),
        catalog
      });
    } catch (error) {
      res.status(400).json({ message: error.message || 'Failed to load member betting context' });
    }
  });

  router.post('/betting/slips/parse', async (req, res) => {
    try {
      const preview = await previewSlip({
        actorUser: req.user,
        customerId: req.body.customerId,
        ...req.body
      });

      res.json(preview);
    } catch (error) {
      res.status(400).json({ message: error.message || 'Failed to parse slip' });
    }
  });

  router.post('/betting/slips', async (req, res) => {
    try {
      const { action = 'submit' } = req.body;
      const slip = await createSlip({
        actorUser: req.user,
        customerId: req.body.customerId,
        ...req.body,
        action
      });

      await createAuditLog(
        req.user._id,
        action === 'draft' ? createSlipAuditActions.draft : createSlipAuditActions.submit,
        slip.id,
        buildSlipAuditPayload({ customerId: req.body.customerId, slip })
      );
      clearAnalyticsReadCache();
      scheduleReadModelSnapshotRebuild({
        reason: 'betting-slip-create',
        agentIds: req.user.role === 'agent' ? [req.user._id] : [],
        includeAgents: req.user.role === 'admin'
      });

      res.status(201).json(slip);
    } catch (error) {
      res.status(400).json({ message: error.message || 'Failed to create slip' });
    }
  });

  router.post('/betting/slips/:slipId/cancel', async (req, res) => {
    if (!cancelSlipOptions.allowCancel) {
      return res.status(403).json({ message: cancelSlipOptions.forbiddenMessage || 'Cancel is not allowed' });
    }

    try {
      const slip = await cancelSlipByActor({
        actorUser: req.user,
        slipId: req.params.slipId
      });

      await createAuditLog(req.user._id, cancelSlipOptions.auditAction, slip.id, {
        slipNumber: slip.slipNumber,
        customerId: slip.customerId
      });
      clearAnalyticsReadCache();
      scheduleReadModelSnapshotRebuild({
        reason: 'betting-slip-cancel',
        agentIds: req.user.role === 'agent' ? [req.user._id] : [],
        includeAgents: req.user.role === 'admin'
      });

      res.json(slip);
    } catch (error) {
      res.status(400).json({ message: error.message || 'Failed to cancel slip' });
    }
  });

  router.get('/betting/items/recent', async (req, res) => {
    try {
      const items = await listBettingRecentItems({
        actorRole: req.user.role,
        actorId: req.user._id,
        customerId: req.query.customerId || '',
        marketId: req.query.marketId || '',
        roundDate: req.query.roundDate || '',
        limit: Number(req.query.limit || 12)
      });

      res.json(items);
    } catch (error) {
      res.status(500).json({ message: error.message || 'Failed to load recent betting items' });
    }
  });

  router.get('/betting/draft', async (req, res) => {
    try {
      const draft = await getDraftSession({
        actorUser: req.user,
        ...buildDraftScopePayload(req.query)
      });

      res.json(draft);
    } catch (error) {
      res.status(400).json({ message: error.message || 'Failed to load betting draft' });
    }
  });

  router.put('/betting/draft', async (req, res) => {
    try {
      const draft = await saveDraftSession({
        actorUser: req.user,
        ...buildDraftScopePayload(req.body),
        composer: req.body.composer || null,
        savedEntries: req.body.savedEntries || []
      });

      res.json(draft);
    } catch (error) {
      res.status(400).json({ message: error.message || 'Failed to save betting draft' });
    }
  });

  router.delete('/betting/draft', async (req, res) => {
    try {
      const draft = await clearDraftSession({
        actorUser: req.user,
        ...buildDraftScopePayload(req.body)
      });

      res.json(draft);
    } catch (error) {
      res.status(400).json({ message: error.message || 'Failed to clear betting draft' });
    }
  });
};

module.exports = {
  registerBettingRoutes
};
