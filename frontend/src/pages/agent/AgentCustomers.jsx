import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiBarChart2, FiChevronRight, FiCreditCard, FiDollarSign, FiHash, FiPhone, FiPlus, FiRefreshCw, FiSearch, FiTrendingUp, FiUsers, FiWifi, FiXCircle } from 'react-icons/fi';
import Modal from '../../components/Modal';
import PageSkeleton from '../../components/PageSkeleton';
import { agentCopy } from '../../i18n/th/agent';
import { getBetTypeLabel, getUserStatusLabel } from '../../i18n/th/labels';
import { createAgentMember, deleteCustomer, getAgentMemberBootstrap, getAgentMembers } from '../../services/api';
import { createInitialMemberForm, groupLotterySettingsByLeague, toggleBetType, updateLotterySetting } from './memberFormUtils';

const copy = agentCopy.customers;
const steps = copy.steps;
const statusOptions = ['', 'active', 'inactive', 'suspended'];
const onlineOptions = ['', 'true', 'false'];
const sortOptions = [
  { value: 'recent', label: copy.sortOptions.recent },
  { value: 'credit_desc', label: copy.sortOptions.credit_desc },
  { value: 'sales_desc', label: copy.sortOptions.sales_desc },
  { value: 'online_first', label: copy.sortOptions.online_first },
  { value: 'name_asc', label: copy.sortOptions.name_asc }
];
const toNumber = (value) => Number(value || 0);
const formatNumber = (value) => toNumber(value).toLocaleString('th-TH');
const formatDateTime = (value) => {
  if (!value) return agentCopy.dashboard.noRecentActivity;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return agentCopy.dashboard.noRecentActivity;
  return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};
const getInitial = (value) => (value || '?').trim().charAt(0).toUpperCase();

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
  const [sortBy, setSortBy] = useState('recent');
  const [form, setForm] = useState(null);

  const loadMembers = async (query = filters, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getAgentMembers(query);
      setMembers(res.data || []);
    } catch (error) {
      console.error(error);
      toast.error(copy.wizard.loadError);
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

  const displayedMembers = useMemo(() => {
    const sorted = [...members];

    sorted.sort((left, right) => {
      if (sortBy === 'credit_desc') return toNumber(right.creditBalance) - toNumber(left.creditBalance);
      if (sortBy === 'sales_desc') return toNumber(right.totals?.totalAmount) - toNumber(left.totals?.totalAmount);
      if (sortBy === 'online_first') return Number(Boolean(right.isOnline)) - Number(Boolean(left.isOnline));
      if (sortBy === 'name_asc') return String(left.name || '').localeCompare(String(right.name || ''), 'th');

      const leftTime = left.lastActiveAt ? new Date(left.lastActiveAt).getTime() : 0;
      const rightTime = right.lastActiveAt ? new Date(right.lastActiveAt).getTime() : 0;
      return rightTime - leftTime;
    });

    return sorted;
  }, [members, sortBy]);

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
      toast.error(copy.wizard.bootstrapError);
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
      toast.error(copy.wizard.requiredError);
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
      toast.success(copy.wizard.createSuccess);
      closeWizard();
      await loadMembers(filters, true);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || copy.wizard.createError);
    } finally {
      setSaving(false);
    }
  };

  const deactivateMember = async (member) => {
    if (!window.confirm(copy.confirmDeactivate(member.name))) return;
    try {
      await deleteCustomer(member.id);
      toast.success(copy.wizard.deactivateSuccess);
      await loadMembers(filters, true);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || copy.wizard.deactivateError);
    }
  };

  if (loading) return <PageSkeleton statCount={4} rows={5} sidebar />;

  return (
    <div className="agent-members-page animate-fade-in">
      <section className="members-hero card">
        <div className="members-hero-copy">
          <span className="section-eyebrow">{copy.heroEyebrow}</span>
          <h1 className="page-title">{copy.heroTitle}</h1>
          <p className="page-subtitle">{copy.heroSubtitle}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={refreshAll} disabled={refreshing}>
            <FiRefreshCw className={refreshing ? 'spin-animation' : ''} />
            {copy.refresh}
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/agent/betting')}>
            <FiDollarSign />
            ซื้อแทน
          </button>
          <button className="btn btn-primary" onClick={openWizard}>
            <FiPlus />
            {copy.addMember}
          </button>
        </div>
      </section>

      <section className="summary-grid">
        <div className="summary-card summary-card-highlight">
          <div className="summary-card-top">
            <span className="summary-icon"><FiUsers /></span>
            <span className="summary-label">{copy.totalMembers}</span>
          </div>
          <strong>{formatNumber(summary.totalMembers)}</strong>
          <p>{copy.totalMembersHint}</p>
        </div>
        <div className="summary-card">
          <div className="summary-card-top">
            <span className="summary-icon"><FiWifi /></span>
            <span className="summary-label">{copy.onlineMembers}</span>
          </div>
          <strong>{formatNumber(summary.onlineMembers)}</strong>
          <p>{copy.onlineMembersHint}</p>
        </div>
        <div className="summary-card">
          <div className="summary-card-top">
            <span className="summary-icon"><FiCreditCard /></span>
            <span className="summary-label">{copy.totalCredit}</span>
          </div>
          <strong>{formatNumber(summary.totalCredit)}</strong>
          <p>{copy.totalCreditHint}</p>
        </div>
        <div className="summary-card">
          <div className="summary-card-top">
            <span className="summary-icon"><FiTrendingUp /></span>
            <span className="summary-label">{copy.totalSales}</span>
          </div>
          <strong>{formatNumber(summary.totalSales)}</strong>
          <p>{copy.totalSalesHint}</p>
        </div>
      </section>

      <section className="card filter-card">
        <div className="filter-card-head">
          <div>
          <div className="filter-title">{copy.filterTitle}</div>
            <div className="filter-subtitle">{copy.filterSubtitle}</div>
          </div>
          <div className="filter-count">{copy.count(formatNumber(displayedMembers.length))}</div>
        </div>
        <div className="filter-toolbar">
          <label className="search-box">
            <FiSearch />
            <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder={copy.searchPlaceholder} />
          </label>
          <label className="field-inline">
            <span>{copy.statusLabel}</span>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              {statusOptions.map((status) => <option key={status || 'all'} value={status}>{status ? getUserStatusLabel(status) : copy.allStatuses}</option>)}
            </select>
          </label>
          <label className="field-inline">
            <span>{copy.presenceLabel}</span>
            <select value={filters.online} onChange={(event) => setFilters((current) => ({ ...current, online: event.target.value }))}>
              {onlineOptions.map((online) => <option key={online || 'all'} value={online}>{online === '' ? copy.allPresence : online === 'true' ? copy.onlineOnly : copy.offlineOnly}</option>)}
            </select>
          </label>
          <label className="field-inline">
            <span>{copy.sortLabel}</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="member-list">
        {displayedMembers.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon"><FiUsers /></div><div className="empty-state-text">{copy.empty}</div></div>
        ) : displayedMembers.map((member) => (
          <article key={member.id} className="member-card">
            <div className="member-card-header">
              <div className="member-identity">
                <div className="member-avatar">{getInitial(member.name)}</div>
                <div className="member-heading">
                  <div className="member-title-row">
                    <h3>{member.name}</h3>
                    <span className={`status-pill status-${member.status}`}>{getUserStatusLabel(member.status)}</span>
                    {member.isOnline && <span className="online-pill"><FiWifi /> {agentCopy.dashboard.online}</span>}
                  </div>
                  <div className="member-subtitle-row">
                    <span>@{member.username}</span>
                    <span><FiHash /> {member.memberCode || copy.noMemberCode}</span>
                    <span><FiPhone /> {member.phone || copy.noPhone}</span>
                  </div>
                  <div className="member-last-active">{copy.lastActivePrefix}: {member.isOnline ? copy.currentlyOnline : formatDateTime(member.lastActiveAt)}</div>
                </div>
              </div>
              <div className="member-credit">
                <span>{copy.remainingCredit}</span>
                <strong>{formatNumber(member.creditBalance)}</strong>
              </div>
            </div>

            <div className="member-metrics">
              <div>
                <span>{copy.enabledLotteries}</span>
                <strong>{formatNumber(member.configSummary?.enabledLotteryCount || 0)}</strong>
              </div>
              <div>
                <span>{copy.sales}</span>
                <strong>{formatNumber(member.totals?.totalAmount)}</strong>
              </div>
              <div>
                <span>{copy.won}</span>
                <strong>{formatNumber(member.totals?.totalWon)}</strong>
              </div>
              <div>
                <span>{copy.stockKeep}</span>
                <strong>{toNumber(member.stockPercent)}% / {toNumber(member.keepPercent)}%</strong>
              </div>
            </div>

            <div className="member-actions">
              <div className="member-actions-copy">
                <span className="member-actions-label">{copy.memberSummary}</span>
                <div className="member-actions-hint">
                  <FiBarChart2 />
                  {copy.enabledMarketHint(formatNumber(member.configSummary?.enabledLotteryCount || 0))}
                </div>
              </div>
              <div className="member-actions-buttons">
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/agent/betting?memberId=${member.id}`)}>
                  <FiDollarSign />
                  ซื้อแทน
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/agent/customers/${member.id}`)}>
                  {copy.manage}
                  <FiChevronRight />
                </button>
              <button className="btn btn-danger btn-sm" onClick={() => deactivateMember(member)}>
                <FiXCircle />
                {copy.deactivate}
              </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      <Modal isOpen={showWizard} onClose={closeWizard} title={copy.wizardTitle} size="lg">
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
                <label><span>{copy.wizard.account.username}</span><input value={form.account.username} onChange={(event) => updateAccount('username', event.target.value)} required /></label>
                <label><span>{copy.wizard.account.password}</span><input type="password" value={form.account.password} onChange={(event) => updateAccount('password', event.target.value)} required /></label>
                <label><span>{copy.wizard.account.name}</span><input value={form.account.name} onChange={(event) => updateAccount('name', event.target.value)} required /></label>
                <label><span>{copy.wizard.account.phone}</span><input value={form.account.phone} onChange={(event) => updateAccount('phone', event.target.value)} /></label>
                <label className="full"><span>{copy.wizard.account.memberCode}</span><input value={form.account.memberCode} onChange={(event) => updateAccount('memberCode', event.target.value.toUpperCase())} placeholder={copy.wizard.account.memberCodePlaceholder} /></label>
              </div>
            )}

            {wizardStep === 1 && (
              <>
                <div className="wizard-grid">
                  <label><span>{copy.wizard.profile.status}</span><select value={form.profile.status} onChange={(event) => updateProfile('status', event.target.value)}>{statusOptions.filter(Boolean).map((status) => <option key={status} value={status}>{getUserStatusLabel(status)}</option>)}</select></label>
                  <label><span>{copy.wizard.profile.stockPercent}</span><input type="number" min="0" max="100" value={form.profile.stockPercent} onChange={(event) => updateProfile('stockPercent', event.target.value)} /></label>
                  <label><span>{copy.wizard.profile.ownerPercent}</span><input type="number" min="0" max="100" value={form.profile.ownerPercent} onChange={(event) => updateProfile('ownerPercent', event.target.value)} /></label>
                  <label><span>{copy.wizard.profile.keepPercent}</span><input type="number" min="0" max="100" value={form.profile.keepPercent} onChange={(event) => updateProfile('keepPercent', event.target.value)} /></label>
                  <label><span>{copy.wizard.profile.commissionRate}</span><input type="number" min="0" max="100" value={form.profile.commissionRate} onChange={(event) => updateProfile('commissionRate', event.target.value)} /></label>
                  <label><span>{copy.wizard.profile.defaultRateProfileId}</span><select value={form.profile.defaultRateProfileId} onChange={(event) => updateProfile('defaultRateProfileId', event.target.value)}>{(bootstrap?.rateProfiles || []).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
                  <label className="full"><span>{copy.wizard.profile.notes}</span><textarea rows="4" value={form.profile.notes} onChange={(event) => updateProfile('notes', event.target.value)} /></label>
                </div>
                <div className="form-hint">{copy.wizard.profile.startCreditHint}</div>
                <div className="inline-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={applyProfileToAllLotteries}>{copy.wizard.profile.applyProfileToAll}</button></div>
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
                          <label className="inline-check"><input type="checkbox" checked={lottery.isEnabled} onChange={(event) => patchLottery(lottery.lotteryTypeId, { isEnabled: event.target.checked })} />{copy.wizard.lottery.enabled}</label>
                        </div>

                        <div className="wizard-grid">
                          <label><span>{copy.wizard.lottery.rateProfile}</span><select value={lottery.rateProfileId} onChange={(event) => patchLottery(lottery.lotteryTypeId, { rateProfileId: event.target.value })}>{lottery.availableRateProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
                          <label><span>{copy.wizard.lottery.minimumBet}</span><input type="number" min="0" value={lottery.minimumBet} onChange={(event) => patchLottery(lottery.lotteryTypeId, { minimumBet: event.target.value })} /></label>
                          <label><span>{copy.wizard.lottery.maximumBet}</span><input type="number" min="0" value={lottery.maximumBet} onChange={(event) => patchLottery(lottery.lotteryTypeId, { maximumBet: event.target.value })} /></label>
                          <label><span>{copy.wizard.lottery.maximumPerNumber}</span><input type="number" min="0" value={lottery.maximumPerNumber} onChange={(event) => patchLottery(lottery.lotteryTypeId, { maximumPerNumber: event.target.value })} /></label>
                          <label><span>{copy.wizard.profile.stockPercent}</span><input type="number" min="0" max="100" value={lottery.stockPercent} onChange={(event) => patchLottery(lottery.lotteryTypeId, { stockPercent: event.target.value })} /></label>
                          <label><span>{copy.wizard.profile.ownerPercent}</span><input type="number" min="0" max="100" value={lottery.ownerPercent} onChange={(event) => patchLottery(lottery.lotteryTypeId, { ownerPercent: event.target.value })} /></label>
                          <label><span>{copy.wizard.profile.keepPercent}</span><input type="number" min="0" max="100" value={lottery.keepPercent} onChange={(event) => patchLottery(lottery.lotteryTypeId, { keepPercent: event.target.value })} /></label>
                          <label><span>{copy.wizard.profile.commissionRate}</span><input type="number" min="0" max="100" value={lottery.commissionRate} onChange={(event) => patchLottery(lottery.lotteryTypeId, { commissionRate: event.target.value })} /></label>
                          <label><span>{copy.wizard.lottery.keepMode}</span><select value={lottery.keepMode} onChange={(event) => patchLottery(lottery.lotteryTypeId, { keepMode: event.target.value })}><option value="off">{copy.wizard.lottery.keepModes.off}</option><option value="cap">{copy.wizard.lottery.keepModes.cap}</option></select></label>
                          <label><span>{copy.wizard.lottery.keepCapAmount}</span><input type="number" min="0" value={lottery.keepCapAmount} onChange={(event) => patchLottery(lottery.lotteryTypeId, { keepCapAmount: event.target.value })} /></label>
                        </div>

                        <div className="bet-type-row">
                          {lottery.supportedBetTypes.map((betType) => (
                            <button key={betType} type="button" className={`bet-chip ${lottery.enabledBetTypes.includes(betType) ? 'active' : ''}`} onClick={() => setForm((current) => ({ ...current, lotterySettings: toggleBetType(current.lotterySettings, lottery.lotteryTypeId, betType) }))}>
                              {getBetTypeLabel(betType)}
                            </button>
                          ))}
                        </div>

                        <div className="lottery-advanced-row">
                          <label className="inline-check"><input type="checkbox" checked={lottery.useCustomRates} onChange={(event) => patchLottery(lottery.lotteryTypeId, { useCustomRates: event.target.checked })} />{copy.wizard.lottery.customRates}</label>
                        </div>

                        {lottery.useCustomRates && (
                          <div className="wizard-grid">
                            {lottery.supportedBetTypes.map((betType) => (
                              <label key={betType}><span>{getBetTypeLabel(betType)}</span><input type="number" min="0" value={lottery.customRates?.[betType] || 0} onChange={(event) => patchLottery(lottery.lotteryTypeId, { customRates: { ...lottery.customRates, [betType]: event.target.value } })} /></label>
                            ))}
                          </div>
                        )}

                        <label className="wizard-grid-textarea">
                          <span>{copy.wizard.lottery.blockedNumbers}</span>
                          <textarea rows="3" value={(lottery.blockedNumbers || []).join('\n')} onChange={(event) => patchLottery(lottery.lotteryTypeId, { blockedNumbers: event.target.value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean) })} placeholder={copy.wizard.lottery.blockedNumbersPlaceholder} />
                        </label>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-footer wizard-footer">
              <button type="button" className="btn btn-secondary" onClick={closeWizard}>{copy.wizard.cancel}</button>
              <div className="wizard-footer-right">
                {wizardStep > 0 && <button type="button" className="btn btn-secondary" onClick={() => setWizardStep((current) => current - 1)}>{copy.wizard.back}</button>}
                {wizardStep < steps.length - 1
                  ? <button type="button" className="btn btn-primary" onClick={() => setWizardStep((current) => current + 1)}>{copy.wizard.next}</button>
                  : <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? copy.wizard.creating : copy.wizard.submit}</button>}
              </div>
            </div>

          </form>
        )}
      </Modal>
      <style>{`
        .agent-members-page, .wizard-form, .member-list, .lottery-groups, .lottery-group {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .agent-members-page {
          position: relative;
          isolation: isolate;
        }

        .agent-members-page::before {
          content: '';
          position: absolute;
          inset: -40px 0 auto;
          height: 240px;
          background:
            radial-gradient(circle at top left, rgba(220, 38, 38, 0.14), transparent 58%),
            radial-gradient(circle at top right, rgba(248, 113, 113, 0.08), transparent 28%);
          pointer-events: none;
          z-index: -1;
        }

        .members-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 24px;
          padding: 24px;
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(255, 244, 244, 0.98)),
            radial-gradient(circle at top right, rgba(248, 113, 113, 0.14), transparent 34%);
          border-color: rgba(220, 38, 38, 0.14);
          box-shadow: 0 20px 48px rgba(127, 29, 29, 0.12);
        }

        .members-hero-copy {
          max-width: 720px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .section-eyebrow {
          font-size: 0.78rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--primary-light);
          font-weight: 700;
        }

        .members-hero .page-title {
          margin: 0;
          font-size: clamp(2rem, 4vw, 3rem);
          line-height: 0.96;
          letter-spacing: -0.04em;
        }

        .members-hero .page-subtitle {
          margin: 0;
          max-width: 58ch;
          font-size: 1rem;
          color: var(--text-secondary);
        }

        .page-actions, .member-title-row, .member-subtitle-row, .lottery-card-header, .wizard-footer, .wizard-footer-right, .inline-actions, .member-actions-buttons {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .summary-grid, .member-metrics, .wizard-grid, .wizard-steps {
          display: grid;
          gap: 14px;
        }

        .summary-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .summary-card, .member-card, .lottery-card {
          position: relative;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(255, 247, 247, 0.98));
          border: 1px solid rgba(220, 38, 38, 0.12);
          border-radius: 22px;
          padding: 18px;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }

        .summary-card::after, .member-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.45), transparent 42%);
          pointer-events: none;
        }

        .summary-card-highlight {
          border-color: rgba(220, 38, 38, 0.18);
          box-shadow: 0 16px 32px rgba(220, 38, 38, 0.08);
        }

        .summary-card-top {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }

        .summary-icon {
          width: 40px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          background: rgba(220, 38, 38, 0.08);
          color: var(--primary);
          border: 1px solid rgba(220, 38, 38, 0.14);
        }

        .summary-label, .member-subtitle-row, .member-metrics span, .lottery-card-header span, .lottery-group-title, .member-last-active, .member-actions-label, .filter-subtitle {
          color: var(--text-muted);
          font-size: 0.82rem;
        }

        .summary-card strong {
          display: block;
          font-size: clamp(1.6rem, 3vw, 2.1rem);
          line-height: 1;
          letter-spacing: -0.04em;
          margin-bottom: 8px;
        }

        .summary-card p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.92rem;
        }

        .filter-card {
          gap: 18px;
          padding: 22px;
        }

        .filter-card-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-end;
          flex-wrap: wrap;
        }

        .filter-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .filter-count {
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid rgba(220, 38, 38, 0.14);
          background: rgba(220, 38, 38, 0.08);
          color: var(--primary);
          font-size: 0.82rem;
          font-weight: 700;
        }

        .filter-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1.8fr) repeat(3, minmax(180px, 0.8fr));
          gap: 12px;
        }

        .search-box, .field-inline select, .wizard-grid input, .wizard-grid select, .wizard-grid textarea, .wizard-grid-textarea textarea {
          width: 100%;
          min-height: 52px;
          background: rgba(255, 250, 250, 0.96);
          border: 1px solid rgba(220, 38, 38, 0.12);
          border-radius: 16px;
          color: var(--text-primary);
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 16px;
          color: var(--text-muted);
        }

        .search-box:focus-within, .field-inline select:focus, .wizard-grid input:focus, .wizard-grid select:focus, .wizard-grid textarea:focus, .wizard-grid-textarea textarea:focus {
          border-color: rgba(220, 38, 38, 0.32);
          box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.08);
          outline: none;
        }

        .search-box input {
          border: none;
          padding: 0;
          background: transparent;
          color: var(--text-primary);
        }

        .search-box input:focus {
          outline: none;
        }

        .field-inline {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .field-inline span, .wizard-grid label span {
          font-size: 0.78rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .field-inline select, .wizard-grid input, .wizard-grid select, .wizard-grid textarea, .wizard-grid-textarea textarea {
          padding: 14px 16px;
          appearance: none;
        }

        .member-list {
          gap: 16px;
        }

        .member-card {
          padding: 20px;
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .member-card:hover {
          transform: translateY(-2px);
          border-color: rgba(220, 38, 38, 0.22);
          box-shadow: 0 20px 36px rgba(127, 29, 29, 0.12);
        }

        .member-card-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }

        .member-identity {
          display: flex;
          gap: 16px;
          min-width: 0;
          flex: 1;
        }

        .member-avatar {
          width: 56px;
          height: 56px;
          flex: 0 0 56px;
          border-radius: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--primary);
          background: linear-gradient(135deg, rgba(220, 38, 38, 0.14), rgba(255, 242, 242, 0.92));
          border: 1px solid rgba(220, 38, 38, 0.14);
        }

        .member-heading {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .member-title-row h3 {
          margin: 0;
          font-size: 1.22rem;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .member-subtitle-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .member-subtitle-row span {
          display: inline-flex;
          gap: 6px;
          align-items: center;
          padding: 7px 11px;
          border-radius: 999px;
          background: rgba(255, 249, 249, 0.92);
          border: 1px solid rgba(220, 38, 38, 0.1);
        }

        .member-credit {
          min-width: 172px;
          padding: 14px 16px;
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(255, 249, 249, 0.98), rgba(255, 240, 240, 0.98));
          border: 1px solid rgba(220, 38, 38, 0.14);
          text-align: right;
        }

        .member-credit span {
          display: block;
          color: var(--text-muted);
          font-size: 0.74rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 10px;
        }

        .member-credit strong {
          font-size: 1.7rem;
          line-height: 1;
          letter-spacing: -0.04em;
        }

        .member-metrics {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin: 18px 0;
        }

        .member-metrics > div {
          background: rgba(255, 251, 251, 0.96);
          border: 1px solid rgba(220, 38, 38, 0.1);
          border-radius: 16px;
          padding: 14px;
        }

        .member-metrics strong {
          display: block;
          margin-top: 8px;
          font-size: 1.08rem;
          letter-spacing: -0.03em;
        }

        .member-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          padding-top: 16px;
          border-top: 1px solid rgba(220, 38, 38, 0.08);
        }

        .member-actions-copy {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .member-actions-hint {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
          font-size: 0.92rem;
        }

        .status-pill, .online-pill, .bet-chip {
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
        }

        .status-active {
          background: rgba(16, 185, 129, 0.14);
          color: #047857;
        }

        .status-inactive {
          background: rgba(127, 80, 80, 0.12);
          color: var(--text-secondary);
        }

        .status-suspended {
          background: rgba(220, 38, 38, 0.12);
          color: var(--danger);
        }

        .online-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(220, 38, 38, 0.08);
          color: var(--primary);
        }

        .wizard-steps {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .wizard-step {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          color: var(--text-secondary);
          padding: 12px 14px;
        }

        .wizard-step span {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(148, 163, 184, 0.16);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        .wizard-step.active, .wizard-step.done {
          border-color: var(--border-accent);
          color: var(--text-primary);
        }

        .wizard-step.active span, .wizard-step.done span {
          background: var(--primary-subtle);
          color: var(--primary-light);
        }

        .wizard-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .wizard-grid .full {
          grid-column: 1 / -1;
        }

        .wizard-grid label, .wizard-grid-textarea {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .wizard-grid-textarea {
          margin-top: 12px;
        }

        .lottery-group-title {
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .lottery-card.muted {
          opacity: 0.72;
        }

        .inline-check {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
        }

        .bet-type-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .lottery-advanced-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 12px;
        }

        .bet-chip {
          border: 1px solid var(--border);
          background: var(--bg-surface);
          color: var(--text-secondary);
        }

        .bet-chip.active {
          border-color: var(--border-accent);
          background: var(--primary-subtle);
          color: var(--primary-light);
        }

        .form-hint {
          color: var(--text-muted);
          font-size: 0.82rem;
          margin-top: -4px;
        }

        @media (max-width: 1080px) {
          .summary-grid, .member-metrics, .filter-toolbar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 920px) {
          .members-hero, .member-card-header, .member-actions, .summary-grid, .member-metrics, .wizard-grid, .wizard-steps, .filter-toolbar {
            grid-template-columns: 1fr;
          }

          .members-hero, .member-card-header {
            display: flex;
            flex-direction: column;
            align-items: stretch;
          }

          .page-actions {
            width: 100%;
          }

          .page-actions .btn, .member-actions-buttons .btn {
            flex: 1;
            justify-content: center;
          }

          .member-credit {
            width: 100%;
            text-align: left;
          }
        }

        @media (max-width: 640px) {
          .member-identity {
            flex-direction: column;
          }

          .summary-grid, .member-metrics, .filter-toolbar, .wizard-grid, .wizard-steps {
            grid-template-columns: 1fr;
          }

          .member-actions-buttons, .page-actions {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default AgentCustomers;
