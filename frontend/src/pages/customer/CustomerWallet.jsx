import { useEffect, useState } from 'react';
import { FiArrowDownLeft, FiArrowUpRight, FiClock } from 'react-icons/fi';
import { getWalletHistory, getWalletSummary } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const money = (value) => Number(value || 0).toLocaleString();

const CustomerWallet = () => {
  const { checkAuth } = useAuth();
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [summaryRes, historyRes] = await Promise.all([
          getWalletSummary({}),
          getWalletHistory({ limit: 50 })
        ]);

        setSummary(summaryRes.data);
        setEntries(historyRes.data || []);
        await checkAuth();
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

  const totals = summary?.totals || {};
  const account = summary?.account || {};

  return (
    <div className="wallet-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Wallet History</h1>
          <p className="page-subtitle">Track credit movements and current balance for this account.</p>
        </div>
      </div>

      <section className="wallet-hero">
        <span>Current balance</span>
        <strong>{money(account.creditBalance)} THB</strong>
        <small>{totals.transactionCount || 0} ledger entries</small>
      </section>

      <section className="wallet-grid">
        <div className="wallet-stat"><span>Credit in</span><strong>{money(totals.totalCreditIn)}</strong></div>
        <div className="wallet-stat"><span>Credit out</span><strong>{money(totals.totalCreditOut)}</strong></div>
        <div className="wallet-stat"><span>Net flow</span><strong>{money(totals.netFlow)}</strong></div>
      </section>

      <section className="card wallet-list">
        <div className="card-header">
          <h3 className="card-title">Transactions</h3>
        </div>

        {entries.length === 0 ? (
          <div className="empty-state"><div className="empty-state-text">No wallet activity yet.</div></div>
        ) : entries.map((entry) => (
          <div key={entry.id} className={`wallet-row wallet-${entry.direction}`}>
            <div className="wallet-row-icon">
              {entry.direction === 'credit' ? <FiArrowDownLeft /> : <FiArrowUpRight />}
            </div>
            <div className="wallet-row-main">
              <div className="wallet-row-top">
                <strong>{entry.entryType === 'transfer' ? 'Transfer' : 'Adjustment'}</strong>
                <span className={`wallet-amount ${entry.direction}`}>{entry.direction === 'credit' ? '+' : '-'}{money(entry.amount)}</span>
              </div>
              <div className="wallet-row-meta">
                <span>{entry.counterparty?.name || entry.performedBy?.name || 'System'}</span>
                <span>{entry.reasonCode || '-'}</span>
                <span>Balance {money(entry.balanceAfter)}</span>
              </div>
              {entry.note && <div className="wallet-row-note">{entry.note}</div>}
            </div>
            <div className="wallet-row-time">
              <FiClock />
              <span>{new Date(entry.createdAt).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </section>

      <style>{`
        .wallet-page, .wallet-list { display: flex; flex-direction: column; gap: 16px; }
        .wallet-hero, .wallet-stat, .wallet-row { border-radius: var(--radius-md); border: 1px solid var(--border); }
        .wallet-hero {
          background: linear-gradient(135deg, rgba(56, 189, 248, 0.14), rgba(56, 189, 248, 0.05));
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .wallet-hero span, .wallet-hero small, .wallet-row-meta, .wallet-row-time, .wallet-row-note { color: var(--text-muted); }
        .wallet-hero strong { font-size: 2rem; }
        .wallet-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .wallet-stat {
          background: var(--bg-card);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .wallet-stat span { color: var(--text-muted); font-size: 0.82rem; }
        .wallet-stat strong { font-size: 1.2rem; }
        .wallet-row {
          background: var(--bg-card);
          padding: 14px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 12px;
          align-items: center;
          border-left-width: 3px;
        }
        .wallet-credit { border-left-color: var(--success); }
        .wallet-debit { border-left-color: var(--danger); }
        .wallet-row-icon {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--bg-surface);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .wallet-row-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .wallet-row-meta {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 0.8rem;
          margin-top: 4px;
        }
        .wallet-row-note { margin-top: 6px; font-size: 0.82rem; }
        .wallet-row-time {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
        }
        .wallet-amount.credit { color: var(--success); }
        .wallet-amount.debit { color: var(--danger); }
        @media (max-width: 920px) {
          .wallet-grid { grid-template-columns: 1fr; }
          .wallet-row { grid-template-columns: auto 1fr; }
          .wallet-row-time { grid-column: 2; }
        }
      `}</style>
    </div>
  );
};

export default CustomerWallet;
