const mongoose = require('mongoose');
const LotteryType = require('../models/LotteryType');
const RateProfile = require('../models/RateProfile');
const User = require('../models/User');
const UserLotteryConfig = require('../models/UserLotteryConfig');
const { BET_TYPES, DEFAULT_GLOBAL_RATES } = require('../constants/betting');
const {
  getBetTotals,
  getTotalsGroupedByField
} = require('./analyticsService');

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_LIMITS = {
  minimumBet: 1,
  maximumBet: 10000,
  maximumPerNumber: 10000,
  keepMode: 'off',
  keepCapAmount: 0
};

const toText = (value) => String(value || '').trim();
const toAmount = (value, fallback = 0) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  return amount;
};
const toPositiveAmount = (value, fallback = 0) => Math.max(0, toAmount(value, fallback));
const toPercent = (value, fallback = 0) => Math.max(0, Math.min(100, toAmount(value, fallback)));
const toStatus = (value, fallback = 'active') => ['active', 'inactive', 'suspended'].includes(value) ? value : fallback;
const toKeepMode = (value, fallback = DEFAULT_LIMITS.keepMode) => ['off', 'cap'].includes(value) ? value : fallback;
const normalizeBlockedNumbers = (value) => {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map((item) => String(item || '').trim()).filter(Boolean))];
};
const normalizeRatesByBetType = (value = {}, fallbackRates = {}) =>
  BET_TYPES.reduce((acc, betType) => {
    const nextValue = toPositiveAmount(value?.[betType], fallbackRates?.[betType] || DEFAULT_GLOBAL_RATES[betType] || 0);
    acc[betType] = nextValue;
    return acc;
  }, {});

const normalizeCommissionMap = (value = {}) =>
  BET_TYPES.reduce((acc, betType) => {
    acc[betType] = toPositiveAmount(value?.[betType], 0);
    return acc;
  }, {});

const isUserOnline = (user) => {
  if (!user?.isActive || user?.status !== 'active' || !user?.lastActiveAt) {
    return false;
  }

  return Date.now() - new Date(user.lastActiveAt).getTime() <= ONLINE_WINDOW_MS;
};

const loadActiveRateProfiles = async () =>
  RateProfile.find({ isActive: true }).sort({ isDefault: -1, name: 1 });

const loadActiveLotteries = async () =>
  LotteryType.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .populate('leagueId', 'code name')
    .populate('rateProfileIds', 'code name description isActive rates commissions')
    .populate('defaultRateProfileId', 'code name description isActive rates commissions');

const normalizeEnabledBetTypes = (value, supportedBetTypes) => {
  if (!Array.isArray(value) || !value.length) {
    return supportedBetTypes;
  }

  const nextTypes = supportedBetTypes.filter((betType) => value.includes(betType));
  if (!nextTypes.length) {
    return supportedBetTypes;
  }

  // Backfill newly introduced Lao set betting for legacy configs that previously
  // mirrored the full Lao market support list before `lao_set4` existed.
  if (supportedBetTypes.includes('lao_set4') && !nextTypes.includes('lao_set4')) {
    const legacySupportedTypes = supportedBetTypes.filter((betType) => betType !== 'lao_set4');
    const matchesLegacyDefault = legacySupportedTypes.every((betType) => nextTypes.includes(betType));

    if (matchesLegacyDefault) {
      return [...nextTypes, 'lao_set4'];
    }
  }

  if (supportedBetTypes.includes('3front') && !nextTypes.includes('3front')) {
    const legacySupportedTypes = supportedBetTypes.filter((betType) => betType !== '3front');
    const matchesLegacyDefault = legacySupportedTypes.every((betType) => nextTypes.includes(betType));

    if (matchesLegacyDefault) {
      return [...nextTypes, '3front'];
    }
  }

  // Legacy non-government configs could previously store `3bottom` where the
  // market now correctly exposes `3tod`. If the member kept the full old set,
  // preserve access by translating that legacy flag forward.
  if (
    supportedBetTypes.includes('3tod') &&
    !supportedBetTypes.includes('3bottom') &&
    !nextTypes.includes('3tod') &&
    value.includes('3bottom')
  ) {
    const comparableSupportedTypes = supportedBetTypes.filter((betType) => betType !== '3tod');
    const matchesLegacyDefault = comparableSupportedTypes.every((betType) => nextTypes.includes(betType));

    if (matchesLegacyDefault) {
      return [...nextTypes, '3tod'];
    }
  }

  return nextTypes;
};

const pickRateProfileId = ({ lottery, member, existingConfig, inputConfig }) => {
  const allowedRateIds = (lottery.rateProfileIds || [])
    .filter((profile) => profile.isActive)
    .map((profile) => profile._id.toString());

  const requestedRateProfileId =
    inputConfig?.rateProfileId ||
    existingConfig?.rateProfileId?.toString() ||
    member.defaultRateProfileId?.toString() ||
    lottery.defaultRateProfileId?._id?.toString() ||
    lottery.defaultRateProfileId?.toString() ||
    allowedRateIds[0] ||
    null;

  if (requestedRateProfileId && allowedRateIds.includes(requestedRateProfileId)) {
    return requestedRateProfileId;
  }

  return allowedRateIds[0] || null;
};

const buildLotteryConfigDocument = ({ member, lottery, existingConfig, inputConfig }) => {
  const selectedRateProfileId = pickRateProfileId({ lottery, member, existingConfig, inputConfig });
  const selectedRateProfile = (lottery.rateProfileIds || []).find(
    (profile) => profile._id.toString() === selectedRateProfileId
  );
  const fallbackRates = selectedRateProfile?.rates || {};
  const enabledBetTypes = normalizeEnabledBetTypes(
    inputConfig?.enabledBetTypes || existingConfig?.enabledBetTypes,
    lottery.supportedBetTypes
  );

  return {
    userId: member._id,
    agentId: member.agentId,
    lotteryTypeId: lottery._id,
    isEnabled: inputConfig?.isEnabled !== undefined ? Boolean(inputConfig.isEnabled) : existingConfig?.isEnabled ?? true,
    rateProfileId: selectedRateProfileId,
    enabledBetTypes,
    minimumBet: toPositiveAmount(
      inputConfig?.minimumBet,
      existingConfig?.minimumBet ?? DEFAULT_LIMITS.minimumBet
    ),
    maximumBet: toPositiveAmount(
      inputConfig?.maximumBet,
      existingConfig?.maximumBet ?? DEFAULT_LIMITS.maximumBet
    ),
    maximumPerNumber: toPositiveAmount(
      inputConfig?.maximumPerNumber,
      existingConfig?.maximumPerNumber ?? DEFAULT_LIMITS.maximumPerNumber
    ),
    stockPercent: toPercent(
      inputConfig?.stockPercent,
      existingConfig?.stockPercent ?? member.stockPercent
    ),
    ownerPercent: toPercent(
      inputConfig?.ownerPercent,
      existingConfig?.ownerPercent ?? member.ownerPercent
    ),
    keepPercent: toPercent(
      inputConfig?.keepPercent,
      existingConfig?.keepPercent ?? member.keepPercent
    ),
    commissionRate: toPercent(
      inputConfig?.commissionRate,
      existingConfig?.commissionRate ?? member.commissionRate
    ),
    useCustomRates: inputConfig?.useCustomRates !== undefined
      ? Boolean(inputConfig.useCustomRates)
      : existingConfig?.useCustomRates ?? false,
    customRates: normalizeRatesByBetType(
      inputConfig?.customRates || existingConfig?.customRates,
      fallbackRates
    ),
    keepMode: toKeepMode(
      inputConfig?.keepMode,
      existingConfig?.keepMode ?? DEFAULT_LIMITS.keepMode
    ),
    keepCapAmount: toPositiveAmount(
      inputConfig?.keepCapAmount,
      existingConfig?.keepCapAmount ?? DEFAULT_LIMITS.keepCapAmount
    ),
    blockedNumbers: normalizeBlockedNumbers(
      inputConfig?.blockedNumbers || existingConfig?.blockedNumbers
    ),
    notes: inputConfig?.notes !== undefined ? toText(inputConfig.notes) : (existingConfig?.notes || '')
  };
};

const upsertMemberLotteryConfigs = async ({ member, lotterySettings = [], lotteries = null }) => {
  const activeLotteries = lotteries || await loadActiveLotteries();
  const lotteryIds = activeLotteries.map((lottery) => lottery._id);
  const existingConfigs = await UserLotteryConfig.find({
    userId: member._id,
    lotteryTypeId: { $in: lotteryIds }
  });

  const existingMap = existingConfigs.reduce((acc, config) => {
    acc[config.lotteryTypeId.toString()] = config;
    return acc;
  }, {});

  const inputMap = (Array.isArray(lotterySettings) ? lotterySettings : []).reduce((acc, config) => {
    if (config?.lotteryTypeId) {
      acc[config.lotteryTypeId] = config;
    }
    return acc;
  }, {});

  const operations = activeLotteries.map((lottery) => ({
    updateOne: {
      filter: {
        userId: member._id,
        lotteryTypeId: lottery._id
      },
      update: {
        $set: buildLotteryConfigDocument({
          member,
          lottery,
          existingConfig: existingMap[lottery._id.toString()],
          inputConfig: inputMap[lottery._id.toString()]
        })
      },
      upsert: true
    }
  }));

  if (operations.length) {
    await UserLotteryConfig.bulkWrite(operations);
  }
};

const mapRateProfile = (profile) => ({
  id: profile._id.toString(),
  code: profile.code,
  name: profile.name,
  description: profile.description,
  rates: normalizeRatesByBetType(profile.rates),
  commissions: normalizeCommissionMap(profile.commissions || {}),
  isDefault: Boolean(profile.isDefault)
});

const mapLotteryConfigRow = ({ lottery, config }) => {
  const allowedProfiles = (lottery.rateProfileIds || []).filter((profile) => profile.isActive);
  const activeRateProfiles = allowedProfiles;
  const configuredRateProfileId = config?.rateProfileId?.toString() || '';
  const selectedRateProfileId =
    (configuredRateProfileId && activeRateProfiles.some((profile) => profile._id.toString() === configuredRateProfileId)
      ? configuredRateProfileId
      : '') ||
    lottery.defaultRateProfileId?._id?.toString() ||
    lottery.defaultRateProfileId?.toString() ||
    activeRateProfiles[0]?._id?.toString() ||
    null;

  return {
    lotteryTypeId: lottery._id.toString(),
    lotteryCode: lottery.code,
    lotteryName: lottery.name,
    lotteryShortName: lottery.shortName,
    leagueName: lottery.leagueId?.name || '',
    leagueCode: lottery.leagueId?.code || '',
    supportedBetTypes: lottery.supportedBetTypes,
    enabledBetTypes: config?.enabledBetTypes?.length ? config.enabledBetTypes : lottery.supportedBetTypes,
    isEnabled: config?.isEnabled ?? true,
    rateProfileId: selectedRateProfileId,
    minimumBet: config?.minimumBet ?? DEFAULT_LIMITS.minimumBet,
    maximumBet: config?.maximumBet ?? DEFAULT_LIMITS.maximumBet,
    maximumPerNumber: config?.maximumPerNumber ?? DEFAULT_LIMITS.maximumPerNumber,
    stockPercent: config?.stockPercent ?? 0,
    ownerPercent: config?.ownerPercent ?? 0,
    keepPercent: config?.keepPercent ?? 0,
    commissionRate: config?.commissionRate ?? 0,
    useCustomRates: config?.useCustomRates ?? false,
    customRates: normalizeRatesByBetType(
      config?.customRates,
      activeRateProfiles.find((profile) => profile._id.toString() === selectedRateProfileId)?.rates || {}
    ),
    keepMode: config?.keepMode || DEFAULT_LIMITS.keepMode,
    keepCapAmount: config?.keepCapAmount ?? DEFAULT_LIMITS.keepCapAmount,
    blockedNumbers: config?.blockedNumbers || [],
    notes: config?.notes || '',
    availableRateProfiles: activeRateProfiles.map(mapRateProfile)
  };
};

const getMemberConfigRows = async ({ member, lotteries = null }) => {
  const activeLotteries = lotteries || await loadActiveLotteries();
  await upsertMemberLotteryConfigs({ member, lotteries: activeLotteries });

  const configDocs = await UserLotteryConfig.find({
    userId: member._id,
    lotteryTypeId: { $in: activeLotteries.map((lottery) => lottery._id) }
  });

  const configMap = configDocs.reduce((acc, config) => {
    acc[config.lotteryTypeId.toString()] = config;
    return acc;
  }, {});

  return activeLotteries.map((lottery) =>
    mapLotteryConfigRow({
      lottery,
      config: configMap[lottery._id.toString()]
    })
  );
};

const getMemberLotteryAccess = async ({ customerId, lotteryId, betType = '', rateProfileId = '' }) => {
  const member = await User.findById(customerId).select(
    '_id agentId defaultRateProfileId stockPercent ownerPercent keepPercent commissionRate role'
  );

  if (!member || member.role !== 'customer') {
    throw new Error('Member not found');
  }

  const lotteries = await loadActiveLotteries();
  const lottery = lotteries.find((item) => item._id.toString() === lotteryId);
  if (!lottery) {
    throw new Error('Selected lottery is not available');
  }

  await upsertMemberLotteryConfigs({ member, lotteries });
  const config = await UserLotteryConfig.findOne({
    userId: customerId,
    lotteryTypeId: lotteryId
  });

  if (!config || !config.isEnabled) {
    throw new Error('This lottery is not enabled for your account');
  }

  const enabledBetTypes = config.enabledBetTypes?.length ? config.enabledBetTypes : lottery.supportedBetTypes;
  if (betType && !enabledBetTypes.includes(betType)) {
    throw new Error('This bet type is not enabled for your account');
  }

  const allowedRateIds = (lottery.rateProfileIds || [])
    .filter((profile) => profile.isActive)
    .map((profile) => profile._id.toString());
  const configuredRateProfileId = config.rateProfileId?.toString() || '';
  const enforcedRateProfileId = allowedRateIds.includes(configuredRateProfileId)
    ? configuredRateProfileId
    : (
      lottery.defaultRateProfileId?._id?.toString() ||
      lottery.defaultRateProfileId?.toString() ||
      allowedRateIds[0] ||
      ''
    );

  if (rateProfileId && enforcedRateProfileId && rateProfileId !== enforcedRateProfileId) {
    throw new Error('This rate profile is not available for your account');
  }

  return {
    member,
    lottery,
    config,
    enabledBetTypes,
    rateProfileId: enforcedRateProfileId
  };
};

const mapMemberSummary = (member, stats = {}, configSummary = {}) => ({
  id: member._id.toString(),
  username: member.username,
  name: member.name,
  phone: member.phone || '',
  role: member.role,
  displayRole: member.displayRole || 'member',
  status: member.status,
  isActive: member.isActive,
  creditBalance: member.creditBalance || 0,
  stockPercent: member.stockPercent || 0,
  ownerPercent: member.ownerPercent || 0,
  keepPercent: member.keepPercent || 0,
  commissionRate: member.commissionRate || 0,
  defaultRateProfileId: member.defaultRateProfileId?.toString?.() || member.defaultRateProfileId || null,
  notes: member.notes || '',
  parentUserId: member.parentUserId?.toString?.() || member.parentUserId || null,
  agentId: member.agentId?.toString?.() || member.agentId || null,
  createdAt: member.createdAt,
  updatedAt: member.updatedAt,
  lastActiveAt: member.lastActiveAt,
  isOnline: isUserOnline(member),
  totals: {
    totalBets: stats.count || 0,
    totalAmount: stats.totalAmount || 0,
    totalWon: stats.totalWon || 0,
    netProfit: (stats.totalAmount || 0) - (stats.totalWon || 0)
  },
  configSummary: {
    enabledLotteryCount: configSummary.enabledLotteryCount || 0,
    minimumBet: configSummary.minimumBet ?? DEFAULT_LIMITS.minimumBet,
    maximumBet: configSummary.maximumBet ?? DEFAULT_LIMITS.maximumBet,
    maximumPerNumber: configSummary.maximumPerNumber ?? DEFAULT_LIMITS.maximumPerNumber
  }
});

const getAgentMemberBootstrap = async ({ agentId }) => {
  const normalizedAgentId = agentId || null;
  const [agent, lotteries, rateProfiles] = await Promise.all([
    normalizedAgentId
      ? User.findById(normalizedAgentId).select('name creditBalance stockPercent ownerPercent keepPercent commissionRate')
      : null,
    loadActiveLotteries(),
    loadActiveRateProfiles()
  ]);

  return {
    defaults: {
      creditBalance: 0,
      stockPercent: 0,
      ownerPercent: 0,
      keepPercent: 0,
      commissionRate: 0,
      minimumBet: DEFAULT_LIMITS.minimumBet,
      maximumBet: DEFAULT_LIMITS.maximumBet,
      maximumPerNumber: DEFAULT_LIMITS.maximumPerNumber,
      keepMode: DEFAULT_LIMITS.keepMode,
      keepCapAmount: DEFAULT_LIMITS.keepCapAmount,
      useCustomRates: false
    },
    onlineWindowSeconds: Math.floor(ONLINE_WINDOW_MS / 1000),
    agent: {
      id: agent?._id?.toString() || normalizedAgentId?.toString?.() || '',
      name: agent?.name || '',
      creditBalance: agent?.creditBalance || 0,
      stockPercent: agent?.stockPercent || 0,
      ownerPercent: agent?.ownerPercent || 0,
      keepPercent: agent?.keepPercent || 0,
      commissionRate: agent?.commissionRate || 0
    },
    rateProfiles: rateProfiles.map(mapRateProfile),
    lotteries: lotteries.map((lottery) => mapLotteryConfigRow({
      lottery,
      config: null,
      rateProfiles: (lottery.rateProfileIds || []).filter((profile) => profile.isActive)
    }))
  };
};

const getAdminMemberBootstrap = async ({ agentId = '' } = {}) =>
  getAgentMemberBootstrap({ agentId: toText(agentId) || null });

const getAgentMembers = async ({ agentId, search = '', status = '', online = '' }) => {
  const filter = { agentId, role: 'customer' };
  const searchText = toText(search);

  if (searchText) {
    const regex = new RegExp(searchText, 'i');
    filter.$or = [
      { name: regex },
      { username: regex },
      { phone: regex }
    ];
  }

  const normalizedStatus = toText(status);
  if (normalizedStatus && ['active', 'inactive', 'suspended'].includes(normalizedStatus)) {
    filter.status = normalizedStatus;
  }

  const members = await User.find(filter)
    .select('-password')
    .sort({ createdAt: -1 });

  const onlineFilter = String(online || '').toLowerCase();
  const filteredMembers = members.filter((member) => {
    if (onlineFilter === 'true') return isUserOnline(member);
    if (onlineFilter === 'false') return !isUserOnline(member);
    return true;
  });

  const memberIds = filteredMembers.map((member) => member._id);
  const [betStatsByCustomer, configRows] = await Promise.all([
    getTotalsGroupedByField('customerId', { agentId }),
    UserLotteryConfig.aggregate([
      {
        $match: {
          agentId,
          userId: { $in: memberIds }
        }
      },
      {
        $group: {
          _id: '$userId',
          enabledLotteryCount: {
            $sum: {
              $cond: ['$isEnabled', 1, 0]
            }
          },
          minimumBet: { $min: '$minimumBet' },
          maximumBet: { $max: '$maximumBet' },
          maximumPerNumber: { $max: '$maximumPerNumber' }
        }
      }
    ])
  ]);

  const configSummaryByMember = configRows.reduce((acc, row) => {
    acc[row._id.toString()] = row;
    return acc;
  }, {});

  return filteredMembers.map((member) =>
    mapMemberSummary(
      member,
      betStatsByCustomer[member._id.toString()] || {},
      configSummaryByMember[member._id.toString()] || {}
    )
  );
};

const searchMembersForBetting = async ({ actorId, actorRole, search = '', agentId = '', limit = 20 }) => {
  const filter = { role: 'customer' };
  if (actorRole === 'agent') {
    filter.agentId = actorId;
  } else if (actorRole === 'admin' && agentId) {
    filter.agentId = agentId;
  }

  const searchText = toText(search);
  if (searchText) {
    const regex = new RegExp(searchText, 'i');
    const orConditions = [
      { name: regex },
      { username: regex },
      { phone: regex }
    ];

    filter.$or = orConditions;
  }

  const members = await User.find(filter)
    .select('name username phone creditBalance status isActive agentId')
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(Math.max(1, Math.min(50, Number(limit) || 20)))
    .populate('agentId', 'name username');

  const totalsByCustomer = await getTotalsGroupedByField('customerId', {
    ...(actorRole === 'agent' ? { agentId: actorId } : {}),
    ...(actorRole === 'admin' && agentId ? { agentId } : {})
  });

  const normalizedSearch = searchText.toLowerCase();
  const finalRows = members.filter((member) => {
    if (!normalizedSearch) return true;
    return (
      member.name.toLowerCase().includes(normalizedSearch) ||
      member.username.toLowerCase().includes(normalizedSearch) ||
      (member.phone || '').toLowerCase().includes(normalizedSearch)
    );
  });

  return finalRows.map((member) => ({
    id: member._id.toString(),
    name: member.name,
    username: member.username,
    phone: member.phone || '',
    creditBalance: member.creditBalance || 0,
    status: member.status,
    isActive: member.isActive,
    totals: {
      totalBets: totalsByCustomer[member._id.toString()]?.count || 0,
      totalAmount: totalsByCustomer[member._id.toString()]?.totalAmount || 0,
      totalWon: totalsByCustomer[member._id.toString()]?.totalWon || 0,
      netProfit:
        (totalsByCustomer[member._id.toString()]?.totalAmount || 0) -
        (totalsByCustomer[member._id.toString()]?.totalWon || 0)
    },
    agent: member.agentId ? {
      id: member.agentId._id.toString(),
      name: member.agentId.name,
      username: member.agentId.username
    } : null
  }));
};

const getMemberForBettingActor = async ({ actorId, actorRole, memberId }) => {
  const member = await User.findById(memberId).select('-password');

  if (!member || member.role !== 'customer') {
    throw new Error('Member not found');
  }

  if (!member.isActive || member.status !== 'active') {
    throw new Error('This member account is not active');
  }

  if (actorRole === 'agent' && member.agentId?.toString() !== actorId.toString()) {
    throw new Error('This member does not belong to the current agent');
  }

  if (!['admin', 'agent', 'customer'].includes(actorRole)) {
    throw new Error('This role cannot access member betting');
  }

  if (actorRole === 'customer' && member._id.toString() !== actorId.toString()) {
    throw new Error('Customers can only access their own account');
  }

  return member;
};

const getAgentMemberDetail = async ({ agentId, memberId }) => {
  const [member, lotteries, rateProfiles] = await Promise.all([
    User.findOne({ _id: memberId, agentId, role: 'customer' }).select('-password'),
    loadActiveLotteries(),
    loadActiveRateProfiles()
  ]);

  if (!member) {
    throw new Error('Member not found');
  }

  const [lotteryConfigs, totals] = await Promise.all([
    getMemberConfigRows({ member, lotteries }),
    getBetTotals({ agentId, customerId: member._id })
  ]);

  return {
    member: mapMemberSummary(member, {
      count: totals.totalBets,
      totalAmount: totals.totalAmount,
      totalWon: totals.totalWon
    }, {
      enabledLotteryCount: lotteryConfigs.filter((item) => item.isEnabled).length,
      minimumBet: lotteryConfigs.reduce(
        (min, item) => Math.min(min, item.minimumBet),
        lotteryConfigs.length ? lotteryConfigs[0].minimumBet : DEFAULT_LIMITS.minimumBet
      ),
      maximumBet: lotteryConfigs.reduce(
        (max, item) => Math.max(max, item.maximumBet),
        lotteryConfigs.length ? lotteryConfigs[0].maximumBet : DEFAULT_LIMITS.maximumBet
      ),
      maximumPerNumber: lotteryConfigs.reduce(
        (max, item) => Math.max(max, item.maximumPerNumber),
        lotteryConfigs.length ? lotteryConfigs[0].maximumPerNumber : DEFAULT_LIMITS.maximumPerNumber
      )
    }),
    lotteryConfigs,
    rateProfiles: rateProfiles.map(mapRateProfile)
  };
};

const getAdminMemberDetail = async ({ memberId }) => {
  const member = await User.findOne({ _id: memberId, role: 'customer' }).select('agentId');
  if (!member) {
    throw new Error('Member not found');
  }

  return getAgentMemberDetail({
    agentId: member.agentId,
    memberId
  });
};

const createAgentMember = async ({ agentId, payload }) => {
  const account = payload.account || payload;
  const profile = payload.profile || payload;
  const initialCreditBalance = toPositiveAmount(profile.creditBalance, 0);

  const username = toText(account.username).toLowerCase();
  const password = String(account.password || '');
  const name = toText(account.name);

  if (!username || !password || !name) {
    throw new Error('Username, password, and name are required');
  }

  const existingUsername = await User.findOne({ username }).select('_id');
  if (existingUsername) {
    throw new Error('Username already exists');
  }

  if (initialCreditBalance > 0) {
    throw new Error('Create the member first, then add credit from the wallet flow');
  }

  const member = await User.create({
    username,
    password,
    role: 'customer',
    displayRole: 'member',
    name,
    phone: toText(account.phone || profile.phone),
    agentId,
    parentUserId: agentId,
    creditBalance: 0,
    stockPercent: toPercent(profile.stockPercent, 0),
    ownerPercent: toPercent(profile.ownerPercent, 0),
    keepPercent: toPercent(profile.keepPercent, 0),
    commissionRate: toPercent(profile.commissionRate, 0),
    defaultRateProfileId: profile.defaultRateProfileId || null,
    notes: toText(profile.notes),
    status: toStatus(profile.status, 'active'),
    isActive: toStatus(profile.status, 'active') !== 'inactive'
  });

  const lotteries = await loadActiveLotteries();
  await upsertMemberLotteryConfigs({
    member,
    lotterySettings: payload.lotterySettings || [],
    lotteries
  });

  return getAgentMemberDetail({ agentId, memberId: member._id });
};

const createAdminMember = async ({ payload }) => {
  const selectedAgentId = toText(
    payload?.agentId ||
    payload?.account?.agentId ||
    payload?.profile?.agentId
  );

  if (!selectedAgentId) {
    throw new Error('Agent is required');
  }

  const agent = await User.findOne({ _id: selectedAgentId, role: 'agent' }).select('_id');
  if (!agent) {
    throw new Error('Agent not found');
  }

  return createAgentMember({
    agentId: selectedAgentId,
    payload
  });
};

const updateAgentMember = async ({ agentId, memberId, payload }) => {
  const account = payload.account || payload;
  const profile = payload.profile || payload;

  const member = await User.findOne({ _id: memberId, agentId, role: 'customer' });
  if (!member) {
    throw new Error('Member not found');
  }

  if (profile.creditBalance !== undefined) {
    throw new Error('Use the wallet flow to change credit balance');
  }

  if (account.username !== undefined) {
    const username = toText(account.username).toLowerCase();
    if (!username) {
      throw new Error('Username is required');
    }
    if (username !== member.username) {
      const existingUsername = await User.findOne({ username }).select('_id');
      if (existingUsername) {
        throw new Error('Username already exists');
      }
      member.username = username;
    }
  }

  if (account.name !== undefined) member.name = toText(account.name);
  if (account.phone !== undefined || profile.phone !== undefined) {
    member.phone = toText(account.phone ?? profile.phone);
  }
  if (account.password) member.password = account.password;
  if (profile.stockPercent !== undefined) member.stockPercent = toPercent(profile.stockPercent, member.stockPercent);
  if (profile.ownerPercent !== undefined) member.ownerPercent = toPercent(profile.ownerPercent, member.ownerPercent);
  if (profile.keepPercent !== undefined) member.keepPercent = toPercent(profile.keepPercent, member.keepPercent);
  if (profile.commissionRate !== undefined) member.commissionRate = toPercent(profile.commissionRate, member.commissionRate);
  if (profile.defaultRateProfileId !== undefined) member.defaultRateProfileId = profile.defaultRateProfileId || null;
  if (profile.notes !== undefined) member.notes = toText(profile.notes);
  if (profile.status !== undefined) {
    member.status = toStatus(profile.status, member.status);
    member.isActive = member.status !== 'inactive';
  }

  await member.save();

  const lotteries = await loadActiveLotteries();
  await upsertMemberLotteryConfigs({
    member,
    lotterySettings: payload.lotterySettings || [],
    lotteries
  });

  return getAgentMemberDetail({ agentId, memberId: member._id });
};

const updateAdminMember = async ({ memberId, payload }) => {
  const member = await User.findOne({ _id: memberId, role: 'customer' }).select('agentId parentUserId');
  if (!member) {
    throw new Error('Member not found');
  }

  const currentAgentId = member.agentId?.toString();
  const selectedAgentId = toText(
    payload?.agentId ||
    payload?.account?.agentId ||
    payload?.profile?.agentId
  ) || currentAgentId;

  if (!selectedAgentId) {
    throw new Error('Agent is required');
  }

  if (selectedAgentId !== currentAgentId) {
    const agent = await User.findOne({ _id: selectedAgentId, role: 'agent' }).select('_id');
    if (!agent) {
      throw new Error('Agent not found');
    }
  }

  if (!currentAgentId) {
    const previousParentUserId = member.parentUserId || null;
    member.agentId = selectedAgentId;
    member.parentUserId = selectedAgentId;
    await member.save();

    try {
      return await updateAgentMember({
        agentId: selectedAgentId,
        memberId,
        payload
      });
    } catch (error) {
      member.agentId = null;
      member.parentUserId = previousParentUserId;
      await member.save();
      throw error;
    }
  }

  let detail = await updateAgentMember({
    agentId: currentAgentId,
    memberId,
    payload
  });

  if (selectedAgentId !== currentAgentId) {
    member.agentId = selectedAgentId;
    member.parentUserId = selectedAgentId;
    await member.save();

    detail = await updateAgentMember({
      agentId: selectedAgentId,
      memberId,
      payload: {}
    });
  }

  return detail;
};

const deactivateAgentMember = async ({ agentId, memberId }) => {
  const member = await User.findOne({ _id: memberId, agentId, role: 'customer' });
  if (!member) {
    throw new Error('Member not found');
  }

  member.isActive = false;
  member.status = 'inactive';
  await member.save();

  return member;
};

module.exports = {
  ONLINE_WINDOW_MS,
  DEFAULT_LIMITS,
  isUserOnline,
  getAgentMemberBootstrap,
  getAdminMemberBootstrap,
  getAgentMembers,
  getAgentMemberDetail,
  getAdminMemberDetail,
  createAgentMember,
  createAdminMember,
  updateAgentMember,
  updateAdminMember,
  deactivateAgentMember,
  getMemberLotteryAccess,
  searchMembersForBetting,
  getMemberForBettingActor,
  getMemberConfigRows,
  normalizeEnabledBetTypes
};
