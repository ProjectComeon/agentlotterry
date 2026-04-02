const mongoose = require('mongoose');
const BettingDraftSession = require('../models/BettingDraftSession');
const { BET_TYPES } = require('../constants/betting');
const { getMemberForBettingActor } = require('./memberManagementService');

const MAX_MEMO_LENGTH = 200;
const MAX_RAW_INPUT_LENGTH = 8000;
const MAX_SAVED_ENTRIES = 50;
const MAX_GRID_ROWS = 50;
const MAX_ENTRY_ITEMS = 500;

const toText = (value, maxLength = MAX_MEMO_LENGTH) => String(value || '').trim().slice(0, maxLength);
const toDigits = (value) => String(value || '').replace(/\D/g, '');
const toAmount = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const ensureScopeIds = ({ customerId, lotteryId, roundId, rateProfileId }) => {
  const requiredIds = { customerId, lotteryId, roundId };
  Object.entries(requiredIds).forEach(([key, value]) => {
    if (!mongoose.Types.ObjectId.isValid(String(value || ''))) {
      throw new Error(`Invalid ${key}`);
    }
  });

  if (rateProfileId && !mongoose.Types.ObjectId.isValid(String(rateProfileId))) {
    throw new Error('Invalid rateProfileId');
  }
};

const sanitizeGridAmounts = (value = {}) => ({
  top: value?.top ? String(value.top).trim() : '',
  bottom: value?.bottom ? String(value.bottom).trim() : '',
  tod: value?.tod ? String(value.tod).trim() : ''
});

const sanitizeGridRows = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .slice(0, MAX_GRID_ROWS)
    .map((row) => ({
      id: toText(row?.id, 80) || new mongoose.Types.ObjectId().toString(),
      number: toDigits(row?.number),
      amounts: sanitizeGridAmounts(row?.amounts)
    }));

const sanitizeComposer = (value = {}) => {
  if (value?.mode === 'grid') {
    return {
      mode: 'grid',
      digitMode: value?.digitMode === '3' ? '3' : '2',
      gridRows: sanitizeGridRows(value?.gridRows),
      gridBulkAmounts: sanitizeGridAmounts(value?.gridBulkAmounts),
      memo: toText(value?.memo)
    };
  }

  return {
    mode: 'fast',
    fastFamily: ['2', '3', 'run'].includes(value?.fastFamily) ? value.fastFamily : '2',
    fastAmounts: sanitizeGridAmounts(value?.fastAmounts),
    rawInput: String(value?.rawInput || '').slice(0, MAX_RAW_INPUT_LENGTH),
    reverse: Boolean(value?.reverse),
    includeDoubleSet: Boolean(value?.includeDoubleSet),
    memo: toText(value?.memo)
  };
};

const sanitizePreviewItem = (item = {}) => {
  const betType = String(item?.betType || '').trim();
  if (!BET_TYPES.includes(betType)) return null;

  const amount = toAmount(item?.amount);
  const number = toDigits(item?.number);
  if (!amount || !number) return null;

  return {
    betType,
    number,
    amount,
    sourceFlags: {
      fromReverse: Boolean(item?.sourceFlags?.fromReverse),
      fromDoubleSet: Boolean(item?.sourceFlags?.fromDoubleSet)
    }
  };
};

const sanitizeSavedEntries = (entries = []) =>
  (Array.isArray(entries) ? entries : [])
    .slice(0, MAX_SAVED_ENTRIES)
    .map((entry) => {
      const items = (Array.isArray(entry?.items) ? entry.items : [])
        .map(sanitizePreviewItem)
        .filter(Boolean)
        .slice(0, MAX_ENTRY_ITEMS);

      if (!items.length) return null;

      return {
        id: toText(entry?.id, 80) || new mongoose.Types.ObjectId().toString(),
        memo: toText(entry?.memo),
        source: sanitizeComposer(entry?.source),
        items
      };
    })
    .filter(Boolean);

const hasPersistableComposer = (composer = {}) => {
  if (composer.mode === 'grid') {
    const hasRows = (composer.gridRows || []).some((row) =>
      row.number ||
      row.amounts?.top ||
      row.amounts?.bottom ||
      row.amounts?.tod
    );

    return Boolean(
      hasRows ||
      composer.gridBulkAmounts?.top ||
      composer.gridBulkAmounts?.bottom ||
      composer.gridBulkAmounts?.tod ||
      composer.memo
    );
  }

  return Boolean(
    composer.rawInput ||
    composer.fastAmounts?.top ||
    composer.fastAmounts?.bottom ||
    composer.fastAmounts?.tod ||
    composer.memo ||
    composer.reverse ||
    composer.includeDoubleSet
  );
};

const getScopeFilter = ({ actorUser, customerId, lotteryId, roundId, rateProfileId }) => ({
  actorUserId: actorUser._id,
  actorRole: actorUser.role,
  customerId,
  lotteryTypeId: lotteryId,
  drawRoundId: roundId,
  rateProfileId: rateProfileId || null
});

const getDraftSession = async ({ actorUser, customerId, lotteryId, roundId, rateProfileId }) => {
  ensureScopeIds({ customerId, lotteryId, roundId, rateProfileId });
  await getMemberForBettingActor({
    actorId: actorUser._id,
    actorRole: actorUser.role,
    memberId: customerId
  });

  const session = await BettingDraftSession.findOne(
    getScopeFilter({ actorUser, customerId, lotteryId, roundId, rateProfileId })
  ).lean();

  return {
    sessionId: session?._id?.toString() || '',
    composer: session?.composer || null,
    savedEntries: session?.savedEntries || [],
    updatedAt: session?.updatedAt || null
  };
};

const saveDraftSession = async ({ actorUser, customerId, lotteryId, roundId, rateProfileId, composer, savedEntries }) => {
  ensureScopeIds({ customerId, lotteryId, roundId, rateProfileId });
  await getMemberForBettingActor({
    actorId: actorUser._id,
    actorRole: actorUser.role,
    memberId: customerId
  });

  const sanitizedComposer = sanitizeComposer(composer);
  const sanitizedEntries = sanitizeSavedEntries(savedEntries);
  const scopeFilter = getScopeFilter({ actorUser, customerId, lotteryId, roundId, rateProfileId });

  if (!sanitizedEntries.length && !hasPersistableComposer(sanitizedComposer)) {
    await BettingDraftSession.deleteOne(scopeFilter);
    return {
      cleared: true,
      composer: null,
      savedEntries: [],
      updatedAt: null
    };
  }

  const session = await BettingDraftSession.findOneAndUpdate(
    scopeFilter,
    {
      $set: {
        composer: sanitizedComposer,
        savedEntries: sanitizedEntries,
        lastTouchedAt: new Date()
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  ).lean();

  return {
    cleared: false,
    sessionId: session._id.toString(),
    composer: session.composer || null,
    savedEntries: session.savedEntries || [],
    updatedAt: session.updatedAt || null
  };
};

const clearDraftSession = async ({ actorUser, customerId, lotteryId, roundId, rateProfileId }) => {
  ensureScopeIds({ customerId, lotteryId, roundId, rateProfileId });
  await getMemberForBettingActor({
    actorId: actorUser._id,
    actorRole: actorUser.role,
    memberId: customerId
  });

  await BettingDraftSession.deleteOne(
    getScopeFilter({ actorUser, customerId, lotteryId, roundId, rateProfileId })
  );

  return { cleared: true };
};

module.exports = {
  getDraftSession,
  saveDraftSession,
  clearDraftSession
};
