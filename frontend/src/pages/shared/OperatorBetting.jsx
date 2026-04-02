import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiCopy,
  FiFileText,
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
import { buildSlipDisplayGroups } from '../../utils/slipGrouping';
import { copySlipPreviewImage } from '../../utils/slipImage';
import { copyPreviewSlipText } from '../../utils/slipText';

const quickAmountOptions = ['10', '20', '50', '100'];
const hiddenRoundStatuses = new Set(['closed', 'resulted']);
const doubleSetCounts = {
  1: 10,
  2: 10,
  3: 270
};

const buildInitialFastAmounts = () => ({
  top: '',
  bottom: '',
  tod: ''
});

const fastFamilyOptions = [
  {
    value: '2',
    label: '2 ตัว',
    digits: 2,
    columns: [
      { key: 'top', betType: '2top' },
      { key: 'bottom', betType: '2bottom' },
      { key: 'tod', betType: '2tod' }
    ]
  },
  {
    value: '3',
    label: '3 ตัว',
    digits: 3,
    columns: [
      { key: 'top', betType: '3top' },
      { key: 'bottom', betType: '3bottom' },
      { key: 'tod', betType: '3tod' }
    ]
  },
  {
    value: 'run',
    label: 'วิ่ง',
    digits: 1,
    columns: [
      { key: 'top', betType: 'run_top' },
      { key: 'bottom', betType: 'run_bottom' }
    ]
  }
];


const roleConfig = {
  agent: {
    title: 'ซื้อแทนสมาชิก',
    subtitle: 'ค้นหาสมาชิกแล้วส่งโพยแทนจากฝั่งเอเย่นต์ โดยใช้สิทธิ์ เรท และลิมิตของสมาชิกจริง',
    searchPlaceholder: 'ค้นหาด้วยชื่อ ชื่อผู้ใช้ เบอร์โทร หรือ UID',
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
    subtitle: 'ผู้ดูแลสามารถค้นหาและส่งโพยแทนสมาชิกทุกสายงานได้จากหน้าเดียว',
    searchPlaceholder: 'ค้นหาด้วยชื่อ ชื่อผู้ใช้ เบอร์โทร หรือ UID',
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
const buildInitialGridRows = () => Array.from({ length: 2 }, buildEmptyGridRow);
const cloneGridRows = (rows = []) =>
  rows.map((row) => ({
    id: buildEmptyGridRow().id,
    number: row.number || '',
    amounts: {
      top: row.amounts?.top || '',
      bottom: row.amounts?.bottom || '',
      tod: row.amounts?.tod || ''
    }
  }));

const getFastFamilyConfig = (fastFamily) =>
  fastFamilyOptions.find((option) => option.value === fastFamily) || fastFamilyOptions[0];

const extractFastNumbersByDigits = (rawInput, digits) => {
  const numbers = [];

  String(rawInput || '')
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/[xX×*]/g, ' ')
        .replace(/[^\d\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .forEach((line) => {
      (line.match(/\d+/g) || [])
        .filter((token) => token.length === digits)
        .forEach((token) => numbers.push(token));
    });

  return numbers;
};

const getFastEnabledColumns = ({ fastFamily, supportedBetTypes = [], closedBetTypes = [] }) => {
  const config = getFastFamilyConfig(fastFamily);
  const supported = new Set(supportedBetTypes);
  const closed = new Set(closedBetTypes);

  return config.columns.reduce((acc, column) => {
    acc[column.key] = supported.has(column.betType) && !closed.has(column.betType);
    return acc;
  }, {});
};

const getFastDraftSummary = ({
  rawInput,
  fastFamily,
  includeDoubleSet,
  reverse,
  fastAmounts,
  supportedBetTypes,
  closedBetTypes
}) => {
  const config = getFastFamilyConfig(fastFamily);
  const extractedNumbers = extractFastNumbersByDigits(rawInput, config.digits);
  const enabledColumns = getFastEnabledColumns({
    fastFamily,
    supportedBetTypes,
    closedBetTypes
  });
  const pricedColumns = config.columns.filter(
    (column) => enabledColumns[column.key] && Number(fastAmounts?.[column.key] || 0) > 0
  ).length;

  return {
    lineCount: extractedNumbers.length,
    helperCount: includeDoubleSet ? doubleSetCounts[config.digits] || 0 : 0,
    reverseEnabled: Boolean(reverse),
    pricedColumns
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

const fastDigitLengths = {
  '3top': 3,
  '3bottom': 3,
  '3tod': 3,
  '2top': 2,
  '2bottom': 2,
  '2tod': 2,
  'run_top': 1,
  'run_bottom': 1
};

const buildDraftDoubleSet = (digits) => {
  if (digits === 1) {
    return Array.from({ length: 10 }, (_, index) => String(index));
  }

  if (digits === 2) {
    return Array.from({ length: 10 }, (_, index) => `${index}${index}`);
  }

  const numbers = new Set();
  for (let repeatedDigit = 0; repeatedDigit <= 9; repeatedDigit += 1) {
    for (let oddDigit = 0; oddDigit <= 9; oddDigit += 1) {
      if (oddDigit === repeatedDigit) continue;
      numbers.add(`${repeatedDigit}${repeatedDigit}${oddDigit}`);
      numbers.add(`${repeatedDigit}${oddDigit}${repeatedDigit}`);
      numbers.add(`${oddDigit}${repeatedDigit}${repeatedDigit}`);
    }
  }

  return [...numbers].sort();
};

const buildDraftPermutations = (digits) => {
  const values = new Set();

  const walk = (prefix, remaining) => {
    if (!remaining.length) {
      values.add(prefix);
      return;
    }

    [...remaining].forEach((digit, index) => {
      walk(prefix + digit, `${remaining.slice(0, index)}${remaining.slice(index + 1)}`);
    });
  };

  walk('', String(digits || ''));
  return [...values];
};

const expandFastDraftNumbers = (number, betType, reverse) => {
  if (!reverse) return [number];

  if (betType === '2top' || betType === '2bottom' || betType === '2tod') {
    return [...new Set([number, number.split('').reverse().join('')])];
  }

  if (betType === '3top' || betType === '3bottom' || betType === '3tod') {
    return buildDraftPermutations(number);
  }

  return [number];
};

const combineFastDraftItems = (items) => {
  const grouped = new Map();

  items.forEach((item) => {
    const key = `${item.betType}:${item.number}`;
    const current = grouped.get(key);
    if (current) {
      current.amount += item.amount;
      current.potentialPayout = current.amount * current.payRate;
      return;
    }

    grouped.set(key, {
      ...item,
      potentialPayout: item.amount * item.payRate
    });
  });

  return [...grouped.values()];
};

const buildFastDraftItems = ({
  fastFamily,
  rawInput,
  reverse,
  includeDoubleSet,
  rates,
  amounts,
  supportedBetTypes,
  closedBetTypes
}) => {
  const config = getFastFamilyConfig(fastFamily);
  const enabledColumns = getFastEnabledColumns({
    fastFamily,
    supportedBetTypes,
    closedBetTypes
  });
  const numbers = extractFastNumbersByDigits(rawInput, config.digits);

  const items = [];

  const appendNumberItems = (number) => {
    config.columns.forEach((column) => {
      const amount = Number(amounts?.[column.key] || 0);
      const payRate = Number(rates?.[column.betType] || 0);
      if (!enabledColumns[column.key] || amount <= 0 || payRate <= 0) return;

      expandFastDraftNumbers(number, column.betType, reverse).forEach((expandedNumber) => {
        items.push({
          betType: column.betType,
          number: expandedNumber,
          amount,
          payRate
        });
      });
    });
  };

  numbers.forEach((number) => {
    if (normalizeDigits(number).length !== config.digits) return;
    appendNumberItems(number);
  });

  if (includeDoubleSet) {
    buildDraftDoubleSet(config.digits).forEach((number) => {
      appendNumberItems(number);
    });
  }

  return combineFastDraftItems(items);
};

const getFastFamilyPlaceholder = (fastFamily) => {
  if (fastFamily === '3') {
    return 'พิมพ์ 1 บรรทัดต่อ 1 รายการ ระบบจะดึงเฉพาะเลข 3 ตัวให้อัตโนมัติ\n101 110 112\nabc 211 xx';
  }

  if (fastFamily === 'run') {
    return 'พิมพ์ตัวเลขคละกันได้ ระบบจะดึงเลขวิ่ง 1 ตัวให้อัตโนมัติ\n1 2 3 9\nabc7xx';
  }

  return 'พิมพ์ 1 บรรทัดต่อ 1 รายการ ระบบจะดึงเฉพาะเลข 2 ตัวให้อัตโนมัติ\n11 10 01 12\nabc 21 xx';
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
  const [showRates, setShowRates] = useState(false);
  const [rounds, setRounds] = useState([]);
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [mode, setMode] = useState('fast');
  const [fastFamily, setFastFamily] = useState('2');
  const [digitMode, setDigitMode] = useState('2');
  const [fastAmounts, setFastAmounts] = useState(buildInitialFastAmounts);
  const [rawInput, setRawInput] = useState('');
  const [reverse, setReverse] = useState(false);
  const [includeDoubleSet, setIncludeDoubleSet] = useState(false);
  const [gridRows, setGridRows] = useState(buildInitialGridRows);
  const [gridBulkAmounts, setGridBulkAmounts] = useState({ top: '', bottom: '', tod: '' });
  const [memo, setMemo] = useState('');
  const [savedDraftEntries, setSavedDraftEntries] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [copyingText, setCopyingText] = useState(false);
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
  const draftScopeKey = [selectedMember?.id || '', selection.lotteryId || '', selection.roundId || '', selection.rateProfileId || ''].join(':');
  const fastFamilyConfig = useMemo(() => getFastFamilyConfig(fastFamily), [fastFamily]);
  const enabledFastFamilies = useMemo(() => {
    const supported = new Set(selectedLottery?.supportedBetTypes || []);
    const closed = new Set(roundClosedBetTypes);

    return fastFamilyOptions.filter((option) =>
      option.columns.some((column) => supported.has(column.betType) && !closed.has(column.betType))
    );
  }, [roundClosedBetTypes, selectedLottery]);
  const supportedFastColumns = useMemo(
    () =>
      getFastEnabledColumns({
        fastFamily,
        supportedBetTypes: selectedLottery?.supportedBetTypes || [],
        closedBetTypes: roundClosedBetTypes
      }),
    [fastFamily, roundClosedBetTypes, selectedLottery]
  );
  const fastDraftSummary = useMemo(
    () =>
      getFastDraftSummary({
        rawInput,
        fastFamily,
        includeDoubleSet,
        reverse,
        fastAmounts,
        supportedBetTypes: selectedLottery?.supportedBetTypes || [],
        closedBetTypes: roundClosedBetTypes
      }),
    [fastAmounts, fastFamily, includeDoubleSet, rawInput, reverse, roundClosedBetTypes, selectedLottery]
  );
  const gridDraftSummary = useMemo(() => getGridDraftSummary(gridRows), [gridRows]);
  const recentSlipGroups = useMemo(() => groupRecentItemsBySlip(recentItems), [recentItems]);
  const fastDraftItems = useMemo(() => {
    if (mode !== 'fast') return [];

    return buildFastDraftItems({
      fastFamily,
      rawInput,
      reverse,
      includeDoubleSet,
      rates: selectedRateProfile?.rates || {},
      amounts: fastAmounts,
      supportedBetTypes: selectedLottery?.supportedBetTypes || [],
      closedBetTypes: roundClosedBetTypes
    });
  }, [fastAmounts, fastFamily, includeDoubleSet, mode, rawInput, reverse, roundClosedBetTypes, selectedLottery, selectedRateProfile]);
  const fastDraftGroups = useMemo(() => buildSlipDisplayGroups(fastDraftItems), [fastDraftItems]);
  const gridDraftItems = useMemo(() => {
    if (mode !== 'grid') return [];

    try {
      return buildGridItems({ rows: gridRows, digitMode });
    } catch {
      return [];
    }
  }, [digitMode, gridRows, mode]);
  const gridDraftGroups = useMemo(() => buildSlipDisplayGroups(gridDraftItems), [gridDraftItems]);
  const currentDraftItems = mode === 'fast' ? fastDraftItems : gridDraftItems;
  const combinedDraftItems = useMemo(
    () => [...savedDraftEntries.flatMap((entry) => entry.items || []), ...currentDraftItems],
    [currentDraftItems, savedDraftEntries]
  );
  const combinedDraftGroups = useMemo(() => buildSlipDisplayGroups(combinedDraftItems), [combinedDraftItems]);
  const previewGroups = useMemo(() => buildSlipDisplayGroups(preview?.items || []), [preview]);
  const hasDraftItems = currentDraftItems.length > 0;
  const hasSavedDraftEntries = savedDraftEntries.length > 0;
  const hasPendingSlip = combinedDraftItems.length > 0;

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
      setSearchText('');
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

  const clearComposerFields = () => {
    setPreview(null);
    setPreviewDialogOpen(false);
    setFastAmounts(buildInitialFastAmounts);
    setRawInput('');
    setReverse(false);
    setIncludeDoubleSet(false);
    setGridRows(buildInitialGridRows);
    setGridBulkAmounts({ top: '', bottom: '', tod: '' });
    setMemo('');
  };

  const getCurrentComposerItems = () => {
    if (mode === 'grid') {
      return buildGridItems({ rows: gridRows, digitMode });
    }

    if (!fastDraftItems.length) {
      throw new Error('กรุณากรอกหมายเลขและยอดอย่างน้อย 1 รายการ');
    }

    return fastDraftItems;
  };

  const buildCurrentSource = () => {
    if (mode === 'grid') {
      return {
        mode: 'grid',
        digitMode,
        gridRows: cloneGridRows(gridRows),
        memo
      };
    }

    return {
      mode: 'fast',
      fastFamily,
      fastAmounts: { ...fastAmounts },
      rawInput,
      reverse,
      includeDoubleSet,
      memo
    };
  };

  const restoreComposerFromSource = (source) => {
    setPreview(null);
    setPreviewDialogOpen(false);

    if (source?.mode === 'grid') {
      setMode('grid');
      setDigitMode(source.digitMode || '2');
      setGridRows(cloneGridRows(source.gridRows?.length ? source.gridRows : buildInitialGridRows()));
      setGridBulkAmounts({ top: '', bottom: '', tod: '' });
      setFastAmounts(buildInitialFastAmounts);
      setRawInput('');
      setReverse(false);
      setIncludeDoubleSet(false);
      setMemo(source.memo || '');
      return;
    }

    setMode('fast');
    setFastFamily(source?.fastFamily || '2');
    setFastAmounts(source?.fastAmounts || buildInitialFastAmounts());
    setRawInput(source?.rawInput || '');
    setReverse(Boolean(source?.reverse));
    setIncludeDoubleSet(Boolean(source?.includeDoubleSet));
    setGridRows(buildInitialGridRows);
    setGridBulkAmounts({ top: '', bottom: '', tod: '' });
    setMemo(source?.memo || '');
  };

  const buildPayload = ({ items, payloadMemo } = {}) => {
    const basePayload = {
      customerId: selectedMember?.id,
      lotteryId: selectedLottery?.id,
      roundId: selectedRound?.id,
      rateProfileId: selectedRateProfile?.id,
      memo: payloadMemo ?? memo
    };

    return {
      ...basePayload,
      items: items || getCurrentComposerItems()
    };
  };

  const buildCombinedPayload = () => {
    const stagedItems = savedDraftEntries.flatMap((entry) => entry.items || []);
    const currentItems = hasDraftItems ? getCurrentComposerItems() : [];
    const items = [...stagedItems, ...currentItems];

    if (!items.length) {
      throw new Error('กรุณาคีย์หรือบันทึกรายการไว้ในโพยก่อน');
    }

    const notes = [...savedDraftEntries.map((entry) => entry.memo).filter(Boolean), hasDraftItems ? memo : ''].filter(Boolean);

    return buildPayload({
      items,
      payloadMemo: notes.join(' | ')
    });
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
      const response = await copy.parseSlip(buildCombinedPayload());
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

  const handleOpenPreviewDialog = async () => {
    const nextPreview = preview || await handlePreview();
    if (!nextPreview) return null;
    setPreviewDialogOpen(true);
    return nextPreview;
  };

  const handleSubmitSlip = async () => {
    const nextPreview = preview || await handlePreview();
    if (!nextPreview) return;
    setSubmitting(true);
    try {
      const response = await copy.createSlip({ ...buildCombinedPayload(), action: 'submit' });
      toast.success(`บันทึกโพย ${response.data.slipNumber} แล้ว`);
      setSavedDraftEntries([]);
      clearComposerFields();
      await fetchMemberContext(selectedMember.id, { silent: true });
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'บันทึกโพยไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraftEntry = () => {
    try {
      if (!selectedMember?.id) {
        toast.error('กรุณาเลือกสมาชิกก่อน');
        return;
      }
      if (!selectedLottery?.id || !selectedRound?.id) {
        toast.error('กรุณาเลือกตลาดและงวดก่อน');
        return;
      }

      const items = getCurrentComposerItems();
      const nextEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        scopeKey: draftScopeKey,
        items,
        groups: buildSlipDisplayGroups(items),
        memo: memo.trim(),
        source: buildCurrentSource(),
        totalAmount: items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        itemCount: items.length
      };

      setSavedDraftEntries((current) => [...current, nextEntry]);
      clearComposerFields();
      toast.success(`บันทึกรายการไว้ในโพยแล้ว ${items.length} รายการ`);
    } catch (error) {
      toast.error(error.message || 'บันทึกรายการไว้ในโพยไม่สำเร็จ');
    }
  };

  const handleEditSavedDraftEntry = (entryId) => {
    const entry = savedDraftEntries.find((item) => item.id === entryId);
    if (!entry) return;

    restoreComposerFromSource(entry.source);
    setSavedDraftEntries((current) => current.filter((item) => item.id !== entryId));
    toast.success('ดึงรายการที่บันทึกไว้กลับมาแก้ไขแล้ว');
  };

  const handleRemoveSavedDraftEntry = (entryId) => {
    setSavedDraftEntries((current) => current.filter((item) => item.id !== entryId));
    setPreview(null);
    setPreviewDialogOpen(false);
    toast.success('ลบรายการออกจากโพยแล้ว');
  };

  const handleCopyAsText = async () => {
    setCopyingText(true);
    try {
      const nextPreview = preview || await handlePreview();
      if (!nextPreview) return;

      await copyPreviewSlipText({
        preview: nextPreview,
        selectedMember,
        selectedLottery,
        selectedRound,
        selectedRateProfile,
        actorLabel: copy.actorLabel,
        operatorName: user?.name,
        resolveRoundStatusLabel: getRoundStatusLabel
      });
      toast.success('คัดลอกข้อความสรุปโพยแล้ว');
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'คัดลอกข้อความสรุปโพยไม่สำเร็จ');
    } finally {
      setCopyingText(false);
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
    clearComposerFields();
    setSavedDraftEntries([]);
  };

  const clearSelectedMember = () => {
    setSelectedMember(null);
    setCatalog(null);
    setRounds([]);
    setSelection({ lotteryId: '', roundId: '', rateProfileId: '' });
    setSavedDraftEntries([]);
    setPreview(null);
    setRecentItems([]);
    setSearchText('');
    setSearchResults([]);
    setSearchParams({});
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const applyRecentItem = (item) => {
    setMode('fast');
    setFastFamily(item.betType?.startsWith('3') ? '3' : item.betType?.startsWith('2') ? '2' : 'run');
    setFastAmounts({
      top: item.betType?.endsWith('top') ? String(item.amount || '') : '',
      bottom: item.betType?.endsWith('bottom') ? String(item.amount || '') : '',
      tod: item.betType?.endsWith('tod') ? String(item.amount || '') : ''
    });
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
    setFastFamily(targetBetType.startsWith('3') ? '3' : targetBetType.startsWith('2') ? '2' : 'run');
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
      setFastFamily(draft.betType?.startsWith('3') ? '3' : draft.betType?.startsWith('2') ? '2' : 'run');
      setFastAmounts({
        top: draft.betType?.endsWith('top') ? draft.defaultAmount : '',
        bottom: draft.betType?.endsWith('bottom') ? draft.defaultAmount : '',
        tod: draft.betType?.endsWith('tod') ? draft.defaultAmount : ''
      });
      setRawInput(draft.rawInput);
      setGridRows(buildInitialGridRows);
      setGridBulkAmounts({ top: '', bottom: '', tod: '' });
    } else {
      setMode('grid');
      setDigitMode(draft.digitMode);
      setGridRows(draft.rows);
      setGridBulkAmounts({ top: '', bottom: '', tod: '' });
      setFastAmounts(buildInitialFastAmounts);
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
  const updateFastAmount = (columnKey, value) =>
    setFastAmounts((current) => ({
      ...current,
      [columnKey]: value
    }));
  const applyFastAmountPreset = (amount) =>
    setFastAmounts((current) => {
      const next = { ...current };
      fastFamilyConfig.columns.forEach((column) => {
        if (supportedFastColumns[column.key]) {
          next[column.key] = amount;
        }
      });
      return next;
    });
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
    const supported = new Set(selectedLottery.supportedBetTypes);
    const closed = new Set(roundClosedBetTypes);
    const fallbackFamilies = fastFamilyOptions.filter((option) =>
      option.columns.some((column) => supported.has(column.betType))
    );
    const availableFamilies = fallbackFamilies.filter((option) =>
      option.columns.some((column) => supported.has(column.betType) && !closed.has(column.betType))
    );
    const nextFamilies = availableFamilies.length ? availableFamilies : fallbackFamilies;
    if (nextFamilies.length && !nextFamilies.some((option) => option.value === fastFamily)) {
      setFastFamily(nextFamilies[0].value);
    }
  }, [fastFamily, roundClosedBetTypes, selectedLottery]);

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
    setPreviewDialogOpen(false);
  }, [selectedMember?.id, selection.lotteryId, selection.roundId, selection.rateProfileId, mode, fastFamily, digitMode, fastAmounts, rawInput, reverse, includeDoubleSet, memo, gridRows, savedDraftEntries]);

  useEffect(() => {
    setSavedDraftEntries((current) =>
      current.filter((entry) => !entry.scopeKey || entry.scopeKey === draftScopeKey)
    );
  }, [draftScopeKey]);

  useEffect(() => {
    setShowRates(false);
  }, [selectedMember?.id, selection.lotteryId, selection.roundId]);

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
        <section className="operator-workspace">
          <section className="card ops-section operator-composer-panel">
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
                  <div className="ops-table-note" style={{ margin: '6px 0 0' }}>
                    {getUserStatusLabel(selectedMember.status)} • {selectedMember.phone || '-'}
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={clearSelectedMember}><FiX /> ล้าง</button>
              </div>
              <div className="operator-selected-grid">
                <div className="card" style={{ padding: 12 }}><strong>เครดิตคงเหลือ</strong><div className="ops-table-note">{money(selectedMember.creditBalance)} บาท</div></div>
                <div className="card" style={{ padding: 12 }}><strong>ยอดขายสะสม</strong><div className="ops-table-note">{money(selectedMember.totals?.totalAmount)} บาท</div></div>
                <div className="card" style={{ padding: 12 }}><strong>ยอดถูกสะสม</strong><div className="ops-table-note">{money(selectedMember.totals?.totalWon)} บาท</div></div>
                <div className="card" style={{ padding: 12 }}><strong>ได้เสียสุทธิ</strong><div className="ops-table-note">{money(selectedMember.totals?.netProfit)} บาท</div></div>
              </div>
            </div>
          ) : null}

          {searchText.trim() ? (
            <>

            <div className="operator-search-results">
              {searching ? <div className="card" style={{ padding: 14 }}>กำลังค้นหา...</div> : null}
              {!searching && searchResults.map((member) => (
                <button key={member.id} type="button" className="card operator-search-result" onClick={() => fetchMemberContext(member.id)}>
                  <div>
                    <strong>{member.name}</strong>
                    <div className="ops-table-note">@{member.username}</div>
                    <div className="ops-table-note">{member.phone || getUserStatusLabel(member.status)}</div>
                  </div>
                  <div className="operator-search-meta">
                    <strong>{money(member.totals?.netProfit)} บาท</strong>
                    <div className="ops-table-note">เครดิต {money(member.creditBalance)} บาท</div>
                  </div>
                </button>
              ))}
            </div>
            </>
          ) : null}
            <div className="operator-composer-divider" />
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
                <div className="operator-select-grid">
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

                <div className="operator-pill-row">
                  <span className="ui-pill"><FiLayers /> {selectedLottery?.name || '-'}</span>
                  <span className="ui-pill"><FiClock /> {selectedRound?.title || '-'}</span>
                  <span className="ui-pill">{getRoundStatusLabel(selectedRound?.status)}</span>
                  <span className="ui-pill">ปิดรับ {formatDateTime(selectedRound?.closeAt)}</span>
                  <span className="ui-pill">{selectedRateProfile?.name || 'เรทมาตรฐาน'}</span>
                </div>

                <button type="button" className="btn btn-secondary btn-sm operator-rate-toggle" onClick={() => setShowRates((value) => !value)}>
                  {showRates ? <FiChevronUp /> : <FiChevronDown />}
                  {showRates ? 'ซ่อนเรท' : 'ดูเรท'}
                </button>

                {showRates ? (
                  <>
                    <div className="operator-rate-row">
                      {(selectedLottery?.rateProfiles || []).map((profile) => <button key={profile.id} type="button" className={`btn ${selectedRateProfile?.id === profile.id ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setSelection((current) => ({ ...current, rateProfileId: profile.id }))}>{profile.name}</button>)}
                    </div>

                    <div className="operator-rate-grid">
                      {(selectedLottery?.supportedBetTypes || []).map((betType) => <div key={betType} className="card" style={{ padding: 12, borderColor: roundClosedBetTypes.includes(betType) ? 'var(--border-accent)' : undefined }}><div className="ops-table-note" style={{ margin: 0 }}>{getBetTypeLabel(betType)}</div><strong style={{ display: 'block', marginTop: 8 }}>x{selectedRateProfile?.rates?.[betType] || 0}</strong><small className="ops-table-note" style={{ marginTop: 6, display: 'block', color: roundClosedBetTypes.includes(betType) ? 'var(--primary-light)' : undefined }}>{roundClosedBetTypes.includes(betType) ? 'ปิดรับในงวดนี้' : 'เปิดรับ'}</small></div>)}
                    </div>
                  </>
                ) : null}

                {roundClosedBetTypes.length ? <div className="bet-note warning" style={{ marginTop: 16 }}><FiAlertCircle /><span>รายการปิดรับงวดนี้: {roundClosedBetTypes.map((betType) => getBetTypeLabel(betType)).join(', ')}</span></div> : null}

                <div className="operator-mode-row">
                  <button type="button" className={`btn ${mode === 'fast' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setMode('fast')}>แทงเร็ว</button>
                  <button type="button" className={`btn ${mode === 'grid' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setMode('grid')}>2 ตัว / 3 ตัว</button>
                </div>

                <div className="card operator-draft-summary">
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
                    <div className="operator-bettype-row">
                      {(enabledFastFamilies.length ? enabledFastFamilies : fastFamilyOptions).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`btn ${fastFamily === option.value ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                          onClick={() => setFastFamily(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="operator-fast-grid">
                      <div className="operator-fast-grid-wide">
                        <label className="form-label">บันทึกช่วยจำ</label>
                        <input
                          className="form-input"
                          type="text"
                          placeholder="เช่น โพยรวมหน้าร้าน"
                          value={memo}
                          onChange={(event) => setMemo(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="operator-fast-rate-grid">
                      {fastFamilyConfig.columns.map((column) => {
                        const betLabel = getBetTypeLabel(column.betType);
                        const enabled = supportedFastColumns[column.key];
                        const rate = selectedRateProfile?.rates?.[column.betType] || 0;

                        return (
                          <div key={column.key} className={`card operator-fast-amount-card ${enabled ? '' : 'operator-fast-amount-card-disabled'}`}>
                            <div className="ops-table-note">{betLabel}</div>
                            <strong>x{rate}</strong>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              placeholder="ยอด"
                              disabled={!enabled}
                              value={fastAmounts[column.key]}
                              onChange={(event) => setFastAmounts((current) => ({ ...current, [column.key]: event.target.value }))}
                            />
                            <div className="operator-helper-row compact">
                              {quickAmountOptions.map((amount) => (
                                <button
                                  key={`${column.key}-${amount}`}
                                  type="button"
                                  className={`btn ${fastAmounts[column.key] === amount ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                  disabled={!enabled}
                                  onClick={() => setFastAmounts((current) => ({ ...current, [column.key]: amount }))}
                                >
                                  {amount} บาท
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="operator-helper-row compact">
                      <button type="button" className={`btn ${reverse ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setReverse((value) => !value)}>
                        <FiShuffle /> กลับเลข
                      </button>
                      <button type="button" className={`btn ${includeDoubleSet ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setIncludeDoubleSet((value) => !value)}>
                        <FiStar /> {includeDoubleSet ? 'เลขเบิ้ล' : 'ชุดปกติ'}
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={clearComposer}>
                        <FiRotateCcw /> ล้างทั้งหมด
                      </button>
                    </div>
                    <div className="operator-helper-row compact">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyRunHelper('run_top')} disabled={!selectedLottery?.supportedBetTypes?.includes('run_top') || roundClosedBetTypes.includes('run_top')}>
                        วินบน
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyRunHelper('run_bottom')} disabled={!selectedLottery?.supportedBetTypes?.includes('run_bottom') || roundClosedBetTypes.includes('run_bottom')}>
                        วินล่าง
                      </button>
                    </div>
                    <div className="operator-fast-input">
                      <label className="form-label">วางข้อความคำสั่งซื้อ</label>
                      <textarea
                        ref={fastInputRef}
                        className="form-input"
                        rows="14"
                        placeholder={getFastFamilyPlaceholder(fastFamily)}
                        value={rawInput}
                        onChange={(event) => setRawInput(event.target.value)}
                      />
                      <div className="ops-table-note" style={{ marginTop: 8 }}>
                        ระบบจะกรองเครื่องหมายที่ไม่จำเป็นออก และดึงเฉพาะเลข {fastFamilyConfig.digits} ตัวตามแท็บที่เลือกให้อัตโนมัติ
                      </div>
                    </div>
                    {false && fastDraftGroups.length ? (
                      <div className="card operator-slip-draft-panel">
                        <div className="operator-slip-draft-head">
                          <div>
                            <div className="ui-eyebrow">โพยที่กำลังคีย์</div>
                            <h4 className="card-title" style={{ marginBottom: 0 }}>รวมเลขตามชุดเดิมพันและยอดซื้อ</h4>
                          </div>
                          <div className="ops-table-note">
                            {selectedLottery?.name || '-'} • {selectedRound?.title || '-'}
                          </div>
                        </div>
                        <div className="operator-slip-group-list">
                          {fastDraftGroups.map((group) => (
                            <div key={group.key} className="card operator-slip-group-card">
                              <div className="operator-slip-group-side">
                                <div className="operator-slip-family">{group.familyLabel}</div>
                                <div className="operator-slip-combo">{group.comboLabel}</div>
                                <div className="operator-slip-amount">{group.amountLabel}</div>
                              </div>
                              <div className="operator-slip-group-body">
                                <div className="operator-slip-group-head">
                                  <span className="ops-table-note">{group.itemCount} รายการ</span>
                                  <strong>{money(group.totalAmount)} บาท</strong>
                                </div>
                                <div className="operator-slip-numbers">{group.numbersText}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="operator-helper-row">
                      {digitModeOptions.map((option) => <button key={option.value} type="button" className={`btn ${digitMode === option.value ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setDigitMode(option.value)}>{option.label}</button>)}
                    </div>
                    <div style={{ marginTop: 16 }}><label className="form-label">บันทึกช่วยจำ</label><input className="form-input" type="text" placeholder="เช่น โพยรวมหน้าร้าน" value={memo} onChange={(event) => setMemo(event.target.value)} /></div>
                    <div className="operator-grid-bulk">
                      {[{ key: 'top', betType: gridColumns[0], enabled: supportedGridColumns.top }, { key: 'bottom', betType: gridColumns[1], enabled: supportedGridColumns.bottom }, { key: 'tod', betType: gridColumns[2], enabled: supportedGridColumns.tod }].map((column) => <div key={column.key} className="card" style={{ padding: 12 }}><div className="ops-table-note" style={{ margin: 0 }}>{getBetTypeLabel(column.betType)}</div><div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}><input className="form-input" style={{ minWidth: 0, flex: 1 }} type="number" min="0" placeholder="ยอด" disabled={!column.enabled} value={gridBulkAmounts[column.key]} onChange={(event) => setGridBulkAmounts((current) => ({ ...current, [column.key]: event.target.value }))} /><button type="button" className="btn btn-secondary btn-sm" disabled={!column.enabled} onClick={() => applyGridBulkAmount(column.key)}><FiCopy /> คัดลอกยอด</button></div></div>)}
                    </div>
                    <div className="operator-grid-rows">
                      {gridRows.map((row) => (
                        <div
                          key={row.id}
                          className="card operator-grid-row"
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
                          <button type="button" className="btn btn-danger btn-sm operator-grid-delete" onClick={() => removeGridRow(row.id)}>
                            <FiTrash2 />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="operator-helper-row compact">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyRunHelper('run_top')} disabled={!selectedLottery?.supportedBetTypes?.includes('run_top') || roundClosedBetTypes.includes('run_top')}><FiStar /> วินบน</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyRunHelper('run_bottom')} disabled={!selectedLottery?.supportedBetTypes?.includes('run_bottom') || roundClosedBetTypes.includes('run_bottom')}><FiStar /> วินล่าง</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setGridRows((current) => [...current, buildEmptyGridRow()])}><FiPlus /> เพิ่มแถว</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={clearComposer}><FiRotateCcw /> ล้างทั้งหมด</button>
                    </div>
                    {false && gridDraftGroups.length ? (
                      <div className="card operator-slip-draft-panel">
                        <div className="operator-slip-draft-head">
                          <div>
                            <div className="ui-eyebrow">โพยที่กำลังคีย์</div>
                            <h4 className="card-title" style={{ marginBottom: 0 }}>รวมเลขตามชุดเดิมพันและยอดซื้อ</h4>
                          </div>
                          <div className="ops-table-note">
                            {selectedLottery?.name || '-'} • {selectedRound?.title || '-'}
                          </div>
                        </div>
                        <div className="operator-slip-group-list">
                          {gridDraftGroups.map((group) => (
                            <div key={group.key} className="card operator-slip-group-card">
                              <div className="operator-slip-group-side">
                                <div className="operator-slip-family">{group.familyLabel}</div>
                                <div className="operator-slip-combo">{group.comboLabel}</div>
                                <div className="operator-slip-amount">{group.amountLabel}</div>
                              </div>
                              <div className="operator-slip-group-body">
                                <div className="operator-slip-group-head">
                                  <span className="ops-table-note">{group.itemCount} รายการ</span>
                                  <strong>{money(group.totalAmount)} บาท</strong>
                                </div>
                                <div className="operator-slip-numbers">{group.numbersText}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}

                {hasSavedDraftEntries ? (
                  <div className="card operator-saved-drafts-panel">
                    <div className="operator-slip-draft-head">
                      <div>
                        <div className="ui-eyebrow">รายการที่บันทึกไว้</div>
                        <h4 className="card-title" style={{ marginBottom: 0 }}>ชุดรายการที่เตรียมรวมเป็นโพยเดียว</h4>
                      </div>
                      <div className="ops-table-note">{savedDraftEntries.length} ชุด</div>
                    </div>
                    <div className="operator-saved-draft-list">
                      {savedDraftEntries.map((entry, index) => (
                        <div key={entry.id} className="card operator-saved-draft-item">
                          <div className="operator-saved-draft-copy">
                            <strong>ชุดที่ {index + 1}</strong>
                            <div className="ops-table-note">{entry.itemCount} รายการ • {money(entry.totalAmount)} บาท</div>
                            {entry.groups?.length ? (
                              <div className="ops-table-note">
                                {entry.groups.map((group) => `${group.familyLabel} ${group.comboLabel} ${group.amountLabel}`).join(' • ')}
                              </div>
                            ) : null}
                            {entry.memo ? <div className="ops-table-note">บันทึก: {entry.memo}</div> : null}
                          </div>
                          <div className="operator-saved-draft-actions">
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleEditSavedDraftEntry(entry.id)}>
                              แก้ไข
                            </button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveSavedDraftEntry(entry.id)}>
                              ลบ
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {combinedDraftGroups.length ? (
                  <div className="card operator-slip-draft-panel">
                    <div className="operator-slip-draft-head">
                      <div>
                        <div className="ui-eyebrow">โพยที่กำลังคีย์</div>
                        <h4 className="card-title" style={{ marginBottom: 0 }}>รวมเลขทั้งหมดในโพยรอบนี้</h4>
                      </div>
                      <div className="ops-table-note">{selectedLottery?.name || '-'} • {selectedRound?.title || '-'}</div>
                    </div>
                    <div className="operator-slip-group-list">
                      {combinedDraftGroups.map((group) => (
                        <div key={group.key} className="card operator-slip-group-card">
                          <div className="operator-slip-group-side">
                            <div className="operator-slip-family">{group.familyLabel}</div>
                            <div className="operator-slip-combo">{group.comboLabel}</div>
                            <div className="operator-slip-amount">{group.amountLabel}</div>
                          </div>
                          <div className="operator-slip-group-body">
                            <div className="operator-slip-group-head">
                              <span className="ops-table-note">{group.itemCount} รายการ</span>
                              <strong>{money(group.totalAmount)} บาท</strong>
                            </div>
                            <div className="operator-slip-numbers">{group.numbersText}</div>
                            <div className="ops-table-note">จ่ายสูงสุด {money(group.potentialPayout)} บาท</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="operator-helper-row compact operator-staged-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleSaveDraftEntry} disabled={!selectedMember || !hasDraftItems}>
                    <FiFileText /> บันทึกไว้
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenPreviewDialog} disabled={previewing || !selectedMember || !hasPendingSlip}>
                    {previewing ? <FiRefreshCw className="spin-animation" /> : <FiCheckCircle />} สรุปโพย
                  </button>
                </div>
                <div className="bet-note" style={{ marginTop: 16 }}><FiAlertCircle /><span>ระบบจะตรวจสิทธิ์ของสมาชิก เรท ลิมิต และเลขที่ปิดรับก่อนสร้างโพยทุกครั้ง</span></div>
              </>
            )}
          </section>

          <aside className="card ops-section operator-preview-panel">
              <div className="ui-panel-head">
                <div><div className="ui-eyebrow">ตัวอย่างโพย</div><h3 className="card-title">รีวิวก่อนบันทึกรายการซื้อ</h3></div>
              <button className="btn btn-secondary btn-sm" onClick={handleOpenPreviewDialog} disabled={previewing || !selectedMember || !hasPendingSlip}>{previewing ? <FiRefreshCw className="spin-animation" /> : <FiCheckCircle />} เปิดหน้าสรุปโพย</button>
              </div>

            {!preview ? (
              <div className="empty-state operator-preview-empty">
                <div className="empty-state-icon"><FiLayers /></div>
                <div className="empty-state-text">เตรียมรายการซื้อแล้วกดเปิดหน้าสรุปโพย เพื่อคัดลอกข้อความ คัดลอกรูป และตรวจสอบก่อนบันทึกเข้าระบบ</div>
              </div>
            ) : (
              <>
                <div className="card operator-preview-meta">
                  <div>
                    <strong>ซื้อแทน:</strong> {preview.member?.name || selectedMember?.name}
                    <span className="ops-table-note">
                      @{preview.member?.username || selectedMember?.username || '-'} • ได้เสีย {money(preview.member?.totals?.netProfit || selectedMember?.totals?.netProfit)} บาท
                    </span>
                  </div>
                  <div style={{ marginTop: 6 }}><strong>ผู้ทำรายการ:</strong> {preview.placedBy?.name || user?.name} <span className="ops-table-note">{copy.actorLabel}</span></div>
                </div>
                <div className="operator-preview-summary">
                  <div className="card" style={{ padding: 12 }}><div className="ops-table-note" style={{ margin: 0 }}>จำนวนรายการ</div><strong>{preview.summary?.itemCount || 0}</strong></div>
                  <div className="card" style={{ padding: 12 }}><div className="ops-table-note" style={{ margin: 0 }}>ยอดรวม</div><strong>{money(preview.summary?.totalAmount)} บาท</strong></div>
                  <div className="card" style={{ padding: 12 }}><div className="ops-table-note" style={{ margin: 0 }}>จ่ายสูงสุด</div><strong>{money(preview.summary?.potentialPayout)} บาท</strong></div>
                  <div className="card" style={{ padding: 12 }}><div className="ops-table-note" style={{ margin: 0 }}>สถานะงวด</div><strong>{getRoundStatusLabel(preview.roundStatus?.status)}</strong></div>
                </div>
                <div className="operator-preview-list operator-slip-group-list">
                  {previewGroups.map((group) => (
                    <div key={group.key} className="card operator-slip-group-card operator-slip-group-card-compact">
                      <div className="operator-slip-group-side">
                        <div className="operator-slip-family">{group.familyLabel}</div>
                        <div className="operator-slip-combo">{group.comboLabel}</div>
                        <div className="operator-slip-amount">{group.amountLabel}</div>
                      </div>
                      <div className="operator-slip-group-body">
                        <div className="operator-slip-group-head">
                          <span className="ops-table-note">{group.itemCount} รายการ</span>
                          <strong>{money(group.totalAmount)} บาท</strong>
                        </div>
                        <div className="operator-slip-numbers">{group.numbersText}</div>
                        <div className="ops-table-note">จ่ายสูงสุด {money(group.potentialPayout)} บาท</div>
                      </div>
                    </div>
                  ))}
                </div>
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
              <button className="btn btn-primary" onClick={handleOpenPreviewDialog} disabled={previewing || !selectedMember || !hasPendingSlip}><FiCheckCircle /> {previewing ? 'กำลังเตรียมสรุปโพย...' : 'รีวิวและบันทึกโพย'}</button>
              {!canSubmit && selectedMember ? <div className="submit-warning">งวดนี้ไม่ได้อยู่ในสถานะเปิดรับ จึงยังบันทึกโพยเข้าระบบไม่ได้ แต่สามารถคัดลอกข้อความหรือรูปโพยให้ลูกค้าตรวจสอบได้</div> : null}
            </div>
          </aside>

          {previewDialogOpen && preview ? (
            <div className="modal-overlay" onClick={() => setPreviewDialogOpen(false)}>
              <div className="modal operator-preview-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <div className="ui-eyebrow">สรุปโพยดิจิทัล</div>
                    <h3 className="modal-title">ตรวจสอบก่อนบันทึกโพย</h3>
                  </div>
                  <button type="button" className="modal-close" onClick={() => setPreviewDialogOpen(false)} aria-label="ปิดหน้าต่าง">
                    <FiX />
                  </button>
                </div>

                <div className="card operator-preview-meta">
                  <div>
                    <strong>ซื้อแทน:</strong> {preview.member?.name || selectedMember?.name}
                    <span className="ops-table-note">
                      @{preview.member?.username || selectedMember?.username || '-'} • ได้เสีย {money(preview.member?.totals?.netProfit || selectedMember?.totals?.netProfit)} บาท
                    </span>
                  </div>
                  <div style={{ marginTop: 6 }}><strong>ผู้ทำรายการ:</strong> {preview.placedBy?.name || user?.name} <span className="ops-table-note">{copy.actorLabel}</span></div>
                </div>
                <div className="operator-preview-summary">
                  <div className="card" style={{ padding: 12 }}><div className="ops-table-note" style={{ margin: 0 }}>จำนวนรายการ</div><strong>{preview.summary?.itemCount || 0}</strong></div>
                  <div className="card" style={{ padding: 12 }}><div className="ops-table-note" style={{ margin: 0 }}>ยอดรวม</div><strong>{money(preview.summary?.totalAmount)} บาท</strong></div>
                  <div className="card" style={{ padding: 12 }}><div className="ops-table-note" style={{ margin: 0 }}>จ่ายสูงสุด</div><strong>{money(preview.summary?.potentialPayout)} บาท</strong></div>
                  <div className="card" style={{ padding: 12 }}><div className="ops-table-note" style={{ margin: 0 }}>สถานะงวด</div><strong>{getRoundStatusLabel(preview.roundStatus?.status)}</strong></div>
                </div>
                <div className="operator-preview-list operator-slip-group-list">
                  {previewGroups.map((group) => (
                    <div key={group.key} className="card operator-slip-group-card operator-slip-group-card-compact">
                      <div className="operator-slip-group-side">
                        <div className="operator-slip-family">{group.familyLabel}</div>
                        <div className="operator-slip-combo">{group.comboLabel}</div>
                        <div className="operator-slip-amount">{group.amountLabel}</div>
                      </div>
                      <div className="operator-slip-group-body">
                        <div className="operator-slip-group-head">
                          <span className="ops-table-note">{group.itemCount} รายการ</span>
                          <strong>{money(group.totalAmount)} บาท</strong>
                        </div>
                        <div className="operator-slip-numbers">{group.numbersText}</div>
                        <div className="ops-table-note">จ่ายสูงสุด {money(group.potentialPayout)} บาท</div>
                      </div>
                    </div>
                  ))}
                </div>
                {preview.memo ? (
                  <div className="card operator-preview-note">
                    <div className="ops-table-note" style={{ margin: 0 }}>บันทึกช่วยจำ</div>
                    <strong>{preview.memo}</strong>
                  </div>
                ) : null}

                <div className="modal-footer operator-preview-modal-actions">
                  <button className="btn btn-secondary" onClick={handleCopyAsText} disabled={copyingText || copyingImage || submitting}>
                    <FiFileText /> {copyingText ? 'กำลังคัดลอกข้อความ...' : 'คัดลอกข้อความ'}
                  </button>
                  <button className="btn btn-secondary" onClick={handleCopyAsImage} disabled={copyingText || copyingImage || submitting}>
                    <FiCopy /> {copyingImage ? 'กำลังคัดลอกโพยเป็นรูป...' : 'คัดลอกโพยเป็นรูป'}
                  </button>
                  <button className="btn btn-primary" onClick={handleSubmitSlip} disabled={copyingText || copyingImage || submitting || !canSubmit}>
                    <FiSend /> {submitting ? 'กำลังบันทึกโพย...' : 'บันทึกโพย'}
                  </button>
                </div>
                {!canSubmit ? <div className="submit-warning">งวดนี้ไม่ได้อยู่ในสถานะเปิดรับ จึงยังบันทึกโพยเข้าระบบไม่ได้ แต่สามารถคัดลอกข้อความหรือรูปโพยเพื่อส่งให้ลูกค้าตรวจสอบได้</div> : null}
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
};

export default OperatorBetting;
