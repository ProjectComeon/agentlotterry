import { useState, useEffect } from 'react';
import { getCustomerBets } from '../../services/api';
import { FiCalendar, FiFilter } from 'react-icons/fi';

const betTypeLabels = { '3top': '3 ตัวบน', '3tod': '3 ตัวโต๊ด', '2top': '2 ตัวบน', '2bottom': '2 ตัวล่าง', 'run_top': 'วิ่งบน', 'run_bottom': 'วิ่งล่าง' };
const resultFilters = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'pending', label: 'รอผล' },
  { value: 'won', label: 'ถูก' },
  { value: 'lost', label: 'ไม่ถูก' }
];

const BetHistory = () => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roundDate, setRoundDate] = useState('');
  const [resultFilter, setResultFilter] = useState('');

  useEffect(() => { load(); }, [roundDate, resultFilter]);

  const load = async () => {
    try {
      const params = {};
      if (roundDate) params.roundDate = roundDate;
      if (resultFilter) params.result = resultFilter;
      const res = await getCustomerBets(params);
      setBets(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <div className="history-page animate-fade-in">
      {/* Compact header */}
      <div className="history-header">
        <h1 className="history-title">ประวัติการแทง</h1>
        <span className="history-count">{bets.length} รายการ</span>
      </div>

      {/* Filter bar */}
      <div className="history-filters">
        <div className="history-filter-chips">
          {resultFilters.map((f) => (
            <button
              key={f.value}
              className={`history-chip ${resultFilter === f.value ? 'active' : ''}`}
              onClick={() => setResultFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="history-date-input">
          <FiCalendar />
          <input
            type="text"
            placeholder="งวด เช่น 2024-12-16"
            value={roundDate}
            onChange={(e) => setRoundDate(e.target.value)}
          />
        </div>
      </div>

      {/* Bet cards */}
      <div className="history-list">
        {bets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FiFilter /></div>
            <div className="empty-state-text">ไม่มีข้อมูลตามเงื่อนไขที่เลือก</div>
          </div>
        ) : bets.map((b) => (
          <div key={b._id} className={`history-card history-card-${b.result || 'pending'}`}>
            <div className="history-card-top">
              <div className="history-card-market">{b.marketName || 'รัฐบาลไทย'}</div>
              <span className={`history-badge history-badge-${b.result || 'pending'}`}>
                {b.result === 'won' ? 'ถูก' : b.result === 'lost' ? 'ไม่ถูก' : 'รอผล'}
              </span>
            </div>
            <div className="history-card-body">
              <div className="history-card-number">{b.number}</div>
              <div className="history-card-meta">
                <span className="history-card-type">{betTypeLabels[b.betType]}</span>
                <span className="history-card-rate">x{b.payRate}</span>
              </div>
            </div>
            <div className="history-card-bottom">
              <div className="history-card-amount">
                <span className="history-card-amount-label">แทง</span>
                <span>{b.amount.toLocaleString()} ฿</span>
              </div>
              <div className="history-card-won">
                {b.wonAmount > 0 ? (
                  <>
                    <span className="history-card-amount-label">ถูก</span>
                    <span className="history-card-won-value">+{b.wonAmount.toLocaleString()} ฿</span>
                  </>
                ) : (
                  <span className="history-card-date">{b.roundDate}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .history-page {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .history-title {
          font-size: 1.3rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .history-count {
          font-size: 0.8rem;
          color: var(--text-muted);
          background: var(--bg-surface);
          padding: 4px 12px;
          border-radius: 20px;
        }

        .history-filters {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .history-filter-chips {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .history-filter-chips::-webkit-scrollbar { display: none; }

        .history-chip {
          padding: 8px 16px;
          border-radius: 20px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: var(--transition-fast);
        }

        .history-chip:hover {
          border-color: var(--border-accent);
        }

        .history-chip.active {
          background: var(--primary);
          border-color: var(--primary);
          color: white;
        }

        .history-date-input {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-muted);
        }

        .history-date-input input {
          background: none;
          border: none;
          color: var(--text-primary);
          font-size: 0.85rem;
          flex: 1;
          min-width: 0;
        }

        .history-date-input input::placeholder {
          color: var(--text-muted);
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .history-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 14px;
          border-left: 3px solid var(--border);
          transition: var(--transition-fast);
        }

        .history-card:hover {
          border-color: var(--border-accent);
        }

        .history-card-pending { border-left-color: var(--warning); }
        .history-card-won { border-left-color: var(--success); }
        .history-card-lost { border-left-color: var(--danger); }

        .history-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .history-card-market {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .history-badge {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 12px;
        }

        .history-badge-pending { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
        .history-badge-won { background: rgba(16, 185, 129, 0.15); color: #34d399; }
        .history-badge-lost { background: rgba(239, 68, 68, 0.15); color: #f87171; }

        .history-card-body {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .history-card-number {
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: 0.12em;
        }

        .history-card-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .history-card-type {
          font-size: 0.78rem;
          color: var(--text-secondary);
          font-weight: 600;
        }

        .history-card-rate {
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        .history-card-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 10px;
          border-top: 1px solid var(--border-light);
        }

        .history-card-amount,
        .history-card-won {
          display: flex;
          flex-direction: column;
          gap: 1px;
          font-size: 0.9rem;
          font-weight: 700;
        }

        .history-card-won {
          align-items: flex-end;
        }

        .history-card-amount-label {
          font-size: 0.68rem;
          color: var(--text-muted);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .history-card-won-value {
          color: var(--success);
          font-size: 1rem;
        }

        .history-card-date {
          font-size: 0.78rem;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
};

export default BetHistory;
