import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiAlertCircle,
  FiClock,
  FiCopy,
  FiLayers,
  FiPlus,
  FiRefreshCw,
  FiRotateCcw,
  FiSearch,
  FiSend,
  FiShuffle,
  FiStar,
  FiTrash2,
  FiUser,
  FiX
} from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { useAuth } from '../../context/AuthContext';
import { getBetTypeLabel, getRoundStatusLabel, getSourceFlagLabel, getUserStatusLabel } from '../../i18n/th/labels';
import {
  createAdminBettingSlip,
  createAgentBettingSlip,
  getAdminBettingMemberContext,
  getAdminRecentBettingItems,
  getAgentBettingMemberContext,
  getAgentRecentBettingItems,
  getCatalogRounds,
  parseAdminBettingSlip,
  parseAgentBettingSlip,
  searchAdminBettingMembers,
  searchAgentBettingMembers
} from '../../services/api';
import { copySlipPreviewImage } from '../../utils/slipImage';

const quickAmountOptions = ['10', '20', '50', '100'];
const hiddenRoundStatuses = new Set(['closed', 'resulted']);
const doubleSetCounts = {
  1: 10,
  2: 10,
  3: 270
};


const roleConfig = {
  agent: {
    title: 'ซื้อแทนสมาชิก',
    subtitle: 'ค้นหาสมาชิกแล้วส่งโพยแทนจากฝั่งเอเย่นต์ โดยใช้สิทธิ์ เรท และลิมิตของสมาชิกจริง',
    searchPlaceholder: 'ค้นหาด้วยชื่อ ชื่อผู้ใช้ เบอร์โทร รหัสสมาชิก หรือ UID',
    pickerTitle: 'เลือกสมาชิกก่อนทำรายการ',
    pickerNote: 'ระบบจะแสดงเฉพาะสมาชิกที่อยู่ใต้เอเย่นต์คนนี้',
    actorLabel: 'เอเย่นต์',
    search: searchAgentBettingMembers,
    getContext: getAgentBettingMemberContext,
    getRecentItems: getAgentRecentBettingItems,
    parseSlip: parseAgentBettingSlip,
    createSlip: createAgentBettingSlip
  },
  admin: {
    title: 'ซื้อแทนสมาชิกในระบบ',
    subtitle: 'ผู้ดูแลสามารถค้นหาและส่งโพยแทนสมาชิกทุกสายงานได้จากหน้าจอเดียว',
    searchPlaceholder: 'ค้นหาด้วยชื่อ ชื่อผู้ใช้ เบอร์โทร รหัสสมาชิก หรือ UID',
    pickerTitle: 'เลือกสมาชิกที่ต้องการซื้อแทน',
    pickerNote: 'ระบบจะแสดงสมาชิกทุกเอเย่นต์ที่ยังใช้งานอยู่',
    actorLabel: 'ผู้ดูแล',
    search: searchAdminBettingMembers,
    getContext: getAdminBettingMemberContext,
    getRecentItems: getAdminRecentBettingItems,
    parseSlip: parseAdminBettingSlip,
    createSlip: createAdminBettingSlip
  }
};

const digitModeOptions = [
  { value: '2', label: '2 ตัว / 3 ช่อง', columns: ['2top', '2bottom', '2tod'] },
  { value: '3', label: '3 ตัว / 3 ช่อง', columns: ['3top', '3bottom', '3tod'] }
];

const money = (value) => Number(value || 0).toLocaleString('th-TH');
const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('th-TH', {
      dateStyle: 'short',
      timeStyle: 'short'
    })
    : '-';
const flattenLotteries = (catalog) => (catalog?.leagues || []).flatMap((league) => (league.lotteries || []).map((lottery) => ({ ...lottery, leagueName: league.name })));
const buildEmptyGridRow = () => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, number: '', amounts: { top: '', bottom: '', tod: '' } });
const buildInitialGridRows = () => Array.from({ length: 6 }, buildEmptyGridRow);

const getFastDraftSummary = ({ rawInput, activeBetType, includeDoubleSet, reverse }) => {
  const lineCount = String(rawInput || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
  const digits = activeBetType?.startsWith('3') ? 3 : activeBetType?.startsWith('2') ? 2 : 1;
  return {
    lineCount,
    helperCount: includeDoubleSet ? doubleSetCounts[digits] || 0 : 0,
    reverseEnabled: Boolean(reverse)
  };
};

const getGridDraftSummary = (rows) => {
  const filledRows = rows.filter((row) => normalizeDigits(row.number)).length;
  const amountCells = rows.reduce((sum, row) => {
    const values = Object.values(row.amounts || {});
    return sum + values.filter((value) => Number(value || 0) > 0).length;
  }, 0);

  return {
    filledRows,
    amountCells
  };
};

const extractUniqueDigits = (numbers) => {
  const seen = new Set();
  const digits = [];

  (numbers || []).forEach((value) => {
    normalizeDigits(value)
      .split('')
      .filter(Boolean)
      .forEach((digit) => {
        if (!seen.has(digit)) {
          seen.add(digit);
          digits.push(digit);
        }
      });
  });

  return digits;
};

const extractFastLineNumbers = (rawInput) =>
  String(rawInput || '')
    .split(/\r?\n/)
    .map((line) => line.trim().match(/^(\d+)/)?.[1] || '')
    .filter(Boolean);

const buildFilledGridRows = (entries) => {
  const rows = entries.map((entry) => ({
    id: buildEmptyGridRow().id,
    number: entry.number || '',
    amounts: {
      top: entry.amounts?.top || '',
      bottom: entry.amounts?.bottom || '',
      tod: entry.amounts?.tod || ''
    }
  }));

  while (rows.length < 6) {
    rows.push(buildEmptyGridRow());
  }

  return rows;
};

const parseGridPasteLines = (text, digitMode) => {
  const digits = Number(digitMode || 2);

  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[\s,\t|/]+/).filter(Boolean);
      const number = normalizeDigits(parts[0] || '');

      if (!number || number.length !== digits) {
        return null;
      }

      return {
        number,
        amounts: {
          top: parts[1] || '',
          bottom: parts[2] || '',
          tod: parts[3] || ''
        }
      };
    })
    .filter(Boolean);
};

const groupRecentItemsBySlip = (items) => {
  const groups = new Map();

  (items || []).forEach((item) => {
    const key = item.slipId || item.slipNumber || item._id;
    const current = groups.get(key);

    if (current) {
      current.items.push(item);
      current.totalAmount += Number(item.amount || 0);
      return;
    }

    groups.set(key, {
      key,
      slipId: item.slipId || '',
      slipNumber: item.slipNumber || '-',
      createdAt: item.createdAt,
      totalAmount: Number(item.amount || 0),
      items: [item]
    });
  });

  return [...groups.values()].map((group) => ({
    ...group,
    itemCount: group.items.length
  }));
};

const buildReusableRecentSlipDraft = (items) => {
  if (!items?.length) return null;

  const betTypes = [...new Set(items.map((item) => item.betType))];

  if (betTypes.length === 1) {
    const betType = betTypes[0];
    const uniqueAmounts = [...new Set(items.map((item) => Number(item.amount || 0)))];
    return {
      mode: 'fast',
      betType,
      defaultAmount: uniqueAmounts.length === 1 ? String(uniqueAmounts[0]) : '',
      rawInput:
        uniqueAmounts.length === 1
          ? items.map((item) => item.number).join('\n')
          : items.map((item) => `${item.number} ${item.amount}`).join('\n')
    };
  }

  const isTwoDigitGrid = items.every((item) => ['2top', '2bottom', '2tod'].includes(item.betType));
  const isThreeDigitGrid = items.every((item) => ['3top', '3bottom', '3tod'].includes(item.betType));

  if (!isTwoDigitGrid && !isThreeDigitGrid) {
    return null;
  }

  const digitMode = isThreeDigitGrid ? '3' : '2';
  const map = new Map();

  items.forEach((item) => {
    const current = map.get(item.number) || {
      number: item.number,
      amounts: { top: '', bottom: '', tod: '' }
    };

    if (item.betType.endsWith('top')) current.amounts.top = String(item.amount || '');
    if (item.betType.endsWith('bottom')) current.amounts.bottom = String(item.amount || '');
    if (item.betType.endsWith('tod')) current.amounts.tod = String(item.amount || '');
    map.set(item.number, current);
  });

  return {
    mode: 'grid',
    digitMode,
    rows: buildFilledGridRows([...map.values()])
  };
};

const buildGridItems = ({ rows, digitMode }) => {
  const digits = Number(digitMode || 2);
  const items = [];
  const columnMap = digitMode === '3' ? { top: '3top', bottom: '3bottom', tod: '3tod' } : { top: '2top', bottom: '2bottom', tod: '2tod' };

  rows.forEach((row) => {
    const number = normalizeDigits(row.number);
    if (!number) return;
    if (number.length !== digits) throw new Error(`โหมด ${digitMode} ตัว ต้องกรอกหมายเลข ${digits} หลัก`);
    Object.entries(columnMap).forEach(([key, betType]) => {
      const amount = Number(row.amounts?.[key] || 0);
      if (amount > 0) items.push({ betType, number, amount });
    });
  });

  if (!items.length) throw new Error('กรุณากรอกหมายเลขและยอดอย่างน้อย 1 รายการ');
  return items;
};

const OperatorBetting = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = user?.role === 'admin' ? 'admin' : 'agent';
  const copy = roleConfig[role];

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selection, setSelection] = useState({ lotteryId: '', roundId: '', rateProfileId: '' });
  const [rounds, setRounds] = useState([]);
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [mode, setMode] = useState('fast');
  const [activeBetType, setActiveBetType] = useState('3top');
  const [digitMode, setDigitMode] = useState('2');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [reverse, setReverse] = useState(false);
  const [includeDoubleSet, setIncludeDoubleSet] = useState(false);
  const [gridRows, setGridRows] = useState(buildInitialGridRows);
  const [gridBulkAmounts, setGridBulkAmounts] = useState({ top: '', bottom: '', tod: '' });
  const [memo, setMemo] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [copyingImage, setCopyingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recentItems, setRecentItems] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [expandedRecentGroups, setExpandedRecentGroups] = useState({});
  const gridCellRefs = useRef({});
  const searchInputRef = useRef(null);
  const fastInputRef = useRef(null);

  const flatLotteries = useMemo(() => flattenLotteries(catalog), [catalog]);
  const selectedLottery = useMemo(() => flatLotteries.find((item) => item.id === selection.lotteryId) || null, [flatLotteries, selection.lotteryId]);
  const selectedRateProfile = useMemo(() => selectedLottery?.rateProfiles?.find((item) => item.id === selection.rateProfileId) || selectedLottery?.rateProfiles?.[0] || null, [selectedLottery, selection.rateProfileId]);
  const selectedRound = useMemo(() => rounds.find((item) => item.id === selection.roundId) || selectedLottery?.activeRound || null, [rounds, selection.roundId, selectedLottery]);
  const selectableRounds = useMemo(() => {
    const visible = rounds.filter((item) => !hiddenRoundStatuses.has(item.status));
    return visible.length ? visible : rounds;
  }, [rounds]);
  const gridColumns = useMemo(() => digitModeOptions.find((item) => item.value === digitMode)?.columns || [], [digitMode]);
  const roundClosedBetTypes = selectedRound?.closedBetTypes || [];
  const canSubmit = selectedRound?.status === 'open';
  const recentRoundCode = selectedRound?.code || '';
  const recentMarketId = selectedLottery?.code || selectedLottery?.id || '';
  const fastDraftSummary = useMemo(
    () => getFastDraftSummary({ rawInput, activeBetType, includeDoubleSet, reverse }),
    [activeBetType, includeDoubleSet, rawInput, reverse]
  );
  const gridDraftSummary = useMemo(() => getGridDraftSummary(gridRows), [gridRows]);
  const recentSlipGroups = useMemo(() => groupRecentItemsBySlip(recentItems), [recentItems]);

  const supportedGridColumns = useMemo(() => {
    const supported = new Set(selectedLottery?.supportedBetTypes || []);
    const closed = new Set(roundClosedBetTypes);
    return {
      top: supported.has(gridColumns[0]) && !closed.has(gridColumns[0]),
      bottom: supported.has(gridColumns[1]) && !closed.has(gridColumns[1]),
      tod: supported.has(gridColumns[2]) && !closed.has(gridColumns[2])
    };
  }, [gridColumns, roundClosedBetTypes, selectedLottery]);

  const fetchMemberContext = async (memberId, options = {}) => {
    const { silent = false } = options;
    if (!memberId) return;
    if (!silent) setCatalogLoading(true);
    try {
      const response = await copy.getContext(memberId);
      const nextCatalog = response.data.catalog;
      const nextMember = response.data.member;
      const defaults = nextCatalog?.selectionDefaults || {};
      const nextLotteries = flattenLotteries(nextCatalog);
      const nextLottery = nextLotteries.find((item) => item.id === defaults.lotteryId) || nextLotteries[0] || null;

      setSelectedMember(nextMember);
      setCatalog(nextCatalog);
      setSearchResults([]);
      setSelection({
        lotteryId: nextLottery?.id || '',
        roundId: nextLottery?.activeRound?.id || defaults.roundId || '',
        rateProfileId: nextLottery?.defaultRateProfileId || nextLottery?.rateProfiles?.[0]?.id || defaults.rateProfileId || ''
      });
      setPreview(null);
      setSearchParams({ memberId });
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'โหลดสิทธิ์การแทงของสมาชิกไม่สำเร็จ');
    } finally {
      if (!silent) setCatalogLoading(false);
    }
  };

  const fetchRecentItems = async ({ memberId, marketId, roundDate }) => {
    if (!memberId || !marketId) {
      setRecentItems([]);
      return;
    }

    setRecentLoading(true);
    try {
      const response = await copy.getRecentItems({
        customerId: memberId,
        marketId,
        roundDate,
        limit: 8
      });
      setRecentItems(response.data || []);
    } catch (error) {
      console.error(error);
      setRecentItems([]);
      toast.error(error.response?.data?.message || 'โหลดรายการโพยล่าสุดไม่สำเร็จ');
    } finally {
      setRecentLoading(false);
    }
  };

  const buildPayload = () => {
    const basePayload = { customerId: selectedMember?.id, lotteryId: selectedLottery?.id, roundId: selectedRound?.id, rateProfileId: selectedRateProfile?.id, memo };
    if (mode === 'grid') return { ...basePayload, items: buildGridItems({ rows: gridRows, digitMode }) };
    return { ...basePayload, betType: activeBetType, defaultAmount: Number(defaultAmount || 0), rawInput, reverse, includeDoubleSet };
  };

  const handlePreview = async () => {
    if (!selectedMember?.id) {
      toast.error('กรุณาเลือกสมาชิกก่อน');
      return null;
    }
    if (!selectedLottery?.id || !selectedRound?.id) {
      toast.error('กรุณาเลือกตลาดและงวดก่อน');
      return null;
    }

    setPreviewing(true);
    try {
      const response = await copy.parseSlip(buildPayload());
      setPreview(response.data);
      return response.data;
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'แยกรายการโพยไม่สำเร็จ');
      return null;
    } finally {
      setPreviewing(false);
    }
  };

  const handleSubmitSlip = async () => {
    const nextPreview = preview || await handlePreview();
    if (!nextPreview) return;
    setSubmitting(true);
    try {
      const response = await copy.createSlip({ ...buildPayload(), action: 'submit' });
      toast.success(`ส่งรายการซื้อ ${response.data.slipNumber} แล้ว`);
      setPreview(null);
      setDefaultAmount('');
      setRawInput('');
      setReverse(false);
      setIncludeDoubleSet(false);
      setGridRows(buildInitialGridRows);
      setGridBulkAmounts({ top: '', bottom: '', tod: '' });
      setMemo('');
      await fetchMemberContext(selectedMember.id, { silent: true });
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'สร้างโพยไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyAsImage = async () => {
    setCopyingImage(true);
    try {
      const nextPreview = preview || await handlePreview();
      if (!nextPreview) return;
      const result = await copySlipPreviewImage({
        preview: nextPreview,
        selectedMember,
        selectedLottery,
        selectedRound,
        selectedRateProfile,
        actorLabel: copy.actorLabel,
        operatorName: user?.name,
        resolveBetTypeLabel: getBetTypeLabel,
        resolveSourceLabel: getSourceFlagLabel
      });
      toast.success(result.mode === 'clipboard' ? 'คัดลอกโพยเป็นรูปภาพแล้ว' : 'อุปกรณ์นี้ยังคัดลอกรูปตรง ๆ ไม่ได้ ระบบจึงดาวน์โหลดรูปโพยให้แทน');
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'คัดลอกโพยเป็นรูปภาพไม่สำเร็จ');
    } finally {
      setCopyingImage(false);
    }
  };

  const clearComposer = () => {
    setPreview(null);
    setDefaultAmount('');
    setRawInput('');
    setReverse(false);
    setIncludeDoubleSet(false);
    setGridRows(buildInitialGridRows);
    setGridBulkAmounts({ top: '', bottom: '', tod: '' });
    setMemo('');
  };

  const clearSelectedMember = () => {
    setSelectedMember(null);
    setCatalog(null);
    setRounds([]);
    setSelection({ lotteryId: '', roundId: '', rateProfileId: '' });
    setPreview(null);
    setRecentItems([]);
    setSearchText('');
    setSearchResults([]);
    setSearchParams({});
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const applyRecentItem = (item) => {
    setMode('fast');
    setActiveBetType(item.betType);
    setDefaultAmount(String(item.amount || ''));
    setRawInput(String(item.number || ''));
    setReverse(false);
    setIncludeDoubleSet(false);
    setPreview(null);
    toast.success('ดึงรายการล่าสุดกลับมาไว้ในหน้าแทงแล้ว');
  };

  const applyRunHelper = (targetBetType) => {
    if (!selectedLottery?.supportedBetTypes?.includes(targetBetType)) {
      toast.error(`ตลาดนี้ยังไม่รองรับ ${getBetTypeLabel(targetBetType)}`);
      return;
    }

    if (roundClosedBetTypes.includes(targetBetType)) {
      toast.error(`${getBetTypeLabel(targetBetType)} ปิดรับในงวดนี้`);
      return;
    }

    const sourceNumbers =
      mode === 'grid'
        ? gridRows.map((row) => row.number)
        : extractFastLineNumbers(rawInput);
    const uniqueDigits = extractUniqueDigits(sourceNumbers);

    if (!uniqueDigits.length) {
      toast.error('กรุณากรอกเลขก่อนใช้ตัวช่วยวินเลข');
      return;
    }

    setMode('fast');
    setActiveBetType(targetBetType);
    setRawInput(uniqueDigits.join('\n'));
    setReverse(false);
    setIncludeDoubleSet(false);
    setPreview(null);
    toast.success(`แปลงเป็น${getBetTypeLabel(targetBetType)} ${uniqueDigits.length} รายการแล้ว`);
  };

  const applyRecentSlipGroup = (group) => {
    const draft = buildReusableRecentSlipDraft(group?.items || []);

    if (!draft) {
      toast.error('โพยนี้มีหลายประเภทเกินกว่าจะดึงกลับอัตโนมัติ ให้ใช้ซ้ำทีละรายการแทน');
      return;
    }

    setPreview(null);
    setReverse(false);
    setIncludeDoubleSet(false);

    if (draft.mode === 'fast') {
      setMode('fast');
      setActiveBetType(draft.betType);
      setDefaultAmount(draft.defaultAmount);
      setRawInput(draft.rawInput);
      setGridRows(buildInitialGridRows);
      setGridBulkAmounts({ top: '', bottom: '', tod: '' });
    } else {
      setMode('grid');
      setDigitMode(draft.digitMode);
      setGridRows(draft.rows);
      setGridBulkAmounts({ top: '', bottom: '', tod: '' });
      setDefaultAmount('');
      setRawInput('');
    }

    toast.success(`ดึงโพย ${group.slipNumber} กลับมาไว้ในหน้าแทงแล้ว`);
  };

  const enabledGridFieldOrder = [
    'number',
    ...(supportedGridColumns.top ? ['top'] : []),
    ...(supportedGridColumns.bottom ? ['bottom'] : []),
    ...(supportedGridColumns.tod ? ['tod'] : [])
  ];

  const setGridCellRef = (rowId, field) => (element) => {
    const key = `${rowId}:${field}`;
    if (element) {
      gridCellRefs.current[key] = element;
    } else {
      delete gridCellRefs.current[key];
    }
  };

  const focusGridCell = (rowId, field) => {
    const target = gridCellRefs.current[`${rowId}:${field}`];
    if (target) {
      target.focus();
      target.select?.();
    }
  };

  const focusNextGridField = (rowId, field) => {
    const rowIndex = gridRows.findIndex((row) => row.id === rowId);
    if (rowIndex < 0) return;

    const fieldIndex = enabledGridFieldOrder.indexOf(field);
    const nextField = enabledGridFieldOrder[fieldIndex + 1];
    if (nextField) {
      focusGridCell(rowId, nextField);
      return;
    }

    const nextRow = gridRows[rowIndex + 1];
    if (nextRow) {
      focusGridCell(nextRow.id, 'number');
      return;
    }

    const appendedRow = buildEmptyGridRow();
    setGridRows((current) => [...current, appendedRow]);
    window.requestAnimationFrame(() => focusGridCell(appendedRow.id, 'number'));
  };

  const handleGridKeyDown = (rowId, field, event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    focusNextGridField(rowId, field);
  };

  const handleGridNumberPaste = (rowId, event) => {
    const text = event.clipboardData?.getData('text') || '';
    if (!text.includes('\n')) return;

    const parsed = parseGridPasteLines(text, digitMode);
    if (!parsed.length) {
      toast.error('รูปแบบการวางต้องเป็น เลข ยอดบน ยอดล่าง ยอดโต๊ด แยกคนละบรรทัด');
      return;
    }

    event.preventDefault();

    let nextFocusRowId = '';

    setGridRows((current) => {
      const rowIndex = current.findIndex((row) => row.id === rowId);
      const nextRows = [...current];

      while (nextRows.length < rowIndex + parsed.length) {
        nextRows.push(buildEmptyGridRow());
      }

      parsed.forEach((entry, index) => {
        const targetRow = nextRows[rowIndex + index];
        nextRows[rowIndex + index] = {
          ...targetRow,
          number: entry.number,
          amounts: {
            top: entry.amounts.top || '',
            bottom: entry.amounts.bottom || '',
            tod: entry.amounts.tod || ''
          }
        };
      });

      nextFocusRowId = nextRows[rowIndex + parsed.length]?.id || '';

      return nextRows;
    });

    window.requestAnimationFrame(() => {
      if (nextFocusRowId) {
        focusGridCell(nextFocusRowId, 'number');
        return;
      }
      focusGridCell(rowId, enabledGridFieldOrder[enabledGridFieldOrder.length - 1] || 'number');
    });

    toast.success(`วางรายการตาราง ${parsed.length} แถวแล้ว`);
  };

  const toggleRecentSlipGroup = (groupKey) => {
    setExpandedRecentGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey]
    }));
  };

  const updateGridAmount = (rowId, key, value) => setGridRows((current) => current.map((row) => (row.id === rowId ? { ...row, amounts: { ...row.amounts, [key]: value } } : row)));
  const updateGridRow = (rowId, patch) => setGridRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  const removeGridRow = (rowId) => setGridRows((current) => (current.length <= 1 ? [buildEmptyGridRow()] : current.filter((row) => row.id !== rowId)));
  const applyGridBulkAmount = (columnKey) => {
    const nextValue = gridBulkAmounts[columnKey];
    if (!nextValue) {
      toast.error('กรุณากรอกยอดก่อนคัดลอกทั้งคอลัมน์');
      return;
    }
    setGridRows((current) => current.map((row) => (normalizeDigits(row.number) ? { ...row, amounts: { ...row.amounts, [columnKey]: nextValue } } : row)));
  };

  useEffect(() => {
    const memberId = searchParams.get('memberId');
    if (memberId) fetchMemberContext(memberId);
  }, []);

  useEffect(() => {
    if (!searchText.trim()) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await copy.search({ q: searchText.trim(), limit: 8 });
        setSearchResults(response.data || []);
      } catch (error) {
        console.error(error);
        toast.error(error.response?.data?.message || 'ค้นหาสมาชิกไม่สำเร็จ');
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [copy, searchText]);

  useEffect(() => {
    const loadRounds = async () => {
      if (!selectedLottery?.id) {
        setRounds([]);
        return;
      }
      setLoadingRounds(true);
      try {
        const response = await getCatalogRounds(selectedLottery.id);
        const nextRounds = response.data || [];
        setRounds(nextRounds);
        const visible = nextRounds.filter((round) => !hiddenRoundStatuses.has(round.status));
        const preferred = visible.length ? visible : nextRounds;
        if (preferred.length && !preferred.some((round) => round.id === selection.roundId)) {
          setSelection((current) => ({ ...current, roundId: preferred[0].id }));
        }
      } catch (error) {
        console.error(error);
        toast.error('โหลดงวดของตลาดที่เลือกไม่สำเร็จ');
      } finally {
        setLoadingRounds(false);
      }
    };
    loadRounds();
  }, [selectedLottery?.id]);

  useEffect(() => {
    if (!selectedLottery?.supportedBetTypes?.length) return;
    const available = selectedLottery.supportedBetTypes.filter((betType) => !roundClosedBetTypes.includes(betType));
    const nextTypes = available.length ? available : selectedLottery.supportedBetTypes;
    if (!nextTypes.includes(activeBetType)) setActiveBetType(nextTypes[0]);
  }, [activeBetType, roundClosedBetTypes, selectedLottery]);

  useEffect(() => {
    const desired = digitModeOptions.find((item) => item.value === digitMode)?.columns || [];
    const available = desired.filter((betType) => selectedLottery?.supportedBetTypes?.includes(betType) && !roundClosedBetTypes.includes(betType));
    if (!available.length && selectedLottery?.supportedBetTypes?.length) {
      const nextMode = selectedLottery.supportedBetTypes.some((betType) => ['3top', '3bottom', '3tod'].includes(betType) && !roundClosedBetTypes.includes(betType)) ? '3' : '2';
      if (nextMode !== digitMode) setDigitMode(nextMode);
    }
  }, [digitMode, roundClosedBetTypes, selectedLottery]);

  useEffect(() => {
    setPreview(null);
  }, [selectedMember?.id, selection.lotteryId, selection.roundId, selection.rateProfileId, mode, activeBetType, digitMode, defaultAmount, rawInput, reverse, includeDoubleSet, memo, gridRows]);

  useEffect(() => {
    if (!selectedMember?.id || !recentMarketId) {
      setRecentItems([]);
      return;
    }

    fetchRecentItems({
      memberId: selectedMember.id,
      marketId: recentMarketId,
      roundDate: recentRoundCode
    });
  }, [recentMarketId, recentRoundCode, selectedMember?.id]);

  useEffect(() => {
    if (!recentSlipGroups.length) {
      setExpandedRecentGroups({});
      return;
    }

    setExpandedRecentGroups((current) =>
      recentSlipGroups.reduce((next, group, index) => {
        next[group.key] = current[group.key] ?? index === 0;
        return next;
      }, {})
    );
  }, [recentSlipGroups]);

  useEffect(() => {
    if (!selectedMember?.id || catalogLoading) return;

    window.requestAnimationFrame(() => {
      if (mode === 'grid') {
        const firstRowId = gridRows[0]?.id;
        if (firstRowId) {
          focusGridCell(firstRowId, 'number');
        }
        return;
      }

      fastInputRef.current?.focus();
      fastInputRef.current?.select?.();
    });
  }, [catalogLoading, mode, selectedMember?.id]);

  if (catalogLoading && !selectedMember) return <PageSkeleton statCount={3} rows={5} sidebar compactSidebar />;

  return (
    <div className="ops-page operator-page animate-fade-in">
      <section className="card ops-section ops-hero operator-hero">
        <div className="ops-hero-copy operator-hero-copy">
          <div className="ui-eyebrow">{copy.actorLabel}</div>
          <h1 className="page-title">{copy.title}</h1>
          <p className="page-subtitle">{copy.subtitle}</p>
        </div>
      </section>

      <section className="operator-layout">
        <section className="card ops-section operator-member-panel">
          <div className="ui-eyebrow">ขั้นตอนแรก</div>
          <h3 className="card-title">{copy.pickerTitle}</h3>
          <p className="ops-table-note">{copy.pickerNote}</p>

          <div className="operator-search-block">
            <label className="form-label">ค้นหาสมาชิก</label>
            <div className="form-input operator-search-field">
              <FiSearch />
              <input ref={searchInputRef} className="operator-search-input" type="text" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={copy.searchPlaceholder} />
            </div>
          </div>

          {selectedMember ? (
            <div className="card operator-selected-member">
              <div className="operator-selected-member-head">
                <div className="operator-selected-avatar">{selectedMember.name?.charAt(0) || 'M'}</div>
                <div className="operator-selected-body">
                  <strong>{selectedMember.name}</strong>
                  <div className="ops-table-note" style={{ margin: '4px 0 0' }}>@{selectedMember.username}</div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={clearSelectedMember}><FiX /> ล้าง</button>
              </div>
              <div className="operator-selected-grid">
                <div className="card"><strong>UID</strong><div className="ops-table-note">{selectedMember.uid}</div></div>
                <div className="card" style={{ padding: 12 }}><strong>เครดิตคงเหลือ</strong><div className="ops-table-note">{money(selectedMember.creditBalance)} บาท</div></div>
                <div className="card" style={{ padding: 12 }}><strong>สถานะ</strong><div className="ops-table-note">{getUserStatusLabel(selectedMember.status)}</div></div>
                <div className="card" style={{ padding: 12 }}><strong>เบอร์โทร</strong><div className="ops-table-note">{selectedMember.phone || '-'}</div></div>
              </div>
            </div>
          ) : null}

          {searchText.trim() ? (
            <>

            <div className="operator-search-results">
              {searching ? <div className="card" style={{ padding: 14 }}>กำลังค้นหา...</div> : null}
              {!searching && !searchResults.length ? <div className="card" style={{ padding: 14 }}>ไม่พบสมาชิกตามคำค้นนี้</div> : null}
              {!searching && searchResults.map((member) => (
                <button key={member.id} type="button" className="card operator-search-result" onClick={() => fetchMemberContext(member.id)}>
                  <div>
                    <strong>{member.name}</strong>
                    <div className="ops-table-note">@{member.username}</div>
                    <div className="ops-table-note">UID {member.uid}</div>
                  </div>
                  <div className="operator-search-meta">
                    <strong>{money(member.creditBalance)} บาท</strong>
                    <div className="ops-table-note">{getUserStatusLabel(member.status)}</div>
                  </div>
                </button>
              ))}
            </div>
            </>
          ) : null}
        </section>

        <section className="operator-workspace">
          <section className="card ops-section operator-composer-panel">
            <div className="ui-eyebrow">หน้าส่งโพย</div>
            <h3 className="card-title">เลือกตลาดและกรอกรายการซื้อ</h3>
            <p className="ops-table-note">ทุกเรทและสิทธิ์อ้างอิงจากสมาชิกที่เลือกแบบเรียลไทม์</p>

            {!selectedMember ? (
              <div className="empty-state" style={{ marginTop: 20 }}>
                <div className="empty-state-icon"><FiUser /></div>
                <div className="empty-state-text">เลือกสมาชิกก่อน แล้วระบบจะโหลดตลาด เรท และงวดที่ซื้อได้ของคนนั้น</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
                  <div>
                    <label className="form-label">ตลาด</label>
                    <select className="form-select" value={selectedLottery?.id || ''} onChange={(event) => { const nextLottery = flatLotteries.find((item) => item.id === event.target.value); setSelection({ lotteryId: nextLottery?.id || '', roundId: nextLottery?.activeRound?.id || '', rateProfileId: nextLottery?.defaultRateProfileId || nextLottery?.rateProfiles?.[0]?.id || '' }); }}>
                      {flatLotteries.map((lottery) => <option key={lottery.id} value={lottery.id}>{lottery.leagueName} • {lottery.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">งวด</label>
                    <select className="form-select" value={selectedRound?.id || ''} onChange={(event) => setSelection((current) => ({ ...current, roundId: event.target.value }))} disabled={loadingRounds || !selectableRounds.length}>
                      {selectableRounds.map((round) => <option key={round.id} value={round.id}>{round.title} • {getRoundStatusLabel(round.status)}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  <span className="ui-pill"><FiLayers /> {selectedLottery?.name || '-'}</span>
                  <span className="ui-pill"><FiClock /> {selectedRound?.title || '-'}</span>
                  <span className="ui-pill">{getRoundStatusLabel(selectedRound?.status)}</span>
                  <span className="ui-pill">ปิดรับ {formatDateTime(selectedRound?.closeAt)}</span>
                  <span className="ui-pill">{selectedRateProfile?.name || 'เรทมาตรฐาน'}</span>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {(selectedLottery?.rateProfiles || []).map((profile) => <button key={profile.id} type="button" className={`btn ${selectedRateProfile?.id === profile.id ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setSelection((current) => ({ ...current, rateProfileId: profile.id }))}>{profile.name}</button>)}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginTop: 16 }}>
                  {(selectedLottery?.supportedBetTypes || []).map((betType) => <div key={betType} className="card" style={{ padding: 12, borderColor: roundClosedBetTypes.includes(betType) ? 'var(--border-accent)' : undefined }}><div className="ops-table-note" style={{ margin: 0 }}>{getBetTypeLabel(betType)}</div><strong style={{ display: 'block', marginTop: 8 }}>x{selectedRateProfile?.rates?.[betType] || 0}</strong><small className="ops-table-note" style={{ marginTop: 6, display: 'block', color: roundClosedBetTypes.includes(betType) ? 'var(--primary-light)' : undefined }}>{roundClosedBetTypes.includes(betType) ? 'ปิดรับในงวดนี้' : 'เปิดรับ'}</small></div>)}
                </div>

                {roundClosedBetTypes.length ? <div className="bet-note warning" style={{ marginTop: 16 }}><FiAlertCircle /><span>รายการปิดรับงวดนี้: {roundClosedBetTypes.map((betType) => getBetTypeLabel(betType)).join(', ')}</span></div> : null}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                  <button type="button" className={`btn ${mode === 'fast' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setMode('fast')}>แทงเร็ว</button>
                  <button type="button" className={`btn ${mode === 'grid' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setMode('grid')}>2 ตัว / 3 ตัว</button>
                </div>

                <div className="card" style={{ marginTop: 16, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                  <div>
                    <div className="ops-table-note" style={{ margin: 0 }}>โหมดปัจจุบัน</div>
                    <strong>{mode === 'fast' ? 'แทงเร็ว' : `กรอกตาราง ${digitMode} ตัว`}</strong>
                  </div>
                  <div>
                    <div className="ops-table-note" style={{ margin: 0 }}>รายการก่อนรีวิว</div>
                    <strong>{mode === 'fast' ? `${fastDraftSummary.lineCount} บรรทัด` : `${gridDraftSummary.filledRows} แถว`}</strong>
                  </div>
                  <div>
                    <div className="ops-table-note" style={{ margin: 0 }}>ตัวช่วยที่เปิด</div>
                    <strong>
                      {mode === 'fast'
                        ? [fastDraftSummary.reverseEnabled ? 'กลับเลข' : null, fastDraftSummary.helperCount ? `เลขเบิ้ล ${fastDraftSummary.helperCount}` : null].filter(Boolean).join(' • ') || 'ไม่มี'
                        : `${gridDraftSummary.amountCells} ช่องยอด`}
                    </strong>
                  </div>
                </div>

                {mode === 'fast' ? (
                  <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                      {(selectedLottery?.supportedBetTypes || []).map((betType) => <button key={betType} type="button" className={`btn ${activeBetType === betType ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveBetType(betType)} disabled={roundClosedBetTypes.includes(betType)}>{getBetTypeLabel(betType)} • x{selectedRateProfile?.rates?.[betType] || 0}</button>)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
                      <div><label className="form-label">จำนวนมาตรฐาน</label><input className="form-input" type="number" min="1" placeholder="เช่น 10" value={defaultAmount} onChange={(event) => setDefaultAmount(event.target.value)} /></div>
                      <div><label className="form-label">บันทึกช่วยจำ</label><input className="form-input" type="text" placeholder="เช่น ลูกค้า VIP รอบเช้า" value={memo} onChange={(event) => setMemo(event.target.value)} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      {quickAmountOptions.map((amount) => <button key={amount} type="button" className={`btn ${defaultAmount === amount ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setDefaultAmount(amount)}>{amount} บาท</button>)}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      <button type="button" className={`btn ${reverse ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setReverse((value) => !value)}><FiShuffle /> กลับเลข</button>
                      <button type="button" className={`btn ${includeDoubleSet ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setIncludeDoubleSet((value) => !value)}><FiStar /> {includeDoubleSet ? 'เลขเบิ้ล' : 'ชุดปกติ'}</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={clearComposer}><FiRotateCcw /> ล้างทั้งหมด</button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyRunHelper('run_top')} disabled={!selectedLottery?.supportedBetTypes?.includes('run_top') || roundClosedBetTypes.includes('run_top')}>วินบน</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyRunHelper('run_bottom')} disabled={!selectedLottery?.supportedBetTypes?.includes('run_bottom') || roundClosedBetTypes.includes('run_bottom')}>วินล่าง</button>
                    </div>
                    <div style={{ marginTop: 16 }}><label className="form-label">แทงเร็ว</label><textarea ref={fastInputRef} className="form-input" rows="14" placeholder={'พิมพ์ 1 บรรทัดต่อ 1 รายการ\n123 10\n456=20\n789'} value={rawInput} onChange={(event) => setRawInput(event.target.value)} /></div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                      {digitModeOptions.map((option) => <button key={option.value} type="button" className={`btn ${digitMode === option.value ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setDigitMode(option.value)}>{option.label}</button>)}
                    </div>
                    <div style={{ marginTop: 16 }}><label className="form-label">บันทึกช่วยจำ</label><input className="form-input" type="text" placeholder="เช่น โพยรวมหน้าร้าน" value={memo} onChange={(event) => setMemo(event.target.value)} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12, marginTop: 16 }}>
                      {[{ key: 'top', betType: gridColumns[0], enabled: supportedGridColumns.top }, { key: 'bottom', betType: gridColumns[1], enabled: supportedGridColumns.bottom }, { key: 'tod', betType: gridColumns[2], enabled: supportedGridColumns.tod }].map((column) => <div key={column.key} className="card" style={{ padding: 12 }}><div className="ops-table-note" style={{ margin: 0 }}>{getBetTypeLabel(column.betType)}</div><div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}><input className="form-input" style={{ minWidth: 0, flex: 1 }} type="number" min="0" placeholder="ยอด" disabled={!column.enabled} value={gridBulkAmounts[column.key]} onChange={(event) => setGridBulkAmounts((current) => ({ ...current, [column.key]: event.target.value }))} /><button type="button" className="btn btn-secondary btn-sm" disabled={!column.enabled} onClick={() => applyGridBulkAmount(column.key)}><FiCopy /> คัดลอกยอด</button></div></div>)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                      {gridRows.map((row) => (
                        <div
                          key={row.id}
                          className="card"
                          style={{ padding: 12, display: 'grid', gridTemplateColumns: 'minmax(140px,1.1fr) repeat(3,minmax(90px,1fr)) 52px', gap: 10 }}
                        >
                          <input
                            ref={setGridCellRef(row.id, 'number')}
                            className="form-input"
                            type="text"
                            inputMode="numeric"
                            placeholder={digitMode === '3' ? 'เช่น 123' : 'เช่น 12'}
                            value={row.number}
                            onChange={(event) => updateGridRow(row.id, { number: event.target.value })}
                            onKeyDown={(event) => handleGridKeyDown(row.id, 'number', event)}
                            onPaste={(event) => handleGridNumberPaste(row.id, event)}
                          />
                          <input
                            ref={setGridCellRef(row.id, 'top')}
                            className="form-input"
                            type="number"
                            min="0"
                            placeholder={getBetTypeLabel(gridColumns[0])}
                            disabled={!supportedGridColumns.top}
                            value={row.amounts.top}
                            onChange={(event) => updateGridAmount(row.id, 'top', event.target.value)}
                            onKeyDown={(event) => handleGridKeyDown(row.id, 'top', event)}
                          />
                          <input
                            ref={setGridCellRef(row.id, 'bottom')}
                            className="form-input"
                            type="number"
                            min="0"
                            placeholder={getBetTypeLabel(gridColumns[1])}
                            disabled={!supportedGridColumns.bottom}
                            value={row.amounts.bottom}
                            onChange={(event) => updateGridAmount(row.id, 'bottom', event.target.value)}
                            onKeyDown={(event) => handleGridKeyDown(row.id, 'bottom', event)}
                          />
                          <input
                            ref={setGridCellRef(row.id, 'tod')}
                            className="form-input"
                            type="number"
                            min="0"
                            placeholder={getBetTypeLabel(gridColumns[2])}
                            disabled={!supportedGridColumns.tod}
                            value={row.amounts.tod}
                            onChange={(event) => updateGridAmount(row.id, 'tod', event.target.value)}
                            onKeyDown={(event) => handleGridKeyDown(row.id, 'tod', event)}
                          />
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => removeGridRow(row.id)}>
                            <FiTrash2 />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyRunHelper('run_top')} disabled={!selectedLottery?.supportedBetTypes?.includes('run_top') || roundClosedBetTypes.includes('run_top')}><FiStar /> วินบน</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyRunHelper('run_bottom')} disabled={!selectedLottery?.supportedBetTypes?.includes('run_bottom') || roundClosedBetTypes.includes('run_bottom')}><FiStar /> วินล่าง</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setGridRows((current) => [...current, buildEmptyGridRow()])}><FiPlus /> เพิ่มแถว</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={clearComposer}><FiRotateCcw /> ล้างทั้งหมด</button>
                    </div>
                  </>
                )}

                <div className="bet-note" style={{ marginTop: 16 }}><FiAlertCircle /><span>ระบบจะตรวจสิทธิ์ของสมาชิก เรท ลิมิต และเลขที่ปิดรับก่อนสร้างโพยทุกครั้ง</span></div>
              </>
            )}
          </section>

          <aside className="card ops-section operator-preview-panel">
            <div className="ui-panel-head">
              <div><div className="ui-eyebrow">ตัวอย่างโพย</div><h3 className="card-title">รีวิวก่อนส่งรายการซื้อ</h3></div>
              <button className="btn btn-secondary btn-sm" onClick={handlePreview} disabled={previewing || !selectedMember}>{previewing ? <FiRefreshCw className="spin-animation" /> : <FiLayers />} รีวิวโพย</button>
            </div>

            {!preview ? (
              <div className="empty-state operator-preview-empty">
                <div className="empty-state-icon"><FiLayers /></div>
                <div className="empty-state-text">กรอกรายการซื้อแล้วกดรีวิวโพยเพื่อดูยอดรวม เรท และรายการที่จะส่งจริง</div>
              </div>
            ) : (
              <>
                <div className="card operator-preview-meta">
                  <div><strong>ซื้อแทน:</strong> {preview.member?.name || selectedMember?.name} <span className="ops-table-note">UID {preview.member?.uid || selectedMember?.uid}</span></div>
                  <div style={{ marginTop: 6 }}><strong>ผู้ทำรายการ:</strong> {preview.placedBy?.name || user?.name} <span className="ops-table-note">{copy.actorLabel}</span></div>
                </div>
                <div className="operator-preview-summary">
                  <div className="card" style={{ padding: 12 }}><div className="ops-table-note" style={{ margin: 0 }}>จำนวนรายการ</div><strong>{preview.summary?.itemCount || 0}</strong></div>
                  <div className="card" style={{ padding: 12 }}><div className="ops-table-note" style={{ margin: 0 }}>ยอดรวม</div><strong>{money(preview.summary?.totalAmount)} บาท</strong></div>
                  <div className="card" style={{ padding: 12 }}><div className="ops-table-note" style={{ margin: 0 }}>จ่ายสูงสุด</div><strong>{money(preview.summary?.potentialPayout)} บาท</strong></div>
                  <div className="card" style={{ padding: 12 }}><div className="ops-table-note" style={{ margin: 0 }}>สถานะงวด</div><strong>{getRoundStatusLabel(preview.roundStatus?.status)}</strong></div>
                </div>
                <div className="operator-preview-list">
                  {(preview.items || []).slice(0, 14).map((item, index) => <div key={`${item.betType}-${item.number}-${index}`} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><strong>{item.number}</strong><div className="ops-table-note" style={{ marginTop: 6 }}>{getBetTypeLabel(item.betType)} • {item.sourceFlags?.fromDoubleSet ? getSourceFlagLabel('doubleSet') : item.sourceFlags?.fromReverse ? getSourceFlagLabel('reverse') : getSourceFlagLabel('manual')}</div></div><div style={{ textAlign: 'right' }}><strong>{money(item.amount)} บาท</strong><div className="ops-table-note">x{item.payRate}</div></div></div>)}
                </div>
                {(preview.items || []).length > 14 ? <div className="bet-note" style={{ marginTop: 14 }}><FiAlertCircle /><span>แสดงเพียง 14 รายการแรกจากทั้งหมด {preview.items.length} รายการ แต่ตอนคัดลอกโพยจะใส่ทุกรายการให้ครบ</span></div> : null}
              </>
            )}

            <div className="card operator-recent-panel">
              <div className="ui-panel-head">
                <div>
                  <div className="ui-eyebrow">รายการล่าสุด</div>
                  <h4 className="card-title" style={{ marginBottom: 0 }}>โพยล่าสุดของสมาชิกนี้</h4>
                </div>
                {recentLoading ? <FiRefreshCw className="spin-animation" /> : null}
              </div>

              {!selectedMember ? (
                <div className="ops-table-note" style={{ marginTop: 12 }}>เลือกสมาชิกก่อนเพื่อดูรายการล่าสุด</div>
              ) : recentItems.length ? (
                <div className="operator-recent-list">
                  {recentItems.map((item) => (
                    <div key={item._id} className="card operator-recent-item">
                      <div>
                        <strong>{item.number}</strong>
                        <div className="ops-table-note" style={{ marginTop: 4 }}>{getBetTypeLabel(item.betType)} • {item.slipNumber}</div>
                        <div className="ops-table-note">{formatDateTime(item.createdAt)}</div>
                      </div>
                      <div className="operator-recent-item-right">
                        <strong>{money(item.amount)} บาท</strong>
                        <div className="ops-table-note">x{item.payRate}</div>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => applyRecentItem(item)}>ใช้ซ้ำ</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ops-table-note" style={{ marginTop: 12 }}>ยังไม่มีรายการล่าสุดในตลาดนี้สำหรับสมาชิกคนนี้</div>
              )}
            </div>

            <div className="operator-preview-actions">
              <button className="btn btn-secondary" onClick={handleCopyAsImage} disabled={previewing || copyingImage || submitting || !selectedMember}><FiCopy /> {copyingImage ? 'กำลังคัดลอกโพยเป็นรูป...' : 'คัดลอกโพยเป็นรูป'}</button>
              <button className="btn btn-primary" onClick={handleSubmitSlip} disabled={previewing || copyingImage || submitting || !selectedMember || !canSubmit}><FiSend /> {submitting ? 'กำลังส่งรายการซื้อ...' : 'ส่งรายการซื้อ'}</button>
              {!canSubmit && selectedMember ? <div className="submit-warning">งวดนี้ไม่ได้อยู่ในสถานะเปิดรับ จึงส่งรายการซื้อไม่ได้ แต่ยังคัดลอกโพยเป็นรูปได้</div> : null}
            </div>
          </aside>
        </section>
      </section>
    </div>
  );
};

export default OperatorBetting;
