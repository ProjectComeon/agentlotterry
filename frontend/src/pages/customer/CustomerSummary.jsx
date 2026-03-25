import { useState, useEffect } from 'react';
import { getCustomerSummary } from '../../services/api';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';

const CustomerSummary = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try { const res = await getCustomerSummary({}); setData(res.data); }
      catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  const o = data?.overall || { totalAmount: 0, totalWon: 0, netResult: 0, totalBets: 0 };

  return (
    <div className="summary-page animate-fade-in">
      <h1 className="summary-title">สรุปได้เสีย</h1>

      {/* Net result hero */}
      <div className={`summary-hero ${o.netResult >= 0 ? 'positive' : 'negative'}`}>
        <span className="summary-hero-label">ผลได้เสียรวม</span>
        <span className="summary-hero-value">
          {o.netResult >= 0 ? '+' : ''}{o.netResult.toLocaleString()} ฿
        </span>
        <span className="summary-hero-icon">
          {o.netResult >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
        </span>
      </div>

      {/* Stats row */}
      <div className="summary-stats">
        <div className="summary-stat">
          <span className="summary-stat-value">{o.totalBets}</span>
          <span className="summary-stat-label">แทง (ครั้ง)</span>
        </div>
        <div className="summary-stat-divider"></div>
        <div className="summary-stat">
          <span className="summary-stat-value">{o.totalAmount.toLocaleString()}</span>
          <span className="summary-stat-label">ยอดแทง (฿)</span>
        </div>
        <div className="summary-stat-divider"></div>
        <div className="summary-stat">
          <span className="summary-stat-value summary-stat-won">{o.totalWon.toLocaleString()}</span>
          <span className="summary-stat-label">ยอดถูก (฿)</span>
        </div>
      </div>

      {/* Round cards */}
      <div className="summary-section-title">สรุปรายงวด</div>
      <div className="summary-rounds">
        {(!data?.rounds || data.rounds.length === 0) ? (
          <div className="empty-state">
            <div className="empty-state-text">ไม่มีข้อมูล</div>
          </div>
        ) : data.rounds.map((r, i) => (
          <div key={i} className="summary-round-card">
            <div className="summary-round-top">
              <div>
                <div className="summary-round-market">{r.marketName || 'รัฐบาลไทย'}</div>
                <div className="summary-round-date">{r.roundDate} • {r.betCount} ครั้ง</div>
              </div>
              <div className={`summary-round-net ${(r.netResult || 0) >= 0 ? 'positive' : 'negative'}`}>
                {(r.netResult || 0) >= 0 ? '+' : ''}{(r.netResult || 0).toLocaleString()} ฿
              </div>
            </div>
            <div className="summary-round-bottom">
              <span>แทง {(r.totalAmount || 0).toLocaleString()} ฿</span>
              <span className="summary-round-results">
                <span className="summary-dot dot-won"></span>{r.wonCount}
                <span className="summary-dot dot-lost"></span>{r.lostCount}
                <span className="summary-dot dot-pending"></span>{r.pendingCount}
              </span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .summary-page {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .summary-title {
          font-size: 1.3rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        /* Hero */
        .summary-hero {
          position: relative;
          padding: 24px;
          border-radius: var(--radius-lg);
          text-align: center;
          overflow: hidden;
        }

        .summary-hero.positive {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04));
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .summary-hero.negative {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.04));
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .summary-hero-label {
          display: block;
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-bottom: 6px;
        }

        .summary-hero-value {
          display: block;
          font-size: 2.2rem;
          font-weight: 800;
        }

        .summary-hero.positive .summary-hero-value { color: var(--success); }
        .summary-hero.negative .summary-hero-value { color: var(--danger); }

        .summary-hero-icon {
          position: absolute;
          top: 16px;
          right: 20px;
          font-size: 1.5rem;
          opacity: 0.3;
        }

        .summary-hero.positive .summary-hero-icon { color: var(--success); }
        .summary-hero.negative .summary-hero-icon { color: var(--danger); }

        /* Stats row */
        .summary-stats {
          display: flex;
          align-items: center;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 16px 8px;
        }

        .summary-stat {
          flex: 1;
          text-align: center;
        }

        .summary-stat-value {
          display: block;
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .summary-stat-won {
          color: var(--success);
        }

        .summary-stat-label {
          display: block;
          font-size: 0.68rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .summary-stat-divider {
          width: 1px;
          height: 32px;
          background: var(--border);
        }

        /* Section */
        .summary-section-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        /* Round cards */
        .summary-rounds {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .summary-round-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 14px;
        }

        .summary-round-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .summary-round-market {
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .summary-round-date {
          font-size: 0.72rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .summary-round-net {
          font-size: 1rem;
          font-weight: 800;
        }

        .summary-round-net.positive { color: var(--success); }
        .summary-round-net.negative { color: var(--danger); }

        .summary-round-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 10px;
          border-top: 1px solid var(--border-light);
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .summary-round-results {
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        .summary-dot {
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

export default CustomerSummary;
