import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiBell, FiCheckCircle, FiDollarSign, FiRefreshCw } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { getMemberNotifications, markMemberNotificationRead } from '../../services/api';
import { formatBaht, formatWhen, getNotificationMessage } from './memberUtils';

const MemberNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState({ unreadCount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await getMemberNotifications({ status: 'all', limit: 100 });
      setNotifications(response.data.items || []);
      setSummary(response.data.summary || { unreadCount: 0 });
    } catch (error) {
      console.error(error);
      toast.error('โหลดแจ้งเตือนไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkRead = async (id) => {
    setMarkingId(id);
    try {
      await markMemberNotificationRead(id);
      toast.success('อ่านแจ้งเตือนแล้ว');
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'อัปเดตแจ้งเตือนไม่สำเร็จ');
    } finally {
      setMarkingId('');
    }
  };

  if (loading) return <PageSkeleton statCount={2} rows={6} sidebar={false} />;

  return (
    <div className="ops-page member-page animate-fade-in">
      <section className="ops-hero member-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">NOTIFICATIONS</span>
          <h1 className="page-title">แจ้งเตือนของฉัน</h1>
          <p className="page-subtitle">แจ้งเตือนรางวัลค้างจ่ายและรางวัลที่ระบบจ่ายให้สมาชิกบัญชีนี้แล้ว</p>
        </div>
        <div className="ops-hero-side"><span>ยังไม่อ่าน</span><strong>{summary.unreadCount}</strong><small>{notifications.length} รายการล่าสุด</small></div>
      </section>

      <section className="member-action-row">
        <button type="button" className="btn btn-secondary" onClick={load} disabled={refreshing}><FiRefreshCw /> Refresh</button>
      </section>

      <section className="card member-panel">
        {notifications.length ? (
          <div className="member-notification-list">
            {notifications.map((notification) => (
              <article key={notification.id} className={`member-notification-card ${notification.status === 'read' ? 'is-read' : ''}`}>
                <div className="member-notification-icon">{notification.type === 'agent_pending_payout_paid' ? <FiCheckCircle /> : <FiDollarSign />}</div>
                <div className="member-notification-main">
                  <div className="member-notification-topline">
                    <strong>{getNotificationMessage(notification)}</strong>
                    <span className={`badge ${notification.status === 'read' ? 'badge-info' : 'badge-warning'}`}>{notification.status === 'read' ? 'อ่านแล้ว' : 'ยังไม่อ่าน'}</span>
                  </div>
                  <span>{notification.message || notification.title || '-'}</span>
                  <small>{formatWhen(notification.createdAt)} · {formatBaht(notification.metadata?.payoutAmount || 0)}</small>
                </div>
                {notification.status !== 'read' ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleMarkRead(notification.id)} disabled={markingId === notification.id}>
                    <FiBell /> Mark as read
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : <div className="empty-state"><div className="empty-state-text">ยังไม่มีแจ้งเตือน</div></div>}
      </section>
    </div>
  );
};

export default MemberNotifications;
