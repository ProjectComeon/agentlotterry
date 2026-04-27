import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { startTransition, useDeferredValue } from 'react';
import toast from 'react-hot-toast';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
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
  FiX
} from 'react-icons/fi';
import GroupedSlipSummary from '../../components/GroupedSlipSummary';
import PageSkeleton from '../../components/PageSkeleton';
import { useAuth } from '../../context/AuthContext';
import { operatorBettingCopy } from '../../i18n/th/operatorBetting';
import { getBetTypeLabel, getRoundStatusLabel, getSourceFlagLabel } from '../../i18n/th/labels';
import {
  clearAdminBettingDraft,
  createAdminBettingSlip,
  createAgentBettingSlip,
  getAdminBettingDraft,
  getAdminBettingMemberContext,
  getAdminRecentBettingItems,
  clearAgentBettingDraft,
  getAgentBettingDraft,
  getAgentBettingMemberContext,
  getAgentRecentBettingItems,
  getCatalogRounds,
  parseAdminBettingSlip,
  parseAgentBettingSlip,
  saveAdminBettingDraft,
  saveAgentBettingDraft,
  searchAdminBettingMembers,
  searchAgentBettingMembers
} from '../../services/api';
import { formatDateTime, formatMoney as money, formatRoundLabel } from '../../utils/formatters';
import { buildSelectableRounds, shouldFetchRoundsForLottery } from '../../utils/operatorBettingRounds';
import { getEnabledFieldOrder, getFastKeyboardAction } from '../../utils/operatorBettingKeyboard';
import { buildSlipDisplayGroups } from '../../utils/slipGrouping';

const RECENT_MARKETS_LIMIT = 6;
const CLOSING_SOON_LIMIT = 6;
const FAVORITE_MARKETS_LIMIT = 8;
const MARKET_CATEGORY_ORDER = ['main', 'stock_am', 'stock_pm', 'vip', 'foreign', 'daily', 'other'];
const MARKET_CATEGORY_LABELS = {
  main: 'หวยหลัก',
  stock_am: 'หุ้นเช้า',
  stock_pm: 'หุ้นบ่าย',
  vip: 'VIP / พิเศษ',
  foreign: 'ต่างประเทศ',
  daily: 'ลาว / รายวัน',
  other: 'อื่น ๆ'
};
const doubleSetCounts = {
  1: 10,
  2: 10,
  3: 270
};
const LAO_SET_BET_TYPE = 'lao_set4';
const LAO_SET_AMOUNT = '120';
const LAO_SET_MAX_PRIZE = 150000;
const fallbackFastRates = {
  '3top': 1000,
  '3front': 450,
  '3bottom': 450,
  '3tod': 150,
  '2top': 100,
  '2bottom': 100,
  'run_top': 3.5,
  'run_bottom': 4.5,
  [LAO_SET_BET_TYPE]: 1
};

const buildInitialFastAmounts = () => ({
  top: '',
  front: '',
  bottom: '',
  tod: '',
  set: LAO_SET_AMOUNT
});

const buildEmptyGridAmounts = () => ({
  top: '',
  front: '',
  bottom: '',
  tod: ''
});

const TWO_DIGIT_COLUMN_DEFS = [
  { key: 'top', betType: '2top' },
  { key: 'bottom', betType: '2bottom' }
];

const THREE_DIGIT_COLUMN_DEFS = [
  { key: 'top', betType: '3top' },
  { key: 'front', betType: '3front' },
  { key: 'bottom', betType: '3bottom' },
  { key: 'tod', betType: '3tod' }
];

const RUN_COLUMN_DEFS = [
  { key: 'top', betType: 'run_top' },
  { key: 'bottom', betType: 'run_bottom' }
];

const getDigitModeColumnDefs = (digitMode = '2', supportedBetTypes = []) => {
  const baseColumns = digitMode === '3' ? THREE_DIGIT_COLUMN_DEFS : TWO_DIGIT_COLUMN_DEFS;
  if (!supportedBetTypes?.length) {
    return baseColumns;
  }

  return baseColumns.filter((column) => supportedBetTypes.includes(column.betType));
};

const fastFamilyOptions = [
  {
    value: '2',
    label: '2 ตัว',
    digits: 2,
    columns: TWO_DIGIT_COLUMN_DEFS
  },
  {
    value: '3',
    label: '3 ตัว',
    digits: 3,
    columns: THREE_DIGIT_COLUMN_DEFS
  },
  {
    value: 'run',
    label: 'วิ่ง',
    digits: 1,
    columns: RUN_COLUMN_DEFS
  },
  {
    value: 'lao_set',
    label: 'หวยชุดลาว',
    digits: 4,
    fixedAmount: Number(LAO_SET_AMOUNT),
    columns: [
      { key: 'set', betType: LAO_SET_BET_TYPE }
    ]
  }
];

const generatedFastTabOptions = [
  { value: 'rood', label: 'รูด', familyValue: '2' },
  { value: 'win2', label: 'วิน2', familyValue: '2' },
  { value: 'win3', label: 'วิน3', familyValue: '3' }
];


const roleConfig = {
  agent: {
    title: 'ซื้อแทนสมาชิก',
    subtitle: 'ค้นหาสมาชิกแล้วส่งโพยแทนจากฝั่งเอเย่นต์ โดยใช้สิทธิ์ เรท และลิมิตของสมาชิกจริง',
    searchPlaceholder: 'ค้นหาด้วยชื่อ ชื่อผู้ใช้ หรือเบอร์โทร',
    pickerTitle: 'เลือกสมาชิกก่อนทำรายการ',
    pickerNote: 'ระบบจะแสดงเฉพาะสมาชิกที่อยู่ใต้เอเย่นต์คนนี้',
    actorLabel: 'เอเย่นต์',
    search: searchAgentBettingMembers,
    getContext: getAgentBettingMemberContext,
    getRecentItems: getAgentRecentBettingItems,
    getDraft: getAgentBettingDraft,
    saveDraft: saveAgentBettingDraft,
    clearDraft: clearAgentBettingDraft,
    parseSlip: parseAgentBettingSlip,
    createSlip: createAgentBettingSlip
  },
  admin: {
    title: 'ซื้อแทนสมาชิกในระบบ',
    subtitle: 'ผู้ดูแลสามารถค้นหาและส่งโพยแทนสมาชิกทุกสายงานได้จากหน้าเดียว',
    searchPlaceholder: 'ค้นหาด้วยชื่อ ชื่อผู้ใช้ หรือเบอร์โทร',
    pickerTitle: 'เลือกสมาชิกที่ต้องการซื้อแทน',
    pickerNote: 'ระบบจะแสดงสมาชิกทุกเอเย่นต์ที่ยังใช้งานอยู่',
    actorLabel: 'ผู้ดูแล',
    search: searchAdminBettingMembers,
    getContext: getAdminBettingMemberContext,
    getRecentItems: getAdminRecentBettingItems,
    getDraft: getAdminBettingDraft,
    saveDraft: saveAdminBettingDraft,
    clearDraft: clearAdminBettingDraft,
    parseSlip: parseAdminBettingSlip,
    createSlip: createAdminBettingSlip
  }
};

const digitModeOptions = [
  { value: '2', label: '2 ตัว' },
  { value: '3', label: '3 ตัว' }
];

const copyText = operatorBettingCopy.common;
const copyMessages = operatorBettingCopy.messages;
const previewCopy = operatorBettingCopy.previewModal;

const getFastFamilyFromBetType = (betType = '') => {
  if (betType === LAO_SET_BET_TYPE) return 'lao_set';
  if (betType.startsWith('3')) return '3';
  if (betType.startsWith('2')) return '2';
  return 'run';
};

const buildFastAmountsForBetType = (betType = '', amount = '') => {
  const nextAmounts = buildInitialFastAmounts();

  if (betType === LAO_SET_BET_TYPE) {
    nextAmounts.set = LAO_SET_AMOUNT;
    return nextAmounts;
  }

  if (betType.endsWith('top')) nextAmounts.top = String(amount || '');
  if (betType === '3front') nextAmounts.front = String(amount || '');
  if (betType.endsWith('bottom')) nextAmounts.bottom = String(amount || '');
  if (betType.endsWith('tod')) nextAmounts.tod = String(amount || '');
  return nextAmounts;
};

const getFastColumnAmount = (config, column, amounts = {}) => {
  if (config.fixedAmount && column.key === 'set') {
    return Number(config.fixedAmount || 0);
  }

  return Number(amounts?.[column.key] || 0);
};

fastFamilyOptions.forEach((option) => {
  const nextOption = operatorBettingCopy.fastFamilyOptions.find((item) => item.value === option.value);
  if (nextOption?.label) option.label = nextOption.label;
});

digitModeOptions.forEach((option) => {
  const nextOption = operatorBettingCopy.digitModeOptions.find((item) => item.value === option.value);
  if (nextOption?.label) option.label = nextOption.label;
});

Object.assign(roleConfig.agent, operatorBettingCopy.roles.agent);
Object.assign(roleConfig.admin, operatorBettingCopy.roles.admin);

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
const dedupeOrderedNumbers = (numbers = []) => {
  const seen = new Set();
  return (numbers || []).filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};
const shouldDedupeFastNumbersForPricing = () => false;
const buildNumberCountMap = (numbers = []) => {
  const counts = new Map();
  (numbers || []).forEach((value) => {
    if (!value) return;
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return counts;
};
const sortMembersByActivity = (members = []) =>
  [...members].sort((left, right) => {
    const betDiff = Number(right?.totals?.totalBets || 0) - Number(left?.totals?.totalBets || 0);
    if (betDiff !== 0) return betDiff;
    const totalDiff = Number(right?.totals?.totalAmount || 0) - Number(left?.totals?.totalAmount || 0);
    if (totalDiff !== 0) return totalDiff;
    return String(left?.name || '').localeCompare(String(right?.name || ''), 'th');
  });
const flattenLotteries = (catalog) => (catalog?.leagues || []).flatMap((league) => (league.lotteries || []).map((lottery) => ({ ...lottery, leagueName: league.name })));
const lotteryThemePalette = [
  { bg: '#fff6e7', border: 'rgba(245, 158, 11, 0.24)', accent: '#d97706', soft: 'rgba(245, 158, 11, 0.12)' },
  { bg: '#effaf4', border: 'rgba(34, 197, 94, 0.24)', accent: '#15803d', soft: 'rgba(34, 197, 94, 0.12)' },
  { bg: '#eef6ff', border: 'rgba(59, 130, 246, 0.24)', accent: '#2563eb', soft: 'rgba(59, 130, 246, 0.12)' },
  { bg: '#fff1f6', border: 'rgba(236, 72, 153, 0.24)', accent: '#db2777', soft: 'rgba(236, 72, 153, 0.12)' },
  { bg: '#f5f1ff', border: 'rgba(139, 92, 246, 0.24)', accent: '#7c3aed', soft: 'rgba(139, 92, 246, 0.12)' },
  { bg: '#ecfeff', border: 'rgba(6, 182, 212, 0.24)', accent: '#0f766e', soft: 'rgba(6, 182, 212, 0.12)' },
  { bg: '#fff7ed', border: 'rgba(249, 115, 22, 0.24)', accent: '#ea580c', soft: 'rgba(249, 115, 22, 0.12)' },
  { bg: '#eefdf5', border: 'rgba(16, 185, 129, 0.24)', accent: '#059669', soft: 'rgba(16, 185, 129, 0.12)' }
];
const hashLotterySeed = (value = '') =>
  String(value || '').split('').reduce((total, char) => total + char.charCodeAt(0), 0);
const getLotteryTheme = (lottery) => lotteryThemePalette[hashLotterySeed(lottery?.code || lottery?.id || lottery?.name) % lotteryThemePalette.length];
const getLotteryThemeStyle = (lottery) => {
  const theme = getLotteryTheme(lottery);
  return {
    '--lottery-bg': theme.bg,
    '--lottery-border': theme.border,
    '--lottery-accent': theme.accent,
    '--lottery-soft': theme.soft
  };
};
const getLotteryRoundStatus = (lottery) => lottery?.activeRound?.status || lottery?.status || 'missing';
const isLotteryOpen = (lottery) => getLotteryRoundStatus(lottery) === 'open';
const buildRecentMarketStorageKey = (role, userId) => `operator:recent-markets:${role}:${userId || 'anonymous'}`;
const buildFavoriteMarketStorageKey = (role, userId) => `operator:favorite-markets:${role}:${userId || 'anonymous'}`;
const normalizeMarketSearchToken = (value = '') => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const STOCK_AM_KEYWORDS = ['เช้า', 'นิเคอิเช้า', 'ฮั่งเส็งเช้า', 'หุ้นจีนเช้า', 'หุ้นไต้หวัน', 'หุ้นเกาหลี', 'หุ้นสิงคโปร์', 'หุ้นไทย'];
const STOCK_PM_KEYWORDS = ['บ่าย', 'นิเคอิบ่าย', 'จีนบ่าย', 'ฮั่งเส็งบ่าย', 'ดาวโจนส์', 'อังกฤษ', 'เยอรมัน', 'รัสเซีย', 'อียิปต์', 'อินเดีย'];
const getLotteryCloseAt = (lottery) => {
  const rawValue = lottery?.activeRound?.closeAt || lottery?.activeRound?.displayCloseAt || '';
  if (!rawValue) return null;
  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const matchesLotterySearch = (lottery, query) => {
  const normalizedQuery = normalizeMarketSearchToken(query);
  if (!normalizedQuery) return true;

  const searchableValues = [
    lottery?.name,
    lottery?.leagueName,
    lottery?.code,
    lottery?.activeRound?.code,
    lottery?.activeRound?.title,
    `${lottery?.leagueName || ''} ${lottery?.name || ''}`
  ]
    .map(normalizeMarketSearchToken)
    .filter(Boolean);

  return searchableValues.some((value) => value.includes(normalizedQuery));
};
const sortLotteriesForPicker = (left, right) => {
  const leftOpen = isLotteryOpen(left) ? 1 : 0;
  const rightOpen = isLotteryOpen(right) ? 1 : 0;
  if (leftOpen !== rightOpen) {
    return rightOpen - leftOpen;
  }

  const leftCloseAt = getLotteryCloseAt(left)?.getTime() || Number.MAX_SAFE_INTEGER;
  const rightCloseAt = getLotteryCloseAt(right)?.getTime() || Number.MAX_SAFE_INTEGER;
  if (leftCloseAt !== rightCloseAt) {
    return leftCloseAt - rightCloseAt;
  }

  const leagueDiff = String(left?.leagueName || '').localeCompare(String(right?.leagueName || ''), 'th');
  if (leagueDiff !== 0) return leagueDiff;
  return String(left?.name || '').localeCompare(String(right?.name || ''), 'th');
};
const getLotteryPickerCategory = (lottery) => {
  const league = normalizeMarketSearchToken(lottery?.leagueName);
  const name = normalizeMarketSearchToken(lottery?.name);

  if (league.includes('รัฐบาล') || name.includes('ธกส') || name.includes('ออมสิน')) {
    return 'main';
  }

  if (league.includes('หุ้น')) {
    if (STOCK_AM_KEYWORDS.some((keyword) => name.includes(normalizeMarketSearchToken(keyword)))) {
      return 'stock_am';
    }
    return 'stock_pm';
  }

  if (league.includes('vip') || name.includes('vip') || name.includes('พิเศษ') || name.includes('extra') || name.includes('ยี่กี')) {
    return 'vip';
  }

  if (league.includes('ต่างประเทศ') || name.includes('ฮานอย') || name.includes('มาเลย์')) {
    return 'foreign';
  }

  if (league.includes('รายวัน') || name.includes('ลาว')) {
    return 'daily';
  }

  return 'other';
};
const groupLotteriesByCategory = (lotteries = []) => {
  const groups = new Map();
  MARKET_CATEGORY_ORDER.forEach((key) => groups.set(key, []));

  lotteries.forEach((lottery) => {
    const category = getLotteryPickerCategory(lottery);
    const current = groups.get(category) || [];
    current.push(lottery);
    groups.set(category, current);
  });

  return MARKET_CATEGORY_ORDER
    .map((key) => ({
      key,
      label: MARKET_CATEGORY_LABELS[key],
      items: (groups.get(key) || []).sort(sortLotteriesForPicker)
    }))
    .filter((group) => group.items.length);
};
const buildEmptyGridRow = () => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, number: '', amounts: buildEmptyGridAmounts() });
const buildInitialGridRows = () => Array.from({ length: 2 }, buildEmptyGridRow);
const cloneGridRows = (rows = []) =>
  rows.map((row) => ({
    id: buildEmptyGridRow().id,
    number: row.number || '',
    amounts: {
      ...buildEmptyGridAmounts(),
      ...row.amounts
    }
  }));

const reverseGridNumber = (value) => {
  const digits = normalizeDigits(value);
  if (!digits) return '';
  return digits.split('').reverse().join('');
};

const buildGridReverseNumbers = (value, digitMode) => {
  const digits = normalizeDigits(value);
  const expectedLength = Number(digitMode || 2);

  if (!digits || digits.length !== expectedLength) {
    return [];
  }

  if (expectedLength === 3) {
    return buildDraftPermutations(digits);
  }

  return dedupeOrderedNumbers([digits, reverseGridNumber(digits)]);
};

const buildSavedDraftEntry = (entry = {}) => {
  const items = Array.isArray(entry?.items) ? entry.items.filter(Boolean) : [];

  return {
    id: entry?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    items,
    groups: buildSlipDisplayGroups(items),
    memo: entry?.memo || '',
    source: entry?.source || null,
    totalAmount: items.reduce((sum, item) => sum + Number(item?.amount || 0), 0),
    itemCount: items.length
  };
};

const toDraftPayloadEntries = (entries = []) =>
  (Array.isArray(entries) ? entries : []).map((entry) => ({
    id: entry.id,
    memo: entry.memo || '',
    source: entry.source || null,
    items: Array.isArray(entry.items)
      ? entry.items.map((item) => ({
          betType: item.betType,
          number: item.number,
          amount: item.amount,
          sourceFlags: item.sourceFlags || {}
        }))
      : []
  }));

const getFastFamilyConfig = (fastFamily, supportedBetTypes = []) => {
  const matched = fastFamilyOptions.find((option) => option.value === fastFamily) || fastFamilyOptions[0];
  const filterColumns = (columns) => {
    if (!supportedBetTypes?.length) {
      return columns;
    }

    return columns.filter((column) => supportedBetTypes.includes(column.betType));
  };

  if (fastFamily === '2') {
    return {
      ...matched,
      label: '2 ตัว',
      columns: filterColumns(matched.columns)
    };
  }

  if (fastFamily === '3') {
    return {
      ...matched,
      label: '3 ตัว',
      columns: filterColumns(matched.columns)
    };
  }

  if (fastFamily === 'run') {
    return {
      ...matched,
      label: 'วิ่ง',
      columns: filterColumns(matched.columns)
    };
  }

  if (fastFamily === 'lao_set') {
    return { ...matched, label: 'หวยชุดลาว' };
  }

  return matched;
};

const splitDigitTokenBySize = (token, digits) => {
  const raw = normalizeDigits(token);
  if (!raw) return [];

  if (digits === 1) {
    return raw.split('');
  }

  const chunks = [];
  for (let index = 0; index + digits <= raw.length; index += digits) {
    chunks.push(raw.slice(index, index + digits));
  }

  return chunks;
};

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
      const tokens = line.match(/\d+/g) || [];

      tokens
        .flatMap((token) =>
          digits === 1 || tokens.length === 1
            ? splitDigitTokenBySize(token, digits)
            : token.length === digits
              ? [token]
              : []
        )
        .filter((token) => token.length === digits)
        .forEach((token) => numbers.push(token));
    });

  return numbers;
};

const extractFastDiscardedTokensByDigits = (rawInput, digits) => {
  const discardedTokens = [];
  const digitLength = Number(digits || 0);
  if (!digitLength) return discardedTokens;

  String(rawInput || '')
    .split(/\r?\n/)
    .forEach((line) => {
      const sourceTokens = String(line || '').match(/\d+|[^\d\s]+/g) || [];
      const numericTokens = sourceTokens.filter((token) => /^\d+$/.test(token));

      sourceTokens.forEach((token) => {
        if (!/^\d+$/.test(token)) {
          discardedTokens.push(token);
          return;
        }

        if (digitLength === 1 || numericTokens.length === 1) {
          const acceptedLength = splitDigitTokenBySize(token, digitLength).join('').length;
          const remainder = token.slice(acceptedLength);
          if (remainder) discardedTokens.push(remainder);
          return;
        }

        if (token.length !== digitLength) {
          discardedTokens.push(token);
        }
      });
    });

  return discardedTokens;
};

const getFastEnabledColumns = ({ fastFamily, supportedBetTypes = [], closedBetTypes = [] }) => {
  const config = getFastFamilyConfig(fastFamily, supportedBetTypes);
  const supported = new Set(supportedBetTypes);
  const closed = new Set(closedBetTypes);

  return config.columns.reduce((acc, column) => {
    acc[column.key] = supported.has(column.betType) && !closed.has(column.betType);
    return acc;
  }, {});
};

const getFastDraftSummary = ({
  parsedCandidates,
  activeNumbers,
  parsedEntryCount,
  selectedEntryCount,
  fastFamily,
  includeDoubleSet,
  reverse,
  fastAmounts,
  supportedBetTypes,
  closedBetTypes
}) => {
  const config = getFastFamilyConfig(fastFamily, supportedBetTypes);
  const enabledColumns = getFastEnabledColumns({
    fastFamily,
    supportedBetTypes,
    closedBetTypes
  });
  const pricedColumns = config.columns.filter((column) => enabledColumns[column.key] && getFastColumnAmount(config, column, fastAmounts) > 0).length;
  const activeAmounts = config.columns
    .filter((column) => enabledColumns[column.key] && getFastColumnAmount(config, column, fastAmounts) > 0)
    .map((column) => `${getBetTypeLabel(column.betType)} ${money(getFastColumnAmount(config, column, fastAmounts))}`);

  return {
    parsedCount: parsedEntryCount ?? parsedCandidates.length,
    selectedCount: selectedEntryCount ?? activeNumbers.length,
    helperCount: includeDoubleSet && config.digits > 1 ? doubleSetCounts[config.digits] || 0 : 0,
    reverseEnabled: Boolean(reverse),
    pricedColumns,
    activeAmountSummary: activeAmounts.join(' • ') || 'ยังไม่ใส่ยอด'
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

const buildFilledGridRows = (entries) => {
  const rows = entries.map((entry) => ({
    id: buildEmptyGridRow().id,
    number: entry.number || '',
    amounts: {
      ...buildEmptyGridAmounts(),
      ...entry.amounts
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
            front: parts[2] || '',
            bottom: parts[3] || '',
            tod: parts[4] || ''
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
      defaultAmount:
        betType === LAO_SET_BET_TYPE
          ? LAO_SET_AMOUNT
          : uniqueAmounts.length === 1
            ? String(uniqueAmounts[0])
            : '',
      rawInput:
        uniqueAmounts.length === 1
          ? items.map((item) => item.number).join('\n')
          : items.map((item) => `${item.number} ${item.amount}`).join('\n')
    };
  }

  const isTwoDigitGrid = items.every((item) => ['2top', '2bottom'].includes(item.betType));
  const isThreeDigitGrid = items.every((item) => ['3top', '3front', '3bottom', '3tod'].includes(item.betType));

  if (!isTwoDigitGrid && !isThreeDigitGrid) {
    return null;
  }

  const digitMode = isThreeDigitGrid ? '3' : '2';
  const map = new Map();

  items.forEach((item) => {
    const current = map.get(item.number) || {
      number: item.number,
      amounts: { top: '', front: '', bottom: '', tod: '' }
    };

    if (item.betType.endsWith('top')) current.amounts.top = String(item.amount || '');
    if (item.betType === '3front') current.amounts.front = String(item.amount || '');
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

const buildGridItems = ({ rows, digitMode, supportedBetTypes = [] }) => {
  const digits = Number(digitMode || 2);
  const items = [];
  const columnDefs = getDigitModeColumnDefs(digitMode, supportedBetTypes);

  rows.forEach((row) => {
    const number = normalizeDigits(row.number);
    if (!number) return;
    if (number.length !== digits) throw new Error(`โหมด ${digitMode} ตัว ต้องกรอกหมายเลข ${digits} หลัก`);
    columnDefs.forEach(({ key, betType }) => {
      const amount = Number(row.amounts?.[key] || 0);
      if (amount > 0) items.push({ betType, number, amount });
    });
  });

  if (!items.length) throw new Error('กรุณากรอกหมายเลขและยอดอย่างน้อย 1 รายการ');
  return items;
};

const buildDraftDoubleSet = (digits) => {
  if (digits === 1) {
    return Array.from({ length: 10 }, (_, index) => String(index));
  }

  if (digits === 2) {
    return Array.from({ length: 10 }, (_, index) => `${index}${index}`);
  }

  if (digits !== 3) {
    return [];
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

const extractFastSeedDigits = (rawInput) => extractUniqueDigits([String(rawInput || '').replace(/\D/g, '')]);

const buildDraftWinNumbers = (seedDigits = [], digits) => {
  const source = dedupeOrderedNumbers(seedDigits).slice(0, 10);
  if (source.length < digits) return [];

  const values = [];
  const walk = (prefix, remaining) => {
    if (prefix.length === digits) {
      values.push(prefix.join(''));
      return;
    }

    remaining.forEach((digit, index) => {
      const nextRemaining = remaining.filter((_, remainingIndex) => remainingIndex !== index);
      walk([...prefix, digit], nextRemaining);
    });
  };

  walk([], source);
  return dedupeOrderedNumbers(values);
};

const sanitizeSeedDigitsInput = (value) => extractFastSeedDigits(value).join('');

const toggleSeedDigitInput = (value, digit) => {
  const current = extractFastSeedDigits(value);
  if (current.includes(digit)) {
    return current.filter((item) => item !== digit).join('');
  }
  return [...current, digit].join('');
};

const buildDraftRoodNumbers = (seedDigits = []) => {
  const numbers = [];

  (seedDigits || []).forEach((seedDigit) => {
    for (let digit = 0; digit <= 9; digit += 1) {
      if (seedDigit === String(digit)) {
        numbers.push(`${seedDigit}${digit}`);
        continue;
      }

      numbers.push(`${seedDigit}${digit}`);
      numbers.push(`${digit}${seedDigit}`);
    }
  });

  return numbers;
};

const buildDraftRoodNumberCounts = (seedDigits = []) => buildNumberCountMap(buildDraftRoodNumbers(seedDigits));

const buildDraftTongNumbers = () =>
  Array.from({ length: 10 }, (_, index) => `${index}${index}${index}`);

const getFastCandidateCount = (candidateCounts, number) => {
  if (candidateCounts instanceof Map) {
    return Number(candidateCounts.get(number) || 1);
  }

  return Number(candidateCounts?.[number] || 1);
};

const getRateDisplayText = (betType, rates = {}) => (
  betType === LAO_SET_BET_TYPE
    ? `ชุดละ ${LAO_SET_AMOUNT} / สูงสุด ${LAO_SET_MAX_PRIZE.toLocaleString('th-TH')}`
    : `x${rates?.[betType] ?? fallbackFastRates[betType] ?? 0}`
);

const calculateDraftPotentialPayout = (item) => (
  item?.betType === LAO_SET_BET_TYPE
    ? Math.floor(Number(item?.amount || 0) / Number(LAO_SET_AMOUNT)) * LAO_SET_MAX_PRIZE
    : Number(item?.amount || 0) * Number(item?.payRate || 0)
);

const expandFastDraftNumbers = (number, betType, reverse) => {
  if (!reverse) return [number];

  if (betType === '2top' || betType === '2bottom') {
    const reversed = number.split('').reverse().join('');
    return reversed === number ? [number] : [number, reversed];
  }

  if (betType === '3top' || betType === '3front' || betType === '3bottom' || betType === '3tod') {
    return buildDraftPermutations(number);
  }

  return [number];
};

const combineFastDraftItems = (items) => {
  return (items || []).map((item, index) => ({
    ...item,
    draftKey: item.draftKey || `${item.betType}:${item.number}:${index}`,
    potentialPayout: calculateDraftPotentialPayout(item)
  }));
};

const buildFastWorkingNumbers = ({
  fastFamily,
  fastTab,
  rawInput,
  numbers,
  reverse,
  includeDoubleSet
}) => {
  const config = getFastFamilyConfig(fastFamily);
  const buildNormalWorkingNumbers = (sourceNumbers = []) => {
    const previewBetType = config.columns[0]?.betType || '';
    const workingNumbers = [];

    sourceNumbers.forEach((number) => {
      expandFastDraftNumbers(number, previewBetType, reverse).forEach((expandedNumber) => {
        if (normalizeDigits(expandedNumber).length === config.digits) {
          workingNumbers.push(expandedNumber);
        }
      });
    });

    if (includeDoubleSet && config.digits > 1) {
      buildDraftDoubleSet(config.digits).forEach((number) => workingNumbers.push(number));
    }

    return workingNumbers;
  };

  if (Array.isArray(numbers)) {
    const sourceNumbers = numbers.filter((number) => normalizeDigits(number).length === config.digits);
    if (fastTab === 'rood' || fastTab === 'win2' || fastTab === 'win3') {
      return sourceNumbers;
    }
    return buildNormalWorkingNumbers(sourceNumbers);
  }

  if (fastTab === 'rood') {
    const seedDigits = extractFastSeedDigits(rawInput);
    if (!seedDigits.length) return [];
    return buildDraftRoodNumbers(seedDigits);
  }

  if (fastTab === 'win2' || fastTab === 'win3') {
    const digits = fastTab === 'win3' ? 3 : 2;
    const seedDigits = extractFastSeedDigits(rawInput);
    if (seedDigits.length < digits) return [];
    return buildDraftWinNumbers(seedDigits, digits);
  }

  const sourceNumbers = extractFastNumbersByDigits(rawInput, config.digits);
  return buildNormalWorkingNumbers(sourceNumbers);
};

const buildFastSourceNumbers = ({ fastFamily, fastTab, rawInput }) => {
  const config = getFastFamilyConfig(fastFamily);
  if (fastTab === 'rood' || fastTab === 'win2' || fastTab === 'win3') {
    return buildFastWorkingNumbers({
      fastFamily,
      fastTab,
      rawInput,
      reverse: false,
      includeDoubleSet: false
    });
  }

  return extractFastNumbersByDigits(rawInput, config.digits);
};

const buildFastDraftItems = ({
  fastFamily,
  fastTab,
  rawInput,
  numbers,
  reverse,
  includeDoubleSet,
  rates,
  amounts,
  supportedBetTypes,
  closedBetTypes,
  candidateCounts
}) => {
  const config = getFastFamilyConfig(fastFamily, supportedBetTypes);
  const enabledColumns = getFastEnabledColumns({
    fastFamily,
    supportedBetTypes,
    closedBetTypes
  });
  const activeNumbers = Array.isArray(numbers)
    ? numbers.filter((number) => normalizeDigits(number).length === config.digits)
    : buildFastWorkingNumbers({
        fastFamily,
        fastTab,
        rawInput,
        reverse,
        includeDoubleSet
      });

  const items = [];

  const appendNumberItems = (number) => {
    config.columns.forEach((column) => {
      const amount = getFastColumnAmount(config, column, amounts);
      const payRate = Number(rates?.[column.betType] ?? fallbackFastRates[column.betType] ?? 0);
      if (!enabledColumns[column.key] || amount <= 0 || payRate <= 0) return;

      items.push({
        betType: column.betType,
        number,
        amount,
        payRate,
        sourceFlags: {
          fromRood: fastTab === 'rood'
        }
      });
    });
  };

  activeNumbers.forEach((number) => {
    if (normalizeDigits(number).length !== config.digits) return;
    appendNumberItems(number);
  });

  return combineFastDraftItems(items);
};

const OperatorBetting = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = user?.role === 'admin' ? 'admin' : 'agent';
  const copy = roleConfig[role];

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [memberPickerOpen, setMemberPickerOpen] = useState(true);
  const [marketPickerOpen, setMarketPickerOpen] = useState(false);
  const [marketSearchText, setMarketSearchText] = useState('');
  const [favoriteMarketIds, setFavoriteMarketIds] = useState([]);
  const [recentMarketIds, setRecentMarketIds] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selection, setSelection] = useState({ lotteryId: '', roundId: '', rateProfileId: '' });
  const [showRates, setShowRates] = useState(false);
  const [rounds, setRounds] = useState([]);
  const [loadedRoundsLotteryId, setLoadedRoundsLotteryId] = useState('');
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [mode, setMode] = useState('fast');
  const [fastFamily, setFastFamily] = useState('2');
  const [fastTab, setFastTab] = useState('2');
  const [digitMode, setDigitMode] = useState('2');
  const [fastAmounts, setFastAmounts] = useState(buildInitialFastAmounts);
  const [rawInput, setRawInput] = useState('');
  const [helperFastNumbers, setHelperFastNumbers] = useState([]);
  const [excludedFastNumbers, setExcludedFastNumbers] = useState([]);
  const [parsedFastDiscardedTokens, setParsedFastDiscardedTokens] = useState([]);
  const [reverse, setReverse] = useState(false);
  const [includeDoubleSet, setIncludeDoubleSet] = useState(false);
  const [gridRows, setGridRows] = useState(buildInitialGridRows);
  const [gridBulkAmounts, setGridBulkAmounts] = useState(buildEmptyGridAmounts);
  const [memo, setMemo] = useState('');
  const [savedDraftEntries, setSavedDraftEntries] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [copyingImage, setCopyingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [recentItems, setRecentItems] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [expandedRecentGroups, setExpandedRecentGroups] = useState({});
  const gridCellRefs = useRef({});
  const fastAmountRefs = useRef({});
  const memberPickerRef = useRef(null);
  const marketPickerRef = useRef(null);
  const marketSearchInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const fastInputRef = useRef(null);
  const draftHydratingRef = useRef(false);
  const draftAutosaveTimerRef = useRef(null);
  const draftLoadedScopeRef = useRef('');
  const roundsRequestRef = useRef('');
  const recentItemsRequestRef = useRef('');
  const memberContextRequestRef = useRef(0);

  const flatLotteries = useMemo(() => flattenLotteries(catalog), [catalog]);
  const selectedLottery = useMemo(() => flatLotteries.find((item) => item.id === selection.lotteryId) || null, [flatLotteries, selection.lotteryId]);
  const selectedRateProfile = useMemo(() => selectedLottery?.rateProfiles?.find((item) => item.id === selection.rateProfileId) || selectedLottery?.rateProfiles?.[0] || null, [selectedLottery, selection.rateProfileId]);
  const selectedRound = useMemo(() => rounds.find((item) => item.id === selection.roundId) || selectedLottery?.activeRound || null, [rounds, selection.roundId, selectedLottery]);
  const selectedLotteryStatus = useMemo(() => getLotteryRoundStatus(selectedLottery), [selectedLottery]);
  const selectedLotteryThemeStyle = useMemo(() => getLotteryThemeStyle(selectedLottery), [selectedLottery]);
  const favoriteMarketStorageKey = useMemo(
    () => buildFavoriteMarketStorageKey(role, user?.id || user?._id || user?.username),
    [role, user?.id, user?._id, user?.username]
  );
  const recentMarketStorageKey = useMemo(
    () => buildRecentMarketStorageKey(role, user?.id || user?._id || user?.username),
    [role, user?.id, user?._id, user?.username]
  );
  const sortedSearchResults = useMemo(() => sortMembersByActivity(searchResults), [searchResults]);
  const filteredLotteries = useMemo(
    () => flatLotteries.filter((lottery) => matchesLotterySearch(lottery, marketSearchText)).sort(sortLotteriesForPicker),
    [flatLotteries, marketSearchText]
  );
  const favoriteLotteries = useMemo(() => {
    const seen = new Set();
    return favoriteMarketIds
      .map((lotteryId) => flatLotteries.find((lottery) => lottery.id === lotteryId))
      .filter((lottery) => {
        if (!lottery || seen.has(lottery.id) || !matchesLotterySearch(lottery, marketSearchText)) {
          return false;
        }
        seen.add(lottery.id);
        return true;
      })
      .slice(0, FAVORITE_MARKETS_LIMIT);
  }, [favoriteMarketIds, flatLotteries, marketSearchText]);
  const favoriteLotteryIdSet = useMemo(() => new Set(favoriteLotteries.map((lottery) => lottery.id)), [favoriteLotteries]);
  const recentLotteries = useMemo(() => {
    const seen = new Set();
    return recentMarketIds
      .map((lotteryId) => flatLotteries.find((lottery) => lottery.id === lotteryId))
      .filter((lottery) => {
        if (!lottery || favoriteLotteryIdSet.has(lottery.id) || seen.has(lottery.id) || !matchesLotterySearch(lottery, marketSearchText)) {
          return false;
        }
        seen.add(lottery.id);
        return true;
      })
      .slice(0, RECENT_MARKETS_LIMIT);
  }, [favoriteLotteryIdSet, flatLotteries, marketSearchText, recentMarketIds]);
  const recentLotteryIdSet = useMemo(() => new Set(recentLotteries.map((lottery) => lottery.id)), [recentLotteries]);
  const closingSoonLotteries = useMemo(
    () =>
      filteredLotteries
        .filter((lottery) => !favoriteLotteryIdSet.has(lottery.id) && !recentLotteryIdSet.has(lottery.id) && isLotteryOpen(lottery) && getLotteryCloseAt(lottery))
        .sort((left, right) => getLotteryCloseAt(left).getTime() - getLotteryCloseAt(right).getTime())
        .slice(0, CLOSING_SOON_LIMIT),
    [favoriteLotteryIdSet, filteredLotteries, recentLotteryIdSet]
  );
  const highlightedLotteryIdSet = useMemo(
    () => new Set([...favoriteLotteries, ...recentLotteries, ...closingSoonLotteries].map((lottery) => lottery.id)),
    [closingSoonLotteries, favoriteLotteries, recentLotteries]
  );
  const remainingLotteries = useMemo(
    () => filteredLotteries.filter((lottery) => !highlightedLotteryIdSet.has(lottery.id)),
    [filteredLotteries, highlightedLotteryIdSet]
  );
  const groupedRemainingLotteries = useMemo(
    () => groupLotteriesByCategory(remainingLotteries),
    [remainingLotteries]
  );
  const firstMarketSearchMatch = favoriteLotteries[0] || recentLotteries[0] || closingSoonLotteries[0] || remainingLotteries[0] || null;
  const selectableRounds = useMemo(
    () => buildSelectableRounds(rounds, selectedLottery?.activeRound || null),
    [rounds, selectedLottery?.activeRound]
  );
  const draftScopeParams = useMemo(() => {
    if (!selectedMember?.id || !selectedLottery?.id || !selectedRound?.id) {
      return null;
    }

    return {
      customerId: selectedMember.id,
      lotteryId: selectedLottery.id,
      roundId: selectedRound.id,
      rateProfileId: selectedRateProfile?.id || ''
    };
  }, [selectedLottery?.id, selectedMember?.id, selectedRateProfile?.id, selectedRound?.id]);
  const gridColumns = useMemo(
    () => getDigitModeColumnDefs(digitMode, selectedLottery?.supportedBetTypes || []),
    [digitMode, selectedLottery]
  );
  const roundClosedBetTypes = selectedRound?.closedBetTypes || [];
  const canSubmit = selectedRound?.status === 'open';
  const recentRoundCode = selectedRound?.code || '';
  const recentMarketId = selectedLottery?.code || selectedLottery?.id || '';
  const draftScopeKey = draftScopeParams
    ? [draftScopeParams.customerId, draftScopeParams.lotteryId, draftScopeParams.roundId, draftScopeParams.rateProfileId || ''].join(':')
    : '';
  const fastFamilyConfig = useMemo(
    () => getFastFamilyConfig(fastFamily, selectedLottery?.supportedBetTypes || []),
    [fastFamily, selectedLottery]
  );
  const usesWinSeedSelector = fastTab === 'win2' || fastTab === 'win3';
  const selectedSeedDigits = useMemo(() => extractFastSeedDigits(rawInput), [rawInput]);
  const enabledFastFamilies = useMemo(() => {
    const supported = new Set(selectedLottery?.supportedBetTypes || []);
    const closed = new Set(roundClosedBetTypes);

    return fastFamilyOptions.filter((option) =>
      option.columns.some((column) => supported.has(column.betType) && !closed.has(column.betType))
    );
  }, [roundClosedBetTypes, selectedLottery]);
  const visibleFastTabs = useMemo(() => {
    const families = enabledFastFamilies.length ? enabledFastFamilies : fastFamilyOptions;
    const tabs = families.map((option) => ({
      value: option.value,
      label: option.label,
      type: 'family'
    }));
    const familyValues = new Set(families.map((option) => option.value));

    generatedFastTabOptions.forEach((option) => {
      if (familyValues.has(option.familyValue)) {
        tabs.push({
          value: option.value,
          label: option.label,
          type: 'generated',
          familyValue: option.familyValue
        });
      }
    });

    return tabs;
  }, [enabledFastFamilies]);
  const supportedFastColumns = useMemo(
    () =>
      getFastEnabledColumns({
        fastFamily,
        supportedBetTypes: selectedLottery?.supportedBetTypes || [],
        closedBetTypes: roundClosedBetTypes
      }),
    [fastFamily, roundClosedBetTypes, selectedLottery]
  );
  const rawFastCandidateEntries = useMemo(() => {
    if (mode !== 'fast') return [];
    if (!String(rawInput || '').trim()) return [];
    return buildFastWorkingNumbers({
      fastFamily,
      fastTab,
      rawInput,
      reverse,
      includeDoubleSet
    });
  }, [fastFamily, fastTab, includeDoubleSet, mode, rawInput, reverse]);
  const parsedFastCandidateEntries = useMemo(() => {
    if (mode !== 'fast') return [];
    const helperEntries = helperFastNumbers.length
      ? buildFastWorkingNumbers({
          fastFamily,
          fastTab,
          rawInput: '',
          numbers: helperFastNumbers,
          reverse,
          includeDoubleSet
        })
      : [];
    return [...helperEntries, ...rawFastCandidateEntries];
  }, [fastFamily, fastTab, helperFastNumbers, includeDoubleSet, mode, rawFastCandidateEntries, reverse]);
  const parsedFastCandidates = useMemo(
    () => dedupeOrderedNumbers(parsedFastCandidateEntries),
    [parsedFastCandidateEntries]
  );
  const fastCandidateCountMap = useMemo(() => {
    if (mode !== 'fast') return new Map();
    return buildNumberCountMap(parsedFastCandidateEntries);
  }, [mode, parsedFastCandidateEntries]);
  const rawFastDiscardedTokens = useMemo(() => {
    if (mode !== 'fast') return [];
    if (!String(rawInput || '').trim()) return [];
    return extractFastDiscardedTokensByDigits(rawInput, getFastFamilyConfig(fastFamily).digits);
  }, [fastFamily, mode, rawInput]);
  const visibleFastDiscardedTokens = useMemo(
    () => [...parsedFastDiscardedTokens, ...rawFastDiscardedTokens],
    [parsedFastDiscardedTokens, rawFastDiscardedTokens]
  );
  const discardedTokenCountMap = useMemo(
    () => buildNumberCountMap(visibleFastDiscardedTokens),
    [visibleFastDiscardedTokens]
  );
  const fastExcludedDisplayItems = useMemo(() => {
    const manualItems = excludedFastNumbers.map((number) => ({
      key: `number:${number}`,
      type: 'number',
      value: number,
      repeatCount: getFastCandidateCount(fastCandidateCountMap, number)
    }));
    const rawItems = dedupeOrderedNumbers(visibleFastDiscardedTokens).map((token) => ({
      key: `raw:${token}`,
      type: 'raw',
      value: token,
      repeatCount: getFastCandidateCount(discardedTokenCountMap, token)
    }));

    return [...manualItems, ...rawItems];
  }, [discardedTokenCountMap, excludedFastNumbers, fastCandidateCountMap, visibleFastDiscardedTokens]);
  const activeFastCandidateEntries = useMemo(
    () => {
      if (!excludedFastNumbers.length) return parsedFastCandidateEntries;
      const excluded = new Set(excludedFastNumbers);
      return parsedFastCandidateEntries.filter((number) => !excluded.has(number));
    },
    [excludedFastNumbers, parsedFastCandidateEntries]
  );
  const activeFastNumbers = useMemo(
    () => dedupeOrderedNumbers(activeFastCandidateEntries),
    [activeFastCandidateEntries]
  );
  const pricedFastNumbers = useMemo(
    () => shouldDedupeFastNumbersForPricing(fastFamily, fastTab) ? activeFastNumbers : activeFastCandidateEntries,
    [activeFastCandidateEntries, activeFastNumbers, fastFamily, fastTab]
  );
  const activeFastNumberSet = useMemo(() => new Set(activeFastNumbers), [activeFastNumbers]);
  const parsedFastEntryCount = useMemo(
    () => parsedFastCandidateEntries.length,
    [parsedFastCandidateEntries]
  );
  const activeFastEntryCount = useMemo(
    () => activeFastCandidateEntries.length,
    [activeFastCandidateEntries]
  );
  const gridHeaderRow = gridRows[0] || buildEmptyGridRow();
  const gridBodyRows = gridRows.slice(1);
  const fastDraftSummary = useMemo(
    () =>
      getFastDraftSummary({
        parsedCandidates: parsedFastCandidates,
        activeNumbers: activeFastNumbers,
        parsedEntryCount: shouldDedupeFastNumbersForPricing(fastFamily, fastTab) ? parsedFastCandidates.length : parsedFastEntryCount,
        selectedEntryCount: shouldDedupeFastNumbersForPricing(fastFamily, fastTab) ? activeFastNumbers.length : activeFastEntryCount,
        fastFamily,
        includeDoubleSet,
        reverse,
        fastAmounts,
        supportedBetTypes: selectedLottery?.supportedBetTypes || [],
        closedBetTypes: roundClosedBetTypes
      }),
    [activeFastEntryCount, activeFastNumbers, fastAmounts, fastFamily, fastTab, includeDoubleSet, parsedFastCandidates, parsedFastEntryCount, reverse, roundClosedBetTypes, selectedLottery]
  );
  const gridDraftSummary = useMemo(() => getGridDraftSummary(gridRows), [gridRows]);
  const recentSlipGroups = useMemo(() => groupRecentItemsBySlip(recentItems), [recentItems]);
  const fastDraftItems = useMemo(() => {
    if (mode !== 'fast') return [];

    return buildFastDraftItems({
      fastFamily,
      fastTab,
      rawInput,
      numbers: pricedFastNumbers,
      reverse,
      includeDoubleSet,
      rates: selectedRateProfile?.rates || {},
      amounts: fastAmounts,
      supportedBetTypes: selectedLottery?.supportedBetTypes || [],
      closedBetTypes: roundClosedBetTypes,
      candidateCounts: fastCandidateCountMap
    });
  }, [fastAmounts, fastCandidateCountMap, fastFamily, fastTab, includeDoubleSet, mode, pricedFastNumbers, rawInput, reverse, roundClosedBetTypes, selectedLottery, selectedRateProfile]);
  const gridDraftItems = useMemo(() => {
    if (mode !== 'grid') return [];

    try {
        return buildGridItems({ rows: gridRows, digitMode, supportedBetTypes: selectedLottery?.supportedBetTypes || [] });
      } catch {
        return [];
      }
    }, [digitMode, gridRows, mode, selectedLottery]);
  const currentDraftItems = mode === 'fast' ? fastDraftItems : gridDraftItems;
  const combinedDraftItems = useMemo(
    () => [...savedDraftEntries.flatMap((entry) => entry.items || []), ...currentDraftItems],
    [currentDraftItems, savedDraftEntries]
  );
  const deferredCombinedDraftItems = useDeferredValue(combinedDraftItems);
  const combinedDraftGroups = useMemo(() => buildSlipDisplayGroups(deferredCombinedDraftItems), [deferredCombinedDraftItems]);
  const combinedDraftSummary = useMemo(() => ({
    itemCount: combinedDraftItems.length,
    totalAmount: combinedDraftItems.reduce((sum, item) => sum + Number(item?.amount || 0), 0),
    potentialPayout: combinedDraftItems.reduce((sum, item) => sum + Number(item?.potentialPayout || (Number(item?.amount || 0) * Number(item?.payRate || 0))), 0)
  }), [combinedDraftItems]);
  const deferredCombinedDraftSummary = useMemo(() => ({
    itemCount: deferredCombinedDraftItems.length,
    totalAmount: deferredCombinedDraftItems.reduce((sum, item) => sum + Number(item?.amount || 0), 0),
    potentialPayout: deferredCombinedDraftItems.reduce((sum, item) => sum + Number(item?.potentialPayout || (Number(item?.amount || 0) * Number(item?.payRate || 0))), 0)
  }), [deferredCombinedDraftItems]);
  const hasDraftItems = currentDraftItems.length > 0;
  const combinedDraftMemo = useMemo(
    () => [...savedDraftEntries.map((entry) => entry.memo).filter(Boolean), hasDraftItems ? memo : ''].filter(Boolean).join(' | '),
    [hasDraftItems, memo, savedDraftEntries]
  );
  const deferredCombinedDraftMemo = useDeferredValue(combinedDraftMemo);
  const hasSavedDraftEntries = savedDraftEntries.length > 0;
  const hasPendingSlip = combinedDraftItems.length > 0;
  const hasCatalogContext = Boolean(selectedMember?.id && catalog);
  const isMemberContextHydrating = Boolean(selectedMember?.id && catalogLoading && !catalog);

  const supportedGridColumns = useMemo(() => {
    const supported = new Set(selectedLottery?.supportedBetTypes || []);
    const closed = new Set(roundClosedBetTypes);
    return gridColumns.reduce((acc, column) => {
      acc[column.key] = supported.has(column.betType) && !closed.has(column.betType);
      return acc;
    }, {});
  }, [gridColumns, roundClosedBetTypes, selectedLottery]);

  const clearComposerFields = () => {
    setPreview(null);
    setFastAmounts(buildInitialFastAmounts);
    setRawInput('');
    setHelperFastNumbers([]);
    setExcludedFastNumbers([]);
    setParsedFastDiscardedTokens([]);
    setReverse(false);
    setIncludeDoubleSet(false);
    setFastTab(fastFamily);
    setGridRows(buildInitialGridRows);
    setGridBulkAmounts(buildEmptyGridAmounts());
    setMemo('');
  };

  const resetMemberWorkspace = () => {
    setCatalog(null);
    setRounds([]);
    setLoadedRoundsLotteryId('');
    roundsRequestRef.current = '';
    recentItemsRequestRef.current = '';
    setSelection({ lotteryId: '', roundId: '', rateProfileId: '' });
    setSavedDraftEntries([]);
    setRecentItems([]);
    setExpandedRecentGroups({});
    setRecentLoading(false);
    setShowRates(false);
    setMarketPickerOpen(false);
    clearComposerFields();
  };

  const fetchMemberContext = async (memberId, options = {}) => {
    const { silent = false, seedMember = null } = options;
    if (!memberId) return;
    const requestId = memberContextRequestRef.current + 1;
    memberContextRequestRef.current = requestId;
    if (!silent && seedMember) {
      setSelectedMember((current) => ({ ...(current || {}), ...seedMember, id: seedMember.id || memberId }));
      resetMemberWorkspace();
      setSearchText('');
      setSearchResults([]);
    }
    if (!silent) setCatalogLoading(true);
    try {
      if (silent && catalog) {
        const response = await copy.getContext(memberId, { includeCatalog: false, force: true });
        if (memberContextRequestRef.current !== requestId) return;
        if (response.data.member) {
          startTransition(() => setSelectedMember(response.data.member));
        }
        return;
      }

      const shouldLoadShellFirst = !silent && !seedMember;
      if (shouldLoadShellFirst) {
        copy.getContext(memberId, { includeCatalog: false }).then((response) => {
          if (memberContextRequestRef.current !== requestId || !response.data.member) return;
          startTransition(() => {
            setSelectedMember(response.data.member);
            setSearchText('');
            setSearchResults([]);
          });
        }).catch(() => {});
      }

      const response = await copy.getContext(memberId);
      if (memberContextRequestRef.current !== requestId) return;
      const nextCatalog = response.data.catalog;
      const nextMember = response.data.member;
      const defaults = nextCatalog?.selectionDefaults || {};
      const nextLotteries = flattenLotteries(nextCatalog);
      const nextLottery = nextLotteries.find((item) => item.id === defaults.lotteryId) || nextLotteries[0] || null;

      startTransition(() => {
        setSelectedMember(nextMember);
        setCatalog(nextCatalog);
        setRounds(nextLottery?.activeRound ? [nextLottery.activeRound] : []);
        setLoadedRoundsLotteryId('');
        roundsRequestRef.current = '';
        setSearchText('');
        setSearchResults([]);
        setSelection({
          lotteryId: nextLottery?.id || '',
          roundId: nextLottery?.activeRound?.id || defaults.roundId || '',
          rateProfileId: nextLottery?.defaultRateProfileId || nextLottery?.rateProfiles?.[0]?.id || defaults.rateProfileId || ''
        });
        setPreview(null);
        setSearchParams({ memberId });
      });
    } catch (error) {
      if (memberContextRequestRef.current !== requestId) return;
      console.error(error);
      if (!silent) {
        startTransition(() => {
          setSelectedMember(null);
          resetMemberWorkspace();
          setMemberPickerOpen(true);
          setSearchParams({});
        });
      }
      toast.error(error.response?.data?.message || 'โหลดสิทธิ์การแทงของสมาชิกไม่สำเร็จ');
    } finally {
      if (!silent && memberContextRequestRef.current === requestId) setCatalogLoading(false);
    }
  };

  const fetchRecentItems = async ({ memberId, marketId, roundDate }) => {
    if (!memberId || !marketId) {
      recentItemsRequestRef.current = '';
      setRecentItems([]);
      setRecentLoading(false);
      return;
    }

    const requestKey = `${memberId}:${marketId}:${roundDate || ''}`;
    recentItemsRequestRef.current = requestKey;
    setRecentLoading(true);
    try {
      const response = await copy.getRecentItems({
        customerId: memberId,
        marketId,
        roundDate,
        limit: 8
      });
      if (recentItemsRequestRef.current !== requestKey) return;
      setRecentItems(response.data || []);
    } catch (error) {
      if (recentItemsRequestRef.current !== requestKey) return;
      console.error(error);
      setRecentItems([]);
      toast.error(error.response?.data?.message || 'โหลดรายการโพยล่าสุดไม่สำเร็จ');
    } finally {
      if (recentItemsRequestRef.current === requestKey) {
        setRecentLoading(false);
      }
    }
  };

  const buildDraftSnapshot = () => ({
    composer: buildCurrentSource(),
    savedEntries: toDraftPayloadEntries(savedDraftEntries)
  });

  const persistDraftSnapshot = async ({ scopeParams = draftScopeParams, snapshot = null, silent = true } = {}) => {
    if (!scopeParams?.customerId || !scopeParams?.lotteryId || !scopeParams?.roundId) {
      return null;
    }

    try {
      return await copy.saveDraft({
        ...scopeParams,
        ...(snapshot || buildDraftSnapshot())
      });
    } catch (error) {
      console.error(error);
      if (!silent) {
        toast.error(error.response?.data?.message || copyMessages.saveDraftFailed);
      }
      throw error;
    }
  };

  const clearPersistedDraft = async ({ scopeParams = draftScopeParams, silent = true } = {}) => {
    if (!scopeParams?.customerId || !scopeParams?.lotteryId || !scopeParams?.roundId) {
      return null;
    }

    try {
      return await copy.clearDraft(scopeParams);
    } catch (error) {
      console.error(error);
      if (!silent) {
        toast.error(error.response?.data?.message || copyMessages.saveDraftFailed);
      }
      throw error;
    }
  };

  const persistCurrentScopeDraft = async ({ silent = false } = {}) => {
    if (!draftScopeParams || draftHydratingRef.current || draftLoading) {
      return true;
    }

    if (draftAutosaveTimerRef.current) {
      window.clearTimeout(draftAutosaveTimerRef.current);
      draftAutosaveTimerRef.current = null;
    }

    try {
      await persistDraftSnapshot({ scopeParams: draftScopeParams, silent });
      return true;
    } catch {
      return false;
    }
  };

  const getCurrentComposerItems = () => {
    if (mode === 'grid') {
        return buildGridItems({ rows: gridRows, digitMode, supportedBetTypes: selectedLottery?.supportedBetTypes || [] });
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
        gridBulkAmounts: { ...gridBulkAmounts },
        memo
      };
    }

    return {
      mode: 'fast',
      fastFamily,
      fastTab,
      fastAmounts: { ...fastAmounts },
      rawInput,
      helperFastNumbers: [...helperFastNumbers],
      excludedFastNumbers: [...excludedFastNumbers],
      parsedFastDiscardedTokens: [...parsedFastDiscardedTokens],
      reverse,
      includeDoubleSet,
      memo
    };
  };

  const restoreComposerFromSource = (source) => {
    setPreview(null);

    if (source?.mode === 'grid') {
      setMode('grid');
      setDigitMode(source.digitMode || '2');
      setGridRows(cloneGridRows(source.gridRows?.length ? source.gridRows : buildInitialGridRows()));
      setGridBulkAmounts({ ...buildEmptyGridAmounts(), ...(source.gridBulkAmounts || {}) });
      setFastAmounts(buildInitialFastAmounts);
      setRawInput('');
      setHelperFastNumbers([]);
      setExcludedFastNumbers([]);
      setParsedFastDiscardedTokens([]);
      setReverse(false);
      setIncludeDoubleSet(false);
      setFastTab(fastFamily);
      setMemo(source.memo || '');
      return;
    }

    setMode('fast');
    setFastFamily(source?.fastFamily || '2');
    setFastTab(source?.fastTab || source?.fastFamily || '2');
    setFastAmounts({ ...buildInitialFastAmounts(), ...(source?.fastAmounts || {}) });
    setRawInput(source?.rawInput || '');
    setHelperFastNumbers(source?.helperFastNumbers || []);
    setExcludedFastNumbers(source?.excludedFastNumbers || []);
    setParsedFastDiscardedTokens(source?.parsedFastDiscardedTokens || []);
    setReverse(Boolean(source?.reverse));
    setIncludeDoubleSet(Boolean(source?.includeDoubleSet));
    setGridRows(buildInitialGridRows);
    setGridBulkAmounts(buildEmptyGridAmounts());
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
      throw new Error(copyMessages.emptySlip);
    }

    const notes = [...savedDraftEntries.map((entry) => entry.memo).filter(Boolean), hasDraftItems ? memo : ''].filter(Boolean);

    return buildPayload({
      items,
      payloadMemo: notes.join(' | ')
    });
  };

  const handlePreview = async () => {
    if (!selectedMember?.id) {
      toast.error(copyMessages.requireMember);
      return null;
    }
    if (!selectedLottery?.id || !selectedRound?.id) {
      toast.error(copyMessages.requireMarketRound);
      return null;
    }

    setPreviewing(true);
    try {
      const response = await copy.parseSlip(buildCombinedPayload());
      setPreview(response.data);
      return response.data;
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || copyMessages.parseFailed);
      return null;
    } finally {
      setPreviewing(false);
    }
  };

  const buildSlipImagePreview = () => {
    if (!selectedMember?.id) {
      toast.error(copyMessages.requireMember);
      return null;
    }
    if (!selectedLottery?.id || !selectedRound?.id) {
      toast.error(copyMessages.requireMarketRound);
      return null;
    }
    if (!combinedDraftItems.length) {
      toast.error(copyMessages.emptySlip);
      return null;
    }

    return {
      member: selectedMember,
      customer: selectedMember,
      lottery: selectedLottery,
      round: selectedRound,
      items: combinedDraftItems,
      memo: combinedDraftMemo,
      summary: combinedDraftSummary
    };
  };

  const handleSubmitSlip = async () => {
    const nextPreview = preview || await handlePreview();
    if (!nextPreview) return;
    setSubmitting(true);
    try {
      const response = await copy.createSlip({ ...buildCombinedPayload(), action: 'submit' });
      await clearPersistedDraft({ scopeParams: draftScopeParams, silent: true });
      toast.success(copyMessages.saveSlipSuccess(response.data.slipNumber));
      setSavedDraftEntries([]);
      clearComposerFields();
      await fetchMemberContext(selectedMember.id, { silent: true });
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || copyMessages.saveSlipFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraftEntry = () => {
    try {
      if (!selectedMember?.id) {
        toast.error(copyMessages.requireMember);
        return;
      }
      if (!selectedLottery?.id || !selectedRound?.id) {
        toast.error(copyMessages.requireMarketRound);
        return;
      }

      const items = getCurrentComposerItems();
      const nextEntry = buildSavedDraftEntry({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        items,
        memo: memo.trim(),
        source: buildCurrentSource()
      });

      setSavedDraftEntries((current) => [...current, nextEntry]);
      clearComposerFields();
      toast.success(copyMessages.saveDraftSuccess(items.length));
    } catch (error) {
      toast.error(error.message || copyMessages.saveDraftFailed);
    }
  };

  const handleEditSavedDraftEntry = (entryId) => {
    const entry = savedDraftEntries.find((item) => item.id === entryId);
    if (!entry) return;

    restoreComposerFromSource(entry.source);
    setSavedDraftEntries((current) => current.filter((item) => item.id !== entryId));
    toast.success(copyMessages.restoreDraftSuccess);
  };

  const handleRemoveSavedDraftEntry = (entryId) => {
    setSavedDraftEntries((current) => current.filter((item) => item.id !== entryId));
    setPreview(null);
    toast.success(copyMessages.removeDraftSuccess);
  };

  const toggleFastCandidate = (number) => {
    setExcludedFastNumbers((current) =>
      current.includes(number) ? current.filter((value) => value !== number) : [...current, number]
    );
  };

  const handleCopyAsImage = async () => {
    setCopyingImage(true);
    try {
      const nextPreview = buildSlipImagePreview();
      if (!nextPreview) return;
      const { copySlipPreviewImage } = await import('../../utils/slipImage');
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
      toast.success(result.mode === 'clipboard' ? copyMessages.copyImageSuccess : copyMessages.copyImageFallback);
    } catch (error) {
      console.error(error);
      toast.error(error.message || copyMessages.copyImageFailed);
    } finally {
      setCopyingImage(false);
    }
  };

  const clearComposer = async () => {
    clearComposerFields();
  };

  const clearSelectedMember = async () => {
    const persisted = await persistCurrentScopeDraft({ silent: false });
    if (!persisted) return;

    setSelectedMember(null);
    resetMemberWorkspace();
    setSearchText('');
    setSearchResults([]);
    setMemberPickerOpen(true);
    setSearchParams({});
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const handleSelectMember = async (member) => {
    const memberId = member?.id || '';
    if (!memberId) return;
    const persisted = await persistCurrentScopeDraft({ silent: false });
    if (!persisted) return;

    setMemberPickerOpen(false);
    await fetchMemberContext(memberId, { seedMember: member });
  };

  const ensureRoundsLoaded = async ({ lottery = selectedLottery, requiresHistoricalRounds = false } = {}) => {
    const lotteryId = lottery?.id || '';
    if (!shouldFetchRoundsForLottery({
      lotteryId,
      loadedLotteryId,
      loadedRounds: rounds,
      hasActiveRound: Boolean(lottery?.activeRound),
      requiresHistoricalRounds
    })) {
      return rounds;
    }

    roundsRequestRef.current = lotteryId;
    setLoadingRounds(true);
    try {
      const response = await getCatalogRounds(lotteryId);
      if (roundsRequestRef.current !== lotteryId) {
        return [];
      }

      const nextRounds = response.data || [];
      const nextSelectableRounds = buildSelectableRounds(nextRounds, lottery?.activeRound || null);
      setRounds(nextRounds);
      setLoadedRoundsLotteryId(lotteryId);

      if (nextSelectableRounds.length && !nextSelectableRounds.some((round) => round.id === selection.roundId)) {
        setSelection((current) =>
          current.lotteryId === lotteryId
            ? { ...current, roundId: nextSelectableRounds[0].id }
            : current
        );
      }

      return nextRounds;
    } catch (error) {
      if (roundsRequestRef.current === lotteryId) {
        console.error(error);
        toast.error(copyMessages.loadRoundsFailed);
      }
      return [];
    } finally {
      if (roundsRequestRef.current === lotteryId) {
        setLoadingRounds(false);
      }
    }
  };

  useEffect(() => {
    if (!memberPickerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!memberPickerRef.current?.contains(event.target)) {
        setMemberPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [memberPickerOpen]);

  useEffect(() => {
    if (!marketPickerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!marketPickerRef.current?.contains(event.target)) {
        setMarketPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [marketPickerOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const rawValue = window.localStorage.getItem(favoriteMarketStorageKey);
      const parsed = JSON.parse(rawValue || '[]');
      setFavoriteMarketIds(Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []);
    } catch {
      setFavoriteMarketIds([]);
    }
  }, [favoriteMarketStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(favoriteMarketStorageKey, JSON.stringify(favoriteMarketIds.slice(0, FAVORITE_MARKETS_LIMIT)));
    } catch {
      // ignore local storage write failures
    }
  }, [favoriteMarketIds, favoriteMarketStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const rawValue = window.localStorage.getItem(recentMarketStorageKey);
      const parsed = JSON.parse(rawValue || '[]');
      setRecentMarketIds(Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []);
    } catch {
      setRecentMarketIds([]);
    }
  }, [recentMarketStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(recentMarketStorageKey, JSON.stringify(recentMarketIds.slice(0, RECENT_MARKETS_LIMIT)));
    } catch {
      // ignore local storage write failures
    }
  }, [recentMarketIds, recentMarketStorageKey]);

  useEffect(() => {
    if (!marketPickerOpen) {
      setMarketSearchText('');
      return;
    }

    window.requestAnimationFrame(() => {
      marketSearchInputRef.current?.focus();
    });
  }, [marketPickerOpen]);

  const handleLotteryChange = async (lotteryId) => {
    const nextLottery = flatLotteries.find((item) => item.id === lotteryId);
    if (!nextLottery || nextLottery.id === selection.lotteryId) return;

    const persisted = await persistCurrentScopeDraft({ silent: false });
    if (!persisted) return;

    roundsRequestRef.current = '';
    setLoadedRoundsLotteryId('');
    setRounds(nextLottery.activeRound ? [nextLottery.activeRound] : []);
    setSelection({
      lotteryId: nextLottery.id,
      roundId: nextLottery.activeRound?.id || '',
      rateProfileId: nextLottery.defaultRateProfileId || nextLottery.rateProfiles?.[0]?.id || ''
    });
    setRecentMarketIds((current) => [nextLottery.id, ...current.filter((id) => id !== nextLottery.id)].slice(0, RECENT_MARKETS_LIMIT));
    setMarketPickerOpen(false);
  };

  const toggleFavoriteMarket = (lotteryId) => {
    if (!lotteryId) return;
    setFavoriteMarketIds((current) =>
      current.includes(lotteryId)
        ? current.filter((id) => id !== lotteryId)
        : [lotteryId, ...current.filter((id) => id !== lotteryId)].slice(0, FAVORITE_MARKETS_LIMIT)
    );
  };

  const handleMarketSearchKeyDown = async (event) => {
    if (event.key === 'Escape') {
      setMarketPickerOpen(false);
      return;
    }

    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!firstMarketSearchMatch) return;

    if (firstMarketSearchMatch.id === selectedLottery?.id) {
      setMarketPickerOpen(false);
      return;
    }

    await handleLotteryChange(firstMarketSearchMatch.id);
  };

  const handleRoundChange = async (roundId) => {
    if (!roundId || roundId === selection.roundId) return;

    const persisted = await persistCurrentScopeDraft({ silent: false });
    if (!persisted) return;

    setSelection((current) => ({ ...current, roundId }));
  };

  const handleRateProfileChange = async (rateProfileId) => {
    if (!rateProfileId || rateProfileId === selection.rateProfileId) return;

    const persisted = await persistCurrentScopeDraft({ silent: false });
    if (!persisted) return;

    setSelection((current) => ({ ...current, rateProfileId }));
  };

  const applyRecentItem = (item) => {
    const nextFamily = getFastFamilyFromBetType(item.betType || '');
    setMode('fast');
    setFastFamily(nextFamily);
    setFastTab(nextFamily);
    setFastAmounts(buildFastAmountsForBetType(item.betType || '', item.amount));
    setRawInput(String(item.number || ''));
    setHelperFastNumbers([]);
    setExcludedFastNumbers([]);
    setParsedFastDiscardedTokens([]);
    setReverse(false);
    setIncludeDoubleSet(false);
    setPreview(null);
    toast.success(copyMessages.recentItemApplied);
  };

  const applyFastGeneratedNumbers = (
    numbers,
    successMessage,
    { nextFamily = fastFamily, nextTab = null, appendToCurrent = false } = {}
  ) => {
    if (!numbers.length) {
      toast.error('กรุณากรอกเลขก่อนใช้สูตรนี้');
      return;
    }

    const nextNumbers = appendToCurrent
      ? [...activeFastCandidateEntries, ...numbers]
      : numbers;

    setMode('fast');
    setFastFamily(nextFamily);
    setFastTab(nextTab || nextFamily);
    setHelperFastNumbers(nextNumbers);
    setExcludedFastNumbers([]);
    setParsedFastDiscardedTokens([]);
    setReverse(false);
    setIncludeDoubleSet(false);
    setPreview(null);
    toast.success(successMessage);
    window.requestAnimationFrame(() => {
      fastInputRef.current?.focus();
    });
  };

  const applyWinHelper = (digitsOverride = Number(fastFamily || 0), nextTab = null) => {
    const digits = Number(digitsOverride || fastFamily || 0);
    const seedDigits = extractFastSeedDigits(rawInput);

    if (seedDigits.length < digits) {
      toast.error(`กรุณากรอกเลขอย่างน้อย ${digits} ตัวไม่ซ้ำกันก่อนใช้สูตรวิน`);
      return;
    }

    const numbers = buildDraftWinNumbers(seedDigits, digits);
    applyFastGeneratedNumbers(numbers, `สร้างสูตรวิน ${numbers.length} รายการแล้ว`, {
      nextFamily: String(digits),
      nextTab: nextTab || `win${digits}`
    });
  };

  const applyRoodHelper = () => {
    const seedDigits = extractFastSeedDigits(rawInput);
    if (!seedDigits.length) {
      toast.error('กรุณากรอกเลขอย่างน้อย 1 ตัวก่อนใช้สูตรรูด');
      return;
    }

    const numbers = buildDraftRoodNumbers(seedDigits);
    applyFastGeneratedNumbers(numbers, `สร้างเลขรูด ${numbers.length} รายการแล้ว`, { nextFamily: '2', nextTab: 'rood' });
  };

  const applyTongHelper = () => {
    const numbers = buildDraftTongNumbers();
    applyFastGeneratedNumbers(numbers, `สร้างเลขตอง ${numbers.length} รายการแล้ว`, {
      nextFamily: '3',
      appendToCurrent: true
    });
  };

  const applySpecialSetHelper = () => {
    if (fastFamily !== '2' && fastFamily !== '3') return;

    const numbers = buildDraftDoubleSet(Number(fastFamily));
    const helperLabel = fastFamily === '3' ? 'เลขหาบ' : 'เลขเบิ้ล';
    applyFastGeneratedNumbers(numbers, `สร้าง${helperLabel} ${numbers.length} รายการแล้ว`, {
      appendToCurrent: true
    });
  };

  const applyRecentSlipGroup = (group) => {
    const draft = buildReusableRecentSlipDraft(group?.items || []);

    if (!draft) {
      toast.error(copyMessages.complexRecentSlip);
      return;
    }

    setPreview(null);
    setReverse(false);
    setIncludeDoubleSet(false);

    if (draft.mode === 'fast') {
      setMode('fast');
      setFastFamily(getFastFamilyFromBetType(draft.betType || ''));
      setFastTab(getFastFamilyFromBetType(draft.betType || ''));
      setFastAmounts(buildFastAmountsForBetType(draft.betType || '', draft.defaultAmount));
      setRawInput(draft.rawInput);
      setHelperFastNumbers([]);
      setExcludedFastNumbers([]);
      setParsedFastDiscardedTokens([]);
      setGridRows(buildInitialGridRows);
      setGridBulkAmounts(buildEmptyGridAmounts());
    } else {
      setMode('grid');
      setDigitMode(draft.digitMode);
      setGridRows(draft.rows);
      setGridBulkAmounts(buildEmptyGridAmounts());
      setFastAmounts(buildInitialFastAmounts);
      setRawInput('');
      setHelperFastNumbers([]);
      setExcludedFastNumbers([]);
      setParsedFastDiscardedTokens([]);
    }

    toast.success(copyMessages.recentSlipApplied(group.slipNumber));
  };

  const enabledGridFieldOrder = [
    'number',
    ...gridColumns.filter((column) => supportedGridColumns[column.key]).map((column) => column.key)
  ];
  const enabledFastAmountOrder = getEnabledFieldOrder(
    fastFamilyConfig.columns.map((column) => column.key),
    supportedFastColumns
  );

  const setGridCellRef = (rowId, field) => (element) => {
    const key = `${rowId}:${field}`;
    if (element) {
      gridCellRefs.current[key] = element;
    } else {
      delete gridCellRefs.current[key];
    }
  };

  const setFastAmountRef = (field) => (element) => {
    if (element) {
      fastAmountRefs.current[field] = element;
    } else {
      delete fastAmountRefs.current[field];
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

  const focusFastAmountField = (field) => {
    const target = fastAmountRefs.current[field];
    if (target) {
      target.focus();
      target.select?.();
    }
  };

  const commitFastOrderInput = () => {
    if (!String(rawInput || '').trim()) return false;
    const nextDiscardedTokens = extractFastDiscardedTokensByDigits(rawInput, getFastFamilyConfig(fastFamily).digits);
    const nextEntries = buildFastSourceNumbers({
      fastFamily,
      fastTab,
      rawInput
    });
    if (nextDiscardedTokens.length) {
      setParsedFastDiscardedTokens((current) => [...current, ...nextDiscardedTokens]);
    }
    if (nextEntries.length) {
      setHelperFastNumbers((current) => [...current, ...nextEntries]);
    }
    setRawInput('');
    return nextEntries.length > 0;
  };

  const handleFastOrderInputChange = (value) => {
    if (usesWinSeedSelector) {
      handleWinSeedInputChange(value);
      return;
    }

    const nextValue = String(value || '');
    const nextDiscardedTokens = extractFastDiscardedTokensByDigits(nextValue, getFastFamilyConfig(fastFamily).digits);
    const nextEntries = buildFastSourceNumbers({
      fastFamily,
      fastTab,
      rawInput: nextValue
    });

    if (!nextEntries.length) {
      setRawInput(nextValue);
      return;
    }

    setHelperFastNumbers((current) => [...current, ...nextEntries]);
    setParsedFastDiscardedTokens((current) => [...current, ...nextDiscardedTokens]);
    setRawInput('');
  };

  const applyFastKeyboardAction = (action) => {
    if (action.type === 'focus') {
      focusFastAmountField(action.field);
      return;
    }

    if (action.type === 'saveDraftEntry') {
      handleSaveDraftEntry();
    }
  };

  const handleGridKeyDown = (rowId, field, event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    focusNextGridField(rowId, field);
  };

  const handleFastOrderKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    commitFastOrderInput();
    applyFastKeyboardAction(getFastKeyboardAction({
      field: 'order',
      order: enabledFastAmountOrder,
      amounts: fastAmounts
    }));
  };

  const handleFastAmountKeyDown = (field, event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyFastKeyboardAction(getFastKeyboardAction({
      field,
      order: enabledFastAmountOrder,
      amounts: fastAmounts
    }));
  };

  const handleGridNumberPaste = (rowId, event) => {
    const text = event.clipboardData?.getData('text') || '';
    if (!text.includes('\n')) return;

    const parsed = parseGridPasteLines(text, digitMode);
    if (!parsed.length) {
      toast.error(copyMessages.gridPasteInvalid);
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

    toast.success(copyMessages.gridPasteSuccess(parsed.length));
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
  const applyGridHeaderReverse = () => {
    const sourceNumber = normalizeDigits(gridHeaderRow.number);
    const reverseNumbers = buildGridReverseNumbers(sourceNumber, digitMode);

    if (!reverseNumbers.length) {
      toast.error(`กรุณากรอกหมายเลข ${digitMode} หลักก่อน`);
      return;
    }

    const trailingNumbers = reverseNumbers.filter((number) => number !== sourceNumber);

    setGridRows((current) => {
      const nextRows = [...current];
      const headerRow = nextRows[0] || buildEmptyGridRow();
      nextRows[0] = {
        ...headerRow,
        number: sourceNumber
      };

      while (nextRows.length < trailingNumbers.length + 1) {
        nextRows.push(buildEmptyGridRow());
      }

      trailingNumbers.forEach((number, index) => {
        const rowIndex = index + 1;
        const targetRow = nextRows[rowIndex] || buildEmptyGridRow();
        nextRows[rowIndex] = {
          ...targetRow,
          number,
          amounts: buildEmptyGridAmounts()
        };
      });

      for (let index = trailingNumbers.length + 1; index < nextRows.length; index += 1) {
        nextRows[index] = {
          ...nextRows[index],
          number: '',
          amounts: buildEmptyGridAmounts()
        };
      }

      return nextRows;
    });

    toast.success(`สร้างเลขกลับ ${trailingNumbers.length} รายการ`);
  };
  const copyGridHeaderNumber = () => {
    const sourceNumber = normalizeDigits(gridHeaderRow.number);
    if (!sourceNumber || sourceNumber.length !== Number(digitMode || 2)) {
      toast.error(`กรุณากรอกหมายเลข ${digitMode} หลักก่อน`);
      return;
    }

    let duplicated = false;

    setGridRows((current) => {
      const nextRows = [...current];
      const existingIndex = nextRows.findIndex((row, index) => index > 0 && normalizeDigits(row.number) === sourceNumber);

      if (existingIndex !== -1) {
        duplicated = true;
        return current;
      }

      const targetIndex = nextRows.findIndex((row, index) => index > 0 && !normalizeDigits(row.number));
      if (targetIndex === -1) {
        nextRows.push({
          ...buildEmptyGridRow(),
          number: sourceNumber
        });
        return nextRows;
      }

      nextRows[targetIndex] = {
        ...nextRows[targetIndex],
        number: sourceNumber
      };

      return nextRows;
    });

    if (duplicated) {
      toast.error('เลขนี้อยู่ในรายการแล้ว');
      return;
    }

    toast.success('เพิ่มเลขเข้ารายการแล้ว');
  };
  const copyGridHeaderAmount = (columnKey) => {
    const nextValue = gridHeaderRow.amounts?.[columnKey];
    if (!nextValue) {
      toast.error(copyMessages.gridBulkNeedsAmount);
      return;
    }

    setGridRows((current) =>
      current.map((row) =>
        normalizeDigits(row.number)
          ? { ...row, amounts: { ...row.amounts, [columnKey]: nextValue } }
          : row
      )
    );
  };
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
  useEffect(() => {
    const memberId = searchParams.get('memberId');
    if (memberId) fetchMemberContext(memberId);
  }, []);

  useEffect(() => {
    if (!memberPickerOpen) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await copy.search({ q: searchText.trim(), limit: 12, includeTotals: '0' });
        setSearchResults(sortMembersByActivity(response.data || []));
      } catch (error) {
        console.error(error);
        toast.error(error.response?.data?.message || copyMessages.searchFailed);
      } finally {
        setSearching(false);
      }
    }, searchText.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [copy, memberPickerOpen, searchText]);

  useEffect(() => {
    roundsRequestRef.current = '';

    if (!selectedLottery?.id) {
      setRounds([]);
      setLoadedRoundsLotteryId('');
      setLoadingRounds(false);
      return;
    }

    if (selectedLottery.activeRound) {
      setRounds([selectedLottery.activeRound]);
      setLoadedRoundsLotteryId('');
      setLoadingRounds(false);
      return;
    }

    ensureRoundsLoaded({ lottery: selectedLottery }).catch(() => {});
  }, [selectedLottery?.activeRound, selectedLottery?.id]);

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
      setHelperFastNumbers([]);
      setExcludedFastNumbers([]);
      setParsedFastDiscardedTokens([]);
      setFastFamily(nextFamilies[0].value);
      setFastTab(nextFamilies[0].value);
    }
  }, [fastFamily, roundClosedBetTypes, selectedLottery]);

  const handleFastTabSelect = (tab) => {
    if (tab.type === 'generated') {
      setFastFamily(tab.familyValue);
      setFastTab(tab.value);
      setHelperFastNumbers([]);
      setExcludedFastNumbers([]);
      setParsedFastDiscardedTokens([]);
      setReverse(false);
      setIncludeDoubleSet(false);
      setPreview(null);
      return;
    }

    setFastFamily(tab.value);
    setFastTab(tab.value);
    setFastAmounts((current) => ({
      ...buildInitialFastAmounts(),
      ...current,
      ...(tab.value === 'lao_set' ? { set: current?.set || LAO_SET_AMOUNT } : {})
    }));
    setHelperFastNumbers([]);
    setExcludedFastNumbers([]);
    setParsedFastDiscardedTokens([]);
    setIncludeDoubleSet(false);
    setPreview(null);
  };

  const handleSeedDigitToggle = (digit) => {
    setRawInput((current) => toggleSeedDigitInput(current, digit));
    setHelperFastNumbers([]);
    setParsedFastDiscardedTokens([]);
  };

  const handleWinSeedInputChange = (value) => {
    setRawInput(sanitizeSeedDigitsInput(value));
    setHelperFastNumbers([]);
    setParsedFastDiscardedTokens([]);
  };

  useEffect(() => {
    const desired = getDigitModeColumnDefs(digitMode, selectedLottery?.supportedBetTypes || []).map((column) => column.betType);
    const available = desired.filter((betType) => !roundClosedBetTypes.includes(betType));
    if (!available.length && selectedLottery?.supportedBetTypes?.length) {
      const nextMode = getDigitModeColumnDefs('3', selectedLottery.supportedBetTypes)
        .some((column) => !roundClosedBetTypes.includes(column.betType))
        ? '3'
        : '2';
      if (nextMode !== digitMode) setDigitMode(nextMode);
    }
  }, [digitMode, roundClosedBetTypes, selectedLottery]);

  useEffect(() => {
    setPreview(null);
  }, [selectedMember?.id, selection.lotteryId, selection.roundId, selection.rateProfileId, mode, fastFamily, digitMode, fastAmounts, rawInput, helperFastNumbers, excludedFastNumbers, parsedFastDiscardedTokens, reverse, includeDoubleSet, memo, gridRows, savedDraftEntries]);

  useEffect(() => {
    setExcludedFastNumbers((current) => current.filter((number) => parsedFastCandidates.includes(number)));
  }, [parsedFastCandidates]);

  useEffect(() => {
    if (!draftScopeParams || !draftScopeKey) {
      if (draftAutosaveTimerRef.current) {
        window.clearTimeout(draftAutosaveTimerRef.current);
        draftAutosaveTimerRef.current = null;
      }
      draftLoadedScopeRef.current = '';
      draftHydratingRef.current = false;
      setDraftLoading(false);
      return;
    }

    let cancelled = false;

    const loadDraft = async () => {
      draftHydratingRef.current = true;
      setDraftLoading(true);

      try {
        const response = await copy.getDraft(draftScopeParams);
        if (cancelled) return;

        const draft = response?.data || {};
        setSavedDraftEntries((draft.savedEntries || []).map((entry) => buildSavedDraftEntry(entry)));

        if (draft.composer) {
          restoreComposerFromSource(draft.composer);
        } else {
          clearComposerFields();
        }

        draftLoadedScopeRef.current = draftScopeKey;
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setSavedDraftEntries([]);
          clearComposerFields();
          draftLoadedScopeRef.current = draftScopeKey;
          toast.error(error.response?.data?.message || copyMessages.loadDraftFailed || copyMessages.saveDraftFailed);
        }
      } finally {
        if (!cancelled) {
          draftHydratingRef.current = false;
          setDraftLoading(false);
        }
      }
    };

    loadDraft();

    return () => {
      cancelled = true;
      draftHydratingRef.current = false;
    };
  }, [copy, draftScopeKey, draftScopeParams]);

  useEffect(() => {
    if (!draftScopeParams || !draftScopeKey) return undefined;
    if (draftHydratingRef.current || draftLoading) return undefined;
    if (draftLoadedScopeRef.current !== draftScopeKey) return undefined;

    if (draftAutosaveTimerRef.current) {
      window.clearTimeout(draftAutosaveTimerRef.current);
    }

    draftAutosaveTimerRef.current = window.setTimeout(() => {
      persistDraftSnapshot({ scopeParams: draftScopeParams, silent: true }).catch(() => {});
    }, 400);

    return () => {
      if (draftAutosaveTimerRef.current) {
        window.clearTimeout(draftAutosaveTimerRef.current);
        draftAutosaveTimerRef.current = null;
      }
    };
  }, [
    draftLoading,
    draftScopeKey,
    draftScopeParams,
    mode,
    fastFamily,
    digitMode,
    fastAmounts,
    rawInput,
    helperFastNumbers,
    excludedFastNumbers,
    parsedFastDiscardedTokens,
    reverse,
    includeDoubleSet,
    memo,
    gridRows,
    gridBulkAmounts,
    savedDraftEntries
  ]);

  useEffect(() => {
    setShowRates(false);
  }, [selectedMember?.id, selection.lotteryId, selection.roundId]);

  useEffect(() => {
    recentItemsRequestRef.current = '';
    setRecentItems([]);
    setRecentLoading(false);
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

  const renderMarketOption = (lottery) => {
    const isSelected = lottery.id === selectedLottery?.id;
    const isFavorite = favoriteLotteryIdSet.has(lottery.id);
    const lotteryStatus = getLotteryRoundStatus(lottery);
    const closeAt = getLotteryCloseAt(lottery);
    const closeLabel =
      lotteryStatus === 'open' && closeAt
        ? `ปิด ${formatDateTime(closeAt, { fallback: '-', options: { hour: '2-digit', minute: '2-digit' } })}`
        : '';

    return (
      <button
        key={lottery.id}
        type="button"
        className={`operator-market-option ${isSelected ? 'is-selected' : ''}`}
        style={getLotteryThemeStyle(lottery)}
        onClick={async () => {
          if (isSelected) {
            setMarketPickerOpen(false);
            return;
          }

          await handleLotteryChange(lottery.id);
        }}
      >
        <div className="operator-market-option-copy">
          <div className="operator-market-option-title">
            <strong>{lottery.leagueName} • {lottery.name}</strong>
            {isFavorite ? (
              <span className="operator-market-option-marker" aria-label="ปักหมุดแล้ว" title="ปักหมุดแล้ว">
                <FiStar />
              </span>
            ) : null}
          </div>
          <small>
            {lottery.activeRound ? formatRoundLabel(lottery.activeRound.title || lottery.activeRound.code) : 'ยังไม่มีงวดปัจจุบัน'}
            {closeLabel ? ` • ${closeLabel}` : ''}
          </small>
        </div>
        <span className={`operator-market-status ${lotteryStatus === 'open' ? 'is-open' : 'is-closed'}`}>
          {getRoundStatusLabel(lotteryStatus)}
        </span>
      </button>
    );
  };

  if (catalogLoading && !selectedMember) return <PageSkeleton statCount={3} rows={5} sidebar compactSidebar />;

  return (
    <div className="ops-page operator-page animate-fade-in">
      <section className="operator-layout">
        <section className="operator-workspace" style={selectedLotteryThemeStyle}>
          <section className="card ops-section operator-composer-panel">
          <div className="operator-search-block" ref={memberPickerRef}>
            <div className={`form-input operator-search-field ${memberPickerOpen ? 'operator-search-field-open' : ''}`}>
              <FiSearch />
              <input
                ref={searchInputRef}
                className="operator-search-input"
                type="text"
                value={searchText}
                onFocus={() => setMemberPickerOpen(true)}
                onChange={(event) => {
                  setSearchText(event.target.value);
                  setMemberPickerOpen(true);
                }}
                placeholder={copy.searchPlaceholder}
              />
              <FiChevronDown className={`operator-search-chevron ${memberPickerOpen ? 'is-open' : ''}`} />
            </div>
            {memberPickerOpen ? (
              <div className="operator-search-dropdown">
                {searching ? <div className="operator-search-empty">{copyText.searching}</div> : null}
                {!searching && sortedSearchResults.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="operator-search-option"
                    onClick={() => handleSelectMember(member)}
                  >
                    <span>{member.name}</span>
                    <small>
                      @{member.username}
                      {member.phone ? ` • ${member.phone}` : ''}
                      {' • '}
                      {money(member.creditBalance)} {copyText.baht}
                    </small>
                  </button>
                ))}
                {!searching && !sortedSearchResults.length ? <div className="operator-search-empty">ไม่พบสมาชิก</div> : null}
              </div>
            ) : null}
          </div>

          {selectedMember ? (
            <div className="operator-search-selection">
              <span className="operator-search-selection-name">{selectedMember.name}</span>
              {isMemberContextHydrating ? <span className="operator-search-selection-status">กำลังโหลดสิทธิ์…</span> : null}
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearSelectedMember}>
                <FiX /> {copyText.clearSelection}
              </button>
            </div>
          ) : null}

            {selectedMember ? (
              isMemberContextHydrating ? (
                <div className="operator-context-shell" aria-live="polite">
                  <div className="operator-context-shell-head">
                    <div>
                      <strong>กำลังโหลดข้อมูลสมาชิก</strong>
                      <p>กำลังดึงตลาด สิทธิ์ และงวดล่าสุดของ {selectedMember.name}</p>
                    </div>
                    <span className="operator-context-shell-pill">
                      <FiRefreshCw className="spin-animation" /> กำลังโหลด
                    </span>
                  </div>
                  <div className="operator-context-shell-grid">
                    <div className="operator-context-shell-card">
                      <span className="operator-context-shell-line is-long" />
                      <span className="operator-context-shell-line" />
                    </div>
                    <div className="operator-context-shell-card">
                      <span className="operator-context-shell-line is-medium" />
                      <span className="operator-context-shell-line is-short" />
                    </div>
                  </div>
                  <div className="operator-context-shell-note">
                    ระบบจะแสดงหน้าซื้อแทนทันทีที่ context พร้อม โดยไม่รอ render ทั้งหน้าใหม่
                  </div>
                </div>
              ) : hasCatalogContext ? (
              <>
                <div className="operator-select-grid">
                  <div className="operator-market-picker" ref={marketPickerRef}>
                    <label className="form-label">{copyText.marketLabel}</label>
                    <div className="operator-market-trigger-row">
                      <button
                        type="button"
                        className={`operator-market-trigger ${marketPickerOpen ? 'is-open' : ''}`}
                        style={selectedLotteryThemeStyle}
                        onClick={() => setMarketPickerOpen((value) => !value)}
                      >
                        <div className="operator-market-trigger-copy">
                          <strong>{selectedLottery ? `${selectedLottery.leagueName} • ${selectedLottery.name}` : copyText.marketLabel}</strong>
                          <span className={`operator-market-status ${selectedLottery && isLotteryOpen(selectedLottery) ? 'is-open' : 'is-closed'}`}>
                            {selectedLottery ? getRoundStatusLabel(selectedLotteryStatus) : 'ยังไม่เลือกตลาด'}
                          </span>
                        </div>
                        <FiChevronDown className={`operator-search-chevron ${marketPickerOpen ? 'is-open' : ''}`} />
                      </button>
                      {selectedLottery ? (
                        <button
                          type="button"
                          className={`operator-market-pin ${favoriteLotteryIdSet.has(selectedLottery.id) ? 'is-active' : ''}`}
                          style={selectedLotteryThemeStyle}
                          onClick={() => toggleFavoriteMarket(selectedLottery.id)}
                          aria-label={favoriteLotteryIdSet.has(selectedLottery.id) ? 'เอาออกจากปักหมุด' : 'ปักหมุดหวยนี้'}
                          title={favoriteLotteryIdSet.has(selectedLottery.id) ? 'เอาออกจากปักหมุด' : 'ปักหมุดหวยนี้'}
                        >
                          <FiStar />
                        </button>
                      ) : null}
                    </div>
                    {marketPickerOpen ? (
                      <div className="operator-market-dropdown">
                        <div className="operator-market-search">
                          <FiSearch />
                          <input
                            ref={marketSearchInputRef}
                            type="text"
                            value={marketSearchText}
                            onChange={(event) => setMarketSearchText(event.target.value)}
                            onKeyDown={handleMarketSearchKeyDown}
                            placeholder="ค้นหาหวย เช่น ดาวโจนส์, ลาว VIP"
                          />
                        </div>

                        {favoriteLotteries.length ? (
                          <div className="operator-market-section">
                            <div className="operator-market-section-head">
                              <strong>ปักหมุด</strong>
                              <span>{favoriteLotteries.length} รายการ</span>
                            </div>
                            <div className="operator-market-section-list">
                              {favoriteLotteries.map((lottery) => renderMarketOption(lottery))}
                            </div>
                          </div>
                        ) : null}

                        {recentLotteries.length ? (
                          <div className="operator-market-section">
                            <div className="operator-market-section-head">
                              <strong>ล่าสุดที่ใช้</strong>
                              <span>{recentLotteries.length} รายการ</span>
                            </div>
                            <div className="operator-market-section-list">
                              {recentLotteries.map((lottery) => renderMarketOption(lottery))}
                            </div>
                          </div>
                        ) : null}

                        {closingSoonLotteries.length ? (
                          <div className="operator-market-section">
                            <div className="operator-market-section-head">
                              <strong>ปิดรับใกล้สุด</strong>
                              <span>เปิดรับอยู่</span>
                            </div>
                            <div className="operator-market-section-list">
                              {closingSoonLotteries.map((lottery) => renderMarketOption(lottery))}
                            </div>
                          </div>
                        ) : null}

                        {marketSearchText && remainingLotteries.length ? (
                          <div className="operator-market-section">
                            <div className="operator-market-section-head">
                              <strong>ผลการค้นหา</strong>
                              <span>{remainingLotteries.length} รายการ</span>
                            </div>
                            <div className="operator-market-section-list">
                              {remainingLotteries.map((lottery) => renderMarketOption(lottery))}
                            </div>
                          </div>
                        ) : null}

                        {!marketSearchText && groupedRemainingLotteries.length ? (
                          <div className="operator-market-section">
                            <div className="operator-market-section-head">
                              <strong>ตลาดทั้งหมด</strong>
                              <span>{remainingLotteries.length} รายการ</span>
                            </div>
                            <div className="operator-market-group-list">
                              {groupedRemainingLotteries.map((group) => (
                                <section key={group.key} className="operator-market-group">
                                  <div className="operator-market-group-head">
                                    <strong>{group.label}</strong>
                                    <span>{group.items.length}</span>
                                  </div>
                                  <div className="operator-market-section-list">
                                    {group.items.map((lottery) => renderMarketOption(lottery))}
                                  </div>
                                </section>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {!favoriteLotteries.length && !recentLotteries.length && !closingSoonLotteries.length && !remainingLotteries.length ? (
                          <div className="operator-market-empty">ไม่พบตลาดที่ตรงกับคำค้น</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <label className="form-label">{copyText.roundLabel}</label>
                    <select
                      className="form-select"
                      value={selectedRound?.id || ''}
                      onFocus={() => {
                        ensureRoundsLoaded({ requiresHistoricalRounds: true }).catch(() => {});
                      }}
                      onChange={(event) => handleRoundChange(event.target.value)}
                      disabled={loadingRounds || !selectableRounds.length}
                    >
                      {selectableRounds.map((round) => <option key={round.id} value={round.id}>{formatRoundLabel(round.title || round.code)} • {getRoundStatusLabel(round.status)}</option>)}
                    </select>
                  </div>
                </div>

                <button type="button" className="btn btn-secondary btn-sm operator-rate-toggle" onClick={() => setShowRates((value) => !value)}>
                  {showRates ? <FiChevronUp /> : <FiChevronDown />}
                  {showRates ? copyText.hideRates : copyText.showRates}
                </button>

                {showRates ? (
                  <>
                    <div className="operator-rate-row">
                      {(selectedLottery?.rateProfiles || []).map((profile) => <button key={profile.id} type="button" className={`btn ${selectedRateProfile?.id === profile.id ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => handleRateProfileChange(profile.id)}>{profile.name}</button>)}
                    </div>

                    <div className="operator-rate-grid">
                      {(selectedLottery?.supportedBetTypes || []).map((betType) => <div key={betType} className="card" style={{ padding: 12, borderColor: roundClosedBetTypes.includes(betType) ? 'var(--border-accent)' : undefined }}><div className="ops-table-note" style={{ margin: 0 }}>{getBetTypeLabel(betType)}</div><strong style={{ display: 'block', marginTop: 8 }}>{getRateDisplayText(betType, selectedRateProfile?.rates)}</strong><small className="ops-table-note" style={{ marginTop: 6, display: 'block', color: roundClosedBetTypes.includes(betType) ? 'var(--primary-light)' : undefined }}>{roundClosedBetTypes.includes(betType) ? copyText.roundClosedStatus : copyText.roundOpenStatus}</small></div>)}
                    </div>
                  </>
                ) : null}

                {roundClosedBetTypes.length ? <div className="bet-note warning" style={{ marginTop: 16 }}><FiAlertCircle /><span>{copyText.roundClosedPrefix} {roundClosedBetTypes.map((betType) => getBetTypeLabel(betType)).join(', ')}</span></div> : null}

                <div className="operator-mode-row">
                  <button type="button" className={`btn ${mode === 'fast' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setMode('fast')}>{copyText.fastMode}</button>
                  <button type="button" className={`btn ${mode === 'grid' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setMode('grid')}>{copyText.gridMode}</button>
                </div>

                {mode === 'fast' ? (
                  <>
                    <div className="operator-bettype-row">
                      {visibleFastTabs.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`btn ${fastTab === option.value ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                          onClick={() => handleFastTabSelect(option)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    {usesWinSeedSelector ? (
                      <div className="card operator-seed-selector-card">
                        <div className="operator-seed-selector-head">
                          <strong>{fastTab === 'win3' ? 'เลือกเลขสำหรับวิน3' : 'เลือกเลขสำหรับวิน2'}</strong>
                          <span className="ops-table-note">{parsedFastCandidates.length} รายการ</span>
                        </div>
                        <div className="operator-seed-selector-grid">
                          {Array.from({ length: 10 }, (_, digit) => String(digit)).map((digit) => (
                            <button
                              key={digit}
                              type="button"
                              className={`operator-seed-chip ${selectedSeedDigits.includes(digit) ? 'is-active' : ''}`}
                              onClick={() => handleSeedDigitToggle(digit)}
                            >
                              {digit}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="operator-working-slip-flat">
                      <div className="operator-fast-chip-list">
                        {parsedFastCandidates.length ? (
                          parsedFastCandidates.map((number) => {
                            const isActive = activeFastNumberSet.has(number);
                            const repeatCount = getFastCandidateCount(fastCandidateCountMap, number);
                            return (
                              <button
                                key={number}
                                type="button"
                                className={`operator-fast-chip ${isActive ? 'is-active' : 'is-muted'}`}
                                onClick={() => toggleFastCandidate(number)}
                              >
                                {number}
                                {repeatCount > 1 ? <span className="operator-fast-chip-count">x{repeatCount}</span> : null}
                              </button>
                            );
                          })
                        ) : (
                          <div className="ops-table-note">คัดเลขจากข้อความคำสั่งซื้อแล้วจะแสดงที่นี่</div>
                        )}
                      </div>
                      {fastExcludedDisplayItems.length ? (
                        <div className="operator-fast-excluded-panel">
                          <div className="operator-fast-excluded-head">
                            <strong>ตัวที่ตัดออก</strong>
                            <span>{fastExcludedDisplayItems.length} รายการ</span>
                          </div>
                          <div className="operator-fast-excluded-list">
                            {fastExcludedDisplayItems.map((item) => {
                              if (item.type === 'raw') {
                                return (
                                  <span
                                    key={item.key}
                                    className="operator-fast-excluded-chip is-raw"
                                    title="ตัวอักษรหรืออักขระที่ parser ตัดออก"
                                  >
                                    {item.value}
                                    {item.repeatCount > 1 ? <span className="operator-fast-chip-count">x{item.repeatCount}</span> : null}
                                  </span>
                                );
                              }

                              return (
                                <button
                                  key={item.key}
                                  type="button"
                                  className="operator-fast-excluded-chip"
                                  onClick={() => toggleFastCandidate(item.value)}
                                  title="กดเพื่อดึงกลับเข้าโพย"
                                >
                                  {item.value}
                                  {item.repeatCount > 1 ? <span className="operator-fast-chip-count">x{item.repeatCount}</span> : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className={`operator-fast-entry-row operator-fast-entry-row-${fastFamily}`}>
                      <div className="card operator-fast-amount-card operator-fast-order-card">
                        <label className="operator-fast-amount-label" htmlFor="fast-order-input">{copyText.pastedOrderLabel}</label>
                        <textarea
                          id="fast-order-input"
                          ref={fastInputRef}
                          className="form-input operator-inline-order-input operator-command-input-masked"
                          rows="1"
                          placeholder=""
                          value={rawInput}
                          onChange={(event) => handleFastOrderInputChange(event.target.value)}
                          onKeyDown={handleFastOrderKeyDown}
                        />
                      </div>
                      {fastFamilyConfig.columns.map((column) => {
                        const betLabel = getBetTypeLabel(column.betType);
                        const enabled = supportedFastColumns[column.key];

                        return (
                          <div key={column.key} className={`card operator-fast-amount-card ${enabled ? '' : 'operator-fast-amount-card-disabled'}`}>
                            <label className="operator-fast-amount-label" htmlFor={`fast-amount-${column.key}`}>{betLabel}</label>
                            <input
                              id={`fast-amount-${column.key}`}
                              ref={setFastAmountRef(column.key)}
                              className="form-input"
                              type="number"
                              min="0"
                              placeholder={copyText.amountPlaceholder}
                              disabled={!enabled}
                              readOnly={enabled && Boolean(fastFamilyConfig.fixedAmount && column.key === 'set')}
                              value={fastFamilyConfig.fixedAmount && column.key === 'set' ? String(fastFamilyConfig.fixedAmount) : fastAmounts[column.key]}
                              onChange={(event) => setFastAmounts((current) => ({ ...current, [column.key]: event.target.value }))}
                              onKeyDown={(event) => handleFastAmountKeyDown(column.key, event)}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="operator-helper-row compact">
                      {fastFamily !== 'run' ? (
                        <button
                          type="button"
                          className={`btn ${reverse ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                          onClick={() => {
                            setExcludedFastNumbers([]);
                            setReverse((value) => !value);
                          }}
                        >
                          <FiShuffle /> {copyText.reverse}
                        </button>
                      ) : null}
                      {fastFamily === '2' ? (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={applySpecialSetHelper}>
                          <FiStar /> เลขเบิ้ล
                        </button>
                      ) : null}
                      {fastFamily === '3' ? (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={applySpecialSetHelper}>
                          <FiStar /> เลขหาบ
                        </button>
                      ) : null}
                      {fastFamily === '3' ? (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={applyTongHelper}>
                          <FiStar /> เลขตอง
                        </button>
                      ) : null}
                      <button type="button" className="btn btn-secondary btn-sm" onClick={clearComposer}>
                        <FiRotateCcw /> {copyText.clearAll}
                      </button>
                    </div>
                    <div className="operator-fast-grid">
                      <div className="operator-fast-grid-wide">
                        <input
                          className="form-input"
                          type="text"
                          placeholder={copyText.memoPlaceholder}
                          value={memo}
                          onChange={(event) => setMemo(event.target.value)}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="operator-helper-row">
                      {digitModeOptions.map((option) => <button key={option.value} type="button" className={`btn ${digitMode === option.value ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setDigitMode(option.value)}>{option.label}</button>)}
                    </div>
                    <div style={{ marginTop: 16 }}><label className="form-label">{copyText.memoLabel}</label><input className="form-input" type="text" placeholder={copyText.memoPlaceholder} value={memo} onChange={(event) => setMemo(event.target.value)} /></div>
                    <div className="operator-grid-entry-grid">
                      <div className="card operator-grid-entry-card">
                        <label className="operator-grid-entry-label" htmlFor="grid-entry-number">หมายเลข</label>
                        <input
                          id="grid-entry-number"
                          ref={setGridCellRef(gridHeaderRow.id, 'number')}
                          className="form-input"
                          type="text"
                          inputMode="numeric"
                          placeholder={digitMode === '3' ? 'เช่น 123' : 'เช่น 12'}
                          value={gridHeaderRow.number}
                          onChange={(event) => updateGridRow(gridHeaderRow.id, { number: event.target.value })}
                          onKeyDown={(event) => handleGridKeyDown(gridHeaderRow.id, 'number', event)}
                          onPaste={(event) => handleGridNumberPaste(gridHeaderRow.id, event)}
                        />
                        <div className="operator-grid-entry-actions">
                          <button type="button" className="btn btn-secondary btn-sm operator-grid-entry-action" onClick={applyGridHeaderReverse}>
                            <FiShuffle /> {copyText.reverse}
                          </button>
                          <button type="button" className="btn btn-secondary btn-sm operator-grid-entry-action" onClick={copyGridHeaderNumber}>
                            <FiCopy /> คัดลอกเลข
                          </button>
                        </div>
                      </div>
                      {gridColumns.map((column) => (
                        <div key={column.key} className="card operator-grid-entry-card">
                          <label className="operator-grid-entry-label" htmlFor={`grid-entry-${column.key}`}>{getBetTypeLabel(column.betType)}</label>
                          <input
                            id={`grid-entry-${column.key}`}
                            ref={setGridCellRef(gridHeaderRow.id, column.key)}
                            className="form-input"
                            type="number"
                            min="0"
                            placeholder={copyText.amountPlaceholder}
                            disabled={!supportedGridColumns[column.key]}
                            value={gridHeaderRow.amounts[column.key]}
                            onChange={(event) => updateGridAmount(gridHeaderRow.id, column.key, event.target.value)}
                            onKeyDown={(event) => handleGridKeyDown(gridHeaderRow.id, column.key, event)}
                          />
                          <button type="button" className="btn btn-secondary btn-sm operator-grid-entry-action" onClick={() => copyGridHeaderAmount(column.key)} disabled={!supportedGridColumns[column.key]}>
                            <FiCopy /> คัดลอกยอด
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="operator-grid-rows">
                      {gridBodyRows.map((row) => (
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
                          {gridColumns.map((column) => (
                            <input
                              key={column.key}
                              ref={setGridCellRef(row.id, column.key)}
                              className="form-input"
                              type="number"
                              min="0"
                              placeholder={getBetTypeLabel(column.betType)}
                              disabled={!supportedGridColumns[column.key]}
                              value={row.amounts[column.key]}
                              onChange={(event) => updateGridAmount(row.id, column.key, event.target.value)}
                              onKeyDown={(event) => handleGridKeyDown(row.id, column.key, event)}
                            />
                          ))}
                          <button type="button" className="btn btn-danger btn-sm operator-grid-delete" onClick={() => removeGridRow(row.id)}>
                            <FiTrash2 />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="operator-helper-row compact">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setGridRows((current) => [...current, buildEmptyGridRow()])}><FiPlus /> {copyText.addRow}</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={clearComposer}><FiRotateCcw /> {copyText.clearAll}</button>
                    </div>
                  </>
                )}


                <div className="operator-helper-row compact operator-staged-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleSaveDraftEntry} disabled={!selectedMember || !hasDraftItems}>
                    <FiFileText /> {copyText.saveForLater}
                  </button>
                </div>
                <div className="bet-note" style={{ marginTop: 16 }}><FiAlertCircle /><span>{copyText.validationNote}</span></div>
              </>
              ) : (
                <div className="operator-context-shell is-error">
                  <div className="operator-context-shell-head">
                    <div>
                      <strong>ยังโหลด context ของสมาชิกไม่สำเร็จ</strong>
                      <p>เลือกสมาชิกใหม่อีกครั้ง หรือรีเซ็ตการเลือกก่อน</p>
                    </div>
                  </div>
                </div>
              )
            ) : null}
          </section>

          <aside className="card ops-section operator-preview-panel">
              <div className="ui-panel-head">
                <div><div className="ui-eyebrow">{copyText.previewEyebrow}</div><h3 className="card-title">{copyText.previewTitle}</h3></div>
              <button className="btn btn-secondary btn-sm" onClick={handleCopyAsImage} disabled={copyingImage || previewing || submitting || !selectedMember || !hasPendingSlip}>
                {copyingImage ? <FiRefreshCw className="spin-animation" /> : <FiCopy />} {copyingImage ? copyText.copySlipImageLoading : copyText.copySlipImage}
              </button>
              </div>

            {isMemberContextHydrating ? (
              <div className="operator-preview-loading">
                <FiRefreshCw className="spin-animation" />
                <span>กำลังเตรียมหน้าซื้อแทนของสมาชิก</span>
              </div>
            ) : !hasPendingSlip ? (
              <div className="empty-state operator-preview-empty">
                <div className="empty-state-icon"><FiLayers /></div>
                <div className="empty-state-text">คีย์เลขแล้วกดสั่งซื้อ เพื่อรวมเข้าโพยรอบนี้</div>
              </div>
            ) : (
              <>
                <div className="operator-preview-grouped-summary">
                  {hasSavedDraftEntries ? (
                    <div className="operator-preview-staged-toolbar">
                      {savedDraftEntries.map((entry, index) => (
                        <div key={entry.id} className="operator-preview-stage-pill">
                          <div className="operator-preview-stage-pill-copy">
                            <strong>{copyText.setLabel} {index + 1}</strong>
                            <span className="ops-table-note">{money(entry.totalAmount)} {copyText.baht}</span>
                          </div>
                          <div className="operator-preview-stage-pill-actions">
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleEditSavedDraftEntry(entry.id)}>
                              {copyText.edit}
                            </button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveSavedDraftEntry(entry.id)}>
                              {copyText.delete}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <GroupedSlipSummary
                    slip={{ items: deferredCombinedDraftItems, displayGroups: combinedDraftGroups, memo: deferredCombinedDraftMemo }}
                    dense
                    showMemo={Boolean(deferredCombinedDraftMemo)}
                    summaryBlock={(
                      <div className="card operator-preview-compact-summary">
                        <div>
                          <div className="ops-table-note" style={{ margin: 0 }}>{previewCopy.memberLabel}</div>
                          <strong>{selectedMember?.name || '-'}</strong>
                        </div>
                        <div>
                          <div className="ops-table-note" style={{ margin: 0 }}>{previewCopy.totalAmountLabel}</div>
                          <strong>{money(deferredCombinedDraftSummary.totalAmount)} {copyText.baht}</strong>
                        </div>
                      </div>
                    )}
                    className="slip-grouped-compact"
                  />
                </div>
              </>
            )}

            <div className="operator-preview-actions">
              <button className="btn btn-primary" onClick={handleSubmitSlip} disabled={previewing || copyingImage || submitting || !selectedMember || !hasPendingSlip || !canSubmit}>
                {submitting || previewing ? <FiRefreshCw className="spin-animation" /> : <FiSend />} {submitting ? copyText.saveSlipLoading : copyText.submitSlipNow}
              </button>
              {!canSubmit && selectedMember ? <div className="submit-warning">{copyText.submitBlockedNote}</div> : null}
            </div>
          </aside>
        </section>
      </section>
    </div>
  );
};

export default OperatorBetting;
