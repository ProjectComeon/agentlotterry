const assert = require('assert');

const {
  SYNC_CONFIGS,
  EXPLICIT_FEED_MAPPINGS,
  STRICT_FEED_MAPPING,
  buildSnapshot
} = require('../services/externalResultFeedService');

const findConfig = (feedCode) => {
  const config = SYNC_CONFIGS.find((item) => item.feedCode === feedCode);
  assert(config, `Missing sync config entry for ${feedCode}`);
  return config;
};

const governmentFixture = {
  officialissue: '20260408',
  opendate: '2026-04-08 20:30:00',
  code: {
    code: '123456',
    code1: ['111', '222'],
    code2: ['333', '444'],
    code3: '55'
  }
};

const hanoiFiveDigitFixture = {
  officialissue: '20260408',
  opendate: '2026-04-08 18:30:00',
  code: {
    code: '12345',
    code1: '67890'
  }
};

const fourDigitPre2Fixture = {
  officialissue: '20260408',
  opendate: '2026-04-08 17:00:00',
  code: {
    code: '1234',
    code_last3: '234',
    code_last2: '34',
    code_pre2: '56'
  }
};

const fiveDigitCode2Fixture = {
  officialissue: '20260408',
  opendate: '2026-04-08 19:00:00',
  code: {
    code: '54321',
    code_last3: '321',
    code_last2: '21',
    code2: '67'
  }
};

const yikiFixture = {
  officialissue: '20260408',
  opendate: '2026-04-08 16:15:00',
  code: {
    code: '12345678',
    code_last3: '678',
    code_mid2: '45'
  }
};

const stockFixture = {
  officialissue: '20260408',
  opendate: '2026-04-08 12:15:00',
  code: {
    code: '789',
    code1: '12'
  }
};

const baacFixture = {
  officialissue: '20260408',
  opendate: '2026-04-08 16:00:00',
  code: {
    code: '123456'
  }
};

const thaiGovernmentOfficialFixture = {
  __snapshot: {
    lotteryCode: 'thai_government',
    feedCode: 'tgfc',
    marketName: 'รัฐบาลไทย',
    roundCode: '2026-04-08',
    headline: '123456',
    firstPrize: '123456',
    threeTop: '456',
    threeFront: '111',
    twoTop: '56',
    twoBottom: '55',
    threeBottom: '333',
    threeTopHits: ['456'],
    twoTopHits: ['56'],
    twoBottomHits: ['55'],
    threeFrontHits: ['111', '222'],
    threeBottomHits: ['333', '444'],
    runTop: ['4', '5', '6'],
    runBottom: ['5'],
    resultPublishedAt: new Date('2026-04-08T09:00:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://www.glo.or.th/lottery/checking?date=2026-04-08',
    legacyGovernmentPayload: {
      roundDate: '2026-04-08',
      firstPrize: '123456',
      threeTopList: ['111', '222'],
      threeBotList: ['333', '444'],
      twoBottom: '55',
      runTop: ['4', '5', '6'],
      runBottom: ['5'],
      fetchedAt: new Date('2026-04-08T09:00:00.000Z')
    }
  }
};

const baacOfficialFixture = {
  __snapshot: {
    lotteryCode: 'baac',
    feedCode: 'baac',
    marketName: 'สลากออมทรัพย์ ธกส.',
    roundCode: '2026-04-08',
    headline: '1234567',
    firstPrize: '1234567',
    threeTop: '567',
    threeFront: '',
    twoTop: '67',
    twoBottom: '45',
    threeBottom: '',
    threeTopHits: ['567'],
    twoTopHits: ['67'],
    twoBottomHits: ['45'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['5', '6', '7'],
    runBottom: ['4', '5'],
    resultPublishedAt: new Date('2026-04-08T05:15:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://www.baac.or.th/salak/content-lotto.php',
    rawPayload: {
      roundCode: '2026-04-08',
      firstPrize: '1234567'
    }
  }
};

const gsbFixture = {
  __snapshot: {
    lotteryCode: 'gsb',
    feedCode: 'gsb',
    marketName: 'ออมสิน',
    roundCode: '2026-04-08',
    headline: '395',
    firstPrize: '',
    threeTop: '395',
    threeFront: '',
    twoTop: '95',
    twoBottom: '68',
    threeBottom: '',
    threeTopHits: ['395'],
    twoTopHits: ['95'],
    twoBottomHits: ['68'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['3', '9', '5'],
    runBottom: ['6', '8'],
    resultPublishedAt: new Date('2026-04-08T05:00:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://psc.gsb.or.th/resultsalak/salak-1year-100/08042026'
  }
};

const laosFixture = {
  __snapshot: {
    lotteryCode: 'tlzc',
    feedCode: 'tlzc',
    marketName: 'หวยลาว',
    roundCode: '2026-04-15',
    headline: '782',
    firstPrize: '6782',
    threeTop: '782',
    threeFront: '',
    twoTop: '82',
    twoBottom: '67',
    threeBottom: '',
    threeTopHits: ['782'],
    twoTopHits: ['82'],
    twoBottomHits: ['67'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['7', '8', '2'],
    runBottom: ['6', '7'],
    resultPublishedAt: new Date('2026-04-15T13:30:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://huaylao.la/',
    rawPayload: {}
  }
};

const laosVipFixture = {
  __snapshot: {
    lotteryCode: 'lao_vip',
    feedCode: 'zcvip',
    marketName: 'ลาว VIP',
    roundCode: '2026-04-15',
    headline: '211',
    firstPrize: '48211',
    threeTop: '211',
    threeFront: '',
    twoTop: '11',
    twoBottom: '48',
    threeBottom: '',
    threeTopHits: ['211'],
    twoTopHits: ['11'],
    twoBottomHits: ['48'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['2', '1'],
    runBottom: ['4', '8'],
    resultPublishedAt: new Date('2026-04-15T14:30:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://www.laosviplot.com/',
    rawPayload: {}
  }
};

const laosPathanaFixture = {
  __snapshot: {
    lotteryCode: 'lao_pathana',
    feedCode: 'lao_pathana',
    marketName: 'ลาวพัฒนา',
    roundCode: '2026-04-13',
    headline: '568',
    firstPrize: '27568',
    threeTop: '568',
    threeFront: '',
    twoTop: '68',
    twoBottom: '75',
    threeBottom: '',
    threeTopHits: ['568'],
    twoTopHits: ['68'],
    twoBottomHits: ['75'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['5', '6', '8'],
    runBottom: ['7', '5'],
    resultPublishedAt: new Date('2026-04-13T13:15:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://laospathana.com/',
    rawPayload: {
      currentMatch: {
        MATCH_ID: 361,
        M_DATE: '2026-04-13'
      },
      currentResult: {
        RESULT_1: '27568'
      }
    }
  }
};

const laosRedcrossFixture = {
  __snapshot: {
    lotteryCode: 'lao_redcross',
    feedCode: 'lao_redcross',
    marketName: 'ลาวกาชาด',
    roundCode: '2026-04-13',
    headline: '254',
    firstPrize: '30254',
    threeTop: '254',
    threeFront: '',
    twoTop: '54',
    twoBottom: '30',
    threeBottom: '',
    threeTopHits: ['254'],
    twoTopHits: ['54'],
    twoBottomHits: ['30'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['2', '5', '4'],
    runBottom: ['3', '0'],
    resultPublishedAt: new Date('2026-04-13T16:30:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://api.lao-redcross.com/result',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-13',
        results: {
          digit5: '30254',
          digit3: '254',
          digit2_top: '54',
          digit2_bottom: '30'
        }
      }
    }
  }
};

const laosTvFixture = {
  __snapshot: {
    lotteryCode: 'lao_tv',
    feedCode: 'lao_tv',
    marketName: '\u0e25\u0e32\u0e27 TV',
    roundCode: '2026-04-14',
    headline: '927',
    firstPrize: '95927',
    threeTop: '927',
    threeFront: '',
    twoTop: '27',
    twoBottom: '95',
    threeBottom: '',
    threeTopHits: ['927'],
    twoTopHits: ['27'],
    twoBottomHits: ['95'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['9', '2', '7'],
    runBottom: ['9', '5'],
    resultPublishedAt: new Date('2026-04-14T03:30:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://lao-tv.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-14',
        results: {
          digit5: '95927',
          digit3: '927',
          digit2_top: '27',
          digit2_bottom: '95'
        }
      }
    }
  }
};

const laosHdFixture = {
  __snapshot: {
    lotteryCode: 'lao_hd',
    feedCode: 'lao_hd',
    marketName: '\u0e25\u0e32\u0e27 HD',
    roundCode: '2026-04-14',
    headline: '900',
    firstPrize: '47900',
    threeTop: '900',
    threeFront: '',
    twoTop: '00',
    twoBottom: '47',
    threeBottom: '',
    threeTopHits: ['900'],
    twoTopHits: ['00'],
    twoBottomHits: ['47'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['9', '0'],
    runBottom: ['4', '7'],
    resultPublishedAt: new Date('2026-04-14T06:45:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://laoshd.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-14',
        results: {
          digit5: '47900',
          digit3: '900',
          digit2_top: '00',
          digit2_bottom: '47'
        }
      }
    }
  }
};

const laosExtraFixture = {
  __snapshot: {
    lotteryCode: 'lao_extra',
    feedCode: 'lao_extra',
    marketName: '\u0e25\u0e32\u0e27 Extra',
    roundCode: '2026-04-14',
    headline: '323',
    firstPrize: '17323',
    threeTop: '323',
    threeFront: '',
    twoTop: '23',
    twoBottom: '17',
    threeBottom: '',
    threeTopHits: ['323'],
    twoTopHits: ['23'],
    twoBottomHits: ['17'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['3', '2'],
    runBottom: ['1', '7'],
    resultPublishedAt: new Date('2026-04-14T01:30:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://laoextra.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-14',
        results: {
          digit5: '17323',
          digit3: '323',
          digit2_top: '23',
          digit2_bottom: '17'
        }
      }
    }
  }
};

const laosStarFixture = {
  __snapshot: {
    lotteryCode: 'lao_star',
    feedCode: 'lao_star',
    marketName: 'ลาวสตาร์',
    roundCode: '2026-04-14',
    headline: '262',
    firstPrize: '50262',
    threeTop: '262',
    threeFront: '',
    twoTop: '62',
    twoBottom: '50',
    threeBottom: '',
    threeTopHits: ['262'],
    twoTopHits: ['62'],
    twoBottomHits: ['50'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['2', '6'],
    runBottom: ['5', '0'],
    resultPublishedAt: new Date('2026-04-14T08:45:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://laostars.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-14',
        results: {
          digit5: '50262',
          digit3: '262',
          digit2_top: '62',
          digit2_bottom: '50'
        }
      }
    }
  }
};

const laosStarVipFixture = {
  __snapshot: {
    lotteryCode: 'lao_star_vip',
    feedCode: 'lao_star_vip',
    marketName: 'ลาวสตาร์ VIP',
    roundCode: '2026-04-14',
    headline: '402',
    firstPrize: '37402',
    threeTop: '402',
    threeFront: '',
    twoTop: '02',
    twoBottom: '37',
    threeBottom: '',
    threeTopHits: ['402'],
    twoTopHits: ['02'],
    twoBottomHits: ['37'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['4', '0', '2'],
    runBottom: ['3', '7'],
    resultPublishedAt: new Date('2026-04-14T15:00:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://laostars-vip.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-14',
        results: {
          digit5: '37402',
          digit3: '402',
          digit2_top: '02',
          digit2_bottom: '37'
        }
      }
    }
  }
};

const laosUnionFixture = {
  __snapshot: {
    lotteryCode: 'lao_union',
    feedCode: 'lao_union',
    marketName: 'ลาวสามัคคี',
    roundCode: '2026-04-14',
    headline: '581',
    firstPrize: '96581',
    threeTop: '581',
    threeFront: '',
    twoTop: '81',
    twoBottom: '96',
    threeBottom: '',
    threeTopHits: ['581'],
    twoTopHits: ['81'],
    twoBottomHits: ['96'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['5', '8', '1'],
    runBottom: ['9', '6'],
    resultPublishedAt: new Date('2026-04-14T13:30:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://laounion.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-14',
        results: {
          digit5: '96581',
          digit3: '581',
          digit2_top: '81',
          digit2_bottom: '96'
        }
      }
    }
  }
};

const laosUnionVipFixture = {
  __snapshot: {
    lotteryCode: 'lao_union_vip',
    feedCode: 'lao_union_vip',
    marketName: 'ลาวสามัคคี VIP',
    roundCode: '2026-04-14',
    headline: '011',
    firstPrize: '07011',
    threeTop: '011',
    threeFront: '',
    twoTop: '11',
    twoBottom: '07',
    threeBottom: '',
    threeTopHits: ['011'],
    twoTopHits: ['11'],
    twoBottomHits: ['07'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['0', '1'],
    runBottom: ['0', '7'],
    resultPublishedAt: new Date('2026-04-14T14:30:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://laounionvip.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-14',
        results: {
          digit5: '07011',
          digit3: '011',
          digit2_top: '11',
          digit2_bottom: '07'
        }
      }
    }
  }
};

const laosAseanFixture = {
  __snapshot: {
    lotteryCode: 'lao_asean',
    feedCode: 'lao_asean',
    marketName: 'ลาวอาเซียน',
    roundCode: '2026-04-14',
    headline: '063',
    firstPrize: '58063',
    threeTop: '063',
    threeFront: '',
    twoTop: '63',
    twoBottom: '58',
    threeBottom: '',
    threeTopHits: ['063'],
    twoTopHits: ['63'],
    twoBottomHits: ['58'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['0', '6', '3'],
    runBottom: ['5', '8'],
    resultPublishedAt: new Date('2026-04-14T14:00:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://lotterylaosasean.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-14',
        results: {
          digit5: '58063',
          digit3: '063',
          digit2_top: '63',
          digit2_bottom: '58'
        }
      }
    }
  }
};

const hanoiExtraFixture = {
  __snapshot: {
    lotteryCode: 'hanoi_extra',
    feedCode: 'hanoi_extra',
    marketName: 'ฮานอย Extra',
    roundCode: '2026-04-14',
    headline: '817',
    firstPrize: '74817',
    threeTop: '817',
    threeFront: '',
    twoTop: '17',
    twoBottom: '35',
    threeBottom: '',
    threeTopHits: ['817'],
    twoTopHits: ['17'],
    twoBottomHits: ['35'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['8', '1', '7'],
    runBottom: ['3', '5'],
    resultPublishedAt: new Date('2026-04-14T15:30:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://xosoextra.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-14',
        show_1st: '2026-04-14 22:30',
        results: {
          prize_1st: '74817',
          prize_2nd: '83635'
        }
      }
    }
  }
};

const hanoiStarFixture = {
  __snapshot: {
    lotteryCode: 'hanoi_star',
    feedCode: 'hanoi_star',
    marketName: 'ฮานอยสตาร์',
    roundCode: '2026-04-15',
    headline: '064',
    firstPrize: '19064',
    threeTop: '064',
    threeFront: '',
    twoTop: '64',
    twoBottom: '81',
    threeBottom: '',
    threeTopHits: ['064'],
    twoTopHits: ['64'],
    twoBottomHits: ['81'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['0', '6', '4'],
    runBottom: ['8', '1'],
    resultPublishedAt: new Date('2026-04-15T05:30:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://minhngocstar.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-15',
        show_1st: '2026-04-15 12:30',
        results: {
          prize_1st: '19064',
          prize_2nd: '41281'
        }
      }
    }
  }
};

const hanoiDevelopFixture = {
  __snapshot: {
    lotteryCode: 'hanoi_develop',
    feedCode: 'hanoi_develop',
    marketName: 'ฮานอยพัฒนา',
    roundCode: '2026-04-15',
    headline: '152',
    firstPrize: '59152',
    threeTop: '152',
    threeFront: '',
    twoTop: '52',
    twoBottom: '92',
    threeBottom: '',
    threeTopHits: ['152'],
    twoTopHits: ['52'],
    twoBottomHits: ['92'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['1', '5', '2'],
    runBottom: ['9', '2'],
    resultPublishedAt: new Date('2026-04-15T12:30:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://xosodevelop.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-15',
        show_1st: '2026-04-15 19:30',
        results: {
          prize_1st: '59152',
          prize_2nd: '30992'
        }
      }
    }
  }
};

const hanoiHdFixture = {
  __snapshot: {
    lotteryCode: 'hanoi_hd',
    feedCode: 'hanoi_hd',
    marketName: 'ฮานอย HD',
    roundCode: '2026-04-15',
    headline: '743',
    firstPrize: '99743',
    threeTop: '743',
    threeFront: '',
    twoTop: '43',
    twoBottom: '93',
    threeBottom: '',
    threeTopHits: ['743'],
    twoTopHits: ['43'],
    twoBottomHits: ['93'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['7', '4', '3'],
    runBottom: ['9', '3'],
    resultPublishedAt: new Date('2026-04-15T04:30:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://xosohd.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-15',
        show_1st: '2026-04-15 11:30',
        results: {
          prize_1st: '99743',
          prize_2nd: '48293'
        }
      }
    }
  }
};

const hanoiTvFixture = {
  __snapshot: {
    lotteryCode: 'hanoi_tv',
    feedCode: 'hanoi_tv',
    marketName: 'ฮานอย TV',
    roundCode: '2026-04-15',
    headline: '004',
    firstPrize: '29004',
    threeTop: '004',
    threeFront: '',
    twoTop: '04',
    twoBottom: '24',
    threeBottom: '',
    threeTopHits: ['004'],
    twoTopHits: ['04'],
    twoBottomHits: ['24'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['0', '4'],
    runBottom: ['2', '4'],
    resultPublishedAt: new Date('2026-04-15T07:30:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://minhngoctv.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-15',
        show_1st: '2026-04-15 14:30',
        results: {
          prize_1st: '29004',
          prize_2nd: '41624'
        }
      }
    }
  }
};

const hanoiRedcrossFixture = {
  __snapshot: {
    lotteryCode: 'hanoi_redcross',
    feedCode: 'hanoi_redcross',
    marketName: 'ฮานอยกาชาด',
    roundCode: '2026-04-15',
    headline: '209',
    firstPrize: '59209',
    threeTop: '209',
    threeFront: '',
    twoTop: '09',
    twoBottom: '91',
    threeBottom: '',
    threeTopHits: ['209'],
    twoTopHits: ['09'],
    twoBottomHits: ['91'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['2', '0', '9'],
    runBottom: ['9', '1'],
    resultPublishedAt: new Date('2026-04-15T09:30:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://xosoredcross.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-15',
        show_1st: '2026-04-15 16:30',
        results: {
          prize_1st: '59209',
          prize_2nd: '63991'
        }
      }
    }
  }
};

const hanoiUnionFixture = {
  __snapshot: {
    lotteryCode: 'hanoi_union',
    feedCode: 'hanoi_union',
    marketName: 'ฮานอยสามัคคี',
    roundCode: '2026-04-15',
    headline: '930',
    firstPrize: '93930',
    threeTop: '930',
    threeFront: '',
    twoTop: '30',
    twoBottom: '17',
    threeBottom: '',
    threeTopHits: ['930'],
    twoTopHits: ['30'],
    twoBottomHits: ['17'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['9', '3', '0'],
    runBottom: ['1', '7'],
    resultPublishedAt: new Date('2026-04-15T10:30:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://xosounion.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-15',
        show_1st: '2026-04-15 17:30',
        results: {
          prize_1st: '93930',
          prize_2nd: '64917'
        }
      }
    }
  }
};

const hanoiAseanFixture = {
  __snapshot: {
    lotteryCode: 'hanoi_asean',
    feedCode: 'hanoi_asean',
    marketName: 'ฮานอยอาเซียน',
    roundCode: '2026-04-15',
    headline: '607',
    firstPrize: '23607',
    threeTop: '607',
    threeFront: '',
    twoTop: '07',
    twoBottom: '75',
    threeBottom: '',
    threeTopHits: ['607'],
    twoTopHits: ['07'],
    twoBottomHits: ['75'],
    threeFrontHits: [],
    threeBottomHits: [],
    runTop: ['6', '0', '7'],
    runBottom: ['7', '5'],
    resultPublishedAt: new Date('2026-04-15T02:30:00.000Z'),
    isSettlementSafe: true,
    sourceUrl: 'https://hanoiasean.com/',
    rawPayload: {
      status: 'success',
      data: {
        lotto_date: '2026-04-15',
        show_1st: '2026-04-15 09:30',
        results: {
          prize_1st: '23607',
          prize_2nd: '94275'
        }
      }
    }
  }
};

const scenarios = [
  {
    name: 'government official mapping',
    feedCodes: ['tgfc'],
    row: thaiGovernmentOfficialFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-08');
      assert.strictEqual(snapshot.firstPrize, '123456');
      assert.strictEqual(snapshot.threeTop, '456');
      assert.strictEqual(snapshot.twoTop, '56');
      assert.strictEqual(snapshot.twoBottom, '55');
      assert.deepStrictEqual(snapshot.threeFrontHits, ['111', '222']);
      assert.deepStrictEqual(snapshot.threeBottomHits, ['333', '444']);
      assert.strictEqual(snapshot.threeFront, '111');
      assert.strictEqual(snapshot.threeBottom, '333');
    }
  },
  {
    name: 'five-digit hanoi family mapping',
    feedCodes: ['hnvip', 'bfhn', 'cqhn'],
    row: hanoiFiveDigitFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.firstPrize, '12345');
      assert.strictEqual(snapshot.threeTop, '345');
      assert.strictEqual(snapshot.twoTop, '45');
      assert.strictEqual(snapshot.twoBottom, '90');
      assert.deepStrictEqual(snapshot.threeTopHits, ['345']);
      assert.deepStrictEqual(snapshot.twoTopHits, ['45']);
      assert.deepStrictEqual(snapshot.twoBottomHits, ['90']);
    }
  },
  {
    name: 'four-digit pre2 family mapping',
    feedCodes: ['ynhn', 'ynma'],
    row: fourDigitPre2Fixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.firstPrize, '1234');
      assert.strictEqual(snapshot.threeTop, '234');
      assert.strictEqual(snapshot.twoTop, '34');
      assert.strictEqual(snapshot.twoBottom, '56');
      assert.deepStrictEqual(snapshot.threeTopHits, ['234']);
      assert.deepStrictEqual(snapshot.twoTopHits, ['34']);
      assert.deepStrictEqual(snapshot.twoBottomHits, ['56']);
    }
  },
  {
    name: 'laos official mapping',
    feedCodes: ['tlzc'],
    row: laosFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-15');
      assert.strictEqual(snapshot.firstPrize, '6782');
      assert.strictEqual(snapshot.threeTop, '782');
      assert.strictEqual(snapshot.twoTop, '82');
      assert.strictEqual(snapshot.twoBottom, '67');
      assert.deepStrictEqual(snapshot.runTop, ['7', '8', '2']);
      assert.deepStrictEqual(snapshot.runBottom, ['6', '7']);
      assert.strictEqual(snapshot.sourceUrl, 'https://huaylao.la/');
    }
  },
  {
    name: 'laos vip official mapping',
    feedCodes: ['zcvip'],
    row: laosVipFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-15');
      assert.strictEqual(snapshot.firstPrize, '48211');
      assert.strictEqual(snapshot.threeTop, '211');
      assert.strictEqual(snapshot.twoTop, '11');
      assert.strictEqual(snapshot.twoBottom, '48');
      assert.deepStrictEqual(snapshot.runTop, ['2', '1']);
      assert.deepStrictEqual(snapshot.runBottom, ['4', '8']);
      assert.strictEqual(snapshot.sourceUrl, 'https://www.laosviplot.com/');
    }
  },
  {
    name: 'yiki mid2 mapping',
    feedCodes: ['tykc'],
    row: yikiFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.firstPrize, '12345678');
      assert.strictEqual(snapshot.threeTop, '678');
      assert.strictEqual(snapshot.twoTop, '78');
      assert.strictEqual(snapshot.twoBottom, '45');
    }
  },
  {
    name: 'stock family mapping',
    feedCodes: [
      'gshka', 'gshkp', 'gstw', 'gsjpa', 'gsjpp', 'gskr', 'gscna', 'gscnp',
      'gssg', 'gsth', 'gsin', 'gseg', 'gsru', 'gsde', 'gsuk', 'gsus'
    ],
    row: stockFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.firstPrize, '789');
      assert.strictEqual(snapshot.threeTop, '789');
      assert.strictEqual(snapshot.twoTop, '89');
      assert.strictEqual(snapshot.twoBottom, '12');
      assert.deepStrictEqual(snapshot.threeTopHits, ['789']);
      assert.deepStrictEqual(snapshot.twoTopHits, ['89']);
      assert.deepStrictEqual(snapshot.twoBottomHits, ['12']);
    }
  },
  {
    name: 'baac official mapping',
    feedCodes: ['baac'],
    row: baacOfficialFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-08');
      assert.strictEqual(snapshot.firstPrize, '1234567');
      assert.strictEqual(snapshot.threeTop, '567');
      assert.strictEqual(snapshot.twoTop, '67');
      assert.strictEqual(snapshot.twoBottom, '45');
    }
  },
  {
    name: 'gsb mapping',
    feedCodes: ['gsb'],
    row: gsbFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-08');
      assert.strictEqual(snapshot.threeTop, '395');
      assert.strictEqual(snapshot.twoTop, '95');
      assert.strictEqual(snapshot.twoBottom, '68');
      assert.deepStrictEqual(snapshot.runTop, ['3', '9', '5']);
      assert.deepStrictEqual(snapshot.runBottom, ['6', '8']);
      assert.strictEqual(snapshot.sourceUrl, 'https://psc.gsb.or.th/resultsalak/salak-1year-100/08042026');
    }
  },
  {
    name: 'laos pathana mapping',
    feedCodes: ['lao_pathana'],
    row: laosPathanaFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-13');
      assert.strictEqual(snapshot.firstPrize, '27568');
      assert.strictEqual(snapshot.threeTop, '568');
      assert.strictEqual(snapshot.twoTop, '68');
      assert.strictEqual(snapshot.twoBottom, '75');
      assert.deepStrictEqual(snapshot.runTop, ['5', '6', '8']);
      assert.deepStrictEqual(snapshot.runBottom, ['7', '5']);
      assert.strictEqual(snapshot.sourceUrl, 'https://laospathana.com/');
    }
  },
  {
    name: 'laos redcross mapping',
    feedCodes: ['lao_redcross'],
    row: laosRedcrossFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-13');
      assert.strictEqual(snapshot.firstPrize, '30254');
      assert.strictEqual(snapshot.threeTop, '254');
      assert.strictEqual(snapshot.twoTop, '54');
      assert.strictEqual(snapshot.twoBottom, '30');
      assert.deepStrictEqual(snapshot.runTop, ['2', '5', '4']);
      assert.deepStrictEqual(snapshot.runBottom, ['3', '0']);
      assert.strictEqual(snapshot.sourceUrl, 'https://api.lao-redcross.com/result');
    }
  },
  {
    name: 'laos tv mapping',
    feedCodes: ['lao_tv'],
    row: laosTvFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-14');
      assert.strictEqual(snapshot.firstPrize, '95927');
      assert.strictEqual(snapshot.threeTop, '927');
      assert.strictEqual(snapshot.twoTop, '27');
      assert.strictEqual(snapshot.twoBottom, '95');
      assert.deepStrictEqual(snapshot.runTop, ['9', '2', '7']);
      assert.deepStrictEqual(snapshot.runBottom, ['9', '5']);
      assert.strictEqual(snapshot.sourceUrl, 'https://lao-tv.com/');
    }
  },
  {
    name: 'laos hd mapping',
    feedCodes: ['lao_hd'],
    row: laosHdFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-14');
      assert.strictEqual(snapshot.firstPrize, '47900');
      assert.strictEqual(snapshot.threeTop, '900');
      assert.strictEqual(snapshot.twoTop, '00');
      assert.strictEqual(snapshot.twoBottom, '47');
      assert.deepStrictEqual(snapshot.runTop, ['9', '0']);
      assert.deepStrictEqual(snapshot.runBottom, ['4', '7']);
      assert.strictEqual(snapshot.sourceUrl, 'https://laoshd.com/');
    }
  },
  {
    name: 'laos extra mapping',
    feedCodes: ['lao_extra'],
    row: laosExtraFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-14');
      assert.strictEqual(snapshot.firstPrize, '17323');
      assert.strictEqual(snapshot.threeTop, '323');
      assert.strictEqual(snapshot.twoTop, '23');
      assert.strictEqual(snapshot.twoBottom, '17');
      assert.deepStrictEqual(snapshot.runTop, ['3', '2']);
      assert.deepStrictEqual(snapshot.runBottom, ['1', '7']);
      assert.strictEqual(snapshot.sourceUrl, 'https://laoextra.com/');
    }
  },
  {
    name: 'laos stars mapping',
    feedCodes: ['lao_star'],
    row: laosStarFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-14');
      assert.strictEqual(snapshot.firstPrize, '50262');
      assert.strictEqual(snapshot.threeTop, '262');
      assert.strictEqual(snapshot.twoTop, '62');
      assert.strictEqual(snapshot.twoBottom, '50');
      assert.deepStrictEqual(snapshot.runTop, ['2', '6']);
      assert.deepStrictEqual(snapshot.runBottom, ['5', '0']);
      assert.strictEqual(snapshot.sourceUrl, 'https://laostars.com/');
    }
  },
  {
    name: 'laos stars vip mapping',
    feedCodes: ['lao_star_vip'],
    row: laosStarVipFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-14');
      assert.strictEqual(snapshot.firstPrize, '37402');
      assert.strictEqual(snapshot.threeTop, '402');
      assert.strictEqual(snapshot.twoTop, '02');
      assert.strictEqual(snapshot.twoBottom, '37');
      assert.deepStrictEqual(snapshot.runTop, ['4', '0', '2']);
      assert.deepStrictEqual(snapshot.runBottom, ['3', '7']);
      assert.strictEqual(snapshot.sourceUrl, 'https://laostars-vip.com/');
    }
  },
  {
    name: 'laos union mapping',
    feedCodes: ['lao_union'],
    row: laosUnionFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-14');
      assert.strictEqual(snapshot.firstPrize, '96581');
      assert.strictEqual(snapshot.threeTop, '581');
      assert.strictEqual(snapshot.twoTop, '81');
      assert.strictEqual(snapshot.twoBottom, '96');
      assert.deepStrictEqual(snapshot.runTop, ['5', '8', '1']);
      assert.deepStrictEqual(snapshot.runBottom, ['9', '6']);
      assert.strictEqual(snapshot.sourceUrl, 'https://laounion.com/');
    }
  },
  {
    name: 'laos union vip mapping',
    feedCodes: ['lao_union_vip'],
    row: laosUnionVipFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-14');
      assert.strictEqual(snapshot.firstPrize, '07011');
      assert.strictEqual(snapshot.threeTop, '011');
      assert.strictEqual(snapshot.twoTop, '11');
      assert.strictEqual(snapshot.twoBottom, '07');
      assert.deepStrictEqual(snapshot.runTop, ['0', '1']);
      assert.deepStrictEqual(snapshot.runBottom, ['0', '7']);
      assert.strictEqual(snapshot.sourceUrl, 'https://laounionvip.com/');
    }
  },
  {
    name: 'laos asean mapping',
    feedCodes: ['lao_asean'],
    row: laosAseanFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-14');
      assert.strictEqual(snapshot.firstPrize, '58063');
      assert.strictEqual(snapshot.threeTop, '063');
      assert.strictEqual(snapshot.twoTop, '63');
      assert.strictEqual(snapshot.twoBottom, '58');
      assert.deepStrictEqual(snapshot.runTop, ['0', '6', '3']);
      assert.deepStrictEqual(snapshot.runBottom, ['5', '8']);
      assert.strictEqual(snapshot.sourceUrl, 'https://lotterylaosasean.com/');
    }
  },
  {
    name: 'hanoi extra mapping',
    feedCodes: ['hanoi_extra'],
    row: hanoiExtraFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-14');
      assert.strictEqual(snapshot.firstPrize, '74817');
      assert.strictEqual(snapshot.threeTop, '817');
      assert.strictEqual(snapshot.twoTop, '17');
      assert.strictEqual(snapshot.twoBottom, '35');
      assert.deepStrictEqual(snapshot.runTop, ['8', '1', '7']);
      assert.deepStrictEqual(snapshot.runBottom, ['3', '5']);
      assert.strictEqual(snapshot.sourceUrl, 'https://xosoextra.com/');
    }
  },
  {
    name: 'hanoi star mapping',
    feedCodes: ['hanoi_star'],
    row: hanoiStarFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-15');
      assert.strictEqual(snapshot.firstPrize, '19064');
      assert.strictEqual(snapshot.threeTop, '064');
      assert.strictEqual(snapshot.twoTop, '64');
      assert.strictEqual(snapshot.twoBottom, '81');
      assert.deepStrictEqual(snapshot.runTop, ['0', '6', '4']);
      assert.deepStrictEqual(snapshot.runBottom, ['8', '1']);
      assert.strictEqual(snapshot.sourceUrl, 'https://minhngocstar.com/');
    }
  },
  {
    name: 'hanoi develop mapping',
    feedCodes: ['hanoi_develop'],
    row: hanoiDevelopFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-15');
      assert.strictEqual(snapshot.firstPrize, '59152');
      assert.strictEqual(snapshot.threeTop, '152');
      assert.strictEqual(snapshot.twoTop, '52');
      assert.strictEqual(snapshot.twoBottom, '92');
      assert.deepStrictEqual(snapshot.runTop, ['1', '5', '2']);
      assert.deepStrictEqual(snapshot.runBottom, ['9', '2']);
      assert.strictEqual(snapshot.sourceUrl, 'https://xosodevelop.com/');
    }
  },
  {
    name: 'hanoi hd mapping',
    feedCodes: ['hanoi_hd'],
    row: hanoiHdFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-15');
      assert.strictEqual(snapshot.firstPrize, '99743');
      assert.strictEqual(snapshot.threeTop, '743');
      assert.strictEqual(snapshot.twoTop, '43');
      assert.strictEqual(snapshot.twoBottom, '93');
      assert.deepStrictEqual(snapshot.runTop, ['7', '4', '3']);
      assert.deepStrictEqual(snapshot.runBottom, ['9', '3']);
      assert.strictEqual(snapshot.sourceUrl, 'https://xosohd.com/');
    }
  },
  {
    name: 'hanoi tv mapping',
    feedCodes: ['hanoi_tv'],
    row: hanoiTvFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-15');
      assert.strictEqual(snapshot.firstPrize, '29004');
      assert.strictEqual(snapshot.threeTop, '004');
      assert.strictEqual(snapshot.twoTop, '04');
      assert.strictEqual(snapshot.twoBottom, '24');
      assert.deepStrictEqual(snapshot.runTop, ['0', '4']);
      assert.deepStrictEqual(snapshot.runBottom, ['2', '4']);
      assert.strictEqual(snapshot.sourceUrl, 'https://minhngoctv.com/');
    }
  },
  {
    name: 'hanoi redcross mapping',
    feedCodes: ['hanoi_redcross'],
    row: hanoiRedcrossFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-15');
      assert.strictEqual(snapshot.firstPrize, '59209');
      assert.strictEqual(snapshot.threeTop, '209');
      assert.strictEqual(snapshot.twoTop, '09');
      assert.strictEqual(snapshot.twoBottom, '91');
      assert.deepStrictEqual(snapshot.runTop, ['2', '0', '9']);
      assert.deepStrictEqual(snapshot.runBottom, ['9', '1']);
      assert.strictEqual(snapshot.sourceUrl, 'https://xosoredcross.com/');
    }
  },
  {
    name: 'hanoi union mapping',
    feedCodes: ['hanoi_union'],
    row: hanoiUnionFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-15');
      assert.strictEqual(snapshot.firstPrize, '93930');
      assert.strictEqual(snapshot.threeTop, '930');
      assert.strictEqual(snapshot.twoTop, '30');
      assert.strictEqual(snapshot.twoBottom, '17');
      assert.deepStrictEqual(snapshot.runTop, ['9', '3', '0']);
      assert.deepStrictEqual(snapshot.runBottom, ['1', '7']);
      assert.strictEqual(snapshot.sourceUrl, 'https://xosounion.com/');
    }
  },
  {
    name: 'hanoi asean mapping',
    feedCodes: ['hanoi_asean'],
    row: hanoiAseanFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.roundCode, '2026-04-15');
      assert.strictEqual(snapshot.firstPrize, '23607');
      assert.strictEqual(snapshot.threeTop, '607');
      assert.strictEqual(snapshot.twoTop, '07');
      assert.strictEqual(snapshot.twoBottom, '75');
      assert.deepStrictEqual(snapshot.runTop, ['6', '0', '7']);
      assert.deepStrictEqual(snapshot.runBottom, ['7', '5']);
      assert.strictEqual(snapshot.sourceUrl, 'https://hanoiasean.com/');
    }
  }
];

const coveredFeedCodes = new Set(scenarios.flatMap((scenario) => scenario.feedCodes));
const configuredFeedCodes = SYNC_CONFIGS.map((item) => item.feedCode);
const mappedFeedCodes = SYNC_CONFIGS
  .filter((item) => item.provider === 'gsb' || item.provider === 'thaiglo' || item.provider === 'baacofficial' || item.provider === 'huaylao' || item.provider === 'laosvip' || item.provider === 'laosredcross' || item.provider === 'laospathana' || item.provider === 'laostv' || item.provider === 'laoshd' || item.provider === 'laoextra' || item.provider === 'laostars' || item.provider === 'laostarsvip' || item.provider === 'laosunion' || item.provider === 'laosunionvip' || item.provider === 'laosasean' || item.provider === 'hanoiextra' || item.provider === 'hanoistar' || item.provider === 'hanoidevelop' || item.provider === 'hanoihd' || item.provider === 'hanoitv' || item.provider === 'hanoiredcross' || item.provider === 'hanoiunion' || item.provider === 'hanoiasean' || EXPLICIT_FEED_MAPPINGS[item.feedCode])
  .map((item) => item.feedCode);
assert.deepStrictEqual(
  [...coveredFeedCodes].sort(),
  [...configuredFeedCodes].sort(),
  'Feed mapping fixtures must cover every configured feed code'
);
assert.deepStrictEqual(
  [...mappedFeedCodes].sort(),
  [...configuredFeedCodes].sort(),
  'Every configured feed must be covered by an explicit mapping or provider-specific parser'
);
assert.strictEqual(STRICT_FEED_MAPPING, true, 'STRICT_FEED_MAPPING should stay enabled');

const results = [];

for (const scenario of scenarios) {
  for (const feedCode of scenario.feedCodes) {
    const snapshot = buildSnapshot(findConfig(feedCode), scenario.row);
    scenario.verify(snapshot);
    results.push({
      feedCode,
      roundCode: snapshot.roundCode,
      headline: snapshot.headline
    });
  }
}

console.log(JSON.stringify({
  ok: true,
  checked: results.length,
  feedCodes: results.map((item) => item.feedCode)
}, null, 2));
