require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const assert = require('assert');
const axios = require('axios');
const { createCookieSessionClient } = require('./e2eCookieClient');
const jwt = require('jsonwebtoken');
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
const NotificationEvent = require('../models/NotificationEvent');
const PendingPayout = require('../models/PendingPayout');
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

const makeBearerClient = (token) =>
  axios.create({
    baseURL,
    validateStatus: () => true,
    headers: { Authorization: `Bearer ${token}` }
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
  const extraUserIds = (created.extraUserIds || []).filter(Boolean);
  const roundIds = [created.roundId, ...(created.extraRoundIds || [])].filter(Boolean);
  const roundCodes = [created.roundCode, ...(created.extraRoundCodes || [])].filter(Boolean);
  const targets = [
    created.agentId,
    created.memberId,
    created.slipId,
    created.pendingSlipId,
    created.roundId,
    created.roundCode,
    ...(created.extraRoundIds || []),
    ...(created.extraRoundCodes || []),
    ...extraUserIds,
    ...groupIds
  ].filter(Boolean);

  if (groupIds.length) {
    await CreditLedgerEntry.deleteMany({ groupId: { $in: groupIds } });
  }
  const userIds = [created.agentId, created.memberId, ...extraUserIds].filter(Boolean);
  if (userIds.length) {
    await CreditLedgerEntry.deleteMany({ userId: { $in: userIds } });
    await NotificationEvent.deleteMany({
      $or: [
        { agentId: { $in: userIds } },
        { customerId: { $in: userIds } },
        { recipientUserId: { $in: userIds } }
      ]
    });
  }

  if (roundIds.length) {
    await CreditLedgerEntry.deleteMany({
      entryType: 'settlement',
      'metadata.roundId': { $in: roundIds.map(String) }
    });
    await PendingPayout.deleteMany({ roundId: { $in: roundIds } });
    await BetItem.deleteMany({ drawRoundId: { $in: roundIds } });
    await BetSlip.deleteMany({ drawRoundId: { $in: roundIds } });
    await ResultRecord.deleteMany({ drawRoundId: { $in: roundIds } });
    await DrawRound.deleteMany({ _id: { $in: roundIds } });
  }

  if (roundCodes.length) {
    await LotteryResult.deleteMany({ roundDate: { $in: roundCodes } });
  }

  if (created.memberId) {
    await UserLotteryConfig.deleteMany({ userId: created.memberId });
    await User.deleteOne({ _id: created.memberId });
  }

  if (extraUserIds.length) {
    await UserLotteryConfig.deleteMany({ userId: { $in: extraUserIds } });
    await User.deleteMany({ _id: { $in: extraUserIds } });
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
    walletGroupIds: [],
    extraUserIds: [],
    extraRoundIds: [],
    extraRoundCodes: []
  };

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is missing');
    }

    const mongoUri = await buildDirectMongoUri(process.env.MONGODB_URI);
    await mongoose.connect(mongoUri);
    await BetSlip.syncIndexes();
    await PendingPayout.syncIndexes();
    summary.checks.push('bet-slip-client-request-index');
    summary.checks.push('pending-payout-indexes');
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
      amount: 10000,
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

    await User.collection.updateOne({ _id: new mongoose.Types.ObjectId(created.agentId) }, { $unset: { heldStakeBalance: '' } });
    const legacyAgentWalletResponse = await agentClient.get('/wallet/summary');
    expectStatus(legacyAgentWalletResponse, 200, 'Legacy agent wallet held stake default');
    assert(Number(legacyAgentWalletResponse.data.account?.heldStakeBalance || 0) === 0, 'Agent missing heldStakeBalance should read as 0');
    await User.updateOne({ _id: created.agentId }, { $set: { heldStakeBalance: 0 } });
    summary.checks.push('agent-held-stake-default-legacy-agent');

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

    const memberLogin = await loginWithRetry(memberUsername, memberPassword, 'Member');
    const memberClient = memberLogin.client;
    assert(memberLogin.user.role === 'customer', 'Member login should return customer role');
    summary.checks.push('member-login-session');

    const memberMeResponse = await memberClient.get('/member/me');
    expectStatus(memberMeResponse, 200, 'Member self profile');
    assert(memberMeResponse.data.member?.id === created.memberId, 'Member /me should only return the logged-in member');
    assert(memberMeResponse.data.member?.agentId === created.agentId, 'Member /me should expose assigned agent reference');
    summary.checks.push('member-me');

    const agentViewMemberWalletResponse = await agentClient.get('/wallet/summary', {
      params: { targetUserId: created.memberId }
    });
    expectStatus(agentViewMemberWalletResponse, 200, 'Agent wallet summary for member');
    assert(Number(agentViewMemberWalletResponse.data.account?.creditBalance || 0) === 100, 'Member wallet balance should equal 100 after funding');
    summary.checks.push('agent-wallet-member-view');

    const [memberAdminAccessResponse, memberAgentAccessResponse, memberWalletResponse, memberRoundsResponse] = await Promise.all([
      memberClient.get('/admin/pending-payouts'),
      memberClient.get('/agent/pending-payouts'),
      memberClient.get('/member/wallet'),
      memberClient.get('/member/rounds', { params: { lotteryId: visibleLotteries[0].id } })
    ]);
    assert(memberAdminAccessResponse.status === 403, 'Member session must not access admin APIs');
    assert(memberAgentAccessResponse.status === 403, 'Member session must not access agent APIs');
    expectStatus(memberWalletResponse, 200, 'Member wallet self view');
    assert(Number(memberWalletResponse.data.account?.creditBalance || 0) === 100, 'Member wallet self view should only show own balance');
    expectStatus(memberRoundsResponse, 200, 'Member rounds');
    assert((memberRoundsResponse.data || []).some((round) => round.id === regressionRound.id), 'Member rounds should include own enabled lottery round');
    summary.checks.push('member-admin-agent-api-blocked');
    summary.checks.push('member-wallet-self-view');
    summary.checks.push('member-rounds-api');
    const memberOtherCustomerSubmitResponse = await memberClient.post('/member/slips/submit', {
      customerId: new mongoose.Types.ObjectId().toString()
    });
    assert(memberOtherCustomerSubmitResponse.status === 403, 'Member must not submit a slip for another customerId');
    const memberChooseAgentSubmitResponse = await memberClient.post('/member/slips/submit', {
      agentId: created.agentId
    });
    assert(memberChooseAgentSubmitResponse.status === 403, 'Member must not choose an agent during slip submission');
    summary.checks.push('member-self-submit-cannot-choose-customer-or-agent');
    const anonymousMemberApiClient = makeClient();
    const [
      anonymousMemberMeResponse,
      anonymousMemberWalletResponse,
      anonymousMemberSlipsResponse
    ] = await Promise.all([
      anonymousMemberApiClient.get('/member/me'),
      anonymousMemberApiClient.get('/member/wallet'),
      anonymousMemberApiClient.get('/member/slips')
    ]);
    assert(anonymousMemberMeResponse.status === 401, 'Anonymous user must not access member profile');
    assert(anonymousMemberWalletResponse.status === 401, 'Anonymous user must not access member wallet');
    assert(anonymousMemberSlipsResponse.status === 401, 'Anonymous user must not access member slips');
    summary.checks.push('anonymous-member-api-blocked');
    const memberDraftResponse = await memberClient.post('/member/slips/draft', {
      lotteryId: visibleLotteries[0].id,
      roundId: regressionRound.id,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      betType: '3top',
      defaultAmount: 10,
      rawInput: '210 10',
      reverse: false,
      includeDoubleSet: false,
      memo: 'member self draft regression',
      clientRequestId: `member-draft-${uniqueSuffix}`
    });
    expectStatus(memberDraftResponse, 201, 'Member self draft');
    assert(memberDraftResponse.data.customerId === created.memberId, 'Member draft should belong to the logged-in member');
    assert(memberDraftResponse.data.placedBy?.role === 'customer', 'Member draft should be placed by customer role');
    const [memberWalletAfterSelfDraft, agentWalletAfterSelfDraft] = await Promise.all([
      memberClient.get('/member/wallet'),
      agentClient.get('/wallet/summary')
    ]);
    expectStatus(memberWalletAfterSelfDraft, 200, 'Member wallet after self draft');
    expectStatus(agentWalletAfterSelfDraft, 200, 'Agent wallet after member self draft');
    assert(Number(memberWalletAfterSelfDraft.data.account?.creditBalance || 0) === 100, 'Member self draft must not debit credit');
    assert(Number(agentWalletAfterSelfDraft.data.account?.heldStakeBalance || 0) === 0, 'Member self draft must not hold agent stake');
    summary.checks.push('member-self-draft-does-not-debit');
    const memberActorOverrideDraftResponse = await memberClient.post('/member/slips/draft', {
      lotteryId: visibleLotteries[0].id,
      roundId: regressionRound.id,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      betType: '3top',
      defaultAmount: 10,
      rawInput: '215 10',
      reverse: false,
      includeDoubleSet: false,
      memo: 'member self actor override regression',
      clientRequestId: `member-actor-override-${uniqueSuffix}`,
      actorUser: {
        _id: created.agentId,
        role: 'admin',
        name: 'Forged Actor'
      }
    });
    expectStatus(memberActorOverrideDraftResponse, 201, 'Member actor override draft');
    assert(memberActorOverrideDraftResponse.data.customerId === created.memberId, 'Member actor override draft should belong to logged-in member');
    assert(memberActorOverrideDraftResponse.data.placedBy?.role === 'customer', 'Member actor override must not replace server actor');
    summary.checks.push('member-self-actor-override-ignored');

    const memberInsufficientSubmitResponse = await memberClient.post('/member/slips/submit', {
      lotteryId: visibleLotteries[0].id,
      roundId: regressionRound.id,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      items: [
        { betType: '3top', number: '211', amount: 40 },
        { betType: '3top', number: '213', amount: 40 },
        { betType: '3top', number: '214', amount: 40 }
      ],
      memo: 'member self insufficient rollback',
      clientRequestId: `member-insufficient-${uniqueSuffix}`
    });
    assert(memberInsufficientSubmitResponse.status === 400, 'Member self submit over own credit should fail');
    assert(/Insufficient credit balance/i.test(String(memberInsufficientSubmitResponse.data?.message || '')), 'Member self insufficient error should be explicit');
    const memberWalletAfterSelfInsufficient = await memberClient.get('/member/wallet');
    expectStatus(memberWalletAfterSelfInsufficient, 200, 'Member wallet after self insufficient submit');
    assert(Number(memberWalletAfterSelfInsufficient.data.account?.creditBalance || 0) === 100, 'Member self insufficient submit must roll back balance');
    summary.checks.push('member-self-insufficient-credit-rollback');

    const memberSubmitClientRequestId = `member-submit-${uniqueSuffix}`;
    const memberSubmitPayload = {
      lotteryId: visibleLotteries[0].id,
      roundId: regressionRound.id,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      betType: '3top',
      defaultAmount: 10,
      rawInput: '212 10',
      reverse: false,
      includeDoubleSet: false,
      memo: 'member self submit regression',
      clientRequestId: memberSubmitClientRequestId
    };
    const rawMemberSubmitNoCsrfClient = axios.create({
      baseURL,
      validateStatus: () => true,
      headers: { Cookie: memberClient.cookieJar.cookieHeader() }
    });
    const memberMissingCsrfSubmitResponse = await rawMemberSubmitNoCsrfClient.post('/member/slips/submit', memberSubmitPayload);
    assert(memberMissingCsrfSubmitResponse.status === 403, 'Member submit without CSRF must be rejected');
    summary.checks.push('member-self-submit-csrf-required');
    const memberSubmitResponse = await memberClient.post('/member/slips/submit', memberSubmitPayload);
    expectStatus(memberSubmitResponse, 201, 'Member self submit');
    assert(memberSubmitResponse.data.customerId === created.memberId, 'Member self submit should belong to logged-in member');
    assert(memberSubmitResponse.data.placedBy?.role === 'customer', 'Member self submit should be placed by customer role');
    const memberDuplicateSubmitResponse = await memberClient.post('/member/slips/submit', memberSubmitPayload);
    expectStatus(memberDuplicateSubmitResponse, 201, 'Member self duplicate submit');
    assert(memberDuplicateSubmitResponse.data.id === memberSubmitResponse.data.id, 'Member self duplicate clientRequestId should return original slip');

    const [memberWalletAfterSelfSubmit, agentWalletAfterSelfSubmit, selfStakeLedgerEntries, selfSlipCount] = await Promise.all([
      memberClient.get('/member/wallet'),
      agentClient.get('/wallet/summary'),
      CreditLedgerEntry.find({
        userId: created.memberId,
        entryType: 'bet',
        direction: 'debit',
        reasonCode: 'bet_stake',
        'metadata.slipId': memberSubmitResponse.data.id
      }).lean(),
      BetSlip.countDocuments({
        customerId: created.memberId,
        clientRequestId: memberSubmitClientRequestId
      })
    ]);
    expectStatus(memberWalletAfterSelfSubmit, 200, 'Member wallet after self submit');
    expectStatus(agentWalletAfterSelfSubmit, 200, 'Agent wallet after self submit');
    assert(Number(memberWalletAfterSelfSubmit.data.account?.creditBalance || 0) === 90, 'Member self submit should debit own credit');
    assert(Number(agentWalletAfterSelfSubmit.data.account?.heldStakeBalance || 0) === 10, 'Member self submit should hold stake for assigned agent');
    assert(selfStakeLedgerEntries.length === 1, 'Member self duplicate submit must not create duplicate stake ledger');
    assert(selfSlipCount === 1, 'Member self duplicate submit must not create duplicate slip');
    summary.checks.push('member-self-submit-debits-and-holds-stake');
    summary.checks.push('member-self-submit-idempotent');

    const memberSlipListResponse = await memberClient.get('/member/slips');
    expectStatus(memberSlipListResponse, 200, 'Member slip list');
    assert((memberSlipListResponse.data || []).some((slip) => slip.id === memberSubmitResponse.data.id), 'Member slip list should include own submitted slip');
    const memberSlipDetailResponse = await memberClient.get(`/member/slips/${memberSubmitResponse.data.id}`);
    expectStatus(memberSlipDetailResponse, 200, 'Member slip detail');
    assert(memberSlipDetailResponse.data.id === memberSubmitResponse.data.id, 'Member slip detail should return own slip');
    summary.checks.push('member-self-slip-list-detail');

    const rawMemberCancelNoCsrfClient = axios.create({
      baseURL,
      validateStatus: () => true,
      headers: { Cookie: memberClient.cookieJar.cookieHeader() }
    });
    const memberMissingCsrfCancelResponse = await rawMemberCancelNoCsrfClient.post(`/member/slips/${memberSubmitResponse.data.id}/cancel`);
    assert(memberMissingCsrfCancelResponse.status === 403, 'Member cancel without CSRF must be rejected');
    summary.checks.push('member-self-cancel-csrf-required');
    const memberCancelResponse = await memberClient.post(`/member/slips/${memberSubmitResponse.data.id}/cancel`);
    expectStatus(memberCancelResponse, 200, 'Member self cancel');
    const memberCancelAgainResponse = await memberClient.post(`/member/slips/${memberSubmitResponse.data.id}/cancel`);
    assert(memberCancelAgainResponse.status === 400, 'Member self cancel should not be repeatable');
    const [memberWalletAfterSelfCancel, agentWalletAfterSelfCancel, selfRefundLedgerEntries] = await Promise.all([
      memberClient.get('/member/wallet'),
      agentClient.get('/wallet/summary'),
      CreditLedgerEntry.find({
        userId: created.memberId,
        entryType: 'bet',
        direction: 'credit',
        reasonCode: 'bet_stake_refund',
        'metadata.slipId': memberSubmitResponse.data.id
      }).lean()
    ]);
    expectStatus(memberWalletAfterSelfCancel, 200, 'Member wallet after self cancel');
    expectStatus(agentWalletAfterSelfCancel, 200, 'Agent wallet after self cancel');
    assert(Number(memberWalletAfterSelfCancel.data.account?.creditBalance || 0) === 100, 'Member self cancel should refund stake once');
    assert(Number(agentWalletAfterSelfCancel.data.account?.heldStakeBalance || 0) === 0, 'Member self cancel should reverse agent held stake');
    assert(selfRefundLedgerEntries.length === 1, 'Member self cancel should create exactly one refund ledger');
    summary.checks.push('member-self-cancel-refunds-and-reverses-hold');

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
    const agentWalletAfterDraft = await agentClient.get('/wallet/summary');
    expectStatus(agentWalletAfterDraft, 200, 'Agent wallet after draft slip');
    assert(Number(agentWalletAfterDraft.data.account?.creditBalance || 0) === 9900, 'Draft slip should not change agent available balance');
    assert(Number(agentWalletAfterDraft.data.account?.heldStakeBalance || 0) === 0, 'Draft slip should not hold agent stake');
    summary.checks.push('agent-draft-does-not-hold-stake');
    summary.checks.push('member-draft-does-not-debit-credit');
    const betLedgerCountBeforeInsufficient = await CreditLedgerEntry.countDocuments({
      userId: created.memberId,
      entryType: 'bet'
    });
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
    assert(betLedgerCountAfterInsufficient === betLedgerCountBeforeInsufficient, 'Insufficient-credit submit must not add a bet ledger entry');
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
    const agentWalletAfterConcurrentSame = await agentClient.get('/wallet/summary');
    expectStatus(agentWalletAfterConcurrentSame, 200, 'Agent wallet after concurrent same-key submit');
    assert(Number(agentWalletAfterConcurrentSame.data.account?.creditBalance || 0) === 9900, 'Submitted bet should not increase agent available balance before settlement');
    assert(Number(agentWalletAfterConcurrentSame.data.account?.heldStakeBalance || 0) === 10, 'Submitted bet should hold the stake for the agent');
    summary.checks.push('agent-stake-held-on-submit');

    const drainAgentBeforeCancelResponse = await adminClient.post('/wallet/adjust', {
      targetUserId: created.agentId,
      amount: -9900,
      note: 'Drain available credit before cancel held-stake test',
      reasonCode: 'agent_available_drain_for_cancel_test'
    });
    expectStatus(drainAgentBeforeCancelResponse, 201, 'Drain agent available before cancel');
    created.walletGroupIds.push(drainAgentBeforeCancelResponse.data.groupId);
    const agentWalletBeforeCancelWithNoAvailable = await agentClient.get('/wallet/summary');
    expectStatus(agentWalletBeforeCancelWithNoAvailable, 200, 'Agent wallet before cancel with no available');
    assert(Number(agentWalletBeforeCancelWithNoAvailable.data.account?.creditBalance || 0) === 0, 'Agent available balance should be zero for cancel test');
    assert(Number(agentWalletBeforeCancelWithNoAvailable.data.account?.heldStakeBalance || 0) === 10, 'Agent held stake should remain before cancel test');

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
    const agentWalletAfterConcurrentSameCancel = await agentClient.get('/wallet/summary');
    expectStatus(agentWalletAfterConcurrentSameCancel, 200, 'Agent wallet after cancel held-stake reversal');
    assert(Number(agentWalletAfterConcurrentSameCancel.data.account?.creditBalance || 0) === 0, 'Cancel should not require or change agent available credit');
    assert(Number(agentWalletAfterConcurrentSameCancel.data.account?.heldStakeBalance || 0) === 0, 'Cancel should reverse held stake once');
    summary.checks.push('agent-cancel-reverses-held-stake-without-available-credit');

    const restoreAgentAfterCancelResponse = await adminClient.post('/wallet/adjust', {
      targetUserId: created.agentId,
      amount: 9900,
      note: 'Restore agent available credit after cancel held-stake test',
      reasonCode: 'agent_available_restore_after_cancel_test'
    });
    expectStatus(restoreAgentAfterCancelResponse, 201, 'Restore agent available after cancel');
    created.walletGroupIds.push(restoreAgentAfterCancelResponse.data.groupId);
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
    const agentWalletAfterConcurrentCleanup = await agentClient.get('/wallet/summary');
    expectStatus(agentWalletAfterConcurrentCleanup, 200, 'Agent wallet after concurrent setup cleanup');
    assert(Number(agentWalletAfterConcurrentCleanup.data.account?.creditBalance || 0) === 9900, 'Concurrent setup cleanup should keep agent available balance restored');
    assert(Number(agentWalletAfterConcurrentCleanup.data.account?.heldStakeBalance || 0) === 0, 'Concurrent setup cleanup should reverse all held stake');
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
    const agentWalletAfterStakeHold = await agentClient.get('/wallet/summary');
    expectStatus(agentWalletAfterStakeHold, 200, 'Agent wallet after stake hold');
    assert(Number(agentWalletAfterStakeHold.data.account?.creditBalance || 0) === 9900, 'Submit should not increase agent available credit');
    assert(Number(agentWalletAfterStakeHold.data.account?.heldStakeBalance || 0) === 10, 'Submit should move stake into agent held balance');
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
    assert(settlementLedgerEntriesAfterResult[0]?.reasonCode === 'member_payout_credit', 'Member settlement ledger should use member_payout_credit');
    const agentWalletAfterPaidSettlement = await agentClient.get('/wallet/summary');
    expectStatus(agentWalletAfterPaidSettlement, 200, 'Agent wallet after paid settlement');
    assert(Number(agentWalletAfterPaidSettlement.data.account?.creditBalance || 0) === 40, 'Paid settlement should release stake then debit payout from agent available credit');
    assert(Number(agentWalletAfterPaidSettlement.data.account?.heldStakeBalance || 0) === 0, 'Paid settlement should clear held stake');
    summary.checks.push('agent-paid-settlement-debits-available-credit');
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
    const agentWalletAfterReverseSettlement = await agentClient.get('/wallet/summary');
    expectStatus(agentWalletAfterReverseSettlement, 200, 'Agent wallet after reverse settlement');
    assert(Number(agentWalletAfterReverseSettlement.data.account?.creditBalance || 0) === 9900, 'Reverse settlement should restore agent available to pre-settlement amount');
    assert(Number(agentWalletAfterReverseSettlement.data.account?.heldStakeBalance || 0) === 10, 'Reverse settlement should move stake back to held');
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
    const agentWalletAfterRerunSettlement = await agentClient.get('/wallet/summary');
    expectStatus(agentWalletAfterRerunSettlement, 200, 'Agent wallet after rerun settlement');
    assert(Number(agentWalletAfterRerunSettlement.data.account?.creditBalance || 0) === 40, 'Rerun settlement should debit agent payout exactly once');
    assert(Number(agentWalletAfterRerunSettlement.data.account?.heldStakeBalance || 0) === 0, 'Rerun settlement should clear held stake');
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
    assert(Number(agentWalletAfterTransfers.data.account?.creditBalance || 0) === 60, 'Agent wallet should be 60 after payout and partial member transfer back');
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

    const createPendingPayoutScenario = async ({ number, memo, clientRequestId, label }) => {
      const scenarioRound = await ensureRegressionRound();
      created.extraRoundIds.push(scenarioRound.roundId);
      created.extraRoundCodes.push(scenarioRound.roundCode);

      const slipResponse = await agentClient.post('/agent/betting/slips', {
        customerId: created.memberId,
        lotteryId: visibleLotteries[0].id,
        roundId: scenarioRound.roundId,
        rateProfileId: visibleLotteries[0].defaultRateProfileId,
        betType: '3top',
        defaultAmount: 10,
        rawInput: `${number} 10`,
        reverse: false,
        includeDoubleSet: false,
        memo,
        action: 'submit',
        clientRequestId
      });
      expectStatus(slipResponse, 201, `${label} pending payout slip submit`);

      const resultResponse = await adminClient.post('/lottery/manual', {
        roundDate: scenarioRound.roundCode,
        firstPrize: `123${number}`,
        threeTopList: ['123', number],
        threeBotList: ['111', '222'],
        twoBottom: number.slice(-2),
        runTop: [number[0], number[1], number[2]],
        runBottom: [number[1], number[2]]
      });
      expectStatus(resultResponse, 200, `${label} pending payout settlement`);
      assert(Number(resultResponse.data.settlement?.pendingPayoutCount || 0) >= 1, `${label} should create pending payout`);

      const item = await BetItem.findOne({ slipId: slipResponse.data.id, number }).lean();
      assert(item, `${label} pending payout item should exist`);
      const payout = await PendingPayout.findOne({ betItemId: item._id, status: 'pending' }).lean();
      assert(payout, `${label} pending payout should exist`);
      assert(Number(payout.payoutAmount || 0) === 9870, `${label} pending payout amount should equal winning payout`);

      return {
        round: scenarioRound,
        slipId: slipResponse.data.id,
        item,
        payout
      };
    };

    const pendingRound = await ensureRegressionRound();
    created.extraRoundIds.push(pendingRound.roundId);
    created.extraRoundCodes.push(pendingRound.roundCode);
    summary.created.pendingRound = pendingRound;

    const pendingSlipResponse = await agentClient.post('/agent/betting/slips', {
      customerId: created.memberId,
      lotteryId: visibleLotteries[0].id,
      roundId: pendingRound.roundId,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      betType: '3top',
      defaultAmount: 10,
      rawInput: '456 10',
      reverse: false,
      includeDoubleSet: false,
      memo: 'pending payout regression slip',
      action: 'submit',
      clientRequestId: `regression-pending-${uniqueSuffix}`
    });
    expectStatus(pendingSlipResponse, 201, 'Submit pending payout slip');
    const pendingSlipId = pendingSlipResponse.data.id;
    summary.created.pendingSlip = { id: pendingSlipId };

    const [memberWalletAfterPendingSubmit, agentWalletAfterPendingSubmit] = await Promise.all([
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      agentClient.get('/wallet/summary')
    ]);
    expectStatus(memberWalletAfterPendingSubmit, 200, 'Member wallet after pending submit');
    expectStatus(agentWalletAfterPendingSubmit, 200, 'Agent wallet after pending submit');
    assert(Number(memberWalletAfterPendingSubmit.data.account?.creditBalance || 0) === 9930, 'Pending setup submit should debit member stake');
    assert(Number(agentWalletAfterPendingSubmit.data.account?.creditBalance || 0) === 60, 'Pending setup submit should not increase agent available before settlement');
    assert(Number(agentWalletAfterPendingSubmit.data.account?.heldStakeBalance || 0) === 10, 'Pending setup submit should hold stake');
    summary.checks.push('pending-setup-submit-holds-agent-stake');

    const pendingResultResponse = await adminClient.post('/lottery/manual', {
      roundDate: pendingRound.roundCode,
      firstPrize: '123456',
      threeTopList: ['123', '456'],
      threeBotList: ['111', '222'],
      twoBottom: '56',
      runTop: ['4', '5', '6'],
      runBottom: ['5', '6']
    });
    expectStatus(pendingResultResponse, 200, 'Manual result save for pending payout');
    assert(Number(pendingResultResponse.data.settlement?.pendingPayoutCount || 0) >= 1, 'Settlement should create a pending payout when agent credit is insufficient');

    const [rawPendingWinningItem, memberWalletAfterPendingResult, agentWalletAfterPendingResult] = await Promise.all([
      BetItem.findOne({ slipId: pendingSlipId, number: '456' }).lean(),
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      agentClient.get('/wallet/summary')
    ]);
    assert(rawPendingWinningItem, 'Pending winning item should exist');
    const pendingPayout = await PendingPayout.findOne({ betItemId: rawPendingWinningItem._id, status: 'pending' }).lean();
    assert(pendingPayout, 'Insufficient agent credit should create a pending payout');
    assert(Number(pendingPayout.payoutAmount || 0) === 9870, 'Pending payout amount should equal winning payout');
    assert(rawPendingWinningItem.payoutStatus === 'pending', 'Winning item should be marked pending when agent cannot pay');
    assert(Number(rawPendingWinningItem.payoutAppliedAmount || 0) === 0, 'Pending payout must not credit member immediately');
    expectStatus(memberWalletAfterPendingResult, 200, 'Member wallet after pending result');
    expectStatus(agentWalletAfterPendingResult, 200, 'Agent wallet after pending result');
    assert(Number(memberWalletAfterPendingResult.data.account?.creditBalance || 0) === 9930, 'Member should not receive payout while pending');
    assert(Number(agentWalletAfterPendingResult.data.account?.creditBalance || 0) === 70, 'Settlement should release held stake to agent available before pending payout');
    assert(Number(agentWalletAfterPendingResult.data.account?.heldStakeBalance || 0) === 0, 'Pending settlement should clear held stake');
    const pendingCreatedNotificationCount = await NotificationEvent.countDocuments({
      type: 'agent_pending_payout_created',
      agentId: created.agentId,
      customerId: created.memberId
    });
    assert(pendingCreatedNotificationCount >= 3, 'Pending payout should create admin, agent, and member notification events');
    summary.checks.push('settlement-won-agent-insufficient-creates-pending-payout');
    const otherPayoutSuffix = new mongoose.Types.ObjectId().toString().slice(-8);
    const basePendingSlip = await BetSlip.findById(pendingSlipId).lean();
    assert(basePendingSlip, 'Base pending slip should exist for permission fixture');
    const otherPayoutRound = await ensureRegressionRound();
    created.extraRoundIds.push(otherPayoutRound.roundId);
    created.extraRoundCodes.push(otherPayoutRound.roundCode);
    const otherAgent = await User.create({
      username: `e2e_reg_other_agent_${uniqueSuffix}_${otherPayoutSuffix}`,
      password: `Cc${uniqueSuffix}!`,
      role: 'agent',
      name: 'Other Pending Agent',
      isActive: true
    });
    const otherMember = await User.create({
      username: `e2e_reg_other_member_${uniqueSuffix}_${otherPayoutSuffix}`,
      password: `Dd${uniqueSuffix}!`,
      role: 'customer',
      name: 'Other Pending Member',
      agentId: otherAgent._id,
      parentUserId: otherAgent._id,
      isActive: true
    });
    created.extraUserIds.push(otherAgent._id.toString(), otherMember._id.toString());
    const otherSlip = await BetSlip.create({
      customerId: otherMember._id,
      agentId: otherAgent._id,
      placedByUserId: otherAgent._id,
      placedByRole: 'agent',
      placedByName: otherAgent.name,
      lotteryTypeId: basePendingSlip.lotteryTypeId,
      drawRoundId: otherPayoutRound.roundId,
      rateProfileId: basePendingSlip.rateProfileId,
      slipNumber: `E2E-OTHER-${uniqueSuffix}-${otherPayoutSuffix}`,
      lotteryCode: basePendingSlip.lotteryCode,
      lotteryName: basePendingSlip.lotteryName,
      roundCode: otherPayoutRound.roundCode,
      roundTitle: `Regression ${otherPayoutRound.roundCode}`,
      openAt: basePendingSlip.openAt,
      closeAt: basePendingSlip.closeAt,
      drawAt: basePendingSlip.drawAt,
      status: 'submitted',
      itemCount: 1,
      totalAmount: 10,
      potentialPayout: 9870,
      submittedAt: new Date(),
      clientRequestId: `regression-other-pending-${uniqueSuffix}-${otherPayoutSuffix}`
    });
    const otherItem = await BetItem.create({
      slipId: otherSlip._id,
      customerId: otherMember._id,
      agentId: otherAgent._id,
      placedByUserId: otherAgent._id,
      placedByRole: 'agent',
      placedByName: otherAgent.name,
      lotteryTypeId: otherSlip.lotteryTypeId,
      drawRoundId: otherSlip.drawRoundId,
      rateProfileId: otherSlip.rateProfileId,
      sequence: 1,
      betType: '3top',
      number: '999',
      amount: 10,
      payRate: 987,
      potentialPayout: 9870,
      status: 'submitted',
      result: 'won',
      wonAmount: 9870,
      payoutStatus: 'pending'
    });
    const otherPayout = await PendingPayout.create({
      payoutId: `PP-e2e-other-${uniqueSuffix}-${otherPayoutSuffix}`,
      betSlipId: otherSlip._id,
      betItemId: otherItem._id,
      roundId: otherSlip.drawRoundId,
      customerId: otherMember._id,
      agentId: otherAgent._id,
      payoutAmount: 9870,
      status: 'pending',
      metadata: {
        slipId: otherSlip._id.toString(),
        betItemId: otherItem._id.toString(),
        roundCode: otherSlip.roundCode
      }
    });
    await BetItem.updateOne({ _id: otherItem._id }, { $set: { pendingPayoutId: otherPayout._id } });
    const [memberOtherSlipListResponse, memberOtherSlipDetailResponse] = await Promise.all([
      memberClient.get('/member/slips'),
      memberClient.get(`/member/slips/${otherSlip._id}`)
    ]);
    expectStatus(memberOtherSlipListResponse, 200, 'Member slip list before cross-member guard');
    assert(!memberOtherSlipListResponse.data.some((slip) => slip.id === otherSlip._id.toString()), 'Member slip list must not include another member slip');
    assert(memberOtherSlipDetailResponse.status === 404, 'Member must not read another member slip detail');
    const memberOtherSlipCancelResponse = await memberClient.post(`/member/slips/${otherSlip._id}/cancel`);
    assert([400, 404].includes(memberOtherSlipCancelResponse.status), 'Member must not cancel another member slip');
    summary.checks.push('member-cross-slip-access-blocked');

    const otherAgentNotification = await NotificationEvent.create({
      type: 'agent_pending_payout_created',
      recipientRole: 'agent',
      recipientUserId: otherAgent._id,
      agentId: otherAgent._id,
      customerId: otherMember._id,
      title: 'Other agent pending payout',
      message: 'Other agent pending payout fixture',
      metadata: {
        payoutId: otherPayout.payoutId,
        payoutAmount: otherPayout.payoutAmount,
        pendingPayoutId: otherPayout._id.toString()
      }
    });
    const otherMemberNotification = await NotificationEvent.create({
      type: 'agent_pending_payout_created',
      recipientRole: 'customer',
      recipientUserId: otherMember._id,
      agentId: otherAgent._id,
      customerId: otherMember._id,
      title: 'Other member pending payout',
      message: 'Other member pending payout fixture',
      metadata: {
        payoutId: otherPayout.payoutId,
        payoutAmount: otherPayout.payoutAmount,
        pendingPayoutId: otherPayout._id.toString()
      }
    });
    const anonymousClient = makeClient();
    const memberToken = jwt.sign(
      { id: created.memberId, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    const memberBearerClient = makeBearerClient(memberToken);
    const [
      adminPendingListResponse,
      agentPendingListResponse,
      adminNotificationsResponse,
      agentNotificationsResponse,
      memberPendingListResponse,
      memberNotificationsResponse,
      anonymousAdminPendingResponse,
      anonymousAdminNotificationsResponse,
      anonymousAgentPendingResponse,
      anonymousAgentNotificationsResponse,
      anonymousMemberPendingResponse,
      anonymousMemberNotificationsResponse,
      memberAdminPendingResponse,
      memberAdminNotificationsResponse,
      memberAgentPendingResponse,
      memberAgentNotificationsResponse
    ] = await Promise.all([
      adminClient.get('/admin/pending-payouts'),
      agentClient.get('/agent/pending-payouts'),
      adminClient.get('/admin/notifications'),
      agentClient.get('/agent/notifications'),
      memberClient.get('/member/pending-payouts'),
      memberClient.get('/member/notifications'),
      anonymousClient.get('/admin/pending-payouts'),
      anonymousClient.get('/admin/notifications'),
      anonymousClient.get('/agent/pending-payouts'),
      anonymousClient.get('/agent/notifications'),
      anonymousClient.get('/member/pending-payouts'),
      anonymousClient.get('/member/notifications'),
      memberBearerClient.get('/admin/pending-payouts'),
      memberBearerClient.get('/admin/notifications'),
      memberBearerClient.get('/agent/pending-payouts'),
      memberBearerClient.get('/agent/notifications')
    ]);
    expectStatus(adminPendingListResponse, 200, 'Admin pending payout list');
    expectStatus(agentPendingListResponse, 200, 'Agent pending payout list');
    expectStatus(adminNotificationsResponse, 200, 'Admin notification list');
    expectStatus(agentNotificationsResponse, 200, 'Agent notification list');
    expectStatus(memberPendingListResponse, 200, 'Member pending payout list');
    expectStatus(memberNotificationsResponse, 200, 'Member notification list');
    assert(anonymousAdminPendingResponse.status === 401, 'Unauthenticated admin pending payout list must be rejected');
    assert(anonymousAdminNotificationsResponse.status === 401, 'Unauthenticated admin notifications must be rejected');
    assert(anonymousAgentPendingResponse.status === 401, 'Unauthenticated agent pending payout list must be rejected');
    assert(anonymousAgentNotificationsResponse.status === 401, 'Unauthenticated agent notifications must be rejected');
    assert(anonymousMemberPendingResponse.status === 401, 'Unauthenticated member pending payout list must be rejected');
    assert(anonymousMemberNotificationsResponse.status === 401, 'Unauthenticated member notifications must be rejected');
    assert(memberAdminPendingResponse.status === 403, 'Member token must not access admin pending payout list');
    assert(memberAdminNotificationsResponse.status === 403, 'Member token must not access admin notifications');
    assert(memberAgentPendingResponse.status === 403, 'Member token must not access agent pending payout list');
    assert(memberAgentNotificationsResponse.status === 403, 'Member token must not access agent notifications');
    const adminPendingItems = adminPendingListResponse.data.items || [];
    const agentPendingItems = agentPendingListResponse.data.items || [];
    assert(adminPendingItems.some((item) => item.id === pendingPayout._id.toString()), 'Admin API should see the active agent pending payout');
    assert(adminPendingItems.some((item) => item.id === otherPayout._id.toString()), 'Admin API should see every agent pending payout');
    assert(agentPendingItems.some((item) => item.id === pendingPayout._id.toString()), 'Agent API should see its own pending payout');
    assert(!agentPendingItems.some((item) => item.id === otherPayout._id.toString()), 'Agent API must not see another agent pending payout');
    assert(Number(adminPendingListResponse.data.summary?.pendingCount || 0) >= 2, 'Admin pending payout summary should include all pending payouts');
    assert(Number(agentPendingListResponse.data.summary?.pendingCount || 0) >= 1, 'Agent pending payout summary should include own pending payouts');
    const memberPendingItems = memberPendingListResponse.data.items || [];
    assert(memberPendingItems.some((item) => item.id === pendingPayout._id.toString()), 'Member API should see own pending payout');
    assert(!memberPendingItems.some((item) => item.id === otherPayout._id.toString()), 'Member API must not see another member pending payout');
    assert(Number(memberPendingListResponse.data.summary?.pendingCount || 0) >= 1, 'Member pending payout summary should include own pending payouts');

    const adminNotifications = adminNotificationsResponse.data.items || [];
    const agentNotifications = agentNotificationsResponse.data.items || [];
    const memberNotifications = memberNotificationsResponse.data.items || [];
    assert(!agentNotifications.some((item) => item.id === otherAgentNotification._id.toString()), 'Agent notifications must not include another agent notification');
    const adminPendingNotification = adminNotifications.find((item) => item.type === 'agent_pending_payout_created' && item.metadata?.pendingPayoutId === pendingPayout._id.toString());
    const agentPendingNotification = agentNotifications.find((item) => item.type === 'agent_pending_payout_created' && item.metadata?.pendingPayoutId === pendingPayout._id.toString());
    assert(adminPendingNotification, 'Admin notifications should include pending payout created event');
    assert(agentPendingNotification, 'Agent notifications should include own pending payout created event');
    const memberPendingNotification = memberNotifications.find((item) => item.type === 'agent_pending_payout_created' && item.metadata?.pendingPayoutId === pendingPayout._id.toString());
    assert(!memberNotifications.some((item) => item.id === otherMemberNotification._id.toString()), 'Member notifications must not include another member notification');
    assert(memberPendingNotification, 'Member notifications should include own pending payout created event');
    const markAdminNotificationReadResponse = await adminClient.post(`/admin/notifications/${adminPendingNotification.id}/read`);
    expectStatus(markAdminNotificationReadResponse, 200, 'Admin mark notification read');
    assert(markAdminNotificationReadResponse.data.notification.status === 'read', 'Admin read action should mark admin notification read');
    const agentCannotReadAdminNotificationResponse = await agentClient.post(`/agent/notifications/${adminPendingNotification.id}/read`);
    assert([403, 404].includes(agentCannotReadAdminNotificationResponse.status), 'Agent must not mark admin notification as read');
    const agentCannotReadOtherAgentNotificationResponse = await agentClient.post(`/agent/notifications/${otherAgentNotification._id}/read`);
    assert([403, 404].includes(agentCannotReadOtherAgentNotificationResponse.status), 'Agent must not mark another agent notification as read');
    const memberCannotReadAgentNotificationResponse = await memberClient.post(`/agent/notifications/${agentPendingNotification.id}/read`);
    assert(memberCannotReadAgentNotificationResponse.status === 403, 'Member token must not mark agent notification as read');
    const memberCannotReadOtherMemberNotificationResponse = await memberClient.post(`/member/notifications/${otherMemberNotification._id}/read`);
    assert([403, 404].includes(memberCannotReadOtherMemberNotificationResponse.status), 'Member must not mark another member notification as read');
    const rawMemberNoCsrfClient = axios.create({
      baseURL,
      validateStatus: () => true,
      headers: { Cookie: memberClient.cookieJar.cookieHeader() }
    });
    const memberMissingCsrfReadResponse = await rawMemberNoCsrfClient.post(`/member/notifications/${memberPendingNotification.id}/read`);
    assert(memberMissingCsrfReadResponse.status === 403, 'Member notification read without CSRF must be rejected');
    const markMemberNotificationReadResponse = await memberClient.post(`/member/notifications/${memberPendingNotification.id}/read`);
    expectStatus(markMemberNotificationReadResponse, 200, 'Member mark notification read');
    assert(markMemberNotificationReadResponse.data.notification.status === 'read', 'Member read action should mark own notification read');
    const anonymousCannotReadNotificationResponse = await anonymousClient.post(`/agent/notifications/${agentPendingNotification.id}/read`);
    assert([401, 403].includes(anonymousCannotReadNotificationResponse.status), 'Unauthenticated notification read must be rejected');
    const markAgentNotificationReadResponse = await agentClient.post(`/agent/notifications/${agentPendingNotification.id}/read`);
    expectStatus(markAgentNotificationReadResponse, 200, 'Agent mark notification read');
    assert(markAgentNotificationReadResponse.data.notification.status === 'read', 'Agent read action should mark agent notification read');
    summary.checks.push('pending-payout-notification-api-permissions');

    await PendingPayout.updateOne({ _id: pendingPayout._id }, { $set: { payoutAmount: 1 } });
    const pendingResultRerunResponse = await adminClient.post('/lottery/manual', {
      roundDate: pendingRound.roundCode,
      firstPrize: '123456',
      threeTopList: ['123', '456'],
      threeBotList: ['111', '222'],
      twoBottom: '56',
      runTop: ['4', '5', '6'],
      runBottom: ['5', '6']
    });
    expectStatus(pendingResultRerunResponse, 200, 'Manual result rerun should refresh pending payout');
    const [pendingPayoutAfterRerun, pendingCountAfterRerun] = await Promise.all([
      PendingPayout.findById(pendingPayout._id).lean(),
      PendingPayout.countDocuments({ betItemId: rawPendingWinningItem._id, status: 'pending' })
    ]);
    assert(Number(pendingResultRerunResponse.data.settlement?.pendingPayoutCount || 0) >= 1, 'Settlement rerun should keep payout pending while agent credit is insufficient');
    assert(Number(pendingPayoutAfterRerun.payoutAmount || 0) === 9870, 'Settlement rerun should refresh existing pending payout amount');
    assert(pendingCountAfterRerun === 1, 'Settlement rerun should not create duplicate pending payouts for the same item');
    summary.checks.push('pending-payout-rerun-updates-existing-amount');

    const secondPendingScenario = await createPendingPayoutScenario({
      number: '457',
      memo: 'second pending payout regression slip',
      clientRequestId: `regression-pending-second-${uniqueSuffix}`,
      label: 'Second'
    });

    const secondPendingCancelResponse = await agentClient.post(`/agent/betting/slips/${secondPendingScenario.slipId}/cancel`);
    assert(secondPendingCancelResponse.status === 400, 'Cancel after pending settlement should be rejected');
    summary.checks.push('cancel-after-pending-payout-rejected');

    const secondPendingMemberWallet = await agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } });
    const secondPendingAgentWallet = await agentClient.get('/wallet/summary');
    expectStatus(secondPendingMemberWallet, 200, 'Member wallet after second pending payout setup');
    expectStatus(secondPendingAgentWallet, 200, 'Agent wallet after second pending payout setup');
    assert(Number(secondPendingMemberWallet.data.account?.creditBalance || 0) === 9920, 'Second pending setup should debit one additional stake');
    assert(Number(secondPendingAgentWallet.data.account?.creditBalance || 0) === 80, 'Second pending settlement should release stake to available');
    assert(Number(secondPendingAgentWallet.data.account?.heldStakeBalance || 0) === 0, 'Second pending settlement should clear held stake');

    const pendingTopupResponse = await adminClient.post('/wallet/adjust', {
      targetUserId: created.agentId,
      amount: 9790,
      note: 'Top up agent to auto-pay pending payout',
      reasonCode: 'agent_topup_credit'
    });
    expectStatus(pendingTopupResponse, 201, 'Top up agent for pending payout');
    created.walletGroupIds.push(pendingTopupResponse.data.groupId);
    assert(Number(pendingTopupResponse.data.autoPayout?.paidCount || 0) === 1, 'Agent topup should auto-pay one pending payout');
    assert(Number(pendingTopupResponse.data.autoPayout?.paidAmount || 0) === 9870, 'Auto payout amount should match pending payout');

    const [pendingPayoutAfterTopup, secondPendingAfterFirstTopup, pendingItemAfterTopup, memberWalletAfterAutoPayout, agentWalletAfterAutoPayout] = await Promise.all([
      PendingPayout.findById(pendingPayout._id).lean(),
      PendingPayout.findById(secondPendingScenario.payout._id).lean(),
      BetItem.findById(rawPendingWinningItem._id).lean(),
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      agentClient.get('/wallet/summary')
    ]);
    assert(pendingPayoutAfterTopup.status === 'paid', 'Pending payout should be marked paid after auto payout');
    assert(secondPendingAfterFirstTopup.status === 'pending', 'FIFO partial topup should leave the second pending payout unpaid');
    assert(pendingPayoutAfterTopup.paidAt, 'Paid pending payout should record paidAt');
    assert(pendingItemAfterTopup.payoutStatus === 'paid', 'Bet item should be marked paid after auto payout');
    assert(Number(pendingItemAfterTopup.payoutAppliedAmount || 0) === 9870, 'Auto payout should apply payout amount to bet item');
    expectStatus(memberWalletAfterAutoPayout, 200, 'Member wallet after auto payout');
    expectStatus(agentWalletAfterAutoPayout, 200, 'Agent wallet after auto payout');
    assert(Number(memberWalletAfterAutoPayout.data.account?.creditBalance || 0) === 19790, 'FIFO partial topup should credit only the oldest pending payout');
    assert(Number(agentWalletAfterAutoPayout.data.account?.creditBalance || 0) === 0, 'Auto payout should debit agent available without going negative');
    assert(Number(agentWalletAfterAutoPayout.data.account?.heldStakeBalance || 0) === 0, 'Auto payout should not recreate held stake');
    const pendingPaidNotificationCount = await NotificationEvent.countDocuments({
      type: 'agent_pending_payout_paid',
      agentId: created.agentId,
      customerId: created.memberId
    });
    assert(pendingPaidNotificationCount >= 3, 'Auto payout should create admin, agent, and member paid notification events');
    const [adminPaidPayoutsResponse, agentPaidPayoutsResponse, memberPaidPayoutsResponse, adminPaidNotificationsResponse, agentPaidNotificationsResponse, memberPaidNotificationsResponse] = await Promise.all([
      adminClient.get('/admin/pending-payouts', { params: { status: 'all' } }),
      agentClient.get('/agent/pending-payouts', { params: { status: 'all' } }),
      memberClient.get('/member/pending-payouts', { params: { status: 'all' } }),
      adminClient.get('/admin/notifications', { params: { status: 'all' } }),
      agentClient.get('/agent/notifications', { params: { status: 'all' } }),
      memberClient.get('/member/notifications', { params: { status: 'all' } })
    ]);
    expectStatus(adminPaidPayoutsResponse, 200, 'Admin paid pending payout list');
    expectStatus(agentPaidPayoutsResponse, 200, 'Agent paid pending payout list');
    expectStatus(memberPaidPayoutsResponse, 200, 'Member paid pending payout list');
    expectStatus(adminPaidNotificationsResponse, 200, 'Admin paid notification list');
    expectStatus(agentPaidNotificationsResponse, 200, 'Agent paid notification list');
    expectStatus(memberPaidNotificationsResponse, 200, 'Member paid notification list');
    assert((adminPaidPayoutsResponse.data.items || []).some((item) => item.id === pendingPayout._id.toString() && item.status === 'paid'), 'Admin API should show auto-paid payout status');
    assert((agentPaidPayoutsResponse.data.items || []).some((item) => item.id === pendingPayout._id.toString() && item.status === 'paid'), 'Agent API should show own auto-paid payout status');
    assert((memberPaidPayoutsResponse.data.items || []).some((item) => item.id === pendingPayout._id.toString() && item.status === 'paid'), 'Member API should show own auto-paid payout status');
    assert(!(memberPaidPayoutsResponse.data.items || []).some((item) => item.id === otherPayout._id.toString()), 'Member paid payout list must not include another member payout');
    assert((adminPaidNotificationsResponse.data.items || []).some((item) => item.type === 'agent_pending_payout_paid' && item.metadata?.pendingPayoutId === pendingPayout._id.toString()), 'Admin API should show paid notification');
    assert((agentPaidNotificationsResponse.data.items || []).some((item) => item.type === 'agent_pending_payout_paid' && item.metadata?.pendingPayoutId === pendingPayout._id.toString()), 'Agent API should show paid notification');
    assert((memberPaidNotificationsResponse.data.items || []).some((item) => item.type === 'agent_pending_payout_paid' && item.metadata?.pendingPayoutId === pendingPayout._id.toString()), 'Member API should show paid notification');
    summary.checks.push('pending-payout-api-shows-auto-paid-status');
    summary.checks.push('agent-topup-auto-pays-pending-payout');

    const secondPendingTopupResponse = await adminClient.post('/wallet/adjust', {
      targetUserId: created.agentId,
      amount: 9870,
      note: 'Top up agent to continue FIFO pending payout auto-pay',
      reasonCode: 'agent_topup_credit'
    });
    expectStatus(secondPendingTopupResponse, 201, 'Top up agent for second pending payout');
    created.walletGroupIds.push(secondPendingTopupResponse.data.groupId);
    assert(Number(secondPendingTopupResponse.data.autoPayout?.paidCount || 0) === 1, 'Second topup should auto-pay the next pending payout');
    assert(Number(secondPendingTopupResponse.data.autoPayout?.paidAmount || 0) === 9870, 'Second auto payout amount should match pending payout');

    const [secondPendingAfterTopup, secondPendingItemAfterTopup, memberWalletAfterSecondAutoPayout, agentWalletAfterSecondAutoPayout] = await Promise.all([
      PendingPayout.findById(secondPendingScenario.payout._id).lean(),
      BetItem.findById(secondPendingScenario.item._id).lean(),
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      agentClient.get('/wallet/summary')
    ]);
    assert(secondPendingAfterTopup.status === 'paid', 'Second pending payout should be marked paid after second topup');
    assert(secondPendingItemAfterTopup.payoutStatus === 'paid', 'Second pending item should be marked paid after second topup');
    assert(Number(secondPendingItemAfterTopup.payoutAppliedAmount || 0) === 9870, 'Second auto payout should apply payout amount to bet item');
    expectStatus(memberWalletAfterSecondAutoPayout, 200, 'Member wallet after second auto payout');
    expectStatus(agentWalletAfterSecondAutoPayout, 200, 'Agent wallet after second auto payout');
    assert(Number(memberWalletAfterSecondAutoPayout.data.account?.creditBalance || 0) === 29660, 'Second auto payout should credit the next pending payout exactly once');
    assert(Number(agentWalletAfterSecondAutoPayout.data.account?.creditBalance || 0) === 0, 'Second auto payout should consume available agent credit without going negative');
    assert(Number(agentWalletAfterSecondAutoPayout.data.account?.heldStakeBalance || 0) === 0, 'Second auto payout should leave held stake at zero');
    summary.checks.push('pending-payout-fifo-partial-and-second-topup');

    const duplicateAutoPayoutTopupResponse = await adminClient.post('/wallet/adjust', {
      targetUserId: created.agentId,
      amount: 1,
      note: 'Verify paid pending payout is not paid again',
      reasonCode: 'agent_topup_credit'
    });
    expectStatus(duplicateAutoPayoutTopupResponse, 201, 'Top up agent after pending payout paid');
    created.walletGroupIds.push(duplicateAutoPayoutTopupResponse.data.groupId);
    assert(Number(duplicateAutoPayoutTopupResponse.data.autoPayout?.paidCount || 0) === 0, 'Paid pending payout must not be paid again');
    const memberWalletAfterDuplicateAutoPayout = await agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } });
    expectStatus(memberWalletAfterDuplicateAutoPayout, 200, 'Member wallet after duplicate auto payout attempt');
    assert(Number(memberWalletAfterDuplicateAutoPayout.data.account?.creditBalance || 0) === 29660, 'Duplicate auto payout attempt must not credit member again');
    summary.checks.push('pending-payout-no-double-auto-pay');

    const thirdPendingScenario = await createPendingPayoutScenario({
      number: '458',
      memo: 'third pending payout concurrent topup regression slip',
      clientRequestId: `regression-pending-third-${uniqueSuffix}`,
      label: 'Third'
    });

    const thirdPendingAgentWallet = await agentClient.get('/wallet/summary');
    expectStatus(thirdPendingAgentWallet, 200, 'Agent wallet after third pending setup');
    assert(Number(thirdPendingAgentWallet.data.account?.creditBalance || 0) === 11, 'Third pending setup should leave only stake release plus duplicate topup credit available');
    assert(Number(thirdPendingAgentWallet.data.account?.heldStakeBalance || 0) === 0, 'Third pending setup should clear held stake');

    const concurrentTopupResponses = await Promise.all([
      adminClient.post('/wallet/adjust', {
        targetUserId: created.agentId,
        amount: 9859,
        note: 'Concurrent topup A for pending payout race regression',
        reasonCode: 'agent_topup_credit'
      }),
      adminClient.post('/wallet/adjust', {
        targetUserId: created.agentId,
        amount: 9859,
        note: 'Concurrent topup B for pending payout race regression',
        reasonCode: 'agent_topup_credit'
      })
    ]);
    concurrentTopupResponses.forEach((response, index) => {
      expectStatus(response, 201, `Concurrent pending payout topup ${index + 1}`);
      created.walletGroupIds.push(response.data.groupId);
    });
    const concurrentPaidCount = concurrentTopupResponses.reduce(
      (sum, response) => sum + Number(response.data.autoPayout?.paidCount || 0),
      0
    );
    assert(concurrentPaidCount === 1, 'Concurrent topups should auto-pay the pending payout once');

    const [thirdPendingAfterConcurrentTopup, thirdPendingItemAfterConcurrentTopup, thirdMemberWalletAfterConcurrentTopup, thirdAgentWalletAfterConcurrentTopup, thirdPayoutLedgerEntries] = await Promise.all([
      PendingPayout.findById(thirdPendingScenario.payout._id).lean(),
      BetItem.findById(thirdPendingScenario.item._id).lean(),
      agentClient.get('/wallet/summary', { params: { targetUserId: created.memberId } }),
      agentClient.get('/wallet/summary'),
      CreditLedgerEntry.find({
        reasonCode: 'member_payout_credit',
        'metadata.pendingPayoutId': thirdPendingScenario.payout._id.toString()
      }).lean()
    ]);
    assert(thirdPendingAfterConcurrentTopup.status === 'paid', 'Concurrent topup should mark pending payout paid');
    assert(thirdPendingItemAfterConcurrentTopup.payoutStatus === 'paid', 'Concurrent topup should mark bet item paid');
    assert(Number(thirdPendingItemAfterConcurrentTopup.payoutAppliedAmount || 0) === 9870, 'Concurrent topup should apply payout once');
    expectStatus(thirdMemberWalletAfterConcurrentTopup, 200, 'Member wallet after concurrent topup auto payout');
    expectStatus(thirdAgentWalletAfterConcurrentTopup, 200, 'Agent wallet after concurrent topup auto payout');
    assert(thirdPayoutLedgerEntries.length === 1, 'Concurrent topup should create one member payout ledger entry');
    assert(Number(thirdMemberWalletAfterConcurrentTopup.data.account?.creditBalance || 0) === 39520, 'Concurrent topup should credit member once');
    assert(Number(thirdAgentWalletAfterConcurrentTopup.data.account?.creditBalance || 0) === 9859, 'Concurrent topup should leave only the second topup amount available after one payout');
    assert(Number(thirdAgentWalletAfterConcurrentTopup.data.account?.heldStakeBalance || 0) === 0, 'Concurrent topup should leave held stake at zero');
    summary.checks.push('pending-payout-concurrent-topup-no-double-pay');

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
