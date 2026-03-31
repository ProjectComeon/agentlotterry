import { useEffect, useMemo, useState } from 'react';
import { FiActivity, FiDollarSign, FiTrendingUp, FiUser, FiUsers } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { adminCopy } from '../../i18n/th/admin';
import { getBetResultLabel, getBetTypeLabel } from '../../i18n/th/labels';
import { getAdminDashboard } from '../../services/api';

const money = (value) => Number(value || 0).toLocaleString('th-TH');
const copy = adminCopy.dashboard;

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const res = await getAdminDashboard();
        setData(res.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const stats = data?.stats || {};
  const totalAmount = Number(stats.totalAmount || 0);
  const totalWon = Number(stats.totalWon || 0);
  const netProfit = Number(stats.netProfit || 0);

  const statCards = useMemo(() => ([
    {
      icon: FiUsers,
      value: stats.totalAgents || 0,
      label: copy.statCards.agents.label,
      hint: copy.statCards.agents.hint(stats.activeAgents || 0)
    },
    {
      icon: FiUser,
      value: stats.totalCustomers || 0,
      label: copy.statCards.members.label,
      hint: copy.statCards.members.hint(stats.activeCustomers || 0)
    },
    {
      icon: FiDollarSign,
      value: `${money(totalAmount)} บาท`,
      label: copy.statCards.totalSales.label,
      hint: copy.statCards.totalSales.hint
    },
    {
      icon: FiTrendingUp,
      value: `${money(netProfit)} บาท`,
      label: copy.statCards.netProfit.label,
      hint: copy.statCards.netProfit.hint
    }
  ]), [copy.statCards, netProfit, stats.activeAgents, stats.activeCustomers, stats.totalAgents, stats.totalCustomers, totalAmount]);

  if (loading) {
    return <PageSkeleton statCount={4} rows={5} sidebar compactSidebar />;
  }

  return (
    <div className="ops-page admin-dash-page animate-fade-in">
      <section className="ops-hero admin-dash-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">{copy.heroEyebrow}</span>
          <h1 className="page-title">{copy.heroTitle}</h1>
          <p className="page-subtitle">{copy.heroSubtitle}</p>
        </div>

        <div className={`ops-hero-side ${netProfit >= 0 ? 'admin-hero-positive' : 'admin-hero-negative'}`}>
          <span>{copy.systemNet}</span>
          <strong>{netProfit >= 0 ? '+' : ''}{money(netProfit)} บาท</strong>
          <small>{copy.totalWon(money(totalWon))}</small>
        </div>
      </section>

      <section className="ops-overview-grid admin-dash-overview">
        {statCards.map((card) => (
          <article key={card.label} className="ops-overview-card">
            <div className="ops-icon-badge"><card.icon /></div>
            <strong>{card.value}</strong>
            <span>{card.label}</span>
            <small>{card.hint}</small>
          </article>
        ))}
      </section>

      <section className="ops-grid admin-dash-grid">
        <section className="card ops-section admin-dash-panel">
          <div className="ui-panel-head">
            <div>
              <div className="ui-eyebrow">{copy.activityEyebrow}</div>
              <h3 className="card-title">{copy.activityTitle}</h3>
            </div>
            <span className="ui-pill"><FiActivity /> {money(stats.totalBets)}</span>
          </div>

          <div className="ops-stack">
            <div className="ops-stat-row"><span>{copy.totalBets}</span><strong>{money(stats.totalBets)}</strong></div>
            <div className="ops-stat-row"><span>{copy.pendingBets}</span><strong>{money(stats.pendingBets)}</strong></div>
            <div className="ops-stat-row"><span>{copy.totalPayout}</span><strong>{money(totalWon)} บาท</strong></div>
            <div className="ops-stat-row"><span>{copy.netProfit}</span><strong>{money(netProfit)} บาท</strong></div>
          </div>
        </section>

        <section className="card ops-section admin-dash-panel">
          <div className="ui-panel-head">
            <div>
              <div className="ui-eyebrow">{copy.recentEyebrow}</div>
              <h3 className="card-title">{copy.recentTitle}</h3>
            </div>
            <span className="ui-pill">{data?.recentBets?.length || 0} รายการ</span>
          </div>

          {data?.recentBets?.length ? (
            <div className="ops-stack">
              {data.recentBets.slice(0, 6).map((bet, index) => (
                <article
                  key={`${bet._id || index}-${bet.number}`}
                  className={`ops-feed-row admin-feed-row admin-feed-${bet.result || 'pending'}`}
                >
                  <div>
                    <strong>{bet.customerId?.name || copy.unknownName} - {getBetTypeLabel(bet.betType)}</strong>
                    <div className="ops-feed-meta">{bet.marketName || copy.defaultMarket} - {bet.roundDate} - #{bet.number}</div>
                  </div>
                  <div className="ops-feed-right">
                    <strong>{money(bet.amount)} บาท</strong>
                    <span className={`badge badge-${bet.result === 'won' ? 'success' : bet.result === 'lost' ? 'danger' : 'warning'}`}>
                      {getBetResultLabel(bet.result)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state"><div className="empty-state-text">{copy.noRecentBets}</div></div>
          )}
        </section>
      </section>

      <style>{`
        .admin-dash-page {
          gap: 16px;
        }

        .admin-dash-grid {
          align-items: stretch;
        }

        .admin-dash-panel {
          min-height: 100%;
        }

        .admin-hero-positive strong {
          color: var(--success);
        }

        .admin-hero-negative strong {
          color: var(--danger);
        }

        .admin-feed-row {
          align-items: flex-start;
        }

        .admin-feed-pending {
          border-left: 3px solid var(--warning);
        }

        .admin-feed-won {
          border-left: 3px solid var(--success);
        }

        .admin-feed-lost {
          border-left: 3px solid var(--danger);
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
