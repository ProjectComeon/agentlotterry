import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiActivity, FiCalendar, FiClock, FiDollarSign, FiLayers, FiRefreshCw, FiRotateCcw } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { agentCopy } from '../../i18n/th/agent';
import { getBetResultLabel, getBetTypeLabel } from '../../i18n/th/labels';
import { cancelAgentBettingSlip, getAgentBets } from '../../services/api';

const money = (value) => Number(value || 0).toLocaleString('th-TH');

const ui = {
  eyebrow: 'พื้นที่ติดตามโพย',
  title: 'รายการโพยที่ซื้อแทน',
  subtitle: 'ตรวจสอบโพยที่เอเย่นต์ส่งแทนสมาชิก ดูสถานะรายการ และยกเลิกโพยที่ยังเปิดอยู่จากหน้าทำงานเดียว',
  count: (value) => `${value} รายการ`,
  roundLabel: 'งวดที่กำลังดู',
  allRounds: 'ทุกงวด',
  stakeLabel: 'ยอดแทงรวม',
  pendingLabel: 'รายการรอผล',
  wonLabel: 'ยอดถูกแล้ว',
  cancellableLabel: 'โพยที่ยกเลิกได้',
  filterTitle: 'กรองตามงวด',
  filterHint: 'เลือกงวดที่ต้องการตรวจสอบก่อนดูโพยรายรายการ',
  clearFilter: 'ล้างงวด',
  loadError: 'โหลดรายการโพยไม่สำเร็จ',
  cancelSuccess: 'ยกเลิกโพยสำเร็จ',
  cancelError: 'ยกเลิกโพยไม่สำเร็จ',
  slipLabel: 'เลขอ้างอิง',
  stake: 'ยอดแทง',
  won: 'ยอดถูก',
  placedFor: 'ซื้อแทน',
  cancelAction: 'ยกเลิกโพย',
  cancelling: 'กำลังยกเลิก...',
};

const AgentBets = () => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roundDate, setRoundDate] = useState('');
  const [cancellingSlipId, setCancellingSlipId] = useState('');

  useEffect(() => {
    load();
  }, [roundDate]);

  const load = async () => {
    try {
      const params = {};
      if (roundDate) params.roundDate = roundDate;
      const res = await getAgentBets(params);
      setBets(res.data || []);
    } catch (error) {
      console.error(error);
      toast.error(ui.loadError);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSlip = async (slipId) => {
    if (!slipId) return;
    setCancellingSlipId(slipId);

    try {
      await cancelAgentBettingSlip(slipId);
      toast.success(ui.cancelSuccess);
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || ui.cancelError);
    } finally {
      setCancellingSlipId('');
    }
  };

  const summary = useMemo(() => ({
    totalStake: bets.reduce((sum, bet) => sum + Number(bet.amount || 0), 0),
    pendingItems: bets.filter((bet) => (bet.result || 'pending') === 'pending').length,
    totalWon: bets.reduce((sum, bet) => sum + Number(bet.wonAmount || 0), 0),
    cancellableItems: bets.filter((bet) => (bet.result || 'pending') === 'pending' && bet.slipId).length,
  }), [bets]);

  if (loading) return <PageSkeleton statCount={4} rows={5} sidebar={false} />;

  return (
    <div className="ops-page ag-bets-page animate-fade-in">
      <section className="ops-hero ag-bets-hero">
        <div className="ops-hero-copy">
          <span className="ui-eyebrow">{ui.eyebrow}</span>
          <h1 className="page-title">{ui.title}</h1>
          <p className="page-subtitle">{ui.subtitle}</p>
        </div>

        <div className="ops-hero-side">
          <span>{ui.roundLabel}</span>
          <strong>{roundDate || ui.allRounds}</strong>
          <small>{ui.count(bets.length)}</small>
        </div>
      </section>

      <section className="ops-overview-grid">
        <article className="ops-overview-card">
          <span className="ops-icon-badge"><FiDollarSign /></span>
          <span>{ui.stakeLabel}</span>
          <strong>{money(summary.totalStake)}</strong>
          <small>{ui.count(bets.length)}</small>
        </article>

        <article className="ops-overview-card">
          <span className="ops-icon-badge"><FiClock /></span>
          <span>{ui.pendingLabel}</span>
          <strong>{money(summary.pendingItems)}</strong>
          <small>ยังไม่ประกาศผล</small>
        </article>

        <article className="ops-overview-card">
          <span className="ops-icon-badge"><FiActivity /></span>
          <span>{ui.wonLabel}</span>
          <strong>{money(summary.totalWon)}</strong>
          <small>รวมยอดที่ถูกรางวัลแล้ว</small>
        </article>

        <article className="ops-overview-card">
          <span className="ops-icon-badge"><FiLayers /></span>
          <span>{ui.cancellableLabel}</span>
          <strong>{money(summary.cancellableItems)}</strong>
          <small>ยกเลิกได้เฉพาะโพยที่ยังรอผล</small>
        </article>
      </section>

      <section className="card ops-section">
        <div className="ops-toolbar ag-bets-toolbar">
          <div>
            <div className="ui-eyebrow">{ui.filterTitle}</div>
            <div className="ops-table-note">{ui.filterHint}</div>
          </div>

          <div className="ag-bets-toolbar-controls">
            <label className="ag-bets-date-field">
              <FiCalendar />
              <input
                type="date"
                className="form-input"
                value={roundDate}
                onChange={(event) => setRoundDate(event.target.value)}
              />
            </label>

            {roundDate ? (
              <button type="button" className="btn btn-secondary" onClick={() => setRoundDate('')}>
                <FiRotateCcw />
                {ui.clearFilter}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="ag-bets-list">
        {bets.length === 0 ? (
          <div className="card ops-section">
            <div className="empty-state">
              <div className="empty-state-text">{agentCopy.bets.empty}</div>
            </div>
          </div>
        ) : bets.map((bet) => {
          const canCancel = (bet.result || 'pending') === 'pending' && !!bet.slipId;

          return (
            <article key={bet._id} className={`ag-bet-card ag-bet-card-${bet.result || 'pending'}`}>
              <div className="ag-bet-card-top">
                <div className="ag-bet-card-heading">
                  <div className="ag-bet-card-kicker">{ui.placedFor}</div>
                  <strong>{bet.customerId?.name || agentCopy.bets.unknownMember}</strong>
                  <div className="ag-bet-card-slip">{ui.slipLabel}: {bet.slipNumber || bet.slipId || '-'}</div>
                </div>

                <span className={`ag-bet-badge ag-bet-badge-${bet.result || 'pending'}`}>
                  {getBetResultLabel(bet.result || 'pending')}
                </span>
              </div>

              <div className="ag-bet-card-main">
                <div className="ag-bet-number-pill">{bet.number}</div>

                <div className="ag-bet-meta-grid">
                  <div className="ag-bet-meta-block">
                    <span>{getBetTypeLabel(bet.betType)}</span>
                    <strong>x{bet.payRate}</strong>
                  </div>
                  <div className="ag-bet-meta-block">
                    <span>ตลาด / งวด</span>
                    <strong>{bet.marketName || agentCopy.bets.defaultMarket} • {bet.roundDate}</strong>
                  </div>
                  <div className="ag-bet-meta-block">
                    <span>{ui.stake}</span>
                    <strong>{money(bet.amount)} บาท</strong>
                  </div>
                  <div className="ag-bet-meta-block">
                    <span>{ui.won}</span>
                    <strong className={(bet.wonAmount || 0) > 0 ? 'ag-bet-meta-positive' : ''}>
                      {(bet.wonAmount || 0) > 0 ? `+${money(bet.wonAmount)}` : '-'} {(bet.wonAmount || 0) > 0 ? 'บาท' : ''}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="ag-bet-card-bottom">
                <div className="ag-bet-card-footnote">
                  {canCancel ? 'โพยนี้ยังเปิดอยู่และยกเลิกได้' : 'โพยนี้ปิดการยกเลิกแล้ว'}
                </div>

                {canCancel ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleCancelSlip(bet.slipId)}
                    disabled={cancellingSlipId === bet.slipId}
                  >
                    {cancellingSlipId === bet.slipId ? <FiRefreshCw className="spin-animation" /> : <FiRotateCcw />}
                    {cancellingSlipId === bet.slipId ? ui.cancelling : ui.cancelAction}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      <style>{`
        .ag-bets-page,
        .ag-bets-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ag-bets-hero .ops-hero-side strong {
          font-size: clamp(1.5rem, 3vw, 2.1rem);
        }

        .ag-bets-toolbar {
          justify-content: space-between;
        }

        .ag-bets-toolbar-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }

        .ag-bets-date-field {
          min-width: 220px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--bg-input);
          color: var(--text-muted);
        }

        .ag-bets-date-field .form-input {
          border: none;
          background: transparent;
          box-shadow: none;
          min-height: 46px;
          padding: 0;
        }

        .ag-bets-date-field .form-input:focus {
          box-shadow: none;
        }

        .ag-bet-card {
          border-radius: 22px;
          border: 1px solid var(--border);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 247, 247, 0.98));
          box-shadow: var(--shadow-sm);
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .ag-bet-card:hover {
          transform: translateY(-2px);
          border-color: var(--border-accent);
          box-shadow: var(--shadow-md);
        }

        .ag-bet-card-pending {
          border-left: 4px solid var(--warning);
        }

        .ag-bet-card-won {
          border-left: 4px solid var(--success);
        }

        .ag-bet-card-lost {
          border-left: 4px solid var(--danger);
        }

        .ag-bet-card-top,
        .ag-bet-card-bottom {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .ag-bet-card-heading {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ag-bet-card-kicker,
        .ag-bet-card-slip,
        .ag-bet-card-footnote {
          color: var(--text-muted);
          font-size: 0.78rem;
        }

        .ag-bet-card-heading strong {
          font-size: 1.08rem;
          letter-spacing: -0.02em;
        }

        .ag-bet-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .ag-bet-badge-pending {
          background: rgba(245, 158, 11, 0.14);
          color: #b45309;
        }

        .ag-bet-badge-won {
          background: rgba(16, 185, 129, 0.14);
          color: #047857;
        }

        .ag-bet-badge-lost {
          background: rgba(220, 38, 38, 0.12);
          color: var(--danger);
        }

        .ag-bet-card-main {
          display: grid;
          grid-template-columns: 120px minmax(0, 1fr);
          gap: 16px;
          align-items: stretch;
        }

        .ag-bet-number-pill {
          min-height: 112px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(220, 38, 38, 0.08), rgba(254, 242, 242, 0.92));
          border: 1px solid rgba(220, 38, 38, 0.14);
          color: var(--primary-dark);
          font-size: clamp(1.8rem, 3vw, 2.4rem);
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .ag-bet-meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .ag-bet-meta-block {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 14px;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: rgba(255, 252, 252, 0.9);
        }

        .ag-bet-meta-block span {
          color: var(--text-muted);
          font-size: 0.77rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .ag-bet-meta-block strong {
          font-size: 0.98rem;
          line-height: 1.4;
        }

        .ag-bet-meta-positive {
          color: var(--success);
        }

        .ag-bet-card-bottom {
          padding-top: 12px;
          border-top: 1px solid var(--border-light);
          align-items: center;
        }

        @media (max-width: 920px) {
          .ag-bets-toolbar,
          .ag-bet-card-top,
          .ag-bet-card-bottom {
            flex-direction: column;
            align-items: stretch;
          }

          .ag-bets-toolbar-controls {
            width: 100%;
          }

          .ag-bets-toolbar-controls > * {
            flex: 1;
          }

          .ag-bet-card-main {
            grid-template-columns: 1fr;
          }

          .ag-bet-number-pill {
            min-height: 84px;
          }
        }

        @media (max-width: 720px) {
          .ag-bet-meta-grid {
            grid-template-columns: 1fr;
          }

          .ag-bets-date-field {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default AgentBets;
