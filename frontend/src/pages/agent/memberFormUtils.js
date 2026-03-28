const cloneLotterySettings = (lotteries = [], defaults = {}) =>
  lotteries.map((lottery) => ({
    lotteryTypeId: lottery.lotteryTypeId,
    lotteryCode: lottery.lotteryCode,
    lotteryName: lottery.lotteryName,
    lotteryShortName: lottery.lotteryShortName,
    leagueName: lottery.leagueName,
    leagueCode: lottery.leagueCode,
    supportedBetTypes: [...(lottery.supportedBetTypes || [])],
    enabledBetTypes: [...(lottery.enabledBetTypes || lottery.supportedBetTypes || [])],
    isEnabled: lottery.isEnabled ?? true,
    rateProfileId: lottery.rateProfileId || lottery.availableRateProfiles?.[0]?.id || '',
    minimumBet: lottery.minimumBet ?? defaults.minimumBet ?? 1,
    maximumBet: lottery.maximumBet ?? defaults.maximumBet ?? 10000,
    maximumPerNumber: lottery.maximumPerNumber ?? defaults.maximumPerNumber ?? 10000,
    stockPercent: lottery.stockPercent ?? defaults.stockPercent ?? 0,
    ownerPercent: lottery.ownerPercent ?? defaults.ownerPercent ?? 0,
    keepPercent: lottery.keepPercent ?? defaults.keepPercent ?? 0,
    commissionRate: lottery.commissionRate ?? defaults.commissionRate ?? 0,
    useCustomRates: lottery.useCustomRates ?? defaults.useCustomRates ?? false,
    customRates: { ...(lottery.customRates || lottery.availableRateProfiles?.[0]?.rates || {}) },
    keepMode: lottery.keepMode ?? defaults.keepMode ?? 'off',
    keepCapAmount: lottery.keepCapAmount ?? defaults.keepCapAmount ?? 0,
    blockedNumbers: [...(lottery.blockedNumbers || [])],
    notes: lottery.notes || '',
    availableRateProfiles: [...(lottery.availableRateProfiles || [])]
  }));

export const createInitialMemberForm = (bootstrap) => {
  const defaults = bootstrap?.defaults || {};
  const defaultRateProfileId = bootstrap?.rateProfiles?.find((profile) => profile.isDefault)?.id ||
    bootstrap?.rateProfiles?.[0]?.id ||
    '';

  return {
    account: {
      username: '',
      password: '',
      name: '',
      phone: '',
      memberCode: ''
    },
    profile: {
      stockPercent: defaults.stockPercent ?? 0,
      ownerPercent: defaults.ownerPercent ?? 0,
      keepPercent: defaults.keepPercent ?? 0,
      commissionRate: defaults.commissionRate ?? 0,
      defaultRateProfileId,
      status: 'active',
      notes: ''
    },
    lotterySettings: cloneLotterySettings(bootstrap?.lotteries || [], defaults)
  };
};

export const createMemberFormFromDetail = (detail, bootstrap) => {
  const defaults = bootstrap?.defaults || {};

  return {
    account: {
      username: detail?.member?.username || '',
      password: '',
      name: detail?.member?.name || '',
      phone: detail?.member?.phone || '',
      memberCode: detail?.member?.memberCode || ''
    },
    profile: {
      stockPercent: detail?.member?.stockPercent ?? 0,
      ownerPercent: detail?.member?.ownerPercent ?? 0,
      keepPercent: detail?.member?.keepPercent ?? 0,
      commissionRate: detail?.member?.commissionRate ?? 0,
      defaultRateProfileId: detail?.member?.defaultRateProfileId || bootstrap?.rateProfiles?.find((profile) => profile.isDefault)?.id || '',
      status: detail?.member?.status || 'active',
      notes: detail?.member?.notes || ''
    },
    lotterySettings: cloneLotterySettings(detail?.lotteryConfigs || bootstrap?.lotteries || [], defaults)
  };
};

export const updateLotterySetting = (lotterySettings, lotteryTypeId, patch) =>
  lotterySettings.map((lottery) =>
    lottery.lotteryTypeId === lotteryTypeId
      ? { ...lottery, ...patch }
      : lottery
  );

export const toggleBetType = (lotterySettings, lotteryTypeId, betType) =>
  lotterySettings.map((lottery) => {
    if (lottery.lotteryTypeId !== lotteryTypeId) {
      return lottery;
    }

    const exists = lottery.enabledBetTypes.includes(betType);
    const nextTypes = exists
      ? lottery.enabledBetTypes.filter((item) => item !== betType)
      : [...lottery.enabledBetTypes, betType];

    return {
      ...lottery,
      enabledBetTypes: nextTypes.length ? nextTypes : [...lottery.supportedBetTypes]
    };
  });

export const groupLotterySettingsByLeague = (lotterySettings) =>
  lotterySettings.reduce((acc, lottery) => {
    const key = lottery.leagueName || 'Other';
    acc[key] = acc[key] || [];
    acc[key].push(lottery);
    return acc;
  }, {});
