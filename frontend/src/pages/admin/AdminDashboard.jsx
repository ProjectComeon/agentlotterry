import { useEffect, useMemo, useState } from 'react';
import { FiActivity, FiDollarSign, FiTrendingUp, FiUser, FiUsers } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { adminCopy } from '../../i18n/th/admin';
import { getBetResultLabel, getBetTypeLabel } from '../../i18n/th/labels';
import { getAdminDashboard } from '../../services/api';

const money = (value) => Number(value || 0).toLocaleString('th-TH');
const copy = adminCopy.dashboard;

const groupRecentBetsBySlip = (items = []) => {
  const grouped = new Map();

  items.forEach((bet) => {
    const key = bet.slipId || bet.slipNumber || bet._id;
    const existing = grouped.get(key);

    if (existing) {
      existing.items.push(bet);
      existing.totalAmount += Number(bet.amount || 0);
      existing.totalPotentialPayout += Number(bet.potentialPayout || 0);
      existing.result = existing.result === 'pending' || (bet.result || 'pending') === 'pending'
        ? 'pending'
        : existing.result === 'won' || (bet.result || 'pending') === 'won'
          ? 'won'
          : 'lost';
      return;
    }

    grouped.set(key, {
      key,
      slipId: bet.slipId || '',
      slipNumber: bet.slipNumber || '',
      customer: bet.customerId,
      marketName: bet.marketName || copy.defaultMarket,
      roundLabel: bet.roundTitle || bet.roundDate || '-',
      result: bet.result || 'pending',
      totalAmount: Number(bet.amount || 0),
      totalPotentialPayout: Number(bet.potentialPayout || 0),
      items: [bet]
    });
  });

  return [...grouped.values()];
};

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
  const groupedRecentBets = useMemo(() => groupRecentBetsBySlip(data?.recentBets || []), [data?.recentBets]);

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
            <span className="ui-pill">{groupedRecentBets.length || 0} โพย</span>
          </div>

          {groupedRecentBets.length ? (
            <div className="ops-stack">
              {groupedRecentBets.slice(0, 6).map((bet) => (
                <article
                  key={bet.key}
                  className={`ops-feed-row admin-feed-row admin-feed-${bet.result || 'pending'}`}
                >
                  <div className="admin-feed-main">
                    <div className="admin-feed-topline">
                      <strong>{bet.items.map((item) => item.number).join('  ')}</strong>
                      <span className={`badge badge-${bet.result === 'won' ? 'success' : bet.result === 'lost' ? 'danger' : 'warning'}`}>
                        {getBetResultLabel(bet.result)}
                      </span>
                    </div>
                    <div className="ops-feed-meta">
                      {bet.customer?.name || copy.unknownName}
                      {' • '}
                      {bet.items
                        .map((item) => getBetTypeLabel(item.betType))
                        .filter((value, index, array) => array.indexOf(value) === index)
                        .join(', ')}
                    </div>
                    <div className="ops-feed-meta">{bet.marketName} • {bet.roundLabel}</div>
                    <div className="ops-feed-meta admin-feed-slip-ref">โพย {bet.slipNumber || bet.slipId || '-'}</div>
                  </div>
                  <div className="ops-feed-right admin-feed-right">
                    <strong>{money(bet.totalAmount)} บาท</strong>
                    <span>จ่ายสูงสุด {money(bet.totalPotentialPayout)} บาท</span>
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

        .admin-dash-hero {
          align-items: end;
        }

        .admin-dash-hero .ops-hero-side {
          min-width: 248px;
        }

        .admin-dash-overview {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .admin-dash-overview .ops-overview-card {
          min-height: 100%;
        }

        .admin-dash-grid {
          align-items: stretch;
        }

        .admin-dash-panel {
          min-height: 100%;
          box-shadow: 0 18px 32px rgba(127, 29, 29, 0.08);
        }

        .admin-dash-panel .ops-stack {
          gap: 12px;
        }

        .admin-hero-positive strong {
          color: var(--success);
        }

        .admin-hero-negative strong {
          color: var(--danger);
        }

        .admin-feed-row {
          align-items: flex-start;
          padding: 14px 16px;
          border-radius: 16px;
          background: rgba(255, 252, 252, 0.94);
        }

        .admin-feed-main {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .admin-feed-topline {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .admin-feed-topline strong {
          font-size: 1.08rem;
          letter-spacing: -0.03em;
        }

        .admin-feed-right {
          min-width: 154px;
          text-align: right;
        }

        .admin-feed-slip-ref {
          font-size: 0.76rem;
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

        @media (max-width: 920px) {
          .admin-dash-overview,
          .admin-dash-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .admin-dash-overview,
          .admin-dash-grid {
            grid-template-columns: 1fr;
          }

          .admin-dash-page .ops-hero {
            padding: 22px;
          }

          .admin-dash-page .ops-hero-side {
            width: 100%;
            min-width: 0;
          }

          .admin-feed-row {
            padding: 13px 14px;
          }

          .admin-feed-right {
            min-width: 0;
            width: 100%;
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
