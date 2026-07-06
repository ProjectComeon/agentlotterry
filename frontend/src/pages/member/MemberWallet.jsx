import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiBell, FiCheckCircle, FiClock, FiCreditCard, FiRefreshCw, FiTrendingUp } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { getMemberMe, getMemberPendingPayouts, getMemberSlips, getMemberWallet } from '../../services/api';
import { formatBaht, formatWhen } from './memberUtils';

const MemberWallet = () => {
  const [member, setMember] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [slips, setSlips] = useState([]);
  const [payoutSummary, setPayoutSummary] = useState({ pendingCount: 0, paidCount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [meRes, walletRes, slipsRes, payoutRes] = await Promise.all([
        getMemberMe(),
        getMemberWallet(),
        getMemberSlips({}),
        getMemberPendingPayouts({ status: 'all', limit: 1 })
      ]);
      setMember(meRes.data.member || null);
      setWallet(walletRes.data || null);
      setSlips((slipsRes.data || []).slice(0, 6));
      setPayoutSummary(payoutRes.data.summary || { pendingCount: 0, paidCount: 0 });
    } catch (error) {
      console.error(error);
      toast.error('โหลดเครดิตไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PageSkeleton statCount={3} rows={5} sidebar={false} />;

  const account = wallet?.account || {};
  const submittedTotal = slips.reduce((sum, slip) => sum + Number(slip.totalAmount || 0), 0);

  return (
    <div className="ops-page member-page animate-fade-in">
      <section className="ops-hero member-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">WALLET</span>
          <h1 className="page-title">เครดิตของฉัน</h1>
          <p className="page-subtitle">ดูยอดเครดิตบัญชีสมาชิก ใช้ซื้อหวยเองและรับรางวัลจาก Agent เจ้าของบัญชี</p>
        </div>
        <div className="ops-hero-side">
          <span>เครดิตคงเหลือ</span>
          <strong>{formatBaht(account.creditBalance)}</strong>
          <small>{member?.username ? `@${member.username}` : '-'}</small>
        </div>
      </section>

      <section className="ops-overview-grid member-stat-grid">
        <article className="ops-overview-card"><div className="ops-icon-badge"><FiCreditCard /></div><strong>{formatBaht(account.creditBalance)}</strong><span>เครดิตปัจจุบัน</span><small>หักทันทีเมื่อ submit สำเร็จ</small></article>
        <article className="ops-overview-card"><div className="ops-icon-badge"><FiTrendingUp /></div><strong>{formatBaht(submittedTotal)}</strong><span>ยอดโพยล่าสุด</span><small>จาก {slips.length} โพยล่าสุด</small></article>
        <article className="ops-overview-card"><div className="ops-icon-badge"><FiClock /></div><strong>{payoutSummary.pendingCount}</strong><span>รางวัลรอจ่าย</span><small>ไม่ทำให้ Agent balance ติดลบ</small></article>
        <article className="ops-overview-card"><div className="ops-icon-badge"><FiCheckCircle /></div><strong>{payoutSummary.paidCount}</strong><span>จ่ายรางวัลแล้ว</span><small>ระบบ auto-pay แล้ว</small></article>
      </section>

      <section className="member-action-row">
        <Link to="/member/buy" className="btn btn-primary">ซื้อหวยเอง</Link>
        <Link to="/member/pending-payouts" className="btn btn-secondary"><FiBell /> รางวัลค้างจ่าย</Link>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={refreshing}><FiRefreshCw /> Refresh</button>
      </section>

      <section className="card member-panel">
        <div className="member-panel-head"><div><div className="ui-eyebrow">RECENT SLIPS</div><h3>โพยล่าสุดที่กระทบเครดิต</h3></div></div>
        {slips.length ? (
          <div className="member-list">
            {slips.map((slip) => (
              <Link key={slip.id} to={`/member/slips/${slip.id}`} className="member-list-row is-link">
                <div><strong>{slip.slipNumber || '-'}</strong><span>{slip.lotteryName || slip.lotteryCode || '-'} · {formatWhen(slip.submittedAt || slip.createdAt)}</span></div>
                <strong>{formatBaht(slip.totalAmount)}</strong>
              </Link>
            ))}
          </div>
        ) : <div className="empty-state"><div className="empty-state-text">ยังไม่มีโพยล่าสุด</div></div>}
      </section>
    </div>
  );
};

export default MemberWallet;
