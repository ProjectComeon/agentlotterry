import { useEffect, useMemo, useState } from 'react';
import { FiDollarSign, FiTrendingUp, FiUser, FiUsers } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { getAdminDashboard } from '../../services/api';

const money = (value) => Number(value || 0).toLocaleString('th-TH');

const betTypeLabels = {
  '3top': '3 Top',
  '3tod': '3 Tod',
  '2top': '2 Top',
  '2bottom': '2 Bottom',
  'run_top': 'Run Top',
  'run_bottom': 'Run Bottom'
};

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const res = await getAdminDashboard();
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const stats = data?.stats || {};

  const statCards = useMemo(() => ([
    {
      icon: FiUsers,
      value: stats.totalAgents || 0,
      label: 'Agents',
      hint: `${stats.activeAgents || 0} active`
    },
    {
      icon: FiUser,
      value: stats.totalCustomers || 0,
      label: 'Members',
      hint: `${stats.activeCustomers || 0} active`
    },
    {
      icon: FiDollarSign,
      value: `${money(stats.totalAmount)} THB`,
      label: 'Gross sales',
      hint: 'Total accepted stake'
    },
    {
      icon: FiTrendingUp,
      value: `${money(stats.netProfit)} THB`,
      label: 'Net result',
      hint: 'System-wide profit after payout'
    }
  ]), [stats]);

  if (loading) {
    return <PageSkeleton statCount={4} rows={5} sidebar compactSidebar />;
  }

  return (
    <div className="ops-page animate-fade-in">
      <section className="ops-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">System control</span>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Monitor platform health, active users, financial movement, and the latest betting activity from one command view.</p>
        </div>

        <div className={`ops-hero-side ${(stats.netProfit || 0) >= 0 ? 'admin-hero-positive' : 'admin-hero-negative'}`}>
          <span>Net platform result</span>
          <strong>{(stats.netProfit || 0) >= 0 ? '+' : ''}{money(stats.netProfit)} THB</strong>
          <small>Total payout {money(stats.totalWon)} THB</small>
        </div>
      </section>

      <section className="ops-overview-grid">
        {statCards.map((card) => (
          <article key={card.label} className="ops-overview-card">
            <div className="ops-icon-badge"><card.icon /></div>
            <strong>{card.value}</strong>
            <span>{card.label}</span>
            <small>{card.hint}</small>
          </article>
        ))}
      </section>

      <section className="ops-grid">
        <section className="card ops-section">
          <div className="ui-panel-head">
            <div>
              <div className="ui-eyebrow">Platform activity</div>
              <h3 className="card-title">Betting statistics</h3>
            </div>
          </div>

          <div className="ops-stack">
            <div className="ops-stat-row"><span>Total bet items</span><strong>{money(stats.totalBets)}</strong></div>
            <div className="ops-stat-row"><span>Pending items</span><strong>{money(stats.pendingBets)}</strong></div>
            <div className="ops-stat-row"><span>Total payout</span><strong>{money(stats.totalWon)} THB</strong></div>
            <div className="ops-stat-row"><span>Net result</span><strong>{money(stats.netProfit)} THB</strong></div>
          </div>
        </section>

        <section className="card ops-section">
          <div className="ui-panel-head">
            <div>
              <div className="ui-eyebrow">Recent feed</div>
              <h3 className="card-title">Latest bets</h3>
            </div>
          </div>

          {data?.recentBets?.length ? (
            <div className="ops-stack">
              {data.recentBets.slice(0, 6).map((bet, index) => (
                <article key={`${bet._id || index}-${bet.number}`} className="ops-feed-row">
                  <div>
                    <strong>{bet.customerId?.name || 'Unknown'} - {betTypeLabels[bet.betType] || bet.betType}</strong>
                    <div className="ops-feed-meta">{bet.marketName || 'Lottery'} - {bet.roundDate} - #{bet.number}</div>
                  </div>
                  <div className="ops-feed-right">
                    <strong>{money(bet.amount)} THB</strong>
                    <span className={`badge badge-${bet.result === 'won' ? 'success' : bet.result === 'lost' ? 'danger' : 'warning'}`}>
                      {bet.result || 'pending'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state"><div className="empty-state-text">No recent betting activity.</div></div>
          )}
        </section>
      </section>

      <style>{`
        .admin-hero-positive{border-color:rgba(16,185,129,.22)}
        .admin-hero-negative{border-color:rgba(239,68,68,.22)}
      `}</style>
    </div>
  );
};

export default AdminDashboard;
