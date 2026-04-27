import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const operatorSource = readFileSync(new URL('../src/pages/shared/OperatorBetting.jsx', import.meta.url), 'utf8');
const groupedSummarySource = readFileSync(new URL('../src/components/GroupedSlipSummary.jsx', import.meta.url), 'utf8');

assert.equal(
  operatorSource.includes('const fastDraftGroups = useMemo('),
  false,
  'operator betting should not build unused fast slip groups on every render'
);

assert.equal(
  operatorSource.includes('const gridDraftGroups = useMemo('),
  false,
  'operator betting should not build unused grid slip groups on every render'
);

assert.ok(
  operatorSource.includes('const activeFastNumberSet = useMemo(() => new Set(activeFastNumbers), [activeFastNumbers]);'),
  'operator betting should use a Set for fast chip active lookups'
);

assert.ok(
  operatorSource.includes('activeFastNumberSet.has(number)'),
  'fast chip rendering should avoid per-chip Array.includes scans'
);

assert.ok(
  operatorSource.includes("import { useDeferredValue } from 'react';") ||
    operatorSource.includes("import { startTransition, useDeferredValue } from 'react';") ||
    operatorSource.includes('import { useDeferredValue, useEffect, useMemo, useRef, useState } from \'react\';'),
  'operator betting should use deferred rendering for non-urgent preview work'
);

assert.ok(
  operatorSource.includes('const deferredCombinedDraftItems = useDeferredValue(combinedDraftItems);'),
  'operator betting should defer heavy preview grouping from the keying path'
);

assert.ok(
  operatorSource.includes('buildSlipDisplayGroups(deferredCombinedDraftItems)'),
  'operator betting should build preview groups from deferred draft items'
);

assert.ok(
  groupedSummarySource.includes('const slipItems = slip?.items || [];'),
  'grouped slip summary should extract stable item dependencies'
);

assert.ok(
  groupedSummarySource.includes('const slipDisplayGroups = slip?.displayGroups || [];'),
  'grouped slip summary should extract stable display group dependencies'
);

assert.ok(
  groupedSummarySource.includes('const baseGroups = slipDisplayGroups.length ? slipDisplayGroups : buildSlipDisplayGroups(slipItems);'),
  'grouped slip summary should prefer precomputed display groups over regrouping items'
);

assert.equal(
  groupedSummarySource.includes('}, [slip]);'),
  false,
  'grouped slip summary memoization should not depend on the inline slip object identity'
);

console.log('testOperatorBettingRenderPerformance passed');
