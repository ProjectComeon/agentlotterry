import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiActivity,
  FiCalendar,
  FiClock,
  FiCopy,
  FiDollarSign,
  FiLayers,
  FiRefreshCw,
  FiRotateCcw
} from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { agentCopy } from '../../i18n/th/agent';
import { getBetResultLabel, getBetTypeLabel } from '../../i18n/th/labels';
import { cancelAgentBettingSlip, getAgentBets } from '../../services/api';
import { copySavedSlipImage } from '../../utils/slipImage';

const money = (value) => Number(value || 0).toLocaleString('th-TH');

const ui = {
  eyebrow: 'พื้นที่ติดตามโพย',
  title: 'รายการโพยที่ซื้อแทน',
  subtitle: 'รวมรายการที่อยู่ในเลขอ้างอิงเดียวกันไว้ในการ์ดเดียว เพื่อให้ดูโพยแต่ละใบง่ายขึ้นและจัดการได้จากจอเดียว',
  count: (value) => `${value} โพย`,
  roundLabel: 'งวดที่กำลังดู',
  allRounds: 'ทุกงวด',
  stakeLabel: 'ยอดแทงรวม',
  pendingLabel: 'โพยรอผล',
  wonLabel: 'ยอดถูกรวม',
  cancellableLabel: 'โพยที่ยกเลิกได้',
  filterTitle: 'กรองตามงวด',
  filterHint: 'เลือกงวดที่ต้องการก่อนดูโพย โดยระบบจะรวมรายการที่เป็นโพยเดียวกันให้อัตโนมัติ',
  clearFilter: 'ล้างงวด',
  loadError: 'โหลดรายการโพยไม่สำเร็จ',
  cancelSuccess: 'ยกเลิกโพยสำเร็จ',
  cancelError: 'ยกเลิกโพยไม่สำเร็จ',
  slipLabel: 'เลขอ้างอิง',
  slipItems: 'รายการในโพย',
  stake: 'ยอดแทง',
  won: 'ยอดถูก',
  totalStake: 'ยอดแทงรวมโพย',
  totalWon: 'ยอดถูกรวมโพย',
  marketRound: 'ตลาด / งวด',
  placedFor: 'ซื้อแทน',
  itemCount: (value) => `${value} รายการ`,
  cancelAction: 'ยกเลิกโพย',
  cancelling: 'กำลังยกเลิก...',
  copyImageAction: 'คัดลอกโพยเป็นรูป',
  copyingImageAction: 'กำลังคัดลอก...',
  copyImageSuccess: 'คัดลอกโพยเป็นรูปแล้ว',
  createImageSuccess: 'สร้างไฟล์รูปโพยแล้ว',
  copyImageError: 'คัดลอกโพยเป็นรูปไม่สำเร็จ',
  openFootnote: 'โพยนี้ยังเปิดอยู่และยกเลิกได้',
  closedFootnote: 'โพยนี้ปิดการยกเลิกแล้ว',
};

const buildSlipGroups = (bets) => {
  const grouped = new Map();

  bets.forEach((bet) => {
    const slipKey = bet.slipId || bet.slipNumber || `${bet.customerId?.id || bet.customerId?._id || bet.customerId?.name || 'member'}-${bet.roundDate}-${bet.marketId}-${bet.createdAt}`;
    const existing = grouped.get(slipKey);

    if (existing) {
      existing.items.push(bet);
      existing.totalStake += Number(bet.amount || 0);
      existing.totalWon += Number(bet.wonAmount || 0);
      existing.hasPending = existing.hasPending || (bet.result || 'pending') === 'pending';
      existing.hasWon = existing.hasWon || (bet.result || 'pending') === 'won' || Number(bet.wonAmount || 0) > 0;
      existing.createdAt = existing.createdAt > bet.createdAt ? existing.createdAt : bet.createdAt;
      return;
    }

    grouped.set(slipKey, {
      key: slipKey,
      slipId: bet.slipId || '',
      slipNumber: bet.slipNumber || '',
      customer: bet.customerId,
      marketName: bet.marketName || agentCopy.bets.defaultMarket,
      roundDate: bet.roundDate,
      createdAt: bet.createdAt,
      items: [bet],
      totalStake: Number(bet.amount || 0),
      totalWon: Number(bet.wonAmount || 0),
      hasPending: (bet.result || 'pending') === 'pending',
      hasWon: (bet.result || 'pending') === 'won' || Number(bet.wonAmount || 0) > 0
    });
  });

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      result: group.hasPending ? 'pending' : group.hasWon ? 'won' : 'lost',
      canCancel: group.hasPending && !!group.slipId,
      itemCount: group.items.length
    }))
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
};

const AgentBets = () => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roundDate, setRoundDate] = useState('');
  const [cancellingSlipId, setCancellingSlipId] = useState('');
  const [copyingSlipId, setCopyingSlipId] = useState('');

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

  const handleCopySlipImage = async (group) => {
    if (!group) return;
    const copyKey = group.slipId || group.key;
    setCopyingSlipId(copyKey);

    try {
      const result = await copySavedSlipImage({
        slip: {
          ...group,
          resultLabel: getBetResultLabel(group.result)
        },
        actorLabel: agentCopy.dashboard?.heroTitle || ui.title,
        resolveBetTypeLabel: getBetTypeLabel
      });
      toast.success(result.mode === 'clipboard' ? ui.copyImageSuccess : ui.createImageSuccess);
    } catch (error) {
      console.error(error);
      toast.error(error.message || ui.copyImageError);
    } finally {
      setCopyingSlipId('');
    }
  };

  const slipGroups = useMemo(() => buildSlipGroups(bets), [bets]);

  const summary = useMemo(() => ({
    totalStake: slipGroups.reduce((sum, group) => sum + Number(group.totalStake || 0), 0),
    pendingSlips: slipGroups.filter((group) => group.result === 'pending').length,
    totalWon: slipGroups.reduce((sum, group) => sum + Number(group.totalWon || 0), 0),
    cancellableSlips: slipGroups.filter((group) => group.canCancel).length,
  }), [slipGroups]);

  if (loading) return <PageSkeleton statCount={4} rows={4} sidebar={false} />;

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
          <small>{ui.count(slipGroups.length)}</small>
        </div>
      </section>

      <section className="ops-overview-grid ag-bets-overview">
        <article className="ops-overview-card">
          <span className="ops-icon-badge"><FiDollarSign /></span>
          <span>{ui.stakeLabel}</span>
          <strong>{money(summary.totalStake)}</strong>
          <small>{ui.count(slipGroups.length)}</small>
        </article>

        <article className="ops-overview-card">
          <span className="ops-icon-badge"><FiClock /></span>
          <span>{ui.pendingLabel}</span>
          <strong>{money(summary.pendingSlips)}</strong>
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
          <strong>{money(summary.cancellableSlips)}</strong>
          <small>ยกเลิกได้เฉพาะโพยที่ยังรอผล</small>
        </article>
      </section>

      <section className="card ops-section ag-bets-filter">
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
        {slipGroups.length === 0 ? (
          <div className="card ops-section">
            <div className="empty-state">
              <div className="empty-state-text">{agentCopy.bets.empty}</div>
            </div>
          </div>
        ) : slipGroups.map((group) => (
          <article key={group.key} className={`ag-bet-card ag-bet-card-${group.result}`}>
            <div className="ag-bet-card-top">
              <div className="ag-bet-card-heading">
                <div className="ag-bet-card-kicker">{ui.placedFor}</div>
                <strong>{group.customer?.name || agentCopy.bets.unknownMember}</strong>
                <div className="ag-bet-card-slip">{ui.slipLabel}: {group.slipNumber || group.slipId || '-'}</div>
              </div>

              <div className="ag-bet-card-top-right">
                <span className={`ag-bet-badge ag-bet-badge-${group.result}`}>
                  {getBetResultLabel(group.result)}
                </span>
                <small>{ui.itemCount(group.itemCount)}</small>
              </div>
            </div>

            <div className="ag-bet-summary-grid">
              <div className="ag-bet-meta-block">
                <span>{ui.marketRound}</span>
                <strong>{group.marketName} • {group.roundDate}</strong>
              </div>
              <div className="ag-bet-meta-block">
                <span>{ui.totalStake}</span>
                <strong>{money(group.totalStake)} บาท</strong>
              </div>
              <div className="ag-bet-meta-block">
                <span>{ui.totalWon}</span>
                <strong className={group.totalWon > 0 ? 'ag-bet-meta-positive' : ''}>
                  {group.totalWon > 0 ? `+${money(group.totalWon)} บาท` : '-'}
                </strong>
              </div>
            </div>

            <div className="ag-bet-items-board">
              {group.items.map((item) => (
                <div key={item._id} className="ag-bet-item-tile">
                  <div className="ag-bet-number-pill">{item.number}</div>
                  <div className="ag-bet-item-body">
                    <div className="ag-bet-item-head">
                      <strong>{getBetTypeLabel(item.betType)}</strong>
                      <span>x{item.payRate}</span>
                    </div>
                    <div className="ag-bet-item-values">
                      <div>
                        <span>{ui.stake}</span>
                        <strong>{money(item.amount)} บาท</strong>
                      </div>
                      <div>
                        <span>{ui.won}</span>
                        <strong className={(item.wonAmount || 0) > 0 ? 'ag-bet-meta-positive' : ''}>
                          {(item.wonAmount || 0) > 0 ? `+${money(item.wonAmount)} บาท` : '-'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="ag-bet-card-bottom">
              <div className="ag-bet-card-footnote">
                {group.canCancel ? ui.openFootnote : ui.closedFootnote}
              </div>

              <div className="ag-bet-card-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleCopySlipImage(group)}
                  disabled={copyingSlipId === (group.slipId || group.key)}
                >
                  <FiCopy />
                  {copyingSlipId === (group.slipId || group.key) ? ui.copyingImageAction : ui.copyImageAction}
                </button>

                {group.canCancel ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleCancelSlip(group.slipId)}
                    disabled={cancellingSlipId === group.slipId}
                  >
                    {cancellingSlipId === group.slipId ? <FiRefreshCw className="spin-animation" /> : <FiRotateCcw />}
                    {cancellingSlipId === group.slipId ? ui.cancelling : ui.cancelAction}
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
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

        .ag-bets-overview .ops-overview-card {
          min-height: 100%;
        }

        .ag-bets-filter {
          box-shadow: 0 16px 28px rgba(127, 29, 29, 0.08);
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
          box-shadow: 0 16px 28px rgba(127, 29, 29, 0.08);
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

        .ag-bet-card-top-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          color: var(--text-muted);
          font-size: 0.78rem;
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

        .ag-bet-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
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

        .ag-bet-meta-block span,
        .ag-bet-item-values span {
          color: var(--text-muted);
          font-size: 0.77rem;
          letter-spacing: 0.04em;
          font-weight: 700;
        }

        .ag-bet-meta-block strong {
          font-size: 0.98rem;
          line-height: 1.4;
        }

        .ag-bet-meta-positive {
          color: var(--success);
        }

        .ag-bet-items-board {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 12px;
        }

        .ag-bet-item-tile {
          display: grid;
          grid-template-columns: 84px minmax(0, 1fr);
          gap: 12px;
          padding: 12px;
          border-radius: 18px;
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.92);
        }

        .ag-bet-number-pill {
          min-height: 84px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(220, 38, 38, 0.08), rgba(254, 242, 242, 0.92));
          border: 1px solid rgba(220, 38, 38, 0.14);
          color: var(--primary-dark);
          font-size: clamp(1.5rem, 3vw, 2rem);
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .ag-bet-item-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-width: 0;
        }

        .ag-bet-item-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .ag-bet-item-head strong {
          font-size: 1rem;
        }

        .ag-bet-item-head span {
          color: var(--primary);
          font-weight: 700;
        }

        .ag-bet-item-values {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .ag-bet-item-values > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ag-bet-item-values strong {
          font-size: 0.96rem;
        }

        .ag-bet-card-bottom {
          padding-top: 12px;
          border-top: 1px solid var(--border-light);
          align-items: center;
        }

        .ag-bet-card-actions {
          display: inline-flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 10px;
        }

        @media (max-width: 920px) {
          .ag-bets-toolbar,
          .ag-bet-card-top,
          .ag-bet-card-bottom {
            flex-direction: column;
            align-items: stretch;
          }

          .ag-bet-card-top-right {
            align-items: flex-start;
          }

          .ag-bet-card-actions {
            justify-content: flex-start;
          }

          .ag-bets-hero .ops-hero-side {
            width: 100%;
            min-width: 0;
          }

          .ag-bets-toolbar-controls {
            width: 100%;
          }

          .ag-bets-toolbar-controls > * {
            flex: 1;
          }

          .ag-bet-summary-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .ag-bet-item-tile {
            grid-template-columns: 1fr;
          }

          .ag-bet-item-values {
            grid-template-columns: 1fr;
          }

          .ag-bets-date-field {
            width: 100%;
          }

          .ag-bets-toolbar-controls .btn {
            width: 100%;
            justify-content: center;
          }

          .ag-bet-card {
            padding: 16px;
          }

          .ag-bet-number-pill {
            min-height: 72px;
            font-size: clamp(1.35rem, 5vw, 1.8rem);
          }
        }
      `}</style>
    </div>
  );
};

export default AgentBets;
