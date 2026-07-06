import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiBell, FiClock, FiCreditCard, FiFileText, FiRefreshCw, FiSend, FiTrendingUp } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import {
  getMemberMe,
  getMemberNotifications,
  getMemberPendingPayouts,
  getMemberRounds,
  getMemberSlips,
  getMemberWallet
} from '../../services/api';
import { useCatalog } from '../../context/CatalogContext';
import {
  flattenLotteries,
  formatBaht,
  formatWhen,
  getNotificationMessage,
  getReadablePayoutStatus,
  getReadableSlipStatus,
  getRoundDisplay,
  getRoundStatusDisplay,
  statusBadgeClass
} from './memberUtils';

const MemberDashboard = () => {
  const { ensureCatalogLoaded } = useCatalog();
  const [member, setMember] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [slips, setSlips] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [payoutSummary, setPayoutSummary] = useState({ pendingCount: 0, paidCount: 0 });
  const [notificationSummary, setNotificationSummary] = useState({ unreadCount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const catalog = await ensureCatalogLoaded?.({ force: true });
      const lotteries = flattenLotteries(catalog?.leagues || []).slice(0, 8);
      const [meRes, walletRes, slipsRes, payoutsRes, notificationsRes, ...roundResults] = await Promise.all([
        getMemberMe(),
        getMemberWallet(),
        getMemberSlips({}),
        getMemberPendingPayouts({ status: 'all', limit: 5 }),
        getMemberNotifications({ status: 'all', limit: 5 }),
        ...lotteries.map((lottery) => getMemberRounds(lottery.id).then((res) => ({ lottery, rounds: res.data || [] })).catch(() => ({ lottery, rounds: [] })))
      ]);

      setMember(meRes.data.member || null);
      setWallet(walletRes.data || null);
      setSlips((slipsRes.data || []).slice(0, 5));
      setPayouts(payoutsRes.data.items || []);
      setPayoutSummary(payoutsRes.data.summary || { pendingCount: 0, paidCount: 0 });
      setNotifications(notificationsRes.data.items || []);
      setNotificationSummary(notificationsRes.data.summary || { unreadCount: 0 });
      setRounds(roundResults.flatMap(({ lottery, rounds: lotteryRounds }) =>
        lotteryRounds
          .filter((round) => ['open', 'upcoming'].includes(round.status))
          .slice(0, 2)
          .map((round) => ({ ...round, lotteryName: lottery.name, leagueName: lottery.leagueName }))
      ).slice(0, 6));
    } catch (error) {
      console.error(error);
      toast.error('โหลดข้อมูลสมาชิกไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ensureCatalogLoaded]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PageSkeleton statCount={4} rows={6} sidebar={false} />;

  const account = wallet?.account || {};

  return (
    <div className="ops-page member-page animate-fade-in">
      <section className="ops-hero member-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">MEMBER</span>
          <h1 className="page-title">หน้าสมาชิก</h1>
          <p className="page-subtitle">ซื้อหวยเอง ดูเครดิต โพย รางวัลค้างจ่าย และแจ้งเตือนของบัญชีคุณเท่านั้น</p>
        </div>
        <div className="ops-hero-side">
          <span>เครดิตคงเหลือ</span>
          <strong>{formatBaht(account.creditBalance)}</strong>
          <small>{member?.name || member?.username || '-'}</small>
        </div>
      </section>

      <section className="ops-overview-grid member-stat-grid">
        <article className="ops-overview-card">
          <div className="ops-icon-badge"><FiCreditCard /></div>
          <strong>{formatBaht(account.creditBalance)}</strong>
          <span>เครดิตพร้อมซื้อ</span>
          <small>หักทันทีเมื่อ submit สำเร็จ</small>
        </article>
        <article className="ops-overview-card">
          <div className="ops-icon-badge"><FiClock /></div>
          <strong>{rounds.length}</strong>
          <span>รอบที่เปิด/ใกล้เปิด</span>
          <small>อิงสิทธิ์หวยของบัญชีสมาชิก</small>
        </article>
        <article className="ops-overview-card">
          <div className="ops-icon-badge"><FiTrendingUp /></div>
          <strong>{payoutSummary.pendingCount}</strong>
          <span>รางวัลรอจ่าย</span>
          <small>จ่ายอัตโนมัติเมื่อ Agent เครดิตพอ</small>
        </article>
        <article className="ops-overview-card">
          <div className="ops-icon-badge"><FiBell /></div>
          <strong>{notificationSummary.unreadCount}</strong>
          <span>แจ้งเตือนยังไม่อ่าน</span>
          <small>เฉพาะบัญชีนี้</small>
        </article>
      </section>

      <section className="member-action-row">
        <Link to="/member/buy" className="btn btn-primary"><FiSend /> ซื้อหวยเอง</Link>
        <Link to="/member/slips" className="btn btn-secondary"><FiFileText /> ดูโพยทั้งหมด</Link>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={refreshing}><FiRefreshCw /> Refresh</button>
      </section>

      <section className="member-grid-two">
        <article className="card member-panel">
          <div className="member-panel-head">
            <div>
              <div className="ui-eyebrow">OPEN ROUNDS</div>
              <h3>รอบที่เปิดให้ซื้อ</h3>
            </div>
          </div>
          {rounds.length ? (
            <div className="member-list">
              {rounds.map((round) => (
                <div key={`${round.lotteryName}-${round.id}`} className="member-list-row">
                  <div>
                    <strong>{round.lotteryName}</strong>
                    <span>{getRoundDisplay(round)} · {round.leagueName}</span>
                  </div>
                  <span className={`badge ${statusBadgeClass(round.status)}`}>{getRoundStatusDisplay(round.status)}</span>
                </div>
              ))}
            </div>
          ) : <div className="empty-state"><div className="empty-state-text">ยังไม่มีรอบที่เปิดให้ซื้อ</div></div>}
        </article>

        <article className="card member-panel">
          <div className="member-panel-head">
            <div>
              <div className="ui-eyebrow">RECENT SLIPS</div>
              <h3>โพยล่าสุด</h3>
            </div>
            <Link to="/member/slips" className="btn btn-secondary btn-sm">ทั้งหมด</Link>
          </div>
          {slips.length ? (
            <div className="member-list">
              {slips.map((slip) => (
                <Link key={slip.id} to={`/member/slips/${slip.id}`} className="member-list-row is-link">
                  <div>
                    <strong>{slip.slipNumber || '-'}</strong>
                    <span>{slip.lotteryName || slip.lotteryCode || '-'} · {formatBaht(slip.totalAmount)}</span>
                  </div>
                  <span className={`badge ${statusBadgeClass(slip.status)}`}>{getReadableSlipStatus(slip)}</span>
                </Link>
              ))}
            </div>
          ) : <div className="empty-state"><div className="empty-state-text">ยังไม่มีโพย</div></div>}
        </article>
      </section>

      <section className="member-grid-two">
        <article className="card member-panel">
          <div className="member-panel-head">
            <div>
              <div className="ui-eyebrow">PAYOUTS</div>
              <h3>รางวัลค้างจ่ายล่าสุด</h3>
            </div>
            <Link to="/member/pending-payouts" className="btn btn-secondary btn-sm">ทั้งหมด</Link>
          </div>
          {payouts.length ? (
            <div className="member-list">
              {payouts.map((payout) => (
                <div key={payout.id} className="member-list-row">
                  <div>
                    <strong>{formatBaht(payout.payoutAmount)}</strong>
                    <span>{payout.slip?.slipNumber || '-'} · {payout.betItem?.number || '-'}</span>
                  </div>
                  <span className={`badge ${statusBadgeClass(payout.status)}`}>{getReadablePayoutStatus(payout.status)}</span>
                </div>
              ))}
            </div>
          ) : <div className="empty-state"><div className="empty-state-text">ยังไม่มีรางวัลค้างจ่าย</div></div>}
        </article>

        <article className="card member-panel">
          <div className="member-panel-head">
            <div>
              <div className="ui-eyebrow">NOTIFICATIONS</div>
              <h3>แจ้งเตือนล่าสุด</h3>
            </div>
            <Link to="/member/notifications" className="btn btn-secondary btn-sm">ทั้งหมด</Link>
          </div>
          {notifications.length ? (
            <div className="member-list">
              {notifications.map((notification) => (
                <div key={notification.id} className="member-list-row">
                  <div>
                    <strong>{getNotificationMessage(notification)}</strong>
                    <span>{formatWhen(notification.createdAt)}</span>
                  </div>
                  <span className={`badge ${notification.status === 'read' ? 'badge-info' : 'badge-warning'}`}>{notification.status === 'read' ? 'อ่านแล้ว' : 'ยังไม่อ่าน'}</span>
                </div>
              ))}
            </div>
          ) : <div className="empty-state"><div className="empty-state-text">ยังไม่มีแจ้งเตือน</div></div>}
        </article>
      </section>
    </div>
  );
};

export default MemberDashboard;
