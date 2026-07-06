import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiEye, FiFileText, FiRefreshCw, FiRotateCcw } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { cancelMemberSlip, getMemberSlips } from '../../services/api';
import { canCancelSlip, formatBaht, formatWhen, getReadableSlipStatus, statusBadgeClass } from './memberUtils';

const filters = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'draft', label: 'แบบร่าง' },
  { value: 'submitted', label: 'ส่งซื้อแล้ว' },
  { value: 'cancelled', label: 'ยกเลิก' }
];

const MemberSlips = () => {
  const [filter, setFilter] = useState('all');
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await getMemberSlips(filter === 'all' ? {} : { status: filter });
      setSlips(response.data || []);
    } catch (error) {
      console.error(error);
      toast.error('โหลดโพยไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = async (slipId) => {
    setCancellingId(slipId);
    try {
      await cancelMemberSlip(slipId);
      toast.success('ยกเลิกโพยแล้ว');
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'ยกเลิกโพยไม่สำเร็จ');
    } finally {
      setCancellingId('');
    }
  };

  const totals = useMemo(() => slips.reduce((acc, slip) => {
    acc.amount += Number(slip.totalAmount || 0);
    acc.pending += Number(slip.summary?.pendingCount || 0);
    acc.won += Number(slip.summary?.wonCount || 0);
    return acc;
  }, { amount: 0, pending: 0, won: 0 }), [slips]);

  if (loading) return <PageSkeleton statCount={3} rows={6} sidebar={false} />;

  return (
    <div className="ops-page member-page animate-fade-in">
      <section className="ops-hero member-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">MY SLIPS</span>
          <h1 className="page-title">โพยของฉัน</h1>
          <p className="page-subtitle">รายการซื้อทั้งหมดแสดงเฉพาะบัญชีสมาชิกที่ login อยู่</p>
        </div>
        <div className="ops-hero-side">
          <span>ยอดรวมในหน้านี้</span>
          <strong>{formatBaht(totals.amount)}</strong>
          <small>รอผล {totals.pending} รายการ / ถูกรางวัล {totals.won} รายการ</small>
        </div>
      </section>

      <section className="member-action-row">
        <Link to="/member/buy" className="btn btn-primary">ซื้อหวยเอง</Link>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={refreshing}><FiRefreshCw /> Refresh</button>
      </section>

      <div className="member-chip-row">
        {filters.map((item) => (
          <button key={item.value} type="button" className={`member-chip ${filter === item.value ? 'is-active' : ''}`} onClick={() => setFilter(item.value)}>{item.label}</button>
        ))}
      </div>

      <section className="card member-panel">
        {slips.length ? (
          <div className="member-slip-list">
            {slips.map((slip) => (
              <article key={slip.id} className="member-slip-card">
                <div className="member-slip-main">
                  <div>
                    <strong>{slip.slipNumber || '-'}</strong>
                    <span>{slip.lotteryName || slip.lotteryCode || '-'} · {slip.roundTitle || slip.roundCode || '-'}</span>
                  </div>
                  <span className={`badge ${statusBadgeClass(slip.status)}`}>{getReadableSlipStatus(slip)}</span>
                </div>
                <div className="member-slip-stats">
                  <div><span>ยอดซื้อ</span><strong>{formatBaht(slip.totalAmount)}</strong></div>
                  <div><span>รายการ</span><strong>{slip.itemCount || 0}</strong></div>
                  <div><span>ถูกรางวัล</span><strong>{formatBaht(slip.summary?.totalWon || 0)}</strong></div>
                  <div><span>เวลา</span><strong>{formatWhen(slip.submittedAt || slip.createdAt)}</strong></div>
                </div>
                <div className="member-number-row">
                  {(slip.previewNumbers || []).map((number, index) => <span key={`${slip.id}-${number}-${index}`} className="member-number-pill">{number}</span>)}
                </div>
                <div className="member-slip-actions">
                  <Link to={`/member/slips/${slip.id}`} className="btn btn-secondary btn-sm"><FiEye /> ดูรายละเอียด</Link>
                  {canCancelSlip(slip) ? (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleCancel(slip.id)} disabled={cancellingId === slip.id}>
                      <FiRotateCcw /> ยกเลิกโพย
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state"><div className="empty-state-icon"><FiFileText /></div><div className="empty-state-text">ยังไม่มีโพยในสถานะนี้</div></div>
        )}
      </section>
    </div>
  );
};

export default MemberSlips;
