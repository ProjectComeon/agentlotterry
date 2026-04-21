import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiBarChart2,
  FiChevronRight,
  FiClock,
  FiDollarSign,
  FiEdit2,
  FiPhone,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrendingUp,
  FiUserCheck,
  FiUsers,
  FiXCircle
} from 'react-icons/fi';
import Modal from '../../components/Modal';
import PageSkeleton from '../../components/PageSkeleton';
import { agentCopy } from '../../i18n/th/agent';
import { adminCopy } from '../../i18n/th/admin';
import { getBetTypeLabel, getUserStatusLabel } from '../../i18n/th/labels';
import {
  createAdminCustomer,
  deleteAdminCustomer,
  getAdminCustomerDetail,
  getAdminMemberBootstrap,
  getAdminCustomers,
  getAgents,
  updateAdminCustomer
} from '../../services/api';
import { formatDateTime, formatMoney as money, formatNumber, getInitial, toNumber } from '../../utils/formatters';
import {
  DEFAULT_ADMIN_CUSTOMER_FILTERS,
  areAdminCustomerFiltersEqual,
  normalizeAdminCustomerFilters
} from '../../utils/adminCustomerFilters';
import {
  DEFAULT_PAGINATION_META,
  getPaginatedItems,
  getPaginatedMeta
} from '../../utils/paginatedResponse';
import {
  applyProfileToLotterySettings,
  buildMemberFormPayload,
  createInitialMemberForm,
  createMemberFormFromDetail,
  groupLotterySettingsByLeague,
  toggleBetType,
  updateLotterySetting
} from '../agent/memberFormUtils';

const copy = adminCopy.customers;
const wizardCopy = agentCopy.customers;
const wizardSteps = wizardCopy.steps;
const statusOptions = ['', 'active', 'inactive'];
const memberStatusOptions = ['active', 'inactive', 'suspended'];
const betTypeKeys = ['3top', '3front', '3bottom', '3tod', '2top', '2bottom', 'run_top', 'run_bottom', 'lao_set4'];
const sortOptions = [
  { value: 'recent', label: 'อัปเดตล่าสุด' },
  { value: 'sales_desc', label: 'ยอดซื้อสูงสุด' },
  { value: 'profit_desc', label: 'กำไร/ขาดทุนสูงสุด' },
  { value: 'name_asc', label: 'ชื่อ A-Z' }
];
const CUSTOMER_PAGE_LIMIT = 24;

const filterActionsCopy = {
  apply: 'ใช้ตัวกรอง',
  clear: 'ล้างตัวกรอง',
  pending: 'มีตัวกรองที่ยังไม่ได้ใช้',
  loadedCount: (loaded, total) => `แสดง ${loaded} / ${total} สมาชิก`,
  loadMore: 'โหลดเพิ่ม',
  loadingMore: 'กำลังโหลด...'
};

const ui = {
  filterTitle: 'ค้นหาและกรอง',
  filterSubtitle: 'ค้นหาสมาชิกและกรองตามเจ้ามือผู้ดูแล สถานะ และลำดับการแสดงผล',
  filterCount: (value) => `${value} สมาชิก`,
  filterAgentLabel: 'เจ้ามือผู้ดูแล',
  statusLabel: 'สถานะ',
  sortLabel: 'เรียงลำดับ',
  allStatuses: 'ทุกสถานะ',
  noPhone: 'ไม่ระบุเบอร์',
  unassignedAgent: 'ยังไม่มอบหมาย',
  lastUpdatedPrefix: 'อัปเดตล่าสุด',
  currentOwner: 'เจ้ามือผู้ดูแล',
  purchasedSlips: 'จำนวนโพยที่ซื้อ',
  purchaseAmount: 'ยอดซื้อ',
  won: 'ยอดถูก',
  profitLoss: 'กำไร/ขาดทุน',
  memberSummary: 'สรุปสมาชิก',
  ownerHint: (agentName) => `ดูแลโดย ${agentName || 'ยังไม่มอบหมาย'}`,
  loadError: 'โหลดข้อมูลสมาชิกไม่สำเร็จ',
  saveSuccess: 'อัปเดตข้อมูลสมาชิกแล้ว',
  createSuccess: 'สร้างสมาชิกแล้ว',
  deactivateSuccess: 'ปิดการใช้งานสมาชิกแล้ว',
  genericError: 'เกิดข้อผิดพลาด',
  confirmDeactivate: (name) => `ต้องการปิดการใช้งานสมาชิก "${name}" ใช่หรือไม่`,
  bootstrapError: 'โหลดข้อมูลฟอร์มสมาชิกไม่สำเร็จ',
  detailError: 'โหลดรายละเอียดสมาชิกไม่สำเร็จ',
  agentRequired: 'กรุณาเลือกเจ้ามือผู้ดูแลก่อน',
  memberWizardTitle: 'กำหนดรายละเอียดสมาชิก',
  applyToAll: 'คัดลอกค่าไปทุกตลาดหวย',
  noAvailableAgent: 'ยังไม่มีเจ้ามือให้เลือก',
  ownerSelectionHint: 'กำหนดเจ้ามือผู้รับผิดชอบก่อนบันทึกฟอร์มนี้'
};

const formatSignedNumber = (value) => {
  const amount = toNumber(value);
  const formatted = Math.abs(amount).toLocaleString('th-TH');
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
};

const CustomerManagement = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [customerPagination, setCustomerPagination] = useState(DEFAULT_PAGINATION_META);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreCustomers, setLoadingMoreCustomers] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [draftFilters, setDraftFilters] = useState(() => ({ ...DEFAULT_ADMIN_CUSTOMER_FILTERS }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({ ...DEFAULT_ADMIN_CUSTOMER_FILTERS }));
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [bootstrap, setBootstrap] = useState(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  const loadData = async ({
    silent = false,
    force = false,
    page = 1,
    append = false
  } = {}) => {
    if (!silent && !append) setLoading(true);
    try {
      const query = {
        ...normalizeAdminCustomerFilters(appliedFilters),
        paginated: '1',
        page,
        limit: CUSTOMER_PAGE_LIMIT
      };
      const customerRequest = getAdminCustomers(query, { force });
      const [customerRes, agentRes] = append
        ? [await customerRequest, null]
        : await Promise.all([
          customerRequest,
          getAgents({ force })
        ]);
      const nextCustomers = getPaginatedItems(customerRes.data);
      setCustomers((current) => append ? [...current, ...nextCustomers] : nextCustomers);
      setCustomerPagination(getPaginatedMeta(customerRes.data));
      if (agentRes) {
        setAgents(agentRes.data || []);
      }
    } catch (error) {
      console.error(error);
      toast.error(ui.loadError);
    } finally {
      if (!silent && !append) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [appliedFilters.agentId, appliedFilters.search, appliedFilters.sortBy, appliedFilters.status]);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await loadData({ silent: true, force: true, page: 1 });
    } finally {
      setRefreshing(false);
    }
  };

  const loadBootstrap = async (agentId = '') => {
    const res = await getAdminMemberBootstrap(agentId);
    setBootstrap(res.data);
    return res.data;
  };

  const resetWizard = () => {
    setShowModal(false);
    setEditCustomer(null);
    setWizardStep(0);
    setForm(null);
  };

  const closeModal = () => {
    if (saving) return;
    resetWizard();
  };

  const openCreate = async () => {
    const preferredAgentId = appliedFilters.agentId || agents.find((agent) => agent.isActive)?._id || agents[0]?._id || '';
    if (!preferredAgentId) {
      toast.error(ui.noAvailableAgent);
      return;
    }

    try {
      const bootstrapData = await loadBootstrap(preferredAgentId);
      setForm({
        ...createInitialMemberForm(bootstrapData),
        agentId: preferredAgentId
      });
      setWizardStep(0);
      setEditCustomer(null);
      setShowModal(true);
    } catch (error) {
      console.error(error);
      toast.error(ui.bootstrapError);
    }
  };

  const openEdit = async (customer) => {
    const currentAgentId = customer.agentId?._id || customer.agentId || '';
    try {
      const [bootstrapData, detailRes] = await Promise.all([
        loadBootstrap(currentAgentId),
        getAdminCustomerDetail(customer._id)
      ]);
      setEditCustomer(customer);
      setForm({
        ...createMemberFormFromDetail(detailRes.data, bootstrapData),
        agentId: detailRes.data?.member?.agentId || currentAgentId || ''
      });
      setWizardStep(0);
      setShowModal(true);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || ui.detailError);
    }
  };

  const updateAccount = (field, value) => setForm((current) => ({
    ...current,
    account: { ...current.account, [field]: value }
  }));
  const updateProfile = (field, value) => setForm((current) => ({
    ...current,
    profile: { ...current.profile, [field]: value }
  }));
  const patchLottery = (lotteryTypeId, patch) => setForm((current) => ({
    ...current,
    lotterySettings: updateLotterySetting(current.lotterySettings, lotteryTypeId, patch)
  }));
  const applyProfileToAllLotteries = () => {
    setForm((current) => applyProfileToLotterySettings(current));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form?.agentId) {
      toast.error(ui.agentRequired);
      setWizardStep(0);
      return;
    }

    if (!form?.account?.username || !form?.account?.name || (!editCustomer && !form?.account?.password)) {
      toast.error(wizardCopy.wizard.requiredError);
      setWizardStep(0);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...buildMemberFormPayload(form),
        agentId: form.agentId
      };

      if (editCustomer) {
        await updateAdminCustomer(editCustomer._id, payload);
        toast.success(ui.saveSuccess);
      } else {
        await createAdminCustomer(payload);
        toast.success(ui.createSuccess);
      }

      resetWizard();
      await loadData({ silent: true, force: true, page: 1 });
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || ui.genericError);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer) => {
    if (!window.confirm(ui.confirmDeactivate(customer.name))) return;
    try {
      await deleteAdminCustomer(customer._id);
      toast.success(ui.deactivateSuccess);
      await loadData({ silent: true, force: true, page: 1 });
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || ui.genericError);
    }
  };

  const groupedLotteries = useMemo(
    () => groupLotterySettingsByLeague(form?.lotterySettings || []),
    [form?.lotterySettings]
  );

  const hasPendingFilterChanges = useMemo(
    () => !areAdminCustomerFiltersEqual(draftFilters, appliedFilters),
    [appliedFilters, draftFilters]
  );

  const hasAppliedFilterChanges = useMemo(
    () => !areAdminCustomerFiltersEqual(appliedFilters, DEFAULT_ADMIN_CUSTOMER_FILTERS),
    [appliedFilters]
  );

  const applyFilters = () => {
    const nextFilters = normalizeAdminCustomerFilters(draftFilters);
    if (areAdminCustomerFiltersEqual(nextFilters, appliedFilters)) {
      return;
    }
    setAppliedFilters(nextFilters);
  };

  const clearFilters = () => {
    const nextFilters = { ...DEFAULT_ADMIN_CUSTOMER_FILTERS };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  };

  const loadMoreCustomers = async () => {
    if (!customerPagination.hasNextPage || loadingMoreCustomers) return;

    setLoadingMoreCustomers(true);
    try {
      await loadData({
        silent: true,
        page: customerPagination.page + 1,
        append: true
      });
    } finally {
      setLoadingMoreCustomers(false);
    }
  };

  const displayedCustomers = customers;

  const summary = useMemo(() => {
    const activeCount = displayedCustomers.filter((customer) => (customer.status || (customer.isActive ? 'active' : 'inactive')) === 'active').length;
    const assignedAgentCount = new Set(displayedCustomers.map((customer) => customer.agentId?._id || customer.agentId).filter(Boolean)).size;
    const totalSales = displayedCustomers.reduce((sum, customer) => sum + toNumber(customer.totals?.totalAmount), 0);
    const netProfit = displayedCustomers.reduce((sum, customer) => sum + toNumber(customer.totals?.netProfit), 0);

    return {
      totalCustomers: customerPagination.total || displayedCustomers.length,
      activeCount,
      assignedAgentCount,
      totalSales,
      netProfit
    };
  }, [customerPagination.total, displayedCustomers]);

  if (loading) {
    return <PageSkeleton statCount={4} rows={5} sidebar={false} />;
  }

  return (
    <div className="ops-page admin-members-page animate-fade-in">
      <section className="members-hero card">
        <div className="members-hero-copy">
          <span className="section-eyebrow">{copy.heroEyebrow}</span>
          <h1 className="page-title">{copy.heroTitle}</h1>
          <p className="page-subtitle">{copy.heroSubtitle}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={refreshAll} disabled={refreshing}>
            <FiRefreshCw className={refreshing ? 'spin-animation' : ''} />
            {adminCopy.common.refresh}
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/betting')}>
            <FiDollarSign />
            ซื้อแทน
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <FiPlus />
            {copy.add}
          </button>
        </div>
      </section>

      <section className="summary-grid members-summary-grid">
        <div className="summary-card summary-card-highlight">
          <div className="summary-card-top">
            <span className="summary-icon"><FiUsers /></span>
            <span className="summary-label">{copy.overviewCards.totalCustomers.label}</span>
          </div>
          <strong>{formatNumber(summary.totalCustomers)}</strong>
          <p>{copy.overviewCards.totalCustomers.hint(formatNumber(summary.activeCount))}</p>
        </div>
        <div className="summary-card">
          <div className="summary-card-top">
            <span className="summary-icon"><FiUserCheck /></span>
            <span className="summary-label">{copy.overviewCards.assignedAgents.label}</span>
          </div>
          <strong>{formatNumber(summary.assignedAgentCount)}</strong>
          <p>{copy.overviewCards.assignedAgents.hint}</p>
        </div>
        <div className="summary-card">
          <div className="summary-card-top">
            <span className="summary-icon"><FiDollarSign /></span>
            <span className="summary-label">{copy.overviewCards.totalSales.label}</span>
          </div>
          <strong>{money(summary.totalSales)}</strong>
          <p>{copy.overviewCards.totalSales.hint}</p>
        </div>
        <div className="summary-card">
          <div className="summary-card-top">
            <span className="summary-icon"><FiTrendingUp /></span>
            <span className="summary-label">{copy.overviewCards.netProfit.label}</span>
          </div>
          <strong className={summary.netProfit > 0 ? 'metric-positive' : summary.netProfit < 0 ? 'metric-negative' : ''}>
            {formatSignedNumber(summary.netProfit)}
          </strong>
          <p>{copy.overviewCards.netProfit.hint}</p>
        </div>
      </section>

      <section className="card ops-section filter-card">
        <div className="filter-card-head">
          <div>
            <div className="filter-title">{ui.filterTitle}</div>
            <div className="filter-subtitle">{ui.filterSubtitle}</div>
          </div>
          <div className="filter-count ui-pill">
            {filterActionsCopy.loadedCount(
              formatNumber(displayedCustomers.length),
              formatNumber(customerPagination.total || displayedCustomers.length)
            )}
          </div>
        </div>
        <div className="filter-toolbar">
          <label className="field-inline field-inline-search">
            <span className="field-inline-placeholder" aria-hidden="true">{ui.statusLabel}</span>
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
            <span>{ui.filterAgentLabel}</span>
            <select value={draftFilters.agentId} onChange={(event) => setDraftFilters((current) => ({ ...current, agentId: event.target.value }))}>
              <option value="">{copy.allAgents}</option>
              {agents.map((agent) => (
                <option key={agent._id} value={agent._id}>{agent.name}</option>
              ))}
            </select>
          </label>
          <label className="field-inline">
            <span>{ui.statusLabel}</span>
            <select value={draftFilters.status} onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}>
              {statusOptions.map((status) => (
                <option key={status || 'all'} value={status}>
                  {status ? getUserStatusLabel(status) : ui.allStatuses}
                </option>
              ))}
            </select>
          </label>
          <label className="field-inline">
            <span>{ui.sortLabel}</span>
            <select value={draftFilters.sortBy} onChange={(event) => setDraftFilters((current) => ({ ...current, sortBy: event.target.value }))}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="filter-actions">
          <div className={`filter-actions-hint ${hasPendingFilterChanges ? 'active' : ''}`}>
            {hasPendingFilterChanges ? filterActionsCopy.pending : ui.filterSubtitle}
          </div>
          <div className="filter-actions-buttons">
            <button type="button" className="btn btn-secondary" onClick={clearFilters} disabled={!hasPendingFilterChanges && !hasAppliedFilterChanges}>
              {filterActionsCopy.clear}
            </button>
            <button type="button" className="btn btn-primary" onClick={applyFilters} disabled={!hasPendingFilterChanges}>
              {filterActionsCopy.apply}
            </button>
          </div>
        </div>
      </section>

      <section className="member-list">
        {displayedCustomers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FiUsers /></div>
            <div className="empty-state-text">{copy.empty}</div>
          </div>
        ) : displayedCustomers.map((customer) => {
          const purchasedSlips = toNumber(customer.totals?.slipCount ?? customer.totals?.totalBets);
          const profitLoss = toNumber(customer.totals?.netProfit);
          const profitLossClass = profitLoss > 0 ? 'metric-positive' : profitLoss < 0 ? 'metric-negative' : '';
          const customerStatus = customer.status || (customer.isActive ? 'active' : 'inactive');
          const agentName = customer.agentId?.name || ui.unassignedAgent;
          const historyQuery = new URLSearchParams({
            memberId: String(customer._id || ''),
            memberName: customer.name || ''
          }).toString();

          return (
            <article key={customer._id} className="member-card">
              <div className="member-card-header">
                <div className="member-identity">
                  <div className="member-avatar">{getInitial(customer.name)}</div>
                  <div className="member-heading">
                    <div className="member-title-row">
                      <h3>{customer.name}</h3>
                      <span className={`status-pill status-${customerStatus}`}>{getUserStatusLabel(customerStatus)}</span>
                    </div>
                    <div className="member-subtitle-row">
                      <span>@{customer.username}</span>
                      <span><FiPhone /> {customer.phone || ui.noPhone}</span>
                      <span><FiUsers /> {agentName}</span>
                    </div>
                    <div className="member-last-active">
                      {ui.lastUpdatedPrefix}: {formatDateTime(customer.updatedAt || customer.lastActiveAt || customer.createdAt, { fallback: '-' })}
                    </div>
                  </div>
                </div>
                <div className="member-credit member-owner">
                  <span>{ui.currentOwner}</span>
                  <strong>{agentName}</strong>
                </div>
              </div>

              <div className="member-metrics">
                <div>
                  <span>{ui.purchasedSlips}</span>
                  <strong>{formatNumber(purchasedSlips)}</strong>
                </div>
                <div>
                  <span>{ui.purchaseAmount}</span>
                  <strong>{money(customer.totals?.totalAmount)}</strong>
                </div>
                <div>
                  <span>{ui.won}</span>
                  <strong>{money(customer.totals?.totalWon)}</strong>
                </div>
                <div>
                  <span>{ui.profitLoss}</span>
                  <strong className={profitLossClass}>{formatSignedNumber(profitLoss)}</strong>
                </div>
              </div>

              <div className="member-actions">
                <div className="member-actions-copy">
                  <span className="member-actions-label">{ui.memberSummary}</span>
                  <div className="member-actions-hint">
                    <FiBarChart2 />
                    {ui.ownerHint(agentName)}
                  </div>
                </div>
                <div className="member-actions-buttons">
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/admin/betting?memberId=${customer._id}`)}>
                    <FiDollarSign />
                    ซื้อแทน
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/admin/bets?${historyQuery}`)}>
                    <FiClock />
                    {copy.viewHistory}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(customer)}>
                    <FiEdit2 />
                    {copy.edit}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(customer)}>
                    <FiXCircle />
                    {copy.deactivate}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {displayedCustomers.length > 0 ? (
        <section className="card ops-section member-pagination-card">
          <div>
            <div className="filter-title">
              {filterActionsCopy.loadedCount(
                formatNumber(displayedCustomers.length),
                formatNumber(customerPagination.total || displayedCustomers.length)
              )}
            </div>
            <div className="filter-subtitle">{ui.filterSubtitle}</div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadMoreCustomers}
            disabled={!customerPagination.hasNextPage || loadingMoreCustomers}
          >
            {loadingMoreCustomers ? filterActionsCopy.loadingMore : filterActionsCopy.loadMore}
          </button>
        </section>
      ) : null}

      <Modal isOpen={showModal} onClose={closeModal} title={editCustomer ? copy.editTitle : ui.memberWizardTitle} size="lg">
        {form && (
          <form onSubmit={handleSubmit} className="wizard-form">
            <div className="wizard-steps">
              {wizardSteps.map((step, index) => (
                <button
                  key={step}
                  type="button"
                  className={`wizard-step ${index === wizardStep ? 'active' : index < wizardStep ? 'done' : ''}`}
                  onClick={() => setWizardStep(index)}
                >
                  <span>{index + 1}</span>
                  <strong>{step}</strong>
                </button>
              ))}
            </div>

            {wizardStep === 0 && (
              <>
                <div className="wizard-grid">
                  <label className="full">
                    <span>{copy.agentLabel}</span>
                    <select value={form.agentId} onChange={(event) => setForm((current) => ({ ...current, agentId: event.target.value }))} required>
                      <option value="">{copy.selectAgent}</option>
                      {agents.filter((agent) => agent.isActive).map((agent) => (
                        <option key={agent._id} value={agent._id}>{agent.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{wizardCopy.wizard.account.username}</span>
                    <input value={form.account.username} onChange={(event) => updateAccount('username', event.target.value)} required />
                  </label>
                  <label>
                    <span>{editCustomer ? copy.passwordOptional : wizardCopy.wizard.account.password}</span>
                    <input
                      type="password"
                      value={form.account.password}
                      onChange={(event) => updateAccount('password', event.target.value)}
                      required={!editCustomer}
                      placeholder={editCustomer ? copy.passwordOptional : ''}
                    />
                  </label>
                  <label>
                    <span>{wizardCopy.wizard.account.name}</span>
                    <input value={form.account.name} onChange={(event) => updateAccount('name', event.target.value)} required />
                  </label>
                  <label>
                    <span>{wizardCopy.wizard.account.phone}</span>
                    <input value={form.account.phone} onChange={(event) => updateAccount('phone', event.target.value)} />
                  </label>
                </div>
                <div className="form-hint">{ui.ownerSelectionHint}</div>
              </>
            )}

            {wizardStep === 1 && (
              <>
                <div className="wizard-grid">
                  <label>
                    <span>{wizardCopy.wizard.profile.status}</span>
                    <select value={form.profile.status} onChange={(event) => updateProfile('status', event.target.value)}>
                      {memberStatusOptions.map((status) => (
                        <option key={status} value={status}>{getUserStatusLabel(status)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{wizardCopy.wizard.profile.stockPercent}</span>
                    <input type="number" min="0" max="100" value={form.profile.stockPercent} onChange={(event) => updateProfile('stockPercent', event.target.value)} />
                  </label>
                  <label>
                    <span>{wizardCopy.wizard.profile.ownerPercent}</span>
                    <input type="number" min="0" max="100" value={form.profile.ownerPercent} onChange={(event) => updateProfile('ownerPercent', event.target.value)} />
                  </label>
                  <label>
                    <span>{wizardCopy.wizard.profile.keepPercent}</span>
                    <input type="number" min="0" max="100" value={form.profile.keepPercent} onChange={(event) => updateProfile('keepPercent', event.target.value)} />
                  </label>
                  <label>
                    <span>{wizardCopy.wizard.profile.commissionRate}</span>
                    <input type="number" min="0" max="100" value={form.profile.commissionRate} onChange={(event) => updateProfile('commissionRate', event.target.value)} />
                  </label>
                  <label>
                    <span>{wizardCopy.wizard.profile.defaultRateProfileId}</span>
                    <select value={form.profile.defaultRateProfileId} onChange={(event) => updateProfile('defaultRateProfileId', event.target.value)}>
                      {(bootstrap?.rateProfiles || []).map((profile) => (
                        <option key={profile.id} value={profile.id}>{profile.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="full">
                    <span>{wizardCopy.wizard.profile.notes}</span>
                    <textarea rows="4" value={form.profile.notes} onChange={(event) => updateProfile('notes', event.target.value)} />
                  </label>
                </div>
                <div className="form-hint">{wizardCopy.wizard.profile.startCreditHint}</div>
                <div className="inline-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={applyProfileToAllLotteries}>
                    {ui.applyToAll}
                  </button>
                </div>
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
                          <label className="inline-check">
                            <input
                              type="checkbox"
                              checked={lottery.isEnabled}
                              onChange={(event) => patchLottery(lottery.lotteryTypeId, { isEnabled: event.target.checked })}
                            />
                            {wizardCopy.wizard.lottery.enabled}
                          </label>
                        </div>

                        <div className="wizard-grid">
                          <label>
                            <span>{wizardCopy.wizard.lottery.rateProfile}</span>
                            <select value={lottery.rateProfileId} onChange={(event) => patchLottery(lottery.lotteryTypeId, { rateProfileId: event.target.value })}>
                              {lottery.availableRateProfiles.map((profile) => (
                                <option key={profile.id} value={profile.id}>{profile.name}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{wizardCopy.wizard.lottery.minimumBet}</span>
                            <input type="number" min="0" value={lottery.minimumBet} onChange={(event) => patchLottery(lottery.lotteryTypeId, { minimumBet: event.target.value })} />
                          </label>
                          <label>
                            <span>{wizardCopy.wizard.lottery.maximumBet}</span>
                            <input type="number" min="0" value={lottery.maximumBet} onChange={(event) => patchLottery(lottery.lotteryTypeId, { maximumBet: event.target.value })} />
                          </label>
                          <label>
                            <span>{wizardCopy.wizard.lottery.maximumPerNumber}</span>
                            <input type="number" min="0" value={lottery.maximumPerNumber} onChange={(event) => patchLottery(lottery.lotteryTypeId, { maximumPerNumber: event.target.value })} />
                          </label>
                          <label>
                            <span>{wizardCopy.wizard.profile.stockPercent}</span>
                            <input type="number" min="0" max="100" value={lottery.stockPercent} onChange={(event) => patchLottery(lottery.lotteryTypeId, { stockPercent: event.target.value })} />
                          </label>
                          <label>
                            <span>{wizardCopy.wizard.profile.ownerPercent}</span>
                            <input type="number" min="0" max="100" value={lottery.ownerPercent} onChange={(event) => patchLottery(lottery.lotteryTypeId, { ownerPercent: event.target.value })} />
                          </label>
                          <label>
                            <span>{wizardCopy.wizard.profile.keepPercent}</span>
                            <input type="number" min="0" max="100" value={lottery.keepPercent} onChange={(event) => patchLottery(lottery.lotteryTypeId, { keepPercent: event.target.value })} />
                          </label>
                          <label>
                            <span>{wizardCopy.wizard.profile.commissionRate}</span>
                            <input type="number" min="0" max="100" value={lottery.commissionRate} onChange={(event) => patchLottery(lottery.lotteryTypeId, { commissionRate: event.target.value })} />
                          </label>
                          <label>
                            <span>{wizardCopy.wizard.lottery.keepMode}</span>
                            <select value={lottery.keepMode} onChange={(event) => patchLottery(lottery.lotteryTypeId, { keepMode: event.target.value })}>
                              <option value="off">{wizardCopy.wizard.lottery.keepModes.off}</option>
                              <option value="cap">{wizardCopy.wizard.lottery.keepModes.cap}</option>
                            </select>
                          </label>
                          <label>
                            <span>{wizardCopy.wizard.lottery.keepCapAmount}</span>
                            <input type="number" min="0" value={lottery.keepCapAmount} onChange={(event) => patchLottery(lottery.lotteryTypeId, { keepCapAmount: event.target.value })} />
                          </label>
                        </div>

                        <div className="bet-type-row">
                          {lottery.supportedBetTypes.map((betType) => (
                            <button
                              key={betType}
                              type="button"
                              className={`bet-chip ${lottery.enabledBetTypes.includes(betType) ? 'active' : ''}`}
                              onClick={() => setForm((current) => ({
                                ...current,
                                lotterySettings: toggleBetType(current.lotterySettings, lottery.lotteryTypeId, betType)
                              }))}
                            >
                              {getBetTypeLabel(betType)}
                            </button>
                          ))}
                        </div>

                        <div className="lottery-advanced-row">
                          <label className="inline-check">
                            <input
                              type="checkbox"
                              checked={lottery.useCustomRates}
                              onChange={(event) => patchLottery(lottery.lotteryTypeId, { useCustomRates: event.target.checked })}
                            />
                            {wizardCopy.wizard.lottery.customRates}
                          </label>
                        </div>

                        {lottery.useCustomRates && (
                          <div className="wizard-grid">
                            {betTypeKeys.map((betType) => (
                              <label key={betType}>
                                <span>{getBetTypeLabel(betType)}</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={lottery.customRates?.[betType] || 0}
                                  onChange={(event) => patchLottery(lottery.lotteryTypeId, {
                                    customRates: {
                                      ...lottery.customRates,
                                      [betType]: event.target.value
                                    }
                                  })}
                                />
                              </label>
                            ))}
                          </div>
                        )}

                        <label className="wizard-grid-textarea">
                          <span>{wizardCopy.wizard.lottery.blockedNumbers}</span>
                          <textarea
                            rows="3"
                            value={(lottery.blockedNumbers || []).join('\n')}
                            onChange={(event) => patchLottery(lottery.lotteryTypeId, {
                              blockedNumbers: event.target.value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
                            })}
                            placeholder={wizardCopy.wizard.lottery.blockedNumbersPlaceholder}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-footer wizard-footer">
              <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={saving}>
                {adminCopy.common.cancel}
              </button>
              <div className="wizard-footer-right">
                {wizardStep > 0 && (
                  <button type="button" className="btn btn-secondary" onClick={() => setWizardStep((current) => current - 1)} disabled={saving}>
                    {wizardCopy.wizard.back}
                  </button>
                )}
                {wizardStep < wizardSteps.length - 1 ? (
                  <button type="button" className="btn btn-primary" onClick={() => setWizardStep((current) => current + 1)} disabled={saving}>
                    {wizardCopy.wizard.next}
                  </button>
                ) : (
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? (editCustomer ? adminCopy.common.saveChanges : wizardCopy.wizard.creating) : (editCustomer ? adminCopy.common.saveChanges : wizardCopy.wizard.submit)}
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </Modal>

      <style>{`
        .admin-members-page,
        .member-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .admin-members-page {
          position: relative;
          isolation: isolate;
        }

        .admin-members-page::before {
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

        .page-actions,
        .member-title-row,
        .member-subtitle-row,
        .member-actions-buttons {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .summary-grid,
        .member-metrics,
        .filter-toolbar {
          display: grid;
          gap: 14px;
        }

        .summary-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .summary-card,
        .member-card {
          position: relative;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(255, 247, 247, 0.98));
          border: 1px solid rgba(220, 38, 38, 0.12);
          border-radius: 18px;
          padding: 16px;
          overflow: hidden;
          box-shadow: 0 12px 24px rgba(127, 29, 29, 0.06);
        }

        .summary-card::after,
        .member-card::after {
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
          font-size: 1.1rem;
        }

        .summary-label,
        .member-subtitle-row,
        .member-metrics span,
        .member-last-active,
        .member-actions-label,
        .filter-subtitle {
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

        .summary-card strong.metric-positive,
        .member-metrics strong.metric-positive {
          color: var(--success);
        }

        .summary-card strong.metric-negative,
        .member-metrics strong.metric-negative {
          color: var(--danger);
        }

        .members-summary-grid .summary-card {
          min-height: 100%;
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

        .filter-toolbar {
          grid-template-columns: repeat(4, minmax(0, 1fr));
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

        .field-inline {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .field-inline span {
          font-size: 0.84rem;
          color: var(--text-secondary);
          font-weight: 600;
        }

        .field-inline-placeholder {
          visibility: hidden;
        }

        .search-box,
        .field-inline select {
          width: 100%;
          min-height: 52px;
          background: rgba(255, 250, 250, 0.96);
          border: 1px solid rgba(220, 38, 38, 0.12);
          border-radius: 16px;
          color: var(--text-primary);
        }

        .search-box {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          color: var(--text-muted);
        }

        .search-box input,
        .field-inline select {
          border: none;
          outline: none;
          background: transparent;
          font: inherit;
        }

        .search-box input {
          flex: 1 1 auto;
          min-width: 0;
          color: var(--text-primary);
        }

        .field-inline select {
          padding: 0 14px;
        }

        .member-card-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }

        .member-identity {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          min-width: 0;
        }

        .member-avatar {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(220, 38, 38, 0.12), rgba(248, 113, 113, 0.12));
          color: var(--primary);
          font-size: 1.6rem;
          font-weight: 800;
          flex-shrink: 0;
        }

        .member-heading {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .member-title-row h3 {
          margin: 0;
          font-size: 1.55rem;
          letter-spacing: -0.04em;
        }

        .member-subtitle-row span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .member-credit {
          min-width: 220px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 16px;
          background: rgba(255, 251, 251, 0.9);
          border: 1px solid rgba(220, 38, 38, 0.1);
          text-align: right;
        }

        .member-credit span {
          color: var(--text-muted);
          font-size: 0.74rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .member-credit strong {
          font-size: 1.35rem;
          line-height: 1.1;
          letter-spacing: -0.03em;
          word-break: break-word;
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

        .member-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          padding-top: 14px;
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

        .member-actions-buttons {
          justify-content: flex-end;
        }

        .status-pill {
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
        }

        .status-pill.status-active {
          background: rgba(16, 185, 129, 0.12);
          color: #047857;
        }

        .status-pill.status-inactive,
        .status-pill.status-suspended {
          background: rgba(220, 38, 38, 0.12);
          color: var(--danger);
        }

        .wizard-form,
        .lottery-groups,
        .lottery-group {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .wizard-steps,
        .inline-actions,
        .bet-type-row,
        .lottery-card-header,
        .wizard-footer-right {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .wizard-steps {
          margin-bottom: 6px;
        }

        .wizard-step {
          flex: 1 1 0;
          min-width: 120px;
          padding: 12px 14px;
          border-radius: 16px;
          border: 1px solid rgba(220, 38, 38, 0.12);
          background: rgba(255, 250, 250, 0.92);
          color: var(--text-secondary);
          text-align: left;
        }

        .wizard-step span {
          display: inline-flex;
          width: 28px;
          height: 28px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: rgba(220, 38, 38, 0.08);
          color: var(--primary);
          font-size: 0.8rem;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .wizard-step strong {
          display: block;
          font-size: 0.9rem;
        }

        .wizard-step.active,
        .wizard-step.done {
          border-color: rgba(220, 38, 38, 0.24);
          background: rgba(220, 38, 38, 0.08);
          color: var(--primary-dark);
        }

        .wizard-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .wizard-grid label,
        .wizard-grid-textarea {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .wizard-grid label span,
        .wizard-grid-textarea span {
          font-size: 0.78rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .wizard-grid input,
        .wizard-grid select,
        .wizard-grid textarea,
        .wizard-grid-textarea textarea {
          width: 100%;
          min-height: 52px;
          padding: 14px 16px;
          border-radius: 16px;
          border: 1px solid rgba(220, 38, 38, 0.12);
          background: rgba(255, 255, 255, 0.96);
          color: var(--text-primary);
        }

        .wizard-grid input:focus,
        .wizard-grid select:focus,
        .wizard-grid textarea:focus,
        .wizard-grid-textarea textarea:focus {
          outline: none;
          border-color: rgba(220, 38, 38, 0.32);
          box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.08);
        }

        .wizard-grid .full {
          grid-column: 1 / -1;
        }

        .form-hint,
        .lottery-group-title,
        .lottery-card-header span {
          color: var(--text-secondary);
        }

        .form-hint {
          font-size: 0.9rem;
        }

        .lottery-group-title {
          font-size: 0.9rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .lottery-card {
          border-radius: 18px;
          border: 1px solid rgba(220, 38, 38, 0.12);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 248, 248, 0.96));
          padding: 18px;
        }

        .lottery-card.muted {
          opacity: 0.72;
        }

        .lottery-card-header {
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .lottery-card-header strong {
          display: block;
          margin-bottom: 6px;
        }

        .inline-check {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
        }

        .bet-type-row {
          margin: 16px 0;
        }

        .bet-chip {
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid rgba(220, 38, 38, 0.12);
          background: rgba(255, 255, 255, 0.9);
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 700;
        }

        .bet-chip.active {
          border-color: rgba(220, 38, 38, 0.26);
          background: rgba(220, 38, 38, 0.1);
          color: var(--primary-dark);
        }

        .lottery-advanced-row {
          margin-bottom: 12px;
        }

        .wizard-footer {
          justify-content: space-between;
          align-items: center;
        }

        @media (max-width: 1080px) {
          .summary-grid,
          .member-metrics,
          .filter-toolbar,
          .wizard-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 920px) {
          .summary-grid,
          .member-metrics,
          .filter-toolbar,
          .wizard-grid {
            grid-template-columns: 1fr;
          }

          .members-hero,
          .member-card-header {
            display: flex;
            flex-direction: column;
            align-items: stretch;
          }

          .page-actions {
            width: 100%;
            justify-content: stretch;
          }

          .page-actions .btn,
          .member-actions-buttons .btn {
            flex: 1;
            justify-content: center;
          }

          .member-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .filter-actions,
          .filter-actions-buttons,
          .member-pagination-card {
            width: 100%;
            flex-direction: column;
            align-items: stretch;
          }

          .member-credit {
            width: 100%;
            text-align: left;
            min-width: 0;
          }
        }

        @media (max-width: 640px) {
          .member-identity {
            flex-direction: column;
          }

          .wizard-footer,
          .wizard-footer-right,
          .member-actions-buttons,
          .page-actions {
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

export default CustomerManagement;
