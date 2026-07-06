import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiFileText, FiRefreshCw, FiRotateCcw } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { cancelMemberSlip, getMemberSlip } from '../../services/api';
import { getBetResultLabel } from '../../i18n/th/labels';
import { canCancelSlip, formatBaht, formatWhen, getBetDisplay, getReadableSlipStatus, statusBadgeClass } from './memberUtils';

const MemberSlipDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getMemberSlip(id);
      setSlip(response.data || null);
    } catch (error) {
      console.error(error);
      toast.error('ไม่พบโพยหรือไม่มีสิทธิ์เข้าถึง');
      navigate('/member/slips', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = async () => {
    if (!slip?.id) return;
    setCancelling(true);
    try {
      await cancelMemberSlip(slip.id);
      toast.success('ยกเลิกโพยแล้ว');
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'ยกเลิกโพยไม่สำเร็จ');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <PageSkeleton statCount={3} rows={6} sidebar={false} />;
  if (!slip) return null;

  return (
    <div className="ops-page member-page animate-fade-in">
      <section className="ops-hero member-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">SLIP DETAIL</span>
          <h1 className="page-title">{slip.slipNumber || 'รายละเอียดโพย'}</h1>
          <p className="page-subtitle">{slip.lotteryName || slip.lotteryCode || '-'} · {slip.roundTitle || slip.roundCode || '-'}</p>
        </div>
        <div className="ops-hero-side">
          <span>ยอดซื้อ</span>
          <strong>{formatBaht(slip.totalAmount)}</strong>
          <small>{getReadableSlipStatus(slip)}</small>
        </div>
      </section>

      <section className="member-action-row">
        <Link to="/member/slips" className="btn btn-secondary"><FiArrowLeft /> กลับรายการโพย</Link>
        <button type="button" className="btn btn-secondary" onClick={load}><FiRefreshCw /> Refresh</button>
        {canCancelSlip(slip) ? (
          <button type="button" className="btn btn-danger" onClick={handleCancel} disabled={cancelling}><FiRotateCcw /> ยกเลิกโพย</button>
        ) : null}
      </section>

      <section className="ops-overview-grid member-stat-grid">
        <article className="ops-overview-card"><strong>{slip.itemCount || 0}</strong><span>จำนวนรายการ</span><small>สถานะ <span className={`badge ${statusBadgeClass(slip.status)}`}>{getReadableSlipStatus(slip)}</span></small></article>
        <article className="ops-overview-card"><strong>{formatBaht(slip.potentialPayout)}</strong><span>จ่ายสูงสุด</span><small>ตามเรตของสมาชิก</small></article>
        <article className="ops-overview-card"><strong>{formatBaht(slip.summary?.totalWon || 0)}</strong><span>ยอดถูกรางวัล</span><small>pending {slip.summary?.pendingCount || 0} รายการ</small></article>
        <article className="ops-overview-card"><strong>{formatWhen(slip.submittedAt || slip.createdAt)}</strong><span>เวลาสร้างโพย</span><small>{slip.placedBy?.role === 'customer' ? 'ซื้อเอง' : 'ซื้อแทน'}</small></article>
      </section>

      {slip.memo ? <section className="card member-panel"><div className="member-note"><FiFileText /> {slip.memo}</div></section> : null}

      <section className="card member-panel">
        <div className="member-panel-head"><div><div className="ui-eyebrow">ITEMS</div><h3>รายการเลข</h3></div></div>
        <div className="table-container">
          <table className="data-table member-item-table">
            <thead><tr><th>เลข</th><th>ประเภท</th><th>ยอดซื้อ</th><th>เรต</th><th>ผล</th><th>ยอดถูกรางวัล</th></tr></thead>
            <tbody>
              {(slip.items || []).map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.number}</strong></td>
                  <td>{getBetDisplay(item)}</td>
                  <td>{formatBaht(item.amount)}</td>
                  <td>{item.payRate || '-'}</td>
                  <td><span className={`badge ${statusBadgeClass(item.result)}`}>{getBetResultLabel(item.result)}</span></td>
                  <td>{formatBaht(item.wonAmount || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default MemberSlipDetail;
