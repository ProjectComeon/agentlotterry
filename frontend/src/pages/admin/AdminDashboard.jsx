import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiActivity, FiDollarSign, FiEye, FiTrendingUp, FiUser, FiUsers } from 'react-icons/fi';
import GroupedSlipSummary from '../../components/GroupedSlipSummary';
import PageSkeleton from '../../components/PageSkeleton';
import SlipPreviewModal from '../../components/SlipPreviewModal';
import { adminCopy } from '../../i18n/th/admin';
import { getBetResultLabel, getBetTypeLabel } from '../../i18n/th/labels';
import { getAdminDashboard } from '../../services/api';
import { groupRecentBetsBySlip } from '../../utils/recentSlipGroups';
import { formatMoney as money } from '../../utils/formatters';
const copy = adminCopy.dashboard;

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [copyingSlipImage, setCopyingSlipImage] = useState(false);

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
  const groupedRecentBets = useMemo(
    () => groupRecentBetsBySlip(data?.recentBets || [], { defaultMarketName: copy.defaultMarket }),
    [data?.recentBets]
  );

  const statCards = useMemo(
    () => [
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
    ],
    [copy.statCards, netProfit, stats.activeAgents, stats.activeCustomers, stats.totalAgents, stats.totalCustomers, totalAmount]
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
        actorLabel: copy.heroTitle,
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
                <article key={bet.key} className={`recent-slip-card recent-slip-card-${bet.result || 'pending'}`}>
                  <div className="recent-slip-card-head">
                    <div className="recent-slip-card-copy">
                      <div className="recent-slip-kicker">เลขอ้างอิง: {bet.slipNumber || bet.slipId || '-'}</div>
                      <strong>{bet.customer?.name || copy.unknownName}</strong>
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
              ))}
            </div>
          ) : (
            <div className="empty-state"><div className="empty-state-text">{copy.noRecentBets}</div></div>
          )}
        </section>
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
          actorLabel="ผู้ดูแล"
          unknownMember={copy.unknownName}
        />
      ) : null}

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
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;

