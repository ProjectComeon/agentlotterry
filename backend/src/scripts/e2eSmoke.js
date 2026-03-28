require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const assert = require('assert');
const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, '..', '..');
const port = process.env.E2E_PORT || '5051';
const baseURL = `http://127.0.0.1:${port}/api`;
const uniqueSuffix = Date.now().toString().slice(-6);
const shouldStartServer = process.env.E2E_SKIP_SERVER !== '1';

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
    enabledBetTypes: lottery.supportedBetTypes.includes('3top') ? ['3top'] : lottery.supportedBetTypes.slice(0, 1),
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
      '3tod': 654,
      '2top': 87,
      '2bottom': 92,
      'run_top': 4,
      'run_bottom': 3
    },
    keepMode: 'cap',
    keepCapAmount: 50,
    blockedNumbers: ['123'],
    notes: 'E2E smoke member config'
  }));

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
  let memberToken = '';
  let agentId = '';
  let memberId = '';
  let slipId = '';

  try {
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

    const adminLogin = await loginWithRetry('admin', 'admin123', 'Admin');
    adminToken = adminLogin.token;
    summary.checks.push('admin-login');

    const adminClient = makeClient(adminToken);
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
    summary.created.agent = { id: agentId, username: agentUsername };
    summary.checks.push('admin-create-agent');

    const agentLogin = await loginWithRetry(agentUsername, agentPassword, 'Agent');
    agentToken = agentLogin.token;
    summary.checks.push('agent-login');

    const agentClient = makeClient(agentToken);
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
    const selectedLottery = allLotteries.find((lottery) => lottery.status === 'open' && lottery.supportedBetTypes.includes('3top'))
      || allLotteries.find((lottery) => lottery.supportedBetTypes.includes('3top'))
      || allLotteries[0];

    assert(selectedLottery, 'No lottery found in catalog overview');

    const createMemberResponse = await agentClient.post('/agent/members', {
      account: {
        username: memberUsername,
        password: memberPassword,
        name: `E2E Member ${uniqueSuffix}`,
        phone: '0880000000',
        memberCode: `E2E${uniqueSuffix}`
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

    const memberLogin = await loginWithRetry(memberUsername, memberPassword, 'Member');
    memberToken = memberLogin.token;
    summary.checks.push('member-login');

    const memberClient = makeClient(memberToken);
    const memberHeartbeatResponse = await memberClient.post('/presence/heartbeat');
    expectStatus(memberHeartbeatResponse, 200, 'Member heartbeat');
    summary.checks.push('member-heartbeat');

    const transferCreditResponse = await agentClient.post('/wallet/transfer', {
      memberId,
      amount: 50,
      direction: 'to_member',
      note: 'E2E member funding'
    });
    expectStatus(transferCreditResponse, 201, 'Agent transfer credit');
    summary.checks.push('agent-transfer-credit');

    const [agentWalletAfterTransfer, memberWalletSummaryResponse, memberWalletHistoryResponse] = await Promise.all([
      agentClient.get('/wallet/summary'),
      memberClient.get('/wallet/summary'),
      memberClient.get('/wallet/history', { params: { limit: 10 } })
    ]);
    expectStatus(agentWalletAfterTransfer, 200, 'Agent wallet after transfer');
    expectStatus(memberWalletSummaryResponse, 200, 'Member wallet summary');
    expectStatus(memberWalletHistoryResponse, 200, 'Member wallet history');
    assert(Number(agentWalletAfterTransfer.data.account?.creditBalance || 0) === 200, 'Agent wallet balance did not decrease after transfer');
    assert(Number(memberWalletSummaryResponse.data.account?.creditBalance || 0) === 50, 'Member wallet balance did not increase after transfer');
    assert((memberWalletHistoryResponse.data || []).some((entry) => entry.groupId === transferCreditResponse.data.groupId && entry.direction === 'credit'), 'Member wallet history does not contain transfer entry');
    summary.checks.push('member-wallet-summary');
    summary.checks.push('member-wallet-history');

    const memberCatalogResponse = await memberClient.get('/catalog/overview');
    expectStatus(memberCatalogResponse, 200, 'Member catalog overview');

    if (memberCatalogResponse.data.announcements?.length) {
      const firstAnnouncement = memberCatalogResponse.data.announcements[0];
      const markAnnouncementReadResponse = await memberClient.post(`/catalog/announcements/${firstAnnouncement.id}/read`);
      expectStatus(markAnnouncementReadResponse, 200, 'Mark announcement read');
      const refreshedMemberCatalogResponse = await memberClient.get('/catalog/overview');
      expectStatus(refreshedMemberCatalogResponse, 200, 'Refresh member catalog overview');
      assert((refreshedMemberCatalogResponse.data.announcements || []).some((item) => item.id === firstAnnouncement.id && item.isRead), 'Announcement read state was not persisted');
      summary.checks.push('member-announcement-read');
    }

    const agentDashboardResponse = await agentClient.get('/agent/dashboard');
    expectStatus(agentDashboardResponse, 200, 'Agent dashboard online members');
    assert((agentDashboardResponse.data.onlineMembers || []).some((item) => item.id === memberId), 'Member was not visible in agent online members');
    summary.checks.push('agent-dashboard-online-members');

    const visibleLotteries = flattenLotteries(memberCatalogResponse.data);
    assert(visibleLotteries.length === 1, `Expected exactly 1 enabled lottery, found ${visibleLotteries.length}`);
    assert(visibleLotteries[0].code === selectedLottery.code, 'Member can see an unexpected lottery');
    assert(visibleLotteries[0].rateProfiles?.[0]?.rates?.['3top'] === 987, 'Custom rate was not applied to member catalog');
    summary.checks.push('member-catalog-filtering');

    const roundsResponse = await memberClient.get('/catalog/rounds', {
      params: { lotteryId: visibleLotteries[0].id }
    });
    expectStatus(roundsResponse, 200, 'Member rounds');
    const selectedRound = (roundsResponse.data || []).find((round) => round.id === visibleLotteries[0].activeRound?.id)
      || (roundsResponse.data || [])[0];
    assert(selectedRound, 'No round available for selected lottery');
    summary.checks.push('member-rounds');

    const blockedParseResponse = await memberClient.post('/member/slips/parse', {
      lotteryId: visibleLotteries[0].id,
      roundId: selectedRound.id,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      betType: '3top',
      defaultAmount: 10,
      rawInput: '123 10',
      reverse: false,
      includeDoubleSet: false,
      memo: 'blocked test'
    });
    assert(blockedParseResponse.status === 400, 'Blocked-number parse should fail');
    summary.checks.push('member-blocked-number');

    const validParseResponse = await memberClient.post('/member/slips/parse', {
      lotteryId: visibleLotteries[0].id,
      roundId: selectedRound.id,
      rateProfileId: visibleLotteries[0].defaultRateProfileId,
      betType: '3top',
      defaultAmount: 10,
      rawInput: '456 10',
      reverse: false,
      includeDoubleSet: false,
      memo: 'valid test'
    });
    expectStatus(validParseResponse, 200, 'Valid parse');
    assert(validParseResponse.data.items?.[0]?.payRate === 987, 'Expected custom pay rate on valid parse');
    summary.checks.push('member-valid-parse');

    if (selectedRound.status === 'open') {
      const submitSlipResponse = await memberClient.post('/member/slips', {
        lotteryId: visibleLotteries[0].id,
        roundId: selectedRound.id,
        rateProfileId: visibleLotteries[0].defaultRateProfileId,
        betType: '3top',
        defaultAmount: 10,
        rawInput: '456 10',
        reverse: false,
        includeDoubleSet: false,
        memo: 'submit test',
        action: 'submit'
      });
      expectStatus(submitSlipResponse, 201, 'Submit slip');
      slipId = submitSlipResponse.data.id;
      summary.created.submittedSlip = { id: slipId, roundCode: submitSlipResponse.data.roundCode };
      summary.checks.push('member-submit-slip');

      const agentBetsResponse = await agentClient.get('/agent/bets', {
        params: {
          roundDate: submitSlipResponse.data.roundCode,
          marketId: submitSlipResponse.data.lotteryCode
        }
      });
      expectStatus(agentBetsResponse, 200, 'Agent bets');
      assert((agentBetsResponse.data || []).some((item) => item.slipId === slipId), 'Submitted slip not found in agent bets');
      summary.checks.push('agent-bets-list');

      const reportBeforeCancel = await agentClient.get('/agent/reports', {
        params: {
          roundDate: submitSlipResponse.data.roundCode,
          marketId: submitSlipResponse.data.lotteryCode
        }
      });
      expectStatus(reportBeforeCancel, 200, 'Agent reports before cancel');
      assert((reportBeforeCancel.data.pendingRows || []).some((item) => item.slipId === slipId), 'Submitted slip not found in pending report');
      summary.checks.push('agent-reports-pending');

      const cancelSlipResponse = await memberClient.post(`/member/slips/${slipId}/cancel`);
      expectStatus(cancelSlipResponse, 200, 'Cancel slip');
      assert(cancelSlipResponse.data.status === 'cancelled', 'Slip status did not change to cancelled');
      summary.checks.push('member-cancel-slip');

      const reportAfterCancel = await agentClient.get('/agent/reports', {
        params: {
          roundDate: submitSlipResponse.data.roundCode,
          marketId: submitSlipResponse.data.lotteryCode
        }
      });
      expectStatus(reportAfterCancel, 200, 'Agent reports after cancel');
      assert(!(reportAfterCancel.data.pendingRows || []).some((item) => item.slipId === slipId), 'Cancelled slip still appears in pending report');
      summary.checks.push('agent-reports-after-cancel');
    } else {
      summary.warnings.push(`Selected round ${selectedRound.code} is not open, submit/cancel smoke was skipped`);

      const draftSlipResponse = await memberClient.post('/member/slips', {
        lotteryId: visibleLotteries[0].id,
        roundId: selectedRound.id,
        rateProfileId: visibleLotteries[0].defaultRateProfileId,
        betType: '3top',
        defaultAmount: 10,
        rawInput: '456 10',
        reverse: false,
        includeDoubleSet: false,
        memo: 'draft test',
        action: 'draft'
      });
      expectStatus(draftSlipResponse, 201, 'Create draft slip');
      summary.checks.push('member-draft-slip');
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
      if (memberId && agentToken) {
        const agentClient = makeClient(agentToken);
        await agentClient.delete(`/agent/customers/${memberId}`);
      }
    } catch {}

    try {
      if (agentId && adminToken) {
        const adminClient = makeClient(adminToken);
        await adminClient.delete(`/admin/agents/${agentId}`);
      }
    } catch {}

    await killProcess(server);
  }
};

main();
