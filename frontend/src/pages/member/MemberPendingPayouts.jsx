import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiBell, FiCheckCircle, FiClock, FiRefreshCw } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { getMemberPendingPayouts } from '../../services/api';
import { formatBaht, formatWhen, getReadablePayoutStatus, statusBadgeClass } from './memberUtils';

const MemberPendingPayouts = () => {
  const [payouts, setPayouts] = useState([]);
  const [summary, setSummary] = useState({ pendingCount: 0, paidCount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await getMemberPendingPayouts({ status: 'all', limit: 100 });
      setPayouts(response.data.items || []);
      setSummary(response.data.summary || { pendingCount: 0, paidCount: 0 });
    } catch (error) {
      console.error(error);
      toast.error('โหลดรางวัลค้างจ่ายไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PageSkeleton statCount={3} rows={6} sidebar={false} />;

  return (
    <div className="ops-page member-page animate-fade-in">
      <section className="ops-hero member-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">PENDING PAYOUTS</span>
          <h1 className="page-title">รางวัลของฉัน</h1>
          <p className="page-subtitle">ดูเฉพาะรางวัลค้างจ่ายและรางวัลที่ระบบจ่ายให้บัญชีสมาชิกนี้แล้ว</p>
        </div>
        <div className="ops-hero-side"><span>รอจ่าย</span><strong>{summary.pendingCount}</strong><small>จ่ายแล้ว {summary.paidCount} รายการ</small></div>
      </section>

      <section className="ops-overview-grid member-stat-grid compact">
        <article className="ops-overview-card"><div className="ops-icon-badge"><FiClock /></div><strong>{summary.pendingCount}</strong><span>รอรับเครดิตรางวัล</span><small>Agent ต้องมีเครดิตพอจ่าย</small></article>
        <article className="ops-overview-card"><div className="ops-icon-badge"><FiCheckCircle /></div><strong>{summary.paidCount}</strong><span>ระบบจ่ายแล้ว</span><small>เข้าเครดิตสมาชิกแล้ว</small></article>
        <article className="ops-overview-card"><div className="ops-icon-badge"><FiBell /></div><strong>{payouts.length}</strong><span>รายการที่แสดง</span><small>จำกัดตาม API</small></article>
      </section>

      <section className="card member-panel">
        <div className="member-panel-head"><div><div className="ui-eyebrow">PAYOUT QUEUE</div><h3>รายการรางวัล</h3></div><button type="button" className="btn btn-secondary" onClick={load} disabled={refreshing}><FiRefreshCw /> Refresh</button></div>
        {payouts.length ? (
          <div className="table-container">
            <table className="data-table member-item-table">
              <thead><tr><th>ยอดรางวัล</th><th>โพย</th><th>เลข</th><th>สถานะ</th><th>เวลา</th></tr></thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td><strong>{formatBaht(payout.payoutAmount)}</strong></td>
                    <td>{payout.slip?.slipNumber || '-'}</td>
                    <td>{payout.betItem?.number || '-'}</td>
                    <td><span className={`badge ${statusBadgeClass(payout.status)}`}>{getReadablePayoutStatus(payout.status)}</span></td>
                    <td>{formatWhen(payout.status === 'paid' ? payout.paidAt : payout.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty-state"><div className="empty-state-text">ยังไม่มีรางวัลค้างจ่าย</div></div>}
      </section>
    </div>
  );
};

export default MemberPendingPayouts;
