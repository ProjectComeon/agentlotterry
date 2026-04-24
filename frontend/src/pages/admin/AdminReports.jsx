import { useEffect, useMemo, useRef, useState } from 'react';
import { FiCalendar, FiDollarSign, FiFileText, FiLayers, FiRefreshCw, FiTrendingUp, FiUsers } from 'react-icons/fi';
import toast from 'react-hot-toast';
import PageSkeleton from '../../components/PageSkeleton';
import { adminCopy } from '../../i18n/th/admin';
import { getAdminReports, getAgents, getCatalogLotteries, getCatalogRounds } from '../../services/api';
import { formatMoney as money, formatRoundLabel } from '../../utils/formatters';
const copy = adminCopy.reports;
const defaultFilters = {
  agentId: '',
  marketId: '',
  roundDate: '',
  startDate: '',
  endDate: ''
};
const emptyOverview = {
  totalAmount: 0,
  totalWon: 0,
  betCount: 0,
  wonCount: 0,
  lostCount: 0,
  pendingCount: 0,
  totalAgents: 0,
  netProfit: 0
};
const emptyReportBundle = {
  overview: { ...emptyOverview },
  rows: [],
  filters: { ...defaultFilters },
  loadedSections: []
};

const normalizeReportFilters = (value = {}) => ({
  agentId: value.agentId || '',
  marketId: value.marketId || '',
  roundDate: value.roundDate || '',
  startDate: value.startDate || '',
  endDate: value.endDate || ''
});

const areReportFiltersEqual = (left = {}, right = {}) => {
  const normalizedLeft = normalizeReportFilters(left);
  const normalizedRight = normalizeReportFilters(right);
  return Object.keys(defaultFilters).every((key) => normalizedLeft[key] === normalizedRight[key]);
};

const mergeReportBundle = (current, data, requestFilters) => {
  const base = current && areReportFiltersEqual(current.filters, requestFilters)
    ? current
    : emptyReportBundle;
  const loadedSections = data?.loadedSections || [];
  const nextBundle = {
    ...emptyReportBundle,
    ...base,
    overview: loadedSections.includes('overview')
      ? (data?.overview || emptyOverview)
      : (base.overview || emptyOverview),
    filters: normalizeReportFilters(data?.filters || requestFilters),
    loadedSections: Array.from(new Set([...(base.loadedSections || []), ...loadedSections]))
  };

  if (loadedSections.includes('rows')) {
    nextBundle.rows = data?.rows || [];
  }

  return nextBundle;
};

const ReportTableSkeleton = () => (
  <div className="admin-report-table-skeleton" aria-hidden="true">
    <span className="admin-report-table-skeleton-bar admin-report-table-skeleton-bar-wide" />
    <span className="admin-report-table-skeleton-bar" />
    <span className="admin-report-table-skeleton-bar" />
    <span className="admin-report-table-skeleton-bar admin-report-table-skeleton-bar-short" />
  </div>
);

const AdminReports = () => {
  const [reportBundle, setReportBundle] = useState(emptyReportBundle);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [agentOptions, setAgentOptions] = useState([]);
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

  const loadReports = async (nextFilters = filters, {
    sections = ['overview', 'rows'],
    force = false,
    background = false
  } = {}) => {
    const requestId = ++reportRequestRef.current;
    const requestFilters = normalizeReportFilters(nextFilters);

    if (background) {
      setTableLoading(true);
    } else {
      setLoading(true);
    }

    try {
      const params = Object.fromEntries(
        Object.entries(requestFilters).filter(([, value]) => value !== '' && value !== null && value !== undefined)
      );
      params.limit = 200;
      params.bundle = '1';
      params.sections = sections.join(',');
      const res = await getAdminReports(params, { force });

      if (requestId !== reportRequestRef.current) {
        return;
      }

      setReportBundle((current) => mergeReportBundle(current, res.data, requestFilters));
    } catch (error) {
      console.error(error);
      toast.error('โหลดรายงานแอดมินไม่สำเร็จ');
    } finally {
      if (requestId === reportRequestRef.current) {
        if (background) {
          setTableLoading(false);
        } else {
          setLoading(false);
        }
      }
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [agentsRes, marketsRes] = await Promise.all([
          getAgents(),
          getCatalogLotteries()
        ]);
        setAgentOptions(agentsRes.data || []);
        setMarketOptions(marketsRes.data || []);
      } catch (error) {
        console.error(error);
        toast.error('โหลดตัวกรองรายงานไม่สำเร็จ');
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        await loadReports(filters, { sections: ['overview'] });
        if (!cancelled) {
          loadReports(filters, { sections: ['rows'], background: true });
        }
        return;
      }

      loadReports(filters, { sections: ['overview', 'rows'] });
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [filters.agentId, filters.marketId, filters.roundDate, filters.startDate, filters.endDate]);

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

  const reports = reportBundle.rows || [];
  const overview = reportBundle.overview || emptyOverview;
  const hasOverviewLoaded = (reportBundle.loadedSections || []).includes('overview');
  const hasRowsLoaded = (reportBundle.loadedSections || []).includes('rows');
  const totalAmount = Number(overview.totalAmount || 0);
  const totalWon = Number(overview.totalWon || 0);
  const totalBets = Number(overview.betCount || 0);
  const totalAgents = Number(overview.totalAgents || 0);
  const netProfit = Number(overview.netProfit || 0);

  const overviewCards = useMemo(() => ([
    {
      icon: FiLayers,
      label: copy.overviewCards.totalBets.label,
      value: money(totalBets),
      hint: copy.overviewCards.totalBets.hint
    },
    {
      icon: FiDollarSign,
      label: copy.overviewCards.totalAmount.label,
      value: `${money(totalAmount)} บาท`,
      hint: copy.overviewCards.totalAmount.hint
    },
    {
      icon: FiTrendingUp,
      label: copy.overviewCards.netProfit.label,
      value: `${money(netProfit)} บาท`,
      hint: copy.overviewCards.netProfit.hint
    },
    {
      icon: FiUsers,
      label: 'เจ้ามือในรายงาน',
      value: money(totalAgents),
      hint: 'จำนวนเจ้ามือที่อยู่ในผลลัพธ์หลังกรอง'
    }
  ]), [netProfit, totalAgents, totalAmount, totalBets]);

  if (loading && !hasOverviewLoaded) {
    return <PageSkeleton statCount={4} rows={6} sidebar={false} />;
  }

  return (
    <div className="ops-page admin-report-page animate-fade-in">
      <section className="ops-hero admin-report-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">{copy.heroEyebrow}</span>
          <h1 className="page-title">{copy.heroTitle}</h1>
          <p className="page-subtitle">{copy.heroSubtitle}</p>
        </div>

        <div className={`ops-hero-side ${netProfit >= 0 ? 'admin-report-positive' : 'admin-report-negative'}`}>
          <span>{copy.periodNet}</span>
          <strong>{money(netProfit)} บาท</strong>
          <small>{copy.groupedRows(reports.length)}</small>
        </div>
      </section>

      <section className="ops-overview-grid compact admin-report-overview admin-report-overview-wide">
        {overviewCards.map((card) => (
          <article key={card.label} className="ops-overview-card">
            <div className="ops-icon-badge"><card.icon /></div>
            <strong>{card.value}</strong>
            <span>{card.label}</span>
            <small>{card.hint}</small>
          </article>
        ))}
      </section>

      <section className="card ops-section admin-report-filter">
        <div className="ops-toolbar admin-report-toolbar">
          <div>
            <div className="ui-eyebrow">{copy.filterEyebrow}</div>
            <h3 className="card-title">ตัวกรองรายงาน</h3>
            <p className="ops-table-note">กรองตามเจ้ามือ ตลาด งวด และช่วงวันที่ก่อนสรุปผล</p>
          </div>
          <div className="admin-report-toolbar-controls">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadReports(filters, { sections: ['overview', 'rows'], force: true })}
              disabled={loading || tableLoading}
            >
              <FiRefreshCw className={loading || tableLoading ? 'spin-animation' : ''} />
              {adminCopy.common.refresh}
            </button>
          </div>
        </div>

        <div className="admin-report-filter-grid">
          <label>
            <span>เจ้ามือ</span>
            <select
              className="form-input"
              value={draftFilters.agentId}
              onChange={(event) => setDraftFilters((current) => ({ ...current, agentId: event.target.value }))}
            >
              <option value="">ทุกเจ้ามือ</option>
              {agentOptions.map((agent) => (
                <option key={agent._id} value={agent._id}>
                  {agent.name || agent.username}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>ตลาด</span>
            <select
              className="form-input"
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
              className="form-input"
              value={draftFilters.roundDate}
              onChange={(event) => setDraftFilters((current) => ({ ...current, roundDate: event.target.value }))}
              disabled={!draftFilters.marketId || roundsLoading}
            >
              <option value="">
                {!draftFilters.marketId ? 'เลือกตลาดก่อน' : roundsLoading ? 'กำลังโหลดงวด...' : 'ทุกงวด'}
              </option>
              {roundOptions.map((round) => (
                <option key={round.id} value={round.code}>
                  {`${formatRoundLabel(round.title || round.code)} • ${round.statusLabel}`}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>วันที่เริ่มต้น</span>
            <div className="admin-report-date-field">
              <FiCalendar />
              <input
                type="date"
                className="form-input"
                value={draftFilters.startDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))}
              />
            </div>
          </label>

          <label>
            <span>วันที่สิ้นสุด</span>
            <div className="admin-report-date-field">
              <FiCalendar />
              <input
                type="date"
                className="form-input"
                value={draftFilters.endDate}
                onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))}
              />
            </div>
          </label>
        </div>

        <div className="admin-report-filter-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setDraftFilters(defaultFilters);
              setFilters(defaultFilters);
              setRoundOptions([]);
            }}
          >
            ล้างตัวกรอง
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setFilters({ ...draftFilters })}>
            ใช้ตัวกรอง
          </button>
        </div>
      </section>

      <section className="card ops-section admin-report-table">
        <div className="ops-table-head">
          <div>
            <div className="ui-eyebrow">{copy.tableEyebrow}</div>
            <h3 className="card-title admin-report-title"><FiFileText />{copy.tableTitle}</h3>
            <p className="ops-table-note">{copy.tableNote}</p>
          </div>
          <span className="ui-pill">{copy.groupedRows(reports.length)}</span>
        </div>

        {tableLoading && !hasRowsLoaded ? (
          <ReportTableSkeleton />
        ) : (
          <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{copy.columns.roundDate}</th>
                <th>{copy.columns.marketName}</th>
                <th>{copy.columns.agentName}</th>
                <th>{copy.columns.betCount}</th>
                <th>{copy.columns.totalAmount}</th>
                <th>{copy.columns.totalWon}</th>
                <th>{copy.columns.netProfit}</th>
                <th>{copy.columns.breakdown}</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted table-empty-cell">{copy.empty}</td>
                </tr>
              ) : (
                reports.map((report, index) => (
                  <tr key={`${report.roundDate}-${report.agentName || index}`}>
                    <td className="ops-history-cell-strong">{formatRoundLabel(report.roundDate)}</td>
                    <td>{report.marketName || adminCopy.common.defaultMarket}</td>
                    <td>{report.agentName || '-'}</td>
                    <td>{report.betCount}</td>
                    <td>{money(report.totalAmount)} บาท</td>
                    <td>{money(report.totalWon)} บาท</td>
                    <td className={`admin-report-net ${Number(report.netProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
                      {money(report.netProfit)} บาท
                    </td>
                    <td>
                      <div className="admin-report-breakdown">
                        <span className="badge badge-success">{report.wonCount}</span>
                        <span className="badge badge-danger">{report.lostCount}</span>
                        <span className="badge badge-warning">{report.pendingCount}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        )}
      </section>

      <style>{`
        .admin-report-page {
          gap: 16px;
        }

        .admin-report-overview {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .admin-report-overview.admin-report-overview-wide {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          align-items: stretch;
        }

        .admin-report-overview.admin-report-overview-wide .ops-overview-card {
          min-width: 0;
          min-height: 100%;
        }

        .admin-report-positive strong {
          color: var(--success);
        }

        .admin-report-negative strong {
          color: var(--danger);
        }

        .admin-report-hero .ops-hero-side {
          min-width: 240px;
        }

        .admin-report-toolbar {
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .admin-report-toolbar-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .admin-report-filter-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }

        .admin-report-filter-grid label {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .admin-report-filter-grid label span {
          font-size: 0.78rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .admin-report-date-field {
          width: 100%;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--bg-input);
          color: var(--text-muted);
        }

        .admin-report-date-field .form-input {
          border: none;
          background: transparent;
          box-shadow: none;
          min-height: 46px;
          padding: 0;
        }

        .admin-report-filter-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .admin-report-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .admin-report-filter,
        .admin-report-table {
          box-shadow: 0 16px 30px rgba(127, 29, 29, 0.08);
        }

        .admin-report-table .table-container {
          background: rgba(255, 255, 255, 0.92);
        }

        .admin-report-net {
          font-weight: 700;
        }

        .admin-report-net.positive {
          color: var(--success);
        }

        .admin-report-net.negative {
          color: var(--danger);
        }

        .admin-report-breakdown {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .admin-report-breakdown .badge {
          min-width: 34px;
          justify-content: center;
        }

        .admin-report-table-skeleton {
          display: grid;
          gap: 12px;
          padding: 18px;
          border-radius: 20px;
          border: 1px solid rgba(220, 38, 38, 0.1);
          background: rgba(255, 251, 251, 0.96);
        }

        .admin-report-table-skeleton-bar {
          display: block;
          height: 18px;
          width: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(252, 231, 231, 0.9), rgba(255, 255, 255, 0.96), rgba(252, 231, 231, 0.9));
          background-size: 200% 100%;
          animation: admin-report-skeleton 1.3s ease-in-out infinite;
        }

        .admin-report-table-skeleton-bar-wide {
          width: 92%;
        }

        .admin-report-table-skeleton-bar-short {
          width: 68%;
        }

        @keyframes admin-report-skeleton {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        @media (max-width: 1100px) {
          .admin-report-overview.admin-report-overview-wide,
          .admin-report-filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .admin-report-overview.admin-report-overview-wide,
          .admin-report-filter-grid {
            grid-template-columns: 1fr;
          }

          .admin-report-toolbar,
          .admin-report-toolbar-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .admin-report-hero .ops-hero-side {
            width: 100%;
            min-width: 0;
          }

          .admin-report-toolbar-controls .btn,
          .admin-report-filter-actions .btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminReports;
