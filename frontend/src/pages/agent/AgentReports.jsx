import { useState, useEffect } from 'react';
import { getAgentReports } from '../../services/api';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';

const AgentReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try { const res = await getAgentReports({}); setReports(res.data); }
      catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const totalAmount = reports.reduce((s, r) => s + (r.totalAmount || 0), 0);
  const totalWon = reports.reduce((s, r) => s + (r.totalWon || 0), 0);
  const netProfit = totalAmount - totalWon;

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <div className="ag-rpt animate-fade-in">
      <h1 className="ag-rpt-title">สรุปยอด</h1>

      {/* Profit hero */}
      <div className={`ag-rpt-hero ${netProfit >= 0 ? 'positive' : 'negative'}`}>
        <span className="ag-rpt-hero-label">กำไรสุทธิ</span>
        <span className="ag-rpt-hero-value">
          {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString()} ฿
        </span>
        <span className="ag-rpt-hero-icon">
          {netProfit >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
        </span>
      </div>

      {/* Stats row */}
      <div className="ag-rpt-stats">
        <div className="ag-rpt-stat">
          <span className="ag-rpt-stat-value">{totalAmount.toLocaleString()}</span>
          <span className="ag-rpt-stat-label">ยอดแทง (฿)</span>
        </div>
        <div className="ag-rpt-stat-divider"></div>
        <div className="ag-rpt-stat">
          <span className="ag-rpt-stat-value ag-rpt-stat-danger">{totalWon.toLocaleString()}</span>
          <span className="ag-rpt-stat-label">ยอดจ่าย (฿)</span>
        </div>
      </div>

      {/* Round cards */}
      <div className="ag-rpt-section-title">รายงานรายงวด</div>
      <div className="ag-rpt-rounds">
        {reports.length === 0 ? (
          <div className="empty-state"><div className="empty-state-text">ไม่มีข้อมูล</div></div>
        ) : reports.map((r, i) => (
          <div key={i} className="ag-rpt-round">
            <div className="ag-rpt-round-top">
              <div>
                <div className="ag-rpt-round-market">{r.marketName || 'รัฐบาลไทย'}</div>
                <div className="ag-rpt-round-date">{r.roundDate} • {r.betCount} bets</div>
              </div>
              <div className={`ag-rpt-round-profit ${(r.netProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
                {(r.netProfit || 0) >= 0 ? '+' : ''}{(r.netProfit || 0).toLocaleString()} ฿
              </div>
            </div>
            <div className="ag-rpt-round-bottom">
              <span>แทง {(r.totalAmount || 0).toLocaleString()} / จ่าย {(r.totalWon || 0).toLocaleString()}</span>
              <span className="ag-rpt-round-results">
                <span className="ag-rpt-dot dot-won"></span>{r.wonCount}
                <span className="ag-rpt-dot dot-lost"></span>{r.lostCount}
                <span className="ag-rpt-dot dot-pending"></span>{r.pendingCount}
              </span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .ag-rpt {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ag-rpt-title {
          font-size: 1.3rem;
          font-weight: 800;
        }

        .ag-rpt-hero {
          position: relative;
          padding: 22px;
          border-radius: var(--radius-lg);
          text-align: center;
          overflow: hidden;
        }

        .ag-rpt-hero.positive {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04));
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .ag-rpt-hero.negative {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.04));
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .ag-rpt-hero-label {
          display: block;
          font-size: 0.78rem;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .ag-rpt-hero-value {
          display: block;
          font-size: 2rem;
          font-weight: 800;
        }

        .ag-rpt-hero.positive .ag-rpt-hero-value { color: var(--success); }
        .ag-rpt-hero.negative .ag-rpt-hero-value { color: var(--danger); }

        .ag-rpt-hero-icon {
          position: absolute;
          top: 14px;
          right: 18px;
          font-size: 1.4rem;
          opacity: 0.3;
        }

        .ag-rpt-hero.positive .ag-rpt-hero-icon { color: var(--success); }
        .ag-rpt-hero.negative .ag-rpt-hero-icon { color: var(--danger); }

        .ag-rpt-stats {
          display: flex;
          align-items: center;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 16px 8px;
        }

        .ag-rpt-stat {
          flex: 1;
          text-align: center;
        }

        .ag-rpt-stat-value {
          display: block;
          font-size: 1.2rem;
          font-weight: 800;
        }

        .ag-rpt-stat-danger { color: var(--danger); }

        .ag-rpt-stat-label {
          display: block;
          font-size: 0.68rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .ag-rpt-stat-divider {
          width: 1px;
          height: 32px;
          background: var(--border);
        }

        .ag-rpt-section-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .ag-rpt-rounds {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ag-rpt-round {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 14px;
        }

        .ag-rpt-round-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .ag-rpt-round-market {
          font-size: 0.88rem;
          font-weight: 700;
        }

        .ag-rpt-round-date {
          font-size: 0.72rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .ag-rpt-round-profit {
          font-size: 1rem;
          font-weight: 800;
        }

        .ag-rpt-round-profit.positive { color: var(--success); }
        .ag-rpt-round-profit.negative { color: var(--danger); }

        .ag-rpt-round-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 10px;
          border-top: 1px solid var(--border-light);
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .ag-rpt-round-results {
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .ag-rpt-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-left: 6px;
        }

        .dot-won { background: var(--success); }
        .dot-lost { background: var(--danger); }
        .dot-pending { background: var(--warning); }
      `}</style>
    </div>
  );
};

export default AgentReports;
