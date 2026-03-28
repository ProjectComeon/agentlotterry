import { useEffect, useState } from 'react';
import { FiClock, FiDollarSign, FiTrendingUp, FiUsers, FiWifi } from 'react-icons/fi';
import { getAgentDashboard } from '../../services/api';
import { useCatalog } from '../../context/CatalogContext';

const betTypeLabels = { '3top': '3 Top', '3tod': '3 Tod', '2top': '2 Top', '2bottom': '2 Bottom', 'run_top': 'Run Top', 'run_bottom': 'Run Bottom' };
const money = (value) => Number(value || 0).toLocaleString();

const AgentDashboard = () => {
  const { announcements, markAnnouncementRead } = useCatalog();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getAgentDashboard();
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

  const stats = data?.stats || {};

  return (
    <div className="agent-dash-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Agent Dashboard</h1>
          <p className="page-subtitle">Live member activity, credit exposure, and the latest submitted items.</p>
        </div>
      </div>

      <section className={`agent-hero ${(stats.netProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
        <span>Net result</span>
        <strong>{(stats.netProfit || 0) >= 0 ? '+' : ''}{money(stats.netProfit)} ฿</strong>
        <small>Total won {money(stats.totalWon)} ฿ from sales {money(stats.totalAmount)} ฿</small>
      </section>

      <section className="dash-grid">
        <div className="dash-card"><FiUsers /><strong>{stats.totalCustomers || 0}</strong><span>members</span><small>{stats.activeCustomers || 0} active</small></div>
        <div className="dash-card"><FiWifi /><strong>{stats.onlineCustomers || 0}</strong><span>online</span><small>recently active</small></div>
        <div className="dash-card"><FiClock /><strong>{stats.pendingBets || 0}</strong><span>pending items</span><small>{stats.totalBets || 0} total</small></div>
        <div className="dash-card"><FiDollarSign /><strong>{money(stats.agentCreditBalance)}</strong><span>agent credit</span><small>available wallet balance</small></div>
        <div className="dash-card"><FiDollarSign /><strong>{money(stats.totalCreditBalance)}</strong><span>member credit</span><small>balance in system</small></div>
        <div className="dash-card"><FiTrendingUp /><strong>{Number(stats.averageStockPercent || 0).toFixed(1)}%</strong><span>avg stock</span><small>across members</small></div>
      </section>

      <section className="card">
        <div className="card-header">
          <h3 className="card-title">Latest items</h3>
        </div>

        <div className="recent-list">
          {data?.recentBets?.length ? data.recentBets.map((bet) => (
            <div key={bet._id} className={`recent-row recent-${bet.result || 'pending'}`}>
              <div>
                <strong>{bet.number}</strong>
                <div className="recent-meta">{bet.customerId?.name || 'Unknown'} • {betTypeLabels[bet.betType] || bet.betType}</div>
                <div className="recent-meta">{bet.marketName || bet.marketId} • {bet.roundTitle || bet.roundDate}</div>
              </div>
              <div className="recent-right">
                <strong>{money(bet.amount)} ฿</strong>
                <span>{bet.result || 'pending'}</span>
              </div>
            </div>
          )) : (
            <div className="empty-state"><div className="empty-state-text">No recent items.</div></div>
          )}
        </div>
      </section>

      {data?.onlineMembers?.length ? (
        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Members online</h3>
          </div>

          <div className="recent-list">
            {data.onlineMembers.map((member) => (
              <div key={member.id} className="recent-row recent-pending">
                <div>
                  <strong>{member.name}</strong>
                  <div className="recent-meta">@{member.username} • {member.memberCode || '-'}</div>
                </div>
                <div className="recent-right">
                  <strong>online</strong>
                  <span>{new Date(member.lastActiveAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {announcements.length ? (
        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Announcements</h3>
          </div>

          <div className="recent-list">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="recent-row recent-pending">
                <div>
                  <strong>{announcement.title}</strong>
                  <div className="recent-meta">{announcement.body}</div>
                </div>
                <div className="recent-right">
                  {!announcement.isRead ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => markAnnouncementRead(announcement.id)}>
                      Mark read
                    </button>
                  ) : (
                    <span>read</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <style>{`
        .agent-dash-page, .recent-list { display: flex; flex-direction: column; gap: 16px; }
        .agent-hero, .dash-card, .recent-row { border-radius: var(--radius-md); border: 1px solid var(--border); }
        .agent-hero { padding: 22px; display: flex; flex-direction: column; gap: 8px; }
        .agent-hero.positive { background: linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(16, 185, 129, 0.05)); }
        .agent-hero.negative { background: linear-gradient(135deg, rgba(239, 68, 68, 0.14), rgba(239, 68, 68, 0.05)); }
        .agent-hero span, .agent-hero small, .dash-card span, .dash-card small, .recent-meta { color: var(--text-muted); }
        .agent-hero strong { font-size: 2rem; }
        .dash-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
        .dash-card { background: var(--bg-card); padding: 16px; display: flex; flex-direction: column; gap: 8px; }
        .dash-card svg { color: var(--primary-light); font-size: 1.1rem; }
        .dash-card strong { font-size: 1.25rem; }
        .recent-row { background: var(--bg-card); padding: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-left-width: 3px; }
        .recent-pending { border-left-color: var(--warning); }
        .recent-won { border-left-color: var(--success); }
        .recent-lost { border-left-color: var(--danger); }
        .recent-right { text-align: right; }
        @media (max-width: 920px) { .dash-grid { grid-template-columns: 1fr 1fr; } }
      `}</style>
    </div>
  );
};

export default AgentDashboard;
