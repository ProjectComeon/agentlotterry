import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FiActivity,
  FiCalendar,
  FiClock,
  FiCopy,
  FiDollarSign,
  FiExternalLink,
  FiLayers,
  FiRotateCcw,
  FiSearch,
  FiUsers,
  FiXCircle
} from 'react-icons/fi';
import GroupedSlipSummary from '../../components/GroupedSlipSummary';
import PageSkeleton from '../../components/PageSkeleton';
import { cancelAdminBettingSlip, getAdminBets, getAgents } from '../../services/api';
import { formatMoney as money, formatNumber, formatRoundLabel } from '../../utils/formatters';
import { buildSlipDisplayGroups } from '../../utils/slipGrouping';
import { copySavedSlipImage } from '../../utils/slipImage';

const getCustomerId = (customer) => String(customer?.id || customer?._id || customer || '');
const getAgentId = (agent) => String(agent?.id || agent?._id || agent || '');

const ui = {
  openResultAction: 'เปิดผลรางวัลงวดนี้',
  eyebrow: 'พื้นที่ติดตามโพย',
  title: 'โพยสมาชิก',
  subtitle: 'ดูรายการโพยย้อนหลังของสมาชิกทั้งระบบ กรองตามเจ้ามือผู้ดูแล และจัดการโพยที่ยังรอผลได้จากหน้าเดียว',
  count: (value) => `${value} โพย`,
  roundLabel: 'งวดที่กำลังดู',
  agentFilterLabel: 'เจ้ามือที่กำลังดู',
  allRounds: 'ทุกงวด',
  allAgents: 'ทุกเจ้ามือ',
  stakeLabel: 'ยอดแทงรวม',
  pendingLabel: 'โพยรอผล',
  wonLabel: 'ยอดถูกรวม',
  memberCountLabel: 'สมาชิกในผลลัพธ์',
  totalWonHint: 'รวมยอดที่ถูกรางวัลแล้ว',
  memberCountHint: 'จำนวนสมาชิกที่มีโพยตามตัวกรองนี้',
  clearRoundFilter: 'ล้างงวด',
  memberFilter: 'กำลังดูประวัติย้อนหลัง',
  clearMemberFilter: 'ดูทุกสมาชิก',
  searchPlaceholder: 'ค้นหาสมาชิก เลขโพย ตลาด งวด หรือเลขที่แทง',
  clearSearch: 'ล้างคำค้น',
  latestSort: 'ล่าสุด',
  highestStakeSort: 'ยอดเยอะที่สุด',
  lowestStakeSort: 'ยอดต่ำที่สุด',
  allResults: 'ทุกสถานะ',
  pendingOnly: 'รอผล',
  wonOnly: 'ถูกรางวัล',
  lostOnly: 'ไม่ถูกรางวัล',
  loadError: 'โหลดรายการโพยย้อนหลังไม่สำเร็จ',
  loadAgentError: 'โหลดรายชื่อเจ้ามือไม่สำเร็จ',
  slipLabel: 'เลขอ้างอิง',
  totalStake: 'ยอดแทงรวมโพย',
  totalWon: 'ยอดถูกรวมโพย',
  marketRound: 'ตลาด / งวด',
  placedFor: 'สมาชิก',
  itemCount: (value) => `${value} รายการ`,
  copyImageAction: 'คัดลอกโพยเป็นรูป',
  copyingImageAction: 'กำลังคัดลอก...',
  copyImageSuccess: 'คัดลอกโพยเป็นรูปแล้ว',
  createImageSuccess: 'สร้างไฟล์รูปโพยแล้ว',
  copyImageError: 'คัดลอกโพยเป็นรูปไม่สำเร็จ',
  cancelAction: 'ยกเลิกโพย',
  cancellingAction: 'กำลังยกเลิก...',
  cancelConfirm: 'ต้องการยกเลิกโพยนี้ใช่หรือไม่',
  cancelSuccess: 'ยกเลิกโพยแล้ว',
  cancelError: 'ยกเลิกโพยไม่สำเร็จ',
  openFootnote: 'โพยนี้ยังรอผลอยู่ • แอดมินยกเลิกโพยนี้ได้',
  closedFootnote: 'โพยนี้ปิดการติดตามผลแล้ว',
  empty: 'ยังไม่มีข้อมูลโพยในตัวกรองปัจจุบัน',
  unknownMember: 'ไม่ระบุสมาชิก',
  defaultMarket: 'ตลาดหวย',
  statusWon: 'ถูกรางวัล',
  pendingStatus: 'รอผล',
  lostStatus: 'ไม่ถูกรางวัล',
  noAgentSelected: 'ไม่กรองเจ้ามือ'
};

const groupBetsBySlip = (bets = []) => {
  const grouped = new Map();

  bets.forEach((bet) => {
    const slipKey =
      bet.slipId ||
      bet.slipNumber ||
      `${getCustomerId(bet.customerId)}-${bet.roundDate}-${bet.marketId}-${bet.createdAt}`;

    const current = grouped.get(slipKey);
    if (current) {
      current.items.push(bet);
      current.totalStake += Number(bet.amount || 0);
      current.totalWon += Number(bet.wonAmount || 0);
      current.totalPotentialPayout += Number(bet.potentialPayout || 0);
      current.memo = current.memo || bet.memo || '';
      current.hasPending = current.hasPending || (bet.result || 'pending') === 'pending';
      current.hasWon = current.hasWon || (bet.result || 'pending') === 'won' || Number(bet.wonAmount || 0) > 0;
      if (new Date(bet.createdAt || 0) > new Date(current.createdAt || 0)) {
        current.createdAt = bet.createdAt;
      }
      return;
    }

    grouped.set(slipKey, {
      key: slipKey,
      slipId: bet.slipId || '',
      slipNumber: bet.slipNumber || '',
      customer: bet.customerId,
      agent: bet.agentId,
      marketId: bet.marketId || '',
      marketName: bet.marketName || ui.defaultMarket,
      roundDate: bet.roundDate,
      roundLabel: formatRoundLabel(bet.roundTitle || bet.roundDate || '-'),
      createdAt: bet.createdAt,
      items: [bet],
      totalStake: Number(bet.amount || 0),
      totalWon: Number(bet.wonAmount || 0),
      totalPotentialPayout: Number(bet.potentialPayout || 0),
      memo: bet.memo || '',
      hasPending: (bet.result || 'pending') === 'pending',
      hasWon: (bet.result || 'pending') === 'won' || Number(bet.wonAmount || 0) > 0
    });
  });

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      displayGroups: buildSlipDisplayGroups(group.items),
      memo: group.memo || 'ไม่มีบันทึกช่วยจำ',
      result: group.hasPending ? 'pending' : group.hasWon ? 'won' : 'lost',
      canCancel: group.hasPending && Boolean(group.slipId),
      itemCount: group.items.length
    }))
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
};

const AdminBets = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bets, setBets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roundDate, setRoundDate] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [copyingSlipId, setCopyingSlipId] = useState('');
  const [cancellingSlipId, setCancellingSlipId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  const memberId = searchParams.get('memberId') || '';
  const memberName = searchParams.get('memberName') || '';

  const loadAgents = async () => {
    try {
      const response = await getAgents();
      setAgents(response.data || []);
    } catch (error) {
      console.error(error);
      toast.error(ui.loadAgentError);
    }
  };

  const loadBets = async () => {
    try {
      const params = {};
      if (roundDate) params.roundDate = roundDate;
      if (memberId) params.customerId = memberId;
      if (agentFilter) params.agentId = agentFilter;
      const response = await getAdminBets(params);
      setBets(response.data || []);
    } catch (error) {
      console.error(error);
      toast.error(ui.loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    setLoading(true);
    loadBets();
  }, [memberId, roundDate, agentFilter]);

  const handleCopySlipImage = async (group) => {
    if (!group) return;
    const copyKey = group.slipId || group.key;
    setCopyingSlipId(copyKey);

    try {
      const result = await copySavedSlipImage({
        slip: {
          ...group,
          totalAmount: group.totalStake,
          totalPotentialPayout: group.totalPotentialPayout,
          roundLabel: `${group.marketName || '-'} • ${formatRoundLabel(group.roundLabel || group.roundDate || '-')}`,
          resultLabel:
            group.result === 'won'
              ? ui.statusWon
              : group.result === 'pending'
                ? ui.pendingStatus
                : ui.lostStatus
        },
        actorLabel: ui.title
      });
      toast.success(result.mode === 'clipboard' ? ui.copyImageSuccess : ui.createImageSuccess);
    } catch (error) {
      console.error(error);
      toast.error(error.message || ui.copyImageError);
    } finally {
      setCopyingSlipId('');
    }
  };

  const handleCancelSlip = async (group) => {
    if (!group?.slipId || !group.canCancel) return;
    if (!window.confirm(ui.cancelConfirm)) return;

    setCancellingSlipId(group.slipId);
    try {
      await cancelAdminBettingSlip(group.slipId);
      toast.success(ui.cancelSuccess);
      await loadBets();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || ui.cancelError);
    } finally {
      setCancellingSlipId('');
    }
  };

  const handleOpenRoundResult = (group) => {
    const params = new URLSearchParams();
    if (group?.marketId) params.set('marketId', group.marketId);
    if (group?.marketName) params.set('marketName', group.marketName);
    if (group?.roundDate) params.set('roundCode', group.roundDate);
    navigate(`/admin/lottery${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const slipGroups = useMemo(() => groupBetsBySlip(bets), [bets]);
  const activeMemberName = useMemo(
    () => slipGroups[0]?.customer?.name || memberName,
    [memberName, slipGroups]
  );
  const selectedAgentName = useMemo(
    () => agents.find((agent) => String(agent._id) === agentFilter)?.name || '',
    [agentFilter, agents]
  );

  const searchedSlipGroups = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return slipGroups;

    return slipGroups.filter((group) => {
      const searchable = [
        group.customer?.name,
        group.customer?.username,
        group.agent?.name,
        group.agent?.username,
        group.slipNumber,
        group.slipId,
        group.marketName,
        group.roundDate,
        group.roundLabel,
        group.memo,
        ...(group.items || []).flatMap((item) => [item.number, item.betType])
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(keyword);
    });
  }, [searchTerm, slipGroups]);

  const filteredSlipGroups = useMemo(() => {
    if (!resultFilter) return searchedSlipGroups;
    return searchedSlipGroups.filter((group) => group.result === resultFilter);
  }, [resultFilter, searchedSlipGroups]);

  const displaySlipGroups = useMemo(() => {
    const groups = [...filteredSlipGroups];

    if (sortBy === 'stake_desc') {
      return groups.sort((left, right) => Number(right.totalStake || 0) - Number(left.totalStake || 0));
    }

    if (sortBy === 'stake_asc') {
      return groups.sort((left, right) => Number(left.totalStake || 0) - Number(right.totalStake || 0));
    }

    return groups.sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
  }, [filteredSlipGroups, sortBy]);

  const summary = useMemo(
    () => ({
      totalStake: filteredSlipGroups.reduce((sum, group) => sum + Number(group.totalStake || 0), 0),
      pendingSlips: filteredSlipGroups.filter((group) => group.result === 'pending').length,
      totalWon: filteredSlipGroups.reduce((sum, group) => sum + Number(group.totalWon || 0), 0),
      memberCount: new Set(filteredSlipGroups.map((group) => getCustomerId(group.customer)).filter(Boolean)).size
    }),
    [filteredSlipGroups]
  );

  const heroLabel = memberId
    ? ui.memberFilter
    : agentFilter
      ? ui.agentFilterLabel
      : ui.roundLabel;
  const heroValue = memberId
    ? activeMemberName || memberId
    : agentFilter
      ? selectedAgentName || ui.noAgentSelected
      : roundDate
        ? formatRoundLabel(roundDate)
        : ui.allRounds;

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
          <span>{heroLabel}</span>
          <strong>{heroValue}</strong>
          <small>{ui.count(displaySlipGroups.length)}</small>
        </div>
      </section>

      <section className="ops-overview-grid ag-bets-overview">
        <article className="ops-overview-card">
          <span className="ops-icon-badge"><FiDollarSign /></span>
          <span>{ui.stakeLabel}</span>
          <strong>{money(summary.totalStake)}</strong>
          <small>{ui.count(displaySlipGroups.length)}</small>
        </article>

        <article className="ops-overview-card">
          <span className="ops-icon-badge"><FiClock /></span>
          <span>{ui.pendingLabel}</span>
          <strong>{formatNumber(summary.pendingSlips)}</strong>
          <small>{ui.pendingOnly}</small>
        </article>

        <article className="ops-overview-card">
          <span className="ops-icon-badge"><FiActivity /></span>
          <span>{ui.wonLabel}</span>
          <strong>{money(summary.totalWon)}</strong>
          <small>{ui.totalWonHint}</small>
        </article>

        <article className="ops-overview-card">
          <span className="ops-icon-badge"><FiUsers /></span>
          <span>{ui.memberCountLabel}</span>
          <strong>{formatNumber(summary.memberCount)}</strong>
          <small>{ui.memberCountHint}</small>
        </article>
      </section>

      <section className="card ops-section ag-bets-filter">
        <div className="ops-toolbar ag-bets-toolbar">
          <div className="ag-bets-toolbar-controls">
            <label className="ag-bets-search-field">
              <FiSearch />
              <input
                type="search"
                className="form-input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={ui.searchPlaceholder}
              />
            </label>

            <label className="ag-bets-select-field">
              <FiUsers />
              <select
                className="form-input"
                value={agentFilter}
                onChange={(event) => setAgentFilter(event.target.value)}
              >
                <option value="">{ui.allAgents}</option>
                {agents.map((agent) => (
                  <option key={agent._id} value={agent._id}>{agent.name}</option>
                ))}
              </select>
            </label>

            <label className="ag-bets-select-field">
              <select
                className="form-input"
                value={resultFilter}
                onChange={(event) => setResultFilter(event.target.value)}
              >
                <option value="">{ui.allResults}</option>
                <option value="pending">{ui.pendingOnly}</option>
                <option value="won">{ui.wonOnly}</option>
                <option value="lost">{ui.lostOnly}</option>
              </select>
            </label>

            <label className="ag-bets-select-field">
              <select
                className="form-input"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="recent">{ui.latestSort}</option>
                <option value="stake_desc">{ui.highestStakeSort}</option>
                <option value="stake_asc">{ui.lowestStakeSort}</option>
              </select>
            </label>

            {memberId ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.delete('memberId');
                  nextParams.delete('memberName');
                  setSearchParams(nextParams);
                }}
              >
                <FiRotateCcw />
                {ui.clearMemberFilter}
              </button>
            ) : null}

            {searchTerm ? (
              <button type="button" className="btn btn-secondary" onClick={() => setSearchTerm('')}>
                <FiRotateCcw />
                {ui.clearSearch}
              </button>
            ) : null}

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
                {ui.clearRoundFilter}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="ag-bets-list">
        {displaySlipGroups.length === 0 ? (
          <div className="card ops-section">
            <div className="empty-state">
              <div className="empty-state-text">{ui.empty}</div>
            </div>
          </div>
        ) : displaySlipGroups.map((group) => (
          <article key={group.key} className={`ag-bet-card ag-bet-card-${group.result}`}>
            <div className="ag-bet-card-top">
              <div className="ag-bet-card-heading">
                <div className="ag-bet-card-kicker">{ui.placedFor}</div>
                <strong>{group.customer?.name || ui.unknownMember}</strong>
                <div className="ag-bet-card-slip">
                  {ui.slipLabel}: {group.slipNumber || group.slipId || '-'}
                </div>
              </div>

              <div className="ag-bet-card-top-right">
                <div className="ag-bet-card-status">
                  <span className={`ag-bet-badge ag-bet-badge-${group.result}`}>
                    {group.result === 'won' ? ui.statusWon : group.result === 'pending' ? ui.pendingStatus : ui.lostStatus}
                  </span>
                  <small>{ui.itemCount(group.itemCount)}</small>
                </div>

                <div className="ag-bet-card-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenRoundResult(group)}
                  >
                    <FiExternalLink />
                    {ui.openResultAction}
                  </button>
                  {group.canCancel ? (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleCancelSlip(group)}
                      disabled={cancellingSlipId === group.slipId}
                    >
                      <FiXCircle />
                      {cancellingSlipId === group.slipId ? ui.cancellingAction : ui.cancelAction}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopySlipImage(group)}
                    disabled={copyingSlipId === (group.slipId || group.key)}
                  >
                    <FiCopy />
                    {copyingSlipId === (group.slipId || group.key) ? ui.copyingImageAction : ui.copyImageAction}
                  </button>
                </div>
              </div>
            </div>

            <div className="ag-bet-info-strip">
              <div className="ag-bet-info-chip ag-bet-info-chip-wide">
                <span>{ui.marketRound}</span>
                <strong>{group.marketName} • {formatRoundLabel(group.roundLabel || group.roundDate || '-')}</strong>
              </div>
              <div className="ag-bet-info-chip">
                <span>{ui.totalStake}</span>
                <strong>{money(group.totalStake)} บาท</strong>
              </div>
              <div className="ag-bet-info-chip">
                <span>{ui.totalWon}</span>
                <strong className={group.totalWon > 0 ? 'ag-bet-meta-positive' : ''}>
                  {group.totalWon > 0 ? `+${money(group.totalWon)} บาท` : '-'}
                </strong>
              </div>
            </div>

            <GroupedSlipSummary slip={group} dense showMemo className="ag-bet-grouped-summary slip-grouped-compact" />

            <div className="ag-bet-card-bottom">
              <div className="ag-bet-card-footnote">
                {group.result === 'pending' ? ui.openFootnote : ui.closedFootnote}
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
          gap: 14px;
        }

        .ag-bets-hero .ops-hero-side strong {
          font-size: clamp(1.5rem, 3vw, 2.1rem);
        }

        .ag-bets-filter {
          box-shadow: 0 12px 24px rgba(127, 29, 29, 0.08);
        }

        .ag-bets-toolbar {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: nowrap;
        }

        .ag-bets-toolbar-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          justify-content: flex-end;
          flex: 1 1 auto;
        }

        .ag-bets-search-field,
        .ag-bets-select-field,
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

        .ag-bets-search-field {
          min-width: min(420px, 100%);
          flex: 1 1 320px;
        }

        .ag-bets-select-field {
          flex: 0 1 220px;
          padding-right: 10px;
        }

        .ag-bets-search-field .form-input,
        .ag-bets-select-field .form-input,
        .ag-bets-date-field .form-input {
          border: none;
          background: transparent;
          box-shadow: none;
          min-height: 46px;
          padding: 0;
        }

        .ag-bets-search-field .form-input:focus,
        .ag-bets-select-field .form-input:focus,
        .ag-bets-date-field .form-input:focus {
          box-shadow: none;
        }

        .ag-bets-select-field .form-input {
          width: 100%;
          cursor: pointer;
        }

        .ag-bet-card {
          border-radius: 20px;
          border: 1px solid var(--border);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 247, 247, 0.98));
          box-shadow: 0 12px 22px rgba(127, 29, 29, 0.07);
          padding: 7px 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
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
          gap: 6px;
        }

        .ag-bet-card-heading {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .ag-bet-card-kicker,
        .ag-bet-card-slip,
        .ag-bet-card-footnote {
          color: var(--text-muted);
          font-size: 0.78rem;
        }

        .ag-bet-card-heading strong {
          font-size: 0.96rem;
          letter-spacing: -0.02em;
        }

        .ag-bet-card-top-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          color: var(--text-muted);
          font-size: 0.78rem;
          max-width: min(100%, 720px);
        }

        .ag-bet-card-status {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
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

        .ag-bet-info-strip {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) repeat(2, minmax(0, 1fr));
          gap: 4px;
        }

        .ag-bet-info-chip {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          padding: 5px 7px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: rgba(255, 252, 252, 0.9);
        }

        .ag-bet-info-chip span {
          color: var(--text-muted);
          font-size: 0.74rem;
          font-weight: 700;
        }

        .ag-bet-info-chip strong {
          font-size: 0.92rem;
          line-height: 1.28;
        }

        .ag-bet-meta-positive {
          color: var(--success);
        }

        .ag-bet-grouped-summary .grouped-slip-note {
          margin-top: 4px;
        }

        .ag-bet-grouped-summary .operator-slip-group-list {
          gap: 6px;
        }

        .ag-bet-grouped-summary .operator-slip-group-card,
        .ag-bet-grouped-summary .operator-slip-group-card-dense {
          grid-template-columns: 74px minmax(0, 1fr);
          gap: 6px;
          padding: 6px 7px;
        }

        .ag-bet-grouped-summary .operator-slip-group-side {
          min-height: 46px;
          padding: 4px 3px;
        }

        .ag-bet-grouped-summary .operator-slip-family {
          font-size: 0.8rem;
        }

        .ag-bet-grouped-summary .operator-slip-combo,
        .ag-bet-grouped-summary .operator-slip-amount {
          font-size: 0.68rem;
        }

        .ag-bet-grouped-summary .operator-slip-numbers {
          min-height: 34px;
          padding: 7px 9px;
          font-size: 0.92rem;
        }

        .ag-bet-card-bottom {
          padding-top: 3px;
          border-top: 1px solid var(--border-light);
          align-items: center;
        }

        .ag-bet-card-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 10px;
        }

        @media (max-width: 980px) {
          .ag-bets-toolbar,
          .ag-bet-card-top,
          .ag-bet-card-bottom {
            flex-direction: column;
            align-items: stretch;
          }

          .ag-bet-card-top-right,
          .ag-bet-card-status {
            align-items: flex-start;
          }

          .ag-bet-info-strip {
            grid-template-columns: 1fr;
          }

          .ag-bet-card-actions {
            justify-content: flex-start;
          }
        }

        @media (max-width: 720px) {
          .ag-bets-search-field,
          .ag-bets-select-field,
          .ag-bets-date-field {
            width: 100%;
            min-width: 0;
          }

          .ag-bets-toolbar-controls .btn {
            width: 100%;
            justify-content: center;
          }

          .ag-bet-card {
            padding: 14px;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminBets;
