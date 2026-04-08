const mongoose = require('mongoose');
const CreditLedgerEntry = require('../models/CreditLedgerEntry');
const User = require('../models/User');

const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';
const toMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const makeGroupId = (prefix = 'CRD') => `${prefix}-${new mongoose.Types.ObjectId().toString()}`;

const assertWalletViewerAccess = (viewer, targetUser) => {
  if (!viewer || !targetUser) {
    throw new Error('Wallet access could not be resolved');
  }

  const viewerId = toIdString(viewer);
  const targetId = toIdString(targetUser);

  if (viewer.role === 'admin') {
    return;
  }

  if (viewer.role === 'agent') {
    if (viewerId === targetId) {
      return;
    }

    if (targetUser.role === 'customer' && toIdString(targetUser.agentId) === viewerId) {
      return;
    }
  }

  if (viewer.role === 'customer' && viewerId === targetId) {
    return;
  }

  throw new Error('You do not have access to this wallet');
};

const serializeUserRef = (user) => {
  if (!user) return null;

  return {
    id: toIdString(user),
    username: user.username || '',
    name: user.name || '',
    role: user.role || '',
    displayRole: user.displayRole || (user.role === 'customer' ? 'member' : user.role || '')
  };
};

const serializeLedgerEntry = (entry) => ({
  id: toIdString(entry),
  groupId: entry.groupId,
  entryType: entry.entryType,
  direction: entry.direction,
  amount: entry.amount,
  balanceBefore: entry.balanceBefore,
  balanceAfter: entry.balanceAfter,
  reasonCode: entry.reasonCode || '',
  note: entry.note || '',
  user: serializeUserRef(entry.userId),
  counterparty: serializeUserRef(entry.counterpartyUserId),
  performedBy: serializeUserRef(entry.performedByUserId),
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt
});

const createLedgerEntryPayload = ({
  groupId,
  entryType,
  direction,
  user,
  counterpartyUser,
  performedByUser,
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
  userId: user._id,
  counterpartyUserId: counterpartyUser?._id || null,
  performedByUserId: performedByUser._id,
  performedByRole: performedByUser.role,
  amount,
  balanceBefore,
  balanceAfter,
  reasonCode,
  note,
  metadata
});

const loadUserForWallet = async (userId, session = null) => {
  const query = User.findById(userId).select('-password');
  if (session) query.session(session);
  return query;
};

const runWalletTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let output = null;
    await session.withTransaction(async () => {
      output = await work(session);
    });
    return output;
  } finally {
    await session.endSession();
  }
};

const getWalletSummary = async ({ viewer, targetUserId = '' }) => {
  const resolvedTargetId = targetUserId || viewer._id;
  const targetUser = await loadUserForWallet(resolvedTargetId);

  if (!targetUser) {
    throw new Error('Wallet account not found');
  }

  assertWalletViewerAccess(viewer, targetUser);

  const [totals, recentEntries] = await Promise.all([
    CreditLedgerEntry.aggregate([
      { $match: { userId: targetUser._id } },
      {
        $group: {
          _id: null,
          totalCreditIn: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0]
            }
          },
          totalCreditOut: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'debit'] }, '$amount', 0]
            }
          },
          transactionCount: { $sum: 1 }
        }
      }
    ]),
    CreditLedgerEntry.find({ userId: targetUser._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'username name role displayRole')
      .populate('counterpartyUserId', 'username name role displayRole')
      .populate('performedByUserId', 'username name role displayRole')
  ]);

  const rollup = totals[0] || {
    totalCreditIn: 0,
    totalCreditOut: 0,
    transactionCount: 0
  };

  return {
    account: {
      id: toIdString(targetUser),
      username: targetUser.username,
      name: targetUser.name,
      role: targetUser.role,
      displayRole: targetUser.displayRole || (targetUser.role === 'customer' ? 'member' : targetUser.role),
      creditBalance: toMoney(targetUser.creditBalance),
      status: targetUser.status,
      isActive: targetUser.isActive
    },
    totals: {
      totalCreditIn: toMoney(rollup.totalCreditIn),
      totalCreditOut: toMoney(rollup.totalCreditOut),
      transactionCount: rollup.transactionCount || 0,
      netFlow: toMoney(rollup.totalCreditIn) - toMoney(rollup.totalCreditOut)
    },
    recentEntries: recentEntries.map(serializeLedgerEntry)
  };
};

const getWalletHistory = async ({
  viewer,
  targetUserId = '',
  limit = 50,
  direction = '',
  entryType = ''
}) => {
  const resolvedTargetId = targetUserId || viewer._id;
  const targetUser = await loadUserForWallet(resolvedTargetId);

  if (!targetUser) {
    throw new Error('Wallet account not found');
  }

  assertWalletViewerAccess(viewer, targetUser);

  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const filter = {
    userId: targetUser._id
  };

  if (direction && ['credit', 'debit'].includes(direction)) {
    filter.direction = direction;
  }

  if (entryType && ['transfer', 'adjustment', 'settlement'].includes(entryType)) {
    filter.entryType = entryType;
  }

  const entries = await CreditLedgerEntry.find(filter)
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .populate('userId', 'username name role displayRole')
    .populate('counterpartyUserId', 'username name role displayRole')
    .populate('performedByUserId', 'username name role displayRole');

  return entries.map(serializeLedgerEntry);
};

const adjustCreditBalance = async ({
  actorUserId,
  targetUserId,
  amount,
  note = '',
  reasonCode = 'admin_adjustment'
}) => {
  const delta = toMoney(amount);
  if (!delta) {
    throw new Error('Adjustment amount is required');
  }

  const actorUser = await loadUserForWallet(actorUserId);
  if (!actorUser || actorUser.role !== 'admin') {
    throw new Error('Only admin can adjust wallet balances');
  }

  return runWalletTransaction(async (session) => {
    const [actor, targetUser] = await Promise.all([
      loadUserForWallet(actorUserId, session),
      loadUserForWallet(targetUserId, session)
    ]);

    if (!targetUser) {
      throw new Error('Wallet account not found');
    }

    const currentBalance = toMoney(targetUser.creditBalance);
    const nextBalance = currentBalance + delta;
    if (nextBalance < 0) {
      throw new Error('Adjustment would make the balance negative');
    }

    targetUser.creditBalance = nextBalance;
    await targetUser.save({ session });

    const groupId = makeGroupId('ADJ');
    const [entry] = await CreditLedgerEntry.insertMany([
      createLedgerEntryPayload({
        groupId,
        entryType: 'adjustment',
        direction: delta >= 0 ? 'credit' : 'debit',
        user: targetUser,
        counterpartyUser: null,
        performedByUser: actor,
        amount: Math.abs(delta),
        balanceBefore: currentBalance,
        balanceAfter: nextBalance,
        reasonCode,
        note,
        metadata: {
          targetRole: targetUser.role
        }
      })
    ], { session });

    await entry.populate('userId', 'username name role displayRole');
    await entry.populate('performedByUserId', 'username name role displayRole');

    return {
      groupId,
      account: {
        id: toIdString(targetUser),
        creditBalance: nextBalance
      },
      entry: serializeLedgerEntry(entry)
    };
  });
};

const transferCredit = async ({
  actorUserId,
  memberId,
  amount,
  direction,
  note = ''
}) => {
  const transferAmount = toMoney(amount);
  if (!transferAmount || transferAmount <= 0) {
    throw new Error('Transfer amount must be greater than zero');
  }

  if (!['to_member', 'from_member'].includes(direction)) {
    throw new Error('Transfer direction is invalid');
  }

  const actorUser = await loadUserForWallet(actorUserId);
  if (!actorUser || actorUser.role !== 'agent') {
    throw new Error('Only agents can transfer member credit');
  }

  return runWalletTransaction(async (session) => {
    const [agent, member] = await Promise.all([
      loadUserForWallet(actorUserId, session),
      loadUserForWallet(memberId, session)
    ]);

    if (!member || member.role !== 'customer' || toIdString(member.agentId) !== toIdString(agent)) {
      throw new Error('Member not found for this agent');
    }

    const debitUser = direction === 'to_member' ? agent : member;
    const creditUser = direction === 'to_member' ? member : agent;

    const debitBefore = toMoney(debitUser.creditBalance);
    const creditBefore = toMoney(creditUser.creditBalance);

    if (debitBefore < transferAmount) {
      throw new Error('Insufficient credit balance for this transfer');
    }

    const debitAfter = debitBefore - transferAmount;
    const creditAfter = creditBefore + transferAmount;

    debitUser.creditBalance = debitAfter;
    creditUser.creditBalance = creditAfter;
    await Promise.all([
      debitUser.save({ session }),
      creditUser.save({ session })
    ]);

    const groupId = makeGroupId('TRF');
    const createdEntries = await CreditLedgerEntry.insertMany([
      createLedgerEntryPayload({
        groupId,
        entryType: 'transfer',
        direction: 'debit',
        user: debitUser,
        counterpartyUser: creditUser,
        performedByUser: agent,
        amount: transferAmount,
        balanceBefore: debitBefore,
        balanceAfter: debitAfter,
        reasonCode: direction,
        note,
        metadata: {
          memberId: member._id.toString()
        }
      }),
      createLedgerEntryPayload({
        groupId,
        entryType: 'transfer',
        direction: 'credit',
        user: creditUser,
        counterpartyUser: debitUser,
        performedByUser: agent,
        amount: transferAmount,
        balanceBefore: creditBefore,
        balanceAfter: creditAfter,
        reasonCode: direction,
        note,
        metadata: {
          memberId: member._id.toString()
        }
      })
    ], { session });

    await CreditLedgerEntry.populate(createdEntries, [
      { path: 'userId', select: 'username name role displayRole' },
      { path: 'counterpartyUserId', select: 'username name role displayRole' },
      { path: 'performedByUserId', select: 'username name role displayRole' }
    ]);

    return {
      groupId,
      direction,
      amount: transferAmount,
      agent: {
        id: toIdString(agent),
        creditBalance: direction === 'to_member' ? debitAfter : creditAfter
      },
      member: {
        id: toIdString(member),
        creditBalance: direction === 'to_member' ? creditAfter : debitAfter
      },
      entries: createdEntries.map(serializeLedgerEntry)
    };
  });
};

module.exports = {
  getWalletSummary,
  getWalletHistory,
  adjustCreditBalance,
  transferCredit
};
