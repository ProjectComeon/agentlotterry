const assert = require('assert');

const {
  HANOI_STAR_SITE_URL,
  HANOI_STAR_HISTORY_URL,
  HANOI_STAR_SIAMGLO_URL,
  __test
} = require('../services/hanoiStarResultService');

(async () => {
  const snapshot = __test.buildSnapshot({
    roundCode: '2026-04-18T17:00:00.000Z',
    drawTime: '12:30',
    firstPrize: '49821',
    twoBottom: '05',
    sourceUrl: 'https://exphuay.com/result/minhngocstar'
  });

  assert(snapshot, 'Expected Hanoi Star snapshot to be built from Exphuay payload');
  assert.strictEqual(snapshot.roundCode, '2026-04-19');
  assert.strictEqual(snapshot.headline, '821');
  assert.strictEqual(snapshot.threeTop, '821');
  assert.strictEqual(snapshot.twoTop, '21');
  assert.strictEqual(snapshot.twoBottom, '05');
  assert.strictEqual(snapshot.rawPayload.lottosDate, '2026-04-18T17:00:00.000Z');
  assert.strictEqual(snapshot.resultPublishedAt.toISOString(), '2026-04-19T05:30:00.000Z');

  const fallbackSnapshot = __test.buildSnapshot({
    roundCode: '2026-04-24T17:00:00.000Z',
    drawTime: '12:30',
    firstPrize: '96337',
    twoBottom: '43',
    sourceUrl: HANOI_STAR_HISTORY_URL
  });
  const attemptedUrls = [];
  const fetchedSnapshots = await __test.fetchHanoiStarSnapshotsWithFetcher({
    limit: 1,
    fetcher: async (url) => {
      attemptedUrls.push(url);
      if (url === HANOI_STAR_SITE_URL) {
        const error = new Error('Request failed with status code 403');
        error.response = { status: 403 };
        throw error;
      }
      return [fallbackSnapshot];
    }
  });

  assert.deepStrictEqual(attemptedUrls, [HANOI_STAR_SITE_URL, HANOI_STAR_HISTORY_URL]);
  assert.strictEqual(fetchedSnapshots.length, 1);
  assert.strictEqual(fetchedSnapshots[0].roundCode, '2026-04-25');
  assert.strictEqual(fetchedSnapshots[0].headline, '337');
  assert.strictEqual(fetchedSnapshots[0].twoBottom, '43');

  assert.strictEqual(__test.parseThaiRoundDate('26 เม.ย. 2569'), '2026-04-26');

  const siamgloHtml = `
    <tr data-month="2026-04">
      <td>1</td>
      <td><span class="text-white fw-bold">26 เม.ย. 2569</span></td>
      <td><span class="num-3">029</span></td>
      <td><span class="num-2">78</span></td>
      <td><span class="num-full">41029</span></td>
    </tr>
  `;
  const siamgloExtracted = __test.extractSiamgloSnapshotsFromHtml(
    siamgloHtml,
    HANOI_STAR_SIAMGLO_URL,
    1
  );
  assert.strictEqual(siamgloExtracted.length, 1);
  assert.strictEqual(siamgloExtracted[0].roundCode, '2026-04-26');
  assert.strictEqual(siamgloExtracted[0].headline, '029');
  assert.strictEqual(siamgloExtracted[0].twoTop, '29');
  assert.strictEqual(siamgloExtracted[0].twoBottom, '78');

  const allBlockedUrls = [];
  const siamgloFallbackSnapshots = await __test.fetchHanoiStarSnapshotsWithFetcher({
    limit: 1,
    fetcher: async (url) => {
      allBlockedUrls.push(url);
      const error = new Error('Request failed with status code 403');
      error.response = { status: 403 };
      throw error;
    },
    siamgloFetcher: async (url) => {
      allBlockedUrls.push(url);
      return siamgloExtracted;
    }
  });
  assert.deepStrictEqual(allBlockedUrls, [
    HANOI_STAR_SITE_URL,
    HANOI_STAR_HISTORY_URL,
    HANOI_STAR_SIAMGLO_URL
  ]);
  assert.strictEqual(siamgloFallbackSnapshots.length, 1);
  assert.strictEqual(siamgloFallbackSnapshots[0].roundCode, '2026-04-26');

  console.log('Hanoi Star date normalization tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
