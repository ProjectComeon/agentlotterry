import { useEffect, useState } from 'react';
import { FiCheckCircle, FiClock, FiRefreshCw, FiSlash } from 'react-icons/fi';
import { getMarketOverview } from '../../services/api';

const statusConfig = {
  live: { label: 'พร้อม', cls: 'result-status-live' },
  pending: { label: 'รอผล', cls: 'result-status-pending' },
  waiting: { label: 'รอเชื่อมต่อ', cls: 'result-status-waiting' },
  unsupported: { label: 'ไม่รองรับ', cls: 'result-status-unsupported' }
};

const LotteryResults = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  const load = async (showReload = false) => {
    if (showReload) setReloading(true);
    else setLoading(true);
    try {
      const res = await getMarketOverview();
      setOverview(res.data);
      if (!activeSection && res.data?.sections?.length) {
        setActiveSection(res.data.sections[0].id);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); setReloading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  const sections = overview?.sections || [];
  const currentSection = sections.find((s) => s.id === activeSection) || sections[0];

  return (
    <div className="results-page animate-fade-in">
      {/* Header */}
      <div className="results-header">
        <div>
          <h1 className="results-title">ผลหวยและหุ้น</h1>
          <span className="results-update">
            {overview?.provider?.fetchedAt
              ? `อัปเดต ${new Date(overview.provider.fetchedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </span>
        </div>
        <button className="results-refresh" onClick={() => load(true)} disabled={reloading}>
          <FiRefreshCw className={reloading ? 'spin-animation' : ''} />
        </button>
      </div>

      {/* Section Tabs */}
      <div className="results-tabs">
        {sections.map((s) => (
          <button
            key={s.id}
            className={`results-tab ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.title}
            <span className="results-tab-count">{s.markets.length}</span>
          </button>
        ))}
      </div>

      {/* Market Result Cards */}
      <div className="results-grid">
        {currentSection?.markets.map((market) => {
          const st = statusConfig[market.status] || statusConfig.waiting;
          const hasNumbers = market.numbers?.some((n) => n.value);

          return (
            <div key={market.id} className={`result-card ${st.cls}`}>
              <div className="result-card-top">
                <span className="result-card-name">{market.name}</span>
                <span className={`result-card-status ${st.cls}`}>{st.label}</span>
              </div>

              {hasNumbers ? (
                <div className="result-card-numbers">
                  {market.numbers.map((n) => n.value ? (
                    <div key={n.label} className="result-number-item">
                      <span className="result-number-label">{n.label}</span>
                      <span className="result-number-value">{n.value}</span>
                    </div>
                  ) : null)}
                </div>
              ) : (
                <div className="result-card-empty">
                  {market.headline || market.note || 'รอข้อมูล'}
                </div>
              )}

              {market.resultDate && (
                <div className="result-card-date">{market.resultDate}</div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .results-page {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .results-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .results-title {
          font-size: 1.3rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .results-update {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .results-refresh {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .results-refresh:hover {
          border-color: var(--border-accent);
          color: var(--primary-light);
        }

        .spin-animation {
          animation: spin 0.8s linear infinite;
        }

        /* Section Tabs */
        .results-tabs {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .results-tabs::-webkit-scrollbar { display: none; }

        .results-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 18px;
          border-radius: 20px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: var(--transition-fast);
        }

        .results-tab:hover {
          border-color: var(--border-accent);
        }

        .results-tab.active {
          background: var(--primary);
          border-color: var(--primary);
          color: white;
        }

        .results-tab-count {
          font-size: 0.7rem;
          background: rgba(255,255,255,0.15);
          padding: 1px 7px;
          border-radius: 10px;
        }

        .results-tab.active .results-tab-count {
          background: rgba(255,255,255,0.25);
        }

        /* Result Cards Grid */
        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 10px;
        }

        .result-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 14px;
          border-top: 3px solid var(--border);
          transition: var(--transition-fast);
        }

        .result-card:hover {
          border-color: var(--border-accent);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .result-status-live { border-top-color: var(--success); }
        .result-status-pending { border-top-color: var(--warning); }
        .result-status-waiting { border-top-color: var(--info); }
        .result-status-unsupported { border-top-color: var(--danger); }

        .result-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .result-card-name {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .result-card-status {
          font-size: 0.62rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .result-card-status.result-status-live { background: rgba(16, 185, 129, 0.15); color: #34d399; }
        .result-card-status.result-status-pending { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
        .result-card-status.result-status-waiting { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
        .result-card-status.result-status-unsupported { background: rgba(239, 68, 68, 0.15); color: #f87171; }

        .result-card-numbers {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .result-number-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .result-number-label {
          font-size: 0.68rem;
          color: var(--text-muted);
        }

        .result-number-value {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--primary-light);
          letter-spacing: 0.08em;
        }

        .result-card-empty {
          font-size: 0.8rem;
          color: var(--text-muted);
          padding: 8px 0;
        }

        .result-card-date {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--border-light);
          font-size: 0.68rem;
          color: var(--text-muted);
        }

        @media (max-width: 480px) {
          .results-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
};

export default LotteryResults;
