import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiBell, FiChevronRight, FiClock, FiCreditCard, FiFileText, FiRefreshCw, FiSend, FiTrendingUp } from 'react-icons/fi';
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

const getRoundTimeValue = (round = {}, keys = []) => keys.map((key) => round?.[key]).find(Boolean) || '';
const getRoundOpenTime = (round = {}) => getRoundTimeValue(round, ['openAt', 'displayOpenAt', 'startAt', 'roundDate']);
const getRoundCloseTime = (round = {}) => getRoundTimeValue(round, ['closeAt', 'displayCloseAt', 'endAt']);
const getRoundSortTime = (round = {}) => {
  const parsed = new Date(getRoundCloseTime(round) || getRoundOpenTime(round) || 0).getTime();
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
};
const buildBuyLink = (round = {}) => `/member/buy?lotteryId=${encodeURIComponent(round.lotteryId || '')}&roundId=${encodeURIComponent(round.id || '')}`;

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
      const lotteries = flattenLotteries(catalog?.leagues || []).filter((lottery) => lottery.id);
      const [meRes, walletRes, slipsRes, payoutsRes, notificationsRes, ...roundResults] = await Promise.all([
        getMemberMe(),
        getMemberWallet(),
        getMemberSlips({}),
        getMemberPendingPayouts({ status: 'all', limit: 5 }),
        getMemberNotifications({ status: 'all', limit: 5 }),
        ...lotteries.map((lottery) => getMemberRounds(lottery.id)
          .then((res) => ({ lottery, rounds: res.data || [] }))
          .catch(() => ({ lottery, rounds: [] })))
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
          .filter((round) => round.status === 'open')
          .map((round) => ({
            ...round,
            lotteryId: lottery.id,
            lotteryCode: lottery.code,
            lotteryName: lottery.name,
            leagueName: lottery.leagueName
          }))
      ).sort((left, right) => getRoundSortTime(left) - getRoundSortTime(right)));
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

  const featuredRounds = useMemo(() => rounds.slice(0, 24), [rounds]);

  if (loading) return <PageSkeleton statCount={4} rows={6} sidebar={false} />;

  const account = wallet?.account || {};

  return (
    <div className="ops-page member-page animate-fade-in">
      <section className="ops-hero member-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">MEMBER</span>
          <h1 className="page-title">ซื้อหวยเอง</h1>
          <p className="page-subtitle">เลือกรอบที่เปิดขายจากบัญชีของคุณ ตรวจโพยก่อนยืนยัน และเครดิตจะถูกหักเมื่อซื้อสำเร็จเท่านั้น</p>
        </div>
        <div className="ops-hero-side">
          <span>ยอดเครดิตของฉัน</span>
          <strong>{formatBaht(account.creditBalance)}</strong>
          <small>{member?.name || member?.username || '-'}</small>
        </div>
      </section>

      <section className="ops-overview-grid member-stat-grid">
        <article className="ops-overview-card">
          <div className="ops-icon-badge"><FiCreditCard /></div>
          <strong>{formatBaht(account.creditBalance)}</strong>
          <span>เครดิตพร้อมซื้อ</span>
          <small>หักทันทีเมื่อยืนยันการซื้อสำเร็จ</small>
        </article>
        <article className="ops-overview-card">
          <div className="ops-icon-badge"><FiClock /></div>
          <strong>{featuredRounds.length}</strong>
          <span>รอบที่เปิดขาย</span>
          <small>แสดงตามสิทธิ์บัญชีสมาชิก</small>
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
        <Link to="/member/slips" className="btn btn-secondary"><FiFileText /> ดูโพยทั้งหมด</Link>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={refreshing}><FiRefreshCw /> Refresh</button>
      </section>

      <section className="card member-panel member-rounds-panel">
        <div className="member-panel-head">
          <div>
            <div className="ui-eyebrow">OPEN ROUNDS</div>
            <h3>รายการหวยที่เปิดขาย</h3>
          </div>
          <span className="badge badge-success">เลือกซื้อได้</span>
        </div>
        {featuredRounds.length ? (
          <div className="member-round-grid">
            {featuredRounds.map((round) => (
              <Link key={`${round.lotteryId}-${round.id}`} to={buildBuyLink(round)} className="member-round-card">
                <div className="member-round-card-head">
                  <div>
                    <strong>{round.lotteryName}</strong>
                    <span>{round.leagueName || round.lotteryCode || '-'}</span>
                  </div>
                  <span className={`badge ${statusBadgeClass(round.status)}`}>{getRoundStatusDisplay(round.status)}</span>
                </div>
                <div className="member-round-card-main">
                  <div>
                    <span>รอบ</span>
                    <strong>{getRoundDisplay(round)}</strong>
                  </div>
                  <div className="member-round-times">
                    <span>เปิดรับ: {formatWhen(getRoundOpenTime(round))}</span>
                    <span>ปิดรับ: {formatWhen(getRoundCloseTime(round))}</span>
                  </div>
                </div>
                <div className="member-round-card-action">
                  <span className="btn btn-primary btn-sm"><FiSend /> ซื้อเลย</span>
                  <FiChevronRight />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-text">ยังไม่มีรอบที่เปิดขายสำหรับบัญชีนี้</div>
          </div>
        )}
      </section>

      <section className="member-grid-two">
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
      </section>

      <section className="card member-panel">
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
      </section>
    </div>
  );
};

export default MemberDashboard;
