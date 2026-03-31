import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiBell, FiClock, FiCopy, FiDollarSign, FiEye, FiTrendingUp, FiUsers, FiWifi, FiX } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { useCatalog } from '../../context/CatalogContext';
import { agentCopy } from '../../i18n/th/agent';
import { getBetResultLabel, getBetTypeLabel } from '../../i18n/th/labels';
import { getAgentDashboard } from '../../services/api';
import { copySavedSlipImage } from '../../utils/slipImage';

const money = (value) => Number(value || 0).toLocaleString('th-TH');

const formatDateTime = (value) => {
  if (!value) return agentCopy.dashboard.noRecentActivity;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return agentCopy.dashboard.noRecentActivity;
  return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

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
      marketName: bet.marketName || bet.marketId || '-',
      roundLabel: bet.roundTitle || bet.roundDate || '-',
      result: bet.result || 'pending',
      totalAmount: Number(bet.amount || 0),
      totalPotentialPayout: Number(bet.potentialPayout || 0),
      items: [bet]
    });
  });

  return [...grouped.values()];
};

const AgentDashboard = () => {
  const { announcements, markAnnouncementRead } = useCatalog();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [copyingSlipImage, setCopyingSlipImage] = useState(false);

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
  const groupedRecentBets = useMemo(() => groupRecentBetsBySlip(data?.recentBets || []), [data?.recentBets]);
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

  const handleCopySlipImage = async () => {
    if (!selectedSlip) return;
    setCopyingSlipImage(true);
    try {
      const result = await copySavedSlipImage({
        slip: {
          ...selectedSlip,
          resultLabel: getBetResultLabel(selectedSlip.result)
        },
        actorLabel: agentCopy.dashboard.heroTitle,
        resolveBetTypeLabel: getBetTypeLabel
      });
      toast.success(
        result.mode === 'clipboard'
          ? 'คัดลอกโพยเป็นรูปแล้ว'
          : 'สร้างไฟล์รูปโพยแล้ว'
      );
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'คัดลอกโพยเป็นรูปไม่สำเร็จ');
    } finally {
      setCopyingSlipImage(false);
    }
  };

  if (loading) return <PageSkeleton statCount={6} rows={6} sidebar compactSidebar />;

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
            {groupedRecentBets.length ? groupedRecentBets.map((bet) => (
              <article key={bet.key} className={`recent-row recent-${bet.result}`}>
                <div className="recent-main">
                  <div className="recent-topline">
                    <strong>{bet.items.map((item) => item.number).join('  ')}</strong>
                    <span className={`result-pill result-${bet.result}`}>{getBetResultLabel(bet.result)}</span>
                  </div>
                  <div className="recent-meta">
                    {bet.customer?.name || agentCopy.dashboard.unknownMember}
                    {' • '}
                    {bet.items
                      .map((item) => getBetTypeLabel(item.betType))
                      .filter((value, index, array) => array.indexOf(value) === index)
                      .join(', ')}
                  </div>
                  <div className="recent-meta">{bet.marketName} • {bet.roundLabel}</div>
                  <div className="recent-meta recent-slip-ref">โพย {bet.slipNumber || bet.slipId || '-'}</div>
                </div>
                <div className="recent-right">
                  <strong>{money(bet.totalAmount)} บาท</strong>
                  <span>{agentCopy.dashboard.potentialPayout(money(bet.totalPotentialPayout))}</span>
                  <button type="button" className="btn btn-secondary btn-sm recent-view-btn" onClick={() => setSelectedSlip(bet)}>
                    <FiEye />
                    ดูโพย
                  </button>
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
                        <span>{formatDateTime(member.lastActiveAt)}</span>
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
        <div className="modal-overlay" onClick={() => setSelectedSlip(null)}>
          <div className="modal recent-slip-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="ui-eyebrow">รายละเอียดโพย</div>
                <h3 className="modal-title">โพย {selectedSlip.slipNumber || selectedSlip.slipId || '-'}</h3>
              </div>
              <div className="recent-slip-modal-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopySlipImage} disabled={copyingSlipImage}>
                  <FiCopy />
                  {copyingSlipImage ? 'กำลังคัดลอกโพยเป็นรูป...' : 'คัดลอกโพยเป็นรูป'}
                </button>
                <button type="button" className="modal-close" onClick={() => setSelectedSlip(null)}>
                  <FiX />
                </button>
              </div>
            </div>

            <div className="recent-slip-meta-grid">
              <div className="recent-slip-meta-card">
                <span>สมาชิก</span>
                <strong>{selectedSlip.customer?.name || agentCopy.dashboard.unknownMember}</strong>
              </div>
              <div className="recent-slip-meta-card">
                <span>ตลาด / งวด</span>
                <strong>{selectedSlip.marketName} • {selectedSlip.roundLabel}</strong>
              </div>
              <div className="recent-slip-meta-card">
                <span>ยอดแทงรวม</span>
                <strong>{money(selectedSlip.totalAmount)} บาท</strong>
              </div>
              <div className="recent-slip-meta-card">
                <span>จ่ายสูงสุด</span>
                <strong>{money(selectedSlip.totalPotentialPayout)} บาท</strong>
              </div>
            </div>

            <div className="recent-slip-items">
              {selectedSlip.items.map((item) => (
                <div key={item._id} className="recent-slip-item">
                  <div className="recent-slip-number">{item.number}</div>
                  <div className="recent-slip-item-body">
                    <div className="recent-slip-item-head">
                      <strong>{getBetTypeLabel(item.betType)}</strong>
                      <span>x{item.payRate}</span>
                    </div>
                    <div className="recent-slip-item-values">
                      <span>ยอดแทง {money(item.amount)} บาท</span>
                      <span>จ่ายสูงสุด {money(item.potentialPayout)} บาท</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer recent-slip-footer">
              <button type="button" className="btn btn-secondary" onClick={handleCopySlipImage} disabled={copyingSlipImage}>
                <FiCopy />
                {copyingSlipImage ? 'กำลังคัดลอกโพยเป็นรูป...' : 'คัดลอกโพยเป็นรูป'}
              </button>
            </div>
          </div>
        </div>
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

        .recent-row strong {
          letter-spacing: -0.03em;
        }

        .recent-pending {
          border-left: 3px solid var(--warning);
        }

        .recent-won {
          border-left: 3px solid var(--success);
        }

        .recent-lost {
          border-left: 3px solid var(--danger);
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

        .recent-topline strong {
          font-size: 1.1rem;
        }

        .recent-meta {
          font-size: 0.84rem;
          line-height: 1.4;
        }

        .recent-slip-ref {
          font-size: 0.76rem;
        }

        .recent-right {
          min-width: 150px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: flex-end;
          text-align: right;
        }

        .recent-right strong {
          font-size: 1.05rem;
        }

        .recent-view-btn {
          align-self: flex-end;
        }

        .recent-slip-modal {
          max-width: 760px;
        }

        .recent-slip-meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .recent-slip-meta-card,
        .recent-slip-item {
          border: 1px solid var(--border);
          border-radius: 16px;
          background: rgba(255, 251, 251, 0.92);
        }

        .recent-slip-meta-card {
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .recent-slip-meta-card span,
        .recent-slip-item-values span {
          color: var(--text-muted);
          font-size: 0.8rem;
        }

        .recent-slip-items {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .recent-slip-footer {
          display: none;
        }

        .recent-slip-modal-actions {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-left: auto;
        }

        .recent-slip-item {
          padding: 12px;
          display: grid;
          grid-template-columns: 72px minmax(0, 1fr);
          gap: 12px;
        }

        .recent-slip-number {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          background: rgba(220, 38, 38, 0.08);
          color: var(--primary-dark);
          font-size: 1.6rem;
          font-weight: 800;
        }

        .recent-slip-item-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .recent-slip-item-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .recent-slip-item-values {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
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
          .dash-grid.agent-dash-overview {
            grid-template-columns: 1fr;
          }

          .recent-row,
          .panel-head {
            flex-direction: column;
            align-items: flex-start;
          }

          .recent-right {
            min-width: 0;
            width: 100%;
            text-align: left;
            align-items: flex-start;
          }

          .recent-view-btn {
            align-self: flex-start;
          }

          .recent-slip-meta-grid {
            grid-template-columns: 1fr;
          }

          .recent-slip-modal-actions {
            width: 100%;
            justify-content: space-between;
          }

          .recent-slip-item {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default AgentDashboard;
