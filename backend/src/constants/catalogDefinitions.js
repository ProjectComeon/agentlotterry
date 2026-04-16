const { BET_TYPES, DEFAULT_GLOBAL_RATES } = require('./betting');

const GOVERNMENT_BET_TYPES = ['3top', '3front', '3bottom', '3tod', '2top', '2bottom', 'run_top', 'run_bottom'];
const STANDARD_BET_TYPES = ['3top', '3tod', '2top', '2bottom', 'run_top', 'run_bottom'];
const LAO_BET_TYPES = [...STANDARD_BET_TYPES, 'lao_set4'];
const STOCK_BET_TYPES = ['3top', '3tod', '2top', '2bottom', 'run_top', 'run_bottom'];
const BAAC_BET_TYPES = ['3top', '3tod', '2top', '2bottom'];
const GSB_BET_TYPES = STANDARD_BET_TYPES;

const DAILY_ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

const DEFAULT_RATE_TIERS = [
  {
    code: 'default-global',
    name: 'เรทกลาง',
    description: 'เรทตั้งต้นกลางของระบบสำหรับทุกหวย โดยให้ admin และ agent ปรับต่อรายสมาชิกได้',
    isDefault: true,
    rates: {
      ...DEFAULT_GLOBAL_RATES
    },
    commissions: {
      '3top': 0,
      '3front': 0,
      '3bottom': 0,
      '3tod': 0,
      '2top': 0,
      '2bottom': 0,
      '2tod': 0,
      'run_top': 0,
      'run_bottom': 0,
      'lao_set4': 0
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

const createDailySchedule = ({
  weekdays = DAILY_ALL_DAYS,
  openLeadDays = 1,
  closeHour,
  closeMinute,
  drawHour,
  drawMinute
}) => ({
  type: 'daily',
  weekdays,
  openLeadDays,
  closeHour,
  closeMinute,
  drawHour,
  drawMinute
});

const createLottery = ({
  code,
  leagueCode,
  name,
  shortName = name,
  description,
  provider = 'Market Feed',
  schedule,
  supportedBetTypes = STANDARD_BET_TYPES,
  resultSource = 'manual'
}) => ({
  code,
  leagueCode,
  name,
  shortName,
  description,
  provider,
  schedule,
  supportedBetTypes,
  resultSource
});

const LOTTERY_TYPES = [
  createLottery({
    code: 'thai_government',
    leagueCode: 'government',
    name: 'รัฐบาลไทย',
    shortName: 'ไทย',
    description: 'หวยรัฐบาลไทย งวดวันที่ 1 และ 16 ของเดือน',
    provider: 'GLO Official',
    schedule: {
      type: 'monthly',
      days: [1, 16],
      openLeadDays: 7,
      closeHour: 14,
      closeMinute: 30,
      drawHour: 16,
      drawMinute: 0
    },
    supportedBetTypes: GOVERNMENT_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'baac',
    leagueCode: 'government',
    name: 'ธกส',
    shortName: 'ธกส',
    description: 'สลากออมทรัพย์ ธ.ก.ส. รอบเช้าสำหรับตลาดรัฐบาล',
    provider: 'BAAC Official',
    schedule: {
      type: 'monthly',
      days: [1, 16],
      openLeadDays: 5,
      closeHour: 11,
      closeMinute: 45,
      drawHour: 12,
      drawMinute: 15
    },
    supportedBetTypes: BAAC_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'gsb',
    leagueCode: 'government',
    name: 'ออมสิน',
    shortName: 'ออมสิน',
    description: 'สลากออมสิน 1 ปี 100 บาท ใช้กติกาตลาดมาตรฐานของระบบ โดยอิงผล 3 ตัวบน 2 ตัวบน และ 2 ตัวล่างจากเว็บทางการ',
    provider: 'GSB Official',
    schedule: {
      type: 'monthly',
      days: [1, 16],
      openLeadDays: 3,
      closeHour: 10,
      closeMinute: 0,
      drawHour: 12,
      drawMinute: 0
    },
    supportedBetTypes: GSB_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'hnvip',
    leagueCode: 'foreign',
    name: 'ฮานอย VIP',
    description: 'หวยฮานอย VIP ออกรายวันช่วงค่ำ',
    schedule: createDailySchedule({
      closeHour: 20,
      closeMinute: 20,
      drawHour: 20,
      drawMinute: 30
    })
  }),
  createLottery({
    code: 'hanoi_special',
    leagueCode: 'foreign',
    name: 'ฮานอยพิเศษ',
    description: 'หวยฮานอยพิเศษออกรายวันช่วงเย็น',
    schedule: createDailySchedule({
      closeHour: 16,
      closeMinute: 5,
      drawHour: 16,
      drawMinute: 20
    })
  }),
  createLottery({
    code: 'cqhn',
    leagueCode: 'foreign',
    name: 'ฮานอยเฉพาะกิจ',
    description: 'หวยฮานอยเฉพาะกิจออกรายวันช่วงเย็น',
    schedule: createDailySchedule({
      closeHour: 17,
      closeMinute: 20,
      drawHour: 17,
      drawMinute: 30
    })
  }),
  createLottery({
    code: 'hanoi_extra',
    leagueCode: 'foreign',
    name: 'ฮานอย Extra',
    shortName: 'HN Extra',
    description: 'ฮานอย Extra ใช้รางวัลพิเศษ 5 ตัวจาก xosoextra.com โดยแปลงเป็น 3 ตัวบน 2 ตัวบน และ 2 ตัวล่างตามกติกามาตรฐานของระบบ',
    provider: 'Xoso Extra Official',
    schedule: createDailySchedule({
      closeHour: 22,
      closeMinute: 10,
      drawHour: 22,
      drawMinute: 30
    }),
    supportedBetTypes: STANDARD_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'hanoi_star',
    leagueCode: 'foreign',
    name: 'ฮานอยสตาร์',
    shortName: 'HN Star',
    description: 'ฮานอยสตาร์ใช้ผล 5 ตัวจาก minhngocstar.com โดยแปลงเป็น 3 ตัวบน 2 ตัวบน และ 2 ตัวล่างตามกติกามาตรฐานของระบบ',
    provider: 'Minh Ngoc Star Official',
    schedule: createDailySchedule({
      closeHour: 12,
      closeMinute: 10,
      drawHour: 12,
      drawMinute: 30
    }),
    supportedBetTypes: STANDARD_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'hanoi_develop',
    leagueCode: 'foreign',
    name: 'ฮานอยพัฒนา',
    shortName: 'HN Dev',
    description: 'ฮานอยพัฒนาใช้ผล 5 ตัวจาก xosodevelop.com โดยแปลงเป็น 3 ตัวบน 2 ตัวบน และ 2 ตัวล่างตามกติกามาตรฐานของระบบ',
    provider: 'Xoso Develop Official',
    schedule: createDailySchedule({
      closeHour: 19,
      closeMinute: 10,
      drawHour: 19,
      drawMinute: 30
    }),
    supportedBetTypes: STANDARD_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'hanoi_hd',
    leagueCode: 'foreign',
    name: 'ฮานอย HD',
    shortName: 'HN HD',
    description: 'ฮานอย HD ใช้ผล 5 ตัวจาก xosohd.com โดยแปลงเป็น 3 ตัวบน 2 ตัวบน และ 2 ตัวล่างตามกติกามาตรฐานของระบบ',
    provider: 'Xoso HD Official',
    schedule: createDailySchedule({
      closeHour: 11,
      closeMinute: 10,
      drawHour: 11,
      drawMinute: 30
    }),
    supportedBetTypes: STANDARD_BET_TYPES,
    resultSource: 'api'
  }),
    createLottery({
      code: 'hanoi_tv',
      leagueCode: 'foreign',
      name: 'ฮานอย TV',
      shortName: 'HN TV',
    description: 'ฮานอย TV ใช้ผล 5 ตัวจาก minhngoctv.com โดยแปลงเป็น 3 ตัวบน 2 ตัวบน และ 2 ตัวล่างตามกติกามาตรฐานของระบบ',
    provider: 'Minh Ngoc TV Official',
    schedule: createDailySchedule({
      closeHour: 14,
      closeMinute: 5,
      drawHour: 14,
      drawMinute: 30
      }),
      supportedBetTypes: STANDARD_BET_TYPES,
      resultSource: 'api'
    }),
    createLottery({
      code: 'hanoi_redcross',
      leagueCode: 'foreign',
      name: 'ฮานอยกาชาด',
      shortName: 'HN RC',
      description: 'ฮานอยกาชาดใช้ผล 5 ตัวจาก xosoredcross.com โดยแปลงเป็น 3 ตัวบน 2 ตัวบน และ 2 ตัวล่างตามกติกามาตรฐานของระบบ',
      provider: 'Xoso Redcross Official',
      schedule: createDailySchedule({
        closeHour: 16,
        closeMinute: 0,
        drawHour: 16,
        drawMinute: 30
      }),
      supportedBetTypes: STANDARD_BET_TYPES,
      resultSource: 'api'
    }),
    createLottery({
      code: 'hanoi_union',
      leagueCode: 'foreign',
      name: 'ฮานอยสามัคคี',
      shortName: 'HN UN',
      description: 'ฮานอยสามัคคีใช้ผล 5 ตัวจาก xosounion.com โดยแปลงเป็น 3 ตัวบน 2 ตัวบน และ 2 ตัวล่างตามกติกามาตรฐานของระบบ',
      provider: 'Xoso Union Official',
      schedule: createDailySchedule({
        closeHour: 17,
        closeMinute: 10,
        drawHour: 17,
        drawMinute: 30
      }),
      supportedBetTypes: STANDARD_BET_TYPES,
      resultSource: 'api'
    }),
    createLottery({
      code: 'hanoi_asean',
      leagueCode: 'foreign',
      name: 'ฮานอยอาเซียน',
      shortName: 'HN AS',
      description: 'ฮานอยอาเซียนใช้ผล 5 ตัวจาก hanoiasean.com โดยแปลงเป็น 3 ตัวบน 2 ตัวบน และ 2 ตัวล่างตามกติกามาตรฐานของระบบ',
      provider: 'Hanoi ASEAN Official',
      schedule: createDailySchedule({
        closeHour: 9,
        closeMinute: 10,
        drawHour: 9,
        drawMinute: 30
      }),
      supportedBetTypes: STANDARD_BET_TYPES,
      resultSource: 'api'
    }),
    createLottery({
      code: 'tlzc',
      leagueCode: 'daily',
      name: 'หวยลาว',
    shortName: 'ลาว',
    description: 'หวยลาวรายวัน รองรับหวยชุดลาว 4 ตัว',
    provider: 'Huay Lao Official',
    schedule: createDailySchedule({
      closeHour: 20,
      closeMinute: 20,
      drawHour: 20,
      drawMinute: 30
    }),
    supportedBetTypes: LAO_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'lao_vip',
    leagueCode: 'daily',
    name: 'ลาว VIP',
    description: 'หวยลาว VIP รายวัน รองรับหวยชุดลาว 4 ตัว',
    provider: 'Lao VIP Official',
    schedule: createDailySchedule({
      closeHour: 21,
      closeMinute: 20,
      drawHour: 21,
      drawMinute: 30
    }),
    supportedBetTypes: LAO_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'lao_pathana',
    leagueCode: 'daily',
    name: 'à¸¥à¸²à¸§à¸žà¸±à¸’à¸™à¸²',
    shortName: 'à¸žà¸±à¸’à¸™à¸²',
    description: 'à¸«à¸§à¸¢à¸¥à¸²à¸§à¸žà¸±à¸’à¸™à¸² à¹ƒà¸Šà¹‰à¸à¸•à¸´à¸à¸²à¸•à¸¥à¸²à¸”à¸¡à¸²à¸•à¸£à¸à¸²à¸™à¸‚à¸­à¸‡à¸£à¸°à¸šà¸š à¹‚à¸”à¸¢à¸­à¸´à¸‡à¸œà¸¥ 3 à¸•à¸±à¸§à¸šà¸™ 2 à¸•à¸±à¸§à¸šà¸™ à¹à¸¥à¸° 2 à¸•à¸±à¸§à¸¥à¹ˆà¸²à¸‡à¸ˆà¸²à¸à¹€à¸§à¹‡à¸šà¸—à¸²à¸‡à¸à¸²à¸£',
    provider: 'Lao Pathana Official',
    schedule: createDailySchedule({
      closeHour: 20,
      closeMinute: 20,
      drawHour: 20,
      drawMinute: 20
    }),
    supportedBetTypes: STANDARD_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'lao_redcross',
    leagueCode: 'daily',
    name: '\u0e25\u0e32\u0e27\u0e01\u0e32\u0e0a\u0e32\u0e14',
    shortName: '\u0e01\u0e32\u0e0a\u0e32\u0e14',
    description: 'Lao Red Cross uses the standard project betting rules with 3 top, 2 top, and 2 bottom from the official API.',
    provider: 'Lao Red Cross Official',
    schedule: createDailySchedule({
      closeHour: 23,
      closeMinute: 25,
      drawHour: 23,
      drawMinute: 30
    }),
    supportedBetTypes: STANDARD_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'lao_tv',
    leagueCode: 'daily',
    name: '\u0e25\u0e32\u0e27 TV',
    shortName: 'TV',
    description: 'Lao TV uses the standard project betting rules with 3 top, 2 top, and 2 bottom from the official API.',
    provider: 'Lao TV Official',
    schedule: createDailySchedule({
      closeHour: 10,
      closeMinute: 25,
      drawHour: 10,
      drawMinute: 30
    }),
    supportedBetTypes: STANDARD_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'lao_hd',
    leagueCode: 'daily',
    name: '\u0e25\u0e32\u0e27 HD',
    shortName: 'HD',
    description: 'Lao HD uses the standard project betting rules with 3 top, 2 top, and 2 bottom from the official API.',
    provider: 'Lao HD Official',
    schedule: createDailySchedule({
      closeHour: 13,
      closeMinute: 40,
      drawHour: 13,
      drawMinute: 45
    }),
    supportedBetTypes: STANDARD_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'lao_extra',
    leagueCode: 'daily',
    name: '\u0e25\u0e32\u0e27 Extra',
    shortName: 'Extra',
    description: 'Lao Extra uses the standard project betting rules with 3 top, 2 top, and 2 bottom from the official API.',
    provider: 'Lao Extra Official',
    schedule: createDailySchedule({
      closeHour: 8,
      closeMinute: 25,
      drawHour: 8,
      drawMinute: 30
    }),
    supportedBetTypes: STANDARD_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'lao_star',
    leagueCode: 'daily',
    name: '\u0e25\u0e32\u0e27\u0e2a\u0e15\u0e32\u0e23\u0e4c',
    shortName: '\u0e2a\u0e15\u0e32\u0e23\u0e4c',
    description: 'Lao Stars uses the standard project betting rules with 3 top, 2 top, and 2 bottom from the official API.',
    provider: 'Lao Stars Official',
    schedule: createDailySchedule({
      closeHour: 15,
      closeMinute: 35,
      drawHour: 15,
      drawMinute: 45
    }),
    supportedBetTypes: STANDARD_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'lao_star_vip',
    leagueCode: 'daily',
    name: '\u0e25\u0e32\u0e27\u0e2a\u0e15\u0e32\u0e23\u0e4c VIP',
    shortName: 'STAR VIP',
    description: 'Lao Stars VIP uses the standard project betting rules with 3 top, 2 top, and 2 bottom from the official API.',
    provider: 'Lao Stars VIP Official',
    schedule: createDailySchedule({
      closeHour: 21,
      closeMinute: 50,
      drawHour: 22,
      drawMinute: 0
    }),
    supportedBetTypes: STANDARD_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'lao_union',
    leagueCode: 'daily',
    name: '\u0e25\u0e32\u0e27\u0e2a\u0e32\u0e21\u0e31\u0e04\u0e04\u0e35',
    shortName: '\u0e2a\u0e32\u0e21\u0e31\u0e04\u0e04\u0e35',
    description: 'Lao Union uses the standard project betting rules with 3 top, 2 top, and 2 bottom from the official API.',
    provider: 'Lao Union Official',
    schedule: createDailySchedule({
      closeHour: 20,
      closeMinute: 25,
      drawHour: 20,
      drawMinute: 30
    }),
    supportedBetTypes: STANDARD_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'lao_union_vip',
    leagueCode: 'daily',
    name: '\u0e25\u0e32\u0e27\u0e2a\u0e32\u0e21\u0e31\u0e04\u0e04\u0e35 VIP',
    shortName: '\u0e2a\u0e32\u0e21\u0e31\u0e04 VIP',
    description: 'Lao Union VIP uses the standard project betting rules with 3 top, 2 top, and 2 bottom from the official API.',
    provider: 'Lao Union VIP Official',
    schedule: createDailySchedule({
      closeHour: 21,
      closeMinute: 25,
      drawHour: 21,
      drawMinute: 30
    }),
    supportedBetTypes: STANDARD_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'lao_asean',
    leagueCode: 'daily',
    name: '\u0e25\u0e32\u0e27\u0e2d\u0e32\u0e40\u0e0b\u0e35\u0e22\u0e19',
    shortName: '\u0e2d\u0e32\u0e40\u0e0b\u0e35\u0e22\u0e19',
    description: 'Lao ASEAN uses the standard project betting rules with 3 top, 2 top, and 2 bottom from the official API.',
    provider: 'Lao ASEAN Official',
    schedule: createDailySchedule({
      closeHour: 20,
      closeMinute: 50,
      drawHour: 21,
      drawMinute: 0
    }),
    supportedBetTypes: STANDARD_BET_TYPES,
    resultSource: 'api'
  }),
  createLottery({
    code: 'ynhn',
    leagueCode: 'daily',
    name: 'ฮานอยธรรมดา',
    description: 'หวยฮานอยธรรมดารายวัน',
    schedule: createDailySchedule({
      closeHour: 19,
      closeMinute: 20,
      drawHour: 19,
      drawMinute: 30
    })
  }),
  createLottery({
    code: 'ynma',
    leagueCode: 'daily',
    name: 'มาเลย์',
    description: 'หวยมาเลย์รายวัน',
    schedule: createDailySchedule({
      closeHour: 19,
      closeMinute: 50,
      drawHour: 20,
      drawMinute: 0
    })
  }),
  createLottery({
    code: 'tykc',
    leagueCode: 'vip',
    name: 'จับยี่กี VIP',
    description: 'หวยจับยี่กี VIP รอบดึก',
    schedule: createDailySchedule({
      closeHour: 22,
      closeMinute: 50,
      drawHour: 23,
      drawMinute: 0
    })
  }),
  createLottery({
    code: 'nikkei_morning',
    leagueCode: 'stocks',
    name: 'นิเคอิเช้า',
    description: 'หวยหุ้นเช้าอิงผลนิเคอิ',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 9,
      closeMinute: 20,
      drawHour: 9,
      drawMinute: 35
    }),
    supportedBetTypes: STOCK_BET_TYPES
  }),
  createLottery({
    code: 'gshka',
    leagueCode: 'stocks',
    name: 'ฮั่งเส็งเช้า',
    description: 'หวยหุ้นฮั่งเส็งรอบเช้า',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 11,
      closeMinute: 45,
      drawHour: 12,
      drawMinute: 0
    }),
    supportedBetTypes: STOCK_BET_TYPES
  }),
  createLottery({
    code: 'gscna',
    leagueCode: 'stocks',
    name: 'หุ้นจีนเช้า',
    description: 'หวยหุ้นจีนรอบเช้า',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 11,
      closeMinute: 15,
      drawHour: 11,
      drawMinute: 30
    }),
    supportedBetTypes: STOCK_BET_TYPES
  }),
  createLottery({
    code: 'gstw',
    leagueCode: 'stocks',
    name: 'หุ้นไต้หวัน',
    description: 'หวยหุ้นไต้หวันรายวัน',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 13,
      closeMinute: 15,
      drawHour: 13,
      drawMinute: 30
    }),
    supportedBetTypes: STOCK_BET_TYPES
  }),
  createLottery({
    code: 'china_afternoon',
    leagueCode: 'stocks',
    name: 'จีนบ่าย',
    description: 'หวยหุ้นจีนภาคบ่าย',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 13,
      closeMinute: 20,
      drawHour: 13,
      drawMinute: 40
    }),
    supportedBetTypes: STOCK_BET_TYPES
  }),
  createLottery({
    code: 'gsjpp',
    leagueCode: 'stocks',
    name: 'นิเคอิบ่าย',
    description: 'หวยหุ้นนิเคอิรอบบ่าย',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 14,
      closeMinute: 15,
      drawHour: 14,
      drawMinute: 30
    }),
    supportedBetTypes: STOCK_BET_TYPES
  }),
  createLottery({
    code: 'gskr',
    leagueCode: 'stocks',
    name: 'หุ้นเกาหลี',
    description: 'หวยหุ้นเกาหลีรายวัน',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 14,
      closeMinute: 15,
      drawHour: 14,
      drawMinute: 30
    }),
    supportedBetTypes: STOCK_BET_TYPES
  }),
  createLottery({
    code: 'gshkp',
    leagueCode: 'stocks',
    name: 'ฮั่งเส็งบ่าย',
    description: 'หวยหุ้นฮั่งเส็งรอบบ่าย',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 15,
      closeMinute: 45,
      drawHour: 16,
      drawMinute: 0
    }),
    supportedBetTypes: STOCK_BET_TYPES
  }),
  createLottery({
    code: 'gssg',
    leagueCode: 'stocks',
    name: 'หุ้นสิงคโปร์',
    description: 'หวยหุ้นสิงคโปร์รายวัน',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 16,
      closeMinute: 45,
      drawHour: 17,
      drawMinute: 0
    }),
    supportedBetTypes: STOCK_BET_TYPES
  }),
  createLottery({
    code: 'gsth',
    leagueCode: 'stocks',
    name: 'หุ้นไทย',
    description: 'หวยหุ้นไทยรายวัน',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 18,
      closeMinute: 0,
      drawHour: 18,
      drawMinute: 15
    }),
    supportedBetTypes: STOCK_BET_TYPES
  }),
  createLottery({
    code: 'gsin',
    leagueCode: 'stocks',
    name: 'หุ้นอินเดีย',
    description: 'หวยหุ้นอินเดียรายวัน',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 17,
      closeMinute: 45,
      drawHour: 18,
      drawMinute: 0
    }),
    supportedBetTypes: STOCK_BET_TYPES
  }),
  createLottery({
    code: 'gseg',
    leagueCode: 'stocks',
    name: 'หุ้นอียิปต์',
    description: 'หวยหุ้นอียิปต์รายวัน',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 20,
      closeMinute: 15,
      drawHour: 20,
      drawMinute: 25
    }),
    supportedBetTypes: STOCK_BET_TYPES
  }),
  createLottery({
    code: 'dowjones_vip',
    leagueCode: 'vip',
    name: 'ดาวโจนส์ VIP',
    description: 'หวยดาวโจนส์ VIP รอบดึก',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 22,
      closeMinute: 45,
      drawHour: 23,
      drawMinute: 5
    })
  }),
  createLottery({
    code: 'gsru',
    leagueCode: 'stocks',
    name: 'หุ้นรัสเซีย',
    description: 'หวยหุ้นรัสเซียรอบดึก',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 23,
      closeMinute: 50,
      drawHour: 23,
      drawMinute: 59
    }),
    supportedBetTypes: STOCK_BET_TYPES
  }),
  createLottery({
    code: 'gsuk',
    leagueCode: 'stocks',
    name: 'หุ้นอังกฤษ',
    description: 'หวยหุ้นอังกฤษรอบดึก',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 0,
      closeMinute: 30,
      drawHour: 0,
      drawMinute: 45
    }),
    supportedBetTypes: STOCK_BET_TYPES
  }),
  createLottery({
    code: 'gsde',
    leagueCode: 'stocks',
    name: 'หุ้นเยอรมัน',
    description: 'หวยหุ้นเยอรมันรอบดึก',
    schedule: createDailySchedule({
      weekdays: WEEKDAYS,
      closeHour: 2,
      closeMinute: 45,
      drawHour: 3,
      drawMinute: 0
    }),
    supportedBetTypes: STOCK_BET_TYPES
  })
];

const NORMALIZED_LOTTERY_TYPES = LOTTERY_TYPES.map((lottery) => (
  lottery.code === 'lao_pathana'
    ? {
        ...lottery,
        name: '\u0e25\u0e32\u0e27\u0e1e\u0e31\u0e12\u0e19\u0e32',
        shortName: '\u0e1e\u0e31\u0e12\u0e19\u0e32',
        description: 'Lao Pathana uses the standard project betting rules with 3 top, 2 top, and 2 bottom derived from the official result.'
      }
    : lottery.code === 'lao_redcross'
      ? {
          ...lottery,
          name: '\u0e25\u0e32\u0e27\u0e01\u0e32\u0e0a\u0e32\u0e14',
          shortName: '\u0e01\u0e32\u0e0a\u0e32\u0e14',
          description: 'Lao Red Cross uses the standard project betting rules with 3 top, 2 top, and 2 bottom from the official API.'
        }
      : lottery.code === 'lao_tv'
        ? {
            ...lottery,
            name: '\u0e25\u0e32\u0e27 TV',
            shortName: 'TV',
            description: 'Lao TV uses the standard project betting rules with 3 top, 2 top, and 2 bottom from the official API.'
          }
        : lottery.code === 'lao_hd'
          ? {
              ...lottery,
              name: '\u0e25\u0e32\u0e27 HD',
              shortName: 'HD',
              description: 'Lao HD uses the standard project betting rules with 3 top, 2 top, and 2 bottom from the official API.'
            }
          : lottery.code === 'lao_extra'
            ? {
                ...lottery,
                name: '\u0e25\u0e32\u0e27 Extra',
                shortName: 'Extra',
                description: 'Lao Extra uses the standard project betting rules with 3 top, 2 top, and 2 bottom from the official API.'
              }
    : lottery
));

const DEFAULT_ANNOUNCEMENTS = [
  {
    code: 'phase1-launch',
    title: 'เปิดใช้งานลอตเตอรี่หลายตลาดแบบอ่านอย่างเดียว',
    body: 'ระบบเริ่มรองรับการเลือกตลาดหวยและงวดหลายประเภทเพื่อเตรียมต่อยอดหน้า member แบบใหม่ใน phase ถัดไป',
    audience: ['admin', 'agent', 'customer']
  }
];

module.exports = {
  DEFAULT_RATE_TIERS,
  LOTTERY_LEAGUES,
  LOTTERY_TYPES: NORMALIZED_LOTTERY_TYPES,
  DEFAULT_ANNOUNCEMENTS
};
