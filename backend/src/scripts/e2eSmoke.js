require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const assert = require('assert');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { spawn } = require('child_process');
const path = require('path');
const AuditLog = require('../models/AuditLog');
const BetItem = require('../models/BetItem');
const BetSlip = require('../models/BetSlip');
const BettingDraftSession = require('../models/BettingDraftSession');
const CreditLedgerEntry = require('../models/CreditLedgerEntry');
const DrawRound = require('../models/DrawRound');
const User = require('../models/User');
const UserLotteryConfig = require('../models/UserLotteryConfig');
const { buildDirectMongoUri } = require('../utils/mongoUri');

const backendDir = path.join(__dirname, '..', '..');
const port = process.env.E2E_PORT || '5051';
const baseURL = `http://127.0.0.1:${port}/api`;
const uniqueSuffix = Date.now().toString().slice(-6);
const shouldStartServer = process.env.E2E_SKIP_SERVER !== '1';
const adminUsername = process.env.E2E_ADMIN_USERNAME || process.env.DEFAULT_ADMIN_USERNAME || 'admin';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const makeClient = (token = '') =>
  axios.create({
    baseURL,
    validateStatus: () => true,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

const expectStatus = (response, expected, label) => {
  if (response.status !== expected) {
    throw new Error(`${label} failed with status ${response.status}: ${JSON.stringify(response.data)}`);
  }
};

const waitForServer = async () => {
  const client = makeClient();

  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await client.get('/health');
      if (response.status === 200) {
        return;
      }
    } catch {}

    await sleep(1000);
  }

  throw new Error('Server did not become healthy in time');
};

const loginWithRetry = async (username, password, label) => {
  const client = makeClient();

  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await client.post('/auth/login', { username, password });
    if (response.status === 200) {
      return response.data;
    }

    await sleep(1000);
  }

  throw new Error(`${label} login failed`);
};

const flattenLotteries = (overview) =>
  (overview.leagues || []).flatMap((league) => league.lotteries || []);

const buildMemberLotterySettings = ({ bootstrap, selectedLotteryId }) =>
  (bootstrap.lotteries || []).map((lottery) => ({
    lotteryTypeId: lottery.lotteryTypeId,
    isEnabled: lottery.lotteryTypeId === selectedLotteryId,
    rateProfileId: lottery.availableRateProfiles?.[0]?.id || lottery.rateProfileId || '',
    enabledBetTypes: lottery.supportedBetTypes,
    minimumBet: 1,
    maximumBet: 20,
    maximumPerNumber: 20,
    stockPercent: 10,
    ownerPercent: 5,
    keepPercent: 5,
    commissionRate: 2,
    useCustomRates: true,
    customRates: {
      '3top': 987,
      '3front': 444,
      '3bottom': 444,
      '3tod': 654,
      '2top': 87,
      '2bottom': 92,
      '2tod': 91,
      'run_top': 4,
      'run_bottom': 3
    },
    keepMode: 'cap',
    keepCapAmount: 50,
    blockedNumbers: ['123'],
    notes: 'E2E smoke member config'
  }));

const cleanupSmokeArtifacts = async (created = {}) => {
  const groupIds = (created.walletGroupIds || []).filter(Boolean);
  const slipIds = (created.slipIds || []).filter(Boolean);
  const targets = [
    created.agentId,
    created.memberId,
    ...slipIds,
    ...groupIds
  ].filter(Boolean);

  if (groupIds.length) {
    await CreditLedgerEntry.deleteMany({ groupId: { $in: groupIds } });
  }

  if (created.memberId) {
    await BetItem.deleteMany({ customerId: created.memberId });
    await BetSlip.deleteMany({ customerId: created.memberId });
    await BettingDraftSession.deleteMany({ customerId: created.memberId });
    await UserLotteryConfig.deleteMany({ userId: created.memberId });
    await User.deleteOne({ _id: created.memberId });
  }

  if (created.agentId) {
    await User.deleteOne({ _id: created.agentId });
  }

  if (targets.length) {
    await AuditLog.deleteMany({ target: { $in: targets.map(String) } });
  }
};

const killProcess = async (child) => {
  if (!child || child.killed || child.exitCode !== null) return;

  try {
    child.kill();
  } catch {}

  await sleep(1500);
};

const main = async () => {
  const summary = {
    startedAt: new Date().toISOString(),
    port,
    checks: [],
    created: {},
    warnings: []
  };

  let server;
  let adminToken = '';
  let agentToken = '';
  let agentId = '';
  let memberId = '';
  let slipId = '';
  let lockedRoundId = '';
  let originalClosedBetTypes = null;
  let adminClient = null;
  let agentClient = null;
  const created = {
    walletGroupIds: [],
    slipIds: []
  };

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing');
    }

    const mongoUri = await buildDirectMongoUri(process.env.MONGODB_URI);
    await mongoose.connect(mongoUri);

    if (shouldStartServer) {
      server = spawn(process.execPath, ['server.js'], {
        cwd: backendDir,
        env: {
          ...process.env,
          PORT: port
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const serverLogs = [];
      const appendLog = (prefix, chunk) => {
        const text = String(chunk || '').trim();
        if (!text) return;
        serverLogs.push(`${prefix}${text}`);
        if (serverLogs.length > 30) serverLogs.shift();
      };

      server.stdout.on('data', (chunk) => appendLog('', chunk));
      server.stderr.on('data', (chunk) => appendLog('ERR: ', chunk));
    }

    await waitForServer();
    summary.checks.push('health');

    const adminLogin = await loginWithRetry(adminUsername, adminPassword, 'Admin');
    adminToken = adminLogin.token;
    summary.checks.push('admin-login');

    adminClient = makeClient(adminToken);
    const agentUsername = `e2e_agent_${uniqueSuffix}`;
    const agentPassword = `Bb${uniqueSuffix}!`;
    const memberUsername = `e2e_member_${uniqueSuffix}`;
    const memberPassword = `Bb${uniqueSuffix}!`;

    const createAgentResponse = await adminClient.post('/admin/agents', {
      username: agentUsername,
      password: agentPassword,
      name: `E2E Agent ${uniqueSuffix}`,
      phone: '0990000000'
    });
    expectStatus(createAgentResponse, 201, 'Create agent');
    agentId = createAgentResponse.data._id || createAgentResponse.data.id;
    created.agentId = agentId;
    summary.created.agent = { id: agentId, username: agentUsername };
    summary.checks.push('admin-create-agent');

    const agentLogin = await loginWithRetry(agentUsername, agentPassword, 'Agent');
    agentToken = agentLogin.token;
    summary.checks.push('agent-login');

    agentClient = makeClient(agentToken);
    const agentHeartbeatResponse = await agentClient.post('/presence/heartbeat');
    expectStatus(agentHeartbeatResponse, 200, 'Agent heartbeat');
    summary.checks.push('agent-heartbeat');

    const adjustAgentCreditResponse = await adminClient.post('/wallet/adjust', {
      targetUserId: agentId,
      amount: 250,
      note: 'E2E agent funding',
      reasonCode: 'agent_topup'
    });
    expectStatus(adjustAgentCreditResponse, 201, 'Adjust agent credit');
    created.walletGroupIds.push(adjustAgentCreditResponse.data.groupId);
    summary.checks.push('admin-adjust-agent-credit');

    const agentWalletResponse = await agentClient.get('/wallet/summary');
    expectStatus(agentWalletResponse, 200, 'Agent wallet summary');
    assert(Number(agentWalletResponse.data.account?.creditBalance || 0) === 250, 'Agent wallet balance is incorrect after admin funding');
    summary.checks.push('agent-wallet-summary');

    const [bootstrapResponse, agentCatalogResponse] = await Promise.all([
      agentClient.get('/agent/config/bootstrap'),
      agentClient.get('/catalog/overview')
    ]);
    expectStatus(bootstrapResponse, 200, 'Agent bootstrap');
    expectStatus(agentCatalogResponse, 200, 'Agent catalog overview');
    summary.checks.push('agent-bootstrap');
    summary.checks.push('agent-catalog-overview');

    const allLotteries = flattenLotteries(agentCatalogResponse.data);
    const selectedLottery = allLotteries.find((lottery) => lottery.status === 'open' && lottery.supportedBetTypes.includes('3top') && lottery.supportedBetTypes.includes('2bottom'))
      || allLotteries.find((lottery) => lottery.supportedBetTypes.includes('3top') && lottery.supportedBetTypes.includes('2bottom'))
      || allLotteries[0];

    assert(selectedLottery, 'No lottery found in catalog overview');

    const createMemberResponse = await agentClient.post('/agent/members', {
      account: {
        username: memberUsername,
        password: memberPassword,
        name: `E2E Member ${uniqueSuffix}`,
        phone: '0880000000'
      },
      profile: {
        creditBalance: 0,
        stockPercent: 10,
        ownerPercent: 5,
        keepPercent: 5,
        commissionRate: 2,
        defaultRateProfileId: bootstrapResponse.data.rateProfiles?.[0]?.id || '',
        status: 'active',
        notes: 'E2E smoke test member'
      },
      lotterySettings: buildMemberLotterySettings({
        bootstrap: bootstrapResponse.data,
        selectedLotteryId: selectedLottery.id || selectedLottery.lotteryTypeId
      })
    });
    expectStatus(createMemberResponse, 201, 'Create member');
    memberId = createMemberResponse.data.member?.id || createMemberResponse.data.member?._id || createMemberResponse.data.id;
    created.memberId = memberId;
    summary.created.member = { id: memberId, username: memberUsername, lotteryCode: selectedLottery.code };
    summary.checks.push('agent-create-member');

    const membersListResponse = await agentClient.get('/agent/members');
    expectStatus(membersListResponse, 200, 'Agent members list');
    assert((membersListResponse.data || []).some((member) => member.id === memberId), 'Created member not found in members list');
    summary.checks.push('agent-members-list');

    const memberDetailResponse = await agentClient.get(`/agent/members/${memberId}`);
    expectStatus(memberDetailResponse, 200, 'Agent member detail');
    assert((memberDetailResponse.data.lotteryConfigs || []).some((lottery) => lottery.lotteryCode === selectedLottery.code && lottery.isEnabled), 'Enabled lottery not found in member detail');
    summary.checks.push('agent-member-detail');

    const memberLoginResponse = await makeClient().post('/auth/login', {
      username: memberUsername,
      password: memberPassword
    });
    assert(memberLoginResponse.status === 403, 'Member login should be forbidden');
    summary.checks.push('member-login-forbidden');

    const disabledMemberToken = jwt.sign(
      { id: memberId, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    const disabledMemberClient = makeClient(disabledMemberToken);

    const blockedMemberMeResponse = await disabledMemberClient.get('/auth/me');
    assert(blockedMemberMeResponse.status === 403, 'Existing member token should be blocked');
    summary.checks.push('member-token-blocked');

    const transferCreditResponse = await agentClient.post('/wallet/transfer', {
      memberId,
      amount: 50,
      direction: 'to_member',
      note: 'E2E member funding'
    });
    expectStatus(transferCreditResponse, 201, 'Agent transfer credit');
    created.walletGroupIds.push(transferCreditResponse.data.groupId);
    summary.checks.push('agent-transfer-credit');

    const [agentWalletAfterTransfer, memberDetailAfterTransfer, transferLedgerEntry] = await Promise.all([
      agentClient.get('/wallet/summary'),
      agentClient.get(`/agent/members/${memberId}`),
      CreditLedgerEntry.findOne({ groupId: transferCreditResponse.data.groupId, userId: memberId }).lean()
    ]);
    expectStatus(agentWalletAfterTransfer, 200, 'Agent wallet after transfer');
    expectStatus(memberDetailAfterTransfer, 200, 'Agent member detail after transfer');
    assert(Number(agentWalletAfterTransfer.data.account?.creditBalance || 0) === 200, 'Agent wallet balance did not decrease after transfer');
    assert(Number(memberDetailAfterTransfer.data.member?.creditBalance || 0) === 50, 'Member credit did not increase after transfer');
    assert(transferLedgerEntry && transferLedgerEntry.direction === 'credit', 'Transfer ledger entry for member was not created');
    summary.checks.push('member-credit-visible-to-operator');

    const agentSearchMemberResponse = await agentClient.get('/agent/betting/members/search', {
      params: {
        q: memberUsername,
        limit: 10
      }
    });
    expectStatus(agentSearchMemberResponse, 200, 'Agent member betting search');
    assert((agentSearchMemberResponse.data || []).some((member) => member.id === memberId), 'Agent betting search did not return the member');
    summary.checks.push('agent-search-member-for-betting');

    const adminSearchMemberResponse = await adminClient.get('/admin/betting/members/search', {
      params: {
        q: memberUsername,
        limit: 10
      }
    });
    expectStatus(adminSearchMemberResponse, 200, 'Admin member betting search');
    assert((adminSearchMemberResponse.data || []).some((member) => member.id === memberId), 'Admin betting search did not return the member');
    summary.checks.push('admin-search-member-for-betting');

    const agentMemberContextResponse = await agentClient.get(`/agent/betting/members/${memberId}/context`);
    expectStatus(agentMemberContextResponse, 200, 'Agent member betting context');
    assert(agentMemberContextResponse.data.member?.id === memberId, 'Agent betting context returned the wrong member');
    assert(Number(agentMemberContextResponse.data.member?.creditBalance || 0) === 50, 'Agent betting context did not reflect member credit balance');
    assert(
      flattenLotteries(agentMemberContextResponse.data.catalog).some((lottery) => lottery.code === selectedLottery.code),
      'Agent betting context did not expose the selected lottery'
    );
    summary.checks.push('agent-member-betting-context');

    const adminMemberContextResponse = await adminClient.get(`/admin/betting/members/${memberId}/context`);
    expectStatus(adminMemberContextResponse, 200, 'Admin member betting context');
    assert(adminMemberContextResponse.data.member?.id === memberId, 'Admin betting context returned the wrong member');
    assert(
      flattenLotteries(adminMemberContextResponse.data.catalog).some((lottery) => lottery.code === selectedLottery.code),
      'Admin betting context did not expose the selected lottery'
    );
    summary.checks.push('admin-member-betting-context');

    const visibleLotteries = flattenLotteries(agentMemberContextResponse.data.catalog);
    assert(visibleLotteries.length === 1, `Expected exactly 1 enabled lottery in operator context, found ${visibleLotteries.length}`);
    assert(visibleLotteries[0].code === selectedLottery.code, 'Operator context exposed an unexpected lottery');
    assert(visibleLotteries[0].rateProfiles?.[0]?.rates?.['3top'] === 987, 'Custom rate was not applied to operator context');
    summary.checks.push('operator-context-catalog-filtering');

    const roundsResponse = await agentClient.get('/catalog/rounds', {
      params: { lotteryId: visibleLotteries[0].id }
    });
    expectStatus(roundsResponse, 200, 'Operator rounds');
    const availableRounds = roundsResponse.data || [];
    const selectedRound = availableRounds.find((round) => round.status === 'open')
      || availableRounds.find((round) => round.id === visibleLotteries[0].activeRound?.id && round.status === 'open')
      || availableRounds.find((round) => round.id === visibleLotteries[0].activeRound?.id)
      || availableRounds[0];
    assert(selectedRound, 'No round available for selected lottery');
    assert(selectedRound.status === 'open', `Expected an open round for selected lottery, got ${selectedRound.status || 'unknown'}`);
    summary.checks.push('operator-rounds');

    const selectedRateProfileId = visibleLotteries[0].defaultRateProfileId;

    const agentDraftPayload = {
      customerId: memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: selectedRound.id,
      rateProfileId: selectedRateProfileId,
      composer: {
        mode: 'grid',
        digitMode: '2',
        gridRows: [
          {
            id: 'draft-row-1',
            number: '45',
            amounts: { top: '10', bottom: '10', tod: '' }
          }
        ],
        gridBulkAmounts: { top: '10', bottom: '10', tod: '' },
        memo: 'agent draft composer'
      },
      savedEntries: [
        {
          id: 'draft-entry-1',
          memo: 'saved draft entry',
          source: {
            mode: 'fast',
            fastFamily: '2',
            fastAmounts: { top: '5', bottom: '5', tod: '' },
            rawInput: '12 21',
            reverse: false,
            includeDoubleSet: false,
            memo: 'saved source'
          },
          items: [
            { betType: '2top', number: '12', amount: 5, sourceFlags: {} },
            { betType: '2bottom', number: '12', amount: 5, sourceFlags: {} }
          ]
        }
      ]
    };

    const saveAgentDraftResponse = await agentClient.put('/agent/betting/draft', agentDraftPayload);
    expectStatus(saveAgentDraftResponse, 200, 'Save agent betting draft');
    assert(saveAgentDraftResponse.data.savedEntries?.length === 1, 'Agent draft save did not persist saved entries');
    summary.checks.push('agent-save-betting-draft');

    const loadAgentDraftResponse = await agentClient.get('/agent/betting/draft', {
      params: {
        customerId: memberId,
        lotteryId: visibleLotteries[0].id,
        roundId: selectedRound.id,
        rateProfileId: selectedRateProfileId
      }
    });
    expectStatus(loadAgentDraftResponse, 200, 'Load agent betting draft');
    assert(loadAgentDraftResponse.data.composer?.mode === 'grid', 'Agent draft composer mode was not restored');
    assert(loadAgentDraftResponse.data.composer?.gridRows?.[0]?.number === '45', 'Agent draft grid row was not restored');
    assert(loadAgentDraftResponse.data.savedEntries?.length === 1, 'Agent draft entries were not restored');
    summary.checks.push('agent-load-betting-draft');

    const clearAgentDraftResponse = await agentClient.delete('/agent/betting/draft', {
      data: {
        customerId: memberId,
        lotteryId: visibleLotteries[0].id,
        roundId: selectedRound.id,
        rateProfileId: selectedRateProfileId
      }
    });
    expectStatus(clearAgentDraftResponse, 200, 'Clear agent betting draft');
    summary.checks.push('agent-clear-betting-draft');

    const loadClearedAgentDraftResponse = await agentClient.get('/agent/betting/draft', {
      params: {
        customerId: memberId,
        lotteryId: visibleLotteries[0].id,
        roundId: selectedRound.id,
        rateProfileId: selectedRateProfileId
      }
    });
    expectStatus(loadClearedAgentDraftResponse, 200, 'Load cleared agent betting draft');
    assert(!loadClearedAgentDraftResponse.data.composer, 'Agent draft composer should be cleared');
    assert((loadClearedAgentDraftResponse.data.savedEntries || []).length === 0, 'Agent draft entries should be cleared');
    summary.checks.push('agent-verify-cleared-betting-draft');

    const adminDraftPayload = {
      customerId: memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: selectedRound.id,
      rateProfileId: selectedRateProfileId,
      composer: {
        mode: 'fast',
        fastFamily: '2',
        fastAmounts: { top: '10', bottom: '10', tod: '' },
        rawInput: '33 44',
        reverse: false,
        includeDoubleSet: false,
        memo: 'admin draft composer'
      },
      savedEntries: []
    };

    const saveAdminDraftResponse = await adminClient.put('/admin/betting/draft', adminDraftPayload);
    expectStatus(saveAdminDraftResponse, 200, 'Save admin betting draft');
    assert(saveAdminDraftResponse.data.composer?.mode === 'fast', 'Admin draft save did not persist composer');
    summary.checks.push('admin-save-betting-draft');

    const loadAdminDraftResponse = await adminClient.get('/admin/betting/draft', {
      params: {
        customerId: memberId,
        lotteryId: visibleLotteries[0].id,
        roundId: selectedRound.id,
        rateProfileId: selectedRateProfileId
      }
    });
    expectStatus(loadAdminDraftResponse, 200, 'Load admin betting draft');
    assert(loadAdminDraftResponse.data.composer?.rawInput === '33 44', 'Admin draft composer raw input was not restored');
    summary.checks.push('admin-load-betting-draft');

    const clearAdminDraftResponse = await adminClient.delete('/admin/betting/draft', {
      data: {
        customerId: memberId,
        lotteryId: visibleLotteries[0].id,
        roundId: selectedRound.id,
        rateProfileId: selectedRateProfileId
      }
    });
    expectStatus(clearAdminDraftResponse, 200, 'Clear admin betting draft');
    summary.checks.push('admin-clear-betting-draft');

    lockedRoundId = selectedRound.id;
    originalClosedBetTypes = selectedRound.closedBetTypes || [];
    const lockRoundResponse = await adminClient.put(`/lottery/rounds/${selectedRound.id}/closed-bet-types`, {
      closedBetTypes: ['2bottom']
    });
    expectStatus(lockRoundResponse, 200, 'Admin update round closed bet types');
    assert(lockRoundResponse.data.closedBetTypes?.includes('2bottom'), 'Admin route did not persist closed bet types');
    summary.checks.push('admin-update-round-closed-bet-types');

    const lockedRoundsResponse = await agentClient.get('/catalog/rounds', {
      params: { lotteryId: visibleLotteries[0].id }
    });
    expectStatus(lockedRoundsResponse, 200, 'Locked rounds');
    const lockedRound = (lockedRoundsResponse.data || []).find((round) => round.id === selectedRound.id);
    assert(lockedRound?.closedBetTypes?.includes('2bottom'), 'Round-level closed bet types were not exposed');
    summary.checks.push('round-closed-bet-types-visible');

    const lockedGridPreviewResponse = await agentClient.post('/agent/betting/slips/parse', {
      customerId: memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: selectedRound.id,
      rateProfileId: selectedRateProfileId,
      items: [
        { betType: '2bottom', number: '21', amount: 5 }
      ],
      memo: 'locked round test'
    });
    assert(lockedGridPreviewResponse.status === 400, 'Closed bet type should be rejected in preview');
    summary.checks.push('round-closed-bet-type-enforced');

    const restoreRoundResponse = await adminClient.put(`/lottery/rounds/${selectedRound.id}/closed-bet-types`, {
      closedBetTypes: originalClosedBetTypes
    });
    expectStatus(restoreRoundResponse, 200, 'Restore round closed bet types');
    lockedRoundId = '';

    const agentPreviewMemberSlipResponse = await agentClient.post('/agent/betting/slips/parse', {
      customerId: memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: selectedRound.id,
      rateProfileId: selectedRateProfileId,
      betType: '3top',
      defaultAmount: 5,
      rawInput: '654 5',
      reverse: false,
      includeDoubleSet: false,
      memo: 'agent preview test'
    });
    expectStatus(agentPreviewMemberSlipResponse, 200, 'Agent preview member slip');
    assert(agentPreviewMemberSlipResponse.data.member?.id === memberId, 'Agent preview returned the wrong member');
    assert(agentPreviewMemberSlipResponse.data.placedBy?.role === 'agent', 'Agent preview did not capture placedBy role');
    assert(agentPreviewMemberSlipResponse.data.items?.[0]?.payRate === 987, 'Agent preview did not use the member custom rate');
    summary.checks.push('agent-preview-member-slip');

    const agentGridPreviewResponse = await agentClient.post('/agent/betting/slips/parse', {
      customerId: memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: selectedRound.id,
      rateProfileId: selectedRateProfileId,
      items: [
        { betType: '2top', number: '12', amount: 5 },
        { betType: '2bottom', number: '12', amount: 5 },
        { betType: '2bottom', number: '21', amount: 5 },
        { betType: '3top', number: '654', amount: 5 }
      ],
      memo: 'agent grid preview test'
    });
    expectStatus(agentGridPreviewResponse, 200, 'Agent grid preview');
    assert(agentGridPreviewResponse.data.items?.some((item) => item.betType === '2bottom' && item.payRate === 92), 'Grid preview did not resolve the 2bottom custom rate');
    assert(agentGridPreviewResponse.data.summary?.itemCount === 4, 'Grid preview item count is incorrect');
    summary.checks.push('agent-grid-preview');

    const adminPreviewMemberSlipResponse = await adminClient.post('/admin/betting/slips/parse', {
      customerId: memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: selectedRound.id,
      rateProfileId: selectedRateProfileId,
      betType: '3top',
      defaultAmount: 5,
      rawInput: '765 5',
      reverse: false,
      includeDoubleSet: false,
      memo: 'admin preview test'
    });
    expectStatus(adminPreviewMemberSlipResponse, 200, 'Admin preview member slip');
    assert(adminPreviewMemberSlipResponse.data.member?.id === memberId, 'Admin preview returned the wrong member');
    assert(adminPreviewMemberSlipResponse.data.placedBy?.role === 'admin', 'Admin preview did not capture placedBy role');
    summary.checks.push('admin-preview-member-slip');

    const agentGridDraftResponse = await agentClient.post('/agent/betting/slips', {
      customerId: memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: selectedRound.id,
      rateProfileId: selectedRateProfileId,
        items: [
          { betType: '2top', number: '45', amount: 10 },
          { betType: '2bottom', number: '54', amount: 10 },
          { betType: '3tod', number: '789', amount: 5 }
        ],
      memo: 'agent grid draft slip',
      action: 'draft'
    });
    expectStatus(agentGridDraftResponse, 201, 'Agent create grid draft');
    created.slipIds.push(agentGridDraftResponse.data.id);
    assert(agentGridDraftResponse.data.items?.some((item) => item.betType === '2bottom'), 'Created grid draft did not include 2bottom item');
    summary.checks.push('agent-grid-draft-slip');

    const agentManualAction = selectedRound.status === 'open' ? 'submit' : 'draft';
    const agentCreateMemberSlipResponse = await agentClient.post('/agent/betting/slips', {
      customerId: memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: selectedRound.id,
      rateProfileId: selectedRateProfileId,
      betType: '3top',
      defaultAmount: 5,
      rawInput: '654 5',
      reverse: false,
      includeDoubleSet: false,
      memo: 'agent manual slip',
      action: agentManualAction
    });
    expectStatus(agentCreateMemberSlipResponse, 201, 'Agent create member slip');
    const agentPlacedSlipId = agentCreateMemberSlipResponse.data.id;
    created.slipIds.push(agentPlacedSlipId);
    summary.created.agentPlacedSlip = { id: agentPlacedSlipId, action: agentManualAction };
    assert(agentCreateMemberSlipResponse.data.customerId === memberId, 'Agent-created slip targeted the wrong member');
    assert(agentCreateMemberSlipResponse.data.placedBy?.role === 'agent', 'Agent-created slip missing placedBy role');
    const storedAgentPlacedSlip = await BetSlip.findById(agentPlacedSlipId).lean();
    assert(storedAgentPlacedSlip && storedAgentPlacedSlip.customerId?.toString() === memberId, 'Stored agent slip is not owned by the member');
    summary.checks.push('agent-create-member-slip');
    summary.checks.push('agent-slip-owned-by-member');

    const adminCreateDraftSlipResponse = await adminClient.post('/admin/betting/slips', {
      customerId: memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: selectedRound.id,
      rateProfileId: selectedRateProfileId,
      betType: '3top',
      defaultAmount: 7,
      rawInput: '876 7',
      reverse: false,
      includeDoubleSet: false,
      memo: 'admin draft slip',
      action: 'draft'
    });
    expectStatus(adminCreateDraftSlipResponse, 201, 'Admin create member draft slip');
    const adminPlacedSlipId = adminCreateDraftSlipResponse.data.id;
    created.slipIds.push(adminPlacedSlipId);
    summary.created.adminPlacedSlip = { id: adminPlacedSlipId, action: 'draft' };
    assert(adminCreateDraftSlipResponse.data.placedBy?.role === 'admin', 'Admin-created draft slip missing placedBy role');
    const storedAdminPlacedSlip = await BetSlip.findById(adminPlacedSlipId).lean();
    assert(storedAdminPlacedSlip && storedAdminPlacedSlip.customerId?.toString() === memberId, 'Stored admin draft is not owned by the member');
    summary.checks.push('admin-create-member-draft');
    summary.checks.push('admin-draft-owned-by-member');

    const agentBlockedParseResponse = await agentClient.post('/agent/betting/slips/parse', {
      customerId: memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: selectedRound.id,
      rateProfileId: selectedRateProfileId,
      betType: '3top',
      defaultAmount: 10,
      rawInput: '123 10',
      reverse: false,
      includeDoubleSet: false,
      memo: 'blocked test'
    });
    assert(agentBlockedParseResponse.status === 400, 'Blocked-number parse should fail for operator flow');
    summary.checks.push('agent-blocked-number-for-member');

    const memberForbiddenParseResponse = await disabledMemberClient.post('/member/slips/parse', {
      lotteryId: visibleLotteries[0].id,
      roundId: selectedRound.id,
      rateProfileId: selectedRateProfileId,
      betType: '3top',
      defaultAmount: 10,
      rawInput: '456 10',
      reverse: false,
      includeDoubleSet: false,
      memo: 'forbidden parse test'
    });
    assert(memberForbiddenParseResponse.status === 403, 'Member parse should be forbidden');
    summary.checks.push('member-parse-forbidden');

    const memberForbiddenCreateResponse = await disabledMemberClient.post('/member/slips', {
      lotteryId: visibleLotteries[0].id,
      roundId: selectedRound.id,
      rateProfileId: selectedRateProfileId,
      betType: '3top',
      defaultAmount: 10,
      rawInput: '456 10',
      reverse: false,
      includeDoubleSet: false,
      memo: 'forbidden create test',
      action: 'submit'
    });
    assert(memberForbiddenCreateResponse.status === 403, 'Member create should be forbidden');
    summary.checks.push('member-create-forbidden');

    if (selectedRound.status === 'open') {
      slipId = agentPlacedSlipId;
      summary.created.submittedSlip = { id: slipId, roundCode: agentCreateMemberSlipResponse.data.roundCode };

      const agentBetsResponse = await agentClient.get('/agent/bets', {
        params: {
          roundDate: agentCreateMemberSlipResponse.data.roundCode,
          marketId: agentCreateMemberSlipResponse.data.lotteryCode
        }
      });
      expectStatus(agentBetsResponse, 200, 'Agent bets');
      assert((agentBetsResponse.data || []).some((item) => item.slipId === slipId), 'Operator-submitted slip not found in agent bets');
      summary.checks.push('agent-bets-list');

      const agentRecentItemsResponse = await agentClient.get('/agent/betting/items/recent', {
        params: {
          customerId: memberId,
          roundDate: agentCreateMemberSlipResponse.data.roundCode,
          marketId: agentCreateMemberSlipResponse.data.lotteryCode
        }
      });
      expectStatus(agentRecentItemsResponse, 200, 'Agent recent betting items');
      assert((agentRecentItemsResponse.data || []).some((item) => item.slipId === slipId), 'Operator-submitted slip not found in agent recent betting items');
      summary.checks.push('agent-recent-betting-items');

      const adminRecentItemsResponse = await adminClient.get('/admin/betting/items/recent', {
        params: {
          customerId: memberId,
          roundDate: agentCreateMemberSlipResponse.data.roundCode,
          marketId: agentCreateMemberSlipResponse.data.lotteryCode
        }
      });
      expectStatus(adminRecentItemsResponse, 200, 'Admin recent betting items');
      assert((adminRecentItemsResponse.data || []).some((item) => item.slipId === slipId), 'Operator-submitted slip not found in admin recent betting items');
      summary.checks.push('admin-recent-betting-items');

      const reportBeforeCancel = await agentClient.get('/agent/reports', {
        params: {
          roundDate: agentCreateMemberSlipResponse.data.roundCode,
          marketId: agentCreateMemberSlipResponse.data.lotteryCode
        }
      });
      expectStatus(reportBeforeCancel, 200, 'Agent reports before cancel');
      assert((reportBeforeCancel.data.pendingRows || []).some((item) => item.slipId === slipId), 'Operator-submitted slip not found in pending report');
      summary.checks.push('agent-reports-pending');

      const cancelSlipResponse = await agentClient.post(`/agent/betting/slips/${slipId}/cancel`);
      expectStatus(cancelSlipResponse, 200, 'Agent cancel slip');
      assert(cancelSlipResponse.data.status === 'cancelled', 'Slip status did not change to cancelled');
      summary.checks.push('agent-cancel-member-slip');

      const reportAfterCancel = await agentClient.get('/agent/reports', {
        params: {
          roundDate: agentCreateMemberSlipResponse.data.roundCode,
          marketId: agentCreateMemberSlipResponse.data.lotteryCode
        }
      });
      expectStatus(reportAfterCancel, 200, 'Agent reports after cancel');
      assert(!(reportAfterCancel.data.pendingRows || []).some((item) => item.slipId === slipId), 'Cancelled slip still appears in pending report');
      summary.checks.push('agent-reports-after-cancel');
    } else {
      summary.warnings.push(`Selected round ${selectedRound.code} is not open, submit/cancel smoke was skipped`);
      assert(agentCreateMemberSlipResponse.data.status === 'draft', 'Closed round should create draft operator slip');
      summary.checks.push('agent-draft-slip-on-closed-round');
    }

    console.log(JSON.stringify({
      ok: true,
      ...summary,
      finishedAt: new Date().toISOString()
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      ...summary,
      error: error.message,
      finishedAt: new Date().toISOString()
    }, null, 2));
    process.exitCode = 1;
  } finally {
    try {
      if (lockedRoundId) {
        if (adminClient) {
          try {
            await adminClient.put(`/lottery/rounds/${lockedRoundId}/closed-bet-types`, {
              closedBetTypes: originalClosedBetTypes || []
            });
          } catch {
            await DrawRound.updateOne({ _id: lockedRoundId }, { $set: { closedBetTypes: originalClosedBetTypes || [] } });
          }
        } else {
          await DrawRound.updateOne({ _id: lockedRoundId }, { $set: { closedBetTypes: originalClosedBetTypes || [] } });
        }
      }
      await cleanupSmokeArtifacts(created);
    } catch (cleanupError) {
      console.error(`Cleanup error: ${cleanupError.message}`);
      process.exitCode = process.exitCode || 1;
    }

    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }

    await killProcess(server);
  }
};

main();
