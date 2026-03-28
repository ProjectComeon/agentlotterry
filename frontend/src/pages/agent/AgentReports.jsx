import { useEffect, useMemo, useState } from 'react';
import { FiRefreshCw, FiTrendingDown, FiTrendingUp } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { getAgentReports } from '../../services/api';

const tabs = [
  { id: 'sales', label: 'Sales Summary' },
  { id: 'projected', label: 'Projected Risk' },
  { id: 'exposure', label: 'Number Exposure' },
  { id: 'profit', label: 'Profit / Loss' },
  { id: 'pending', label: 'Pending Items' },
  { id: 'winners', label: 'Winner Report' }
];

const money = (value) => Number(value || 0).toLocaleString();
const labelOrDash = (value) => value || '-';
const betTypeLabels = { '3top': '3 Top', '3tod': '3 Tod', '2top': '2 Top', '2bottom': '2 Bottom', 'run_top': 'Run Top', 'run_bottom': 'Run Bottom' };

const renderTable = ({ columns, rows }) => {
  if (!rows?.length) {
    return <div className="empty-state"><div className="empty-state-text">No data for the selected filters.</div></div>;
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.id || row._id || row.number || row.marketId || 'row'}-${index}`}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render ? column.render(row) : labelOrDash(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AgentReports = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sales');
  const [draftFilters, setDraftFilters] = useState({
    roundDate: '',
    marketId: '',
    startDate: '',
    endDate: ''
  });
  const [filters, setFilters] = useState({
    roundDate: '',
    marketId: '',
    startDate: '',
    endDate: ''
  });

  const load = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const res = await getAgentReports(nextFilters);
      setReport(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filters);
  }, [filters.roundDate, filters.marketId, filters.startDate, filters.endDate]);

  const overview = report?.overview || {};
  const salesColumns = useMemo(() => ([
    { key: 'roundDate', label: 'Round' },
    { key: 'marketName', label: 'Market' },
    { key: 'totalSales', label: 'Sales', render: (row) => `${money(row.totalSales)} ฿` },
    { key: 'totalPayout', label: 'Payout', render: (row) => `${money(row.totalPayout)} ฿` },
    { key: 'netProfit', label: 'Net', render: (row) => `${money(row.netProfit)} ฿` },
    { key: 'itemCount', label: 'Items' },
    { key: 'slipCount', label: 'Slips' },
    { key: 'memberCount', label: 'Members' }
  ]), []);

  const projectedColumns = useMemo(() => ([
    { key: 'roundDate', label: 'Round' },
    { key: 'marketName', label: 'Market' },
    { key: 'pendingStake', label: 'Pending stake', render: (row) => `${money(row.pendingStake)} ฿` },
    { key: 'pendingPotentialPayout', label: 'Potential payout', render: (row) => `${money(row.pendingPotentialPayout)} ฿` },
    { key: 'projectedLiability', label: 'Projected liability', render: (row) => `${money(row.projectedLiability)} ฿` },
    { key: 'itemCount', label: 'Items' },
    { key: 'memberCount', label: 'Members' }
  ]), []);

  const exposureColumns = useMemo(() => ([
    { key: 'roundDate', label: 'Round' },
    { key: 'marketName', label: 'Market' },
    { key: 'betType', label: 'Type', render: (row) => betTypeLabels[row.betType] || row.betType },
    { key: 'number', label: 'Number' },
    { key: 'totalAmount', label: 'Exposure', render: (row) => `${money(row.totalAmount)} ฿` },
    { key: 'totalPotentialPayout', label: 'Potential payout', render: (row) => `${money(row.totalPotentialPayout)} ฿` },
    { key: 'itemCount', label: 'Items' },
    { key: 'memberCount', label: 'Members' }
  ]), []);

  const profitColumns = useMemo(() => ([
    { key: 'roundDate', label: 'Round' },
    { key: 'marketName', label: 'Market' },
    { key: 'resolvedSales', label: 'Resolved sales', render: (row) => `${money(row.resolvedSales)} ฿` },
    { key: 'resolvedPayout', label: 'Resolved payout', render: (row) => `${money(row.resolvedPayout)} ฿` },
    { key: 'netProfit', label: 'Net', render: (row) => `${money(row.netProfit)} ฿` },
    { key: 'wonItems', label: 'Won' },
    { key: 'lostItems', label: 'Lost' }
  ]), []);

  const pendingColumns = useMemo(() => ([
    { key: 'marketName', label: 'Market' },
    { key: 'roundDate', label: 'Round' },
    { key: 'customerId', label: 'Member', render: (row) => row.customerId?.name || '-' },
    { key: 'betType', label: 'Type', render: (row) => betTypeLabels[row.betType] || row.betType },
    { key: 'number', label: 'Number' },
    { key: 'amount', label: 'Amount', render: (row) => `${money(row.amount)} ฿` },
    { key: 'potentialPayout', label: 'Potential payout', render: (row) => `${money(row.potentialPayout)} ฿` },
    { key: 'netRisk', label: 'Net risk', render: (row) => `${money(row.netRisk)} ฿` }
  ]), []);

  const winnerColumns = useMemo(() => ([
    { key: 'marketName', label: 'Market' },
    { key: 'roundDate', label: 'Round' },
    { key: 'customerId', label: 'Member', render: (row) => row.customerId?.name || '-' },
    { key: 'betType', label: 'Type', render: (row) => betTypeLabels[row.betType] || row.betType },
    { key: 'number', label: 'Number' },
    { key: 'amount', label: 'Stake', render: (row) => `${money(row.amount)} ฿` },
    { key: 'wonAmount', label: 'Won amount', render: (row) => `${money(row.wonAmount)} ฿` },
    { key: 'payRate', label: 'Rate', render: (row) => `x${row.payRate}` }
  ]), []);

  const tabContent = {
    sales: renderTable({ columns: salesColumns, rows: report?.salesSummary || [] }),
    projected: renderTable({ columns: projectedColumns, rows: report?.projectedRows || [] }),
    exposure: renderTable({ columns: exposureColumns, rows: report?.exposureRows || [] }),
    profit: renderTable({ columns: profitColumns, rows: report?.profitLossRows || [] }),
    pending: renderTable({ columns: pendingColumns, rows: report?.pendingRows || [] }),
    winners: renderTable({ columns: winnerColumns, rows: report?.winnerRows || [] })
  };

  return (
    <div className="agent-report-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Agent Reports</h1>
          <p className="page-subtitle">Sales, pending exposure, projected liability, and winner reports in one place.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => load(filters)} disabled={loading}>
          <FiRefreshCw className={loading ? 'spin-animation' : ''} />
          Refresh
        </button>
      </div>

      <section className={`report-hero ${(overview.resolvedNetProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
        <span>Resolved net result</span>
        <strong>{(overview.resolvedNetProfit || 0) >= 0 ? '+' : ''}{money(overview.resolvedNetProfit)} ฿</strong>
        <small>
          {overview.resolvedNetProfit >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
          Pending liability {money(overview.projectedLiability)} ฿
        </small>
      </section>

      <section className="report-overview-grid">
        <div className="report-overview-card"><span>Sales</span><strong>{money(overview.totalSales)} ฿</strong></div>
        <div className="report-overview-card"><span>Payout</span><strong>{money(overview.totalPayout)} ฿</strong></div>
        <div className="report-overview-card"><span>Pending stake</span><strong>{money(overview.pendingStake)} ฿</strong></div>
        <div className="report-overview-card"><span>Potential payout</span><strong>{money(overview.pendingPotentialPayout)} ฿</strong></div>
        <div className="report-overview-card"><span>Pending items</span><strong>{money(overview.pendingItems)}</strong></div>
        <div className="report-overview-card"><span>Members</span><strong>{money(overview.totalCustomers)}</strong></div>
      </section>

      <section className="card report-filter-card">
        <div className="report-filter-grid">
          <label><span>Round</span><input value={draftFilters.roundDate} onChange={(event) => setDraftFilters((current) => ({ ...current, roundDate: event.target.value }))} placeholder="2026-03-16" /></label>
          <label><span>Market code</span><input value={draftFilters.marketId} onChange={(event) => setDraftFilters((current) => ({ ...current, marketId: event.target.value }))} placeholder="thai_government" /></label>
          <label><span>Start date</span><input type="date" value={draftFilters.startDate} onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label><span>End date</span><input type="date" value={draftFilters.endDate} onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))} /></label>
        </div>
        <div className="report-filter-actions">
          <button className="btn btn-secondary" onClick={() => setDraftFilters({ roundDate: '', marketId: '', startDate: '', endDate: '' })}>Clear</button>
          <button className="btn btn-primary" onClick={() => setFilters({ ...draftFilters })}>Apply filters</button>
        </div>
      </section>

      <section className="card">
        <div className="report-tab-row">
          {tabs.map((tab) => (
            <button key={tab.id} className={`report-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        {loading ? <div className="loading-container"><div className="spinner"></div></div> : tabContent[activeTab]}
      </section>

      <style>{`
        .agent-report-page { display: flex; flex-direction: column; gap: 16px; }
        .report-hero, .report-overview-card { border-radius: var(--radius-md); border: 1px solid var(--border); }
        .report-hero { padding: 22px; display: flex; flex-direction: column; gap: 8px; }
        .report-hero.positive { background: linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(16, 185, 129, 0.05)); }
        .report-hero.negative { background: linear-gradient(135deg, rgba(239, 68, 68, 0.14), rgba(239, 68, 68, 0.05)); }
        .report-hero span, .report-hero small, .report-overview-card span, .report-filter-grid label span { color: var(--text-muted); }
        .report-hero strong { font-size: 2rem; }
        .report-hero small { display: inline-flex; align-items: center; gap: 8px; }
        .report-overview-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
        .report-overview-card { background: var(--bg-card); padding: 14px; display: flex; flex-direction: column; gap: 8px; }
        .report-overview-card strong { font-size: 1.2rem; }
        .report-filter-card, .report-filter-actions, .report-tab-row { display: flex; gap: 12px; flex-wrap: wrap; }
        .report-filter-card { flex-direction: column; }
        .report-filter-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .report-filter-grid label { display: flex; flex-direction: column; gap: 8px; }
        .report-filter-grid input { width: 100%; background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-primary); padding: 12px 14px; }
        .report-tab { padding: 10px 14px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-secondary); font-size: 0.82rem; font-weight: 700; }
        .report-tab.active { border-color: var(--border-accent); background: var(--primary-subtle); color: var(--primary-light); }
        @media (max-width: 920px) { .report-overview-grid, .report-filter-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 640px) { .report-overview-grid, .report-filter-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
};

export default AgentReports;
