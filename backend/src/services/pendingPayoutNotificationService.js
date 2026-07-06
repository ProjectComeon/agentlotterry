const mongoose = require('mongoose');
const NotificationEvent = require('../models/NotificationEvent');
const PendingPayout = require('../models/PendingPayout');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const PAYOUT_STATUSES = new Set(['pending', 'paid', 'cancelled', 'failed']);
const NOTIFICATION_STATUSES = new Set(['unread', 'read']);

const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || '';
const toNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const parseLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
};

const normalizeStatusFilter = ({ value, allowedStatuses, fallbackStatuses }) => {
  const status = String(value || '').trim().toLowerCase();
  if (!status || status === 'all') return { $in: fallbackStatuses };
  return allowedStatuses.has(status) ? status : { $in: fallbackStatuses };
};

const serializeUser = (user) => {
  if (!user) return null;
  return {
    id: toIdString(user),
    username: user.username || '',
    name: user.name || '',
    role: user.role || ''
  };
};

const serializeSlip = (slip) => {
  if (!slip) return null;
  return {
    id: toIdString(slip),
    slipNumber: slip.slipNumber || '',
    lotteryCode: slip.lotteryCode || '',
    lotteryName: slip.lotteryName || '',
    roundCode: slip.roundCode || '',
    roundTitle: slip.roundTitle || '',
    status: slip.status || ''
  };
};

const serializeBetItem = (item) => {
  if (!item) return null;
  return {
    id: toIdString(item),
    betType: item.betType || '',
    number: item.number || '',
    amount: toNumber(item.amount),
    payRate: toNumber(item.payRate),
    potentialPayout: toNumber(item.potentialPayout),
    result: item.result || '',
    payoutStatus: item.payoutStatus || '',
    payoutAppliedAmount: toNumber(item.payoutAppliedAmount),
    wonAmount: toNumber(item.wonAmount)
  };
};

const serializeRound = (round) => {
  if (!round) return null;
  return {
    id: toIdString(round),
    code: round.code || '',
    title: round.title || '',
    status: round.status || '',
    closeAt: round.closeAt || null,
    drawAt: round.drawAt || null
  };
};

const serializePendingPayout = (payout) => ({
  id: toIdString(payout),
  payoutId: payout.payoutId || '',
  payoutAmount: toNumber(payout.payoutAmount),
  status: payout.status || '',
  reason: payout.reason || '',
  createdAt: payout.createdAt || null,
  updatedAt: payout.updatedAt || null,
  paidAt: payout.paidAt || null,
  cancelledAt: payout.cancelledAt || null,
  agent: serializeUser(payout.agentId),
  customer: serializeUser(payout.customerId),
  member: serializeUser(payout.customerId),
  slip: serializeSlip(payout.betSlipId),
  betItem: serializeBetItem(payout.betItemId),
  round: serializeRound(payout.roundId),
  metadata: payout.metadata || {}
});

const serializeNotification = (event) => ({
  id: toIdString(event),
  type: event.type || '',
  recipientRole: event.recipientRole || '',
  recipientUserId: toIdString(event.recipientUserId),
  status: event.status || '',
  title: event.title || '',
  message: event.message || '',
  createdAt: event.createdAt || null,
  updatedAt: event.updatedAt || null,
  agent: serializeUser(event.agentId),
  customer: serializeUser(event.customerId),
  member: serializeUser(event.customerId),
  metadata: event.metadata || {}
});

const buildPendingScope = ({ role, userId }) => {
  if (role === 'admin') return {};
  if (role === 'customer') return { customerId: userId };
  return { agentId: userId };
};

const buildNotificationScope = ({ role, userId }) => {
  if (role === 'admin') return { recipientRole: 'admin' };
  if (role === 'customer') {
    return {
      recipientRole: 'customer',
      recipientUserId: userId
    };
  }
  return {
    recipientRole: 'agent',
    recipientUserId: userId
  };
};

const listPendingPayouts = async ({ role, userId, query = {} }) => {
  const filter = {
    ...buildPendingScope({ role, userId }),
    status: normalizeStatusFilter({
      value: query.status,
      allowedStatuses: PAYOUT_STATUSES,
      fallbackStatuses: ['pending', 'paid']
    })
  };
  const limit = parseLimit(query.limit);

  const [items, pendingCount, paidCount] = await Promise.all([
    PendingPayout.find(filter)
      .populate('agentId', 'username name role')
      .populate('customerId', 'username name role')
      .populate('betSlipId', 'slipNumber lotteryCode lotteryName roundCode roundTitle status')
      .populate('betItemId', 'betType number amount payRate potentialPayout result payoutStatus payoutAppliedAmount wonAmount')
      .populate('roundId', 'code title status closeAt drawAt')
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean(),
    PendingPayout.countDocuments({ ...buildPendingScope({ role, userId }), status: 'pending' }),
    PendingPayout.countDocuments({ ...buildPendingScope({ role, userId }), status: 'paid' })
  ]);

  return {
    items: items.map(serializePendingPayout),
    summary: {
      pendingCount,
      paidCount,
      limit
    }
  };
};

const listNotifications = async ({ role, userId, query = {} }) => {
  const baseScope = buildNotificationScope({ role, userId });
  const filter = {
    ...baseScope,
    status: normalizeStatusFilter({
      value: query.status,
      allowedStatuses: NOTIFICATION_STATUSES,
      fallbackStatuses: ['unread', 'read']
    })
  };
  const limit = parseLimit(query.limit);

  const [items, unreadCount] = await Promise.all([
    NotificationEvent.find(filter)
      .populate('agentId', 'username name role')
      .populate('customerId', 'username name role')
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean(),
    NotificationEvent.countDocuments({ ...baseScope, status: 'unread' })
  ]);

  return {
    items: items.map(serializeNotification),
    summary: {
      unreadCount,
      limit
    }
  };
};

const markNotificationRead = async ({ role, userId, notificationId }) => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    return null;
  }

  const notification = await NotificationEvent.findOneAndUpdate(
    {
      _id: notificationId,
      ...buildNotificationScope({ role, userId })
    },
    { $set: { status: 'read' } },
    { new: true }
  )
    .populate('agentId', 'username name role')
    .populate('customerId', 'username name role')
    .lean();

  return notification ? serializeNotification(notification) : null;
};

module.exports = {
  listNotifications,
  listPendingPayouts,
  markNotificationRead
};
