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

const scenarios = [
  {
    name: 'government feed mapping',
    feedCodes: ['tgfc'],
    row: governmentFixture,
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
    feedCodes: ['tlzc', 'ynhn', 'ynma'],
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
    name: 'lao vip code2 mapping',
    feedCodes: ['zcvip'],
    row: fiveDigitCode2Fixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.firstPrize, '54321');
      assert.strictEqual(snapshot.threeTop, '321');
      assert.strictEqual(snapshot.twoTop, '21');
      assert.strictEqual(snapshot.twoBottom, '67');
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
    name: 'baac mapping',
    feedCodes: ['baac'],
    row: baacFixture,
    verify(snapshot) {
      assert.strictEqual(snapshot.firstPrize, '123456');
      assert.strictEqual(snapshot.threeTop, '456');
      assert.strictEqual(snapshot.twoTop, '56');
      assert.strictEqual(snapshot.twoBottom, '34');
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
  }
];

const coveredFeedCodes = new Set(scenarios.flatMap((scenario) => scenario.feedCodes));
const configuredFeedCodes = SYNC_CONFIGS.map((item) => item.feedCode);
const mappedFeedCodes = SYNC_CONFIGS
  .filter((item) => item.provider === 'gsb' || item.provider === 'laosredcross' || item.provider === 'laospathana' || item.provider === 'laostv' || item.provider === 'laoshd' || item.provider === 'laoextra' || EXPLICIT_FEED_MAPPINGS[item.feedCode])
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
