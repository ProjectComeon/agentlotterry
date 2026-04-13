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
  }
];

const coveredFeedCodes = new Set(scenarios.flatMap((scenario) => scenario.feedCodes));
const configuredFeedCodes = SYNC_CONFIGS.map((item) => item.feedCode);
const mappedFeedCodes = SYNC_CONFIGS
  .filter((item) => item.provider === 'gsb' || EXPLICIT_FEED_MAPPINGS[item.feedCode])
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
