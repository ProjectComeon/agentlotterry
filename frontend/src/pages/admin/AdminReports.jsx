import { useEffect, useMemo, useState } from 'react';
import { FiFileText } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { getAdminReports } from '../../services/api';

const money = (value) => Number(value || 0).toLocaleString('th-TH');

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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [roundDate]);

  const totalAmount = reports.reduce((sum, report) => sum + (report.totalAmount || 0), 0);
  const totalWon = reports.reduce((sum, report) => sum + (report.totalWon || 0), 0);
  const totalBets = reports.reduce((sum, report) => sum + (report.betCount || 0), 0);

  const overviewCards = useMemo(() => ([
    { label: 'Bet items', value: money(totalBets), hint: 'All rows within the current filter' },
    { label: 'Gross sales', value: `${money(totalAmount)} THB`, hint: 'Accepted amount from all agents' },
    { label: 'Net result', value: `${money(totalAmount - totalWon)} THB`, hint: 'Gross sales minus payout' }
  ]), [totalAmount, totalWon, totalBets]);

  if (loading) {
    return <PageSkeleton statCount={3} rows={6} sidebar={false} />;
  }

  return (
    <div className="ops-page animate-fade-in">
      <section className="ops-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">Admin analytics</span>
          <h1 className="page-title">Admin Reports</h1>
          <p className="page-subtitle">Review sales and payout by round and agent from one clean reporting surface.</p>
        </div>

        <div className="ops-hero-side">
          <span>Current net result</span>
          <strong>{money(totalAmount - totalWon)} THB</strong>
          <small>{reports.length} grouped report rows</small>
        </div>
      </section>

      <section className="ops-overview-grid compact">
        {overviewCards.map((card) => (
          <article key={card.label} className="ops-overview-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </article>
        ))}
      </section>

      <section className="card ops-section">
        <div className="ui-panel-head">
          <div>
            <div className="ui-eyebrow">Filter</div>
            <h3 className="card-title">Round selector</h3>
          </div>
        </div>

        <div className="ops-form-grid single">
          <label className="form-group" style={{ marginBottom: 0 }}>
            <span className="form-label">Round date</span>
            <input
              type="text"
              className="form-input"
              placeholder="2026-03-16"
              value={roundDate}
              onChange={(event) => setRoundDate(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="card ops-section">
        <div className="ops-table-head">
          <div>
            <div className="ui-eyebrow">Report table</div>
            <h3 className="card-title"><FiFileText style={{ marginRight: 8 }} />By agent and round</h3>
            <p className="ops-table-note">Each row represents one aggregated reporting bucket for a market, round, and agent combination.</p>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Round</th>
                <th>Market</th>
                <th>Agent</th>
                <th>Items</th>
                <th>Sales</th>
                <th>Payout</th>
                <th>Net</th>
                <th>Won / Lost / Pending</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted" style={{ padding: 40 }}>No report data</td>
                </tr>
              ) : (
                reports.map((report, index) => (
                  <tr key={`${report.roundDate}-${report.agentName || index}`}>
                    <td>{report.roundDate}</td>
                    <td>{report.marketName || 'Lottery market'}</td>
                    <td>{report.agentName || '-'}</td>
                    <td>{report.betCount}</td>
                    <td>{money(report.totalAmount)} THB</td>
                    <td>{money(report.totalWon)} THB</td>
                    <td style={{ fontWeight: 700, color: (report.netProfit || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {money(report.netProfit)} THB
                    </td>
                    <td>
                      <span className="badge badge-success" style={{ marginRight: 4 }}>{report.wonCount}</span>
                      <span className="badge badge-danger" style={{ marginRight: 4 }}>{report.lostCount}</span>
                      <span className="badge badge-warning">{report.pendingCount}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AdminReports;
