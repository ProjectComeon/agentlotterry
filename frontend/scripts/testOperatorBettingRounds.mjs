import assert from 'node:assert/strict';
import {
  buildSelectableRounds,
  shouldFetchRoundsForLottery
} from '../src/utils/operatorBettingRounds.js';

const activeRound = { id: 'round-active', code: '2026-04-20', status: 'open' };
const historicalRounds = [
  { id: 'round-old-1', code: '2026-04-19', status: 'resulted' },
  activeRound
];

assert.deepEqual(
  buildSelectableRounds([], activeRound),
  [activeRound],
  'active round should be used as fallback until full round catalog is fetched'
);

assert.deepEqual(
  buildSelectableRounds(historicalRounds, activeRound),
  [activeRound],
  'visible rounds should be preferred when fetched catalog contains closed/resulted rows'
);

assert.equal(
  shouldFetchRoundsForLottery({ lotteryId: 'lottery-1', hasActiveRound: true }),
  false,
  'markets with an active round should not fetch full rounds eagerly'
);

assert.equal(
  shouldFetchRoundsForLottery({ lotteryId: 'lottery-1', hasActiveRound: true, requiresHistoricalRounds: true }),
  true,
  'historical round interactions should trigger lazy round fetch'
);

assert.equal(
  shouldFetchRoundsForLottery({ lotteryId: 'lottery-1', hasActiveRound: false }),
  true,
  'markets without an active round still need full round fetches'
);

assert.equal(
  shouldFetchRoundsForLottery({
    lotteryId: 'lottery-1',
    loadedLotteryId: 'lottery-1',
    loadedRounds: historicalRounds,
    hasActiveRound: true,
    requiresHistoricalRounds: true
  }),
  false,
  'already loaded round catalogs should not refetch for the same market'
);

console.log('testOperatorBettingRounds passed');
