import { useState, useEffect } from 'react';
import { getAgentDashboard } from '../../services/api';
import { FiUsers, FiDollarSign, FiTrendingUp, FiClock } from 'react-icons/fi';

const betTypeLabels = { '3top': '3 ตัวบน', '3tod': '3 ตัวโต๊ด', '2top': '2 ตัวบน', '2bottom': '2 ตัวล่าง', 'run_top': 'วิ่งบน', 'run_bottom': 'วิ่งล่าง' };

const AgentDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try { const res = await getAgentDashboard(); setData(res.data); }
      catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  const s = data?.stats || {};

  return (
    <div className="ag-dash animate-fade-in">
      <h1 className="ag-dash-title">แดชบอร์ด</h1>

      {/* Profit hero */}
      <div className={`ag-dash-hero ${(s.netProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
        <span className="ag-dash-hero-label">กำไรสุทธิ</span>
        <span className="ag-dash-hero-value">
          {(s.netProfit || 0) >= 0 ? '+' : ''}{(s.netProfit || 0).toLocaleString()} ฿
        </span>
      </div>

      {/* Stats grid */}
      <div className="ag-dash-stats">
        <div className="ag-dash-stat">
          <FiUsers className="ag-dash-stat-icon" />
          <span className="ag-dash-stat-value">{s.totalCustomers || 0}</span>
          <span className="ag-dash-stat-label">ลูกค้า ({s.activeCustomers || 0} ใช้งาน)</span>
        </div>
        <div className="ag-dash-stat">
          <FiClock className="ag-dash-stat-icon ag-dash-stat-icon-blue" />
          <span className="ag-dash-stat-value">{s.pendingBets || 0}</span>
          <span className="ag-dash-stat-label">รอผล</span>
        </div>
        <div className="ag-dash-stat">
          <FiDollarSign className="ag-dash-stat-icon ag-dash-stat-icon-yellow" />
          <span className="ag-dash-stat-value">{(s.totalAmount || 0).toLocaleString()}</span>
          <span className="ag-dash-stat-label">ยอดแทง (฿)</span>
        </div>
      </div>

      {/* Recent bets */}
      <div className="ag-dash-section-title">รายการล่าสุด</div>
      <div className="ag-dash-bets">
        {data?.recentBets?.length > 0 ? data.recentBets.map((bet, i) => (
          <div key={i} className={`ag-dash-bet ag-dash-bet-${bet.result || 'pending'}`}>
            <div className="ag-dash-bet-left">
              <span className="ag-dash-bet-number">{bet.number}</span>
              <div className="ag-dash-bet-info">
                <span className="ag-dash-bet-name">{bet.customerId?.name || 'N/A'}</span>
                <span className="ag-dash-bet-meta">{betTypeLabels[bet.betType]} • {bet.roundDate}</span>
              </div>
            </div>
            <div className="ag-dash-bet-right">
              <span className="ag-dash-bet-amount">{bet.amount.toLocaleString()} ฿</span>
              <span className={`ag-dash-bet-badge ag-dash-bet-badge-${bet.result || 'pending'}`}>
                {bet.result === 'won' ? 'ถูก' : bet.result === 'lost' ? 'ไม่ถูก' : 'รอผล'}
              </span>
            </div>
          </div>
        )) : (
          <div className="empty-state"><div className="empty-state-text">ยังไม่มีรายการ</div></div>
        )}
      </div>

      <style>{`
        .ag-dash {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ag-dash-title {
          font-size: 1.3rem;
          font-weight: 800;
        }

        .ag-dash-hero {
          padding: 20px;
          border-radius: var(--radius-lg);
          text-align: center;
        }

        .ag-dash-hero.positive {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04));
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .ag-dash-hero.negative {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.04));
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .ag-dash-hero-label {
          display: block;
          font-size: 0.78rem;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .ag-dash-hero-value {
          display: block;
          font-size: 2rem;
          font-weight: 800;
        }

        .ag-dash-hero.positive .ag-dash-hero-value { color: var(--success); }
        .ag-dash-hero.negative .ag-dash-hero-value { color: var(--danger); }

        .ag-dash-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .ag-dash-stat {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 14px;
          text-align: center;
        }

        .ag-dash-stat-icon {
          font-size: 1.2rem;
          color: var(--primary-light);
          margin-bottom: 6px;
        }

        .ag-dash-stat-icon-blue { color: #60a5fa; }
        .ag-dash-stat-icon-yellow { color: #fbbf24; }

        .ag-dash-stat-value {
          display: block;
          font-size: 1.3rem;
          font-weight: 800;
        }

        .ag-dash-stat-label {
          display: block;
          font-size: 0.68rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .ag-dash-section-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .ag-dash-bets {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ag-dash-bet {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          border-left: 3px solid var(--border);
        }

        .ag-dash-bet-pending { border-left-color: var(--warning); }
        .ag-dash-bet-won { border-left-color: var(--success); }
        .ag-dash-bet-lost { border-left-color: var(--danger); }

        .ag-dash-bet-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ag-dash-bet-number {
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--primary-light);
          letter-spacing: 0.08em;
          min-width: 50px;
        }

        .ag-dash-bet-info {
          display: flex;
          flex-direction: column;
        }

        .ag-dash-bet-name {
          font-size: 0.82rem;
          font-weight: 600;
        }

        .ag-dash-bet-meta {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .ag-dash-bet-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .ag-dash-bet-amount {
          font-size: 0.88rem;
          font-weight: 700;
        }

        .ag-dash-bet-badge {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .ag-dash-bet-badge-pending { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
        .ag-dash-bet-badge-won { background: rgba(16, 185, 129, 0.15); color: #34d399; }
        .ag-dash-bet-badge-lost { background: rgba(239, 68, 68, 0.15); color: #f87171; }

        @media (max-width: 480px) {
          .ag-dash-stats {
            grid-template-columns: 1fr 1fr 1fr;
          }

          .ag-dash-stat {
            padding: 10px 8px;
          }

          .ag-dash-stat-value {
            font-size: 1.1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default AgentDashboard;
