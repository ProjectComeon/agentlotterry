import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiRefreshCw,
  FiRotateCcw,
  FiSlash
} from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import {
  getCatalogOverview,
  getLotterySyncStatus,
  getMarketOverview,
  getRecentMarketResults,
  reconcileLotteryRoundSettlement,
  rerunLotteryRoundSettlement,
  reverseLotteryRoundSettlement,
  syncLatestLottery,
  updateRoundBettingOverride,
  updateRoundTiming
} from '../../services/api';
import { formatDateTime, formatRoundLabel, formatThaiDate, THAI_TIMEZONE } from '../../utils/formatters';
import { getLotteryVisual } from '../../utils/lotteryVisuals';
import {
  hasResultContent,
  getLatestResultCandidate,
  sortResultsByLatestFirst,
  getResultChronologyTime
} from '../../utils/lotteryResultSelection';

const UI = {
  eyebrow: 'ผลหวย API',
  title: 'ผลรางวัลหวย',
  subtitle: 'แสดงเฉพาะตลาดที่มี API ในระบบ พร้อมสถานะเปิดรับ - ปิดรับ และผลล่าสุดของแต่ละหวยในหน้าเดียว',
  refresh: 'รีเฟรช',
  warningTitle: 'สถานะการเชื่อมต่อผลหวย',
  syncSummaryTitle: 'ภาพรวมการซิงก์ล่าสุด',
  syncSummaryEmpty: 'ยังไม่มีประวัติการซิงก์ล่าสุด',
  syncConfiguredFeeds: 'ฟีดที่ตั้งไว้',
  syncExplicitFeeds: 'explicit mapping',
  syncLatest: 'Sync latest',
  syncLatestBusy: 'Syncing...',
  syncLatestSuccess: 'Latest results synced successfully',
  syncLatestDeferredSuccess: 'Sync latest สำเร็จ และเลื่อน settlement ไปทำขั้นถัดไป',
  syncLatestSkipped: 'A sync is already running, so this request was skipped',
  syncLatestError: 'Failed to sync latest results',
  syncProblemFeeds: 'ฟีดมีปัญหา',
  syncSettlements: 'settlement ในรอบล่าสุด',
  syncModeFull: 'sync แบบเต็มรวม settlement',
  syncModeDeferred: 'sync แบบ fetch/store เท่านั้น',
  syncStrictModeOn: 'strict mapping เปิดอยู่',
  syncStrictModeOff: 'strict mapping ปิดอยู่',
  syncLastRun: 'ซิงก์ล่าสุด',
  syncLastError: 'ซิงก์ล่าสุดล้มเหลว',
  syncFeedIssues: 'ฟีดที่ต้องตรวจเพิ่ม',
  apiNotConfigured: 'ยังไม่ได้ตั้งค่า API หรือผู้ให้บริการผลหวยยังไม่พร้อมใช้งานบางส่วน',
  noData: 'ยังไม่มีตลาดผลหวยที่พร้อมแสดงผล',
  openAt: 'เปิดรับ',
  closeAt: 'ปิดรับ',
  currentRound: 'งวดปัจจุบัน',
  latestResult: 'ผลล่าสุด',
  latestDetailTitle: 'รายละเอียดผลล่าสุด',
  recentHistoryTitle: 'ย้อนหลัง',
  noResult: 'ยังไม่มีผลล่าสุดในระบบ',
  noRound: 'ยังไม่มีงวดเปิดใช้งาน',
  noHistory: 'ยังไม่มีประวัติผลย้อนหลังของตลาดนี้',
  source: 'แหล่งข้อมูล',
  updatedAt: 'อัปเดตล่าสุด',
  apiLink: 'เปิดแหล่งข้อมูล',
  providerUnavailable: 'API ยังไม่พร้อม',
  latestHeadlineFallback: 'รอผลล่าสุด',
  settlementTitle: 'จัดการ settlement ของงวดนี้',
  settlementUnavailable: 'ยังไม่มี active round จริงในระบบสำหรับจัดการ settlement',
  settlementPendingPublish: 'ผลงวดนี้ยังเป็นข้อมูลจาก feed และยังไม่ได้ publish เข้าระบบ จึงยังจัดการ settlement ไม่ได้',
  settlementSynthetic: 'งวดนี้เป็นงวดจำลองจากตารางเวลา ใช้จัดการ settlement จริงไม่ได้',
  settlementReconcile: 'ตรวจสอบ',
  settlementReverse: 'ย้อนงวด',
  settlementRerun: 'รันใหม่',
  settlementHelp: 'ใช้สำหรับตรวจความสอดคล้อง, ย้อน payout, หรือรัน settlement ใหม่ของงวดที่เลือก',
  settlementBusy: '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e14\u0e33\u0e40\u0e19\u0e34\u0e19\u0e01\u0e32\u0e23...',
  settlementFeedbackEmpty: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e23\u0e31\u0e19\u0e04\u0e33\u0e2a\u0e31\u0e48\u0e07\u0e08\u0e31\u0e14\u0e01\u0e32\u0e23 settlement \u0e43\u0e19\u0e07\u0e27\u0e14\u0e19\u0e35\u0e49'
};

const BETTING_TOGGLE_UI = {
  title: '\u0e40\u0e1b\u0e34\u0e14-\u0e1b\u0e34\u0e14\u0e23\u0e31\u0e1a\u0e42\u0e1e\u0e22\u0e02\u0e2d\u0e07\u0e07\u0e27\u0e14\u0e1b\u0e31\u0e08\u0e08\u0e38\u0e1a\u0e31\u0e19',
  help: '\u0e43\u0e0a\u0e49\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e2a\u0e31\u0e48\u0e07\u0e1a\u0e31\u0e07\u0e04\u0e31\u0e1a\u0e40\u0e1b\u0e34\u0e14\u0e2b\u0e23\u0e37\u0e2d\u0e1b\u0e34\u0e14\u0e23\u0e31\u0e1a\u0e42\u0e1e\u0e22\u0e02\u0e2d\u0e07 active round \u0e41\u0e25\u0e30\u0e01\u0e25\u0e31\u0e1a\u0e44\u0e1b\u0e15\u0e32\u0e21\u0e40\u0e27\u0e25\u0e32\u0e44\u0e14\u0e49',
  unavailable: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35 active round \u0e08\u0e23\u0e34\u0e07\u0e43\u0e19\u0e23\u0e30\u0e1a\u0e1a\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e2a\u0e31\u0e48\u0e07\u0e40\u0e1b\u0e34\u0e14-\u0e1b\u0e34\u0e14\u0e23\u0e31\u0e1a\u0e42\u0e1e\u0e22',
  synthetic: '\u0e07\u0e27\u0e14\u0e19\u0e35\u0e49\u0e40\u0e1b\u0e47\u0e19\u0e07\u0e27\u0e14\u0e08\u0e33\u0e25\u0e2d\u0e07\u0e08\u0e32\u0e01\u0e15\u0e32\u0e23\u0e32\u0e07\u0e40\u0e27\u0e25\u0e32 \u0e08\u0e36\u0e07\u0e22\u0e31\u0e07\u0e40\u0e1b\u0e34\u0e14-\u0e1b\u0e34\u0e14\u0e23\u0e31\u0e1a\u0e42\u0e1e\u0e22\u0e08\u0e23\u0e34\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49',
  resulted: '\u0e07\u0e27\u0e14\u0e19\u0e35\u0e49\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28\u0e1c\u0e25\u0e41\u0e25\u0e49\u0e27 \u0e08\u0e36\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e40\u0e1b\u0e25\u0e35\u0e48\u0e22\u0e19\u0e2a\u0e16\u0e32\u0e19\u0e30\u0e23\u0e31\u0e1a\u0e42\u0e1e\u0e22\u0e44\u0e14\u0e49',
  auto: '\u0e15\u0e32\u0e21\u0e40\u0e27\u0e25\u0e32',
  forcedOpen: '\u0e1a\u0e31\u0e07\u0e04\u0e31\u0e1a\u0e40\u0e1b\u0e34\u0e14\u0e23\u0e31\u0e1a',
  forcedClosed: '\u0e1a\u0e31\u0e07\u0e04\u0e31\u0e1a\u0e1b\u0e34\u0e14\u0e23\u0e31\u0e1a',
  reset: '\u0e01\u0e25\u0e31\u0e1a\u0e2a\u0e39\u0e48\u0e40\u0e27\u0e25\u0e32\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34',
  busy: '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2d\u0e31\u0e1b\u0e40\u0e14\u0e15...',
  open: '\u0e40\u0e1b\u0e34\u0e14\u0e23\u0e31\u0e1a',
  closed: '\u0e1b\u0e34\u0e14\u0e23\u0e31\u0e1a',
  updated: '\u0e2d\u0e31\u0e1b\u0e40\u0e14\u0e15\u0e2a\u0e16\u0e32\u0e19\u0e30\u0e23\u0e31\u0e1a\u0e42\u0e1e\u0e22\u0e41\u0e25\u0e49\u0e27',
  error: '\u0e2d\u0e31\u0e1b\u0e40\u0e14\u0e15\u0e2a\u0e16\u0e32\u0e19\u0e30\u0e23\u0e31\u0e1a\u0e42\u0e1e\u0e22\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08',
  resetDone: '\u0e01\u0e25\u0e31\u0e1a\u0e44\u0e1b\u0e43\u0e0a\u0e49\u0e40\u0e27\u0e25\u0e32\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34\u0e41\u0e25\u0e49\u0e27',
  timingTitle: 'ตั้งเวลาเปิด-ปิดรับโพย',
  timingHelp: 'กำหนดวัน เดือน ปี และเวลาเปิดรับ/ปิดรับของงวดนี้',
  openAtLabel: 'เปิดรับ',
  closeAtLabel: 'ปิดรับ',
  saveTiming: 'บันทึกเวลา',
  savingTiming: 'กำลังบันทึก...',
  timingUpdated: 'อัปเดตเวลาเปิด-ปิดรับแล้ว',
  timingError: 'อัปเดตเวลาเปิด-ปิดรับไม่สำเร็จ',
  timingInvalid: 'เวลาเปิดรับต้องมาก่อนเวลาปิดรับ',
  manualTiming: 'ตั้งเวลาเอง'
};

const CATALOG_MARKET_ALIASES = {
  thai_government: ['thai-government', 'thai_government'],
  baac: ['baac'],
  gsb: ['gsb', 'gsb-1year-100'],
  lao_redcross: ['lao-redcross', 'lao_redcross'],
  lao_tv: ['lao-tv', 'lao_tv'],
  lao_hd: ['lao-hd', 'lao_hd'],
  lao_extra: ['lao-extra', 'lao_extra'],
  lao_star: ['lao-star', 'lao-stars', 'lao_star'],
  lao_star_vip: ['lao-star-vip', 'lao-stars-vip', 'lao_star_vip'],
  lao_union: ['lao-union', 'lao_union'],
  lao_union_vip: ['lao-union-vip', 'lao_union_vip'],
  lao_asean: ['lao-asean', 'lao_asean'],
  tlzc: ['lao', 'tlzc'],
  hanoi_extra: ['hanoi-extra', 'hanoi_extra'],
  hanoi_star: ['hanoi-star', 'hanoi_star'],
  hanoi_develop: ['hanoi-develop', 'hanoi_develop'],
  hanoi_hd: ['hanoi-hd', 'hanoi_hd'],
  hanoi_tv: ['hanoi-tv', 'hanoi_tv'],
  hanoi_redcross: ['hanoi-redcross', 'hanoi_redcross'],
  lao_pathana: ['lao-pathana', 'lao_pathana'],
  hanoi_special: ['hanoi-special', 'hanoi_special'],
  lao_vip: ['lao-vip', 'lao_vip', 'zcvip'],
  dowjones_vip: ['stock-dowjones', 'dowjones_vip'],
  nikkei_morning: ['stock-nikkei-morning', 'nikkei_morning'],
  nikkei_morning_vip: ['stock-nikkei-morning-vip', 'nikkei_morning_vip'],
  china_morning_vip: ['stock-china-morning-vip', 'china_morning_vip'],
  hangseng_morning_vip: ['stock-hangseng-morning-vip', 'hangseng_morning_vip'],
  china_afternoon: ['stock-china-afternoon', 'china_afternoon'],
  nikkei_afternoon_vip: ['stock-nikkei-afternoon-vip', 'nikkei_afternoon_vip'],
  china_afternoon_vip: ['stock-china-afternoon-vip', 'china_afternoon_vip'],
  hangseng_afternoon_vip: ['stock-hangseng-afternoon-vip', 'hangseng_afternoon_vip'],
  korea_vip: ['stock-korea-vip', 'korea_vip'],
  taiwan_vip: ['stock-taiwan-vip', 'taiwan_vip'],
  singapore_vip: ['stock-singapore-vip', 'singapore_vip'],
  england_vip: ['stock-england-vip', 'england_vip'],
  germany_vip: ['stock-germany-vip', 'germany_vip'],
  russia_vip: ['stock-russia-vip', 'russia_vip']
};

const API_MARKET_RESULT_ALIASES = {
  'thai-government': ['thai_government', 'tgfc'],
  baac: ['baac'],
  gsb: ['gsb', 'gsb-1year-100'],
  'gsb-1year-100': ['gsb', 'gsb-1year-100'],
  'hanoi-vip': ['hnvip'],
  'hanoi-special': ['hanoi_special', 'bfhn'],
  'hanoi-extra': ['hanoi_extra'],
  'hanoi-star': ['hanoi_star'],
  'hanoi-develop': ['hanoi_develop'],
  'hanoi-hd': ['hanoi_hd'],
  'hanoi-tv': ['hanoi_tv'],
  'hanoi-redcross': ['hanoi_redcross'],
  'hanoi-specific': ['cqhn'],
  lao: ['tlzc'],
  'lao-vip': ['lao_vip', 'zcvip'],
  lao_redcross: ['lao_redcross', 'lao-redcross'],
  'lao-redcross': ['lao_redcross'],
  lao_tv: ['lao_tv', 'lao-tv'],
  'lao-tv': ['lao_tv'],
  lao_hd: ['lao_hd', 'lao-hd'],
  'lao-hd': ['lao_hd'],
  lao_extra: ['lao_extra', 'lao-extra'],
  'lao-extra': ['lao_extra'],
  lao_star: ['lao_star', 'lao-star', 'lao-stars'],
  'lao-star': ['lao_star'],
  'lao-stars': ['lao_star'],
  lao_star_vip: ['lao_star_vip', 'lao-star-vip', 'lao-stars-vip'],
  'lao-star-vip': ['lao_star_vip'],
  'lao-stars-vip': ['lao_star_vip'],
  lao_union: ['lao_union', 'lao-union'],
  'lao-union': ['lao_union'],
  lao_union_vip: ['lao_union_vip', 'lao-union-vip'],
  'lao-union-vip': ['lao_union_vip'],
  lao_asean: ['lao_asean', 'lao-asean'],
  'lao-asean': ['lao_asean'],
  hanoi_extra: ['hanoi_extra', 'hanoi-extra'],
  hanoi_star: ['hanoi_star', 'hanoi-star'],
  hanoi_develop: ['hanoi_develop', 'hanoi-develop'],
  hanoi_hd: ['hanoi_hd', 'hanoi-hd'],
  hanoi_tv: ['hanoi_tv', 'hanoi-tv'],
  hanoi_redcross: ['hanoi_redcross', 'hanoi-redcross'],
  lao_pathana: ['lao_pathana', 'lao-pathana'],
  'lao-pathana': ['lao_pathana'],
  'hanoi-normal': ['ynhn'],
  malay: ['ynma'],
  'yeekee-vip': ['tykc'],
  'stock-thai': ['gsth'],
  'stock-hangseng-morning': ['gshka'],
  'stock-hangseng-morning-vip': ['hangseng_morning_vip'],
  'stock-hangseng-afternoon': ['gshkp'],
  'stock-hangseng-afternoon-vip': ['hangseng_afternoon_vip'],
  'stock-taiwan': ['gstw'],
  'stock-taiwan-vip': ['taiwan_vip'],
  'stock-nikkei-morning': ['nikkei_morning', 'gsjpa'],
  'stock-nikkei-morning-vip': ['nikkei_morning_vip'],
  'stock-nikkei-afternoon': ['gsjpp'],
  'stock-nikkei-afternoon-vip': ['nikkei_afternoon_vip'],
  'stock-korea': ['gskr'],
  'stock-korea-vip': ['korea_vip'],
  'stock-china-morning': ['gscna'],
  'stock-china-morning-vip': ['china_morning_vip'],
  'stock-china-afternoon': ['china_afternoon', 'gscnp'],
  'stock-china-afternoon-vip': ['china_afternoon_vip'],
  'stock-singapore': ['gssg'],
  'stock-singapore-vip': ['singapore_vip'],
  'stock-india': ['gsin'],
  'stock-egypt': ['gseg'],
  'stock-russia': ['gsru'],
  'stock-russia-vip': ['russia_vip'],
  'stock-germany': ['gsde'],
  'stock-germany-vip': ['germany_vip'],
  'stock-england': ['gsuk'],
  'stock-england-vip': ['england_vip'],
  'stock-dowjones': ['dowjones_vip', 'gsus']
};

const SOURCE_LABELS = {
  api: 'API',
  manual: 'กรอกมือ',
  legacy: 'ผลเดิม',
  unknown: 'ไม่ระบุ'
};

const STATUS_META = {
  open: {
    label: 'เปิดรับ',
    icon: FiCheckCircle,
    cardClass: 'is-open'
  },
  upcoming: {
    label: 'ยังไม่เปิด',
    icon: FiClock,
    cardClass: 'is-upcoming'
  },
  closed: {
    label: 'ปิดรับ',
    icon: FiSlash,
    cardClass: 'is-closed'
  },
  resulted: {
    label: 'ประกาศผลแล้ว',
    icon: FiAlertCircle,
    cardClass: 'is-resulted'
  },
  pending: {
    label: 'รอผล',
    icon: FiClock,
    cardClass: 'is-closed'
  },
  waiting: {
    label: 'รอข้อมูล',
    icon: FiAlertCircle,
    cardClass: 'is-missing'
  },
  live: {
    label: 'มีผลแล้ว',
    icon: FiCheckCircle,
    cardClass: 'is-resulted'
  },
  missing: {
    label: 'ยังไม่มีงวด',
    icon: FiAlertCircle,
    cardClass: 'is-missing'
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;

const SYNTHETIC_ROUND_SCHEDULES = {
  'hanoi-vip': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 20, closeMinute: 20, drawHour: 20, drawMinute: 30, roundDateOffsetDays: 0 },
  'hanoi-specific': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 17, closeMinute: 20, drawHour: 17, drawMinute: 30, roundDateOffsetDays: 0 },
  lao: { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 20, closeMinute: 20, drawHour: 20, drawMinute: 30, roundDateOffsetDays: 0 },
  'lao-vip': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 21, closeMinute: 20, drawHour: 21, drawMinute: 30, roundDateOffsetDays: 0 },
  'hanoi-normal': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 19, closeMinute: 20, drawHour: 19, drawMinute: 30, roundDateOffsetDays: 0 },
  malay: { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 19, closeMinute: 50, drawHour: 20, drawMinute: 0, roundDateOffsetDays: 0 },
  'yeekee-vip': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 22, closeMinute: 50, drawHour: 23, drawMinute: 0, roundDateOffsetDays: 0 },
  'stock-thai': { weekdays: [1, 2, 3, 4, 5], closeHour: 18, closeMinute: 0, drawHour: 18, drawMinute: 15, roundDateOffsetDays: 0 },
  'stock-hangseng-morning': { weekdays: [1, 2, 3, 4, 5], closeHour: 11, closeMinute: 45, drawHour: 12, drawMinute: 0, roundDateOffsetDays: 0 },
  'stock-hangseng-morning-vip': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 11, closeMinute: 35, drawHour: 11, drawMinute: 40, roundDateOffsetDays: 0 },
  'stock-hangseng-afternoon': { weekdays: [1, 2, 3, 4, 5], closeHour: 15, closeMinute: 45, drawHour: 16, drawMinute: 0, roundDateOffsetDays: 0 },
  'stock-hangseng-afternoon-vip': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 15, closeMinute: 35, drawHour: 15, drawMinute: 40, roundDateOffsetDays: 0 },
  'stock-taiwan': { weekdays: [1, 2, 3, 4, 5], closeHour: 13, closeMinute: 15, drawHour: 13, drawMinute: 30, roundDateOffsetDays: 0 },
  'stock-taiwan-vip': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 12, closeMinute: 30, drawHour: 12, drawMinute: 35, roundDateOffsetDays: 0 },
  'stock-nikkei-morning-vip': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 11, closeMinute: 0, drawHour: 11, drawMinute: 5, roundDateOffsetDays: 0 },
  'stock-nikkei-afternoon': { weekdays: [1, 2, 3, 4, 5], closeHour: 14, closeMinute: 15, drawHour: 14, drawMinute: 30, roundDateOffsetDays: 0 },
  'stock-nikkei-afternoon-vip': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 15, closeMinute: 20, drawHour: 15, drawMinute: 25, roundDateOffsetDays: 0 },
  'stock-korea': { weekdays: [1, 2, 3, 4, 5], closeHour: 14, closeMinute: 15, drawHour: 14, drawMinute: 30, roundDateOffsetDays: 0 },
  'stock-korea-vip': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 14, closeMinute: 30, drawHour: 14, drawMinute: 35, roundDateOffsetDays: 0 },
  'stock-china-morning': { weekdays: [1, 2, 3, 4, 5], closeHour: 11, closeMinute: 15, drawHour: 11, drawMinute: 30, roundDateOffsetDays: 0 },
  'stock-china-morning-vip': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 11, closeMinute: 0, drawHour: 11, drawMinute: 5, roundDateOffsetDays: 0 },
  'stock-china-afternoon': { weekdays: [1, 2, 3, 4, 5], closeHour: 13, closeMinute: 20, drawHour: 13, drawMinute: 40, roundDateOffsetDays: 0 },
  'stock-china-afternoon-vip': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 15, closeMinute: 20, drawHour: 15, drawMinute: 25, roundDateOffsetDays: 0 },
  'stock-singapore': { weekdays: [1, 2, 3, 4, 5], closeHour: 16, closeMinute: 45, drawHour: 17, drawMinute: 0, roundDateOffsetDays: 0 },
  'stock-india': { weekdays: [1, 2, 3, 4, 5], closeHour: 17, closeMinute: 45, drawHour: 18, drawMinute: 0, roundDateOffsetDays: 0 },
  'stock-egypt': { weekdays: [1, 2, 3, 4, 5], closeHour: 20, closeMinute: 15, drawHour: 20, drawMinute: 25, roundDateOffsetDays: 0 },
  'stock-russia': { weekdays: [1, 2, 3, 4, 5], closeHour: 23, closeMinute: 50, drawHour: 0, drawMinute: 0, roundDateOffsetDays: -1 },
  'stock-russia-vip': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 23, closeMinute: 45, drawHour: 23, drawMinute: 50, roundDateOffsetDays: 0 },
  'stock-germany': { weekdays: [1, 2, 3, 4, 5], closeHour: 2, closeMinute: 45, drawHour: 3, drawMinute: 0, roundDateOffsetDays: -1 },
  'stock-germany-vip': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 22, closeMinute: 45, drawHour: 22, drawMinute: 50, roundDateOffsetDays: 0 },
  'stock-england': { weekdays: [1, 2, 3, 4, 5], closeHour: 0, closeMinute: 30, drawHour: 0, drawMinute: 45, roundDateOffsetDays: -1 },
  'stock-england-vip': { weekdays: [0, 1, 2, 3, 4, 5, 6], closeHour: 21, closeMinute: 45, drawHour: 21, drawMinute: 50, roundDateOffsetDays: 0 }
};

const normalizeKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_]+/g, '-');

const createBangkokDate = (year, month, day, hour = 0, minute = 0) =>
  new Date(Date.UTC(year, month - 1, day, hour - 7, minute));

const getBangkokParts = (value = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: THAI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(value).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  const shifted = new Date(value.getTime() + 7 * 60 * 60 * 1000);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: shifted.getUTCDay()
  };
};

const getBangkokDateTimeInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: THAI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

const parseBangkokDateTimeInput = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match.map(Number);
  const date = createBangkokDate(year, month, day, hour, minute);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatClock = (value) => formatDateTime(value, {
  fallback: '-',
  options: {
    hour: '2-digit',
    minute: '2-digit'
  }
});

const formatUpdatedAt = (value) => formatDateTime(value, {
  fallback: '-',
  options: {
    dateStyle: 'medium',
    timeStyle: 'short'
  }
});

const formatHitValue = (primaryValue, hits = []) => {
  const values = [...new Set((Array.isArray(hits) ? hits : []).map((item) => String(item || '').trim()).filter(Boolean))];
  if (values.length) {
    return values.join(' / ');
  }

  return String(primaryValue || '').trim();
};

const buildResultItems = (result) => {
  if (!result) return [];

  const threeTopValue = formatHitValue(result.threeTop, result.threeTopHits);
  const twoTopValue = formatHitValue(result.twoTop, result.twoTopHits);
  const threeFrontValue = formatHitValue(result.threeFront, result.threeFrontHits);
  const threeBottomValue = formatHitValue(result.threeBottom, result.threeBottomHits);
  const twoBottomValue = formatHitValue(result.twoBottom, result.twoBottomHits);

  const structuredItems = [
    { label: 'เลขเด่น', value: result.headline || '-' },
    result.firstPrize ? { label: 'รางวัลหลัก', value: result.firstPrize } : null,
    threeTopValue ? { label: '3 ตัวบน', value: threeTopValue } : null,
    twoTopValue && twoTopValue !== twoBottomValue ? { label: '2 ตัวบน', value: twoTopValue } : null,
    threeFrontValue ? { label: '3 ตัวหน้า', value: threeFrontValue } : null,
    threeBottomValue ? { label: '3 ตัวล่าง', value: threeBottomValue } : null,
    twoBottomValue ? { label: '2 ตัวล่าง', value: twoBottomValue } : null
  ].filter(Boolean);

  if (structuredItems.length > 1) {
    return structuredItems;
  }

  const fallbackNumbers = (result.numbers || [])
    .filter((item) => item?.value)
    .map((item) => ({
      label: item.label || 'ผลย่อย',
      value: item.value
    }));

  return fallbackNumbers.length ? fallbackNumbers : structuredItems;
};

const flattenApiMarkets = (overview) => {
  const map = new Map();
  (overview?.sections || []).forEach((section) => {
    (section.markets || []).forEach((market) => {
      const hydrated = {
        ...market,
        sectionId: section.id,
        sectionTitle: section.title
      };
      map.set(normalizeKey(market.id), hydrated);
      map.set(normalizeKey(market.name), hydrated);
    });
  });
  return map;
};

const buildCatalogLotteryMap = (overview) => {
  const map = new Map();

  (overview?.leagues || []).forEach((league) => {
    (league.lotteries || []).forEach((lottery) => {
      const aliases = [
        ...(CATALOG_MARKET_ALIASES[lottery.code] || []),
        lottery.code,
        lottery.name,
        lottery.shortName
      ];

      aliases.forEach((alias) => {
        map.set(normalizeKey(alias), lottery);
      });
    });
  });

  return map;
};

const resolveCatalogLottery = (apiMarket, catalogLotteryMap) => {
  const candidates = [
    apiMarket.id,
    apiMarket.name,
    apiMarket.marketId,
    apiMarket.sectionId
  ];

  for (const candidate of candidates) {
    const lottery = catalogLotteryMap.get(normalizeKey(candidate));
    if (lottery) return lottery;
  }

  return null;
};

const resolveStatusMeta = (status) => STATUS_META[status] || STATUS_META.missing;

const buildApiResultSnapshot = (apiMarket) => ({
  headline: apiMarket?.headline || '',
  numbers: apiMarket?.numbers || [],
  sourceType: 'api',
  sourceUrl: apiMarket?.sourceUrl || '',
  resultPublishedAt: apiMarket?.resultDate || null,
  drawAt: apiMarket?.resultDate || null
});

const formatLotteryDisplayDate = (value, fallback = '-') => {
  if (!value) return fallback;
  return formatRoundLabel(value, { fallback });
};

const buildSyntheticRound = (marketId, now = new Date()) => {
  const schedule = SYNTHETIC_ROUND_SCHEDULES[marketId];
  if (!schedule) return null;

  const occurrences = [];

  for (let offset = -1; offset <= 4; offset += 1) {
    const candidateDate = new Date(now.getTime() + offset * DAY_MS);
    const parts = getBangkokParts(candidateDate);

    if (schedule.weekdays && !schedule.weekdays.includes(parts.weekday)) {
      continue;
    }

    const drawAt = createBangkokDate(parts.year, parts.month, parts.day, schedule.drawHour, schedule.drawMinute);
    const closeAt = createBangkokDate(parts.year, parts.month, parts.day, schedule.closeHour, schedule.closeMinute);
    const openAt = new Date(drawAt.getTime() - DAY_MS);
    const roundDate = new Date(drawAt.getTime() + (schedule.roundDateOffsetDays || 0) * DAY_MS);
    const displayDate = formatThaiDate(roundDate, { fallback: '-' });

    occurrences.push({
      id: `synthetic-${marketId}-${parts.year}${String(parts.month).padStart(2, '0')}${String(parts.day).padStart(2, '0')}`,
      code: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
      title: `รอบ ${displayDate}`,
      openAt,
      closeAt,
      drawAt,
      displayDate,
      isSynthetic: true
    });
  }

  if (!occurrences.length) return null;

  occurrences.sort((left, right) => left.drawAt - right.drawAt);
  return (
    occurrences.find((round) => now <= round.closeAt)
    || occurrences.find((round) => now <= round.drawAt)
    || occurrences[0]
    || null
  );
};

const getCardDisplayDate = (card, fallback) => {
  const latestRoundDate = card?.latestResult?.drawAt
    || card?.latestResult?.roundCode
    || card?.latestResult?.resultPublishedAt
    || card?.apiMarket?.resultDate;
  if (latestRoundDate) {
    return formatRoundLabel(latestRoundDate, { fallback });
  }

  if (card?.activeRound?.displayDate) {
    return formatLotteryDisplayDate(card.activeRound.displayDate, fallback);
  }

  if (card?.activeRound?.drawAt) {
    return formatThaiDate(card.activeRound.drawAt, { fallback });
  }

  const roundLabel = formatRoundLabel(card?.activeRound?.title, { fallback: '' });
  if (roundLabel) {
    return roundLabel;
  }

  return fallback;
};

const getResultDisplayDate = (result, fallback = '-') => {
  const roundDate = result?.drawAt || result?.roundCode || result?.resultPublishedAt;
  if (!roundDate) return fallback;
  return formatRoundLabel(roundDate, { fallback });
};

const getWarningMarketMatch = (warning, cards) => cards.find((card) => (
  [card?.name, card?.shortName, card?.apiMarket?.name]
    .filter(Boolean)
    .some((value) => String(warning || '').includes(value))
));

const buildRecentResultsMap = (overview) => {
  const map = new Map();

  (overview?.recentResults || []).forEach((result) => {
    [result.lotteryCode, result.lotteryName, result.lotteryShortName]
      .filter(Boolean)
      .forEach((alias) => {
        const key = normalizeKey(alias);
        const bucket = map.get(key) || [];
        bucket.push(result);
        map.set(key, bucket);
      });
  });

  return map;
};

const resolveResultKeys = (apiMarket, matchedLottery) => [
  matchedLottery?.code,
  ...(API_MARKET_RESULT_ALIASES[apiMarket.id] || []),
  apiMarket.id,
  apiMarket.marketId,
  apiMarket.name,
  matchedLottery?.name,
  matchedLottery?.shortName
].filter(Boolean);

const getLatestRecentResult = (recentResultsMap, resultKeys) => {
  for (const key of resultKeys) {
    const entries = recentResultsMap.get(normalizeKey(key));
    if (entries?.length) {
      return getLatestResultCandidate(entries);
    }
  }

  return null;
};

const getRecentHistory = (recentResultsMap, resultKeys, limit = 6) => {
  const merged = [];
  const seen = new Set();

  resultKeys.forEach((key) => {
    const entries = recentResultsMap.get(normalizeKey(key)) || [];
    entries.forEach((entry) => {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        merged.push(entry);
      }
    });
  });

  return sortResultsByLatestFirst(merged).slice(0, limit);
};

const formatInteger = (value) => new Intl.NumberFormat('th-TH').format(Number(value || 0));

const buildSettlementFeedback = (action, payload) => {
  if (!payload) return null;

  if (action === 'reconcile') {
    const mismatchedItems = Number(payload.mismatchedItems || 0);
    return {
      title: 'ตรวจความสอดคล้องล่าสุด',
      className: mismatchedItems > 0 ? 'is-warning' : 'is-ok',
      lines: [
        `รายการทั้งหมด ${formatInteger(payload.totalItems)} รายการ`,
        `ผิดปกติ ${formatInteger(mismatchedItems)} รายการ`,
        `ยอดจ่ายที่ใช้จริง ${formatInteger(payload.appliedPayoutTotal)} บาท`
      ]
    };
  }

  if (action === 'reverse') {
    return {
      title: 'ย้อน settlement แล้ว',
      className: 'is-warning',
      lines: [
        `รีเซ็ตรายการ ${formatInteger(payload.resetItemCount)} รายการ`,
        `ยอด rollback ${formatInteger(payload.reversedPayoutTotal)} บาท`,
        `ledger ที่สร้าง ${formatInteger(payload.reversalEntryCount)} รายการ`
      ]
    };
  }

  if (action === 'rerun') {
    const settlement = payload.settlement || {};
    return {
      title: 'รัน settlement ใหม่แล้ว',
      className: 'is-ok',
      lines: [
        `ผู้ชนะ ${formatInteger(settlement.wonCount)} รายการ`,
        `ยอดจ่าย ${formatInteger(settlement.totalWon)} บาท`,
        `กำไรสุทธิ ${formatInteger(settlement.netProfit)} บาท`
      ]
    };
  }

  return null;
};

const AdminLottery = ({ viewerRole = 'admin' }) => {
  const isAdmin = viewerRole === 'admin';
  const [searchParams] = useSearchParams();
  const [catalogOverview, setCatalogOverview] = useState(null);
  const [marketOverview, setMarketOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingLatest, setSyncingLatest] = useState(false);
  const [selectedCode, setSelectedCode] = useState('');
  const [syncStatus, setSyncStatus] = useState(null);
  const [bettingOverrideBusy, setBettingOverrideBusy] = useState('');
  const [timingBusy, setTimingBusy] = useState(false);
  const [timingDraft, setTimingDraft] = useState({ openAt: '', closeAt: '' });
  const [settlementBusy, setSettlementBusy] = useState('');
  const [settlementFeedback, setSettlementFeedback] = useState(null);
  const [marketHistoryCache, setMarketHistoryCache] = useState({});

  const loadData = async ({ silent = false, force = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setMarketHistoryCache({});

    const [catalogResult, marketResult, syncResult] = await Promise.allSettled([
      getCatalogOverview({ force }),
      getMarketOverview({ force }),
      isAdmin ? getLotterySyncStatus({ force }) : Promise.resolve({ data: null })
    ]);

    if (catalogResult.status === 'fulfilled') {
      setCatalogOverview(catalogResult.value.data || null);
    } else {
      console.error(catalogResult.reason);
      toast.error('โหลดข้อมูลผลหวยไม่สำเร็จ');
      setCatalogOverview({ leagues: [], recentResults: [] });
    }

    if (marketResult.status === 'fulfilled') {
      setMarketOverview(marketResult.value.data || null);
    } else {
      console.error(marketResult.reason);
      toast.error('โหลดสถานะ API ผลหวยไม่สำเร็จ');
      setMarketOverview({ provider: { configured: false }, warnings: [] });
    }

    if (syncResult.status === 'fulfilled') {
      setSyncStatus(syncResult.value.data || null);
    } else if (isAdmin) {
      console.error(syncResult.reason);
      toast.error('โหลดสถานะซิงก์ผลหวยไม่สำเร็จ');
      setSyncStatus({
        running: false,
        lastError: syncResult.reason?.message || 'โหลดสถานะซิงก์ไม่สำเร็จ',
        lastSummary: null,
        mappingCoverage: null,
        feeds: []
      });
    } else {
      setSyncStatus(null);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSettlementFeedback(null);
  }, [selectedCode]);

  const handleSyncLatest = async () => {
    setSyncingLatest(true);
    try {
      const response = await syncLatestLottery();
      const summary = response.data?.summary || null;
      if (summary?.skipped) {
        toast.success(UI.syncLatestSkipped);
      } else {
        toast.success(summary?.mode === 'fetch-store' ? UI.syncLatestDeferredSuccess : UI.syncLatestSuccess);
      }
      await loadData({ silent: true, force: true });
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || UI.syncLatestError);
    } finally {
      setSyncingLatest(false);
    }
  };

  const handleBettingToggle = async () => {
    if (!activeRoundId) {
      toast.error(bettingToggleUnavailableReason || BETTING_TOGGLE_UI.unavailable);
      return;
    }

    const nextOverride = bettingToggleChecked ? 'closed' : 'open';
    setBettingOverrideBusy(nextOverride);

    try {
      await updateRoundBettingOverride(activeRoundId, { bettingOverride: nextOverride });
      toast.success(BETTING_TOGGLE_UI.updated);
      await loadData({ silent: true, force: true });
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || BETTING_TOGGLE_UI.error);
    } finally {
      setBettingOverrideBusy('');
    }
  };

  const handleBettingReset = async () => {
    if (!activeRoundId) {
      toast.error(bettingToggleUnavailableReason || BETTING_TOGGLE_UI.unavailable);
      return;
    }

    setBettingOverrideBusy('auto');

    try {
      await updateRoundBettingOverride(activeRoundId, { bettingOverride: 'auto' });
      toast.success(BETTING_TOGGLE_UI.resetDone);
      await loadData({ silent: true, force: true });
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || BETTING_TOGGLE_UI.error);
    } finally {
      setBettingOverrideBusy('');
    }
  };

  const handleTimingSave = async () => {
    if (!activeRoundId) {
      toast.error(bettingToggleUnavailableReason || BETTING_TOGGLE_UI.unavailable);
      return;
    }

    const openAt = parseBangkokDateTimeInput(timingDraft.openAt);
    const closeAt = parseBangkokDateTimeInput(timingDraft.closeAt);
    if (!openAt || !closeAt || openAt.getTime() >= closeAt.getTime()) {
      toast.error(BETTING_TOGGLE_UI.timingInvalid);
      return;
    }

    setTimingBusy(true);
    try {
      await updateRoundTiming(activeRoundId, {
        openAt: openAt.toISOString(),
        closeAt: closeAt.toISOString()
      });
      toast.success(BETTING_TOGGLE_UI.timingUpdated);
      await loadData({ silent: true, force: true });
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || BETTING_TOGGLE_UI.timingError);
    } finally {
      setTimingBusy(false);
    }
  };

  const requestedMarketKey = useMemo(
    () => normalizeKey(searchParams.get('marketId') || searchParams.get('marketName') || searchParams.get('market') || ''),
    [searchParams]
  );
  const requestedRoundKey = useMemo(
    () => normalizeKey(searchParams.get('roundCode') || searchParams.get('roundDate') || searchParams.get('round') || ''),
    [searchParams]
  );

  const displaySections = useMemo(() => {
    const catalogLotteryMap = buildCatalogLotteryMap(catalogOverview);
    const recentResultsMap = buildRecentResultsMap(catalogOverview);

    return (marketOverview?.sections || [])
      .map((section) => ({
        id: section.id,
        code: section.id,
        name: section.title,
        description: section.description,
        cards: (section.markets || []).map((apiMarket) => {
          const matchedLottery = resolveCatalogLottery(apiMarket, catalogLotteryMap);
          const resultKeys = resolveResultKeys(apiMarket, matchedLottery);
          const fallbackRecentResult = getLatestRecentResult(recentResultsMap, resultKeys);
          const latestResult = getLatestResultCandidate([
            matchedLottery?.latestResult,
            fallbackRecentResult,
            buildApiResultSnapshot(apiMarket)
          ]) || buildApiResultSnapshot(apiMarket);
          const effectiveStatus = matchedLottery?.status
            || ((apiMarket.status === 'waiting' || apiMarket.status === 'missing') && fallbackRecentResult ? 'live' : (apiMarket.status || 'missing'));
          const statusMeta = resolveStatusMeta(effectiveStatus);

          const resolvedActiveRound = matchedLottery?.activeRound || buildSyntheticRound(apiMarket.id);

          return {
            id: matchedLottery?.id || apiMarket.id,
            code: matchedLottery?.code || apiMarket.id,
            selectionKey: apiMarket.id,
            name: matchedLottery?.name || apiMarket.name,
            shortName: matchedLottery?.shortName || apiMarket.name,
            status: effectiveStatus,
            statusLabel: statusMeta.label,
            statusIcon: statusMeta.icon,
            statusClass: statusMeta.cardClass,
            activeRound: resolvedActiveRound,
            latestResult,
            historyKeys: resultKeys,
            providerConfigured: apiMarket?.providerConfigured ?? marketOverview?.provider?.configured ?? true,
            apiMarket,
            visual: getLotteryVisual(matchedLottery?.code || apiMarket.id, matchedLottery?.shortName || apiMarket.name)
          };
        })
      }))
      .filter((section) => section.cards.length > 0);
  }, [catalogOverview, marketOverview]);

  useEffect(() => {
    if (!displaySections.length) {
      setSelectedCode('');
      return;
    }

    const cards = displaySections.flatMap((section) => section.cards);
    const availableCodes = cards.map((card) => card.selectionKey);

    if (requestedMarketKey) {
      const matchedCard = cards.find((card) => {
        const candidates = [
          card.selectionKey,
          card.id,
          card.code,
          card.name,
          card.shortName,
          card.apiMarket?.id,
          card.apiMarket?.name
        ]
          .map((value) => normalizeKey(value))
          .filter(Boolean);
        return candidates.includes(requestedMarketKey);
      });

      if (matchedCard) {
        setSelectedCode(matchedCard.selectionKey);
        return;
      }
    }

    setSelectedCode((current) => (availableCodes.includes(current) ? current : availableCodes[0]));
  }, [displaySections, requestedMarketKey]);

  const selectedCard = useMemo(
    () => displaySections.flatMap((section) => section.cards).find((card) => card.selectionKey === selectedCode) || null,
    [displaySections, selectedCode]
  );
  const selectedLotteryId = selectedCard?.id || '';
  const selectedSelectionKey = selectedCard?.selectionKey || '';
  const hasSelectedMarketHistory = selectedLotteryId ? Boolean(marketHistoryCache[selectedLotteryId]) : false;

  useEffect(() => {
    const lotteryId = selectedLotteryId;
    const canLoadMarketHistory = Boolean(lotteryId && lotteryId !== selectedSelectionKey);

    if (!canLoadMarketHistory || hasSelectedMarketHistory) {
      return undefined;
    }

    let cancelled = false;

    const loadMarketHistory = async () => {
      try {
        const response = await getRecentMarketResults({ lotteryId, limit: 20 });
        if (!cancelled) {
          setMarketHistoryCache((current) => ({
            ...current,
            [lotteryId]: Array.isArray(response.data) ? response.data : []
          }));
        }
      } catch (error) {
        console.error(error);
      }
    };

    loadMarketHistory();

    return () => {
      cancelled = true;
    };
  }, [hasSelectedMarketHistory, selectedLotteryId, selectedSelectionKey]);

  const availableSelectedHistory = useMemo(() => {
    if (!selectedCard) return [];

    const cachedHistory = marketHistoryCache[selectedCard.id];
    if (cachedHistory?.length) {
      return sortResultsByLatestFirst(cachedHistory);
    }

    if (!selectedCard.historyKeys?.length) return [];
    return sortResultsByLatestFirst(getRecentHistory(buildRecentResultsMap(catalogOverview), selectedCard.historyKeys, 20));
  }, [catalogOverview, marketHistoryCache, selectedCard]);

  const selectedHistory = useMemo(
    () => availableSelectedHistory.slice(0, 6),
    [availableSelectedHistory]
  );

  const selectedResult = useMemo(() => {
    const candidates = [selectedCard?.latestResult, ...availableSelectedHistory].filter(Boolean);
    if (!candidates.length) return null;
    if (!requestedRoundKey) return candidates[0];

    return (
      candidates.find((result) => {
        const roundCandidates = [
          result.roundCode,
          result.drawAt,
          result.resultPublishedAt,
          formatRoundLabel(result.drawAt || result.roundCode, { fallback: '' })
        ]
          .map((value) => normalizeKey(value))
          .filter(Boolean);
        return roundCandidates.includes(requestedRoundKey);
      }) || candidates[0]
    );
  }, [availableSelectedHistory, requestedRoundKey, selectedCard]);
  const detailDisplayDate = requestedRoundKey && selectedResult
    ? getResultDisplayDate(selectedResult, getCardDisplayDate(selectedCard, UI.noRound))
    : getCardDisplayDate(selectedCard, UI.noRound);
  const detailResolvedDate = selectedResult
    ? formatThaiDate(
      selectedResult.drawAt || selectedResult.resultPublishedAt,
      { fallback: selectedResult.roundCode || UI.noRound }
    )
    : (selectedCard?.activeRound?.drawAt
      ? formatThaiDate(selectedCard.activeRound.drawAt)
      : (selectedCard?.apiMarket?.resultDate
        ? formatThaiDate(selectedCard.apiMarket.resultDate, { fallback: selectedCard.apiMarket.resultDate })
        : UI.noRound));
  const SelectedStatusIcon = selectedCard?.statusIcon || FiAlertCircle;
  const activeRound = selectedCard?.activeRound || null;
  const activeRoundStatus = activeRound?.status || selectedCard?.status || 'missing';
  const activeRoundStatusMeta = resolveStatusMeta(activeRoundStatus);
  const ActiveRoundStatusIcon = activeRoundStatusMeta.icon;
  const activeRoundId = activeRound?.isSynthetic ? '' : (activeRound?.id || '');
  const activeRoundBettingOverride = activeRound?.bettingOverride || 'auto';
  const activeRoundOverrideLabel = activeRoundBettingOverride === 'open'
    ? BETTING_TOGGLE_UI.forcedOpen
    : (activeRoundBettingOverride === 'closed' ? BETTING_TOGGLE_UI.forcedClosed : BETTING_TOGGLE_UI.auto);
  const bettingToggleUnavailableReason = !activeRoundId
    ? (activeRound?.isSynthetic ? BETTING_TOGGLE_UI.synthetic : BETTING_TOGGLE_UI.unavailable)
    : (activeRoundStatus === 'resulted' ? BETTING_TOGGLE_UI.resulted : '');
  const bettingToggleChecked = activeRoundStatus === 'open';
  const activeRoundOpenInput = getBangkokDateTimeInputValue(activeRound?.openAt);
  const activeRoundCloseInput = getBangkokDateTimeInputValue(activeRound?.closeAt);
  const timingDraftChanged = Boolean(activeRoundId) && (
    timingDraft.openAt !== activeRoundOpenInput ||
    timingDraft.closeAt !== activeRoundCloseInput
  );

  useEffect(() => {
    setTimingDraft({
      openAt: activeRoundOpenInput,
      closeAt: activeRoundCloseInput
    });
  }, [activeRoundId, activeRoundOpenInput, activeRoundCloseInput]);

  const syncSummary = syncStatus?.lastSummary || null;
  const syncCoverage = syncStatus?.mappingCoverage || syncSummary?.mappingCoverage || null;
  const syncFeedIssues = useMemo(
    () => (syncSummary?.feedSummaries || []).filter((feed) => feed.status !== 'ok'),
    [syncSummary]
  );
  const syncMetrics = useMemo(() => ([
    {
      label: UI.syncConfiguredFeeds,
      value: syncCoverage ? formatInteger(syncCoverage.configuredCount) : '-',
      note: syncStatus?.feeds?.length ? `${formatInteger(syncStatus.feeds.length)} feeds` : UI.syncSummaryEmpty
    },
    {
      label: UI.syncExplicitFeeds,
      value: syncCoverage ? `${formatInteger(syncCoverage.explicitCount)}/${formatInteger(syncCoverage.configuredCount)}` : '-',
      note: syncCoverage?.strictMode ? UI.syncStrictModeOn : UI.syncStrictModeOff
    },
    {
      label: UI.syncProblemFeeds,
      value: syncSummary ? formatInteger((syncSummary.warningFeeds || 0) + (syncSummary.errorFeeds || 0)) : '-',
      note: syncStatus?.lastError ? UI.syncLastError : UI.syncSummaryTitle
    },
    {
      label: UI.syncSettlements,
      value: syncSummary ? formatInteger(syncSummary.settlements) : '-',
      note: syncSummary?.syncedAt
        ? `${UI.syncLastRun} ${formatUpdatedAt(syncSummary.syncedAt)} · ${syncSummary?.mode === 'fetch-store' ? UI.syncModeDeferred : UI.syncModeFull}`
        : UI.syncSummaryEmpty
    }
  ]), [syncCoverage, syncStatus, syncSummary]);
  const settlementRoundId = selectedResult?.roundId
    || (selectedCard?.activeRound?.isSynthetic ? '' : (selectedCard?.activeRound?.id || ''));
  const settlementUnavailableReason = selectedResult && !selectedResult?.roundId
    ? UI.settlementPendingPublish
    : (!settlementRoundId
      ? (selectedCard?.activeRound?.isSynthetic ? UI.settlementSynthetic : UI.settlementUnavailable)
      : '');
  const pageWarnings = useMemo(() => {
    const cards = displaySections.flatMap((section) => section.cards);

    return [
      ...(marketOverview?.warnings || []),
      ...(marketOverview?.provider?.configured === false ? [UI.apiNotConfigured] : []),
      ...(syncStatus?.lastError ? [`${UI.syncLastError}: ${syncStatus.lastError}`] : [])
    ]
      .filter(Boolean)
      .filter((warning) => {
        if (!/ManyCai/i.test(String(warning || ''))) {
          return true;
        }

        const matchedCard = getWarningMarketMatch(warning, cards);
        if (!matchedCard) {
          return true;
        }

        const hasVisibleResult =
          hasResultContent(matchedCard.latestResult)
          || hasResultContent(buildApiResultSnapshot(matchedCard.apiMarket));
        const hasResolvedStatus = !['waiting', 'missing'].includes(matchedCard.status);

        return !(hasVisibleResult || hasResolvedStatus);
      });
  }, [displaySections, marketOverview, syncStatus]);
  const connectionStatus = useMemo(() => {
    if (syncStatus?.lastError) {
      return {
        label: UI.syncLastError,
        className: 'is-warning',
        note: syncStatus.lastError
      };
    }
    const fallbackOnly = pageWarnings.length === 1 && /fallback|สำรอง/i.test(pageWarnings[0] || '');
    if (fallbackOnly) {
      return {
        label: 'เชื่อมต่อผ่าน feed สำรอง',
        className: 'is-fallback',
        note: 'ระบบยังดึงผลหวยได้ แต่ใช้ช่องทางสำรองแทน API หลัก'
      };
    }

    if (pageWarnings.length > 0) {
      return {
        label: 'บางตลาดยังรอข้อมูล',
        className: 'is-warning',
        note: 'ตรวจพบตลาดที่เชื่อมต่อได้ไม่ครบหรือผลยังไม่พร้อมแสดง'
      };
    }

    return {
      label: 'เชื่อมต่อปกติ',
      className: 'is-ok',
      note: 'ระบบเชื่อมต่อข้อมูลผลหวยได้ตามปกติ'
    };
  }, [pageWarnings, syncStatus]);

  const handleSettlementAction = async (action) => {
    if (!settlementRoundId) {
      toast.error(settlementUnavailableReason || UI.settlementUnavailable);
      return;
    }

    setSettlementBusy(action);

    try {
      let response;
      if (action === 'reconcile') {
        response = await reconcileLotteryRoundSettlement(settlementRoundId);
      } else if (action === 'reverse') {
        response = await reverseLotteryRoundSettlement(settlementRoundId);
      } else {
        response = await rerunLotteryRoundSettlement(settlementRoundId);
      }

      const payload = action === 'reconcile' ? response.data : (response.data?.summary || null);
      setSettlementFeedback(buildSettlementFeedback(action, payload));
      await loadData({ silent: true, force: true });

      if (action === 'reconcile') {
        toast.success('ตรวจสอบ settlement สำเร็จ');
      } else if (action === 'reverse') {
        toast.success('ย้อน settlement สำเร็จ');
      } else {
        toast.success('รัน settlement ใหม่สำเร็จ');
      }
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'จัดการ settlement ไม่สำเร็จ');
    } finally {
      setSettlementBusy('');
    }
  };

  if (loading) {
    return <PageSkeleton statCount={0} rows={6} sidebar={false} />;
  }

  return (
    <div className="animate-fade-in admin-lottery-page">
      <section className="card lottery-hero">
        <div className="lottery-hero-copy">
          <span className="section-eyebrow">{UI.eyebrow}</span>
          <h1 className="page-title">{UI.title}</h1>
          <p className="page-subtitle">{UI.subtitle}</p>
        </div>
        <div className="lottery-hero-actions">
          {isAdmin ? (
            <button
              type="button"
              className="button button-secondary refresh-button sync-button"
              onClick={handleSyncLatest}
              disabled={refreshing || syncingLatest || Boolean(syncStatus?.running)}
            >
              <FiRefreshCw className={(syncingLatest || syncStatus?.running) ? 'spin' : ''} />
              {syncingLatest || syncStatus?.running ? UI.syncLatestBusy : UI.syncLatest}
            </button>
          ) : null}
          <button
            type="button"
            className="button button-secondary refresh-button"
            onClick={() => loadData({ silent: true, force: true })}
            disabled={refreshing || syncingLatest}
          >
            <FiRefreshCw className={refreshing ? 'spin' : ''} />
            {UI.refresh}
          </button>
        </div>
      </section>

      <section className="card warning-panel">
        <div className="warning-head">
          <div>
            <div className="warning-title"><FiAlertCircle /> {UI.warningTitle}</div>
            <p className="warning-note">{connectionStatus.note}</p>
          </div>
          <span className={`connection-pill ${connectionStatus.className}`}>{connectionStatus.label}</span>
        </div>
        {pageWarnings.length > 0 ? (
          <div className="warning-list">
            {pageWarnings.map((warning, index) => (
              <span key={`${warning}-${index}`} className="warning-chip">{warning}</span>
            ))}
          </div>
        ) : null}

        {isAdmin ? (
          <>
        <div className="sync-metrics-grid">
          {syncMetrics.map((metric) => (
            <article key={metric.label} className="sync-metric-card">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.note}</small>
            </article>
          ))}
        </div>

        {syncFeedIssues.length > 0 ? (
          <div className="sync-feed-panel">
            <div className="sync-feed-title">{UI.syncFeedIssues}</div>
            <div className="sync-feed-list">
              {syncFeedIssues.slice(0, 8).map((feed) => (
                <article key={feed.feedCode} className={`sync-feed-card is-${feed.status}`}>
                  <div>
                    <strong>{feed.marketName}</strong>
                    <span>{feed.feedCode} · {feed.mappingMode}</span>
                  </div>
                  <small>{feed.error || feed.warnings[0] || 'ต้องตรวจสอบเพิ่มเติม'}</small>
                </article>
              ))}
            </div>
          </div>
        ) : null}
          </>
        ) : null}
      </section>

      {!displaySections.length ? (
        <section className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><FiAlertCircle /></div>
            <div className="empty-state-text">{UI.noData}</div>
          </div>
        </section>
      ) : (
        <div className="lottery-grid-layout">
          <div className="lottery-sections">
            {displaySections.map((section) => (
              <section key={section.id} className="card lottery-section-card">
                <div className="section-head">
                  <div>
                    <div className="section-title">{section.name}</div>
                    <p className="section-note">{section.description}</p>
                  </div>
                </div>

                <div className="market-grid">
                  {section.cards.map((card) => {
                    const StatusIcon = card.statusIcon;
                    const isSelected = selectedCode === card.selectionKey;
                    const latestHeadline = card.latestResult?.headline || card.apiMarket?.headline || '';

                    return (
                      <button
                        key={card.selectionKey}
                        type="button"
                        className={`market-card ${card.statusClass} ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => setSelectedCode(card.selectionKey)}
                      >
                        <div
                          className="market-logo"
                          style={{
                            background: card.visual.background,
                            '--logo-accent': card.visual.accent
                          }}
                        >
                          <span>{card.visual.shortLabel}</span>
                          <i />
                        </div>

                        <div className="market-card-body">
                          <div className="market-card-top">
                            <div>
                              <h3>{card.name}</h3>
                              <div className="market-round">{getCardDisplayDate(card, UI.noRound)}</div>
                            </div>

                            <span className="market-status-pill">
                              <StatusIcon />
                              {card.statusLabel}
                            </span>
                          </div>

                          <div className="market-card-foot">
                            <span>
                              {latestHeadline
                                ? `${UI.latestResult} ${latestHeadline}`
                                : (card.providerConfigured ? UI.latestHeadlineFallback : UI.providerUnavailable)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <aside className="card lottery-detail-card">
            {selectedCard ? (
              <>
                <div className="detail-top">
                  <div className="detail-market-meta">
                    <span className="section-eyebrow">{UI.latestDetailTitle}</span>
                    <h2>{selectedCard.name}</h2>
                    <div className="detail-market-date">{detailDisplayDate}</div>
                    <p>
                      {detailResolvedDate}
                      {' · '}
                    </p>
                  </div>

                  <span className={`detail-status-pill ${selectedCard.statusClass}`}>
                    <SelectedStatusIcon />
                    {selectedCard.statusLabel}
                  </span>
                </div>

                {isAdmin ? (
                  <section className="round-toggle-panel">
                    <div className="settlement-head">
                      <div>
                        <div className="history-title">{BETTING_TOGGLE_UI.title}</div>
                        <p className="settlement-note">{BETTING_TOGGLE_UI.help}</p>
                      </div>
                      {activeRound ? (
                        <span className={`detail-status-pill ${activeRoundStatusMeta.cardClass}`}>
                          <ActiveRoundStatusIcon />
                          {activeRoundStatusMeta.label}
                        </span>
                      ) : null}
                    </div>

                    {bettingToggleUnavailableReason ? (
                      <div className="detail-empty compact">{bettingToggleUnavailableReason}</div>
                    ) : (
                      <>
                        <div className="round-toggle-body">
                          <div className="round-toggle-copy">
                            <strong>{activeRoundOverrideLabel}</strong>
                            <span>{activeRound?.title || activeRound?.code || UI.noRound}</span>
                          </div>

                          <label className={`round-toggle-switch ${bettingToggleChecked ? 'is-checked' : ''} ${bettingOverrideBusy ? 'is-disabled' : ''}`}>
                            <input
                              type="checkbox"
                              checked={bettingToggleChecked}
                              onChange={handleBettingToggle}
                              disabled={Boolean(bettingOverrideBusy)}
                            />
                            <span className="round-toggle-track">
                              <span className="round-toggle-thumb" />
                            </span>
                            <span className="round-toggle-text">
                              {bettingOverrideBusy && bettingOverrideBusy !== 'auto'
                                ? BETTING_TOGGLE_UI.busy
                                : (bettingToggleChecked ? BETTING_TOGGLE_UI.open : BETTING_TOGGLE_UI.closed)}
                            </span>
                          </label>
                        </div>

                        <div className="round-timing-form">
                          <div className="round-timing-head">
                            <div>
                              <strong>{BETTING_TOGGLE_UI.timingTitle}</strong>
                              <span>{BETTING_TOGGLE_UI.timingHelp}</span>
                            </div>
                            {activeRound?.isManualTiming ? (
                              <span className="round-toggle-pill is-compact">{BETTING_TOGGLE_UI.manualTiming}</span>
                            ) : null}
                          </div>

                          <div className="round-timing-grid">
                            <label>
                              <span>{BETTING_TOGGLE_UI.openAtLabel}</span>
                              <input
                                type="datetime-local"
                                value={timingDraft.openAt}
                                onChange={(event) => setTimingDraft((current) => ({ ...current, openAt: event.target.value }))}
                                disabled={timingBusy}
                              />
                            </label>
                            <label>
                              <span>{BETTING_TOGGLE_UI.closeAtLabel}</span>
                              <input
                                type="datetime-local"
                                value={timingDraft.closeAt}
                                onChange={(event) => setTimingDraft((current) => ({ ...current, closeAt: event.target.value }))}
                                disabled={timingBusy}
                              />
                            </label>
                          </div>

                          <button
                            type="button"
                            className="button button-primary round-timing-save"
                            onClick={handleTimingSave}
                            disabled={timingBusy || !timingDraftChanged}
                          >
                            {timingBusy ? BETTING_TOGGLE_UI.savingTiming : BETTING_TOGGLE_UI.saveTiming}
                          </button>
                        </div>
                      </>
                    )}

                    {activeRoundId ? (
                      <div className="round-toggle-footer">
                        <span className="round-toggle-pill">{activeRound?.code || activeRound?.title || '-'}</span>
                        <button
                          type="button"
                          className="button button-secondary round-toggle-reset"
                          onClick={handleBettingReset}
                          disabled={Boolean(bettingOverrideBusy) || activeRoundBettingOverride === 'auto' || Boolean(bettingToggleUnavailableReason)}
                        >
                          {bettingOverrideBusy === 'auto' ? BETTING_TOGGLE_UI.busy : BETTING_TOGGLE_UI.reset}
                        </button>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <section className="detail-result-hero">
                  <div className="detail-result-label">{UI.latestResult}</div>
                  <div className="detail-result-headline">{selectedResult?.headline || '-'}</div>
                  <div className="detail-result-meta">
                    <span>{UI.source}: {SOURCE_LABELS[selectedResult?.sourceType] || SOURCE_LABELS.unknown}</span>
                    <span>{UI.updatedAt}: {formatUpdatedAt(selectedResult?.resultPublishedAt || selectedResult?.drawAt)}</span>
                  </div>
                </section>

                {selectedResult ? (
                  <div className="detail-result-grid">
                    {buildResultItems(selectedResult).map((item) => (
                      <article key={`${item.label}-${item.value}`} className="detail-result-item">
                        <span>{item.label}</span>
                        <strong>{item.value || '-'}</strong>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="detail-empty">{UI.noResult}</div>
                )}

                {selectedCard?.apiMarket?.provider ? (
                  <div className="detail-provider-note">
                    {UI.source}: {selectedCard.apiMarket.provider}
                  </div>
                ) : null}

                {selectedResult?.sourceUrl ? (
                  <a
                    className="detail-link"
                    href={selectedResult.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FiExternalLink />
                    {UI.apiLink}
                  </a>
                ) : null}

                {isAdmin ? (
                  <section className="settlement-panel">
                  <div className="settlement-head">
                    <div>
                      <div className="history-title">{UI.settlementTitle}</div>
                      <p className="settlement-note">{UI.settlementHelp}</p>
                    </div>
                    {settlementRoundId ? (
                      <span className="settlement-round-pill">{selectedResult?.roundCode || selectedCard.activeRound?.code || selectedCard.activeRound?.title || '-'}</span>
                    ) : null}
                  </div>

                  {settlementUnavailableReason ? (
                    <div className="detail-empty compact">{settlementUnavailableReason}</div>
                  ) : (
                    <div className="settlement-actions">
                      <button
                        type="button"
                        className="button button-secondary settlement-button"
                        onClick={() => handleSettlementAction('reconcile')}
                        disabled={Boolean(settlementBusy)}
                      >
                        <FiCheckCircle />
                        {settlementBusy === 'reconcile' ? UI.settlementBusy : UI.settlementReconcile}
                      </button>
                      <button
                        type="button"
                        className="button button-secondary settlement-button is-warning"
                        onClick={() => handleSettlementAction('reverse')}
                        disabled={Boolean(settlementBusy)}
                      >
                        <FiSlash />
                        {settlementBusy === 'reverse' ? UI.settlementBusy : UI.settlementReverse}
                      </button>
                      <button
                        type="button"
                        className="button button-secondary settlement-button is-accent"
                        onClick={() => handleSettlementAction('rerun')}
                        disabled={Boolean(settlementBusy)}
                      >
                        <FiRotateCcw />
                        {settlementBusy === 'rerun' ? UI.settlementBusy : UI.settlementRerun}
                      </button>
                    </div>
                  )}

                  {settlementFeedback ? (
                    <article className={`settlement-feedback ${settlementFeedback.className || ''}`}>
                      <strong>{settlementFeedback.title}</strong>
                      <div className="settlement-feedback-lines">
                        {settlementFeedback.lines.map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </div>
                    </article>
                  ) : (
                    <div className="settlement-empty">{UI.settlementFeedbackEmpty}</div>
                  )}
                  </section>
                ) : null}

                <div className="history-head">
                  <div className="history-title">{UI.recentHistoryTitle}</div>
                  <div className="history-count">{selectedHistory.length} งวด</div>
                </div>

                {selectedHistory.length ? (
                  <div className="history-list">
                    {selectedHistory.map((result) => (
                      <article key={result.id} className="history-item">
                        <div>
                          <div className="history-round">{formatRoundLabel(result.drawAt || result.roundCode, { fallback: result.roundCode || '-' })}</div>
                          <div className="history-source">{SOURCE_LABELS[result.sourceType] || SOURCE_LABELS.unknown}</div>
                        </div>
                        <div className="history-headline">{result.headline || '-'}</div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="detail-empty">{UI.noHistory}</div>
                )}
              </>
            ) : (
              <div className="detail-empty">{UI.noData}</div>
            )}
          </aside>
        </div>
      )}

      <style>{`
        .admin-lottery-page {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .lottery-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 26px 28px;
        }

        .lottery-hero-copy {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .lottery-hero-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .lottery-hero .page-title {
          margin: 0;
          font-size: clamp(2.2rem, 4vw, 3.4rem);
          line-height: 0.95;
          letter-spacing: -0.04em;
        }

        .lottery-hero .page-subtitle {
          margin: 0;
          max-width: 58ch;
        }

        .refresh-button {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 156px;
          justify-content: center;
          padding: 12px 18px;
          border-radius: 16px;
          border: 1px solid rgba(239, 68, 68, 0.18);
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 238, 238, 0.96));
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
          color: #991b1b;
          font-weight: 800;
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }

        .refresh-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 18px 34px rgba(15, 23, 42, 0.1);
          border-color: rgba(239, 68, 68, 0.28);
        }

        .refresh-button:disabled {
          opacity: 0.72;
        }

        .sync-button {
          border-color: rgba(14, 165, 233, 0.2);
          background: linear-gradient(135deg, rgba(240, 249, 255, 0.98), rgba(224, 242, 254, 0.96));
          color: #0f766e;
        }

        .sync-button:hover:not(:disabled) {
          border-color: rgba(14, 165, 233, 0.32);
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        .warning-panel {
          padding: 18px 20px;
          border-color: rgba(245, 158, 11, 0.3);
          background: linear-gradient(135deg, rgba(255, 251, 235, 0.92), rgba(255, 247, 237, 0.92));
        }

        .warning-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 12px;
        }

        .warning-title {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          color: #9a3412;
          margin-bottom: 12px;
        }

        .warning-note {
          margin: 0;
          color: #9a3412;
          opacity: 0.88;
        }

        .connection-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 14px;
          border-radius: 999px;
          font-size: 0.88rem;
          font-weight: 800;
          white-space: nowrap;
          border: 1px solid transparent;
        }

        .connection-pill.is-ok {
          background: rgba(220, 252, 231, 0.88);
          color: #166534;
          border-color: rgba(34, 197, 94, 0.22);
        }

        .connection-pill.is-warning,
        .connection-pill.is-fallback {
          background: rgba(255, 255, 255, 0.82);
          color: #9a3412;
          border-color: rgba(251, 191, 36, 0.45);
        }

        .warning-list {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .warning-chip {
          display: inline-flex;
          align-items: center;
          padding: 10px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(251, 191, 36, 0.45);
          color: #7c2d12;
          font-size: 0.92rem;
        }

        .sync-metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 16px;
        }

        .sync-metric-card {
          padding: 14px 16px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(251, 191, 36, 0.25);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sync-metric-card span {
          font-size: 0.84rem;
          color: #9a3412;
        }

        .sync-metric-card strong {
          font-size: 1.4rem;
          letter-spacing: -0.03em;
          color: #431407;
        }

        .sync-metric-card small {
          color: #9a3412;
          opacity: 0.86;
        }

        .sync-feed-panel {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .sync-feed-title {
          font-weight: 800;
          color: #9a3412;
        }

        .sync-feed-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .sync-feed-card {
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(148, 163, 184, 0.24);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .sync-feed-card.is-warning {
          border-color: rgba(245, 158, 11, 0.36);
        }

        .sync-feed-card.is-error {
          border-color: rgba(239, 68, 68, 0.28);
          background: rgba(254, 242, 242, 0.84);
        }

        .sync-feed-card strong {
          display: block;
          color: #431407;
        }

        .sync-feed-card span,
        .sync-feed-card small {
          color: #7c2d12;
          font-size: 0.88rem;
        }

        .lottery-grid-layout {
          display: grid;
          grid-template-columns: minmax(0, 7fr) minmax(320px, 3fr);
          gap: 18px;
          align-items: start;
        }

        .lottery-sections {
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
        }

        .lottery-section-card,
        .lottery-detail-card {
          padding: 18px;
        }

        .lottery-section-card {
          content-visibility: auto;
          contain-intrinsic-size: 420px;
        }

        .lottery-detail-card {
          position: sticky;
          top: 18px;
          max-height: calc(100vh - 36px);
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.42) transparent;
        }

        .lottery-detail-card::-webkit-scrollbar {
          width: 8px;
        }

        .lottery-detail-card::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.42);
          border-radius: 999px;
        }

        .lottery-detail-card::-webkit-scrollbar-track {
          background: transparent;
        }

        .section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 14px;
        }

        .section-title {
          font-size: 1.7rem;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .section-note {
          margin: 6px 0 0;
          color: var(--text-muted);
        }

        .market-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .market-card {
          width: 100%;
          display: grid;
          grid-template-columns: 82px minmax(0, 1fr);
          gap: 14px;
          align-items: stretch;
          border-radius: 24px;
          border: 1px solid rgba(244, 114, 182, 0.18);
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(255, 248, 248, 0.96));
          padding: 16px;
          text-align: left;
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }

        .market-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 34px rgba(15, 23, 42, 0.08);
        }

        .market-card.is-selected {
          border-color: rgba(239, 68, 68, 0.42);
          box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.12);
        }

        .market-card.is-open {
          background: linear-gradient(135deg, rgba(236, 253, 245, 0.98), rgba(220, 252, 231, 0.94));
          border-color: rgba(34, 197, 94, 0.25);
        }

        .market-card.is-closed,
        .market-card.is-upcoming {
          background: linear-gradient(135deg, rgba(248, 250, 252, 0.98), rgba(241, 245, 249, 0.96));
          border-color: rgba(148, 163, 184, 0.22);
        }

        .market-card.is-resulted {
          background: linear-gradient(135deg, rgba(255, 251, 235, 0.96), rgba(255, 247, 237, 0.96));
          border-color: rgba(245, 158, 11, 0.24);
        }

        .market-card.is-missing {
          background: linear-gradient(135deg, rgba(254, 242, 242, 0.96), rgba(255, 241, 242, 0.96));
          border-color: rgba(248, 113, 113, 0.22);
        }

        .market-logo {
          position: relative;
          width: 82px;
          height: 82px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1.2rem;
          font-weight: 900;
          letter-spacing: -0.03em;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
        }

        .market-logo i {
          position: absolute;
          right: 8px;
          bottom: 8px;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: var(--logo-accent);
          border: 2px solid rgba(255, 255, 255, 0.86);
        }

        .market-card-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-width: 0;
        }

        .market-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .market-card-top h3 {
          margin: 0;
          font-size: 1.35rem;
          line-height: 1;
          letter-spacing: -0.03em;
        }

        .market-round {
          margin-top: 6px;
          color: var(--text-muted);
          font-size: 0.92rem;
        }

        .market-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 0.86rem;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(148, 163, 184, 0.22);
          white-space: nowrap;
        }

        .detail-result-item span {
          display: block;
          font-size: 0.82rem;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .market-card-foot {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 0.92rem;
          color: var(--text-muted);
        }

        .detail-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 18px;
        }

        .detail-market-meta h2 {
          margin: 6px 0 8px;
          font-size: 2rem;
          letter-spacing: -0.04em;
        }

        .detail-market-meta p {
          display: none;
          margin: 0;
          color: var(--text-muted);
        }

        .detail-market-date {
          margin: 0;
          color: var(--text-muted);
        }

        .detail-market-meta p {
          display: none;
        }

        .detail-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 999px;
          font-weight: 700;
          white-space: nowrap;
          background: rgba(255, 255, 255, 0.78);
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .detail-result-hero {
          padding: 18px;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.92));
          color: white;
        }

        .detail-result-label {
          font-size: 0.84rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.72);
        }

        .detail-result-headline {
          margin-top: 10px;
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .detail-result-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 18px;
          margin-top: 12px;
          color: rgba(255, 255, 255, 0.72);
          font-size: 0.9rem;
        }

        .detail-result-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 16px;
        }

        .detail-result-item {
          padding: 16px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 248, 248, 0.98));
          border: 1px solid rgba(244, 114, 182, 0.14);
        }

        .detail-result-item strong {
          font-size: 1.45rem;
          letter-spacing: -0.03em;
        }

        .detail-link {
          margin-top: 14px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--primary);
          font-weight: 700;
        }

        .detail-provider-note {
          margin-top: 14px;
          color: var(--text-muted);
          font-size: 0.92rem;
        }

        .round-toggle-panel {
          margin-top: 18px;
          padding: 16px;
          border-radius: 22px;
          background: linear-gradient(135deg, rgba(236, 253, 245, 0.96), rgba(240, 253, 250, 0.92));
          border: 1px solid rgba(16, 185, 129, 0.18);
        }

        .round-toggle-body {
          margin-top: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .round-toggle-copy {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .round-toggle-copy strong {
          font-size: 1rem;
        }

        .round-toggle-copy span,
        .round-toggle-text {
          color: var(--text-muted);
          font-size: 0.92rem;
        }

        .round-toggle-switch {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          user-select: none;
          font-weight: 800;
          color: #0f172a;
        }

        .round-toggle-switch input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .round-toggle-track {
          width: 64px;
          height: 36px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.34);
          padding: 4px;
          transition: background .18s ease;
        }

        .round-toggle-thumb {
          display: block;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
          transition: transform .18s ease;
        }

        .round-toggle-switch.is-checked .round-toggle-track {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.92), rgba(5, 150, 105, 0.92));
        }

        .round-toggle-switch.is-checked .round-toggle-thumb {
          transform: translateX(28px);
        }

        .round-toggle-switch.is-disabled {
          opacity: 0.68;
          cursor: not-allowed;
        }

        .round-toggle-footer {
          margin-top: 14px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: stretch;
          gap: 12px;
        }

        .round-toggle-pill {
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          min-height: 48px;
          padding: 0 16px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(16, 185, 129, 0.22);
          color: #047857;
          font-size: 0.84rem;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.06);
        }

        .round-toggle-pill.is-compact {
          min-height: 34px;
          padding: 0 12px;
          font-size: 0.78rem;
        }

        .round-toggle-reset {
          min-height: 48px;
          padding: 0 18px;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(240, 249, 255, 0.94));
          color: #0f172a;
          font-weight: 800;
          box-shadow: 0 10px 18px rgba(15, 23, 42, 0.08);
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }

        .round-toggle-reset:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(14, 116, 144, 0.26);
          box-shadow: 0 14px 24px rgba(14, 116, 144, 0.14);
        }

        .round-toggle-reset:disabled {
          opacity: 0.6;
          box-shadow: none;
        }

        .round-timing-form {
          margin-top: 14px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.76);
          border: 1px solid rgba(16, 185, 129, 0.18);
        }

        .round-timing-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .round-timing-head > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .round-timing-head strong {
          color: #0f172a;
          font-size: 0.96rem;
        }

        .round-timing-head span {
          color: var(--text-muted);
          font-size: 0.86rem;
        }

        .round-timing-grid {
          margin-top: 12px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .round-timing-grid label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          color: var(--text-muted);
          font-size: 0.82rem;
          font-weight: 700;
        }

        .round-timing-grid input {
          width: 100%;
          min-height: 44px;
          border: 1px solid rgba(16, 185, 129, 0.22);
          border-radius: 14px;
          padding: 0 12px;
          background: rgba(255, 255, 255, 0.94);
          color: #0f172a;
          font: inherit;
          font-weight: 800;
          outline: none;
        }

        .round-timing-grid input:focus {
          border-color: rgba(16, 185, 129, 0.58);
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
        }

        .round-timing-save {
          margin-top: 12px;
          width: 100%;
          min-height: 44px;
          border-radius: 14px;
          border: 0;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.98), rgba(5, 150, 105, 0.96));
          color: white;
          font-weight: 900;
          box-shadow: 0 12px 22px rgba(5, 150, 105, 0.2);
        }

        .round-timing-save:disabled {
          opacity: 0.58;
          cursor: not-allowed;
          box-shadow: none;
        }

        .settlement-panel {
          margin-top: 18px;
          padding: 16px;
          border-radius: 22px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 248, 248, 0.96));
          border: 1px solid rgba(244, 114, 182, 0.14);
        }

        .settlement-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .settlement-note {
          margin: 6px 0 0;
          color: var(--text-muted);
          font-size: 0.92rem;
        }

        .settlement-round-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(254, 242, 242, 0.9);
          border: 1px solid rgba(248, 113, 113, 0.2);
          color: #991b1b;
          font-size: 0.84rem;
          font-weight: 800;
          white-space: nowrap;
        }

        .settlement-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .settlement-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 46px;
          font-weight: 800;
        }

        .settlement-button.is-warning {
          color: #9a3412;
          border-color: rgba(245, 158, 11, 0.3);
          background: rgba(255, 251, 235, 0.92);
        }

        .settlement-button.is-accent {
          color: #1d4ed8;
          border-color: rgba(96, 165, 250, 0.26);
          background: rgba(239, 246, 255, 0.94);
        }

        .settlement-feedback,
        .settlement-empty {
          margin-top: 14px;
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(255, 255, 255, 0.82);
        }

        .settlement-feedback.is-ok {
          border-color: rgba(34, 197, 94, 0.28);
          background: rgba(236, 253, 245, 0.88);
        }

        .settlement-feedback.is-warning {
          border-color: rgba(245, 158, 11, 0.32);
          background: rgba(255, 251, 235, 0.9);
        }

        .settlement-feedback strong {
          display: block;
          margin-bottom: 8px;
        }

        .settlement-feedback-lines {
          display: flex;
          flex-direction: column;
          gap: 4px;
          color: var(--text-muted);
          font-size: 0.92rem;
        }

        .settlement-empty {
          color: var(--text-muted);
          font-size: 0.92rem;
        }

        .detail-empty.compact {
          margin-top: 14px;
          padding: 14px 16px;
        }

        .history-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 22px 0 12px;
        }

        .history-title {
          font-size: 1.1rem;
          font-weight: 800;
        }

        .history-count {
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .history-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.78);
          border: 1px solid rgba(244, 114, 182, 0.14);
        }

        .history-round {
          font-weight: 700;
        }

        .history-source {
          margin-top: 4px;
          color: var(--text-muted);
          font-size: 0.88rem;
        }

        .history-headline {
          font-size: 1.1rem;
          font-weight: 900;
          letter-spacing: 0.06em;
        }

        .detail-empty {
          margin-top: 16px;
          padding: 18px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px dashed rgba(148, 163, 184, 0.3);
          color: var(--text-muted);
          text-align: center;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 1200px) {
          .lottery-grid-layout {
            grid-template-columns: 1fr;
          }

          .lottery-detail-card {
            position: static;
            max-height: none;
            overflow: visible;
          }
        }

        @media (max-width: 980px) {
          .market-grid {
            grid-template-columns: 1fr;
          }

          .warning-head {
            flex-direction: column;
            align-items: flex-start;
          }

          .sync-metrics-grid,
          .sync-feed-list,
          .settlement-actions {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .lottery-hero {
            flex-direction: column;
            align-items: stretch;
          }

          .lottery-hero-actions {
            justify-content: stretch;
          }

          .lottery-hero-actions .refresh-button {
            width: 100%;
          }

          .market-card {
            grid-template-columns: 1fr;
          }

          .market-logo {
            width: 72px;
            height: 72px;
          }

          .detail-result-grid {
            grid-template-columns: 1fr;
          }

          .detail-top,
          .round-toggle-body,
          .history-item,
          .market-card-top {
            flex-direction: column;
            align-items: flex-start;
          }

          .round-toggle-footer {
            grid-template-columns: 1fr;
          }

          .round-timing-head,
          .round-timing-grid {
            grid-template-columns: 1fr;
          }

          .round-timing-head {
            flex-direction: column;
          }

          .round-toggle-reset {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminLottery;

