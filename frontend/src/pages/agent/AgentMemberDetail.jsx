import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiDollarSign, FiPhone, FiRefreshCw, FiRepeat, FiSave, FiWifi } from 'react-icons/fi';
import PageSkeleton, { SectionSkeleton } from '../../components/PageSkeleton';
import { useAuth } from '../../context/AuthContext';
import { agentCopy } from '../../i18n/th/agent';
import { getBetTypeLabel, getUserStatusLabel, getWalletDirectionLabel, getWalletEntryTypeLabel, getWalletReasonLabel } from '../../i18n/th/labels';
import { getAgentMemberBootstrap, getAgentMemberDetail, getWalletHistory, getWalletSummary, transferWalletCredit, updateAgentMemberProfile } from '../../services/api';
import { createMemberFormFromDetail, groupLotterySettingsByLeague, toggleBetType, updateLotterySetting } from './memberFormUtils';

const tabs = ['ข้อมูลทั่วไป', 'สิทธิ์หวย', 'กระเป๋า'];
const statusOptions = ['active', 'inactive', 'suspended'];
const betTypeKeys = ['3top', '3bottom', '3tod', '2top', '2bottom', '2tod', 'run_top', 'run_bottom'];
const toNumber = (value) => Number(value || 0);
const money = (value) => toNumber(value).toLocaleString('th-TH');
const formatDateTime = (value) => {
  if (!value) return agentCopy.memberDetail.noRecentActivity;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return agentCopy.memberDetail.noRecentActivity;
  return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

const AgentMemberDetail = () => {
  const navigate = useNavigate();
  const { memberId } = useParams();
  const { checkAuth } = useAuth();
  const [bootstrap, setBootstrap] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);
  const [tab, setTab] = useState('ข้อมูลทั่วไป');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletSubmitting, setWalletSubmitting] = useState(false);
  const [agentWallet, setAgentWallet] = useState(null);
  const [memberWallet, setMemberWallet] = useState(null);
  const [walletEntries, setWalletEntries] = useState([]);
  const [transferForm, setTransferForm] = useState({ direction: 'to_member', amount: '', note: '' });

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [bootstrapRes, detailRes] = await Promise.all([getAgentMemberBootstrap(), getAgentMemberDetail(memberId)]);
      setBootstrap(bootstrapRes.data);
      setDetail(detailRes.data);
      setForm(createMemberFormFromDetail(detailRes.data, bootstrapRes.data));
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'โหลดข้อมูลสมาชิกไม่สำเร็จ');
      navigate('/agent/customers');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadWalletData = async (silent = false) => {
    if (!silent) setWalletLoading(true);
    try {
      const [agentWalletRes, memberWalletRes, historyRes] = await Promise.all([
        getWalletSummary({}),
        getWalletSummary({ targetUserId: memberId }),
        getWalletHistory({ targetUserId: memberId, limit: 20 })
      ]);
      setAgentWallet(agentWalletRes.data);
      setMemberWallet(memberWalletRes.data);
      setWalletEntries(historyRes.data || []);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'โหลดความเคลื่อนไหวกระเป๋าไม่สำเร็จ');
    } finally {
      if (!silent) setWalletLoading(false);
    }
  };

  useEffect(() => {
    const loadAll = async () => { await Promise.all([load(), loadWalletData()]); };
    loadAll();
  }, [memberId]);

  const groupedLotteries = useMemo(() => groupLotterySettingsByLeague(form?.lotterySettings || []), [form?.lotterySettings]);
  const updateAccount = (field, value) => setForm((current) => ({ ...current, account: { ...current.account, [field]: value } }));
  const updateProfile = (field, value) => setForm((current) => ({ ...current, profile: { ...current.profile, [field]: value } }));
  const patchLottery = (lotteryTypeId, patch) => setForm((current) => ({ ...current, lotterySettings: updateLotterySetting(current.lotterySettings, lotteryTypeId, patch) }));

  const applyProfileToAllLotteries = () => {
    setForm((current) => ({
      ...current,
      lotterySettings: current.lotterySettings.map((lottery) => ({
        ...lottery,
        stockPercent: current.profile.stockPercent,
        ownerPercent: current.profile.ownerPercent,
        keepPercent: current.profile.keepPercent,
        commissionRate: current.profile.commissionRate
      }))
    }));
  };

  const save = async () => {
    if (!form?.account.username || !form?.account.name) {
      toast.error('กรุณากรอกชื่อผู้ใช้และชื่อแสดงผลให้ครบ');
      setTab('ข้อมูลทั่วไป');
      return;
    }

    setSaving(true);
    try {
      const res = await updateAgentMemberProfile(memberId, {
        account: { ...form.account },
        profile: {
          ...form.profile,
          stockPercent: toNumber(form.profile.stockPercent),
          ownerPercent: toNumber(form.profile.ownerPercent),
          keepPercent: toNumber(form.profile.keepPercent),
          commissionRate: toNumber(form.profile.commissionRate)
        },
        lotterySettings: form.lotterySettings.map((lottery) => ({
          lotteryTypeId: lottery.lotteryTypeId,
          isEnabled: lottery.isEnabled,
          rateProfileId: lottery.rateProfileId,
          enabledBetTypes: lottery.enabledBetTypes,
          minimumBet: toNumber(lottery.minimumBet),
          maximumBet: toNumber(lottery.maximumBet),
          maximumPerNumber: toNumber(lottery.maximumPerNumber),
          stockPercent: toNumber(lottery.stockPercent),
          ownerPercent: toNumber(lottery.ownerPercent),
          keepPercent: toNumber(lottery.keepPercent),
          commissionRate: toNumber(lottery.commissionRate),
          useCustomRates: Boolean(lottery.useCustomRates),
          customRates: lottery.customRates,
          keepMode: lottery.keepMode,
          keepCapAmount: toNumber(lottery.keepCapAmount),
          blockedNumbers: lottery.blockedNumbers,
          notes: lottery.notes
        }))
      });
      setDetail(res.data);
      setForm(createMemberFormFromDetail(res.data, bootstrap));
      toast.success('อัปเดตข้อมูลสมาชิกแล้ว');
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'อัปเดตข้อมูลสมาชิกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([load(true), loadWalletData(true)]);
    } finally {
      setRefreshing(false);
    }
  };

  const submitTransfer = async (event) => {
    event.preventDefault();
    const amount = toNumber(transferForm.amount);
    if (amount <= 0) {
      toast.error('จำนวนเครดิตต้องมากกว่า 0');
      return;
    }

    setWalletSubmitting(true);
    try {
      await transferWalletCredit({ memberId, direction: transferForm.direction, amount, note: transferForm.note });
      setTransferForm({ direction: transferForm.direction, amount: '', note: '' });
      await Promise.all([load(true), loadWalletData(true), checkAuth()]);
      toast.success('โอนเครดิตเรียบร้อย');
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'โอนเครดิตไม่สำเร็จ');
    } finally {
      setWalletSubmitting(false);
    }
  };

  if (loading || !form || !detail) return <PageSkeleton statCount={4} rows={5} sidebar compactSidebar />;

  const member = detail.member;

  return (
    <div className="agent-member-detail animate-fade-in">
      <section className="member-hero card">
        <div className="member-hero-copy">
          <div className="member-hero-topline">
            <Link to="/agent/customers" className="member-back-link"><FiArrowLeft /> กลับไปหน้าสมาชิก</Link>
            {member.isOnline ? <span className="member-online"><FiWifi /> ออนไลน์</span> : null}
          </div>
          <h1 className="page-title">{member.name}</h1>
          <p className="page-subtitle">@{member.username} • ใช้งานล่าสุด {formatDateTime(member.lastActiveAt)}</p>
          <div className="member-meta-row">
            <span><FiPhone /> {member.phone || agentCopy.memberDetail.noPhone}</span>
            <span>{getUserStatusLabel(member.status)}</span>
          </div>
        </div>
        <div className="detail-actions">
          <button className="btn btn-secondary" onClick={refresh} disabled={refreshing}>
            <FiRefreshCw className={refreshing ? 'spin-animation' : ''} />
            รีเฟรช
          </button>
          <button className="btn btn-secondary" onClick={() => navigate(`/agent/betting?memberId=${memberId}`)}>
            <FiDollarSign />
            ซื้อแทน
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <FiSave />
            {saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
          </button>
        </div>
      </section>

      <section className="detail-summary-grid">
        <article className="detail-summary-card"><span>เครดิตคงเหลือ</span><strong>{money(member.creditBalance)}</strong><small>ควบคุมผ่านสมุดเครดิต</small></article>
        <article className="detail-summary-card"><span>จำนวนรายการแทง</span><strong>{money(member.totals?.totalBets)}</strong><small>รายการที่ส่งเข้าระบบแล้ว</small></article>
        <article className="detail-summary-card"><span>ยอดขายรวม</span><strong>{money(member.totals?.totalAmount)}</strong><small>ยอดแทงรวมทั้งหมด</small></article>
        <article className="detail-summary-card"><span>หวยที่เปิดให้เล่น</span><strong>{money(member.configSummary?.enabledLotteryCount)}</strong><small>ตลาดที่สมาชิกเข้าถึงได้</small></article>
      </section>

      <section className="detail-tab-shell">
        <div className="tab-row">
          {tabs.map((item) => <button key={item} className={`tab-chip ${tab === item ? 'active' : ''}`} onClick={() => setTab(item)}>{item}</button>)}
        </div>
      </section>

      {tab === 'ข้อมูลทั่วไป' ? (
        <section className="card detail-panel">
          <div className="panel-head">
            <div>
              <div className="panel-eyebrow">โปรไฟล์และค่าเริ่มต้น</div>
              <h3 className="card-title">ข้อมูลทั่วไป</h3>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={applyProfileToAllLotteries}>คัดลอกค่าไปทุกตลาดหวย</button>
          </div>
          <div className="detail-grid">
            <label><span>ชื่อผู้ใช้</span><input value={form.account.username} onChange={(event) => updateAccount('username', event.target.value)} /></label>
            <label><span>รหัสผ่านใหม่</span><input type="password" value={form.account.password} onChange={(event) => updateAccount('password', event.target.value)} placeholder="เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน" /></label>
            <label><span>ชื่อแสดงผล</span><input value={form.account.name} onChange={(event) => updateAccount('name', event.target.value)} /></label>
            <label><span>เบอร์โทร</span><input value={form.account.phone} onChange={(event) => updateAccount('phone', event.target.value)} /></label>
            <label><span>สถานะ</span><select value={form.profile.status} onChange={(event) => updateProfile('status', event.target.value)}>{statusOptions.map((status) => <option key={status} value={status}>{getUserStatusLabel(status)}</option>)}</select></label>
            <label><span>เรทเริ่มต้น</span><select value={form.profile.defaultRateProfileId} onChange={(event) => updateProfile('defaultRateProfileId', event.target.value)}>{(bootstrap?.rateProfiles || []).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
            <label><span>หุ้น %</span><input type="number" min="0" max="100" value={form.profile.stockPercent} onChange={(event) => updateProfile('stockPercent', event.target.value)} /></label>
            <label><span>เจ้าของ %</span><input type="number" min="0" max="100" value={form.profile.ownerPercent} onChange={(event) => updateProfile('ownerPercent', event.target.value)} /></label>
            <label><span>เก็บ %</span><input type="number" min="0" max="100" value={form.profile.keepPercent} onChange={(event) => updateProfile('keepPercent', event.target.value)} /></label>
            <label><span>คอมมิชชัน %</span><input type="number" min="0" max="100" value={form.profile.commissionRate} onChange={(event) => updateProfile('commissionRate', event.target.value)} /></label>
            <label className="full"><span>หมายเหตุ</span><textarea rows="5" value={form.profile.notes} onChange={(event) => updateProfile('notes', event.target.value)} /></label>
          </div>
          <div className="detail-footnote">เครดิตคงเหลือจะถูกจัดการผ่านแท็บกระเป๋า เพื่อให้ทุกการเปลี่ยนแปลงถูกบันทึกลงสมุดเครดิต</div>
        </section>
      ) : null}

      {tab === 'สิทธิ์หวย' ? (
        <section className="detail-stack">
          {Object.entries(groupedLotteries).map(([leagueName, items]) => (
            <section key={leagueName} className="card detail-panel">
              <div className="panel-head">
                <div>
                  <div className="panel-eyebrow">หมวดหวย</div>
                  <h3 className="card-title">{leagueName}</h3>
                </div>
              </div>
              <div className="detail-stack">
                {items.map((lottery) => (
                  <article key={lottery.lotteryTypeId} className={`lottery-panel ${lottery.isEnabled ? '' : 'muted'}`}>
                    <div className="lottery-panel-head">
                      <div><strong>{lottery.lotteryName}</strong><span>{lottery.lotteryCode}</span></div>
                      <label className="inline-check"><input type="checkbox" checked={lottery.isEnabled} onChange={(event) => patchLottery(lottery.lotteryTypeId, { isEnabled: event.target.checked })} />เปิดใช้งาน</label>
                    </div>
                    <div className="detail-grid">
                      <label><span>โปรไฟล์เรท</span><select value={lottery.rateProfileId} onChange={(event) => patchLottery(lottery.lotteryTypeId, { rateProfileId: event.target.value })}>{lottery.availableRateProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
                      <label><span>ขั้นต่ำ</span><input type="number" min="0" value={lottery.minimumBet} onChange={(event) => patchLottery(lottery.lotteryTypeId, { minimumBet: event.target.value })} /></label>
                      <label><span>สูงสุด</span><input type="number" min="0" value={lottery.maximumBet} onChange={(event) => patchLottery(lottery.lotteryTypeId, { maximumBet: event.target.value })} /></label>
                      <label><span>สูงสุดต่อเลข</span><input type="number" min="0" value={lottery.maximumPerNumber} onChange={(event) => patchLottery(lottery.lotteryTypeId, { maximumPerNumber: event.target.value })} /></label>
                      <label><span>หุ้น %</span><input type="number" min="0" max="100" value={lottery.stockPercent} onChange={(event) => patchLottery(lottery.lotteryTypeId, { stockPercent: event.target.value })} /></label>
                      <label><span>เจ้าของ %</span><input type="number" min="0" max="100" value={lottery.ownerPercent} onChange={(event) => patchLottery(lottery.lotteryTypeId, { ownerPercent: event.target.value })} /></label>
                      <label><span>เก็บ %</span><input type="number" min="0" max="100" value={lottery.keepPercent} onChange={(event) => patchLottery(lottery.lotteryTypeId, { keepPercent: event.target.value })} /></label>
                      <label><span>คอมมิชชัน %</span><input type="number" min="0" max="100" value={lottery.commissionRate} onChange={(event) => patchLottery(lottery.lotteryTypeId, { commissionRate: event.target.value })} /></label>
                      <label><span>โหมดเก็บ</span><select value={lottery.keepMode} onChange={(event) => patchLottery(lottery.lotteryTypeId, { keepMode: event.target.value })}><option value="off">ปิด</option><option value="cap">จำกัดยอด</option></select></label>
                      <label><span>เพดานเก็บ</span><input type="number" min="0" value={lottery.keepCapAmount} onChange={(event) => patchLottery(lottery.lotteryTypeId, { keepCapAmount: event.target.value })} /></label>
                    </div>
                    <div className="lottery-toolbar"><label className="inline-check"><input type="checkbox" checked={lottery.useCustomRates} onChange={(event) => patchLottery(lottery.lotteryTypeId, { useCustomRates: event.target.checked })} />ใช้เรทกำหนดเอง</label></div>
                    <div className="bet-type-row">
                      {lottery.supportedBetTypes.map((betType) => (
                        <button
                          key={betType}
                          type="button"
                          className={`bet-chip ${lottery.enabledBetTypes.includes(betType) ? 'active' : ''}`}
                          onClick={() => setForm((current) => ({ ...current, lotterySettings: toggleBetType(current.lotterySettings, lottery.lotteryTypeId, betType) }))}
                        >
                          {getBetTypeLabel(betType)}
                        </button>
                      ))}
                    </div>
                    {lottery.useCustomRates ? (
                      <div className="detail-grid">
                        {betTypeKeys.map((betType) => (
                          <label key={betType}>
                            <span>{getBetTypeLabel(betType)}</span>
                            <input
                              type="number"
                              min="0"
                              value={lottery.customRates?.[betType] || 0}
                              onChange={(event) => patchLottery(lottery.lotteryTypeId, { customRates: { ...lottery.customRates, [betType]: event.target.value } })}
                            />
                          </label>
                        ))}
                      </div>
                    ) : null}
                    <label className="textarea-block"><span>เลขที่ปิดรับ</span><textarea rows="3" value={(lottery.blockedNumbers || []).join('\n')} onChange={(event) => patchLottery(lottery.lotteryTypeId, { blockedNumbers: event.target.value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean) })} placeholder="หนึ่งเลขต่อหนึ่งบรรทัด" /></label>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>
      ) : null}

      {tab === 'กระเป๋า' ? (
        <section className="detail-stack">
          {walletLoading ? <SectionSkeleton rows={5} /> : (
            <>
              <section className="detail-summary-grid">
                <article className="detail-summary-card"><span>ยอดเจ้ามือ</span><strong>{money(agentWallet?.account?.creditBalance)}</strong><small>กระเป๋าเจ้ามือ</small></article>
                <article className="detail-summary-card"><span>ยอดสมาชิก</span><strong>{money(memberWallet?.account?.creditBalance)}</strong><small>กระเป๋าสมาชิก</small></article>
                <article className="detail-summary-card"><span>เครดิตเข้า</span><strong>{money(memberWallet?.totals?.totalCreditIn)}</strong><small>ยอดรับเครดิตสะสม</small></article>
                <article className="detail-summary-card"><span>รายการในสมุดเครดิต</span><strong>{money(memberWallet?.totals?.transactionCount)}</strong><small>จำนวนแถวประวัติ</small></article>
              </section>

              <section className="wallet-grid">
                <section className="card detail-panel">
                  <div className="panel-head"><div><div className="panel-eyebrow">จัดการเครดิต</div><h3 className="card-title">โอนเครดิต</h3></div></div>
                  <form className="detail-stack" onSubmit={submitTransfer}>
                    <div className="detail-grid">
                      <label><span>ทิศทาง</span><select value={transferForm.direction} onChange={(event) => setTransferForm((current) => ({ ...current, direction: event.target.value }))}><option value="to_member">จากเจ้ามือไปสมาชิก</option><option value="from_member">จากสมาชิกไปเจ้ามือ</option></select></label>
                      <label><span>จำนวนเครดิต</span><input type="number" min="0" step="0.01" value={transferForm.amount} onChange={(event) => setTransferForm((current) => ({ ...current, amount: event.target.value }))} /></label>
                      <label className="full"><span>หมายเหตุ</span><textarea rows="4" value={transferForm.note} onChange={(event) => setTransferForm((current) => ({ ...current, note: event.target.value }))} placeholder={agentCopy.memberDetail.walletNotePlaceholder} /></label>
                    </div>
                    <div className="inline-actions"><button className="btn btn-primary" type="submit" disabled={walletSubmitting}><FiRepeat />{walletSubmitting ? 'กำลังโอน...' : 'ยืนยันโอนเครดิต'}</button></div>
                  </form>
                </section>

                <section className="card detail-panel">
                  <div className="panel-head"><div><div className="panel-eyebrow">ประวัติสมุดเครดิต</div><h3 className="card-title">ความเคลื่อนไหวล่าสุด</h3></div></div>
                  {walletEntries.length === 0 ? <div className="empty-state"><div className="empty-state-text">{agentCopy.memberDetail.noWalletActivity}</div></div> : (
                    <div className="detail-stack">
                      {walletEntries.map((entry) => (
                        <article key={entry.id} className={`wallet-row wallet-${entry.direction}`}>
                          <div className="wallet-main">
                            <div className="wallet-topline">
                              <strong>{getWalletEntryTypeLabel(entry.entryType)}</strong>
                              <span className={`wallet-direction-pill wallet-direction-${entry.direction}`}>{getWalletDirectionLabel(entry.direction)}</span>
                            </div>
                            <div className="wallet-meta">{entry.counterparty?.name || entry.performedBy?.name || agentCopy.memberDetail.systemActor} • {getWalletReasonLabel(entry.reasonCode)} • คงเหลือ {money(entry.balanceAfter)}</div>
                            {entry.note ? <div className="wallet-note-text">{entry.note}</div> : null}
                          </div>
                          <div className="wallet-right">
                            <strong className={entry.direction === 'credit' ? 'wallet-credit-text' : 'wallet-debit-text'}>{entry.direction === 'credit' ? '+' : '-'}{money(entry.amount)}</strong>
                            <span>{formatDateTime(entry.createdAt)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </section>
            </>
          )}
        </section>
      ) : null}

      <style>{`
        .agent-member-detail,.detail-stack{display:flex;flex-direction:column;gap:18px}
        .agent-member-detail{position:relative;isolation:isolate}
        .agent-member-detail::before{content:'';position:absolute;inset:-48px 0 auto;height:220px;background:radial-gradient(circle at top left,rgba(220,38,38,.12),transparent 62%);pointer-events:none;z-index:-1}
        .member-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;padding:24px;background:
          radial-gradient(circle at top right,rgba(220,38,38,.08),transparent 34%),
          linear-gradient(180deg,rgba(255,255,255,.98),rgba(255,248,248,.98));
          border:1px solid rgba(220,38,38,.16);box-shadow:0 18px 40px rgba(127,29,29,.08)}
        .member-hero-copy,.detail-actions,.tab-row,.inline-actions,.lottery-panel-head,.lottery-toolbar,.member-hero-topline{display:flex;gap:10px;flex-wrap:wrap}
        .member-hero-copy{flex-direction:column;min-width:0}
        .member-hero .page-title{margin:0;font-size:clamp(2.15rem,4vw,3.1rem);line-height:.94;letter-spacing:-.04em;color:var(--text-primary)}
        .member-hero .page-subtitle{margin:0;max-width:56ch;color:var(--text-secondary)}
        .member-back-link,.member-online,.member-meta-row span{display:inline-flex;align-items:center;gap:6px}
        .member-back-link{color:var(--text-secondary)}
        .member-online{padding:6px 12px;border-radius:999px;background:rgba(16,185,129,.12);color:var(--success);font-size:.82rem;font-weight:700}
        .member-meta-row{display:flex;gap:10px;flex-wrap:wrap}
        .member-meta-row span{padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.88);border:1px solid rgba(220,38,38,.12);color:var(--text-secondary);font-size:.82rem}
        .detail-summary-grid,.detail-grid,.wallet-grid{display:grid;gap:12px}
        .detail-summary-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
        .detail-summary-card,.lottery-panel,.wallet-row{border-radius:18px;border:1px solid rgba(220,38,38,.12);background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(255,248,248,.96))}
        .detail-summary-card{padding:16px;display:flex;flex-direction:column;gap:8px;min-height:126px}
        .detail-summary-card span,.detail-summary-card small,.detail-footnote,.panel-eyebrow,.lottery-panel-head span,.wallet-meta,.wallet-note-text,.wallet-right span{color:var(--text-secondary)}
        .detail-summary-card strong{font-size:1.7rem;line-height:1;letter-spacing:-.04em;color:var(--text-primary)}
        .detail-panel{padding:20px}
        .detail-tab-shell{padding:0;background:transparent;border:none;box-shadow:none}
        .panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
        .panel-head .card-title{margin:6px 0 0;font-size:1.15rem}
        .tab-row{padding:8px;border-radius:18px;background:rgba(255,255,255,.72);border:1px solid rgba(220,38,38,.1);box-shadow:var(--shadow-sm)}
        .tab-chip,.bet-chip{padding:8px 14px;border-radius:999px;border:1px solid rgba(220,38,38,.12);background:rgba(255,255,255,.9);color:var(--text-secondary);font-size:.8rem;font-weight:700}
        .tab-chip.active,.bet-chip.active{border-color:rgba(220,38,38,.26);background:rgba(220,38,38,.1);color:var(--primary-dark)}
        .detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .detail-grid label,.textarea-block{display:flex;flex-direction:column;gap:8px}
        .detail-grid label span,.textarea-block span{font-size:.78rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.08em;font-weight:700}
        .detail-grid input,.detail-grid select,.detail-grid textarea,.textarea-block textarea{width:100%;min-height:52px;padding:14px 16px;border-radius:16px;border:1px solid rgba(220,38,38,.12);background:rgba(255,255,255,.96);color:var(--text-primary)}
        .detail-grid input:focus,.detail-grid select:focus,.detail-grid textarea:focus,.textarea-block textarea:focus{outline:none;border-color:rgba(220,38,38,.32);box-shadow:0 0 0 4px rgba(220,38,38,.08)}
        .detail-grid .full{grid-column:1/-1}
        .lottery-panel{padding:18px}
        .lottery-panel.muted{opacity:.72}
        .lottery-panel-head{justify-content:space-between;margin-bottom:16px}
        .lottery-panel-head strong{display:block;margin-bottom:6px}
        .inline-check{display:inline-flex;align-items:center;gap:8px;color:var(--text-secondary)}
        .bet-type-row{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
        .wallet-grid{grid-template-columns:minmax(320px,.9fr) minmax(0,1.1fr)}
        .wallet-row{padding:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-left-width:3px}
        .wallet-credit{border-left-color:var(--success)} .wallet-debit{border-left-color:var(--danger)}
        .wallet-main{min-width:0;display:flex;flex-direction:column;gap:6px}
        .wallet-topline{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .wallet-direction-pill{padding:5px 10px;border-radius:999px;font-size:.72rem;font-weight:700}
        .wallet-direction-credit{background:rgba(16,185,129,.12);color:#34d399}
        .wallet-direction-debit{background:rgba(239,68,68,.12);color:#f87171}
        .wallet-right{text-align:right;display:flex;flex-direction:column;gap:4px}
        .wallet-credit-text{color:var(--success)} .wallet-debit-text{color:var(--danger)}
        @media (max-width:1100px){.detail-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.wallet-grid,.member-hero{grid-template-columns:1fr}.member-hero{display:flex;flex-direction:column;align-items:stretch}}
        @media (max-width:760px){.detail-summary-grid,.detail-grid,.wallet-grid{grid-template-columns:1fr}.detail-actions,.detail-actions .btn,.inline-actions,.inline-actions .btn{width:100%}.detail-actions .btn,.inline-actions .btn{justify-content:center}.wallet-row{flex-direction:column;align-items:flex-start}.wallet-right{text-align:left}}
      `}</style>
    </div>
  );
};

export default AgentMemberDetail;
