import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiBell, FiClock, FiDollarSign, FiEye, FiUsers } from 'react-icons/fi';
import GroupedSlipSummary from '../../components/GroupedSlipSummary';
import PageSkeleton from '../../components/PageSkeleton';
import SlipPreviewModal from '../../components/SlipPreviewModal';
import { useCatalog } from '../../context/CatalogContext';
import { agentCopy } from '../../i18n/th/agent';
import { getBetResultLabel, getBetTypeLabel } from '../../i18n/th/labels';
import { getAgentDashboard } from '../../services/api';
import { groupRecentBetsBySlip } from '../../utils/recentSlipGroups';
import { formatDateTime, formatMoney as money } from '../../utils/formatters';

const AgentDashboard = () => {
  const { announcements, ensureCatalogLoaded, markAnnouncementRead } = useCatalog();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [copyingSlipImage, setCopyingSlipImage] = useState(false);

  useEffect(() => {
    let idleId = null;
    let timeoutId = null;

    const loadAnnouncements = () => {
      void ensureCatalogLoaded?.({ includeAnnouncements: true });
    };

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(loadAnnouncements, { timeout: 600 });
    } else if (typeof window !== 'undefined') {
      timeoutId = window.setTimeout(loadAnnouncements, 180);
    } else {
      loadAnnouncements();
    }

    return () => {
      if (idleId !== null && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null && typeof window !== 'undefined') {
        window.clearTimeout(timeoutId);
      }
    };
  }, [ensureCatalogLoaded]);

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
  const groupedRecentBets = useMemo(
    () =>
      groupRecentBetsBySlip(data?.recentBets || [], {
        resolveMarketName: (bet) => bet.marketName || bet.marketId || '-'
      }),
    [data?.recentBets]
  );
  const hasSidePanels = Boolean(data?.onlineMembers?.length || announcements.length);

  const statCards = useMemo(
    () => [
      {
        icon: FiUsers,
        value: stats.totalCustomers || 0,
        label: agentCopy.dashboard.statCards.members.label,
        hint: agentCopy.dashboard.statCards.members.hint(stats.activeCustomers || 0)
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
      }
    ],
    [stats]
  );

  const handleCopySlipImage = async () => {
    if (!selectedSlip) return;
    setCopyingSlipImage(true);
    try {
      const { copySavedSlipImage } = await import('../../utils/slipImage');
      const result = await copySavedSlipImage({
        slip: {
          ...selectedSlip,
          resultLabel: getBetResultLabel(selectedSlip.result)
        },
        actorLabel: agentCopy.dashboard.heroTitle,
        resolveBetTypeLabel: getBetTypeLabel
      });
      toast.success(result.mode === 'clipboard' ? 'คัดลอกโพยเป็นรูปแล้ว' : 'สร้างไฟล์รูปโพยแล้ว');
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'คัดลอกโพยเป็นรูปไม่สำเร็จ');
    } finally {
      setCopyingSlipImage(false);
    }
  };

  if (loading) return <PageSkeleton statCount={4} rows={6} sidebar compactSidebar />;

  return (
    <div className="ops-page agent-dash-page animate-fade-in">
      <section className="ops-hero agent-dash-hero card">
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

          <div className="hero-mini-card hero-mini-card-wide">
            <div className="hero-mini-icon"><FiBell /></div>
            <span>{agentCopy.dashboard.unreadNotices}</span>
            <strong>{unreadAnnouncements}</strong>
            <small>{agentCopy.dashboard.announcementsTotal(announcements.length)}</small>
          </div>
        </div>
      </section>

      <section className="dash-grid agent-dash-overview">
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
        <section className="card panel-card agent-dash-panel">
          <div className="panel-head">
            <div>
              <div className="panel-eyebrow">{agentCopy.dashboard.activityEyebrow}</div>
              <h3 className="card-title">{agentCopy.dashboard.activityTitle}</h3>
            </div>
            <span className="panel-count">{agentCopy.dashboard.items(groupedRecentBets.length || 0)}</span>
          </div>

          <div className="recent-list">
            {groupedRecentBets.length ? (
              groupedRecentBets.map((bet) => (
                <article key={bet.key} className={`recent-slip-card recent-slip-card-${bet.result}`}>
                  <div className="recent-slip-card-head">
                    <div className="recent-slip-card-copy">
                      <div className="recent-slip-kicker">เลขอ้างอิง: {bet.slipNumber || bet.slipId || '-'}</div>
                      <strong>{bet.customer?.name || agentCopy.dashboard.unknownMember}</strong>
                      <div className="recent-meta">{bet.marketName} • {bet.roundLabel}</div>
                    </div>

                    <div className="recent-slip-card-actions">
                      <span className={`result-pill result-${bet.result}`}>{getBetResultLabel(bet.result)}</span>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedSlip(bet)}>
                        <FiEye />
                        ดูโพย
                      </button>
                    </div>
                  </div>

                  <GroupedSlipSummary
                    slip={bet}
                    dense
                    showMemo={Boolean(String(bet.memo || '').trim())}
                    className="recent-slip-grouped-summary slip-grouped-compact"
                  />
                </article>
              ))
            ) : (
              <div className="empty-state"><div className="empty-state-text">{agentCopy.dashboard.noRecentItems}</div></div>
            )}
          </div>
        </section>

        {hasSidePanels ? (
          <div className="dashboard-side-stack">
            {data?.onlineMembers?.length ? (
              <section className="card panel-card compact-panel agent-dash-panel">
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
                        <div className="recent-meta">@{member.username}</div>
                      </div>
                      <div className="recent-right">
                        <span>{formatDateTime(member.lastActiveAt, { fallback: agentCopy.dashboard.noRecentActivity })}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {announcements.length ? (
              <section className="card panel-card compact-panel agent-dash-panel">
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

      {selectedSlip ? (
        <SlipPreviewModal
          slip={{
            ...selectedSlip,
            resultLabel: getBetResultLabel(selectedSlip.result)
          }}
          onClose={() => setSelectedSlip(null)}
          onCopyImage={handleCopySlipImage}
          copyingImage={copyingSlipImage}
          actorLabel="เอเย่นต์"
          unknownMember={agentCopy.dashboard.unknownMember}
        />
      ) : null}

      <style>{`
        .agent-dash-page,
        .recent-list,
        .dashboard-side-stack {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .agent-dash-page {
          position: relative;
          isolation: isolate;
          gap: 16px;
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
          align-items: stretch;
        }

        .agent-dash-hero-copy {
          display: flex;
          flex-direction: column;
          gap: 10px;
          justify-content: space-between;
        }

        .section-eyebrow,
        .panel-eyebrow {
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
          align-content: stretch;
        }

        .net-result-panel,
        .hero-mini-card,
        .dash-card,
        .recent-row {
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

        .net-result-panel span,
        .net-result-panel small,
        .dash-card span,
        .dash-card small,
        .recent-meta,
        .hero-mini-card span,
        .hero-mini-card small {
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

        .hero-mini-card-wide {
          grid-column: 1 / -1;
        }

        .hero-mini-card strong {
          font-size: 1.5rem;
          letter-spacing: -0.04em;
          color: var(--text-primary);
        }

        .hero-mini-icon,
        .dash-card-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          background: rgba(220, 38, 38, 0.08);
          border: 1px solid rgba(220, 38, 38, 0.12);
        }

        .dash-grid.agent-dash-overview {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
        }

        .dash-card {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 247, 247, 0.96));
          box-shadow: var(--shadow-sm);
          min-height: 132px;
        }

        .dash-card strong {
          font-size: 1.28rem;
          letter-spacing: -0.04em;
        }

        .dash-card .dash-card-icon {
          width: 38px;
          height: 38px;
          border-radius: 12px;
        }

        .dashboard-columns {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
          gap: 16px;
        }

        .dashboard-columns.single {
          grid-template-columns: minmax(0, 1fr);
        }

        .panel-card.agent-dash-panel {
          padding: 18px;
          box-shadow: 0 14px 32px rgba(127, 29, 29, 0.08);
        }

        .panel-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .panel-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(220, 38, 38, 0.08);
          border: 1px solid rgba(220, 38, 38, 0.12);
          color: var(--primary);
          font-size: 0.82rem;
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

        .recent-pending {
          border-left: 3px solid var(--warning);
        }

        .result-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .result-pending {
          background: rgba(245, 158, 11, 0.14);
          color: #b45309;
        }

        .result-won {
          background: rgba(16, 185, 129, 0.14);
          color: #047857;
        }

        .result-lost {
          background: rgba(220, 38, 38, 0.12);
          color: var(--danger);
        }

        @media (max-width: 1080px) {
          .agent-dash-hero,
          .dashboard-columns {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .hero-insight-grid,
          .dash-grid.agent-dash-overview,
          .panel-head {
            grid-template-columns: 1fr;
          }

          .recent-row {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default AgentDashboard;

