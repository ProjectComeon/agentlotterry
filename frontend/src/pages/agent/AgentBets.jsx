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
  FiSearch,
  FiRotateCcw,
  FiXCircle
} from 'react-icons/fi';
import GroupedSlipSummary from '../../components/GroupedSlipSummary';
import PageSkeleton from '../../components/PageSkeleton';
import { cancelAgentBettingSlip, getAgentBets } from '../../services/api';
import {
  areBetHistoryQueryFiltersEqual,
  DEFAULT_BET_HISTORY_QUERY_FILTERS,
  normalizeBetHistoryQueryFilters
} from '../../utils/betHistoryQueryFilters';
import { formatMoney as money, formatNumber, formatRoundLabel } from '../../utils/formatters';
import {
  DEFAULT_PAGINATION_META,
  getPaginatedItems,
  getPaginatedMeta
} from '../../utils/paginatedResponse';
import { buildSlipDisplayGroups } from '../../utils/slipGrouping';
import { copySavedSlipImage } from '../../utils/slipImage';
const getCustomerId = (customer) => String(customer?.id || customer?._id || customer || '');

const ui = {
  openResultAction: 'เปิดผลรางวัลงวดนี้',
  eyebrow: 'พื้นที่ติดตามโพย',
  title: 'โพยที่ซื้อแทน',
  subtitle: 'รวมรายการที่อยู่ในเลขอ้างอิงเดียวกันไว้ในการ์ดเดียว และแสดงผลแบบเดียวกับรีวิวโพยก่อนส่งรายการซื้อ',
  count: (value) => `${value} โพย`,
  roundLabel: 'งวดที่กำลังดู',
  allRounds: 'ทุกงวด',
  stakeLabel: 'ยอดแทงรวม',
  pendingLabel: 'โพยรอผล',
  wonLabel: 'ยอดถูกรวม',
  memberCountLabel: 'สมาชิกที่ซื้อแทน',
  totalWonHint: 'รวมยอดที่ถูกรางวัลแล้ว',
  memberCountHint: 'จำนวนสมาชิกที่มีโพยตามตัวกรองนี้',
  clearFilter: 'ล้างงวด',
  memberFilter: 'กำลังดูประวัติย้อนหลัง',
  clearMemberFilter: 'ดูทุกสมาชิก',
  searchPlaceholder: 'ค้นหาสมาชิก เลขโพย ตลาด งวด หรือเลขที่แทง',
  clearSearch: 'ล้างคำค้น',
  sortPlaceholder: 'เรียงตาม',
  latestSort: 'ล่าสุด',
  highestStakeSort: 'ยอดเยอะที่สุด',
  lowestStakeSort: 'ยอดต่ำที่สุด',
  resultPlaceholder: 'สถานะโพย',
  allResults: 'ทุกสถานะ',
  pendingOnly: 'รอผล',
  wonOnly: 'ถูกรางวัล',
  lostOnly: 'ไม่ถูกรางวัล',
  loadError: 'โหลดรายการโพยไม่สำเร็จ',
  slipLabel: 'เลขอ้างอิง',
  totalStake: 'ยอดแทงรวมโพย',
  totalWon: 'ยอดถูกรวมโพย',
  marketRound: 'ตลาด / งวด',
  placedFor: 'ซื้อแทน',
  itemCount: (value) => `${value} รายการ`,
  copyImageAction: 'คัดลอกโพยเป็นรูป',
  copyingImageAction: 'กำลังคัดลอก...',
  copyImageSuccess: 'คัดลอกโพยเป็นรูปแล้ว',
  createImageSuccess: 'สร้างไฟล์รูปโพยแล้ว',
  copyImageError: 'คัดลอกโพยเป็นรูปไม่สำเร็จ',
  openFootnote: 'โพยนี้ยังรอผลอยู่',
  closedFootnote: 'โพยนี้ปิดการยกเลิกแล้ว',
  empty: 'ยังไม่มีข้อมูลโพยในงวดที่เลือก',
  unknownMember: 'ไม่ระบุสมาชิก',
  defaultMarket: 'ตลาดหวย',
  statusWon: 'ถูกรางวัล',
  memoLabel: 'บันทึกช่วยจำ'
};

Object.assign(ui, {
  cancelAction: 'ยกเลิกโพย',
  cancellingAction: 'กำลังยกเลิก...',
  cancelConfirm: 'ต้องการยกเลิกโพยนี้ใช่หรือไม่',
  cancelSuccess: 'ยกเลิกโพยแล้ว',
  cancelError: 'ยกเลิกโพยไม่สำเร็จ'
});

const filterActionsCopy = {
  apply: 'ใช้ตัวกรอง',
  clear: 'ล้างตัวกรอง',
  pending: 'มีตัวกรองที่ยังไม่ได้ใช้',
  loadedCount: (loaded, total) => `แสดง ${loaded} / ${total} โพย`,
  loadMore: 'โหลดเพิ่ม',
  loadingMore: 'กำลังโหลด...'
};

const BETS_PAGE_LIMIT = 18;

const groupBetsBySlip = (bets = []) => {
  const grouped = new Map();

  bets.forEach((bet) => {
    const slipKey =
      bet.slipId ||
      bet.slipNumber ||
      `${bet.customerId?.id || bet.customerId?._id || bet.customerId?.name || 'member'}-${bet.roundDate}-${bet.marketId}-${bet.createdAt}`;

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

const AgentBets = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bets, setBets] = useState([]);
  const [betPagination, setBetPagination] = useState(DEFAULT_PAGINATION_META);
  const [loading, setLoading] = useState(true);
  const [loadingMoreBets, setLoadingMoreBets] = useState(false);
  const [draftQueryFilters, setDraftQueryFilters] = useState(() => ({ ...DEFAULT_BET_HISTORY_QUERY_FILTERS }));
  const [appliedQueryFilters, setAppliedQueryFilters] = useState(() => ({ ...DEFAULT_BET_HISTORY_QUERY_FILTERS }));
  const [copyingSlipId, setCopyingSlipId] = useState('');
  const [cancellingSlipId, setCancellingSlipId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const memberId = searchParams.get('memberId') || '';
  const memberName = searchParams.get('memberName') || '';

  const load = async ({
    page = 1,
    append = false,
    force = false
  } = {}) => {
    if (!append) setLoading(true);
    try {
      const params = {
        paginated: '1',
        page,
        limit: BETS_PAGE_LIMIT
      };
      if (appliedQueryFilters.roundDate) params.roundDate = appliedQueryFilters.roundDate;
      if (memberId) params.customerId = memberId;
      const response = await getAgentBets(params, { force });
      const nextItems = getPaginatedItems(response.data);
      setBets((current) => append ? [...current, ...nextItems] : nextItems);
      setBetPagination(getPaginatedMeta(response.data));
    } catch (error) {
      console.error(error);
      toast.error(ui.loadError);
    } finally {
      if (!append) setLoading(false);
    }
  };

  useEffect(() => {
    load({ page: 1 });
  }, [memberId, appliedQueryFilters.roundDate]);

  const hasPendingQueryChanges = useMemo(
    () => !areBetHistoryQueryFiltersEqual(draftQueryFilters, appliedQueryFilters),
    [appliedQueryFilters, draftQueryFilters]
  );

  const hasAppliedQueryFilters = useMemo(
    () => Boolean(appliedQueryFilters.roundDate),
    [appliedQueryFilters.roundDate]
  );

  const applyQueryFilters = () => {
    const nextFilters = normalizeBetHistoryQueryFilters(draftQueryFilters);
    if (areBetHistoryQueryFiltersEqual(nextFilters, appliedQueryFilters)) {
      return;
    }

    setLoading(true);
    setAppliedQueryFilters(nextFilters);
  };

  const clearQueryFilters = () => {
    if (!hasPendingQueryChanges && !hasAppliedQueryFilters) {
      return;
    }

    const nextFilters = { ...DEFAULT_BET_HISTORY_QUERY_FILTERS };
    setDraftQueryFilters(nextFilters);
    if (hasAppliedQueryFilters) {
      setLoading(true);
    }
    setAppliedQueryFilters(nextFilters);
  };

  const loadMoreBets = async () => {
    if (!betPagination.hasNextPage || loadingMoreBets) return;

    setLoadingMoreBets(true);
    try {
      await load({
        page: betPagination.page + 1,
        append: true
      });
    } finally {
      setLoadingMoreBets(false);
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
          totalAmount: group.totalStake,
          totalPotentialPayout: group.totalPotentialPayout,
          roundLabel: `${group.marketName || '-'} • ${formatRoundLabel(group.roundLabel || group.roundDate || '-')}`,
          resultLabel:
            group.result === 'won' ? ui.statusWon : group.result === 'pending' ? 'รอผล' : 'ไม่ถูกรางวัล'
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

  const handleOpenRoundResult = (group) => {
    const params = new URLSearchParams();
    if (group?.marketId) params.set('marketId', group.marketId);
    if (group?.marketName) params.set('marketName', group.marketName);
    if (group?.roundDate) params.set('roundCode', group.roundDate);
    navigate(`/agent/lottery${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleCancelSlip = async (group) => {
    if (!group?.slipId || !group.canCancel) return;
    if (!window.confirm(ui.cancelConfirm)) return;

    setCancellingSlipId(group.slipId);
    try {
      await cancelAgentBettingSlip(group.slipId);
      toast.success(ui.cancelSuccess);
      await load({ page: 1, force: true });
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || ui.cancelError);
    } finally {
      setCancellingSlipId('');
    }
  };

  const slipGroups = useMemo(() => groupBetsBySlip(bets), [bets]);
  const visibleSlipGroups = useMemo(() => {
    if (!memberId) return slipGroups;
    return slipGroups.filter((group) => getCustomerId(group.customer) === memberId);
  }, [memberId, slipGroups]);
  const activeMemberName = useMemo(
    () => visibleSlipGroups[0]?.customer?.name || memberName,
    [memberName, visibleSlipGroups]
  );
  const searchedSlipGroups = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return visibleSlipGroups;

    return visibleSlipGroups.filter((group) => {
      const searchable = [
        group.customer?.name,
        group.customer?.username,
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
  }, [searchTerm, visibleSlipGroups]);
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
          <span>{memberId ? ui.memberFilter : ui.roundLabel}</span>
          <strong>{memberId ? activeMemberName || memberId : appliedQueryFilters.roundDate ? formatRoundLabel(appliedQueryFilters.roundDate) : ui.allRounds}</strong>
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
          <strong>{money(summary.pendingSlips)}</strong>
          <small>ยังไม่ประกาศผล</small>
        </article>

        <article className="ops-overview-card">
          <span className="ops-icon-badge"><FiActivity /></span>
          <span>{ui.wonLabel}</span>
          <strong>{money(summary.totalWon)}</strong>
          <small>{ui.totalWonHint}</small>
        </article>

        <article className="ops-overview-card">
          <span className="ops-icon-badge"><FiLayers /></span>
          <span>{ui.memberCountLabel}</span>
          <strong>{money(summary.memberCount)}</strong>
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
                value={draftQueryFilters.roundDate}
                onChange={(event) => setDraftQueryFilters((current) => ({
                  ...current,
                  roundDate: event.target.value
                }))}
              />
            </label>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearQueryFilters}
              disabled={!hasPendingQueryChanges && !hasAppliedQueryFilters}
            >
              <FiRotateCcw />
              {filterActionsCopy.clear}
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={applyQueryFilters}
              disabled={!hasPendingQueryChanges}
            >
              {filterActionsCopy.apply}
            </button>
          </div>
        </div>
        {hasPendingQueryChanges ? <div className="ag-bets-filter-pending">{filterActionsCopy.pending}</div> : null}
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
                <span className={`ag-bet-badge ag-bet-badge-${group.result}`}>
                  {group.result === 'won' ? ui.statusWon : group.result === 'pending' ? 'รอผล' : 'ไม่ถูกรางวัล'}
                </span>
                <small>{ui.itemCount(group.itemCount)}</small>

                <div className="ag-bet-card-actions ag-bet-card-actions-top">
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

              <div className="ag-bet-card-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenRoundResult(group)}
                >
                  <FiExternalLink />
                  {ui.openResultAction}
                </button>

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
          </article>
        ))}
      </section>

      {displaySlipGroups.length > 0 ? (
        <section className="card ops-section ag-bets-pagination">
          <div>
            <div className="ag-bets-pagination-title">
              {filterActionsCopy.loadedCount(
                formatNumber(slipGroups.length),
                formatNumber(betPagination.total || slipGroups.length)
              )}
            </div>
            <div className="ag-bets-pagination-subtitle">{ui.subtitle}</div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadMoreBets}
            disabled={!betPagination.hasNextPage || loadingMoreBets}
          >
            {loadingMoreBets ? filterActionsCopy.loadingMore : filterActionsCopy.loadMore}
          </button>
        </section>
      ) : null}

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

        .ag-bets-filter-pending {
          margin-top: 12px;
          color: var(--primary);
          font-size: 0.92rem;
          font-weight: 700;
        }

        .ag-bets-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px;
        }

        .ag-bets-pagination-title {
          color: var(--text-primary);
          font-size: 0.95rem;
          font-weight: 800;
        }

        .ag-bets-pagination-subtitle {
          color: var(--text-muted);
          font-size: 0.82rem;
          margin-top: 4px;
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
          display: inline-flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 10px;
        }

        .ag-bet-card-top-right .ag-bet-card-actions {
          justify-content: flex-end;
        }

        .ag-bet-card-bottom .ag-bet-card-actions {
          display: none;
        }

        @media (max-width: 980px) {
          .ag-bets-toolbar,
          .ag-bets-pagination,
          .ag-bet-card-top,
          .ag-bet-card-bottom {
            flex-direction: column;
            align-items: stretch;
          }

          .ag-bet-card-top-right {
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

export default AgentBets;
