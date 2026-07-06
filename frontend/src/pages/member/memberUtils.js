import { formatDateTime, formatMoney as money } from '../../utils/formatters';
import { getBetTypeLabel, getRoundStatusLabel, getSlipStatusLabel } from '../../i18n/th/labels';

export const formatBaht = (value) => `${money(value)} บาท`;
export const formatWhen = (value) => formatDateTime(value, { fallback: '-' });

export const flattenLotteries = (leagues = []) => leagues.flatMap((league) =>
  (league.lotteries || []).map((lottery) => ({
    ...lottery,
    leagueId: league.id,
    leagueName: league.name
  }))
);

export const statusBadgeClass = (status = '') => {
  if (['paid', 'won', 'submitted', 'open', 'active'].includes(status)) return 'badge-success';
  if (['pending', 'draft', 'upcoming'].includes(status)) return 'badge-warning';
  if (['cancelled', 'canceled', 'lost', 'failed', 'closed'].includes(status)) return 'badge-danger';
  return 'badge-info';
};

export const getReadableSlipStatus = (slip = {}) => {
  if (slip.status === 'cancelled') return 'ยกเลิกแล้ว';
  if (slip.status === 'draft') return 'แบบร่าง';
  const summary = slip.summary || {};
  if (Number(summary.pendingCount || 0) > 0) return 'รอผล';
  if (Number(summary.wonCount || 0) > 0) return 'ถูกรางวัล';
  if (Number(summary.lostCount || 0) > 0) return 'ปิดผลแล้ว';
  return getSlipStatusLabel(slip.status);
};

export const getReadablePayoutStatus = (status = '') => {
  if (status === 'paid') return 'จ่ายแล้ว';
  if (status === 'pending') return 'รอจ่าย';
  if (status === 'cancelled') return 'ยกเลิก';
  if (status === 'failed') return 'ล้มเหลว';
  return status || '-';
};

export const getNotificationMessage = (notification = {}) => {
  if (notification.type === 'agent_pending_payout_paid') {
    return 'ระบบจ่ายรางวัลให้ Member แล้ว';
  }
  return 'Member รอรับเครดิตรางวัล';
};

export const getRoundDisplay = (round = {}) => round.title || round.code || round.displayDate || '-';
export const getRoundStatusDisplay = (status) => getRoundStatusLabel(status || 'missing');
export const getBetDisplay = (item = {}) => `${getBetTypeLabel(item.betType)} / ${item.number || '-'}`;

export const canCancelSlip = (slip = {}) => Boolean(slip.canCancel && slip.status === 'submitted');

export const createClientRequestId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
