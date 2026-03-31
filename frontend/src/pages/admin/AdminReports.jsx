import { useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiDollarSign, FiFileText, FiLayers, FiRefreshCw, FiTrendingUp } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { adminCopy } from '../../i18n/th/admin';
import { getAdminReports } from '../../services/api';

const money = (value) => Number(value || 0).toLocaleString('th-TH');
const copy = adminCopy.reports;

const AdminReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roundDate, setRoundDate] = useState('');

  useEffect(() => {
    const loadReports = async () => {
      try {
        const params = {};
        if (roundDate) params.roundDate = roundDate;
        const res = await getAdminReports(params);
        setReports(res.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [roundDate]);

  const totalAmount = reports.reduce((sum, report) => sum + (report.totalAmount || 0), 0);
  const totalWon = reports.reduce((sum, report) => sum + (report.totalWon || 0), 0);
  const totalBets = reports.reduce((sum, report) => sum + (report.betCount || 0), 0);
  const netProfit = totalAmount - totalWon;

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
    }
  ]), [netProfit, totalAmount, totalBets]);

  if (loading) {
    return <PageSkeleton statCount={3} rows={6} sidebar={false} />;
  }

  return (
    <div className="ops-page admin-report-page animate-fade-in">
      <section className="ops-hero">
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

      <section className="ops-overview-grid compact">
        {overviewCards.map((card) => (
          <article key={card.label} className="ops-overview-card">
            <div className="ops-icon-badge"><card.icon /></div>
            <strong>{card.value}</strong>
            <span>{card.label}</span>
            <small>{card.hint}</small>
          </article>
        ))}
      </section>

      <section className="card ops-section">
        <div className="ops-toolbar admin-report-toolbar">
          <div>
            <div className="ui-eyebrow">{copy.filterEyebrow}</div>
            <h3 className="card-title">{copy.filterTitle}</h3>
          </div>

          <div className="admin-report-toolbar-controls">
            <label className="admin-report-date-field">
              <FiCalendar />
              <input
                type="date"
                className="form-input"
                value={roundDate}
                onChange={(event) => setRoundDate(event.target.value)}
              />
            </label>

            {roundDate ? (
              <button type="button" className="btn btn-secondary" onClick={() => setRoundDate('')}>
                <FiRefreshCw />
                ล้างงวด
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card ops-section">
        <div className="ops-table-head">
          <div>
            <div className="ui-eyebrow">{copy.tableEyebrow}</div>
            <h3 className="card-title admin-report-title"><FiFileText />{copy.tableTitle}</h3>
            <p className="ops-table-note">{copy.tableNote}</p>
          </div>
          <span className="ui-pill">{copy.groupedRows(reports.length)}</span>
        </div>

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
                    <td className="ops-history-cell-strong">{report.roundDate}</td>
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
      </section>

      <style>{`
        .admin-report-page {
          gap: 16px;
        }

        .admin-report-positive strong {
          color: var(--success);
        }

        .admin-report-negative strong {
          color: var(--danger);
        }

        .admin-report-toolbar {
          justify-content: space-between;
        }

        .admin-report-toolbar-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .admin-report-date-field {
          min-width: 220px;
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

        .admin-report-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
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

        @media (max-width: 760px) {
          .admin-report-toolbar,
          .admin-report-toolbar-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .admin-report-date-field {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminReports;
