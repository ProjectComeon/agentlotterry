import { useState, useEffect } from 'react';
import { getAgentBets } from '../../services/api';
import { FiCalendar } from 'react-icons/fi';

const betTypeLabels = { '3top': '3 ตัวบน', '3tod': '3 ตัวโต๊ด', '2top': '2 ตัวบน', '2bottom': '2 ตัวล่าง', 'run_top': 'วิ่งบน', 'run_bottom': 'วิ่งล่าง' };

const AgentBets = () => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roundDate, setRoundDate] = useState('');

  useEffect(() => { load(); }, [roundDate]);

  const load = async () => {
    try {
      const params = {};
      if (roundDate) params.roundDate = roundDate;
      const res = await getAgentBets(params);
      setBets(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <div className="ag-bets animate-fade-in">
      <div className="ag-bets-header">
        <h1 className="ag-bets-title">โพยลูกค้า</h1>
        <span className="ag-bets-count">{bets.length} รายการ</span>
      </div>

      <div className="ag-bets-filter">
        <FiCalendar />
        <input
          type="text"
          placeholder="กรองตามงวด เช่น 2024-12-16"
          value={roundDate}
          onChange={(e) => setRoundDate(e.target.value)}
        />
      </div>

      <div className="ag-bets-list">
        {bets.length === 0 ? (
          <div className="empty-state"><div className="empty-state-text">ไม่มีข้อมูล</div></div>
        ) : bets.map((b) => (
          <div key={b._id} className={`ag-bet-card ag-bet-card-${b.result || 'pending'}`}>
            <div className="ag-bet-card-top">
              <span className="ag-bet-card-customer">{b.customerId?.name || 'N/A'}</span>
              <span className={`ag-bet-badge ag-bet-badge-${b.result || 'pending'}`}>
                {b.result === 'won' ? 'ถูก' : b.result === 'lost' ? 'ไม่ถูก' : 'รอผล'}
              </span>
            </div>
            <div className="ag-bet-card-body">
              <span className="ag-bet-card-number">{b.number}</span>
              <div className="ag-bet-card-details">
                <span className="ag-bet-card-type">{betTypeLabels[b.betType]} x{b.payRate}</span>
                <span className="ag-bet-card-market">{b.marketName || 'รัฐบาลไทย'} • {b.roundDate}</span>
              </div>
            </div>
            <div className="ag-bet-card-bottom">
              <span>แทง {b.amount.toLocaleString()} ฿</span>
              {b.wonAmount > 0 && (
                <span className="ag-bet-card-won">+{b.wonAmount.toLocaleString()} ฿</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .ag-bets {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ag-bets-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ag-bets-title {
          font-size: 1.3rem;
          font-weight: 800;
        }

        .ag-bets-count {
          font-size: 0.8rem;
          color: var(--text-muted);
          background: var(--bg-surface);
          padding: 4px 12px;
          border-radius: 20px;
        }

        .ag-bets-filter {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-muted);
        }

        .ag-bets-filter input {
          background: none;
          border: none;
          color: var(--text-primary);
          font-size: 0.85rem;
          flex: 1;
          min-width: 0;
        }

        .ag-bets-filter input::placeholder {
          color: var(--text-muted);
        }

        .ag-bets-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ag-bet-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 14px;
          border-left: 3px solid var(--border);
        }

        .ag-bet-card-pending { border-left-color: var(--warning); }
        .ag-bet-card-won { border-left-color: var(--success); }
        .ag-bet-card-lost { border-left-color: var(--danger); }

        .ag-bet-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .ag-bet-card-customer {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .ag-bet-badge {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .ag-bet-badge-pending { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
        .ag-bet-badge-won { background: rgba(16, 185, 129, 0.15); color: #34d399; }
        .ag-bet-badge-lost { background: rgba(239, 68, 68, 0.15); color: #f87171; }

        .ag-bet-card-body {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }

        .ag-bet-card-number {
          font-size: 1.6rem;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: 0.1em;
          min-width: 60px;
        }

        .ag-bet-card-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ag-bet-card-type {
          font-size: 0.78rem;
          color: var(--text-secondary);
          font-weight: 600;
        }

        .ag-bet-card-market {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .ag-bet-card-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 8px;
          border-top: 1px solid var(--border-light);
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .ag-bet-card-won {
          font-weight: 800;
          color: var(--success);
        }
      `}</style>
    </div>
  );
};

export default AgentBets;
