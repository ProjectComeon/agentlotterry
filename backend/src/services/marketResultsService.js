const axios = require('axios');
const LotteryResult = require('../models/LotteryResult');
const { MANYCAI_FEED_BASE_URL } = require('./externalResultFeedService');
const {
  GSB_MARKET_ID,
  GSB_MARKET_NAME,
  GSB_PROVIDER_NAME,
  fetchLatestGsbSnapshot
} = require('./gsbResultService');
const {
  THAI_GOV_MARKET_ID,
  THAI_GOV_MARKET_NAME,
  THAI_GOV_PROVIDER_NAME,
  fetchLatestThaiGovernmentSnapshot
} = require('./thaiGovernmentResultService');
const {
  BAAC_MARKET_ID,
  BAAC_MARKET_NAME,
  BAAC_PROVIDER_NAME,
  fetchLatestBaacSnapshot
} = require('./baacResultService');
const {
  LAOS_MARKET_NAME,
  LAOS_PROVIDER_NAME,
  fetchLatestLaosSnapshot
} = require('./laosResultService');
const {
  LAOS_VIP_MARKET_NAME,
  LAOS_VIP_PROVIDER_NAME,
  fetchLatestLaosVipSnapshot
} = require('./laosVipResultService');
const {
  LAOS_PATHANA_MARKET_ID,
  LAOS_PATHANA_MARKET_NAME,
  LAOS_PATHANA_PROVIDER_NAME,
  fetchLatestLaosPathanaSnapshot
} = require('./laosPathanaResultService');
const {
  LAOS_REDCROSS_MARKET_ID,
  LAOS_REDCROSS_MARKET_NAME,
  LAOS_REDCROSS_PROVIDER_NAME,
  fetchLatestLaosRedcrossSnapshot
} = require('./laosRedcrossResultService');
const {
  LAOS_TV_MARKET_ID,
  LAOS_TV_MARKET_NAME,
  LAOS_TV_PROVIDER_NAME,
  fetchLatestLaosTvSnapshot
} = require('./laosTvResultService');
const {
  LAOS_HD_MARKET_ID,
  LAOS_HD_MARKET_NAME,
  LAOS_HD_PROVIDER_NAME,
  fetchLatestLaosHdSnapshot
} = require('./laosHdResultService');
const {
  LAOS_EXTRA_MARKET_ID,
  LAOS_EXTRA_MARKET_NAME,
  LAOS_EXTRA_PROVIDER_NAME,
  fetchLatestLaosExtraSnapshot
} = require('./laosExtraResultService');
const {
  LAOS_STAR_MARKET_ID,
  LAOS_STAR_MARKET_NAME,
  LAOS_STAR_PROVIDER_NAME,
  fetchLatestLaosStarsSnapshot
} = require('./laosStarsResultService');
const {
  LAOS_STAR_VIP_MARKET_ID,
  LAOS_STAR_VIP_MARKET_NAME,
  LAOS_STAR_VIP_PROVIDER_NAME,
  fetchLatestLaosStarsVipSnapshot
} = require('./laosStarsVipResultService');
const {
  LAOS_UNION_MARKET_ID,
  LAOS_UNION_MARKET_NAME,
  LAOS_UNION_PROVIDER_NAME,
  fetchLatestLaosUnionSnapshot
} = require('./laosUnionResultService');
const {
  LAOS_UNION_VIP_MARKET_ID,
  LAOS_UNION_VIP_MARKET_NAME,
  LAOS_UNION_VIP_PROVIDER_NAME,
  fetchLatestLaosUnionVipSnapshot
} = require('./laosUnionVipResultService');
const {
  LAOS_ASEAN_MARKET_ID,
  LAOS_ASEAN_MARKET_NAME,
  LAOS_ASEAN_PROVIDER_NAME,
  fetchLatestLaosAseanSnapshot
} = require('./laosAseanResultService');
const {
  HANOI_EXTRA_MARKET_ID,
  HANOI_EXTRA_MARKET_NAME,
  HANOI_EXTRA_PROVIDER_NAME,
  fetchLatestHanoiExtraSnapshot
} = require('./hanoiExtraResultService');
const {
  HANOI_STAR_MARKET_ID,
  HANOI_STAR_MARKET_NAME,
  HANOI_STAR_PROVIDER_NAME,
  fetchLatestHanoiStarSnapshot
} = require('./hanoiStarResultService');
const {
  HANOI_DEVELOP_MARKET_ID,
  HANOI_DEVELOP_MARKET_NAME,
  HANOI_DEVELOP_PROVIDER_NAME,
  fetchLatestHanoiDevelopSnapshot
} = require('./hanoiDevelopResultService');
const {
  HANOI_HD_MARKET_ID,
  HANOI_HD_MARKET_NAME,
  HANOI_HD_PROVIDER_NAME,
  fetchLatestHanoiHdSnapshot
} = require('./hanoiHdResultService');
const {
  HANOI_TV_MARKET_ID,
  HANOI_TV_MARKET_NAME,
  HANOI_TV_PROVIDER_NAME,
  fetchLatestHanoiTvSnapshot
} = require('./hanoiTvResultService');
const {
  HANOI_REDCROSS_MARKET_ID,
  HANOI_REDCROSS_MARKET_NAME,
  HANOI_REDCROSS_PROVIDER_NAME,
  fetchLatestHanoiRedcrossSnapshot
} = require('./hanoiRedcrossResultService');
const {
  HANOI_UNION_MARKET_ID,
  HANOI_UNION_MARKET_NAME,
  HANOI_UNION_PROVIDER_NAME,
  fetchLatestHanoiUnionSnapshot
} = require('./hanoiUnionResultService');
const {
  HANOI_ASEAN_MARKET_ID,
  HANOI_ASEAN_MARKET_NAME,
  HANOI_ASEAN_PROVIDER_NAME,
  fetchLatestHanoiAseanSnapshot
} = require('./hanoiAseanResultService');

const PROVIDER_NAME = 'manycai';
const RAW_PROVIDER_KEY = String(process.env.MANYCAI_API_KEY || '').trim();
const PROVIDER_KEY = RAW_PROVIDER_KEY || '__feed_fallback__';
const PROVIDER_BASE_URL = (
  RAW_PROVIDER_KEY
    ? `${(process.env.MANYCAI_BASE_URL || 'http://vip.manycai.com').replace(/\/$/, '')}/${RAW_PROVIDER_KEY}`
    : MANYCAI_FEED_BASE_URL
).replace(/\/$/, '');
const CACHE_TTL_MS = Number(process.env.MARKET_RESULTS_CACHE_MS || 60000);
const LAOS_NOTE = 'ตรวจจับจาก Huay Lao Official และแปลงผลแบบลาว 4 ตัวของระบบ';
const LAOS_VIP_NOTE = 'ตรวจจับจาก Lao VIP Official และแปลงผลแบบลาว VIP ของระบบ';
const LAOS_NUMBER_LABELS = {
  threeTop: '3 ตัวบน',
  twoTop: '2 ตัวบน',
  twoBottom: '2 ตัวล่าง'
};
const LAOS_PATHANA_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01\u0e40\u0e27\u0e47\u0e1a\u0e44\u0e0b\u0e15\u0e4c Lao Pathana \u0e41\u0e25\u0e30\u0e41\u0e1b\u0e25\u0e07\u0e1c\u0e25\u0e41\u0e1a\u0e1a\u0e40\u0e14\u0e35\u0e22\u0e27\u0e01\u0e31\u0e1a GOGOLot';
const LAOS_PATHANA_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const LAOS_REDCROSS_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Lao Red Cross \u0e15\u0e23\u0e07 \u0e41\u0e25\u0e30\u0e43\u0e0a\u0e49\u0e1c\u0e25 \u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e01\u0e31\u0e1a \u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e1f\u0e34\u0e25\u0e14\u0e4c\u0e17\u0e32\u0e07\u0e01\u0e32\u0e23';
const LAOS_REDCROSS_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const LAOS_TV_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Lao TV \u0e15\u0e23\u0e07 \u0e41\u0e25\u0e30\u0e43\u0e0a\u0e49\u0e1c\u0e25 \u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e01\u0e31\u0e1a \u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e1f\u0e34\u0e25\u0e14\u0e4c\u0e17\u0e32\u0e07\u0e01\u0e32\u0e23';
const LAOS_TV_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const LAOS_HD_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Lao HD \u0e15\u0e23\u0e07 \u0e41\u0e25\u0e30\u0e43\u0e0a\u0e49\u0e1c\u0e25 \u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e01\u0e31\u0e1a \u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e1f\u0e34\u0e25\u0e14\u0e4c\u0e17\u0e32\u0e07\u0e01\u0e32\u0e23';
const LAOS_HD_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const LAOS_EXTRA_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Lao Extra \u0e15\u0e23\u0e07 \u0e41\u0e25\u0e30\u0e43\u0e0a\u0e49\u0e1c\u0e25 \u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e01\u0e31\u0e1a \u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e1f\u0e34\u0e25\u0e14\u0e4c\u0e17\u0e32\u0e07\u0e01\u0e32\u0e23';
const LAOS_EXTRA_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const LAOS_STAR_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Lao Stars \u0e15\u0e23\u0e07 \u0e41\u0e25\u0e30\u0e43\u0e0a\u0e49\u0e1c\u0e25 \u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e01\u0e31\u0e1a \u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e1f\u0e34\u0e25\u0e14\u0e4c\u0e17\u0e32\u0e07\u0e01\u0e32\u0e23';
const LAOS_STAR_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const LAOS_STAR_VIP_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Lao Stars VIP \u0e15\u0e23\u0e07 \u0e41\u0e25\u0e30\u0e43\u0e0a\u0e49\u0e1c\u0e25 \u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e01\u0e31\u0e1a \u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e1f\u0e34\u0e25\u0e14\u0e4c\u0e17\u0e32\u0e07\u0e01\u0e32\u0e23';
const LAOS_STAR_VIP_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const LAOS_UNION_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Lao Union \u0e15\u0e23\u0e07 \u0e41\u0e25\u0e30\u0e43\u0e0a\u0e49\u0e1c\u0e25 \u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e01\u0e31\u0e1a \u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e1f\u0e34\u0e25\u0e14\u0e4c\u0e17\u0e32\u0e07\u0e01\u0e32\u0e23';
const LAOS_UNION_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const LAOS_UNION_VIP_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Lao Union VIP \u0e15\u0e23\u0e07 \u0e41\u0e25\u0e30\u0e43\u0e0a\u0e49\u0e1c\u0e25 \u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e01\u0e31\u0e1a \u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e1f\u0e34\u0e25\u0e14\u0e4c\u0e17\u0e32\u0e07\u0e01\u0e32\u0e23';
const LAOS_UNION_VIP_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const LAOS_ASEAN_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Lao ASEAN \u0e15\u0e23\u0e07 \u0e41\u0e25\u0e30\u0e43\u0e0a\u0e49\u0e1c\u0e25 \u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e01\u0e31\u0e1a \u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e1f\u0e34\u0e25\u0e14\u0e4c\u0e17\u0e32\u0e07\u0e01\u0e32\u0e23';
const LAOS_ASEAN_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const HANOI_EXTRA_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Xoso Extra \u0e42\u0e14\u0e22\u0e43\u0e0a\u0e49\u0e23\u0e32\u0e07\u0e27\u0e31\u0e25\u0e1e\u0e34\u0e40\u0e28\u0e29 5 \u0e15\u0e31\u0e27\u0e40\u0e1b\u0e47\u0e19\u0e10\u0e32\u0e19\u0e43\u0e19\u0e01\u0e32\u0e23\u0e41\u0e1b\u0e25\u0e07 3 \u0e15\u0e31\u0e27\u0e1a\u0e19 2 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e41\u0e25\u0e30 2 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07';
const HANOI_EXTRA_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const HANOI_STAR_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Minh Ngoc Star \u0e42\u0e14\u0e22\u0e43\u0e0a\u0e49\u0e1c\u0e25 5 \u0e15\u0e31\u0e27\u0e08\u0e32\u0e01 prize 1 \u0e41\u0e25\u0e30 prize 2 \u0e21\u0e32\u0e41\u0e1b\u0e25\u0e07\u0e40\u0e1b\u0e47\u0e19 3 \u0e15\u0e31\u0e27\u0e1a\u0e19 2 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e41\u0e25\u0e30 2 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e01\u0e15\u0e34\u0e01\u0e32 Hanoi \u0e02\u0e2d\u0e07\u0e23\u0e30\u0e1a\u0e1a';
const HANOI_STAR_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const HANOI_DEVELOP_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Xoso Develop \u0e42\u0e14\u0e22\u0e43\u0e0a\u0e49\u0e1c\u0e25 5 \u0e15\u0e31\u0e27\u0e08\u0e32\u0e01 prize 1 \u0e41\u0e25\u0e30 prize 2 \u0e21\u0e32\u0e41\u0e1b\u0e25\u0e07\u0e40\u0e1b\u0e47\u0e19 3 \u0e15\u0e31\u0e27\u0e1a\u0e19 2 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e41\u0e25\u0e30 2 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e01\u0e15\u0e34\u0e01\u0e32 Hanoi \u0e02\u0e2d\u0e07\u0e23\u0e30\u0e1a\u0e1a';
const HANOI_DEVELOP_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const HANOI_HD_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Xoso HD \u0e42\u0e14\u0e22\u0e43\u0e0a\u0e49\u0e1c\u0e25 5 \u0e15\u0e31\u0e27\u0e08\u0e32\u0e01 prize 1 \u0e41\u0e25\u0e30 prize 2 \u0e21\u0e32\u0e41\u0e1b\u0e25\u0e07\u0e40\u0e1b\u0e47\u0e19 3 \u0e15\u0e31\u0e27\u0e1a\u0e19 2 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e41\u0e25\u0e30 2 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e01\u0e15\u0e34\u0e01\u0e32 Hanoi \u0e02\u0e2d\u0e07\u0e23\u0e30\u0e1a\u0e1a';
const HANOI_HD_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const HANOI_TV_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Minh Ngoc TV \u0e42\u0e14\u0e22\u0e43\u0e0a\u0e49\u0e1c\u0e25 5 \u0e15\u0e31\u0e27\u0e08\u0e32\u0e01 prize 1 \u0e41\u0e25\u0e30 prize 2 \u0e21\u0e32\u0e41\u0e1b\u0e25\u0e07\u0e40\u0e1b\u0e47\u0e19 3 \u0e15\u0e31\u0e27\u0e1a\u0e19 2 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e41\u0e25\u0e30 2 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e01\u0e15\u0e34\u0e01\u0e32 Hanoi \u0e02\u0e2d\u0e07\u0e23\u0e30\u0e1a\u0e1a';
const HANOI_TV_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const HANOI_REDCROSS_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Xoso Redcross \u0e42\u0e14\u0e22\u0e43\u0e0a\u0e49\u0e1c\u0e25 5 \u0e15\u0e31\u0e27\u0e08\u0e32\u0e01 prize 1 \u0e41\u0e25\u0e30 prize 2 \u0e21\u0e32\u0e41\u0e1b\u0e25\u0e07\u0e40\u0e1b\u0e47\u0e19 3 \u0e15\u0e31\u0e27\u0e1a\u0e19 2 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e41\u0e25\u0e30 2 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e01\u0e15\u0e34\u0e01\u0e32 Hanoi \u0e02\u0e2d\u0e07\u0e23\u0e30\u0e1a\u0e1a';
const HANOI_REDCROSS_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const HANOI_UNION_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Xoso Union \u0e42\u0e14\u0e22\u0e43\u0e0a\u0e49\u0e1c\u0e25 5 \u0e15\u0e31\u0e27\u0e08\u0e32\u0e01 prize 1 \u0e41\u0e25\u0e30 prize 2 \u0e21\u0e32\u0e41\u0e1b\u0e25\u0e07\u0e40\u0e1b\u0e47\u0e19 3 \u0e15\u0e31\u0e27\u0e1a\u0e19 2 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e41\u0e25\u0e30 2 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e01\u0e15\u0e34\u0e01\u0e32 Hanoi \u0e02\u0e2d\u0e07\u0e23\u0e30\u0e1a\u0e1a';
const HANOI_UNION_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};
const HANOI_ASEAN_NOTE = '\u0e15\u0e23\u0e27\u0e08\u0e08\u0e31\u0e1a\u0e08\u0e32\u0e01 API Hanoi ASEAN \u0e42\u0e14\u0e22\u0e43\u0e0a\u0e49\u0e1c\u0e25 5 \u0e15\u0e31\u0e27\u0e08\u0e32\u0e01 prize 1 \u0e41\u0e25\u0e30 prize 2 \u0e21\u0e32\u0e41\u0e1b\u0e25\u0e07\u0e40\u0e1b\u0e47\u0e19 3 \u0e15\u0e31\u0e27\u0e1a\u0e19 2 \u0e15\u0e31\u0e27\u0e1a\u0e19 \u0e41\u0e25\u0e30 2 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07 \u0e15\u0e32\u0e21\u0e01\u0e15\u0e34\u0e01\u0e32 Hanoi \u0e02\u0e2d\u0e07\u0e23\u0e30\u0e1a\u0e1a';
const HANOI_ASEAN_NUMBER_LABELS = {
  threeTop: '\u0033 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoTop: '\u0032 \u0e15\u0e31\u0e27\u0e1a\u0e19',
  twoBottom: '\u0032 \u0e15\u0e31\u0e27\u0e25\u0e48\u0e32\u0e07'
};

const cache = {
  data: null,
  fetchedAt: 0
};

const MANYCAI_MARKETS = [
  { code: 'hnvip', marketId: 'hanoi-vip', name: 'ฮานอย VIP', sectionId: 'international', type: 'standard' },
  { code: 'bfhn', marketId: 'hanoi-special', name: 'ฮานอยพิเศษ', sectionId: 'international', type: 'standard' },
  { code: 'cqhn', marketId: 'hanoi-specific', name: 'ฮานอยเฉพาะกิจ', sectionId: 'international', type: 'standard' },
  { code: 'tlzc', marketId: 'lao', name: 'หวยลาว', sectionId: 'international', type: 'standard' },
  { code: 'zcvip', marketId: 'lao-vip', name: 'หวยลาว VIP', sectionId: 'international', type: 'standard' },
  { code: 'ynhn', marketId: 'hanoi-normal', name: 'ฮานอยธรรมดา', sectionId: 'international', type: 'standard' },
  { code: 'ynma', marketId: 'malay', name: 'มาเลย์', sectionId: 'international', type: 'standard' },
  { code: 'tykc', marketId: 'yeekee-vip', name: 'จับยี่กี VIP', sectionId: 'international', type: 'standard' },
  { code: 'gsth', marketId: 'stock-thai', name: 'หุ้นไทย', sectionId: 'stocks', type: 'stock' },
  { code: 'gshka', marketId: 'stock-hangseng-morning', name: 'ฮั่งเส็งเช้า', sectionId: 'stocks', type: 'stock' },
  { code: 'gshkp', marketId: 'stock-hangseng-afternoon', name: 'ฮั่งเส็งบ่าย', sectionId: 'stocks', type: 'stock' },
  { code: 'gstw', marketId: 'stock-taiwan', name: 'หุ้นไต้หวัน', sectionId: 'stocks', type: 'stock' },
  { code: 'gsjpa', marketId: 'stock-nikkei-morning', name: 'นิเคอิเช้า', sectionId: 'stocks', type: 'stock' },
  { code: 'gsjpp', marketId: 'stock-nikkei-afternoon', name: 'นิเคอิบ่าย', sectionId: 'stocks', type: 'stock' },
  { code: 'gskr', marketId: 'stock-korea', name: 'หุ้นเกาหลี', sectionId: 'stocks', type: 'stock' },
  { code: 'gscna', marketId: 'stock-china-morning', name: 'หุ้นจีนเช้า', sectionId: 'stocks', type: 'stock' },
  { code: 'gscnp', marketId: 'stock-china-afternoon', name: 'หุ้นจีนบ่าย', sectionId: 'stocks', type: 'stock' },
  { code: 'gssg', marketId: 'stock-singapore', name: 'หุ้นสิงคโปร์', sectionId: 'stocks', type: 'stock' },
  { code: 'gsin', marketId: 'stock-india', name: 'หุ้นอินเดีย', sectionId: 'stocks', type: 'stock' },
  { code: 'gseg', marketId: 'stock-egypt', name: 'หุ้นอียิปต์', sectionId: 'stocks', type: 'stock' },
  { code: 'gsru', marketId: 'stock-russia', name: 'หุ้นรัสเซีย', sectionId: 'stocks', type: 'stock' },
  { code: 'gsde', marketId: 'stock-germany', name: 'หุ้นเยอรมัน', sectionId: 'stocks', type: 'stock' },
  { code: 'gsuk', marketId: 'stock-england', name: 'หุ้นอังกฤษ', sectionId: 'stocks', type: 'stock' },
  { code: 'gsus', marketId: 'stock-dowjones', name: 'หุ้นดาวโจนส์', sectionId: 'stocks', type: 'stock' }
];

const ACTIVE_MANYCAI_MARKETS = MANYCAI_MARKETS.filter(
  (market) => !['tlzc', 'zcvip'].includes(market.code)
);

const baseSections = [
  {
    id: 'government',
    title: 'รัฐบาล',
    description: 'หวยรัฐบาลและสลากออมทรัพย์',
    markets: [
      { id: THAI_GOV_MARKET_ID, name: THAI_GOV_MARKET_NAME, provider: THAI_GOV_PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจาก GLO Official' },
      { id: BAAC_MARKET_ID, name: BAAC_MARKET_NAME, provider: BAAC_PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจาก BAAC Official' },
      { id: GSB_MARKET_ID, name: GSB_MARKET_NAME, provider: GSB_PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากเว็บไซต์ GSB' }
    ]
  },
  {
    id: 'international',
    title: 'หวยต่างประเทศ',
    description: 'ข้อมูลจาก ManyCai',
    markets: [
      { id: 'hanoi-vip', name: 'ฮานอย VIP', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'hanoi-special', name: 'ฮานอยพิเศษ', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'hanoi-specific', name: 'ฮานอยเฉพาะกิจ', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'lao', name: 'หวยลาว', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'lao-vip', name: 'หวยลาว VIP', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'hanoi-normal', name: 'ฮานอยธรรมดา', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'malay', name: 'มาเลย์', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'yeekee-vip', name: 'จับยี่กี VIP', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' }
    ]
  },
  {
    id: 'stocks',
    title: 'หุ้น',
    description: 'ข้อมูลหุ้นจาก ManyCai',
    markets: [
      { id: 'stock-thai', name: 'หุ้นไทย', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-hangseng-morning', name: 'ฮั่งเส็งเช้า', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-hangseng-afternoon', name: 'ฮั่งเส็งบ่าย', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-taiwan', name: 'หุ้นไต้หวัน', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-nikkei-morning', name: 'นิเคอิเช้า', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-nikkei-afternoon', name: 'นิเคอิบ่าย', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-korea', name: 'หุ้นเกาหลี', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-china-morning', name: 'หุ้นจีนเช้า', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-china-afternoon', name: 'หุ้นจีนบ่าย', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-singapore', name: 'หุ้นสิงคโปร์', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-india', name: 'หุ้นอินเดีย', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-egypt', name: 'หุ้นอียิปต์', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-russia', name: 'หุ้นรัสเซีย', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-germany', name: 'หุ้นเยอรมัน', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-england', name: 'หุ้นอังกฤษ', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' },
      { id: 'stock-dowjones', name: 'หุ้นดาวโจนส์', provider: PROVIDER_NAME, status: 'waiting', resultDate: '', headline: '', numbers: [], note: 'รอข้อมูลจากผู้ให้บริการ' }
    ]
  }
];

baseSections.find((section) => section.id === 'international')?.markets.splice(5, 0, {
  id: 'hanoi-extra',
  name: HANOI_EXTRA_MARKET_NAME,
  provider: HANOI_EXTRA_PROVIDER_NAME,
  status: 'waiting',
  resultDate: '',
  headline: '',
  numbers: [],
  note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Xoso Extra'
});

baseSections.find((section) => section.id === 'international')?.markets.splice(6, 0, {
  id: 'hanoi-star',
  name: HANOI_STAR_MARKET_NAME,
  provider: HANOI_STAR_PROVIDER_NAME,
  status: 'waiting',
  resultDate: '',
  headline: '',
  numbers: [],
  note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Minh Ngoc Star'
});

baseSections.find((section) => section.id === 'international')?.markets.splice(7, 0, {
  id: 'hanoi-develop',
  name: HANOI_DEVELOP_MARKET_NAME,
  provider: HANOI_DEVELOP_PROVIDER_NAME,
  status: 'waiting',
  resultDate: '',
  headline: '',
  numbers: [],
  note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Xoso Develop'
});

baseSections.find((section) => section.id === 'international')?.markets.splice(8, 0, {
  id: 'hanoi-hd',
  name: HANOI_HD_MARKET_NAME,
  provider: HANOI_HD_PROVIDER_NAME,
  status: 'waiting',
  resultDate: '',
  headline: '',
  numbers: [],
  note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Xoso HD'
});

baseSections.find((section) => section.id === 'international')?.markets.splice(9, 0, {
  id: 'hanoi-tv',
  name: HANOI_TV_MARKET_NAME,
  provider: HANOI_TV_PROVIDER_NAME,
  status: 'waiting',
  resultDate: '',
  headline: '',
  numbers: [],
  note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Minh Ngoc TV'
});

baseSections.find((section) => section.id === 'international')?.markets.splice(10, 0, {
  id: 'hanoi-redcross',
  name: HANOI_REDCROSS_MARKET_NAME,
  provider: HANOI_REDCROSS_PROVIDER_NAME,
  status: 'waiting',
  resultDate: '',
  headline: '',
  numbers: [],
  note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Xoso Redcross'
});

baseSections.find((section) => section.id === 'international')?.markets.splice(11, 0, {
  id: 'hanoi-union',
  name: HANOI_UNION_MARKET_NAME,
  provider: HANOI_UNION_PROVIDER_NAME,
  status: 'waiting',
  resultDate: '',
  headline: '',
  numbers: [],
  note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Xoso Union'
});

baseSections.find((section) => section.id === 'international')?.markets.splice(12, 0, {
  id: 'hanoi-asean',
  name: HANOI_ASEAN_MARKET_NAME,
  provider: HANOI_ASEAN_PROVIDER_NAME,
  status: 'waiting',
  resultDate: '',
  headline: '',
  numbers: [],
  note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Hanoi ASEAN'
});

baseSections.find((section) => section.id === 'international')?.markets.splice(6, 0, {
  id: 'lao-pathana',
  name: LAOS_PATHANA_MARKET_NAME,
  provider: LAOS_PATHANA_PROVIDER_NAME,
  status: 'waiting',
  resultDate: '',
  headline: '',
  numbers: [],
  note: 'รอข้อมูลจากเว็บไซต์ Lao Pathana'
});

{
  const internationalSection = baseSections.find((section) => section.id === 'international');
  const insertAt = Math.max(0, (internationalSection?.markets || []).findIndex((market) => market.id === 'lao-pathana') + 1);
  internationalSection?.markets.splice(insertAt, 0, {
    id: 'lao-redcross',
    name: LAOS_REDCROSS_MARKET_NAME,
    provider: LAOS_REDCROSS_PROVIDER_NAME,
    status: 'waiting',
    resultDate: '',
    headline: '',
    numbers: [],
    note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Lao Red Cross'
  });
}

{
  const internationalSection = baseSections.find((section) => section.id === 'international');
  const insertAt = Math.max(0, (internationalSection?.markets || []).findIndex((market) => market.id === 'lao-redcross') + 1);
  internationalSection?.markets.splice(insertAt, 0, {
    id: 'lao-tv',
    name: LAOS_TV_MARKET_NAME,
    provider: LAOS_TV_PROVIDER_NAME,
    status: 'waiting',
    resultDate: '',
    headline: '',
    numbers: [],
    note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Lao TV'
  });
}

{
  const internationalSection = baseSections.find((section) => section.id === 'international');
  const insertAt = Math.max(0, (internationalSection?.markets || []).findIndex((market) => market.id === 'lao-tv') + 1);
  internationalSection?.markets.splice(insertAt, 0, {
    id: 'lao-hd',
    name: LAOS_HD_MARKET_NAME,
    provider: LAOS_HD_PROVIDER_NAME,
    status: 'waiting',
    resultDate: '',
    headline: '',
    numbers: [],
    note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Lao HD'
  });
}

{
  const internationalSection = baseSections.find((section) => section.id === 'international');
  const insertAt = Math.max(0, (internationalSection?.markets || []).findIndex((market) => market.id === 'lao-hd') + 1);
  internationalSection?.markets.splice(insertAt, 0, {
    id: 'lao-extra',
    name: LAOS_EXTRA_MARKET_NAME,
    provider: LAOS_EXTRA_PROVIDER_NAME,
    status: 'waiting',
    resultDate: '',
    headline: '',
    numbers: [],
    note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Lao Extra'
  });
}

{
  const internationalSection = baseSections.find((section) => section.id === 'international');
  const insertAt = Math.max(0, (internationalSection?.markets || []).findIndex((market) => market.id === 'lao-extra') + 1);
  internationalSection?.markets.splice(insertAt, 0, {
    id: 'lao-star',
    name: LAOS_STAR_MARKET_NAME,
    provider: LAOS_STAR_PROVIDER_NAME,
    status: 'waiting',
    resultDate: '',
    headline: '',
    numbers: [],
    note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Lao Stars'
  });
}

{
  const internationalSection = baseSections.find((section) => section.id === 'international');
  const insertAt = Math.max(0, (internationalSection?.markets || []).findIndex((market) => market.id === 'lao-star') + 1);
  internationalSection?.markets.splice(insertAt, 0, {
    id: 'lao-star-vip',
    name: LAOS_STAR_VIP_MARKET_NAME,
    provider: LAOS_STAR_VIP_PROVIDER_NAME,
    status: 'waiting',
    resultDate: '',
    headline: '',
    numbers: [],
    note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Lao Stars VIP'
  });
}

{
  const internationalSection = baseSections.find((section) => section.id === 'international');
  const insertAt = Math.max(0, (internationalSection?.markets || []).findIndex((market) => market.id === 'lao-star-vip') + 1);
  internationalSection?.markets.splice(insertAt, 0, {
    id: 'lao-union',
    name: LAOS_UNION_MARKET_NAME,
    provider: LAOS_UNION_PROVIDER_NAME,
    status: 'waiting',
    resultDate: '',
    headline: '',
    numbers: [],
    note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Lao Union'
  });
}

{
  const internationalSection = baseSections.find((section) => section.id === 'international');
  const insertAt = Math.max(0, (internationalSection?.markets || []).findIndex((market) => market.id === 'lao-union') + 1);
  internationalSection?.markets.splice(insertAt, 0, {
    id: 'lao-union-vip',
    name: LAOS_UNION_VIP_MARKET_NAME,
    provider: LAOS_UNION_VIP_PROVIDER_NAME,
    status: 'waiting',
    resultDate: '',
    headline: '',
    numbers: [],
    note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Lao Union VIP'
  });
}

{
  const internationalSection = baseSections.find((section) => section.id === 'international');
  const insertAt = Math.max(0, (internationalSection?.markets || []).findIndex((market) => market.id === 'lao-union-vip') + 1);
  internationalSection?.markets.splice(insertAt, 0, {
    id: 'lao-asean',
    name: LAOS_ASEAN_MARKET_NAME,
    provider: LAOS_ASEAN_PROVIDER_NAME,
    status: 'waiting',
    resultDate: '',
    headline: '',
    numbers: [],
    note: '\u0e23\u0e2d\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e32\u0e01 API Lao ASEAN'
  });
}

{
  const internationalSection = baseSections.find((section) => section.id === 'international');
  const laoMarket = internationalSection?.markets.find((market) => market.id === 'lao');
  if (laoMarket) {
    laoMarket.provider = LAOS_PROVIDER_NAME;
    laoMarket.note = 'รอข้อมูลจาก Huay Lao Official';
  }

  const laoVipMarket = internationalSection?.markets.find((market) => market.id === 'lao-vip');
  if (laoVipMarket) {
    laoVipMarket.provider = LAOS_VIP_PROVIDER_NAME;
    laoVipMarket.note = 'รอข้อมูลจาก Lao VIP Official';
  }
}

const cloneSections = () => baseSections.map((section) => ({
  ...section,
  markets: section.markets.map((market) => ({
    ...market,
    numbers: [...market.numbers]
  }))
}));

const stringValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).join(' / ');
  return '';
};

const isMasked = (value) => /x/i.test(stringValue(value));
const hasValue = (value) => {
  const normalized = stringValue(value);
  return normalized && !isMasked(normalized);
};

const setMarketData = (sections, sectionId, nextMarket) => {
  const section = sections.find((entry) => entry.id === sectionId);
  if (!section) return;

  const marketIndex = section.markets.findIndex((market) => market.id === nextMarket.id);

  if (marketIndex >= 0) {
    section.markets[marketIndex] = {
      ...section.markets[marketIndex],
      ...nextMarket,
      numbers: nextMarket.numbers || section.markets[marketIndex].numbers || []
    };
    return;
  }

  section.markets.push(nextMarket);
};

const compactDigits = (value) => stringValue(value).replace(/[^0-9xX]/g, '');
const tailDigits = (value, length) => {
  const digits = compactDigits(value);
  if (!digits) return '';
  return digits.slice(-length);
};
const twoDigitScalar = (value) => {
  const digits = compactDigits(value);
  return digits.length === 2 ? digits : '';
};
const middleDigits = (value, length) => {
  const digits = compactDigits(value);
  if (!digits) return '';
  if (digits.length <= length) return digits;
  const start = Math.floor((digits.length - length) / 2);
  return digits.slice(start, start + length);
};
const mergeUniqueValues = (...values) => [...new Set(values.flat().filter(Boolean))];

const formatIssueDate = (issue, openDate) => {
  const normalizedIssue = stringValue(issue).replace(/\D/g, '');
  if (normalizedIssue.length === 8) {
    return `${normalizedIssue.slice(0, 4)}-${normalizedIssue.slice(4, 6)}-${normalizedIssue.slice(6, 8)}`;
  }

  const normalizedOpenDate = stringValue(openDate);
  return normalizedOpenDate ? normalizedOpenDate.slice(0, 10) : '';
};

const fetchProvider = async (code) => {
  const response = await axios.get(`${PROVIDER_BASE_URL}/${code}.json`, {
    timeout: 12000
  });

  return response.data;
};

const fetchGsbLatestMarket = async () => {
  const snapshot = await fetchLatestGsbSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: GSB_MARKET_ID,
    name: GSB_MARKET_NAME,
    provider: GSB_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.headline,
    numbers: [
      { label: '3 ตัวบน', value: snapshot.threeTop },
      { label: '2 ตัวบน', value: snapshot.twoTop },
      { label: '2 ตัวล่าง', value: snapshot.twoBottom }
    ],
    note: 'ตรวจจับจากเว็บไซต์ GSB และแปลงผลแบบเดียวกับ GOGOLot',
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestThaiGovernmentMarket = async () => {
  const snapshot = await fetchLatestThaiGovernmentSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: THAI_GOV_MARKET_ID,
    name: THAI_GOV_MARKET_NAME,
    provider: THAI_GOV_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.firstPrize,
    numbers: [
      { label: '3 ตัวบน', value: snapshot.threeTop },
      { label: '2 ตัวบน', value: snapshot.twoTop },
      { label: '3 ตัวหน้า', value: mergeUniqueValues(snapshot.threeFrontHits || []).join(' / ') },
      { label: '3 ตัวล่าง', value: mergeUniqueValues(snapshot.threeBottomHits || []).join(' / ') },
      { label: '2 ตัวล่าง', value: snapshot.twoBottom }
    ],
    note: 'ตรวจจับจาก GLO Official และใช้ผลรางวัลตามประกาศทางการ',
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestBaacMarket = async () => {
  const snapshot = await fetchLatestBaacSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: BAAC_MARKET_ID,
    name: BAAC_MARKET_NAME,
    provider: BAAC_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.firstPrize,
    numbers: [
      { label: '3 ตัวบน', value: snapshot.threeTop },
      { label: '2 ตัวบน', value: snapshot.twoTop },
      { label: '2 ตัวล่าง', value: snapshot.twoBottom }
    ],
    note: 'ตรวจจับจากผลสลากออมทรัพย์ ธ.ก.ส. ทางการ',
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestLaosMarket = async () => {
  const snapshot = await fetchLatestLaosSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'lao',
    name: LAOS_MARKET_NAME,
    provider: LAOS_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: LAOS_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: LAOS_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: LAOS_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: LAOS_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestLaosVipMarket = async () => {
  const snapshot = await fetchLatestLaosVipSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'lao-vip',
    name: LAOS_VIP_MARKET_NAME,
    provider: LAOS_VIP_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: LAOS_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: LAOS_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: LAOS_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: LAOS_VIP_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestLaosPathanaMarket = async () => {
  const snapshot = await fetchLatestLaosPathanaSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'lao-pathana',
    name: LAOS_PATHANA_MARKET_NAME,
    provider: LAOS_PATHANA_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: '3 à¸•à¸±à¸§à¸šà¸™', value: snapshot.threeTop },
      { label: '2 à¸•à¸±à¸§à¸šà¸™', value: snapshot.twoTop },
      { label: '2 à¸•à¸±à¸§à¸¥à¹ˆà¸²à¸‡', value: snapshot.twoBottom }
    ],
    note: 'à¸•à¸£à¸§à¸ˆà¸ˆà¸±à¸šà¸ˆà¸²à¸à¹€à¸§à¹‡à¸šà¹„à¸‹à¸•à¹Œ Lao Pathana à¹à¸¥à¸°à¹à¸›à¸¥à¸‡à¸œà¸¥à¹à¸šà¸šà¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸š GOGOLot',
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestLaosPathanaMarketNormalized = async () => {
  const snapshot = await fetchLatestLaosPathanaSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'lao-pathana',
    name: LAOS_PATHANA_MARKET_NAME,
    provider: LAOS_PATHANA_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: LAOS_PATHANA_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: LAOS_PATHANA_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: LAOS_PATHANA_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: LAOS_PATHANA_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestLaosRedcrossMarket = async () => {
  const snapshot = await fetchLatestLaosRedcrossSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'lao-redcross',
    name: LAOS_REDCROSS_MARKET_NAME,
    provider: LAOS_REDCROSS_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: LAOS_REDCROSS_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: LAOS_REDCROSS_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: LAOS_REDCROSS_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: LAOS_REDCROSS_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestLaosTvMarket = async () => {
  const snapshot = await fetchLatestLaosTvSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'lao-tv',
    name: LAOS_TV_MARKET_NAME,
    provider: LAOS_TV_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: LAOS_TV_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: LAOS_TV_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: LAOS_TV_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: LAOS_TV_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestLaosHdMarket = async () => {
  const snapshot = await fetchLatestLaosHdSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'lao-hd',
    name: LAOS_HD_MARKET_NAME,
    provider: LAOS_HD_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: LAOS_HD_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: LAOS_HD_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: LAOS_HD_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: LAOS_HD_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestLaosExtraMarket = async () => {
  const snapshot = await fetchLatestLaosExtraSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'lao-extra',
    name: LAOS_EXTRA_MARKET_NAME,
    provider: LAOS_EXTRA_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: LAOS_EXTRA_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: LAOS_EXTRA_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: LAOS_EXTRA_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: LAOS_EXTRA_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestLaosStarsMarket = async () => {
  const snapshot = await fetchLatestLaosStarsSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'lao-star',
    name: LAOS_STAR_MARKET_NAME,
    provider: LAOS_STAR_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: LAOS_STAR_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: LAOS_STAR_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: LAOS_STAR_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: LAOS_STAR_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestLaosStarsVipMarket = async () => {
  const snapshot = await fetchLatestLaosStarsVipSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'lao-star-vip',
    name: LAOS_STAR_VIP_MARKET_NAME,
    provider: LAOS_STAR_VIP_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: LAOS_STAR_VIP_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: LAOS_STAR_VIP_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: LAOS_STAR_VIP_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: LAOS_STAR_VIP_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestLaosUnionMarket = async () => {
  const snapshot = await fetchLatestLaosUnionSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'lao-union',
    name: LAOS_UNION_MARKET_NAME,
    provider: LAOS_UNION_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: LAOS_UNION_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: LAOS_UNION_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: LAOS_UNION_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: LAOS_UNION_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestLaosUnionVipMarket = async () => {
  const snapshot = await fetchLatestLaosUnionVipSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'lao-union-vip',
    name: LAOS_UNION_VIP_MARKET_NAME,
    provider: LAOS_UNION_VIP_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: LAOS_UNION_VIP_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: LAOS_UNION_VIP_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: LAOS_UNION_VIP_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: LAOS_UNION_VIP_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestLaosAseanMarket = async () => {
  const snapshot = await fetchLatestLaosAseanSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'lao-asean',
    name: LAOS_ASEAN_MARKET_NAME,
    provider: LAOS_ASEAN_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: LAOS_ASEAN_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: LAOS_ASEAN_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: LAOS_ASEAN_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: LAOS_ASEAN_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestHanoiExtraMarket = async () => {
  const snapshot = await fetchLatestHanoiExtraSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'hanoi-extra',
    name: HANOI_EXTRA_MARKET_NAME,
    provider: HANOI_EXTRA_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: HANOI_EXTRA_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: HANOI_EXTRA_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: HANOI_EXTRA_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: HANOI_EXTRA_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestHanoiStarMarket = async () => {
  const snapshot = await fetchLatestHanoiStarSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'hanoi-star',
    name: HANOI_STAR_MARKET_NAME,
    provider: HANOI_STAR_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: HANOI_STAR_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: HANOI_STAR_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: HANOI_STAR_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: HANOI_STAR_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestHanoiDevelopMarket = async () => {
  const snapshot = await fetchLatestHanoiDevelopSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'hanoi-develop',
    name: HANOI_DEVELOP_MARKET_NAME,
    provider: HANOI_DEVELOP_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: HANOI_DEVELOP_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: HANOI_DEVELOP_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: HANOI_DEVELOP_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: HANOI_DEVELOP_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestHanoiHdMarket = async () => {
  const snapshot = await fetchLatestHanoiHdSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'hanoi-hd',
    name: HANOI_HD_MARKET_NAME,
    provider: HANOI_HD_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: HANOI_HD_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: HANOI_HD_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: HANOI_HD_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: HANOI_HD_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestHanoiTvMarket = async () => {
  const snapshot = await fetchLatestHanoiTvSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'hanoi-tv',
    name: HANOI_TV_MARKET_NAME,
    provider: HANOI_TV_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: HANOI_TV_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: HANOI_TV_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: HANOI_TV_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: HANOI_TV_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestHanoiRedcrossMarket = async () => {
  const snapshot = await fetchLatestHanoiRedcrossSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'hanoi-redcross',
    name: HANOI_REDCROSS_MARKET_NAME,
    provider: HANOI_REDCROSS_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: HANOI_REDCROSS_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: HANOI_REDCROSS_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: HANOI_REDCROSS_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: HANOI_REDCROSS_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestHanoiUnionMarket = async () => {
  const snapshot = await fetchLatestHanoiUnionSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'hanoi-union',
    name: HANOI_UNION_MARKET_NAME,
    provider: HANOI_UNION_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: HANOI_UNION_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: HANOI_UNION_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: HANOI_UNION_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: HANOI_UNION_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const fetchLatestHanoiAseanMarket = async () => {
  const snapshot = await fetchLatestHanoiAseanSnapshot();
  if (!snapshot) {
    return null;
  }

  return buildMarket({
    id: 'hanoi-asean',
    name: HANOI_ASEAN_MARKET_NAME,
    provider: HANOI_ASEAN_PROVIDER_NAME,
    resultDate: snapshot.roundCode,
    headline: snapshot.threeTop,
    numbers: [
      { label: HANOI_ASEAN_NUMBER_LABELS.threeTop, value: snapshot.threeTop },
      { label: HANOI_ASEAN_NUMBER_LABELS.twoTop, value: snapshot.twoTop },
      { label: HANOI_ASEAN_NUMBER_LABELS.twoBottom, value: snapshot.twoBottom }
    ],
    note: HANOI_ASEAN_NOTE,
    sourceUrl: snapshot.sourceUrl
  });
};

const extractManyCaiRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const getLatestManyCaiRow = (payload) => extractManyCaiRows(payload)[0] || null;

const marketStatus = (headline, numbers) => {
  const values = [headline, ...(numbers || []).map((item) => item.value)].filter(Boolean);
  if (values.some((value) => hasValue(value))) return 'live';
  if (values.some((value) => isMasked(value))) return 'pending';
  return 'waiting';
};

const buildNumbers = (pairs) => pairs
  .filter((pair) => pair && stringValue(pair.value))
  .map((pair) => ({ label: pair.label, value: stringValue(pair.value) }));

const buildMarket = ({ id, name, provider, resultDate, headline, numbers, note, sourceUrl }) => ({
  id,
  name,
  provider,
  resultDate: stringValue(resultDate),
  headline: stringValue(headline),
  numbers: buildNumbers(numbers),
  note: stringValue(note),
  sourceUrl: stringValue(sourceUrl),
  status: marketStatus(headline, numbers)
});

const applyGovernmentFromLocal = async (sections) => {
  const latest = await LotteryResult.findOne().sort({ roundDate: -1 });
  if (!latest) return false;

  setMarketData(sections, 'government', buildMarket({
    id: 'thai-government',
    name: 'รัฐบาลไทย',
    provider: 'internal',
    resultDate: latest.roundDate,
    headline: latest.firstPrize,
    numbers: [
      { label: '3 ตัวบน', value: tailDigits(latest.firstPrize, 3) },
      { label: '2 ตัวบน', value: tailDigits(latest.firstPrize, 2) },
      { label: '3 ตัวหน้า', value: mergeUniqueValues(latest.threeTopList || []).join(' / ') },
      { label: '3 ตัวล่าง', value: mergeUniqueValues(latest.threeBotList || []).join(' / ') },
      { label: '2 ตัวล่าง', value: latest.twoBottom || '' }
    ],
    note: latest.isCalculated ? 'ผลในระบบคำนวณแล้ว' : 'ผลในระบบพร้อมใช้งาน'
  }));

  return true;
};

const applyThaiGovernmentMarket = async (sections) => {
  const market = await fetchLatestThaiGovernmentMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'government', market);
  return true;
};

const applyBaacMarket = async (sections) => {
  const market = await fetchLatestBaacMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'government', market);
  return true;
};

const applyLaosMarket = async (sections) => {
  const market = await fetchLatestLaosMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyLaosVipMarket = async (sections) => {
  const market = await fetchLatestLaosVipMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyManyCaiStandardMarket = (sections, config, payload) => {
  const row = getLatestManyCaiRow(payload);
  if (!row) {
    return false;
  }

  const firstPrize = compactDigits(row?.code?.code);
  const fourDigits = compactDigits(row?.code?.code_last4);
  const threeDigits = compactDigits(row?.code?.code_last3) || tailDigits(firstPrize, 3);
  const twoTopDigits = compactDigits(row?.code?.code_last2) || tailDigits(firstPrize, 2);
  const twoBottomDigits =
    tailDigits(row?.code?.code1, 2) ||
    twoDigitScalar(row?.code?.code2) ||
    compactDigits(row?.code?.code_pre2) ||
    compactDigits(row?.code?.code_mid2);

  if (!firstPrize && !threeDigits && !twoTopDigits && !twoBottomDigits) {
    return false;
  }

  setMarketData(sections, config.sectionId, buildMarket({
    id: config.marketId,
    name: config.name,
    provider: PROVIDER_NAME,
    resultDate: formatIssueDate(row.officialissue || row.issue, row.opendate),
    headline: firstPrize || threeDigits || twoTopDigits || twoBottomDigits,
    numbers: [
      { label: '4 ตัวบน', value: fourDigits },
      { label: '3 ตัวบน', value: threeDigits },
      { label: '2 ตัวบน', value: twoTopDigits },
      { label: '2 ตัวล่าง', value: twoBottomDigits }
    ],
    note: row.opendate ? `เปิดผล ${row.opendate}` : 'อัปเดตจาก ManyCai'
  }));

  return true;
};

const applyManyCaiStockMarket = (sections, config, payload) => {
  const row = getLatestManyCaiRow(payload);
  if (!row) {
    return false;
  }

  const threeDigits = compactDigits(row?.code?.code);
  const twoTopDigits = tailDigits(threeDigits, 2);
  const twoBottomDigits = compactDigits(row?.code?.code1);

  if (!threeDigits && !twoTopDigits && !twoBottomDigits) {
    return false;
  }

  setMarketData(sections, config.sectionId, buildMarket({
    id: config.marketId,
    name: config.name,
    provider: PROVIDER_NAME,
    resultDate: formatIssueDate(row.officialissue || row.issue, row.opendate),
    headline: threeDigits || twoTopDigits || twoBottomDigits,
    numbers: [
      { label: '3 ตัวบน', value: threeDigits },
      { label: '2 ตัวบน', value: twoTopDigits },
      { label: '2 ตัวล่าง', value: twoBottomDigits }
    ],
    note: row.opendate ? `เปิดผล ${row.opendate}` : 'อัปเดตจาก ManyCai'
  }));

  return true;
};

const applyManyCaiBaacMarket = (sections, config, payload) => {
  const row = getLatestManyCaiRow(payload);
  if (!row) {
    return false;
  }

  const firstPrize = compactDigits(row?.code?.code);
  const threeDigits = tailDigits(firstPrize, 3);
  const twoTopDigits = tailDigits(firstPrize, 2);
  const twoBottomDigits = middleDigits(firstPrize, 2);

  if (!firstPrize && !threeDigits && !twoTopDigits && !twoBottomDigits) {
    return false;
  }

  setMarketData(sections, config.sectionId, buildMarket({
    id: config.marketId,
    name: config.name,
    provider: PROVIDER_NAME,
    resultDate: formatIssueDate(row.officialissue || row.issue, row.opendate),
    headline: firstPrize || threeDigits || twoTopDigits || twoBottomDigits,
    numbers: [
      { label: '3 ตัวบน', value: threeDigits },
      { label: '2 ตัวบน', value: twoTopDigits },
      { label: '2 ตัวล่าง', value: twoBottomDigits }
    ],
    note: row.opendate ? `เปิดผล ${row.opendate}` : 'อัปเดตจาก ManyCai'
  }));

  return true;
};

const applyGsbMarket = async (sections) => {
  const market = await fetchGsbLatestMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'government', market);
  return true;
};

const applyLaosPathanaMarket = async (sections) => {
  const market = await fetchLatestLaosPathanaMarketNormalized();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyLaosRedcrossMarket = async (sections) => {
  const market = await fetchLatestLaosRedcrossMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyLaosTvMarket = async (sections) => {
  const market = await fetchLatestLaosTvMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyLaosHdMarket = async (sections) => {
  const market = await fetchLatestLaosHdMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyLaosExtraMarket = async (sections) => {
  const market = await fetchLatestLaosExtraMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyLaosStarsMarket = async (sections) => {
  const market = await fetchLatestLaosStarsMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyLaosStarsVipMarket = async (sections) => {
  const market = await fetchLatestLaosStarsVipMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyLaosUnionMarket = async (sections) => {
  const market = await fetchLatestLaosUnionMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyLaosUnionVipMarket = async (sections) => {
  const market = await fetchLatestLaosUnionVipMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyLaosAseanMarket = async (sections) => {
  const market = await fetchLatestLaosAseanMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyHanoiExtraMarket = async (sections) => {
  const market = await fetchLatestHanoiExtraMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyHanoiStarMarket = async (sections) => {
  const market = await fetchLatestHanoiStarMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyHanoiDevelopMarket = async (sections) => {
  const market = await fetchLatestHanoiDevelopMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyHanoiHdMarket = async (sections) => {
  const market = await fetchLatestHanoiHdMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyHanoiTvMarket = async (sections) => {
  const market = await fetchLatestHanoiTvMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyHanoiRedcrossMarket = async (sections) => {
  const market = await fetchLatestHanoiRedcrossMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyHanoiUnionMarket = async (sections) => {
  const market = await fetchLatestHanoiUnionMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const applyHanoiAseanMarket = async (sections) => {
  const market = await fetchLatestHanoiAseanMarket();
  if (!market) {
    return false;
  }

  setMarketData(sections, 'international', market);
  return true;
};

const buildSummary = (sections) => {
  const markets = sections.flatMap((section) => section.markets);
  const liveCount = markets.filter((market) => market.status === 'live').length;
  const pendingCount = markets.filter((market) => market.status === 'pending').length;
  const unsupportedCount = markets.filter((market) => market.status === 'unsupported').length;

  return {
    totalMarkets: markets.length,
    liveCount,
    pendingCount,
    unsupportedCount
  };
};

const getMarketOverview = async () => {
  if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const sections = cloneSections();
  const warnings = [];
  let hasGovernmentData = false;

  try {
    hasGovernmentData = await applyThaiGovernmentMarket(sections);
  } catch (error) {
    hasGovernmentData = false;
  }

  if (!hasGovernmentData) {
    const hasGovernmentFallback = await applyGovernmentFromLocal(sections);
    if (!hasGovernmentFallback) {
      warnings.push('ยังไม่มีผลหวยรัฐบาลไทยในระบบฐานข้อมูล');
    } else {
      warnings.push('ไม่สามารถดึงข้อมูลรัฐบาลไทยจาก GLO Official ได้ จึงใช้ผลในระบบแทน');
    }
  }

  try {
    const hasBaacData = await applyBaacMarket(sections);
    if (!hasBaacData) {
      warnings.push('ยังไม่สามารถแปลงข้อมูล ธ.ก.ส. จากหน้า BAAC ทางการได้');
    }
  } catch (error) {
    warnings.push('ไม่สามารถดึงข้อมูล ธ.ก.ส. จาก BAAC Official ได้');
  }

  try {
    const hasGsbData = await applyGsbMarket(sections);
    if (!hasGsbData) {
      warnings.push('ยังไม่สามารถแปลงข้อมูลออมสินจากเว็บไซต์ GSB ได้');
    }
  } catch (error) {
    warnings.push('ไม่สามารถดึงข้อมูลออมสินจากเว็บไซต์ GSB ได้');
  }

  try {
    const hasLaosData = await applyLaosMarket(sections);
    if (!hasLaosData) {
      warnings.push('ยังไม่สามารถแปลงข้อมูลหวยลาวจาก Huay Lao Official ได้');
    }
  } catch (error) {
    warnings.push('ไม่สามารถดึงข้อมูลหวยลาวจาก Huay Lao Official ได้');
  }

  try {
    const hasLaosVipData = await applyLaosVipMarket(sections);
    if (!hasLaosVipData) {
      warnings.push('ยังไม่สามารถแปลงข้อมูลลาว VIP จาก Lao VIP Official ได้');
    }
  } catch (error) {
    warnings.push('ไม่สามารถดึงข้อมูลลาว VIP จาก Lao VIP Official ได้');
  }

  try {
    const hasLaosPathanaData = await applyLaosPathanaMarket(sections);
    if (!hasLaosPathanaData) {
      warnings.push('ยังไม่สามารถแปลงข้อมูลลาวพัฒนาจากเว็บไซต์ Lao Pathana ได้');
    }
  } catch (error) {
    warnings.push('ไม่สามารถดึงข้อมูลลาวพัฒนาจากเว็บไซต์ Lao Pathana ได้');
  }

  try {
    const hasLaosRedcrossData = await applyLaosRedcrossMarket(sections);
    if (!hasLaosRedcrossData) {
      warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27\u0e01\u0e32\u0e0a\u0e32\u0e14\u0e08\u0e32\u0e01 API Lao Red Cross \u0e44\u0e14\u0e49');
    }
  } catch (error) {
    warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27\u0e01\u0e32\u0e0a\u0e32\u0e14\u0e08\u0e32\u0e01 API Lao Red Cross \u0e44\u0e14\u0e49');
  }

  try {
    const hasLaosTvData = await applyLaosTvMarket(sections);
    if (!hasLaosTvData) {
      warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27 TV \u0e08\u0e32\u0e01 API Lao TV \u0e44\u0e14\u0e49');
    }
  } catch (error) {
    warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27 TV \u0e08\u0e32\u0e01 API Lao TV \u0e44\u0e14\u0e49');
  }

  try {
    const hasLaosHdData = await applyLaosHdMarket(sections);
    if (!hasLaosHdData) {
      warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27 HD \u0e08\u0e32\u0e01 API Lao HD \u0e44\u0e14\u0e49');
    }
  } catch (error) {
    warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27 HD \u0e08\u0e32\u0e01 API Lao HD \u0e44\u0e14\u0e49');
  }

  try {
    const hasLaosExtraData = await applyLaosExtraMarket(sections);
    if (!hasLaosExtraData) {
      warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27 Extra \u0e08\u0e32\u0e01 API Lao Extra \u0e44\u0e14\u0e49');
    }
  } catch (error) {
    warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27 Extra \u0e08\u0e32\u0e01 API Lao Extra \u0e44\u0e14\u0e49');
  }

  try {
    const hasLaosStarsData = await applyLaosStarsMarket(sections);
    if (!hasLaosStarsData) {
      warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27\u0e2a\u0e15\u0e32\u0e23\u0e4c \u0e08\u0e32\u0e01 API Lao Stars \u0e44\u0e14\u0e49');
    }
  } catch (error) {
    warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27\u0e2a\u0e15\u0e32\u0e23\u0e4c \u0e08\u0e32\u0e01 API Lao Stars \u0e44\u0e14\u0e49');
  }

  try {
    const hasLaosStarsVipData = await applyLaosStarsVipMarket(sections);
    if (!hasLaosStarsVipData) {
      warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27\u0e2a\u0e15\u0e32\u0e23\u0e4c VIP \u0e08\u0e32\u0e01 API Lao Stars VIP \u0e44\u0e14\u0e49');
    }
  } catch (error) {
    warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27\u0e2a\u0e15\u0e32\u0e23\u0e4c VIP \u0e08\u0e32\u0e01 API Lao Stars VIP \u0e44\u0e14\u0e49');
  }

  try {
    const hasLaosUnionData = await applyLaosUnionMarket(sections);
    if (!hasLaosUnionData) {
      warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27\u0e2a\u0e32\u0e21\u0e31\u0e04\u0e04\u0e35 \u0e08\u0e32\u0e01 API Lao Union \u0e44\u0e14\u0e49');
    }
  } catch (error) {
    warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27\u0e2a\u0e32\u0e21\u0e31\u0e04\u0e04\u0e35 \u0e08\u0e32\u0e01 API Lao Union \u0e44\u0e14\u0e49');
  }

  try {
    const hasLaosUnionVipData = await applyLaosUnionVipMarket(sections);
    if (!hasLaosUnionVipData) {
      warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27\u0e2a\u0e32\u0e21\u0e31\u0e04\u0e04\u0e35 VIP \u0e08\u0e32\u0e01 API Lao Union VIP \u0e44\u0e14\u0e49');
    }
  } catch (error) {
    warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27\u0e2a\u0e32\u0e21\u0e31\u0e04\u0e04\u0e35 VIP \u0e08\u0e32\u0e01 API Lao Union VIP \u0e44\u0e14\u0e49');
  }

  try {
    const hasLaosAseanData = await applyLaosAseanMarket(sections);
    if (!hasLaosAseanData) {
      warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27\u0e2d\u0e32\u0e40\u0e0b\u0e35\u0e22\u0e19 \u0e08\u0e32\u0e01 API Lao ASEAN \u0e44\u0e14\u0e49');
    }
  } catch (error) {
    warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e32\u0e27\u0e2d\u0e32\u0e40\u0e0b\u0e35\u0e22\u0e19 \u0e08\u0e32\u0e01 API Lao ASEAN \u0e44\u0e14\u0e49');
  }

  try {
    const hasHanoiExtraData = await applyHanoiExtraMarket(sections);
    if (!hasHanoiExtraData) {
      warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22 Extra \u0e08\u0e32\u0e01 API Xoso Extra \u0e44\u0e14\u0e49');
    }
  } catch (error) {
    warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22 Extra \u0e08\u0e32\u0e01 API Xoso Extra \u0e44\u0e14\u0e49');
  }

  try {
    const hasHanoiStarData = await applyHanoiStarMarket(sections);
    if (!hasHanoiStarData) {
      warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22\u0e2a\u0e15\u0e32\u0e23\u0e4c \u0e08\u0e32\u0e01 API Minh Ngoc Star \u0e44\u0e14\u0e49');
    }
  } catch (error) {
    warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22\u0e2a\u0e15\u0e32\u0e23\u0e4c \u0e08\u0e32\u0e01 API Minh Ngoc Star \u0e44\u0e14\u0e49');
  }

  try {
    const hasHanoiDevelopData = await applyHanoiDevelopMarket(sections);
    if (!hasHanoiDevelopData) {
      warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22\u0e1e\u0e31\u0e12\u0e19\u0e32 \u0e08\u0e32\u0e01 API Xoso Develop \u0e44\u0e14\u0e49');
    }
  } catch (error) {
    warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22\u0e1e\u0e31\u0e12\u0e19\u0e32 \u0e08\u0e32\u0e01 API Xoso Develop \u0e44\u0e14\u0e49');
  }

  try {
    const hasHanoiHdData = await applyHanoiHdMarket(sections);
    if (!hasHanoiHdData) {
      warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22 HD \u0e08\u0e32\u0e01 API Xoso HD \u0e44\u0e14\u0e49');
    }
  } catch (error) {
    warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22 HD \u0e08\u0e32\u0e01 API Xoso HD \u0e44\u0e14\u0e49');
  }

    try {
      const hasHanoiTvData = await applyHanoiTvMarket(sections);
      if (!hasHanoiTvData) {
        warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22 TV \u0e08\u0e32\u0e01 API Minh Ngoc TV \u0e44\u0e14\u0e49');
      }
    } catch (error) {
      warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22 TV \u0e08\u0e32\u0e01 API Minh Ngoc TV \u0e44\u0e14\u0e49');
    }

    try {
      const hasHanoiRedcrossData = await applyHanoiRedcrossMarket(sections);
      if (!hasHanoiRedcrossData) {
        warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22\u0e01\u0e32\u0e0a\u0e32\u0e14 \u0e08\u0e32\u0e01 API Xoso Redcross \u0e44\u0e14\u0e49');
      }
    } catch (error) {
      warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22\u0e01\u0e32\u0e0a\u0e32\u0e14 \u0e08\u0e32\u0e01 API Xoso Redcross \u0e44\u0e14\u0e49');
    }

    try {
      const hasHanoiUnionData = await applyHanoiUnionMarket(sections);
      if (!hasHanoiUnionData) {
        warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22\u0e2a\u0e32\u0e21\u0e31\u0e04\u0e04\u0e35 \u0e08\u0e32\u0e01 API Xoso Union \u0e44\u0e14\u0e49');
      }
    } catch (error) {
      warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22\u0e2a\u0e32\u0e21\u0e31\u0e04\u0e04\u0e35 \u0e08\u0e32\u0e01 API Xoso Union \u0e44\u0e14\u0e49');
    }

    try {
      const hasHanoiAseanData = await applyHanoiAseanMarket(sections);
      if (!hasHanoiAseanData) {
        warnings.push('\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e41\u0e1b\u0e25\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22\u0e2d\u0e32\u0e40\u0e0b\u0e35\u0e22\u0e19 \u0e08\u0e32\u0e01 API Hanoi ASEAN \u0e44\u0e14\u0e49');
      }
    } catch (error) {
      warnings.push('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2e\u0e32\u0e19\u0e2d\u0e22\u0e2d\u0e32\u0e40\u0e0b\u0e35\u0e22\u0e19 \u0e08\u0e32\u0e01 API Hanoi ASEAN \u0e44\u0e14\u0e49');
    }

  if (!PROVIDER_KEY) {
    warnings.push('ยังไม่ได้ตั้งค่า MANYCAI_API_KEY บน backend ตลาดที่ใช้ ManyCai จะแสดงเป็นรอเชื่อมต่อ');

    warnings.push('Using ManyCai feed fallback because MANYCAI_API_KEY is not configured');
  }

  const requests = await Promise.allSettled(ACTIVE_MANYCAI_MARKETS.map((market) => fetchProvider(market.code)));

  requests.forEach((result, index) => {
    const market = ACTIVE_MANYCAI_MARKETS[index];
    if (!market) {
      return;
    }

    if (result.status !== 'fulfilled') {
      warnings.push(`ไม่สามารถดึงข้อมูล ${market.name} จาก ManyCai ได้`);
      return;
    }

    const hydrated = market.type === 'stock'
      ? applyManyCaiStockMarket(sections, market, result.value)
      : market.type === 'baac'
        ? applyManyCaiBaacMarket(sections, market, result.value)
      : applyManyCaiStandardMarket(sections, market, result.value);

    if (!hydrated) {
      warnings.push(`ไม่สามารถแปลงข้อมูล ${market.name} จาก ManyCai ได้`);
    }
  });

  const overview = {
    provider: {
      name: PROVIDER_NAME,
      configured: true,
      baseUrl: PROVIDER_BASE_URL,
      fetchedAt: new Date().toISOString(),
      cacheTtlMs: CACHE_TTL_MS
    },
    summary: buildSummary(sections),
    warnings,
    sections
  };

  cache.data = overview;
  cache.fetchedAt = Date.now();

  return overview;
};

const getMarketById = async (marketId) => {
  const overview = await getMarketOverview();

  for (const section of overview.sections || []) {
    const market = (section.markets || []).find((entry) => entry.id === marketId);
    if (market) {
      return {
        ...market,
        sectionId: section.id,
        sectionTitle: section.title,
        providerConfigured: market.provider !== PROVIDER_NAME || overview.provider?.configured
      };
    }
  }

  return null;
};

module.exports = { getMarketOverview, getMarketById };
