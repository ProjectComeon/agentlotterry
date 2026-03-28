import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiClock, FiFileText, FiRotateCcw, FiSlash } from 'react-icons/fi';
import { cancelMemberSlip, getMemberSlips } from '../../services/api';

const tabs = [
  { value: 'draft', label: 'รายการโพย', icon: <FiFileText /> },
  { value: 'submitted', label: 'รายการซื้อ', icon: <FiClock /> },
  { value: 'cancelled', label: 'รายการยกเลิก', icon: <FiSlash /> }
];

const statusLabels = {
  draft: 'โพยร่าง',
  submitted: 'ส่งซื้อแล้ว',
  cancelled: 'ยกเลิก'
};

const BetHistory = () => {
  const [activeTab, setActiveTab] = useState('draft');
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState('');

  const loadSlips = async (status = activeTab) => {
    setLoading(true);
    try {
      const res = await getMemberSlips({ status });
      setSlips(res.data || []);
    } catch (error) {
      console.error(error);
      toast.error('โหลดรายการโพยไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlips(activeTab);
  }, [activeTab]);

  const handleCancel = async (slipId) => {
    setCancellingId(slipId);
    try {
      await cancelMemberSlip(slipId);
      toast.success('ยกเลิกรายการซื้อแล้ว');
      await loadSlips(activeTab);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'ยกเลิกรายการไม่สำเร็จ');
    } finally {
      setCancellingId('');
    }
  };

  return (
    <div className="animate-fade-in slip-history-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">slip history</h1>
          <p className="page-subtitle">ติดตามโพยร่าง รายการซื้อ และรายการยกเลิกจาก slip engine ใหม่</p>
        </div>
      </div>

      <div className="history-filter-chips">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            className={`history-chip ${activeTab === tab.value ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : slips.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><FiFileText /></div>
            <div className="empty-state-text">ไม่มีรายการในหมวดนี้</div>
          </div>
        </div>
      ) : (
        <div className="slip-history-list">
          {slips.map((slip) => (
            <div key={slip.id} className={`card slip-history-card slip-history-card-${slip.status}`}>
              <div className="slip-history-top">
                <div>
                  <div className="slip-history-number">{slip.slipNumber}</div>
                  <div className="slip-history-market">{slip.lotteryName} • {slip.roundCode}</div>
                </div>
                <span className={`badge badge-${slip.status === 'submitted' ? 'success' : slip.status === 'cancelled' ? 'danger' : 'info'}`}>
                  {statusLabels[slip.status] || slip.status}
                </span>
              </div>

              {slip.memo ? <div className="slip-history-memo">{slip.memo}</div> : null}

              <div className="slip-history-grid">
                <div className="slip-history-stat">
                  <span>จำนวนรายการ</span>
                  <strong>{slip.itemCount}</strong>
                </div>
                <div className="slip-history-stat">
                  <span>ยอดแทง</span>
                  <strong>{slip.totalAmount.toLocaleString()} ฿</strong>
                </div>
                <div className="slip-history-stat">
                  <span>ถูกแล้ว</span>
                  <strong>{(slip.summary?.totalWon || 0).toLocaleString()} ฿</strong>
                </div>
                <div className="slip-history-stat">
                  <span>คงค้าง</span>
                  <strong>{slip.summary?.pendingCount || 0}</strong>
                </div>
              </div>

              <div className="slip-preview-list">
                {(slip.previewNumbers || []).map((number, index) => (
                  <span key={`${slip.id}-${number}-${index}`} className="slip-preview-pill">{number}</span>
                ))}
              </div>

              <div className="slip-history-bottom">
                <div className="slip-history-date">
                  {slip.submittedAt || slip.createdAt ? new Date(slip.submittedAt || slip.createdAt).toLocaleString() : '-'}
                </div>
                {slip.canCancel ? (
                  <button
                    className="btn btn-danger"
                    onClick={() => handleCancel(slip.id)}
                    disabled={cancellingId === slip.id}
                  >
                    <FiRotateCcw /> ยกเลิกรายการ
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .slip-history-page {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .history-filter-chips {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .history-filter-chips::-webkit-scrollbar {
          display: none;
        }

        .history-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 999px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 0.84rem;
          font-weight: 700;
          transition: var(--transition-fast);
          white-space: nowrap;
        }

        .history-chip.active {
          background: var(--primary-subtle);
          border-color: var(--border-accent);
          color: var(--primary-light);
        }

        .slip-history-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .slip-history-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .slip-history-card-submitted {
          border-left: 3px solid var(--success);
        }

        .slip-history-card-draft {
          border-left: 3px solid #38bdf8;
        }

        .slip-history-card-cancelled {
          border-left: 3px solid var(--danger);
        }

        .slip-history-top,
        .slip-history-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .slip-history-number {
          font-size: 1rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .slip-history-market,
        .slip-history-date {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .slip-history-memo {
          padding: 10px 12px;
          background: var(--bg-surface);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .slip-history-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .slip-history-stat {
          padding: 14px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }

        .slip-history-stat span {
          display: block;
          font-size: 0.72rem;
          color: var(--text-muted);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .slip-history-stat strong {
          font-size: 1rem;
          color: var(--text-primary);
        }

        .slip-preview-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .slip-preview-pill {
          padding: 7px 12px;
          border-radius: 999px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          color: var(--text-primary);
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.06em;
        }

        @media (max-width: 760px) {
          .slip-history-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .slip-history-top,
          .slip-history-bottom {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default BetHistory;
