require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const assert = require('assert');
const { createCookieSessionClient } = require('./e2eCookieClient');
const mongoose = require('mongoose');
const { spawn } = require('child_process');
const path = require('path');

const AuditLog = require('../models/AuditLog');
const BetItem = require('../models/BetItem');
const BetSlip = require('../models/BetSlip');
const CreditLedgerEntry = require('../models/CreditLedgerEntry');
const DrawRound = require('../models/DrawRound');
const LotteryResult = require('../models/LotteryResult');
const LotteryType = require('../models/LotteryType');
const ResultRecord = require('../models/ResultRecord');
const User = require('../models/User');
const UserLotteryConfig = require('../models/UserLotteryConfig');
const { getSlipDetail, getMemberSummary } = require('../services/betSlipService');
const { buildDirectMongoUri } = require('../utils/mongoUri');

const backendDir = path.join(__dirname, '..', '..');
const port = process.env.E2E_PORT || '5052';
const baseURL = `http://127.0.0.1:${port}/api`;
const uniqueSuffix = Date.now().toString().slice(-6);
const shouldStartServer = process.env.E2E_SKIP_SERVER !== '1';
const adminUsername = process.env.E2E_ADMIN_USERNAME || process.env.DEFAULT_ADMIN_USERNAME || 'admin';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const makeClient = () => createCookieSessionClient({ baseURL });

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
      assert.strictEqual(response.data.token, undefined, 'Login response should not include a bearer token');
      return {
        client,
        csrfToken: response.data.csrfToken,
        user: response.data.user
      };
    }

    await sleep(1000);
  }

  throw new Error(`${label} login failed`);
};

const flattenLotteries = (overview) =>
  (overview.leagues || []).flatMap((league) => league.lotteries || []);

const buildMemberLotterySettings = ({ bootstrap, enabledLotteryId }) =>
  (bootstrap.lotteries || []).map((lottery) => ({
    lotteryTypeId: lottery.lotteryTypeId,
    isEnabled: lottery.lotteryTypeId === enabledLotteryId,
    rateProfileId: lottery.availableRateProfiles?.[0]?.id || lottery.rateProfileId || '',
    enabledBetTypes: lottery.lotteryTypeId === enabledLotteryId
      ? lottery.supportedBetTypes.filter((betType) => ['3top', '2top'].includes(betType))
      : lottery.supportedBetTypes.slice(0, 1),
    minimumBet: 1,
    maximumBet: 50,
    maximumPerNumber: 50,
    stockPercent: 10,
    ownerPercent: 5,
    keepPercent: 5,
    commissionRate: 2,
    useCustomRates: lottery.lotteryTypeId === enabledLotteryId,
    customRates: {
      '3top': 987,
      '3tod': 654,
      '2top': 87,
      '2bottom': 92,
      'run_top': 4,
      'run_bottom': 3
    },
    keepMode: 'cap',
    keepCapAmount: 200,
    blockedNumbers: ['123'],
    notes: 'E2E regression member config'
  }));

const formatBangkokDate = (date) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);

const makeRegressionRoundCode = async (lotteryTypeId) => {
  for (let offset = 1; offset <= 20; offset++) {
    const date = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
    const code = formatBangkokDate(date);
    const exists = await DrawRound.exists({ lotteryTypeId, code });
    if (!exists) {
      return code;
    }
  }

  throw new Error('Unable to find a unique regression round code');
};

const ensureRegressionRound = async () => {
  const lotteryType = await LotteryType.findOne({ code: 'thai_government' }).select('_id code name');
  if (!lotteryType) {
    throw new Error('thai_government lottery type was not found');
  }

  const roundCode = await makeRegressionRoundCode(lotteryType._id);
  const now = new Date();
  const round = await DrawRound.create({
    lotteryTypeId: lotteryType._id,
    code: roundCode,
    title: `Regression ${roundCode}`,
    openAt: new Date(now.getTime() - 60 * 60 * 1000),
    closeAt: new Date(now.getTime() + 30 * 60 * 1000),
    drawAt: new Date(now.getTime() + 60 * 60 * 1000),
    status: 'open',
    isActive: true
  });

  return {
    lotteryTypeId: lotteryType._id.toString(),
    lotteryCode: lotteryType.code,
    roundId: round._id.toString(),
    roundCode
  };
};

const killProcess = async (child) => {
  if (!child || child.killed || child.exitCode !== null) return;

  try {
    child.kill();
  } catch {}

  await sleep(1500);
};

const cleanupRegressionArtifacts = async (created = {}) => {
  const groupIds = (created.walletGroupIds || []).filter(Boolean);
  const targets = [
    created.agentId,
    created.memberId,
    created.slipId,
    created.roundId,
    created.roundCode,
    ...groupIds
  ].filter(Boolean);

  if (groupIds.length) {
    await CreditLedgerEntry.deleteMany({ groupId: { $in: groupIds } });
  }
  const userIds = [created.agentId, created.memberId].filter(Boolean);
  if (userIds.length) {
    await CreditLedgerEntry.deleteMany({ userId: { $in: userIds } });
  }

  if (created.roundId) {
    await CreditLedgerEntry.deleteMany({
      entryType: 'settlement',
      'metadata.roundId': created.roundId
    });
  }

  if (created.roundId) {
    await BetItem.deleteMany({ drawRoundId: created.roundId });
    await BetSlip.deleteMany({ drawRoundId: created.roundId });
    await ResultRecord.deleteMany({ drawRoundId: created.roundId });
    await DrawRound.deleteOne({ _id: created.roundId });
  }

  if (created.roundCode) {
    await LotteryResult.deleteMany({ roundDate: created.roundCode });
  }

  if (created.memberId) {
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

const main = async () => {
  const summary = {
    startedAt: new Date().toISOString(),
    port,
    checks: [],
    created: {},
    warnings: []
  };

  let server;
  const created = {
    walletGroupIds: []
  };

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing');
    }

    const mongoUri = await buildDirectMongoUri(process.env.MONGODB_URI);
    await mongoose.connect(mongoUri);
    await BetSlip.syncIndexes();
    summary.checks.push('bet-slip-client-request-index');
    created.round = await ensureRegressionRound();
    created.roundId = created.round.roundId;
    created.roundCode = created.round.roundCode;
    summary.created.round = created.round;

    if (shouldStartServer) {
      server = spawn(process.execPath, ['server.js'], {
        cwd: backendDir,
        env: {
          ...process.env,
          PORT: port
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });
    }

    await waitForServer();
    summary.checks.push('health');

    const adminLogin = await loginWithRetry(adminUsername, adminPassword, 'Admin');
    const adminClient = adminLogin.client;
    summary.checks.push('admin-login');
    const agentUsername = `e2e_reg_agent_${uniqueSuffix}`;
    const agentPassword = `Bb${uniqueSuffix}!`;
    const memberUsername = `e2e_reg_member_${uniqueSuffix}`;
    const memberPassword = `Bb${uniqueSuffix}!`;

    const createAgentResponse = await adminClient.post('/admin/agents', {
      username: agentUsername,
      password: agentPassword,
      name: `E2E Regression Agent ${uniqueSuffix}`,
      phone: '0991111111'
    });
    expectStatus(createAgentResponse, 201, 'Create agent');
    created.agentId = createAgentResponse.data._id || createAgentResponse.data.id;
    summary.created.agent = { id: created.agentId, username: agentUsername };
    summary.checks.push('admin-create-agent');

    const adjustAgentCreditResponse = await adminClient.post('/wallet/adjust', {
      targetUserId: created.agentId,
      amount: 300,
      note: 'E2E regression agent funding',
      reasonCode: 'agent_topup'
    });
    expectStatus(adjustAgentCreditResponse, 201, 'Adjust agent credit');
    created.walletGroupIds.push(adjustAgentCreditResponse.data.groupId);
    summary.checks.push('admin-adjust-agent-credit');

    const agentLogin = await loginWithRetry(agentUsername, agentPassword, 'Agent');
    const agentClient = agentLogin.client;
    summary.checks.push('agent-login');
    const [bootstrapResponse, agentCatalogResponse, agentHeartbeatResponse] = await Promise.all([
      agentClient.get('/agent/config/bootstrap'),
      agentClient.get('/catalog/overview'),
      agentClient.post('/presence/heartbeat')
    ]);
    expectStatus(bootstrapResponse, 200, 'Agent bootstrap');
    expectStatus(agentCatalogResponse, 200, 'Agent catalog overview');
    expectStatus(agentHeartbeatResponse, 200, 'Agent heartbeat');
    summary.checks.push('agent-bootstrap');
    summary.checks.push('agent-catalog-overview');
    summary.checks.push('agent-heartbeat');

    const thaiGovernmentLottery = flattenLotteries(agentCatalogResponse.data).find(
      (lottery) => lottery.code === created.round.lotteryCode
    );
    assert(thaiGovernmentLottery, 'Thai government lottery was not exposed in catalog overview');

    const createMemberResponse = await agentClient.post('/agent/members', {
      account: {
        username: memberUsername,
        password: memberPassword,
        name: `E2E Regression Member ${uniqueSuffix}`,
        phone: '0881111111'
      },
      profile: {
        creditBalance: 0,
        stockPercent: 10,
        ownerPercent: 5,
        keepPercent: 5,
        commissionRate: 2,
        defaultRateProfileId: bootstrapResponse.data.rateProfiles?.[0]?.id || '',
        status: 'active',
        notes: 'E2E regression member'
      },
      lotterySettings: buildMemberLotterySettings({
        bootstrap: bootstrapResponse.data,
        enabledLotteryId: thaiGovernmentLottery.id || thaiGovernmentLottery.lotteryTypeId
      })
    });
    expectStatus(createMemberResponse, 201, 'Create member');
    created.memberId = createMemberResponse.data.member?.id || createMemberResponse.data.member?._id || createMemberResponse.data.id;
    summary.created.member = { id: created.memberId, username: memberUsername };
    summary.checks.push('agent-create-member');

    const transferToMemberResponse = await agentClient.post('/wallet/transfer', {
      memberId: created.memberId,
      amount: 100,
      direction: 'to_member',
      note: 'E2E regression member funding'
    });
    expectStatus(transferToMemberResponse, 201, 'Transfer credit to member');
    created.walletGroupIds.push(transferToMemberResponse.data.groupId);
    summary.checks.push('agent-transfer-to-member');

    const memberContextResponse = await agentClient.get(`/agent/betting/members/${created.memberId}/context`);
    expectStatus(memberContextResponse, 200, 'Agent member betting context');
    summary.checks.push('agent-member-betting-context');

    const visibleLotteries = flattenLotteries(memberContextResponse.data.catalog || {});
    assert(visibleLotteries.length === 1, `Expected exactly 1 enabled lottery, found ${visibleLotteries.length}`);
    assert(visibleLotteries[0].code === created.round.lotteryCode, 'Member lottery visibility is incorrect');
    summary.checks.push('member-catalog-filtering');

    const regressionRound = visibleLotteries[0].activeRound;
    assert(regressionRound, 'Regression round was not visible to the member');
    assert(regressionRound.id === created.roundId, 'Regression round should be active for betting');
    summary.checks.push('member-rounds');

    const agentViewMemberWalletResponse = await agentClient.get('/wallet/summary', {
      params: { targetUserId: created.memberId }
    });
    expectStatus(agentViewMemberWalletResponse, 200, 'Agent wallet summary for member');
    assert(Number(agentViewMemberWalletResponse.data.account?.creditBalance || 0) === 100, 'Member wallet balance should equal 100 after funding');
    summary.checks.push('agent-wallet-member-view');

    const insufficientTransferResponse = await agentClient.post('/wallet/transfer', {
      memberId: created.memberId,
      amount: 99999,
      direction: 'to_member',
      note: 'Should fail'
    });
    assert(insufficientTransferResponse.status === 400, 'Oversized transfer should fail');
    summary.checks.push('wallet-insufficient-balance');

    const reverseParseResponse = await agentClient.post('/agent/betting/slips/parse', {
      customerId: created.memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: regressionRound.id,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      betType: '2top',
      defaultAmount: 5,
      rawInput: '12 5',
      reverse: true,
      includeDoubleSet: false,
      memo: 'reverse parse test'
    });
    expectStatus(reverseParseResponse, 200, 'Reverse parse');
    assert(reverseParseResponse.data.items.length === 2, 'Reverse parse should generate exactly 2 items');
    assert(reverseParseResponse.data.items.every((item) => item.payRate === 87), 'Reverse parse should use custom 2top rate');
    summary.checks.push('member-parse-reverse');

    const doubleSetParseResponse = await agentClient.post('/agent/betting/slips/parse', {
      customerId: created.memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: regressionRound.id,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      betType: '2top',
      defaultAmount: 2,
      rawInput: '',
      reverse: false,
      includeDoubleSet: true,
      memo: 'double set test'
    });
    expectStatus(doubleSetParseResponse, 200, 'Double set parse');
    assert(doubleSetParseResponse.data.items.length === 10, 'Double-set helper should generate 10 repeated-digit numbers');
    summary.checks.push('member-parse-double-set');

    const draftNoDebitResponse = await agentClient.post('/agent/betting/slips', {
      customerId: created.memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: regressionRound.id,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      betType: '3top',
      defaultAmount: 10,
      rawInput: '321 10',
      reverse: false,
      includeDoubleSet: false,
      memo: 'draft should not debit credit',
      action: 'draft',
      clientRequestId: `regression-draft-${uniqueSuffix}`
    });
    expectStatus(draftNoDebitResponse, 201, 'Create draft without debit');
    const [memberWalletAfterDraft, draftStakeLedgerEntry] = await Promise.all([
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      CreditLedgerEntry.findOne({
        userId: created.memberId,
        entryType: 'bet',
        reasonCode: 'bet_stake',
        'metadata.slipId': draftNoDebitResponse.data.id
      }).lean()
    ]);
    expectStatus(memberWalletAfterDraft, 200, 'Member wallet after draft slip');
    assert(Number(memberWalletAfterDraft.data.account?.creditBalance || 0) === 100, 'Draft slip should not debit member wallet');
    assert(!draftStakeLedgerEntry, 'Draft slip should not create a bet stake ledger entry');
    summary.checks.push('member-draft-does-not-debit-credit');
    const insufficientBetResponse = await agentClient.post('/agent/betting/slips', {
      customerId: created.memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: regressionRound.id,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      items: [
        { betType: '3top', number: '101', amount: 50 },
        { betType: '3top', number: '102', amount: 50 },
        { betType: '3top', number: '103', amount: 50 }
      ],
      memo: 'insufficient credit bet test',
      action: 'submit'
    });
    assert(insufficientBetResponse.status === 400, 'Bet larger than member credit should fail');
    assert(/Insufficient credit balance/i.test(String(insufficientBetResponse.data?.message || '')), 'Insufficient credit error should be explicit');
    summary.checks.push('member-bet-insufficient-credit');

    const [insufficientSlipCount, betLedgerCountAfterInsufficient, memberWalletAfterInsufficient] = await Promise.all([
      BetSlip.countDocuments({
        customerId: created.memberId,
        drawRoundId: regressionRound.id,
        memo: 'insufficient credit bet test'
      }),
      CreditLedgerEntry.countDocuments({ userId: created.memberId, entryType: 'bet' }),
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } })
    ]);
    expectStatus(memberWalletAfterInsufficient, 200, 'Member wallet after insufficient bet');
    assert(insufficientSlipCount === 0, 'Insufficient-credit submit must not leave a slip behind');
    assert(betLedgerCountAfterInsufficient === 0, 'Insufficient-credit submit must not leave a bet ledger entry behind');
    assert(Number(memberWalletAfterInsufficient.data.account?.creditBalance || 0) === 100, 'Insufficient-credit submit must not change member balance');
    summary.checks.push('member-bet-insufficient-credit-rollback');

    const concurrentSameClientRequestId = `regression-concurrent-same-${uniqueSuffix}`;
    const concurrentSamePayload = {
      customerId: created.memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: regressionRound.id,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      betType: '3top',
      defaultAmount: 10,
      rawInput: '654 10',
      reverse: false,
      includeDoubleSet: false,
      memo: 'concurrent same idempotency key',
      action: 'submit',
      clientRequestId: concurrentSameClientRequestId
    };
    const concurrentSameResponses = await Promise.all([
      agentClient.post('/agent/betting/slips', concurrentSamePayload),
      agentClient.post('/agent/betting/slips', concurrentSamePayload)
    ]);
    concurrentSameResponses.forEach((response, index) => {
      expectStatus(response, 201, `Concurrent same-key submit ${index + 1}`);
    });
    const concurrentSameSlipId = concurrentSameResponses[0].data.id;
    assert(concurrentSameResponses.every((response) => response.data.id === concurrentSameSlipId), 'Concurrent same-key submits should return the same slip');
    const [memberWalletAfterConcurrentSame, sameKeyStakeLedgerEntries, sameKeySlipCount] = await Promise.all([
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      CreditLedgerEntry.find({
        userId: created.memberId,
        entryType: 'bet',
        direction: 'debit',
        reasonCode: 'bet_stake',
        'metadata.slipId': concurrentSameSlipId
      }).lean(),
      BetSlip.countDocuments({
        customerId: created.memberId,
        drawRoundId: regressionRound.id,
        clientRequestId: concurrentSameClientRequestId
      })
    ]);
    expectStatus(memberWalletAfterConcurrentSame, 200, 'Member wallet after concurrent same-key submit');
    assert(Number(memberWalletAfterConcurrentSame.data.account?.creditBalance || 0) === 90, 'Concurrent same-key submit must debit member wallet once');
    assert(sameKeyStakeLedgerEntries.length === 1, 'Concurrent same-key submit must create one stake ledger entry');
    assert(sameKeySlipCount === 1, 'Concurrent same-key submit must create one slip');
    summary.checks.push('member-submit-concurrent-same-client-request-id');

    const cancelConcurrentSameResponse = await agentClient.post(`/agent/betting/slips/${concurrentSameSlipId}/cancel`);
    expectStatus(cancelConcurrentSameResponse, 200, 'Cancel concurrent same-key slip');
    const cancelConcurrentSameAgainResponse = await agentClient.post(`/agent/betting/slips/${concurrentSameSlipId}/cancel`);
    assert(cancelConcurrentSameAgainResponse.status === 400, 'Cancelling the same slip twice should fail');
    const [memberWalletAfterConcurrentSameCancel, sameKeyRefundLedgerEntries] = await Promise.all([
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      CreditLedgerEntry.find({
        userId: created.memberId,
        entryType: 'bet',
        direction: 'credit',
        reasonCode: 'bet_stake_refund',
        'metadata.slipId': concurrentSameSlipId
      }).lean()
    ]);
    expectStatus(memberWalletAfterConcurrentSameCancel, 200, 'Member wallet after cancelling concurrent same-key slip');
    assert(Number(memberWalletAfterConcurrentSameCancel.data.account?.creditBalance || 0) === 100, 'Cancelling concurrent same-key slip should refund stake once');
    assert(sameKeyRefundLedgerEntries.length === 1, 'Cancelling concurrent same-key slip twice must create one refund ledger entry');
    summary.checks.push('member-cancel-twice-no-double-refund');

    const concurrentOverCreditPayloads = ['701', '702', '703'].map((number, index) => ({
      customerId: created.memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: regressionRound.id,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      betType: '3top',
      defaultAmount: 50,
      rawInput: `${number} 50`,
      reverse: false,
      includeDoubleSet: false,
      memo: `concurrent over-credit ${number}`,
      action: 'submit',
      clientRequestId: `regression-over-credit-${index}-${uniqueSuffix}`
    }));
    const concurrentOverCreditResponses = await Promise.all(
      concurrentOverCreditPayloads.map((payload) => agentClient.post('/agent/betting/slips', payload))
    );
    const overCreditSuccesses = concurrentOverCreditResponses.filter((response) => response.status === 201);
    const overCreditFailures = concurrentOverCreditResponses.filter((response) => response.status === 400);
    assert(overCreditSuccesses.length === 2, `Concurrent over-credit submits should allow exactly two slips (got ${overCreditSuccesses.length})`);
    assert(overCreditFailures.length === 1, `Concurrent over-credit submits should reject exactly one slip (got ${overCreditFailures.length})`);
    assert(/Insufficient credit balance/i.test(String(overCreditFailures[0].data?.message || '')), 'Rejected concurrent over-credit submit should fail for insufficient balance');
    const [memberWalletAfterConcurrentOverCredit, overCreditStakeLedgerCount] = await Promise.all([
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      CreditLedgerEntry.countDocuments({
        userId: created.memberId,
        entryType: 'bet',
        direction: 'debit',
        reasonCode: 'bet_stake',
        'metadata.slipId': { $in: overCreditSuccesses.map((response) => response.data.id) }
      })
    ]);
    expectStatus(memberWalletAfterConcurrentOverCredit, 200, 'Member wallet after concurrent over-credit submits');
    assert(Number(memberWalletAfterConcurrentOverCredit.data.account?.creditBalance || 0) === 0, 'Concurrent over-credit submits must not make balance negative');
    assert(overCreditStakeLedgerCount === 2, 'Concurrent over-credit submits should create stake ledger entries only for successful slips');
    summary.checks.push('member-submit-concurrent-over-credit-no-negative-balance');

    for (const response of overCreditSuccesses) {
      const cancelResponse = await agentClient.post(`/agent/betting/slips/${response.data.id}/cancel`);
      expectStatus(cancelResponse, 200, 'Cancel concurrent over-credit setup slip');
    }
    const memberWalletAfterConcurrentCleanup = await agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } });
    expectStatus(memberWalletAfterConcurrentCleanup, 200, 'Member wallet after concurrent setup cleanup');
    assert(Number(memberWalletAfterConcurrentCleanup.data.account?.creditBalance || 0) === 100, 'Concurrent setup cleanup should restore member balance before settlement regression');
    summary.checks.push('member-submit-concurrent-cleanup-restores-balance');

    const submitClientRequestId = `regression-submit-${uniqueSuffix}`;

    const submitSlipResponse = await agentClient.post('/agent/betting/slips', {
      customerId: created.memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: regressionRound.id,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      betType: '3top',
      defaultAmount: 10,
      rawInput: '456 10',
      reverse: false,
      includeDoubleSet: false,
      memo: 'winning regression slip',
      action: 'submit',
      clientRequestId: submitClientRequestId
    });
    expectStatus(submitSlipResponse, 201, 'Submit slip');
    created.slipId = submitSlipResponse.data.id;
    summary.created.slip = { id: created.slipId, slipNumber: submitSlipResponse.data.slipNumber };
    summary.checks.push('member-submit-slip');

    const [memberWalletAfterStake, stakeLedgerEntry] = await Promise.all([
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      CreditLedgerEntry.findOne({
        userId: created.memberId,
        entryType: 'bet',
        direction: 'debit',
        reasonCode: 'bet_stake',
        'metadata.slipId': created.slipId
      }).lean()
    ]);
    expectStatus(memberWalletAfterStake, 200, 'Member wallet after stake debit');
    assert(Number(memberWalletAfterStake.data.account?.creditBalance || 0) === 90, 'Member wallet should be debited immediately after submitting a bet');
    assert(stakeLedgerEntry && Number(stakeLedgerEntry.amount || 0) === 10, 'Bet stake debit ledger entry should match submitted stake');
    summary.checks.push('member-credit-debited-on-submit');

    const duplicateSubmitResponse = await agentClient.post('/agent/betting/slips', {
      customerId: created.memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: regressionRound.id,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      betType: '3top',
      defaultAmount: 10,
      rawInput: '456 10',
      reverse: false,
      includeDoubleSet: false,
      memo: 'winning regression slip',
      action: 'submit',
      clientRequestId: submitClientRequestId
    });
    expectStatus(duplicateSubmitResponse, 201, 'Duplicate submit with same clientRequestId');
    const [memberWalletAfterDuplicateSubmit, stakeLedgerEntriesAfterDuplicateSubmit, slipCountForClientRequest] = await Promise.all([
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      CreditLedgerEntry.find({
        userId: created.memberId,
        entryType: 'bet',
        direction: 'debit',
        reasonCode: 'bet_stake',
        'metadata.slipId': created.slipId
      }).lean(),
      BetSlip.countDocuments({
        customerId: created.memberId,
        drawRoundId: regressionRound.id,
        clientRequestId: submitClientRequestId
      })
    ]);
    expectStatus(memberWalletAfterDuplicateSubmit, 200, 'Member wallet after duplicate submit');
    assert(duplicateSubmitResponse.data.id === created.slipId, 'Duplicate submit should return the original slip');
    assert(Number(memberWalletAfterDuplicateSubmit.data.account?.creditBalance || 0) === 90, 'Duplicate submit must not debit member wallet twice');
    assert(stakeLedgerEntriesAfterDuplicateSubmit.length === 1, 'Duplicate submit must not create a second stake ledger entry');
    assert(slipCountForClientRequest === 1, 'Duplicate submit must not create a second slip for the same clientRequestId');
    summary.checks.push('member-submit-idempotent-no-double-debit');

    const pendingReportResponse = await agentClient.get('/agent/reports', {
      params: {
        roundDate: created.roundCode,
        marketId: created.round.lotteryCode
      }
    });
    expectStatus(pendingReportResponse, 200, 'Agent reports before settlement');
    assert((pendingReportResponse.data.pendingRows || []).some((item) => item.slipId === created.slipId), 'Pending report should include submitted slip');
    summary.checks.push('agent-report-pending-before-result');

    const incompleteResultResponse = await adminClient.post('/lottery/manual', {
      roundDate: created.roundCode,
      firstPrize: '123456',
      twoBottom: '56',
      runTop: ['4', '5', '6'],
      runBottom: ['5', '6']
    });
    assert(
      incompleteResultResponse.status === 400,
      `Incomplete government result should be rejected before publish/settle (got ${incompleteResultResponse.status}: ${JSON.stringify(incompleteResultResponse.data)})`
    );
    assert(
      /3 \u0E15\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32|threeFront|3 \u0E15\u0E31\u0E27\u0E25\u0E48\u0E32\u0E07|threeBottom/i.test(String(incompleteResultResponse.data?.message || '')),
      `Incomplete result error should explain missing 3-front/3-bottom prizes (got "${incompleteResultResponse.data?.message || ''}")`
    );
    const [resultRecordAfterIncomplete, winningItemAfterIncomplete] = await Promise.all([
      ResultRecord.findOne({ drawRoundId: created.roundId }).lean(),
      BetItem.findOne({ slipId: created.slipId, number: '456' }).lean()
    ]);
    assert(!resultRecordAfterIncomplete, 'Incomplete government result must not create a published result record');
    assert(winningItemAfterIncomplete, 'Winning item should still exist after incomplete result rejection');
    assert(winningItemAfterIncomplete.result === 'pending', 'Incomplete result must not settle any bet item');
    assert(winningItemAfterIncomplete.isLocked === false, 'Incomplete result must not lock bet items');
    summary.checks.push('admin-manual-result-validation');

    const saveResultResponse = await adminClient.post('/lottery/manual', {
      roundDate: created.roundCode,
      firstPrize: '123456',
      threeTopList: ['123', '456'],
      threeBotList: ['111', '222'],
      twoBottom: '56',
      runTop: ['4', '5', '6'],
      runBottom: ['5', '6']
    });
    expectStatus(saveResultResponse, 200, 'Manual result save');
    assert(Number(saveResultResponse.data.settlement?.wonCount || 0) >= 1, 'Settlement should mark at least one winning item');
    summary.checks.push('admin-manual-result');

    const [slipDetailAfterResult, roundResultResponse, recentResultsResponse, memberWalletAfterResult, settlementLedgerEntriesAfterResult, rawWinningItemAfterResult] = await Promise.all([
      getSlipDetail({ customerId: created.memberId, slipId: created.slipId }),
      agentClient.get(`/results/round/${regressionRound.id}`),
      agentClient.get('/results/recent', { params: { lotteryId: visibleLotteries[0].id, limit: 10 } }),
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      CreditLedgerEntry.find({ userId: created.memberId, entryType: 'settlement' }).lean(),
      BetItem.findOne({ slipId: created.slipId, number: '456' }).lean()
    ]);
    expectStatus(roundResultResponse, 200, 'Round result');
    expectStatus(recentResultsResponse, 200, 'Recent results');
    expectStatus(memberWalletAfterResult, 200, 'Member wallet after result');

    const winningItem = (slipDetailAfterResult.items || []).find((item) => item.number === '456');
    assert(winningItem, 'Winning slip item not found in slip detail');
    assert(winningItem.result === 'won', 'Winning item should be marked won');
    assert(winningItem.isLocked === true, 'Winning item should be locked after settlement');
    assert(
      Number(winningItem.wonAmount || 0) === 9870,
      `Winning amount should equal 10 * 987 (got wonAmount=${winningItem.wonAmount}, payRate=${winningItem.payRate}, amount=${winningItem.amount})`
    );
    assert(
      Number(memberWalletAfterResult.data.account?.creditBalance || 0) === 9960,
      `Member wallet should receive the winning payout exactly once (got balance=${memberWalletAfterResult.data.account?.creditBalance}, wonAmount=${winningItem.wonAmount}, ledgerEntries=${settlementLedgerEntriesAfterResult.length}, ledgerAmount=${settlementLedgerEntriesAfterResult[0]?.amount || 0}, rawPayoutApplied=${rawWinningItemAfterResult?.payoutAppliedAmount || 0}, rawResult=${rawWinningItemAfterResult?.result || ''}, rawLocked=${rawWinningItemAfterResult?.isLocked || false})`
    );
    assert(
      settlementLedgerEntriesAfterResult.length === 1,
      `Settlement should create exactly one payout ledger entry for the member (got ${settlementLedgerEntriesAfterResult.length})`
    );
    assert(
      Number(settlementLedgerEntriesAfterResult[0]?.amount || 0) === 9870,
      `Settlement ledger amount should equal the winning payout (got ${settlementLedgerEntriesAfterResult[0]?.amount || 0})`
    );
    assert(roundResultResponse.data.threeTop === '456', 'Round result should expose 3top=456');
    assert((recentResultsResponse.data || []).some((item) => item.roundCode === created.roundCode), 'Recent results should include regression round');
    summary.checks.push('member-slip-result');
    summary.checks.push('results-round');
    summary.checks.push('results-recent');

    const summaryResponse = await getMemberSummary({
      customerId: created.memberId,
      roundCode: created.roundCode,
      marketId: created.round.lotteryCode
    });
    assert(Number(summaryResponse.overall?.totalWon || 0) >= 9870, 'Member summary should include winning amount');
    summary.checks.push('member-summary-after-result');

    const cancelAfterSettlementResponse = await adminClient.post(`/admin/betting/slips/${created.slipId}/cancel`);
    assert(cancelAfterSettlementResponse.status === 400, 'Settled slip should not be cancellable');
    summary.checks.push('admin-cancel-blocked-after-result');

    const reconcileBeforeReverseResponse = await adminClient.get(`/lottery/rounds/${regressionRound.id}/settlement/reconcile`);
    expectStatus(reconcileBeforeReverseResponse, 200, 'Reconcile round settlement before reverse');
    assert(reconcileBeforeReverseResponse.data.mismatchedItems === 0, 'Settlement reconciliation should be clean before reverse');
    assert(Number(reconcileBeforeReverseResponse.data.appliedPayoutTotal || 0) === 9870, 'Applied payout total should match winning payout before reverse');
    summary.checks.push('result-reconcile-before-reverse');

    const reverseSettlementResponse = await adminClient.post(`/lottery/rounds/${regressionRound.id}/settlement/reverse`);
    expectStatus(reverseSettlementResponse, 200, 'Reverse round settlement');
    assert(Number(reverseSettlementResponse.data.summary?.reversedPayoutTotal || 0) === 9870, 'Reverse settlement should roll back the winning payout');
    const [memberWalletAfterReverse, settlementLedgerEntriesAfterReverse, rawWinningItemAfterReverse] = await Promise.all([
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      CreditLedgerEntry.find({ userId: created.memberId, entryType: 'settlement' }).sort({ createdAt: 1 }).lean(),
      BetItem.findOne({ slipId: created.slipId, number: '456' }).lean()
    ]);
    expectStatus(memberWalletAfterReverse, 200, 'Member wallet after reverse settlement');
    assert(Number(memberWalletAfterReverse.data.account?.creditBalance || 0) === 90, 'Reverse settlement should remove the payout from member wallet but keep the stake debited');
    assert(settlementLedgerEntriesAfterReverse.length === 2, 'Reverse settlement should add exactly one rollback ledger entry');
    assert(settlementLedgerEntriesAfterReverse.some((entry) => entry.reasonCode === 'bet_result_rollback' && Number(entry.amount || 0) === 9870), 'Rollback ledger entry should mirror the original payout');
    assert(rawWinningItemAfterReverse, 'Winning item should still exist after reverse settlement');
    assert(rawWinningItemAfterReverse.result === 'pending', 'Reverse settlement should reset item result to pending');
    assert(rawWinningItemAfterReverse.isLocked === false, 'Reverse settlement should unlock the item');
    assert(Number(rawWinningItemAfterReverse.wonAmount || 0) === 0, 'Reverse settlement should reset won amount');
    assert(Number(rawWinningItemAfterReverse.payoutAppliedAmount || 0) === 0, 'Reverse settlement should reset applied payout amount');
    summary.checks.push('result-reversal');

    const reconcileAfterReverseResponse = await adminClient.get(`/lottery/rounds/${regressionRound.id}/settlement/reconcile`);
    expectStatus(reconcileAfterReverseResponse, 200, 'Reconcile round settlement after reverse');
    assert(reconcileAfterReverseResponse.data.mismatchedItems >= 1, 'Reconciliation after reverse should detect outstanding settlement mismatches');
    summary.checks.push('result-reconcile-after-reverse');

    const rerunSettlementResponse = await adminClient.post(`/lottery/rounds/${regressionRound.id}/settlement/rerun`);
    expectStatus(rerunSettlementResponse, 200, 'Rerun round settlement');
    assert(Number(rerunSettlementResponse.data.summary?.settlement?.wonCount || 0) >= 1, 'Rerun settlement should settle the winning item again');
    const [memberWalletAfterRerun, settlementLedgerEntriesAfterRerun, rawWinningItemAfterRerun] = await Promise.all([
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      CreditLedgerEntry.find({ userId: created.memberId, entryType: 'settlement' }).sort({ createdAt: 1 }).lean(),
      BetItem.findOne({ slipId: created.slipId, number: '456' }).lean()
    ]);
    expectStatus(memberWalletAfterRerun, 200, 'Member wallet after rerun settlement');
    assert(Number(memberWalletAfterRerun.data.account?.creditBalance || 0) === 9960, 'Rerun settlement should repay the winning payout exactly once');
    assert(settlementLedgerEntriesAfterRerun.length === 3, 'Rerun settlement should add one new settlement entry after rollback');
    assert(rawWinningItemAfterRerun, 'Winning item should still exist after rerun settlement');
    assert(rawWinningItemAfterRerun.result === 'won', 'Rerun settlement should restore the winning result');
    assert(rawWinningItemAfterRerun.isLocked === true, 'Rerun settlement should relock the item');
    assert(Number(rawWinningItemAfterRerun.wonAmount || 0) === 9870, 'Rerun settlement should restore won amount');
    assert(Number(rawWinningItemAfterRerun.payoutAppliedAmount || 0) === 9870, 'Rerun settlement should restore applied payout amount');
    summary.checks.push('result-rerun');

    const transferBackResponse = await agentClient.post('/wallet/transfer', {
      memberId: created.memberId,
      amount: 20,
      direction: 'from_member',
      note: 'Collect partial credit back'
    });
    expectStatus(transferBackResponse, 201, 'Transfer credit from member');
    created.walletGroupIds.push(transferBackResponse.data.groupId);
    summary.checks.push('agent-transfer-from-member');

    const [agentWalletAfterTransfers, memberWalletAfterTransfers, memberWalletCreditHistory] = await Promise.all([
      agentClient.get('/wallet/summary'),
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      agentClient.get('/wallet/history', {
        params: {
          targetUserId: created.memberId,
          direction: 'credit',
          entryType: 'transfer',
          limit: 20
        }
      })
    ]);
    expectStatus(agentWalletAfterTransfers, 200, 'Agent wallet after transfers');
    expectStatus(memberWalletAfterTransfers, 200, 'Member wallet after transfers');
    expectStatus(memberWalletCreditHistory, 200, 'Member filtered wallet history');
    assert(Number(agentWalletAfterTransfers.data.account?.creditBalance || 0) === 220, 'Agent wallet should be 220 after to_member and from_member transfers');
    assert(Number(memberWalletAfterTransfers.data.account?.creditBalance || 0) === 9940, 'Member wallet should include payout minus the collected transfer');
    assert((memberWalletCreditHistory.data || []).some((entry) => entry.groupId === transferToMemberResponse.data.groupId), 'Filtered wallet history should include inbound transfer');
    summary.checks.push('wallet-history-filter');

    const winnerReportResponse = await agentClient.get('/agent/reports', {
      params: {
        roundDate: created.roundCode,
        marketId: created.round.lotteryCode
      }
    });
    expectStatus(winnerReportResponse, 200, 'Agent reports after settlement');
    assert(!(winnerReportResponse.data.pendingRows || []).some((item) => item.slipId === created.slipId), 'Pending report should exclude settled slip');
    assert((winnerReportResponse.data.winnerRows || []).some((item) => item.slipId === created.slipId), 'Winner report should include settled winning slip');
    summary.checks.push('agent-winner-report');

    const resettleResponse = await adminClient.post('/lottery/manual', {
      roundDate: created.roundCode,
      firstPrize: '123456',
      threeTopList: ['123', '456'],
      threeBotList: ['111', '222'],
      twoBottom: '56',
      runTop: ['4', '5', '6'],
      runBottom: ['5', '6']
    });
    expectStatus(resettleResponse, 200, 'Manual result resettle');
    assert(Number(resettleResponse.data.settlement?.wonCount || 0) >= 1, 'Resettlement should still report a winner');
    const [memberWalletAfterResettlement, settlementLedgerEntriesAfterResettlement] = await Promise.all([
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      CreditLedgerEntry.find({ userId: created.memberId, entryType: 'settlement' }).lean()
    ]);
    expectStatus(memberWalletAfterResettlement, 200, 'Member wallet after resettlement');
    assert(Number(memberWalletAfterResettlement.data.account?.creditBalance || 0) === 9940, 'Resettlement should not pay the member twice');
    assert(settlementLedgerEntriesAfterResettlement.length === 3, 'Resettlement should not create duplicate settlement ledger entries after rerun');
    summary.checks.push('result-resettlement');

    const submitAfterResultResponse = await agentClient.post('/agent/betting/slips', {
      customerId: created.memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: regressionRound.id,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      betType: '3top',
      defaultAmount: 10,
      rawInput: '789 10',
      reverse: false,
      includeDoubleSet: false,
      memo: 'should fail after result',
      action: 'submit'
    });
    assert(submitAfterResultResponse.status === 400, 'Submitting after round result should fail');
    summary.checks.push('member-submit-blocked-after-result');

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
      await cleanupRegressionArtifacts(created);
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
