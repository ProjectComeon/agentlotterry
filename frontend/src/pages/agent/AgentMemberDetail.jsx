import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiRefreshCw, FiRepeat, FiSave, FiWifi } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import {
  getAgentMemberBootstrap,
  getAgentMemberDetail,
  getWalletHistory,
  getWalletSummary,
  transferWalletCredit,
  updateAgentMemberProfile
} from '../../services/api';
import { createMemberFormFromDetail, groupLotterySettingsByLeague, toggleBetType, updateLotterySetting } from './memberFormUtils';

const tabs = ['General', 'Lotteries', 'Wallet'];
const statusOptions = ['active', 'inactive', 'suspended'];
const betTypeLabels = { '3top': '3 Top', '3tod': '3 Tod', '2top': '2 Top', '2bottom': '2 Bottom', 'run_top': 'Run Top', 'run_bottom': 'Run Bottom' };
const toNumber = (value) => Number(value || 0);

const AgentMemberDetail = () => {
  const navigate = useNavigate();
  const { memberId } = useParams();
  const { checkAuth } = useAuth();
  const [bootstrap, setBootstrap] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);
  const [tab, setTab] = useState('General');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletSubmitting, setWalletSubmitting] = useState(false);
  const [agentWallet, setAgentWallet] = useState(null);
  const [memberWallet, setMemberWallet] = useState(null);
  const [walletEntries, setWalletEntries] = useState([]);
  const [transferForm, setTransferForm] = useState({
    direction: 'to_member',
    amount: '',
    note: ''
  });

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [bootstrapRes, detailRes] = await Promise.all([
        getAgentMemberBootstrap(),
        getAgentMemberDetail(memberId)
      ]);

      setBootstrap(bootstrapRes.data);
      setDetail(detailRes.data);
      setForm(createMemberFormFromDetail(detailRes.data, bootstrapRes.data));
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to load member');
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
      toast.error(error.response?.data?.message || 'Failed to load wallet activity');
    } finally {
      if (!silent) setWalletLoading(false);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([load(), loadWalletData()]);
    };

    loadAll();
  }, [memberId]);

  const groupedLotteries = useMemo(
    () => groupLotterySettingsByLeague(form?.lotterySettings || []),
    [form?.lotterySettings]
  );

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
      toast.error('Username and name are required');
      setTab('General');
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
      toast.success('Member updated');
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to update member');
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
      toast.error('Transfer amount must be greater than zero');
      return;
    }

    setWalletSubmitting(true);
    try {
      await transferWalletCredit({
        memberId,
        direction: transferForm.direction,
        amount,
        note: transferForm.note
      });

      setTransferForm({
        direction: transferForm.direction,
        amount: '',
        note: ''
      });

      await Promise.all([load(true), loadWalletData(true), checkAuth()]);
      toast.success('Wallet transfer completed');
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to transfer credit');
    } finally {
      setWalletSubmitting(false);
    }
  };

  if (loading || !form || !detail) {
    return <div className="loading-container"><div className="spinner"></div></div>;
  }

  return (
    <div className="agent-member-detail animate-fade-in">
      <div className="page-header">
        <div>
          <div className="member-detail-topline">
            <Link to="/agent/customers" className="member-back-link"><FiArrowLeft /> Members</Link>
            {detail.member.isOnline && <span className="member-online"><FiWifi /> online</span>}
          </div>
          <h1 className="page-title">{detail.member.name}</h1>
          <p className="page-subtitle">@{detail.member.username} • {detail.member.memberCode || '-'} • last active {detail.member.lastActiveAt ? new Date(detail.member.lastActiveAt).toLocaleString() : '-'}</p>
        </div>
        <div className="detail-actions">
          <button className="btn btn-secondary" onClick={refresh} disabled={refreshing}>
            <FiRefreshCw className={refreshing ? 'spin-animation' : ''} />
            Refresh
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <FiSave />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <section className="detail-summary-grid">
        <div className="detail-summary-card"><span>Credit</span><strong>{toNumber(detail.member.creditBalance).toLocaleString()}</strong></div>
        <div className="detail-summary-card"><span>Total bets</span><strong>{toNumber(detail.member.totals?.totalBets).toLocaleString()}</strong></div>
        <div className="detail-summary-card"><span>Total sales</span><strong>{toNumber(detail.member.totals?.totalAmount).toLocaleString()}</strong></div>
        <div className="detail-summary-card"><span>Enabled lotteries</span><strong>{toNumber(detail.member.configSummary?.enabledLotteryCount).toLocaleString()}</strong></div>
      </section>

      <section className="card">
        <div className="tab-row">
          {tabs.map((item) => (
            <button key={item} className={`tab-chip ${tab === item ? 'active' : ''}`} onClick={() => setTab(item)}>
              {item}
            </button>
          ))}
        </div>
      </section>

      {tab === 'General' && (
        <section className="card detail-card-stack">
          <div className="detail-grid">
            <label><span>Username</span><input value={form.account.username} onChange={(event) => updateAccount('username', event.target.value)} /></label>
            <label><span>New password</span><input type="password" value={form.account.password} onChange={(event) => updateAccount('password', event.target.value)} placeholder="Leave empty to keep current password" /></label>
            <label><span>Name</span><input value={form.account.name} onChange={(event) => updateAccount('name', event.target.value)} /></label>
            <label><span>Phone</span><input value={form.account.phone} onChange={(event) => updateAccount('phone', event.target.value)} /></label>
            <label><span>Member code</span><input value={form.account.memberCode} onChange={(event) => updateAccount('memberCode', event.target.value.toUpperCase())} /></label>
            <label><span>Status</span><select value={form.profile.status} onChange={(event) => updateProfile('status', event.target.value)}>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label><span>Default rate</span><select value={form.profile.defaultRateProfileId} onChange={(event) => updateProfile('defaultRateProfileId', event.target.value)}>{(bootstrap?.rateProfiles || []).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
            <label><span>Stock %</span><input type="number" min="0" max="100" value={form.profile.stockPercent} onChange={(event) => updateProfile('stockPercent', event.target.value)} /></label>
            <label><span>Owner %</span><input type="number" min="0" max="100" value={form.profile.ownerPercent} onChange={(event) => updateProfile('ownerPercent', event.target.value)} /></label>
            <label><span>Keep %</span><input type="number" min="0" max="100" value={form.profile.keepPercent} onChange={(event) => updateProfile('keepPercent', event.target.value)} /></label>
            <label><span>Commission %</span><input type="number" min="0" max="100" value={form.profile.commissionRate} onChange={(event) => updateProfile('commissionRate', event.target.value)} /></label>
            <label className="full"><span>Notes</span><textarea rows="5" value={form.profile.notes} onChange={(event) => updateProfile('notes', event.target.value)} /></label>
          </div>
          <div className="wallet-note">Credit balance is managed from the Wallet tab so every change is written to the ledger.</div>
          <div className="inline-actions"><button className="btn btn-secondary btn-sm" onClick={applyProfileToAllLotteries}>Apply profile values to all lotteries</button></div>
        </section>
      )}

      {tab === 'Lotteries' && (
        <section className="detail-card-stack">
          {Object.entries(groupedLotteries).map(([leagueName, items]) => (
            <div key={leagueName} className="card detail-card-stack">
              <div className="league-title">{leagueName}</div>
              {items.map((lottery) => (
                <div key={lottery.lotteryTypeId} className={`lottery-row ${lottery.isEnabled ? '' : 'muted'}`}>
                  <div className="lottery-row-header">
                    <div>
                      <strong>{lottery.lotteryName}</strong>
                      <span>{lottery.lotteryCode}</span>
                    </div>
                    <label className="inline-check"><input type="checkbox" checked={lottery.isEnabled} onChange={(event) => patchLottery(lottery.lotteryTypeId, { isEnabled: event.target.checked })} />Enabled</label>
                  </div>
                  <div className="detail-grid">
                    <label><span>Rate profile</span><select value={lottery.rateProfileId} onChange={(event) => patchLottery(lottery.lotteryTypeId, { rateProfileId: event.target.value })}>{lottery.availableRateProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
                    <label><span>Min bet</span><input type="number" min="0" value={lottery.minimumBet} onChange={(event) => patchLottery(lottery.lotteryTypeId, { minimumBet: event.target.value })} /></label>
                    <label><span>Max bet</span><input type="number" min="0" value={lottery.maximumBet} onChange={(event) => patchLottery(lottery.lotteryTypeId, { maximumBet: event.target.value })} /></label>
                    <label><span>Max / number</span><input type="number" min="0" value={lottery.maximumPerNumber} onChange={(event) => patchLottery(lottery.lotteryTypeId, { maximumPerNumber: event.target.value })} /></label>
                    <label><span>Stock %</span><input type="number" min="0" max="100" value={lottery.stockPercent} onChange={(event) => patchLottery(lottery.lotteryTypeId, { stockPercent: event.target.value })} /></label>
                    <label><span>Owner %</span><input type="number" min="0" max="100" value={lottery.ownerPercent} onChange={(event) => patchLottery(lottery.lotteryTypeId, { ownerPercent: event.target.value })} /></label>
                    <label><span>Keep %</span><input type="number" min="0" max="100" value={lottery.keepPercent} onChange={(event) => patchLottery(lottery.lotteryTypeId, { keepPercent: event.target.value })} /></label>
                    <label><span>Commission %</span><input type="number" min="0" max="100" value={lottery.commissionRate} onChange={(event) => patchLottery(lottery.lotteryTypeId, { commissionRate: event.target.value })} /></label>
                    <label><span>Keep mode</span><select value={lottery.keepMode} onChange={(event) => patchLottery(lottery.lotteryTypeId, { keepMode: event.target.value })}><option value="off">off</option><option value="cap">cap</option></select></label>
                    <label><span>Keep cap</span><input type="number" min="0" value={lottery.keepCapAmount} onChange={(event) => patchLottery(lottery.lotteryTypeId, { keepCapAmount: event.target.value })} /></label>
                  </div>
                  <div className="lottery-toolbar">
                    <label className="inline-check"><input type="checkbox" checked={lottery.useCustomRates} onChange={(event) => patchLottery(lottery.lotteryTypeId, { useCustomRates: event.target.checked })} />Use custom rates</label>
                  </div>
                  <div className="bet-type-row">
                    {lottery.supportedBetTypes.map((betType) => (
                      <button key={betType} type="button" className={`bet-chip ${lottery.enabledBetTypes.includes(betType) ? 'active' : ''}`} onClick={() => setForm((current) => ({ ...current, lotterySettings: toggleBetType(current.lotterySettings, lottery.lotteryTypeId, betType) }))}>
                        {betTypeLabels[betType] || betType}
                      </button>
                    ))}
                  </div>
                  {lottery.useCustomRates && (
                    <div className="detail-grid">
                      {Object.keys(betTypeLabels).map((betType) => (
                        <label key={betType}><span>{betTypeLabels[betType]}</span><input type="number" min="0" value={lottery.customRates?.[betType] || 0} onChange={(event) => patchLottery(lottery.lotteryTypeId, { customRates: { ...lottery.customRates, [betType]: event.target.value } })} /></label>
                      ))}
                    </div>
                  )}
                  <label className="full textarea-block">
                    <span>Blocked numbers</span>
                    <textarea rows="3" value={(lottery.blockedNumbers || []).join('\n')} onChange={(event) => patchLottery(lottery.lotteryTypeId, { blockedNumbers: event.target.value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean) })} placeholder="One number per line" />
                  </label>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      {tab === 'Wallet' && (
        <section className="detail-card-stack">
          {walletLoading ? (
            <div className="loading-container"><div className="spinner"></div></div>
          ) : (
            <>
              <div className="detail-summary-grid">
                <div className="detail-summary-card"><span>Agent balance</span><strong>{toNumber(agentWallet?.account?.creditBalance).toLocaleString()}</strong></div>
                <div className="detail-summary-card"><span>Member balance</span><strong>{toNumber(memberWallet?.account?.creditBalance).toLocaleString()}</strong></div>
                <div className="detail-summary-card"><span>Member credit in</span><strong>{toNumber(memberWallet?.totals?.totalCreditIn).toLocaleString()}</strong></div>
                <div className="detail-summary-card"><span>Ledger entries</span><strong>{toNumber(memberWallet?.totals?.transactionCount).toLocaleString()}</strong></div>
              </div>

              <div className="card detail-card-stack">
                <div className="card-header">
                  <h3 className="card-title">Transfer Credit</h3>
                </div>

                <form className="detail-card-stack" onSubmit={submitTransfer}>
                  <div className="detail-grid">
                    <label>
                      <span>Direction</span>
                      <select value={transferForm.direction} onChange={(event) => setTransferForm((current) => ({ ...current, direction: event.target.value }))}>
                        <option value="to_member">Agent to member</option>
                        <option value="from_member">Member to agent</option>
                      </select>
                    </label>
                    <label>
                      <span>Amount</span>
                      <input type="number" min="0" step="0.01" value={transferForm.amount} onChange={(event) => setTransferForm((current) => ({ ...current, amount: event.target.value }))} />
                    </label>
                    <label className="full">
                      <span>Note</span>
                      <textarea rows="3" value={transferForm.note} onChange={(event) => setTransferForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional ledger note" />
                    </label>
                  </div>
                  <div className="inline-actions">
                    <button className="btn btn-primary" type="submit" disabled={walletSubmitting}>
                      <FiRepeat />
                      {walletSubmitting ? 'Transferring...' : 'Transfer credit'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="card detail-card-stack">
                <div className="card-header">
                  <h3 className="card-title">Recent Wallet Activity</h3>
                </div>

                {walletEntries.length === 0 ? (
                  <div className="empty-state"><div className="empty-state-text">No wallet activity for this member.</div></div>
                ) : walletEntries.map((entry) => (
                  <div key={entry.id} className={`wallet-row wallet-${entry.direction}`}>
                    <div>
                      <strong>{entry.entryType === 'transfer' ? 'Transfer' : 'Adjustment'}</strong>
                      <div className="wallet-meta">
                        {entry.counterparty?.name || entry.performedBy?.name || 'System'} • {entry.reasonCode || '-'} • Balance {toNumber(entry.balanceAfter).toLocaleString()}
                      </div>
                      {entry.note && <div className="wallet-note-text">{entry.note}</div>}
                    </div>
                    <div className="wallet-right">
                      <strong className={entry.direction === 'credit' ? 'wallet-credit-text' : 'wallet-debit-text'}>
                        {entry.direction === 'credit' ? '+' : '-'}{toNumber(entry.amount).toLocaleString()}
                      </strong>
                      <span>{new Date(entry.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <style>{`
        .agent-member-detail, .detail-card-stack { display: flex; flex-direction: column; gap: 16px; }
        .detail-actions, .tab-row, .member-detail-topline, .inline-actions, .lottery-row-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .detail-summary-grid, .detail-grid { display: grid; gap: 12px; }
        .detail-summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .detail-summary-card, .lottery-row { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px; }
        .detail-summary-card span:first-child, .league-title, .lottery-row-header span { color: var(--text-muted); font-size: 0.78rem; }
        .member-back-link, .member-online { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; }
        .member-online { padding: 4px 10px; border-radius: 999px; background: rgba(56, 189, 248, 0.14); color: #7dd3fc; }
        .tab-chip, .bet-chip { padding: 8px 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-secondary); font-size: 0.78rem; font-weight: 700; }
        .tab-chip.active, .bet-chip.active { border-color: var(--border-accent); background: var(--primary-subtle); color: var(--primary-light); }
        .detail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .detail-grid label { display: flex; flex-direction: column; gap: 8px; }
        .detail-grid label span { font-size: 0.78rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
        .detail-grid input, .detail-grid select, .detail-grid textarea, .textarea-block textarea { width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-primary); padding: 12px 14px; }
        .detail-grid .full { grid-column: 1 / -1; }
        .league-title { font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; }
        .lottery-row.muted { opacity: 0.72; }
        .inline-check { display: inline-flex; align-items: center; gap: 8px; color: var(--text-secondary); }
        .lottery-toolbar { display: flex; justify-content: flex-end; margin-top: 12px; }
        .bet-type-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .textarea-block { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
        .wallet-note { color: var(--text-muted); font-size: 0.82rem; margin-top: -4px; }
        .wallet-row { background: var(--bg-card); border: 1px solid var(--border); border-left-width: 3px; border-radius: var(--radius-md); padding: 14px; display: flex; justify-content: space-between; gap: 12px; }
        .wallet-credit { border-left-color: var(--success); }
        .wallet-debit { border-left-color: var(--danger); }
        .wallet-meta, .wallet-right span, .wallet-note-text { color: var(--text-muted); font-size: 0.8rem; }
        .wallet-note-text { margin-top: 6px; }
        .wallet-right { text-align: right; display: flex; flex-direction: column; gap: 4px; }
        .wallet-credit-text { color: var(--success); }
        .wallet-debit-text { color: var(--danger); }
        @media (max-width: 920px) { .detail-summary-grid, .detail-grid { grid-template-columns: 1fr; } .detail-actions { width: 100%; } .detail-actions .btn { flex: 1; justify-content: center; } }
      `}</style>
    </div>
  );
};

export default AgentMemberDetail;
