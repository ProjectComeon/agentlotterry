import { useEffect, useState } from 'react';
import { FiTrendingDown, FiTrendingUp } from 'react-icons/fi';
import { getMemberSummary } from '../../services/api';

const CustomerSummary = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getMemberSummary({});
        setData(res.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return <div className="loading-container"><div className="spinner"></div></div>;
  }

  const overall = data?.overall || {
    totalAmount: 0,
    totalWon: 0,
    netResult: 0,
    totalBets: 0
  };

  return (
    <div className="summary-page animate-fade-in">
      <h1 className="summary-title">สรุปได้เสีย</h1>

      <div className={`summary-hero ${overall.netResult >= 0 ? 'positive' : 'negative'}`}>
        <span className="summary-hero-label">ผลได้เสียรวม</span>
        <span className="summary-hero-value">
          {overall.netResult >= 0 ? '+' : ''}{overall.netResult.toLocaleString()} ฿
        </span>
        <span className="summary-hero-icon">
          {overall.netResult >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
        </span>
      </div>

      <div className="summary-stats">
        <div className="summary-stat">
          <span className="summary-stat-value">{overall.totalBets}</span>
          <span className="summary-stat-label">แทง (ครั้ง)</span>
        </div>
        <div className="summary-stat-divider"></div>
        <div className="summary-stat">
          <span className="summary-stat-value">{overall.totalAmount.toLocaleString()}</span>
          <span className="summary-stat-label">ยอดแทง (฿)</span>
        </div>
        <div className="summary-stat-divider"></div>
        <div className="summary-stat">
          <span className="summary-stat-value summary-stat-won">{overall.totalWon.toLocaleString()}</span>
          <span className="summary-stat-label">ยอดถูก (฿)</span>
        </div>
      </div>

      <div className="summary-section-title">สรุปรายงวด</div>
      <div className="summary-rounds">
        {(!data?.rounds || data.rounds.length === 0) ? (
          <div className="empty-state">
            <div className="empty-state-text">ไม่มีข้อมูล</div>
          </div>
        ) : data.rounds.map((round) => (
          <div key={`${round.roundCode}-${round.marketId}`} className="summary-round-card">
            <div className="summary-round-top">
              <div>
                <div className="summary-round-market">{round.marketName || 'รัฐบาลไทย'}</div>
                <div className="summary-round-date">{round.roundCode || round.roundDate} • {round.betCount} ครั้ง</div>
              </div>
              <div className={`summary-round-net ${(round.netResult || 0) >= 0 ? 'positive' : 'negative'}`}>
                {(round.netResult || 0) >= 0 ? '+' : ''}{(round.netResult || 0).toLocaleString()} ฿
              </div>
            </div>
            <div className="summary-round-bottom">
              <span>แทง {(round.totalAmount || 0).toLocaleString()} ฿</span>
              <span className="summary-round-results">
                <span className="summary-dot dot-won"></span>{round.wonCount || 0}
                <span className="summary-dot dot-lost"></span>{round.lostCount || 0}
                <span className="summary-dot dot-pending"></span>{round.pendingCount || 0}
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

        .summary-section-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-secondary);
          margin-top: 4px;
        }

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
        }

        .summary-round-net {
          font-size: 0.98rem;
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
