const DEFAULT_RATE_TIERS = [
  {
    code: 'standard',
    name: 'มาตรฐาน',
    description: 'อัตราจ่ายเริ่มต้นสำหรับผู้เล่นทั่วไป',
    isDefault: true,
    rates: {
      '3top': 500,
      '3tod': 100,
      '2top': 70,
      '2bottom': 70,
      'run_top': 3,
      'run_bottom': 2
    }
  },
  {
    code: 'pro',
    name: 'โปร',
    description: 'อัตราจ่ายระดับโปรสำหรับโต๊ะที่เปิดเรทสูงขึ้น',
    isDefault: false,
    rates: {
      '3top': 650,
      '3tod': 120,
      '2top': 90,
      '2bottom': 90,
      'run_top': 4,
      'run_bottom': 3
    }
  },
  {
    code: 'vip',
    name: 'VIP',
    description: 'อัตราจ่ายระดับสูงสำหรับการกำหนดสิทธิ์รายสายงานในอนาคต',
    isDefault: false,
    rates: {
      '3top': 700,
      '3tod': 150,
      '2top': 92,
      '2bottom': 92,
      'run_top': 5,
      'run_bottom': 4
    }
  }
];

const LOTTERY_LEAGUES = [
  {
    code: 'government',
    name: 'รัฐบาล',
    description: 'หวยรัฐบาลและหวยกึ่งรัฐที่ออกรอบใหญ่',
    sortOrder: 1
  },
  {
    code: 'foreign',
    name: 'ต่างประเทศ',
    description: 'หวยต่างประเทศและหวยอิงตลาดต่างประเทศ',
    sortOrder: 2
  },
  {
    code: 'daily',
    name: 'รายวัน',
    description: 'หวยรายวันออกรายรอบตลอดสัปดาห์',
    sortOrder: 3
  },
  {
    code: 'stocks',
    name: 'หุ้น',
    description: 'หวยอิงผลตลาดหุ้นในประเทศและต่างประเทศ',
    sortOrder: 4
  },
  {
    code: 'vip',
    name: 'VIP',
    description: 'โต๊ะเรทสูงและสินค้าพิเศษ',
    sortOrder: 5
  }
];

const LOTTERY_TYPES = [
  {
    code: 'thai_government',
    leagueCode: 'government',
    name: 'รัฐบาลไทย',
    shortName: 'ไทย',
    description: 'หวยรัฐบาลไทย งวดวันที่ 1 และ 16 ของเดือน',
    provider: 'Internal Feed',
    schedule: {
      type: 'monthly',
      days: [1, 16],
      openLeadDays: 7,
      closeHour: 14,
      closeMinute: 30,
      drawHour: 16,
      drawMinute: 0
    },
    supportedBetTypes: ['3top', '3tod', '2top', '2bottom', 'run_top', 'run_bottom'],
    resultSource: 'legacy'
  },
  {
    code: 'baac',
    leagueCode: 'government',
    name: 'ธกส',
    shortName: 'ธกส',
    description: 'หวย ธกส รอบเช้าสำหรับตลาดรัฐบาล',
    provider: 'Internal Feed',
    schedule: {
      type: 'monthly',
      days: [1, 16],
      openLeadDays: 5,
      closeHour: 11,
      closeMinute: 45,
      drawHour: 12,
      drawMinute: 15
    },
    supportedBetTypes: ['3top', '3tod', '2top', '2bottom'],
    resultSource: 'manual'
  },
  {
    code: 'hanoi_special',
    leagueCode: 'foreign',
    name: 'ฮานอยพิเศษ',
    shortName: 'ฮานอยพิเศษ',
    description: 'หวยต่างประเทศรอบรายวันช่วงเช้า',
    provider: 'Market Feed',
    schedule: {
      type: 'daily',
      weekdays: [1, 2, 3, 4, 5, 6],
      openLeadDays: 1,
      closeHour: 16,
      closeMinute: 5,
      drawHour: 16,
      drawMinute: 20
    },
    supportedBetTypes: ['3top', '3tod', '2top', '2bottom', 'run_top', 'run_bottom'],
    resultSource: 'manual'
  },
  {
    code: 'lao_vip',
    leagueCode: 'daily',
    name: 'ลาว VIP',
    shortName: 'ลาว VIP',
    description: 'หวยลาวรอบเรทสูง รายวัน',
    provider: 'Market Feed',
    schedule: {
      type: 'daily',
      weekdays: [1, 2, 3, 4, 5, 6, 0],
      openLeadDays: 1,
      closeHour: 20,
      closeMinute: 15,
      drawHour: 20,
      drawMinute: 30
    },
    supportedBetTypes: ['3top', '3tod', '2top', '2bottom', 'run_top', 'run_bottom'],
    resultSource: 'manual'
  },
  {
    code: 'dowjones_vip',
    leagueCode: 'vip',
    name: 'ดาวโจนส์ VIP',
    shortName: 'ดาวโจนส์ VIP',
    description: 'หวย VIP อิงผลต่างประเทศรอบค่ำ',
    provider: 'Market Feed',
    schedule: {
      type: 'daily',
      weekdays: [1, 2, 3, 4, 5],
      openLeadDays: 1,
      closeHour: 22,
      closeMinute: 45,
      drawHour: 23,
      drawMinute: 5
    },
    supportedBetTypes: ['3top', '3tod', '2top', '2bottom', 'run_top', 'run_bottom'],
    resultSource: 'manual'
  },
  {
    code: 'nikkei_morning',
    leagueCode: 'stocks',
    name: 'นิเคอิเช้า',
    shortName: 'นิเคอิเช้า',
    description: 'หวยหุ้นเช้าอิงผลนิเคอิ',
    provider: 'Market Feed',
    schedule: {
      type: 'daily',
      weekdays: [1, 2, 3, 4, 5],
      openLeadDays: 1,
      closeHour: 9,
      closeMinute: 20,
      drawHour: 9,
      drawMinute: 35
    },
    supportedBetTypes: ['3top', '2top', '2bottom', 'run_top', 'run_bottom'],
    resultSource: 'manual'
  },
  {
    code: 'china_afternoon',
    leagueCode: 'stocks',
    name: 'จีนบ่าย',
    shortName: 'จีนบ่าย',
    description: 'หวยหุ้นจีนภาคบ่าย',
    provider: 'Market Feed',
    schedule: {
      type: 'daily',
      weekdays: [1, 2, 3, 4, 5],
      openLeadDays: 1,
      closeHour: 13,
      closeMinute: 20,
      drawHour: 13,
      drawMinute: 40
    },
    supportedBetTypes: ['3top', '2top', '2bottom', 'run_top', 'run_bottom'],
    resultSource: 'manual'
  }
];

const DEFAULT_ANNOUNCEMENTS = [
  {
    code: 'phase1-launch',
    title: 'เปิดใช้งานล็อตเตอรี่หลายตลาดแบบอ่านอย่างเดียว',
    body: 'ระบบเริ่มรองรับการเลือกตลาดหวยและงวดหลายประเภทเพื่อเตรียมต่อยอดหน้า member แบบใหม่ใน phase ถัดไป',
    audience: ['admin', 'agent', 'customer']
  }
];

module.exports = {
  DEFAULT_RATE_TIERS,
  LOTTERY_LEAGUES,
  LOTTERY_TYPES,
  DEFAULT_ANNOUNCEMENTS
};
