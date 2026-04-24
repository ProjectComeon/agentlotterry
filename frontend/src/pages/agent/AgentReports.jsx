import { useEffect, useMemo, useRef, useState } from 'react';
import { FiRefreshCw, FiTrendingDown, FiTrendingUp } from 'react-icons/fi';
import toast from 'react-hot-toast';
import PageSkeleton from '../../components/PageSkeleton';
import { agentCopy } from '../../i18n/th/agent';
import { getBetTypeLabel } from '../../i18n/th/labels';
import { getAgentReports, getCatalogLotteries, getCatalogRounds } from '../../services/api';
import { formatMoney as money } from '../../utils/formatters';

const copy = agentCopy.reports;
const tabs = [
  { id: 'sales', label: copy.tabs.sales },
  { id: 'projected', label: copy.tabs.projected },
  { id: 'exposure', label: copy.tabs.exposure },
  { id: 'profit', label: copy.tabs.profit },
  { id: 'pending', label: copy.tabs.pending },
  { id: 'winners', label: copy.tabs.winners }
];
const sortOptions = [
  { id: 'default', label: copy.sortOptions.default },
  { id: 'value_desc', label: copy.sortOptions.value_desc },
  { id: 'payout_desc', label: copy.sortOptions.payout_desc },
  { id: 'volume_desc', label: copy.sortOptions.volume_desc }
];

const labelOrDash = (value) => value || '-';
const defaultFilters = {
  roundDate: '',
  marketId: '',
  startDate: '',
  endDate: ''
};
const reportSectionByTab = {
  sales: 'salesSummary',
  projected: 'projectedRows',
  exposure: 'exposureRows',
  profit: 'profitLossRows',
  pending: 'pendingRows',
  winners: 'winnerRows'
};
const emptyReport = {
  overview: {},
  salesSummary: [],
  projectedRows: [],
  exposureRows: [],
  profitLossRows: [],
  pendingRows: [],
  winnerRows: [],
  filters: { ...defaultFilters },
  loadedSections: []
};
const normalizeReportFilters = (value = {}) => ({
  roundDate: value.roundDate || '',
  marketId: value.marketId || '',
  startDate: value.startDate || '',
  endDate: value.endDate || ''
});
const areReportFiltersEqual = (left = {}, right = {}) => {
  const normalizedLeft = normalizeReportFilters(left);
  const normalizedRight = normalizeReportFilters(right);
  return Object.keys(defaultFilters).every((key) => normalizedLeft[key] === normalizedRight[key]);
};

const renderTable = ({ columns, rows }) => {
  if (!rows?.length) {
    return <div className="empty-state"><div className="empty-state-text">{copy.empty}</div></div>;
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
  const [tableLoading, setTableLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('sales');
  const [sortBy, setSortBy] = useState('default');
  const [marketOptions, setMarketOptions] = useState([]);
  const [roundOptions, setRoundOptions] = useState([]);
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const [filters, setFilters] = useState(defaultFilters);
  const initialLoadRef = useRef(true);
  const reportRequestRef = useRef(0);

  const selectedMarket = useMemo(
    () => marketOptions.find((option) => option.code === draftFilters.marketId) || null,
    [draftFilters.marketId, marketOptions]
  );
  const activeSection = reportSectionByTab[activeTab] || reportSectionByTab.sales;

  const load = async (nextFilters = filters, nextActiveTab = activeTab, options = {}) => {
    const requestId = ++reportRequestRef.current;
    if (options.background) {
      setTableLoading(true);
    } else {
      setLoading(true);
    }
    try {
      const section = reportSectionByTab[nextActiveTab] || reportSectionByTab.sales;
      const requestFilters = normalizeReportFilters(nextFilters);
      const hasReusableOverview = report &&
        areReportFiltersEqual(report.filters, requestFilters) &&
        (report.loadedSections || []).includes('overview');
      const shouldLoadOverview = options.forceOverview || !hasReusableOverview;
      const requestedSections = Array.isArray(options.sections) && options.sections.length
        ? options.sections
        : (shouldLoadOverview ? ['overview', section] : [section]);
      const res = await getAgentReports({
        ...requestFilters,
        sections: requestedSections.join(',')
      });

      if (requestId !== reportRequestRef.current) {
        return;
      }

      setReport((current) => {
        const base = current && areReportFiltersEqual(current.filters, requestFilters)
          ? current
          : emptyReport;
        const loadedSections = res.data?.loadedSections || [];
        const responseIncludesOverview = loadedSections.includes('overview');
        const nextReport = {
          ...emptyReport,
          ...base,
          overview: responseIncludesOverview ? (res.data?.overview || {}) : (base.overview || {}),
          filters: normalizeReportFilters(res.data?.filters || requestFilters),
          loadedSections: Array.from(new Set([
            ...(base.loadedSections || []),
            ...loadedSections
          ]))
        };
        loadedSections.forEach((loadedSection) => {
          if (loadedSection !== 'overview') {
            nextReport[loadedSection] = res.data?.[loadedSection] || [];
          }
        });
        return {
          ...nextReport,
          legacyRows: nextReport.salesSummary.map((row) => ({
            roundDate: row.roundDate,
            marketId: row.marketId,
            marketName: row.marketName,
            totalAmount: row.totalSales,
            totalWon: row.totalPayout,
            netProfit: row.netProfit,
            betCount: row.itemCount,
            wonCount: row.wonItems,
            lostCount: row.lostItems,
            pendingCount: row.pendingItems
          }))
        };
      });
    } catch (error) {
      console.error(error);
      toast.error(copy.loadError);
    } finally {
      if (requestId === reportRequestRef.current) {
        if (options.background) {
          setTableLoading(false);
        } else {
          setLoading(false);
        }
      }
    }
  };

  useEffect(() => {
    const loadMarkets = async () => {
      try {
        const res = await getCatalogLotteries();
        setMarketOptions(res.data || []);
      } catch (error) {
        console.error(error);
        toast.error('โหลดรายการตลาดไม่สำเร็จ');
      }
    };

    loadMarkets();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        await load(filters, activeTab, { sections: ['overview'] });
        if (!cancelled) {
          load(filters, activeTab, { sections: [activeSection], background: true });
        }
        return;
      }

      load(filters, activeTab);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [activeSection, activeTab, filters.roundDate, filters.marketId, filters.startDate, filters.endDate]);

  useEffect(() => {
    const loadRounds = async () => {
      if (!selectedMarket?.id) {
        setRoundOptions([]);
        return;
      }

      setRoundsLoading(true);
      try {
        const res = await getCatalogRounds(selectedMarket.id);
        const nextRounds = res.data || [];
        setRoundOptions(nextRounds);

        if (draftFilters.roundDate && !nextRounds.some((round) => round.code === draftFilters.roundDate)) {
          setDraftFilters((current) => ({ ...current, roundDate: '' }));
        }
      } catch (error) {
        console.error(error);
        toast.error('โหลดงวดของตลาดไม่สำเร็จ');
      } finally {
        setRoundsLoading(false);
      }
    };

    loadRounds();
  }, [selectedMarket?.id]);

  const overview = report?.overview || {};

  const salesColumns = useMemo(() => ([
    { key: 'roundDate', label: copy.columns.roundDate },
    { key: 'marketName', label: copy.columns.marketName },
    { key: 'totalSales', label: copy.columns.totalSales, render: (row) => `${money(row.totalSales)} บาท` },
    { key: 'totalPayout', label: copy.columns.totalPayout, render: (row) => `${money(row.totalPayout)} บาท` },
    { key: 'netProfit', label: copy.columns.netProfit, render: (row) => `${money(row.netProfit)} บาท` },
    { key: 'itemCount', label: copy.columns.itemCount },
    { key: 'slipCount', label: copy.columns.slipCount },
    { key: 'memberCount', label: copy.columns.memberCount }
  ]), []);

  const projectedColumns = useMemo(() => ([
    { key: 'roundDate', label: copy.columns.roundDate },
    { key: 'marketName', label: copy.columns.marketName },
    { key: 'pendingStake', label: copy.columns.pendingStake, render: (row) => `${money(row.pendingStake)} บาท` },
    { key: 'pendingPotentialPayout', label: copy.columns.pendingPotentialPayout, render: (row) => `${money(row.pendingPotentialPayout)} บาท` },
    { key: 'projectedLiability', label: copy.columns.projectedLiability, render: (row) => `${money(row.projectedLiability)} บาท` },
    { key: 'itemCount', label: copy.columns.itemCount },
    { key: 'memberCount', label: copy.columns.memberCount }
  ]), []);

  const exposureColumns = useMemo(() => ([
    { key: 'roundDate', label: copy.columns.roundDate },
    { key: 'marketName', label: copy.columns.marketName },
    { key: 'betType', label: copy.columns.betType, render: (row) => getBetTypeLabel(row.betType) },
    { key: 'number', label: copy.columns.number },
    { key: 'totalAmount', label: copy.columns.totalAmount, render: (row) => `${money(row.totalAmount)} บาท` },
    { key: 'totalPotentialPayout', label: copy.columns.totalPotentialPayout, render: (row) => `${money(row.totalPotentialPayout)} บาท` },
    { key: 'itemCount', label: copy.columns.itemCount },
    { key: 'memberCount', label: copy.columns.memberCount }
  ]), []);

  const profitColumns = useMemo(() => ([
    { key: 'roundDate', label: copy.columns.roundDate },
    { key: 'marketName', label: copy.columns.marketName },
    { key: 'resolvedSales', label: copy.columns.resolvedSales, render: (row) => `${money(row.resolvedSales)} บาท` },
    { key: 'resolvedPayout', label: copy.columns.resolvedPayout, render: (row) => `${money(row.resolvedPayout)} บาท` },
    { key: 'netProfit', label: copy.columns.netProfit, render: (row) => `${money(row.netProfit)} บาท` },
    { key: 'wonItems', label: copy.columns.wonItems },
    { key: 'lostItems', label: copy.columns.lostItems }
  ]), []);

  const pendingColumns = useMemo(() => ([
    { key: 'marketName', label: copy.columns.marketName },
    { key: 'roundDate', label: copy.columns.roundDate },
    { key: 'customerId', label: copy.columns.customer, render: (row) => row.customerId?.name || '-' },
    { key: 'betType', label: copy.columns.betType, render: (row) => getBetTypeLabel(row.betType) },
    { key: 'number', label: copy.columns.number },
    { key: 'amount', label: copy.columns.amount, render: (row) => `${money(row.amount)} บาท` },
    { key: 'potentialPayout', label: copy.columns.potentialPayout, render: (row) => `${money(row.potentialPayout)} บาท` },
    { key: 'netRisk', label: copy.columns.netRisk, render: (row) => `${money(row.netRisk)} บาท` }
  ]), []);

  const winnerColumns = useMemo(() => ([
    { key: 'marketName', label: copy.columns.marketName },
    { key: 'roundDate', label: copy.columns.roundDate },
    { key: 'customerId', label: copy.columns.customer, render: (row) => row.customerId?.name || '-' },
    { key: 'betType', label: copy.columns.betType, render: (row) => getBetTypeLabel(row.betType) },
    { key: 'number', label: copy.columns.number },
    { key: 'amount', label: copy.columns.amount, render: (row) => `${money(row.amount)} บาท` },
    { key: 'wonAmount', label: copy.columns.wonAmount, render: (row) => `${money(row.wonAmount)} บาท` },
    { key: 'payRate', label: copy.columns.payRate, render: (row) => `x${row.payRate}` }
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
  const columnsByTab = {
    sales: salesColumns,
    projected: projectedColumns,
    exposure: exposureColumns,
    profit: profitColumns,
    pending: pendingColumns,
    winners: winnerColumns
  };
  const activeRows = useMemo(
    () => sortRows(report?.[activeSection] || []),
    [activeSection, report, sortBy]
  );
  const hasOverviewLoaded = Boolean(report && (report.loadedSections || []).includes('overview'));
  const hasActiveSectionLoaded = Boolean(report && (report.loadedSections || []).includes(activeSection));

  const overviewCards = [
    { label: copy.overviewCards.totalSales.label, value: `${money(overview.totalSales)} บาท`, hint: copy.overviewCards.totalSales.hint },
    { label: copy.overviewCards.totalPayout.label, value: `${money(overview.totalPayout)} บาท`, hint: copy.overviewCards.totalPayout.hint },
    { label: copy.overviewCards.pendingStake.label, value: `${money(overview.pendingStake)} บาท`, hint: copy.overviewCards.pendingStake.hint },
    { label: copy.overviewCards.pendingPotentialPayout.label, value: `${money(overview.pendingPotentialPayout)} บาท`, hint: copy.overviewCards.pendingPotentialPayout.hint },
    { label: copy.overviewCards.pendingItems.label, value: money(overview.pendingItems), hint: copy.overviewCards.pendingItems.hint },
    { label: copy.overviewCards.totalCustomers.label, value: money(overview.totalCustomers), hint: copy.overviewCards.totalCustomers.hint }
  ];

  if (loading && !hasOverviewLoaded) return <PageSkeleton statCount={6} rows={6} sidebar={false} />;

  return (
    <div className="agent-report-page animate-fade-in">
      <section className="report-hero-card card">
        <div className="report-hero-copy">
          <span className="section-eyebrow">{copy.heroEyebrow}</span>
          <h1 className="page-title">{copy.heroTitle}</h1>
          <p className="page-subtitle">{copy.heroSubtitle}</p>
        </div>

        <div className="report-hero-actions">
          <div className={`report-hero-summary ${(overview.resolvedNetProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
            <span>{copy.resolvedNetProfit}</span>
            <strong>{(overview.resolvedNetProfit || 0) >= 0 ? '+' : ''}{money(overview.resolvedNetProfit)} บาท</strong>
            <small>
              {(overview.resolvedNetProfit || 0) >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
              {copy.pendingLiability(money(overview.projectedLiability))}
            </small>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => load(filters, activeTab, { forceOverview: true })}
            disabled={loading || tableLoading}
          >
            <FiRefreshCw className={loading || tableLoading ? 'spin-animation' : ''} />
            {copy.refresh}
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
            <div className="filter-title">{copy.filterTitle}</div>
            <div className="filter-subtitle">{copy.filterSubtitle}</div>
          </div>
          <div className="filter-chip">{tabs.find((tab) => tab.id === activeTab)?.label}</div>
        </div>

        <div className="report-filter-grid">
          <label>
            <span>{copy.marketId}</span>
            <select
              value={draftFilters.marketId}
              onChange={(event) => setDraftFilters((current) => ({
                ...current,
                marketId: event.target.value,
                roundDate: ''
              }))}
            >
              <option value="">ทุกตลาด</option>
              {marketOptions.map((market) => (
                <option key={market.id} value={market.code}>
                  {market.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{copy.roundDate}</span>
            <select
              value={draftFilters.roundDate}
              onChange={(event) => setDraftFilters((current) => ({ ...current, roundDate: event.target.value }))}
              disabled={!draftFilters.marketId || roundsLoading}
            >
              <option value="">
                {!draftFilters.marketId ? 'เลือกตลาดก่อน' : roundsLoading ? 'กำลังโหลดงวด...' : 'ทุกงวด'}
              </option>
              {roundOptions.map((round) => (
                <option key={round.id} value={round.code}>
                  {`${round.title} • ${round.statusLabel}`}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{copy.startDate}</span>
            <input
              type="date"
              value={draftFilters.startDate}
              onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))}
            />
          </label>

          <label>
            <span>{copy.endDate}</span>
            <input
              type="date"
              value={draftFilters.endDate}
              onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))}
            />
          </label>

          <label>
            <span>{copy.sortLabel}</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              {sortOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
        </div>

        <div className="report-filter-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              setDraftFilters(defaultFilters);
              setRoundOptions([]);
            }}
          >
            {copy.clearFilters}
          </button>
          <button className="btn btn-primary" onClick={() => setFilters({ ...draftFilters })}>
            {copy.applyFilters}
          </button>
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
        {(tableLoading && !hasActiveSectionLoaded) || (loading && !hasActiveSectionLoaded) ? (
          <div className="loading-container"><div className="spinner"></div></div>
        ) : renderTable({ columns: columnsByTab[activeTab], rows: activeRows })}
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
          background:
            radial-gradient(circle at top left, rgba(220, 38, 38, 0.14), transparent 62%),
            radial-gradient(circle at top right, rgba(248, 113, 113, 0.08), transparent 30%);
          pointer-events: none;
          z-index: -1;
        }

        .report-hero-card {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
          gap: 20px;
          padding: 28px;
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 244, 244, 0.98)),
            radial-gradient(circle at top right, rgba(248, 113, 113, 0.14), transparent 38%);
          border-color: rgba(220, 38, 38, 0.14);
          box-shadow: 0 20px 48px rgba(127, 29, 29, 0.1);
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
          color: var(--primary);
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
          border: 1px solid rgba(220, 38, 38, 0.12);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 246, 246, 0.96));
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .report-hero-summary.positive {
          border-color: rgba(220, 38, 38, 0.18);
          box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.05);
        }

        .report-hero-summary.negative {
          border-color: rgba(239, 68, 68, 0.22);
          box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.05);
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
          border: 1px solid rgba(220, 38, 38, 0.1);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 247, 247, 0.96));
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: 0 12px 28px rgba(127, 29, 29, 0.05);
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
          background: rgba(220, 38, 38, 0.08);
          border: 1px solid rgba(220, 38, 38, 0.12);
          color: var(--primary);
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
          border: 1px solid rgba(220, 38, 38, 0.12);
          background: rgba(255, 250, 250, 0.96);
          color: var(--text-primary);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .report-filter-grid input:focus, .report-filter-grid select:focus {
          outline: none;
          border-color: rgba(220, 38, 38, 0.28);
          box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.08);
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
          border: 1px solid rgba(220, 38, 38, 0.12);
          background: rgba(255, 247, 247, 0.92);
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 700;
          transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, transform 0.2s ease;
        }

        .report-tab:hover {
          transform: translateY(-1px);
          border-color: rgba(220, 38, 38, 0.2);
        }

        .report-tab.active {
          border-color: rgba(220, 38, 38, 0.18);
          background: rgba(220, 38, 38, 0.1);
          color: var(--primary);
        }

        .report-table-container {
          border-radius: 20px;
          border-color: rgba(220, 38, 38, 0.1);
          background: rgba(255, 251, 251, 0.96);
        }

        .report-table thead {
          background: rgba(255, 241, 241, 0.94);
        }

        .report-table tbody tr:hover {
          background: rgba(255, 245, 245, 0.94);
        }

        @media (max-width: 1100px) {
          .report-overview-grid {
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
