import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiBarChart2, FiChevronRight, FiClock, FiCreditCard, FiDollarSign, FiPhone, FiPlus, FiRefreshCw, FiSearch, FiTrendingUp, FiUsers, FiWifi, FiXCircle } from 'react-icons/fi';
import Modal from '../../components/Modal';
import PageSkeleton, { SectionSkeleton } from '../../components/PageSkeleton';
import { agentCopy } from '../../i18n/th/agent';
import { getUserStatusLabel } from '../../i18n/th/labels';
import { createAgentMember, deleteCustomer, getAgentMemberBootstrap, getAgentMembers } from '../../services/api';
import { formatDateTime, formatNumber, getInitial, toNumber } from '../../utils/formatters';
import {
  DEFAULT_MEMBER_LIST_FILTERS,
  areMemberListFiltersEqual,
  normalizeMemberListFilters
} from '../../utils/memberListFilters';
import {
  DEFAULT_PAGINATION_META,
  getPaginatedItems,
  getPaginatedMeta
} from '../../utils/paginatedResponse';
import {
  applyProfileToLotterySettings,
  buildMemberFormPayload,
  createInitialMemberForm,
  groupLotterySettingsByLeague,
  toggleBetType,
  updateLotterySetting
} from './memberFormUtils';

const copy = agentCopy.customers;
const steps = copy.steps;
const statusOptions = ['', 'active', 'inactive', 'suspended'];
const onlineOptions = ['', 'true', 'false'];
const betTypeKeys = ['3top', '3front', '3bottom', '3tod', '2top', '2bottom', 'run_top', 'run_bottom', 'lao_set4'];
const MemberLotterySettingsStep = lazy(() => import('../shared/MemberLotterySettingsStep'));
const sortOptions = [
  { value: 'recent', label: copy.sortOptions.recent },
  { value: 'credit_desc', label: copy.sortOptions.credit_desc },
  { value: 'sales_desc', label: copy.sortOptions.sales_desc },
  { value: 'online_first', label: copy.sortOptions.online_first },
  { value: 'name_asc', label: copy.sortOptions.name_asc }
];
const MEMBER_PAGE_LIMIT = 24;
const formatSignedNumber = (value) => {
  const amount = toNumber(value);
  const formatted = Math.abs(amount).toLocaleString('th-TH');
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
};

const filterActionsCopy = {
  apply: 'ใช้ตัวกรอง',
  clear: 'ล้างตัวกรอง',
  pending: 'มีการเปลี่ยนแปลงที่ยังไม่ได้ใช้',
  loadedCount: (loaded, total) => `แสดง ${loaded} / ${total} คน`,
  loadMore: 'โหลดเพิ่ม',
  loadingMore: 'กำลังโหลด...'
};

const markMembersTotalsState = (items = [], totalsLoaded = true) =>
  (items || []).map((item) => ({
    ...item,
    __totalsLoaded: totalsLoaded
  }));

const hasMemberTotalsLoaded = (member) => member?.__totalsLoaded !== false;

const AgentCustomers = () => {
  const navigate = useNavigate();
  const memberRequestRef = useRef(0);
  const [bootstrap, setBootstrap] = useState(null);
  const [members, setMembers] = useState([]);
  const [memberPagination, setMemberPagination] = useState(DEFAULT_PAGINATION_META);
  const [loading, setLoading] = useState(true);
  const [loadingMoreMembers, setLoadingMoreMembers] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [totalsHydrating, setTotalsHydrating] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [draftFilters, setDraftFilters] = useState(() => ({ ...DEFAULT_MEMBER_LIST_FILTERS }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({ ...DEFAULT_MEMBER_LIST_FILTERS }));
  const [sortBy, setSortBy] = useState('recent');
  const [form, setForm] = useState(null);

  const loadMembers = async (
    query = appliedFilters,
    silent = false,
    {
      force = false,
      page = 1,
      append = false,
      includeTotals = true
    } = {}
  ) => {
    const requestId = ++memberRequestRef.current;
    if (!silent) setLoading(true);
    try {
      const res = await getAgentMembers({
        ...normalizeMemberListFilters(query),
        paginated: '1',
        page,
        limit: MEMBER_PAGE_LIMIT,
        includeTotals: includeTotals ? '1' : '0'
      }, { force });
      if (requestId !== memberRequestRef.current) {
        return { ignored: true };
      }
      const nextItems = getPaginatedItems(res.data);
      const normalizedItems = markMembersTotalsState(nextItems, includeTotals);
      setMembers((current) => append ? [...current, ...normalizedItems] : normalizedItems);
      setMemberPagination(getPaginatedMeta(res.data));
      return { ignored: false, items: normalizedItems };
    } catch (error) {
      console.error(error);
      toast.error(copy.wizard.loadError);
      return { ignored: true };
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadBootstrap = async ({ force = false } = {}) => {
    const res = await getAgentMemberBootstrap({ force });
    setBootstrap(res.data);
    return res.data;
  };

  const loadMembersForView = async (query = appliedFilters, { force = false } = {}) => {
    const shouldFastLoadMembers = sortBy !== 'sales_desc';
    setTotalsHydrating(shouldFastLoadMembers);
    try {
      const baseResult = await loadMembers(query, false, {
        force,
        page: 1,
        includeTotals: !shouldFastLoadMembers
      });

      if (shouldFastLoadMembers && !baseResult?.ignored) {
        await loadMembers(query, true, {
          force,
          page: 1,
          includeTotals: true
        });
      }
    } finally {
      setTotalsHydrating(false);
    }
  };

  useEffect(() => {
    loadMembersForView(appliedFilters);
  }, [appliedFilters.search, appliedFilters.status, appliedFilters.online]);

  useEffect(() => {
    if (sortBy !== 'sales_desc' || members.every(hasMemberTotalsLoaded)) {
      return;
    }

    let cancelled = false;
    setTotalsHydrating(true);

    loadMembers(appliedFilters, true, {
      page: 1,
      includeTotals: true
    }).finally(() => {
      if (!cancelled) {
        setTotalsHydrating(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [appliedFilters, members, sortBy]);

  const hasPendingFilterChanges = useMemo(
    () => !areMemberListFiltersEqual(draftFilters, appliedFilters),
    [appliedFilters, draftFilters]
  );

  const summary = useMemo(() => ({
    totalMembers: memberPagination.total || members.length,
    onlineMembers: members.filter((member) => member.isOnline).length,
    totalCredit: members.reduce((sum, member) => sum + toNumber(member.creditBalance), 0),
    totalSales: members.reduce((sum, member) => sum + toNumber(member.totals?.totalAmount), 0)
  }), [memberPagination.total, members]);
  const membersHaveTotals = useMemo(
    () => members.every(hasMemberTotalsLoaded),
    [members]
  );

  const displayedMembers = useMemo(() => {
    const sorted = [...members];

    sorted.sort((left, right) => {
      if (sortBy === 'credit_desc') return toNumber(right.creditBalance) - toNumber(left.creditBalance);
      if (sortBy === 'sales_desc' && !membersHaveTotals) return 0;
      if (sortBy === 'sales_desc') return toNumber(right.totals?.totalAmount) - toNumber(left.totals?.totalAmount);
      if (sortBy === 'online_first') return Number(Boolean(right.isOnline)) - Number(Boolean(left.isOnline));
      if (sortBy === 'name_asc') return String(left.name || '').localeCompare(String(right.name || ''), 'th');

      const leftTime = left.lastActiveAt ? new Date(left.lastActiveAt).getTime() : 0;
      const rightTime = right.lastActiveAt ? new Date(right.lastActiveAt).getTime() : 0;
      return rightTime - leftTime;
    });

    return sorted;
  }, [members, membersHaveTotals, sortBy]);

  const groupedLotteries = useMemo(
    () => (wizardStep === 2 ? groupLotterySettingsByLeague(form?.lotterySettings || []) : {}),
    [form?.lotterySettings, wizardStep]
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
      const tasks = [loadMembersForView(appliedFilters, { force: true })];
      if (bootstrap) {
        tasks.unshift(loadBootstrap({ force: true }));
      }
      await Promise.all(tasks);
    } finally {
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    const nextFilters = normalizeMemberListFilters(draftFilters);
    if (areMemberListFiltersEqual(nextFilters, appliedFilters)) {
      return;
    }
    setAppliedFilters(nextFilters);
  };

  const clearFilters = () => {
    const nextFilters = { ...DEFAULT_MEMBER_LIST_FILTERS };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  };

  const toggleWizardLotteryBetType = (lotteryTypeId, betType) => {
    setForm((current) => ({
      ...current,
      lotterySettings: toggleBetType(current.lotterySettings, lotteryTypeId, betType)
    }));
  };

  const loadMoreMembers = async () => {
    if (!memberPagination.hasNextPage || loadingMoreMembers) return;

    setLoadingMoreMembers(true);
    try {
      await loadMembers(appliedFilters, true, {
        page: memberPagination.page + 1,
        append: true,
        includeTotals: true
      });
    } finally {
      setLoadingMoreMembers(false);
    }
  };

  const updateAccount = (field, value) => setForm((current) => ({ ...current, account: { ...current.account, [field]: value } }));
  const updateProfile = (field, value) => setForm((current) => ({ ...current, profile: { ...current.profile, [field]: value } }));
  const patchLottery = (lotteryTypeId, patch) => setForm((current) => ({ ...current, lotterySettings: updateLotterySetting(current.lotterySettings, lotteryTypeId, patch) }));

  const applyProfileToAllLotteries = () => {
    setForm((current) => applyProfileToLotterySettings(current));
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
      await createAgentMember(buildMemberFormPayload(form));
      toast.success(copy.wizard.createSuccess);
      closeWizard();
      await loadMembersForView(appliedFilters, { force: true });
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
      await loadMembersForView(appliedFilters, { force: true });
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || copy.wizard.deactivateError);
    }
  };

  if (loading) return <PageSkeleton statCount={4} rows={5} sidebar />;

  return (
    <div className="ops-page agent-members-page animate-fade-in">
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

      <section className="summary-grid members-summary-grid">
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
          <strong>{membersHaveTotals || !totalsHydrating ? formatNumber(summary.totalSales) : '...'}</strong>
          <p>{copy.totalSalesHint}</p>
        </div>
      </section>

      <section className="card ops-section filter-card">
        <div className="filter-card-head">
          <div>
          <div className="filter-title">{copy.filterTitle}</div>
            <div className="filter-subtitle">{copy.filterSubtitle}</div>
          </div>
          <div className="filter-count ui-pill">
            {filterActionsCopy.loadedCount(
              formatNumber(displayedMembers.length),
              formatNumber(memberPagination.total || displayedMembers.length)
            )}
          </div>
        </div>
        <div className="filter-toolbar">
          <label className="field-inline field-inline-search">
            <span className="field-inline-placeholder" aria-hidden="true">{copy.statusLabel}</span>
            <span className="search-box">
              <FiSearch />
              <input
                value={draftFilters.search}
                onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  applyFilters();
                }}
                placeholder={copy.searchPlaceholder}
              />
            </span>
          </label>
          <label className="field-inline">
            <span>{copy.statusLabel}</span>
            <select value={draftFilters.status} onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}>
              {statusOptions.map((status) => <option key={status || 'all'} value={status}>{status ? getUserStatusLabel(status) : copy.allStatuses}</option>)}
            </select>
          </label>
          <label className="field-inline">
            <span>{copy.presenceLabel}</span>
            <select value={draftFilters.online} onChange={(event) => setDraftFilters((current) => ({ ...current, online: event.target.value }))}>
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
        <div className="filter-actions">
          <div className={`filter-actions-hint ${hasPendingFilterChanges ? 'active' : ''}`}>
            {hasPendingFilterChanges ? filterActionsCopy.pending : copy.filterSubtitle}
          </div>
          <div className="filter-actions-buttons">
            <button type="button" className="btn btn-secondary" onClick={clearFilters} disabled={!hasPendingFilterChanges && areMemberListFiltersEqual(appliedFilters, DEFAULT_MEMBER_LIST_FILTERS)}>
              {filterActionsCopy.clear}
            </button>
            <button type="button" className="btn btn-primary" onClick={applyFilters} disabled={!hasPendingFilterChanges}>
              {filterActionsCopy.apply}
            </button>
          </div>
        </div>
      </section>

      <section className="member-list">
        {displayedMembers.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon"><FiUsers /></div><div className="empty-state-text">{copy.empty}</div></div>
        ) : displayedMembers.map((member) => {
          const totalsLoaded = hasMemberTotalsLoaded(member);
          const purchasedSlips = toNumber(member.totals?.slipCount ?? member.totals?.totalBets);
          const profitLoss = toNumber(member.totals?.netProfit);
          const profitLossClass = profitLoss > 0 ? 'metric-positive' : profitLoss < 0 ? 'metric-negative' : '';
          const historyQuery = new URLSearchParams({
            memberId: String(member.id || ''),
            memberName: member.name || ''
          }).toString();

          return (
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
                    <span><FiPhone /> {member.phone || copy.noPhone}</span>
                  </div>
                  <div className="member-last-active">{copy.lastActivePrefix}: {member.isOnline ? copy.currentlyOnline : formatDateTime(member.lastActiveAt, { fallback: agentCopy.dashboard.noRecentActivity })}</div>
                </div>
              </div>
              <div className="member-credit">
                <span>{copy.remainingCredit}</span>
                <strong>{formatNumber(member.creditBalance)}</strong>
              </div>
            </div>

              <div className="member-metrics">
                <div>
                  <span>{copy.purchasedSlips}</span>
                  <strong>{totalsLoaded ? formatNumber(purchasedSlips) : '...'}</strong>
                </div>
                <div>
                  <span>{copy.purchaseAmount}</span>
                  <strong>{totalsLoaded ? formatNumber(member.totals?.totalAmount) : '...'}</strong>
                </div>
                <div>
                  <span>{copy.won}</span>
                  <strong>{totalsLoaded ? formatNumber(member.totals?.totalWon) : '...'}</strong>
                </div>
                <div>
                  <span>{copy.profitLoss}</span>
                  <strong className={totalsLoaded ? profitLossClass : ''}>
                    {totalsLoaded ? formatSignedNumber(profitLoss) : '...'}
                  </strong>
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
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/agent/bets?${historyQuery}`)}>
                  <FiClock />
                  {copy.viewHistory}
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
          );
        })}
      </section>

      {members.length > 0 ? (
        <section className="card ops-section member-pagination-card">
          <div>
            <div className="filter-title">
              {filterActionsCopy.loadedCount(
                formatNumber(displayedMembers.length),
                formatNumber(memberPagination.total || displayedMembers.length)
              )}
            </div>
            <div className="filter-subtitle">{copy.filterSubtitle}</div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadMoreMembers}
            disabled={!memberPagination.hasNextPage || loadingMoreMembers}
          >
            {loadingMoreMembers ? filterActionsCopy.loadingMore : filterActionsCopy.loadMore}
          </button>
        </section>
      ) : null}

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
              <Suspense fallback={<SectionSkeleton rows={5} />}>
                <MemberLotterySettingsStep
                  groupedLotteries={groupedLotteries}
                  lotteryCopy={copy.wizard.lottery}
                  profileCopy={copy.wizard.profile}
                  betTypeKeys={betTypeKeys}
                  customRateBetTypesByLottery={(lottery, fallback) => lottery.supportedBetTypes?.length ? lottery.supportedBetTypes : fallback}
                  patchLottery={patchLottery}
                  toggleBetTypeForLottery={toggleWizardLotteryBetType}
                />
              </Suspense>
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
          gap: 16px;
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
          gap: 20px;
          padding: 22px;
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(255, 244, 244, 0.98)),
            radial-gradient(circle at top right, rgba(248, 113, 113, 0.14), transparent 34%);
          border-color: rgba(220, 38, 38, 0.14);
          box-shadow: 0 18px 36px rgba(127, 29, 29, 0.1);
        }

        .members-hero .page-actions {
          justify-content: flex-end;
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
          border-radius: 18px;
          padding: 16px;
          overflow: hidden;
          box-shadow: 0 12px 24px rgba(127, 29, 29, 0.06);
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
          box-shadow: 0 14px 28px rgba(220, 38, 38, 0.08);
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
          gap: 16px;
          padding: 18px;
          box-shadow: 0 14px 28px rgba(127, 29, 29, 0.07);
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
          font-size: 0.82rem;
          font-weight: 700;
        }

        .filter-toolbar {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .filter-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .filter-actions-hint {
          color: var(--text-muted);
          font-size: 0.92rem;
        }

        .filter-actions-hint.active {
          color: var(--primary);
          font-weight: 700;
        }

        .filter-actions-buttons {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .member-pagination-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px;
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

        .field-inline-search {
          justify-content: flex-end;
        }

        .field-inline-placeholder {
          visibility: hidden;
          user-select: none;
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
          gap: 14px;
        }

        .member-card {
          padding: 18px;
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .member-card:hover {
          transform: translateY(-2px);
          border-color: rgba(220, 38, 38, 0.22);
          box-shadow: 0 18px 30px rgba(127, 29, 29, 0.1);
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
          padding: 12px 14px;
          border-radius: 16px;
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
          margin: 16px 0;
          gap: 12px;
        }

        .member-metrics > div {
          background: rgba(255, 251, 251, 0.96);
          border: 1px solid rgba(220, 38, 38, 0.1);
          border-radius: 14px;
          padding: 12px;
        }

        .member-metrics strong {
          display: block;
          margin-top: 8px;
          font-size: 1.08rem;
          letter-spacing: -0.03em;
        }

        .member-metrics strong.metric-positive {
          color: var(--success);
        }

        .member-metrics strong.metric-negative {
          color: var(--danger);
        }

        .member-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          padding-top: 14px;
          border-top: 1px solid rgba(220, 38, 38, 0.08);
        }

        .member-actions-buttons {
          justify-content: flex-end;
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

        .members-summary-grid .summary-card {
          min-height: 100%;
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
          .summary-grid, .member-metrics, .wizard-grid, .wizard-steps, .filter-toolbar {
            grid-template-columns: 1fr;
          }

          .members-hero, .member-card-header {
            display: flex;
            flex-direction: column;
            align-items: stretch;
          }

          .page-actions {
            width: 100%;
            justify-content: stretch;
          }

          .page-actions .btn, .member-actions-buttons .btn {
            flex: 1;
            justify-content: center;
          }

          .filter-actions,
          .filter-actions-buttons,
          .member-pagination-card {
            width: 100%;
            flex-direction: column;
            align-items: stretch;
          }

          .member-actions {
            flex-direction: column;
            align-items: stretch;
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

          .member-actions-buttons, .page-actions, .filter-actions-buttons {
            width: 100%;
            flex-direction: column;
            align-items: stretch;
          }

          .member-subtitle-row span {
            width: 100%;
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default AgentCustomers;
