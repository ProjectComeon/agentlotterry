const mongoose = require('mongoose');
const BetItem = require('../models/BetItem');
const CreditLedgerEntry = require('../models/CreditLedgerEntry');
const NotificationEvent = require('../models/NotificationEvent');
const PendingPayout = require('../models/PendingPayout');
const User = require('../models/User');

const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';
const toMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const makeGroupId = (prefix) => `${prefix}-${new mongoose.Types.ObjectId().toString()}`;
const makePayoutId = () => `PP-${new mongoose.Types.ObjectId().toString()}`;

const buildSlipMetadata = (slip, extra = {}) => ({
  slipId: toIdString(slip?._id || slip?.slipId),
  slipNumber: slip?.slipNumber || '',
  lotteryTypeId: toIdString(slip?.lotteryTypeId),
  lotteryCode: slip?.lotteryCode || '',
  roundId: toIdString(slip?.drawRoundId || slip?.roundId),
  roundCode: slip?.roundCode || '',
  agentId: toIdString(slip?.agentId),
  ...extra
});

const buildItemMetadata = ({ item, round, record, extra = {} }) => ({
  roundId: toIdString(round?._id || item?.drawRoundId),
  roundCode: round?.code || item?.roundCode || '',
  resultRecordId: toIdString(record?._id),
  slipId: toIdString(item?.slipId),
  betItemId: toIdString(item?._id),
  customerId: toIdString(item?.customerId),
  agentId: toIdString(item?.agentId),
  betType: item?.betType || '',
  number: item?.number || '',
  ...extra
});

const createLedgerPayload = ({
  groupId,
  entryType,
  direction,
  userId,
  counterpartyUserId = null,
  performedByUserId = null,
  performedByRole = 'system',
  amount,
  balanceBefore,
  balanceAfter,
  reasonCode,
  note,
  metadata = {}
}) => ({
  groupId,
  entryType,
  direction,
  userId,
  counterpartyUserId,
  performedByUserId,
  performedByRole,
  amount: Math.abs(toMoney(amount)),
  balanceBefore: toMoney(balanceBefore),
  balanceAfter: toMoney(balanceAfter),
  reasonCode,
  note,
  metadata
});

const insertNotificationEvents = async ({ type, agentId, customerId, payout, session }) => {
  const payoutAmount = toMoney(payout?.payoutAmount || payout?.amount || 0);
  const payloads = [
    {
      type,
      recipientRole: 'admin',
      recipientUserId: null,
      agentId,
      customerId,
      title: type === 'agent_pending_payout_paid' ? 'Pending payout paid' : 'Agent credit is insufficient',
      message: type === 'agent_pending_payout_paid'
        ? `Pending payout ${payoutAmount} was paid automatically`
        : `Agent needs ${payoutAmount} credit to pay a member payout`,
      metadata: {
        payoutId: payout?.payoutId || '',
        payoutAmount,
        pendingPayoutId: toIdString(payout?._id)
      }
    },
    {
      type,
      recipientRole: 'agent',
      recipientUserId: agentId,
      agentId,
      customerId,
      title: type === 'agent_pending_payout_paid' ? 'Member payout paid' : 'Member payout is waiting',
      message: type === 'agent_pending_payout_paid'
        ? `System paid member payout ${payoutAmount} automatically`
        : `A member payout of ${payoutAmount} is waiting for credit`,
      metadata: {
        payoutId: payout?.payoutId || '',
        payoutAmount,
        pendingPayoutId: toIdString(payout?._id)
      }
    }
  ];

  await NotificationEvent.insertMany(payloads, { session });
};

const holdAgentStake = async ({ agentId, customerId, slip, amount, actor, session }) => {
  const stakeAmount = toMoney(amount);
  if (stakeAmount <= 0) return null;

  const agentBefore = await User.findOneAndUpdate(
    { _id: agentId, role: 'agent' },
    { $inc: { heldStakeBalance: stakeAmount } },
    { session, new: false }
  ).select('_id heldStakeBalance').lean();

  if (!agentBefore) {
    throw new Error('Agent not found for stake hold');
  }

  const heldBefore = toMoney(agentBefore.heldStakeBalance);
  const heldAfter = heldBefore + stakeAmount;
  const groupId = makeGroupId('AGHOLD');

  await CreditLedgerEntry.insertMany([
    createLedgerPayload({
      groupId,
      entryType: 'bet',
      direction: 'credit',
      userId: agentId,
      counterpartyUserId: customerId,
      performedByUserId: actor?._id || null,
      performedByRole: actor?.role || 'system',
      amount: stakeAmount,
      balanceBefore: heldBefore,
      balanceAfter: heldAfter,
      reasonCode: 'agent_stake_hold_credit',
      note: `Hold stake for slip ${slip.slipNumber}`,
      metadata: buildSlipMetadata(slip, { balanceField: 'heldStakeBalance' })
    })
  ], { session });

  return { groupId, heldBefore, heldAfter };
};

const reverseAgentStakeHold = async ({ slip, actorUser = null, session }) => {
  const slipId = toIdString(slip?._id);
  const holdEntry = await CreditLedgerEntry.findOne({
    userId: slip.agentId,
    entryType: 'bet',
    direction: 'credit',
    reasonCode: 'agent_stake_hold_credit',
    'metadata.slipId': slipId
  }).session(session).lean();

  if (!holdEntry) return null;

  const existingReverse = await CreditLedgerEntry.findOne({
    userId: slip.agentId,
    entryType: 'bet',
    direction: 'debit',
    reasonCode: 'agent_stake_hold_reversal',
    'metadata.slipId': slipId
  }).session(session).lean();

  if (existingReverse) return null;

  const stakeAmount = toMoney(holdEntry.amount);
  const agentBefore = await User.findOneAndUpdate(
    { _id: slip.agentId, role: 'agent', heldStakeBalance: { $gte: stakeAmount } },
    { $inc: { heldStakeBalance: -stakeAmount } },
    { session, new: false }
  ).select('_id heldStakeBalance').lean();

  if (!agentBefore) {
    throw new Error('Agent held stake is insufficient for cancel reversal');
  }

  const heldBefore = toMoney(agentBefore.heldStakeBalance);
  const heldAfter = heldBefore - stakeAmount;
  const groupId = makeGroupId('AGHREV');

  await CreditLedgerEntry.insertMany([
    createLedgerPayload({
      groupId,
      entryType: 'bet',
      direction: 'debit',
      userId: slip.agentId,
      counterpartyUserId: slip.customerId,
      performedByUserId: actorUser?._id || slip.placedByUserId || null,
      performedByRole: actorUser?.role || slip.placedByRole || 'system',
      amount: stakeAmount,
      balanceBefore: heldBefore,
      balanceAfter: heldAfter,
      reasonCode: 'agent_stake_hold_reversal',
      note: `Reverse held stake for cancelled slip ${slip.slipNumber}`,
      metadata: buildSlipMetadata(slip, {
        balanceField: 'heldStakeBalance',
        reversedFromGroupId: holdEntry.groupId
      })
    })
  ], { session });

  return { groupId, heldBefore, heldAfter };
};

const releaseAgentStakeToAvailable = async ({ item, round, record, session }) => {
  const stakeAmount = toMoney(item.amount);
  if (stakeAmount <= 0) return null;

  const agentBefore = await User.findOneAndUpdate(
    { _id: item.agentId, role: 'agent', heldStakeBalance: { $gte: stakeAmount } },
    { $inc: { heldStakeBalance: -stakeAmount, creditBalance: stakeAmount } },
    { session, new: false }
  ).select('_id creditBalance heldStakeBalance').lean();

  if (!agentBefore) {
    throw new Error('Agent held stake is insufficient for settlement release');
  }

  const availableBefore = toMoney(agentBefore.creditBalance);
  const availableAfter = availableBefore + stakeAmount;
  const heldBefore = toMoney(agentBefore.heldStakeBalance);
  const groupId = makeGroupId('AGREL');

  await CreditLedgerEntry.insertMany([
    createLedgerPayload({
      groupId,
      entryType: 'settlement',
      direction: 'credit',
      userId: item.agentId,
      counterpartyUserId: item.customerId,
      performedByUserId: null,
      performedByRole: 'system',
      amount: stakeAmount,
      balanceBefore: availableBefore,
      balanceAfter: availableAfter,
      reasonCode: 'agent_stake_release_to_available',
      note: `Release held stake for round ${round.code}`,
      metadata: buildItemMetadata({
        item,
        round,
        record,
        extra: {
          balanceField: 'creditBalance',
          heldBefore,
          heldAfter: heldBefore - stakeAmount
        }
      })
    })
  ], { session });

  return { groupId, availableBefore, availableAfter };
};

const reverseAgentStakeReleaseToHeld = async ({ item, round, session }) => {
  const stakeAmount = toMoney(item.amount);
  if (stakeAmount <= 0) return null;

  const agentBefore = await User.findOneAndUpdate(
    { _id: item.agentId, role: 'agent', creditBalance: { $gte: stakeAmount } },
    { $inc: { heldStakeBalance: stakeAmount, creditBalance: -stakeAmount } },
    { session, new: false }
  ).select('_id creditBalance heldStakeBalance').lean();

  if (!agentBefore) {
    throw new Error('Agent available credit is insufficient to reverse settlement stake release');
  }

  const availableBefore = toMoney(agentBefore.creditBalance);
  const availableAfter = availableBefore - stakeAmount;
  const heldBefore = toMoney(agentBefore.heldStakeBalance);
  const groupId = makeGroupId('AGRREV');

  await CreditLedgerEntry.insertMany([
    createLedgerPayload({
      groupId,
      entryType: 'settlement',
      direction: 'debit',
      userId: item.agentId,
      counterpartyUserId: item.customerId,
      performedByUserId: null,
      performedByRole: 'system',
      amount: stakeAmount,
      balanceBefore: availableBefore,
      balanceAfter: availableAfter,
      reasonCode: 'agent_stake_release_reversal',
      note: `Reverse stake release for round ${round.code}`,
      metadata: buildItemMetadata({
        item,
        round,
        extra: {
          balanceField: 'creditBalance',
          heldBefore,
          heldAfter: heldBefore + stakeAmount
        }
      })
    })
  ], { session });

  return { groupId, availableBefore, availableAfter };
};

const payPayoutFromAgent = async ({ item, round, record, amount, session, pendingPayout = null }) => {
  const payoutAmount = toMoney(amount);
  if (payoutAmount <= 0) return null;

  const agentBefore = await User.findOneAndUpdate(
    { _id: item.agentId, role: 'agent', creditBalance: { $gte: payoutAmount } },
    { $inc: { creditBalance: -payoutAmount } },
    { session, new: false }
  ).select('_id creditBalance').lean();

  if (!agentBefore) return null;

  const memberBefore = await User.findOneAndUpdate(
    { _id: item.customerId, role: 'customer' },
    { $inc: { creditBalance: payoutAmount } },
    { session, new: false }
  ).select('_id creditBalance').lean();

  if (!memberBefore) {
    throw new Error('Member not found for payout credit');
  }

  const agentBalanceBefore = toMoney(agentBefore.creditBalance);
  const memberBalanceBefore = toMoney(memberBefore.creditBalance);
  const groupId = makeGroupId('PAYOUT');
  const metadata = buildItemMetadata({
    item,
    round,
    record,
    extra: {
      pendingPayoutId: toIdString(pendingPayout?._id),
      payoutId: pendingPayout?.payoutId || ''
    }
  });

  await CreditLedgerEntry.insertMany([
    createLedgerPayload({
      groupId,
      entryType: 'settlement',
      direction: 'debit',
      userId: item.agentId,
      counterpartyUserId: item.customerId,
      performedByUserId: null,
      performedByRole: 'system',
      amount: payoutAmount,
      balanceBefore: agentBalanceBefore,
      balanceAfter: agentBalanceBefore - payoutAmount,
      reasonCode: 'agent_payout_debit',
      note: `Prize payout debit for round ${round.code}`,
      metadata
    }),
    createLedgerPayload({
      groupId,
      entryType: 'settlement',
      direction: 'credit',
      userId: item.customerId,
      counterpartyUserId: item.agentId,
      performedByUserId: null,
      performedByRole: 'system',
      amount: payoutAmount,
      balanceBefore: memberBalanceBefore,
      balanceAfter: memberBalanceBefore + payoutAmount,
      reasonCode: 'member_payout_credit',
      note: `Prize payout for round ${round.code}`,
      metadata
    })
  ], { session });

  return { groupId, payoutAmount };
};

const reversePaidPayoutToAgent = async ({ item, round, amount, session }) => {
  const payoutAmount = toMoney(amount);
  if (payoutAmount <= 0) return null;

  const memberBefore = await User.findOneAndUpdate(
    { _id: item.customerId, role: 'customer' },
    { $inc: { creditBalance: -payoutAmount } },
    { session, new: false }
  ).select('_id creditBalance').lean();

  if (!memberBefore) {
    throw new Error('Member not found for payout rollback');
  }

  const agentBefore = await User.findOneAndUpdate(
    { _id: item.agentId, role: 'agent' },
    { $inc: { creditBalance: payoutAmount } },
    { session, new: false }
  ).select('_id creditBalance').lean();

  if (!agentBefore) {
    throw new Error('Agent not found for payout rollback');
  }

  const memberBalanceBefore = toMoney(memberBefore.creditBalance);
  const agentBalanceBefore = toMoney(agentBefore.creditBalance);
  const groupId = makeGroupId('PAYREV');
  const metadata = buildItemMetadata({
    item,
    round,
    extra: {
      reversedAppliedAmount: payoutAmount,
      reversedFromGroupId: item.payoutLedgerGroupId || ''
    }
  });

  await CreditLedgerEntry.insertMany([
    createLedgerPayload({
      groupId,
      entryType: 'settlement',
      direction: 'debit',
      userId: item.customerId,
      counterpartyUserId: item.agentId,
      performedByUserId: null,
      performedByRole: 'system',
      amount: payoutAmount,
      balanceBefore: memberBalanceBefore,
      balanceAfter: memberBalanceBefore - payoutAmount,
      reasonCode: 'bet_result_rollback',
      note: `Settlement rollback for round ${round.code}`,
      metadata
    }),
    createLedgerPayload({
      groupId,
      entryType: 'settlement',
      direction: 'credit',
      userId: item.agentId,
      counterpartyUserId: item.customerId,
      performedByUserId: null,
      performedByRole: 'system',
      amount: payoutAmount,
      balanceBefore: agentBalanceBefore,
      balanceAfter: agentBalanceBefore + payoutAmount,
      reasonCode: 'agent_payout_reversal',
      note: `Prize payout reversal for round ${round.code}`,
      metadata
    })
  ], { session });

  return { groupId, payoutAmount };
};

const createPendingPayoutForItem = async ({ item, round, record, amount, session }) => {
  const payoutAmount = toMoney(amount);
  if (payoutAmount <= 0) return null;

  const existing = await PendingPayout.findOne({
    betItemId: item._id,
    status: 'pending'
  }).session(session);

  if (existing) {
    const nextMetadata = buildItemMetadata({ item, round, record });
    const amountChanged = toMoney(existing.payoutAmount) !== payoutAmount;
    existing.payoutAmount = payoutAmount;
    existing.metadata = {
      ...(existing.metadata || {}),
      ...nextMetadata,
      updatedBySettlement: amountChanged || Boolean(existing.metadata?.updatedBySettlement)
    };
    if (amountChanged) {
      await existing.save({ session });
    }
    item.payoutStatus = 'pending';
    item.pendingPayoutId = existing._id;
    return existing;
  }

  const [payout] = await PendingPayout.create([{
    payoutId: makePayoutId(),
    betSlipId: item.slipId,
    betItemId: item._id,
    roundId: item.drawRoundId,
    customerId: item.customerId,
    agentId: item.agentId,
    payoutAmount,
    status: 'pending',
    reason: 'agent_insufficient_credit',
    metadata: buildItemMetadata({ item, round, record })
  }], { session });

  await insertNotificationEvents({
    type: 'agent_pending_payout_created',
    agentId: item.agentId,
    customerId: item.customerId,
    payout,
    session
  });

  item.payoutStatus = 'pending';
  item.pendingPayoutId = payout._id;
  return payout;
};

const cancelPendingPayoutForItem = async ({ item, session, reason = 'settlement_reversed' }) => {
  const payout = await PendingPayout.findOneAndUpdate(
    {
      betItemId: item._id,
      status: 'pending'
    },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason
      }
    },
    { session, new: true }
  );

  return payout;
};

const cancelLinkedPaidPayout = async ({ item, session, reason = 'settlement_reversed' }) => {
  if (!item.pendingPayoutId) return null;

  return PendingPayout.findOneAndUpdate(
    {
      _id: item.pendingPayoutId,
      status: 'paid'
    },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason
      }
    },
    { session, new: true }
  );
};

const processAgentPendingPayouts = async ({ agentId, session }) => {
  const pendingPayouts = await PendingPayout.find({
    agentId,
    status: 'pending'
  }).sort({ createdAt: 1, _id: 1 }).session(session);

  const summary = {
    paidCount: 0,
    paidAmount: 0,
    skippedCount: 0,
    ledgerGroupIds: []
  };

  for (const payout of pendingPayouts) {
    const agent = await User.findById(agentId).select('_id creditBalance').session(session).lean();
    if (!agent || toMoney(agent.creditBalance) < toMoney(payout.payoutAmount)) {
      summary.skippedCount += 1;
      break;
    }

    const item = await BetItem.findById(payout.betItemId).session(session);
    if (!item || item.payoutStatus !== 'pending' || toMoney(item.payoutAppliedAmount) !== 0) {
      payout.status = 'failed';
      payout.cancellationReason = 'bet_item_not_payable';
      await payout.save({ session });
      summary.skippedCount += 1;
      continue;
    }

    const payment = await payPayoutFromAgent({
      item,
      round: { _id: payout.roundId, code: payout.metadata?.roundCode || '' },
      record: null,
      amount: payout.payoutAmount,
      session,
      pendingPayout: payout
    });

    if (!payment) {
      summary.skippedCount += 1;
      break;
    }

    item.payoutAppliedAmount = toMoney(payout.payoutAmount);
    item.payoutLedgerGroupId = payment.groupId;
    item.payoutUpdatedAt = new Date();
    item.payoutStatus = 'paid';
    item.pendingPayoutId = payout._id;
    await item.save({ session });

    payout.status = 'paid';
    payout.paidAt = new Date();
    payout.ledgerGroupIds = [...(payout.ledgerGroupIds || []), payment.groupId];
    await payout.save({ session });

    await insertNotificationEvents({
      type: 'agent_pending_payout_paid',
      agentId: payout.agentId,
      customerId: payout.customerId,
      payout,
      session
    });

    summary.paidCount += 1;
    summary.paidAmount += toMoney(payout.payoutAmount);
    summary.ledgerGroupIds.push(payment.groupId);
  }

  return summary;
};

module.exports = {
  holdAgentStake,
  reverseAgentStakeHold,
  releaseAgentStakeToAvailable,
  reverseAgentStakeReleaseToHeld,
  payPayoutFromAgent,
  reversePaidPayoutToAgent,
  createPendingPayoutForItem,
  cancelPendingPayoutForItem,
  cancelLinkedPaidPayout,
  processAgentPendingPayouts
};