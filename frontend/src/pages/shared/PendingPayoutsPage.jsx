import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiAlertTriangle, FiBell, FiCheckCircle, FiClock, FiDollarSign, FiRefreshCw } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import {
  getAdminNotifications,
  getAdminPendingPayouts,
  getAgentNotifications,
  getAgentPendingPayouts,
  markAdminNotificationRead,
  markAgentNotificationRead
} from '../../services/api';
import { formatDateTime, formatMoney as money } from '../../utils/formatters';

const payoutStatusLabels = {
  pending: 'รอจ่าย',
  paid: 'จ่ายแล้ว',
  cancelled: 'ยกเลิก',
  failed: 'ล้มเหลว'
};

const notificationText = ({ role, type }) => {
  if (type === 'agent_pending_payout_paid') {
    return role === 'admin' ? 'ระบบจ่ายรางวัลอัตโนมัติแล้ว' : 'ระบบจ่ายรางวัลให้ Member แล้ว';
  }

  return role === 'admin' ? 'Agent เครดิตไม่พอจ่ายรางวัล' : 'Member รอรับเครดิตรางวัล';
};

const buildConfig = (role) => {
  if (role === 'agent') {
    return {
      role,
      eyebrow: 'PENDING PAYOUTS',
      title: 'รายการรอจ่ายรางวัล',
      subtitle: 'ดู Member ที่รอรับเครดิตรางวัล และสถานะที่ระบบจ่ายให้อัตโนมัติหลัง Agent เติมเครดิต',
      pendingTitle: 'Pending Payouts ของ Agent',
      notificationTitle: 'Notifications ของ Agent',
      emptyPayouts: 'ยังไม่มีรายการรอจ่ายของ Agent นี้',
      emptyNotifications: 'ยังไม่มี notification ของ Agent นี้',
      getPending: getAgentPendingPayouts,
      getNotifications: getAgentNotifications,
      markRead: markAgentNotificationRead
    };
  }

  return {
    role: 'admin',
    eyebrow: 'PENDING PAYOUTS',
    title: 'รายการรอจ่ายรางวัล',
    subtitle: 'ติดตาม Agent เครดิตไม่พอจ่ายรางวัล และสถานะ auto-pay หลังเติมเครดิต',
    pendingTitle: 'Pending Payouts ทุก Agent',
    notificationTitle: 'Notifications ของ Admin',
    emptyPayouts: 'ยังไม่มีรายการรอจ่ายในระบบ',
    emptyNotifications: 'ยังไม่มี notification สำหรับ Admin',
    getPending: getAdminPendingPayouts,
    getNotifications: getAdminNotifications,
    markRead: markAdminNotificationRead
  };
};

const StatusBadge = ({ status }) => {
  const normalized = status || 'pending';
  const className = normalized === 'paid'
    ? 'badge badge-success'
    : normalized === 'pending'
      ? 'badge badge-warning'
      : 'badge badge-danger';

  return <span className={className}>{payoutStatusLabels[normalized] || normalized}</span>;
};

const NotificationBadge = ({ status }) => (
  <span className={`badge ${status === 'read' ? 'badge-info' : 'badge-warning'}`}>
    {status === 'read' ? 'อ่านแล้ว' : 'ยังไม่อ่าน'}
  </span>
);

const PendingPayoutsPage = ({ role = 'admin' }) => {
  const config = useMemo(() => buildConfig(role), [role]);
  const [payouts, setPayouts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [payoutSummary, setPayoutSummary] = useState({ pendingCount: 0, paidCount: 0 });
  const [notificationSummary, setNotificationSummary] = useState({ unreadCount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState('');

  const load = useCallback(async ({ force = false } = {}) => {
    setRefreshing(true);
    try {
      const [payoutResponse, notificationResponse] = await Promise.all([
        config.getPending({ status: 'all', limit: 100 }, { force }),
        config.getNotifications({ status: 'all', limit: 100 }, { force })
      ]);
      setPayouts(payoutResponse.data.items || []);
      setPayoutSummary(payoutResponse.data.summary || { pendingCount: 0, paidCount: 0 });
      setNotifications(notificationResponse.data.items || []);
      setNotificationSummary(notificationResponse.data.summary || { unreadCount: 0 });
    } catch (error) {
      console.error(error);
      toast.error('โหลดรายการรอจ่ายไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [config]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkRead = async (notificationId) => {
    setMarkingId(notificationId);
    try {
      await config.markRead(notificationId);
      await load({ force: true });
      toast.success('ทำเครื่องหมายว่าอ่านแล้ว');
    } catch (error) {
      console.error(error);
      toast.error('อัปเดต notification ไม่สำเร็จ');
    } finally {
      setMarkingId('');
    }
  };

  if (loading) {
    return <PageSkeleton statCount={3} rows={8} sidebar compactSidebar />;
  }

  return (
    <div className="ops-page pending-payout-page animate-fade-in">
      <section className="ops-hero pending-payout-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">{config.eyebrow}</span>
          <h1 className="page-title">{config.title}</h1>
          <p className="page-subtitle">{config.subtitle}</p>
        </div>
        <div className="ops-hero-side pending-payout-hero-side">
          <span>ยอดรอจ่ายปัจจุบัน</span>
          <strong>{money(payoutSummary.pendingCount)}</strong>
          <small>จ่ายแล้ว {money(payoutSummary.paidCount)} รายการ / ยังไม่อ่าน {money(notificationSummary.unreadCount)}</small>
        </div>
      </section>

      <section className="ops-overview-grid compact pending-payout-stats">
        <article className="ops-overview-card">
          <div className="ops-icon-badge"><FiClock /></div>
          <strong>{money(payoutSummary.pendingCount)}</strong>
          <span>รอ Agent เติมเครดิต</span>
          <small>Agent balance จะไม่ติดลบ</small>
        </article>
        <article className="ops-overview-card">
          <div className="ops-icon-badge"><FiCheckCircle /></div>
          <strong>{money(payoutSummary.paidCount)}</strong>
          <span>Auto-pay สำเร็จ</span>
          <small>ระบบจ่ายรางวัลให้ Member แล้ว</small>
        </article>
        <article className="ops-overview-card">
          <div className="ops-icon-badge"><FiBell /></div>
          <strong>{money(notificationSummary.unreadCount)}</strong>
          <span>Notification ยังไม่อ่าน</span>
          <small>ทำเครื่องหมายอ่านแล้วได้เท่านั้น</small>
        </article>
      </section>

      <section className="card ops-section pending-payout-panel">
        <div className="ops-table-head">
          <div>
            <div className="ui-eyebrow">PAYOUT QUEUE</div>
            <h3>{config.pendingTitle}</h3>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => load({ force: true })} disabled={refreshing}>
            <FiRefreshCw /> Refresh
          </button>
        </div>

        {payouts.length ? (
          <div className="table-container pending-payout-table-wrap">
            <table className="data-table pending-payout-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Member</th>
                  <th>จำนวนเงิน</th>
                  <th>โพย / งวด</th>
                  <th>สถานะ</th>
                  <th>เวลา</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td>
                      <strong>{payout.agent?.name || '-'}</strong>
                      <div className="ops-table-note">@{payout.agent?.username || '-'}</div>
                    </td>
                    <td>
                      <strong>{payout.member?.name || '-'}</strong>
                      <div className="ops-table-note">@{payout.member?.username || '-'}</div>
                    </td>
                    <td>
                      <strong>{money(payout.payoutAmount)} บาท</strong>
                      <div className="ops-table-note">{payout.betItem?.betType || '-'} / {payout.betItem?.number || '-'}</div>
                    </td>
                    <td>
                      <strong>{payout.slip?.slipNumber || '-'}</strong>
                      <div className="ops-table-note">{payout.slip?.lotteryName || payout.slip?.lotteryCode || '-'} · {payout.round?.code || payout.slip?.roundCode || '-'}</div>
                    </td>
                    <td><StatusBadge status={payout.status} /></td>
                    <td>
                      <strong>{formatDateTime(payout.status === 'paid' ? payout.paidAt : payout.createdAt)}</strong>
                      <div className="ops-table-note">{payout.status === 'paid' ? 'paidAt' : 'createdAt'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><div className="empty-state-text">{config.emptyPayouts}</div></div>
        )}
      </section>

      <section className="card ops-section pending-payout-panel">
        <div className="ops-table-head">
          <div>
            <div className="ui-eyebrow">NOTIFICATIONS</div>
            <h3>{config.notificationTitle}</h3>
          </div>
          <span className="ui-pill"><FiAlertTriangle /> สถานะรางวัลค้างจ่าย</span>
        </div>

        {notifications.length ? (
          <div className="pending-notification-list">
            {notifications.map((notification) => (
              <article key={notification.id} className={`pending-notification-card ${notification.status === 'read' ? 'is-read' : ''}`}>
                <div className="pending-notification-icon">
                  {notification.type === 'agent_pending_payout_paid' ? <FiCheckCircle /> : <FiDollarSign />}
                </div>
                <div className="pending-notification-main">
                  <div className="pending-notification-topline">
                    <strong>{notificationText({ role: config.role, type: notification.type })}</strong>
                    <NotificationBadge status={notification.status} />
                  </div>
                  <div className="pending-notification-meta">
                    Agent: {notification.agent?.name || '-'} · Member: {notification.member?.name || '-'} · {money(notification.metadata?.payoutAmount)} บาท
                  </div>
                  <div className="ops-table-note">{formatDateTime(notification.createdAt)}</div>
                </div>
                <div className="pending-notification-actions">
                  {notification.status === 'read' ? (
                    <span className="text-muted">อ่านแล้ว</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleMarkRead(notification.id)}
                      disabled={markingId === notification.id}
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state"><div className="empty-state-text">{config.emptyNotifications}</div></div>
        )}
      </section>

      <style>{`
        .pending-payout-page {
          gap: 16px;
        }

        .pending-payout-hero {
          align-items: end;
        }

        .pending-payout-hero-side strong {
          color: var(--warning);
        }

        .pending-payout-stats {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .pending-payout-panel {
          box-shadow: 0 18px 32px rgba(127, 29, 29, 0.08);
        }

        .pending-payout-table td {
          vertical-align: top;
        }

        .pending-notification-list {
          display: grid;
          gap: 10px;
        }

        .pending-notification-card {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border: 1px solid rgba(220, 38, 38, 0.12);
          border-radius: 16px;
          background: rgba(255, 247, 247, 0.92);
        }

        .pending-notification-card.is-read {
          background: rgba(255, 252, 252, 0.84);
        }

        .pending-notification-icon {
          width: 40px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          color: var(--primary);
          background: rgba(220, 38, 38, 0.08);
          border: 1px solid rgba(220, 38, 38, 0.12);
        }

        .pending-notification-main,
        .pending-notification-topline {
          min-width: 0;
        }

        .pending-notification-topline {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }

        .pending-notification-meta {
          margin-top: 4px;
          color: var(--text-secondary);
          font-size: 0.86rem;
        }

        .pending-notification-actions {
          display: flex;
          justify-content: flex-end;
        }

        @media (max-width: 920px) {
          .pending-payout-stats {
            grid-template-columns: 1fr;
          }

          .pending-notification-card {
            grid-template-columns: 1fr;
            align-items: flex-start;
          }

          .pending-notification-actions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default PendingPayoutsPage;