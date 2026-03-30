import { useEffect, useMemo, useState } from 'react';
import { FiRefreshCw, FiTrendingDown, FiTrendingUp } from 'react-icons/fi';
import toast from 'react-hot-toast';
import PageSkeleton from '../../components/PageSkeleton';
import { getAgentReports } from '../../services/api';

const tabs = [
  { id: 'sales', label: 'Sales Summary' },
  { id: 'projected', label: 'Projected Risk' },
  { id: 'exposure', label: 'Number Exposure' },
  { id: 'profit', label: 'Profit / Loss' },
  { id: 'pending', label: 'Pending Items' },
  { id: 'winners', label: 'Winner Report' }
];
const sortOptions = [
  { id: 'default', label: 'default order' },
  { id: 'value_desc', label: 'highest value first' },
  { id: 'payout_desc', label: 'highest payout first' },
  { id: 'volume_desc', label: 'most rows first' }
];

const money = (value) => Number(value || 0).toLocaleString('th-TH');
const labelOrDash = (value) => value || '-';
const betTypeLabels = {
  '3top': '3 Top',
  '3tod': '3 Tod',
  '2top': '2 Top',
  '2bottom': '2 Bottom',
  'run_top': 'Run Top',
  'run_bottom': 'Run Bottom'
};

const renderTable = ({ columns, rows }) => {
  if (!rows?.length) {
    return <div className="empty-state"><div className="empty-state-text">No data for the selected filters.</div></div>;
  }

  return (
    <div className="table-container report-table-container">
      <table className="data-table report-table">
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
  const [sortBy, setSortBy] = useState('default');
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

  const sortRows = (rows = []) => {
    if (sortBy === 'default') return rows;

    const sorted = [...rows];
    const getMetric = (row) => {
      if (sortBy === 'value_desc') {
        return Number(
          row.totalSales ??
          row.pendingStake ??
          row.totalAmount ??
          row.resolvedSales ??
          row.amount ??
          0
        );
      }

      if (sortBy === 'payout_desc') {
        return Number(
          row.totalPayout ??
          row.pendingPotentialPayout ??
          row.totalPotentialPayout ??
          row.resolvedPayout ??
          row.potentialPayout ??
          row.wonAmount ??
          0
        );
      }

      return Number(row.memberCount ?? row.itemCount ?? row.totalCustomers ?? 0);
    };

    sorted.sort((left, right) => getMetric(right) - getMetric(left));
    return sorted;
  };

  const tabContent = {
    sales: renderTable({ columns: salesColumns, rows: sortRows(report?.salesSummary || []) }),
    projected: renderTable({ columns: projectedColumns, rows: sortRows(report?.projectedRows || []) }),
    exposure: renderTable({ columns: exposureColumns, rows: sortRows(report?.exposureRows || []) }),
    profit: renderTable({ columns: profitColumns, rows: sortRows(report?.profitLossRows || []) }),
    pending: renderTable({ columns: pendingColumns, rows: sortRows(report?.pendingRows || []) }),
    winners: renderTable({ columns: winnerColumns, rows: sortRows(report?.winnerRows || []) })
  };

  const overviewCards = [
    { label: 'Sales', value: `${money(overview.totalSales)} ฿`, hint: 'Resolved and pending stake combined' },
    { label: 'Payout', value: `${money(overview.totalPayout)} ฿`, hint: 'Resolved payout already calculated' },
    { label: 'Pending stake', value: `${money(overview.pendingStake)} ฿`, hint: 'Still waiting for result settlement' },
    { label: 'Potential payout', value: `${money(overview.pendingPotentialPayout)} ฿`, hint: 'Maximum projected payout from pending items' },
    { label: 'Pending items', value: money(overview.pendingItems), hint: 'Open items across markets and rounds' },
    { label: 'Members', value: money(overview.totalCustomers), hint: 'Members included in this report range' }
  ];

  if (loading && !report) return <PageSkeleton statCount={6} rows={6} sidebar={false} />;

  return (
    <div className="agent-report-page animate-fade-in">
      <section className="report-hero-card card">
        <div className="report-hero-copy">
          <span className="section-eyebrow">Analytics workspace</span>
          <h1 className="page-title">Agent Reports</h1>
          <p className="page-subtitle">Review sales, pending exposure, projected liability, and winner reports from one focused reporting surface.</p>
        </div>

        <div className="report-hero-actions">
          <div className={`report-hero-summary ${(overview.resolvedNetProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
            <span>Resolved net result</span>
            <strong>{(overview.resolvedNetProfit || 0) >= 0 ? '+' : ''}{money(overview.resolvedNetProfit)} ฿</strong>
            <small>
              {(overview.resolvedNetProfit || 0) >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
              Pending liability {money(overview.projectedLiability)} ฿
            </small>
          </div>

          <button className="btn btn-secondary" onClick={() => load(filters)} disabled={loading}>
            <FiRefreshCw className={loading ? 'spin-animation' : ''} />
            Refresh
          </button>
        </div>
      </section>

      <section className="report-overview-grid">
        {overviewCards.map((card) => (
          <article key={card.label} className="report-overview-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </article>
        ))}
      </section>

      <section className="card report-filter-card">
        <div className="report-filter-head">
          <div>
            <div className="filter-title">Filters</div>
            <div className="filter-subtitle">Refine the report by round, market, or date range before switching between report tabs.</div>
          </div>
          <div className="filter-chip">{tabs.find((tab) => tab.id === activeTab)?.label}</div>
        </div>

        <div className="report-filter-grid">
          <label>
            <span>Round</span>
            <input value={draftFilters.roundDate} onChange={(event) => setDraftFilters((current) => ({ ...current, roundDate: event.target.value }))} placeholder="2026-03-16" />
          </label>
          <label>
            <span>Market code</span>
            <input value={draftFilters.marketId} onChange={(event) => setDraftFilters((current) => ({ ...current, marketId: event.target.value }))} placeholder="thai_government" />
          </label>
          <label>
            <span>Start date</span>
            <input type="date" value={draftFilters.startDate} onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))} />
          </label>
          <label>
            <span>End date</span>
            <input type="date" value={draftFilters.endDate} onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))} />
          </label>
          <label>
            <span>Sort rows</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              {sortOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
        </div>

        <div className="report-filter-actions">
          <button className="btn btn-secondary" onClick={() => setDraftFilters({ roundDate: '', marketId: '', startDate: '', endDate: '' })}>Clear</button>
          <button className="btn btn-primary" onClick={() => setFilters({ ...draftFilters })}>Apply filters</button>
        </div>
      </section>

      <section className="card report-tabs-card">
        <div className="report-tab-row">
          {tabs.map((tab) => (
            <button key={tab.id} className={`report-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card report-table-card">
        {loading ? <div className="loading-container"><div className="spinner"></div></div> : tabContent[activeTab]}
      </section>

      <style>{`
        .agent-report-page {
          display: flex;
          flex-direction: column;
          gap: 18px;
          position: relative;
          isolation: isolate;
        }

        .agent-report-page::before {
          content: '';
          position: absolute;
          inset: -48px 0 auto;
          height: 220px;
          background: radial-gradient(circle at top left, rgba(16, 185, 129, 0.14), transparent 62%);
          pointer-events: none;
          z-index: -1;
        }

        .report-hero-card {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
          gap: 20px;
          padding: 28px;
          background:
            linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(17, 24, 39, 0.9)),
            radial-gradient(circle at top right, rgba(16, 185, 129, 0.12), transparent 38%);
          border-color: rgba(52, 211, 153, 0.18);
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.34);
        }

        .report-hero-copy {
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

        .report-hero-card .page-title {
          margin: 0;
          font-size: clamp(2rem, 4vw, 3rem);
          line-height: 0.96;
          letter-spacing: -0.04em;
        }

        .report-hero-card .page-subtitle {
          margin: 0;
          max-width: 58ch;
        }

        .report-hero-actions {
          display: flex;
          flex-direction: column;
          gap: 14px;
          align-items: stretch;
          justify-content: space-between;
        }

        .report-hero-summary {
          padding: 18px;
          border-radius: 20px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(9, 16, 30, 0.84);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .report-hero-summary.positive {
          border-color: rgba(16, 185, 129, 0.22);
          box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.06);
        }

        .report-hero-summary.negative {
          border-color: rgba(239, 68, 68, 0.22);
          box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.06);
        }

        .report-hero-summary span, .report-hero-summary small, .report-overview-card span, .report-overview-card small, .report-filter-grid label span, .filter-subtitle {
          color: var(--text-muted);
        }

        .report-hero-summary strong {
          font-size: clamp(2rem, 4vw, 2.8rem);
          line-height: 0.95;
          letter-spacing: -0.05em;
        }

        .report-hero-summary small {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .report-overview-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 12px;
        }

        .report-overview-card {
          padding: 18px;
          border-radius: 20px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: linear-gradient(180deg, rgba(20, 30, 49, 0.94), rgba(15, 23, 42, 0.9));
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .report-overview-card strong {
          font-size: 1.4rem;
          line-height: 1;
          letter-spacing: -0.04em;
        }

        .report-filter-card {
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding: 22px;
        }

        .report-filter-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-end;
          flex-wrap: wrap;
        }

        .filter-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .filter-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(52, 211, 153, 0.16);
          color: var(--primary-light);
          font-size: 0.78rem;
          font-weight: 700;
        }

        .report-filter-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }

        .report-filter-grid label {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .report-filter-grid label span {
          font-size: 0.78rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .report-filter-grid input, .report-filter-grid select {
          width: 100%;
          min-height: 52px;
          padding: 14px 16px;
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(9, 16, 30, 0.92);
          color: var(--text-primary);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .report-filter-grid input:focus, .report-filter-grid select:focus {
          outline: none;
          border-color: rgba(52, 211, 153, 0.42);
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.08);
        }

        .report-filter-actions, .report-tab-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .report-tabs-card, .report-table-card {
          padding: 18px;
        }

        .report-tab {
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(9, 16, 30, 0.76);
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 700;
          transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, transform 0.2s ease;
        }

        .report-tab:hover {
          transform: translateY(-1px);
          border-color: rgba(52, 211, 153, 0.18);
        }

        .report-tab.active {
          border-color: rgba(52, 211, 153, 0.2);
          background: rgba(16, 185, 129, 0.12);
          color: var(--primary-light);
        }

        .report-table-container {
          border-radius: 20px;
          border-color: rgba(148, 163, 184, 0.14);
          background: rgba(9, 16, 30, 0.8);
        }

        .report-table thead {
          background: rgba(15, 23, 42, 0.92);
        }

        .report-table tbody tr:hover {
          background: rgba(15, 23, 42, 0.72);
        }

        @media (max-width: 1100px) {
          .report-hero-card, .report-overview-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .report-hero-card {
            grid-template-columns: 1fr;
          }

          .report-filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .report-overview-grid, .report-filter-grid {
            grid-template-columns: 1fr;
          }

          .report-filter-actions .btn {
            flex: 1;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default AgentReports;
