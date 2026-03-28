const LotteryType = require('../models/LotteryType');
const RateProfile = require('../models/RateProfile');
const User = require('../models/User');
const UserLotteryConfig = require('../models/UserLotteryConfig');
const {
  getBetTotals,
  getTotalsGroupedByField
} = require('./analyticsService');

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const BET_TYPES = ['3top', '3tod', '2top', '2bottom', 'run_top', 'run_bottom'];
const DEFAULT_LIMITS = {
  minimumBet: 1,
  maximumBet: 10000,
  maximumPerNumber: 10000,
  keepMode: 'off',
  keepCapAmount: 0
};

const toText = (value) => String(value || '').trim();
const toOptionalCode = (value) => {
  const normalized = toText(value).toUpperCase();
  return normalized || null;
};
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
const normalizeCustomRates = (value = {}, fallbackRates = {}) =>
  BET_TYPES.reduce((acc, betType) => {
    const nextValue = toPositiveAmount(value?.[betType], fallbackRates?.[betType] || 0);
    acc[betType] = nextValue;
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
    .populate('rateProfileIds', 'code name description isActive rates')
    .populate('defaultRateProfileId', 'code name description isActive rates');

const ensureMemberCodeAvailability = async (memberCode, excludeUserId = null) => {
  if (!memberCode) return;

  const existing = await User.findOne({
    memberCode,
    ...(excludeUserId && { _id: { $ne: excludeUserId } })
  }).select('_id');

  if (existing) {
    throw new Error('Member code already exists');
  }
};

const generateMemberCode = async (agentId) => {
  const suffix = String(agentId).slice(-4).toUpperCase();

  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `MBR-${suffix}-${String(Date.now() + attempt).slice(-6)}`;
    const exists = await User.exists({ memberCode: candidate });
    if (!exists) {
      return candidate;
    }
  }

  return `MBR-${suffix}-${Math.random().toString().slice(2, 8)}`;
};

const normalizeEnabledBetTypes = (value, supportedBetTypes) => {
  if (!Array.isArray(value) || !value.length) {
    return supportedBetTypes;
  }

  const nextTypes = supportedBetTypes.filter((betType) => value.includes(betType));
  return nextTypes.length ? nextTypes : supportedBetTypes;
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

  if (requestedRateProfileId && !allowedRateIds.includes(requestedRateProfileId)) {
    throw new Error(`Rate profile is not allowed for ${lottery.name}`);
  }

  return requestedRateProfileId;
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
    customRates: normalizeCustomRates(
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
  rates: profile.rates,
  isDefault: Boolean(profile.isDefault)
});

const mapLotteryConfigRow = ({ lottery, config }) => {
  const allowedProfiles = (lottery.rateProfileIds || []).filter((profile) => profile.isActive);
  const activeRateProfiles = allowedProfiles;
  const selectedRateProfileId =
    config?.rateProfileId?.toString() ||
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
    customRates: normalizeCustomRates(
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

  const enforcedRateProfileId = config.rateProfileId?.toString() || '';
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
  memberCode: member.memberCode || '',
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
  const [agent, lotteries, rateProfiles] = await Promise.all([
    User.findById(agentId).select('name creditBalance stockPercent ownerPercent keepPercent commissionRate'),
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
      id: agent?._id?.toString() || agentId.toString(),
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

const getAgentMembers = async ({ agentId, search = '', status = '', online = '' }) => {
  const filter = { agentId, role: 'customer' };
  const searchText = toText(search);

  if (searchText) {
    const regex = new RegExp(searchText, 'i');
    filter.$or = [
      { name: regex },
      { username: regex },
      { phone: regex },
      { memberCode: regex }
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

  const memberCode = toOptionalCode(account.memberCode || profile.memberCode) || await generateMemberCode(agentId);
  await ensureMemberCodeAvailability(memberCode);

  if (initialCreditBalance > 0) {
    throw new Error('Create the member first, then add credit from the wallet flow');
  }

  const member = await User.create({
    username,
    password,
    role: 'customer',
    displayRole: 'member',
    name,
    memberCode,
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

  if (account.memberCode !== undefined || profile.memberCode !== undefined) {
    const memberCode = toOptionalCode(account.memberCode || profile.memberCode);
    await ensureMemberCodeAvailability(memberCode, member._id);
    member.memberCode = memberCode;
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
  getAgentMembers,
  getAgentMemberDetail,
  createAgentMember,
  updateAgentMember,
  deactivateAgentMember,
  getMemberLotteryAccess,
  getMemberConfigRows
};
