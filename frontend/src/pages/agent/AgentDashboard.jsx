import { useEffect, useMemo, useState } from 'react';
import { FiBell, FiClock, FiDollarSign, FiTrendingUp, FiUsers, FiWifi } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { agentCopy } from '../../i18n/th/agent';
import { getBetResultLabel, getBetTypeLabel } from '../../i18n/th/labels';
import { getAgentDashboard } from '../../services/api';
import { useCatalog } from '../../context/CatalogContext';

const money = (value) => Number(value || 0).toLocaleString('th-TH');
const formatDateTime = (value) => {
  if (!value) return agentCopy.dashboard.noRecentActivity;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return agentCopy.dashboard.noRecentActivity;
  return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

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

  const stats = data?.stats || {};
  const unreadAnnouncements = announcements.filter((announcement) => !announcement.isRead).length;
  const hasSidePanels = Boolean(data?.onlineMembers?.length || announcements.length);

  const statCards = useMemo(() => ([
    {
      icon: FiUsers,
      value: stats.totalCustomers || 0,
      label: agentCopy.dashboard.statCards.members.label,
      hint: agentCopy.dashboard.statCards.members.hint(stats.activeCustomers || 0)
    },
    {
      icon: FiWifi,
      value: stats.onlineCustomers || 0,
      label: agentCopy.dashboard.statCards.onlineNow.label,
      hint: agentCopy.dashboard.statCards.onlineNow.hint
    },
    {
      icon: FiClock,
      value: stats.pendingBets || 0,
      label: agentCopy.dashboard.statCards.pendingItems.label,
      hint: agentCopy.dashboard.statCards.pendingItems.hint(stats.totalBets || 0)
    },
    {
      icon: FiDollarSign,
      value: money(stats.agentCreditBalance),
      label: agentCopy.dashboard.statCards.agentCredit.label,
      hint: agentCopy.dashboard.statCards.agentCredit.hint
    },
    {
      icon: FiDollarSign,
      value: money(stats.totalCreditBalance),
      label: agentCopy.dashboard.statCards.memberCredit.label,
      hint: agentCopy.dashboard.statCards.memberCredit.hint
    },
    {
      icon: FiTrendingUp,
      value: `${Number(stats.averageStockPercent || 0).toFixed(1)}%`,
      label: agentCopy.dashboard.statCards.averageStock.label,
      hint: agentCopy.dashboard.statCards.averageStock.hint
    }
  ]), [stats]);

  if (loading) return <PageSkeleton statCount={6} rows={6} sidebar compactSidebar />;

  return (
    <div className="agent-dash-page animate-fade-in">
      <section className="agent-dash-hero card">
        <div className="agent-dash-hero-copy">
          <span className="section-eyebrow">{agentCopy.dashboard.heroEyebrow}</span>
          <h1 className="page-title">{agentCopy.dashboard.heroTitle}</h1>
          <p className="page-subtitle">{agentCopy.dashboard.heroSubtitle}</p>
        </div>

        <div className="hero-insight-grid">
          <div className={`net-result-panel ${(stats.netProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
            <span>{agentCopy.dashboard.netResult}</span>
            <strong>{(stats.netProfit || 0) >= 0 ? '+' : ''}{money(stats.netProfit)} บาท</strong>
            <small>{agentCopy.dashboard.totalWonFromSales(money(stats.totalWon), money(stats.totalAmount))}</small>
          </div>

          <div className="hero-mini-card">
            <div className="hero-mini-icon"><FiWifi /></div>
            <span>{agentCopy.dashboard.onlineMembers}</span>
            <strong>{stats.onlineCustomers || 0}</strong>
            <small>{agentCopy.dashboard.onlineMembersHint}</small>
          </div>

          <div className="hero-mini-card">
            <div className="hero-mini-icon"><FiBell /></div>
            <span>{agentCopy.dashboard.unreadNotices}</span>
            <strong>{unreadAnnouncements}</strong>
            <small>{agentCopy.dashboard.announcementsTotal(announcements.length)}</small>
          </div>
        </div>
      </section>

      <section className="dash-grid">
        {statCards.map((card) => (
          <article key={card.label} className="dash-card">
            <div className="dash-card-icon"><card.icon /></div>
            <strong>{card.value}</strong>
            <span>{card.label}</span>
            <small>{card.hint}</small>
          </article>
        ))}
      </section>

      <section className={`dashboard-columns ${hasSidePanels ? '' : 'single'}`}>
        <section className="card panel-card">
          <div className="panel-head">
            <div>
              <div className="panel-eyebrow">{agentCopy.dashboard.activityEyebrow}</div>
              <h3 className="card-title">{agentCopy.dashboard.activityTitle}</h3>
            </div>
            <span className="panel-count">{agentCopy.dashboard.items(data?.recentBets?.length || 0)}</span>
          </div>

          <div className="recent-list">
            {data?.recentBets?.length ? data.recentBets.map((bet) => (
              <article key={bet._id} className={`recent-row recent-${bet.result || 'pending'}`}>
                <div className="recent-main">
                  <div className="recent-topline">
                    <strong>{bet.number}</strong>
                    <span className={`result-pill result-${bet.result || 'pending'}`}>{getBetResultLabel(bet.result || 'pending')}</span>
                  </div>
                  <div className="recent-meta">{bet.customerId?.name || agentCopy.dashboard.unknownMember} • {getBetTypeLabel(bet.betType)}</div>
                  <div className="recent-meta">{bet.marketName || bet.marketId} • {bet.roundTitle || bet.roundDate}</div>
                </div>
                <div className="recent-right">
                  <strong>{money(bet.amount)} บาท</strong>
                  <span>{agentCopy.dashboard.potentialPayout(money(bet.potentialPayout))}</span>
                </div>
              </article>
            )) : (
              <div className="empty-state"><div className="empty-state-text">{agentCopy.dashboard.noRecentItems}</div></div>
            )}
          </div>
        </section>

        {hasSidePanels ? (
          <div className="dashboard-side-stack">
            {data?.onlineMembers?.length ? (
              <section className="card panel-card compact-panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-eyebrow">{agentCopy.dashboard.presenceEyebrow}</div>
                    <h3 className="card-title">{agentCopy.dashboard.membersOnline}</h3>
                  </div>
                  <span className="panel-count">{data.onlineMembers.length}</span>
                </div>

                <div className="recent-list">
                  {data.onlineMembers.map((member) => (
                    <article key={member.id} className="recent-row recent-pending">
                      <div className="recent-main">
                        <div className="recent-topline">
                          <strong>{member.name}</strong>
                          <span className="result-pill result-pending">{agentCopy.dashboard.online}</span>
                        </div>
                        <div className="recent-meta">@{member.username} • {member.memberCode || '-'}</div>
                      </div>
                      <div className="recent-right">
                        <span>{formatDateTime(member.lastActiveAt)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {announcements.length ? (
              <section className="card panel-card compact-panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-eyebrow">{agentCopy.dashboard.broadcastEyebrow}</div>
                    <h3 className="card-title">{agentCopy.dashboard.announcementsTitle}</h3>
                  </div>
                  <span className="panel-count">{agentCopy.dashboard.unread(unreadAnnouncements)}</span>
                </div>

                <div className="recent-list">
                  {announcements.map((announcement) => (
                    <article key={announcement.id} className="recent-row recent-pending">
                      <div className="recent-main">
                        <div className="recent-topline">
                          <strong>{announcement.title}</strong>
                          {!announcement.isRead ? <span className="result-pill result-pending">{agentCopy.dashboard.newBadge}</span> : null}
                        </div>
                        <div className="recent-meta">{announcement.body}</div>
                      </div>
                      <div className="recent-right">
                        {!announcement.isRead ? (
                          <button className="btn btn-secondary btn-sm" onClick={() => markAnnouncementRead(announcement.id)}>
                            {agentCopy.dashboard.markRead}
                          </button>
                        ) : (
                          <span>{agentCopy.dashboard.read}</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </section>

      <style>{`
        .agent-dash-page, .recent-list, .dashboard-side-stack {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .agent-dash-page {
          position: relative;
          isolation: isolate;
        }

        .agent-dash-page::before {
          content: '';
          position: absolute;
          inset: -48px 0 auto;
          height: 220px;
          background:
            radial-gradient(circle at top left, rgba(220, 38, 38, 0.14), transparent 62%),
            radial-gradient(circle at top right, rgba(248, 113, 113, 0.08), transparent 30%);
          pointer-events: none;
          z-index: -1;
        }

        .agent-dash-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.95fr);
          gap: 20px;
          padding: 24px;
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(255, 243, 243, 0.98)),
            radial-gradient(circle at top right, rgba(248, 113, 113, 0.14), transparent 36%);
          border-color: rgba(220, 38, 38, 0.14);
          box-shadow: 0 20px 48px rgba(127, 29, 29, 0.12);
        }

        .agent-dash-hero-copy {
          display: flex;
          flex-direction: column;
          gap: 10px;
          justify-content: space-between;
        }

        .section-eyebrow, .panel-eyebrow {
          font-size: 0.78rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--primary);
          font-weight: 700;
        }

        .agent-dash-hero .page-title {
          margin: 0;
          font-size: clamp(2rem, 4vw, 3rem);
          line-height: 0.96;
          letter-spacing: -0.04em;
        }

        .agent-dash-hero .page-subtitle {
          margin: 0;
          max-width: 56ch;
        }

        .hero-insight-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .net-result-panel, .hero-mini-card, .dash-card, .recent-row {
          border-radius: 18px;
          border: 1px solid var(--border);
        }

        .net-result-panel {
          grid-column: 1 / -1;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: linear-gradient(135deg, rgba(220, 38, 38, 0.1), rgba(255, 250, 250, 0.96));
        }

        .net-result-panel.positive {
          border-color: rgba(16, 185, 129, 0.18);
          box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.05);
        }

        .net-result-panel.negative {
          border-color: rgba(220, 38, 38, 0.18);
          box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.05);
        }

        .net-result-panel span, .net-result-panel small, .dash-card span, .dash-card small, .recent-meta, .hero-mini-card span, .hero-mini-card small {
          color: var(--text-muted);
        }

        .net-result-panel strong {
          font-size: clamp(2rem, 4vw, 2.8rem);
          line-height: 0.95;
          letter-spacing: -0.05em;
        }

        .net-result-panel.positive strong {
          color: var(--success);
        }

        .net-result-panel.negative strong {
          color: var(--danger);
        }

        .hero-mini-card {
          padding: 16px;
          background: rgba(255, 252, 252, 0.96);
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: var(--shadow-sm);
        }

        .hero-mini-card strong {
          font-size: 1.5rem;
          letter-spacing: -0.04em;
          color: var(--text-primary);
        }

        .hero-mini-icon, .dash-card-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(220, 38, 38, 0.08);
          color: var(--primary);
          border: 1px solid rgba(220, 38, 38, 0.14);
        }

        .dash-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .dash-card {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 247, 247, 0.98));
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-height: 148px;
          box-shadow: var(--shadow-sm);
        }

        .dash-card strong {
          font-size: 1.45rem;
          line-height: 1;
          letter-spacing: -0.04em;
        }

        .dash-card span {
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .dashboard-columns {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
          gap: 16px;
          align-items: start;
        }

        .dashboard-columns.single {
          grid-template-columns: 1fr;
        }

        .panel-card {
          padding: 18px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 249, 249, 0.98));
        }

        .panel-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }

        .panel-head .card-title {
          margin: 6px 0 0;
          font-size: 1.15rem;
        }

        .panel-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(220, 38, 38, 0.08);
          border: 1px solid rgba(220, 38, 38, 0.14);
          color: var(--primary);
          font-size: 0.78rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .recent-row {
          background: rgba(255, 252, 252, 0.96);
          padding: 14px 15px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-left-width: 3px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }

        .recent-row strong {
          letter-spacing: -0.03em;
        }

        .recent-main {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .recent-topline {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .recent-meta {
          font-size: 0.84rem;
        }

        .recent-pending { border-left-color: var(--warning); }
        .recent-won { border-left-color: var(--success); }
        .recent-lost { border-left-color: var(--danger); }

        .recent-right {
          min-width: 132px;
          text-align: right;
          display: flex;
          flex-direction: column;
          gap: 6px;
          color: var(--text-secondary);
          font-size: 0.84rem;
        }

        .result-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
        }

        .result-pending {
          background: rgba(245, 158, 11, 0.12);
          color: #b45309;
        }

        .result-won {
          background: rgba(16, 185, 129, 0.12);
          color: #047857;
        }

        .result-lost {
          background: rgba(220, 38, 38, 0.12);
          color: var(--danger);
        }

        @media (max-width: 1100px) {
          .dash-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .dashboard-columns, .agent-dash-hero {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .dash-grid, .hero-insight-grid {
            grid-template-columns: 1fr;
          }

          .recent-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .recent-right {
            min-width: 0;
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
};

export default AgentDashboard;
