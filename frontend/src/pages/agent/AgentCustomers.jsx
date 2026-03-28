import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiPlus, FiRefreshCw, FiSearch, FiUsers, FiWifi, FiXCircle } from 'react-icons/fi';
import Modal from '../../components/Modal';
import { createAgentMember, deleteCustomer, getAgentMemberBootstrap, getAgentMembers } from '../../services/api';
import { createInitialMemberForm, groupLotterySettingsByLeague, toggleBetType, updateLotterySetting } from './memberFormUtils';

const steps = ['Account', 'Profile', 'Lotteries'];
const statusOptions = ['', 'active', 'inactive', 'suspended'];
const onlineOptions = ['', 'true', 'false'];
const betTypeLabels = { '3top': '3 Top', '3tod': '3 Tod', '2top': '2 Top', '2bottom': '2 Bottom', 'run_top': 'Run Top', 'run_bottom': 'Run Bottom' };
const toNumber = (value) => Number(value || 0);

const AgentCustomers = () => {
  const navigate = useNavigate();
  const [bootstrap, setBootstrap] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ search: '', status: '', online: '' });
  const [form, setForm] = useState(null);

  const loadMembers = async (query = filters, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getAgentMembers(query);
      setMembers(res.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load members');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadBootstrap = async () => {
    const res = await getAgentMemberBootstrap();
    setBootstrap(res.data);
    return res.data;
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([loadBootstrap(), loadMembers(filters, true)]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!bootstrap) return;
    const timer = setTimeout(() => loadMembers(filters, true), 250);
    return () => clearTimeout(timer);
  }, [filters.search, filters.status, filters.online]);

  const summary = useMemo(() => ({
    totalMembers: members.length,
    onlineMembers: members.filter((member) => member.isOnline).length,
    totalCredit: members.reduce((sum, member) => sum + toNumber(member.creditBalance), 0),
    totalSales: members.reduce((sum, member) => sum + toNumber(member.totals?.totalAmount), 0)
  }), [members]);

  const groupedLotteries = useMemo(
    () => groupLotterySettingsByLeague(form?.lotterySettings || []),
    [form?.lotterySettings]
  );

  const openWizard = async () => {
    try {
      const currentBootstrap = bootstrap || await loadBootstrap();
      setForm(createInitialMemberForm(currentBootstrap));
      setWizardStep(0);
      setShowWizard(true);
    } catch (error) {
      console.error(error);
      toast.error('Failed to prepare wizard');
    }
  };

  const closeWizard = () => {
    setShowWizard(false);
    setWizardStep(0);
    setForm(null);
  };

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadBootstrap(), loadMembers(filters, true)]);
    } finally {
      setRefreshing(false);
    }
  };

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

  const submitCreate = async (event) => {
    event.preventDefault();
    if (!form?.account.username || !form?.account.password || !form?.account.name) {
      toast.error('Username, password, and name are required');
      setWizardStep(0);
      return;
    }

    setSaving(true);
    try {
      await createAgentMember({
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
      toast.success('Member created');
      closeWizard();
      await loadMembers(filters, true);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to create member');
    } finally {
      setSaving(false);
    }
  };

  const deactivateMember = async (member) => {
    if (!window.confirm(`Deactivate ${member.name}?`)) return;
    try {
      await deleteCustomer(member.id);
      toast.success('Member deactivated');
      await loadMembers(filters, true);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to deactivate member');
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <div className="agent-members-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Member Management</h1>
          <p className="page-subtitle">Create members, transfer credit after setup, and manage lottery access.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={refreshAll} disabled={refreshing}>
            <FiRefreshCw className={refreshing ? 'spin-animation' : ''} />
            Refresh
          </button>
          <button className="btn btn-primary" onClick={openWizard}>
            <FiPlus />
            Add member
          </button>
        </div>
      </div>

      <section className="summary-grid">
        <div className="summary-card"><span>Members</span><strong>{summary.totalMembers}</strong></div>
        <div className="summary-card"><span>Online</span><strong>{summary.onlineMembers}</strong></div>
        <div className="summary-card"><span>Total credit</span><strong>{summary.totalCredit.toLocaleString()}</strong></div>
        <div className="summary-card"><span>Total sales</span><strong>{summary.totalSales.toLocaleString()}</strong></div>
      </section>

      <section className="card filter-card">
        <label className="search-box">
          <FiSearch />
          <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search name, username, phone, member code" />
        </label>
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          {statusOptions.map((status) => <option key={status || 'all'} value={status}>{status || 'all status'}</option>)}
        </select>
        <select value={filters.online} onChange={(event) => setFilters((current) => ({ ...current, online: event.target.value }))}>
          {onlineOptions.map((online) => <option key={online || 'all'} value={online}>{online === '' ? 'all presence' : online === 'true' ? 'online only' : 'offline only'}</option>)}
        </select>
      </section>

      <section className="member-list">
        {members.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon"><FiUsers /></div><div className="empty-state-text">No members found.</div></div>
        ) : members.map((member) => (
          <article key={member.id} className="member-card">
            <div className="member-card-header">
              <div>
                <div className="member-title-row">
                  <h3>{member.name}</h3>
                  <span className={`status-pill status-${member.status}`}>{member.status}</span>
                  {member.isOnline && <span className="online-pill"><FiWifi /> online</span>}
                </div>
                <div className="member-subtitle-row">
                  <span>@{member.username}</span>
                  <span>{member.memberCode || '-'}</span>
                  <span>{member.phone || '-'}</span>
                </div>
              </div>
              <div className="member-credit">
                <span>credit</span>
                <strong>{toNumber(member.creditBalance).toLocaleString()}</strong>
              </div>
            </div>

            <div className="member-metrics">
              <div><span>enabled lotteries</span><strong>{member.configSummary?.enabledLotteryCount || 0}</strong></div>
              <div><span>sales</span><strong>{toNumber(member.totals?.totalAmount).toLocaleString()}</strong></div>
              <div><span>won</span><strong>{toNumber(member.totals?.totalWon).toLocaleString()}</strong></div>
              <div><span>stock / keep</span><strong>{toNumber(member.stockPercent)}% / {toNumber(member.keepPercent)}%</strong></div>
            </div>

            <div className="member-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/agent/customers/${member.id}`)}>Manage</button>
              <button className="btn btn-danger btn-sm" onClick={() => deactivateMember(member)}>
                <FiXCircle />
                Deactivate
              </button>
            </div>
          </article>
        ))}
      </section>

      <Modal isOpen={showWizard} onClose={closeWizard} title="New Member Wizard" size="lg">
        {form && (
          <form onSubmit={submitCreate} className="wizard-form">
            <div className="wizard-steps">
              {steps.map((step, index) => (
                <button key={step} type="button" className={`wizard-step ${index === wizardStep ? 'active' : index < wizardStep ? 'done' : ''}`} onClick={() => setWizardStep(index)}>
                  <span>{index + 1}</span>
                  <strong>{step}</strong>
                </button>
              ))}
            </div>

            {wizardStep === 0 && (
              <div className="wizard-grid">
                <label><span>Username</span><input value={form.account.username} onChange={(event) => updateAccount('username', event.target.value)} required /></label>
                <label><span>Password</span><input type="password" value={form.account.password} onChange={(event) => updateAccount('password', event.target.value)} required /></label>
                <label><span>Name</span><input value={form.account.name} onChange={(event) => updateAccount('name', event.target.value)} required /></label>
                <label><span>Phone</span><input value={form.account.phone} onChange={(event) => updateAccount('phone', event.target.value)} /></label>
                <label className="full"><span>Member code</span><input value={form.account.memberCode} onChange={(event) => updateAccount('memberCode', event.target.value.toUpperCase())} placeholder="Leave empty to auto-generate" /></label>
              </div>
            )}

            {wizardStep === 1 && (
              <>
                <div className="wizard-grid">
                  <label><span>Status</span><select value={form.profile.status} onChange={(event) => updateProfile('status', event.target.value)}>{statusOptions.filter(Boolean).map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                  <label><span>Stock %</span><input type="number" min="0" max="100" value={form.profile.stockPercent} onChange={(event) => updateProfile('stockPercent', event.target.value)} /></label>
                  <label><span>Owner %</span><input type="number" min="0" max="100" value={form.profile.ownerPercent} onChange={(event) => updateProfile('ownerPercent', event.target.value)} /></label>
                  <label><span>Keep %</span><input type="number" min="0" max="100" value={form.profile.keepPercent} onChange={(event) => updateProfile('keepPercent', event.target.value)} /></label>
                  <label><span>Commission %</span><input type="number" min="0" max="100" value={form.profile.commissionRate} onChange={(event) => updateProfile('commissionRate', event.target.value)} /></label>
                  <label><span>Default rate</span><select value={form.profile.defaultRateProfileId} onChange={(event) => updateProfile('defaultRateProfileId', event.target.value)}>{(bootstrap?.rateProfiles || []).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
                  <label className="full"><span>Notes</span><textarea rows="4" value={form.profile.notes} onChange={(event) => updateProfile('notes', event.target.value)} /></label>
                </div>
                <div className="form-hint">New members start with zero balance. Use the wallet flow after creation to transfer credit.</div>
                <div className="inline-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={applyProfileToAllLotteries}>Apply profile values to all lotteries</button></div>
              </>
            )}

            {wizardStep === 2 && (
              <div className="lottery-groups">
                {Object.entries(groupedLotteries).map(([leagueName, items]) => (
                  <div key={leagueName} className="lottery-group">
                    <div className="lottery-group-title">{leagueName}</div>
                    {items.map((lottery) => (
                      <div key={lottery.lotteryTypeId} className={`lottery-card ${lottery.isEnabled ? '' : 'muted'}`}>
                        <div className="lottery-card-header">
                          <div>
                            <strong>{lottery.lotteryName}</strong>
                            <span>{lottery.lotteryCode}</span>
                          </div>
                          <label className="inline-check"><input type="checkbox" checked={lottery.isEnabled} onChange={(event) => patchLottery(lottery.lotteryTypeId, { isEnabled: event.target.checked })} />Enabled</label>
                        </div>

                        <div className="wizard-grid">
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

                        <div className="bet-type-row">
                          {lottery.supportedBetTypes.map((betType) => (
                            <button key={betType} type="button" className={`bet-chip ${lottery.enabledBetTypes.includes(betType) ? 'active' : ''}`} onClick={() => setForm((current) => ({ ...current, lotterySettings: toggleBetType(current.lotterySettings, lottery.lotteryTypeId, betType) }))}>
                              {betTypeLabels[betType] || betType}
                            </button>
                          ))}
                        </div>

                        <div className="lottery-advanced-row">
                          <label className="inline-check"><input type="checkbox" checked={lottery.useCustomRates} onChange={(event) => patchLottery(lottery.lotteryTypeId, { useCustomRates: event.target.checked })} />Use custom rates</label>
                        </div>

                        {lottery.useCustomRates && (
                          <div className="wizard-grid">
                            {Object.keys(betTypeLabels).map((betType) => (
                              <label key={betType}><span>{betTypeLabels[betType]}</span><input type="number" min="0" value={lottery.customRates?.[betType] || 0} onChange={(event) => patchLottery(lottery.lotteryTypeId, { customRates: { ...lottery.customRates, [betType]: event.target.value } })} /></label>
                            ))}
                          </div>
                        )}

                        <label className="wizard-grid-textarea">
                          <span>Blocked numbers</span>
                          <textarea rows="3" value={(lottery.blockedNumbers || []).join('\n')} onChange={(event) => patchLottery(lottery.lotteryTypeId, { blockedNumbers: event.target.value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean) })} placeholder="One number per line" />
                        </label>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-footer wizard-footer">
              <button type="button" className="btn btn-secondary" onClick={closeWizard}>Cancel</button>
              <div className="wizard-footer-right">
                {wizardStep > 0 && <button type="button" className="btn btn-secondary" onClick={() => setWizardStep((current) => current - 1)}>Back</button>}
                {wizardStep < steps.length - 1
                  ? <button type="button" className="btn btn-primary" onClick={() => setWizardStep((current) => current + 1)}>Next</button>
                  : <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create member'}</button>}
              </div>
            </div>

            <style>{`
              .wizard-form, .agent-members-page, .member-list, .lottery-groups, .lottery-group { display: flex; flex-direction: column; gap: 16px; }
              .page-actions, .member-actions, .member-title-row, .member-subtitle-row, .member-card-header, .lottery-card-header, .wizard-footer, .wizard-footer-right, .inline-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
              .summary-grid, .member-metrics, .wizard-grid, .wizard-steps { display: grid; gap: 12px; }
              .summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
              .summary-card, .member-card, .lottery-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px; }
              .summary-card span:first-child, .member-subtitle-row, .member-metrics span, .lottery-card-header span, .lottery-group-title { color: var(--text-muted); font-size: 0.78rem; }
              .summary-card strong { font-size: 1.3rem; }
              .filter-card { display: grid; grid-template-columns: 1.8fr 1fr 1fr; gap: 12px; }
              .search-box { display: flex; align-items: center; gap: 10px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-input); padding: 12px 14px; color: var(--text-muted); }
              .search-box input, .filter-card select, .wizard-grid input, .wizard-grid select, .wizard-grid textarea, .wizard-grid-textarea textarea { width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-primary); padding: 12px 14px; }
              .search-box input { border: none; padding: 0; background: transparent; }
              .member-card-header { justify-content: space-between; }
              .member-title-row h3 { font-size: 1.05rem; font-weight: 800; }
              .member-credit { min-width: 120px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--bg-surface); border: 1px solid var(--border); text-align: right; }
              .member-credit span { display: block; color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase; }
              .member-metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 14px 0; }
              .member-metrics > div { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; }
              .status-pill, .online-pill, .bet-chip { padding: 4px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
              .status-active { background: rgba(16, 185, 129, 0.14); color: #34d399; }
              .status-inactive { background: rgba(148, 163, 184, 0.16); color: #cbd5e1; }
              .status-suspended { background: rgba(239, 68, 68, 0.14); color: #f87171; }
              .online-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(56, 189, 248, 0.14); color: #7dd3fc; }
              .wizard-steps { grid-template-columns: repeat(3, minmax(0, 1fr)); }
              .wizard-step { display: flex; align-items: center; gap: 10px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-surface); color: var(--text-secondary); padding: 12px 14px; }
              .wizard-step span { width: 28px; height: 28px; border-radius: 50%; background: rgba(148, 163, 184, 0.16); display: inline-flex; align-items: center; justify-content: center; font-weight: 700; }
              .wizard-step.active, .wizard-step.done { border-color: var(--border-accent); color: var(--text-primary); }
              .wizard-step.active span, .wizard-step.done span { background: var(--primary-subtle); color: var(--primary-light); }
              .wizard-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              .wizard-grid .full { grid-column: 1 / -1; }
              .wizard-grid label { display: flex; flex-direction: column; gap: 8px; }
              .wizard-grid-textarea { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
              .wizard-grid label span { font-size: 0.78rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
              .lottery-group-title { font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; }
              .lottery-card.muted { opacity: 0.72; }
              .inline-check { display: inline-flex; align-items: center; gap: 8px; color: var(--text-secondary); }
              .bet-type-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
              .lottery-advanced-row { display: flex; justify-content: flex-end; margin-top: 12px; }
              .bet-chip { border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-secondary); }
              .bet-chip.active { border-color: var(--border-accent); background: var(--primary-subtle); color: var(--primary-light); }
              .form-hint { color: var(--text-muted); font-size: 0.82rem; margin-top: -4px; }
              @media (max-width: 920px) { .summary-grid, .filter-card, .member-metrics, .wizard-grid, .wizard-steps { grid-template-columns: 1fr; } .page-actions { width: 100%; } .page-actions .btn { flex: 1; justify-content: center; } }
            `}</style>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default AgentCustomers;
