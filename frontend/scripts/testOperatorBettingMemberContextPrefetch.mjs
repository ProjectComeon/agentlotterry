import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'frontend');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const source = read('src/pages/shared/OperatorBetting.jsx');
const apiSource = read('src/services/api.js');

[
  'MEMBER_CONTEXT_PREFETCH_LIMIT',
  'MEMBER_CONTEXT_PREFETCH_STAGGER_MS',
  'MEMBER_CONTEXT_WARM_MARK_TTL_MS',
  'warmedMemberContextIdsRef',
  'memberContextRequestRef',
  'prefetchMemberContext',
  'sortedSearchResults',
  'onMouseEnter={() => prefetchMemberContext(member.id)}',
  'onFocus={() => prefetchMemberContext(member.id)}',
  'onTouchStart={() => prefetchMemberContext(member.id)}'
].forEach((token) => {
  assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `OperatorBetting should include ${token}`);
});

assert.match(
  source,
  /sortedSearchResults[\s\S]*slice\(0, MEMBER_CONTEXT_PREFETCH_LIMIT\)[\s\S]*prefetchMemberContext\(member\.id\)/,
  'member search results should prefetch top member contexts'
);
assert.match(
  source,
  /copy\.getContext\(memberId\)\.catch/,
  'member context prefetch should reuse cached context API and swallow warm-up failures'
);
assert.match(
  source,
  /memberContextRequestRef\.current !== requestId/,
  'member context loads should ignore stale responses'
);

const adminContextBlock = apiSource.match(/export const getAdminBettingMemberContext[\s\S]*?\}\);/)?.[0] || '';
const agentContextBlock = apiSource.match(/export const getAgentBettingMemberContext[\s\S]*?\}\);/)?.[0] || '';

assert.match(adminContextBlock, /READ_TTL_MEDIUM_MS/, 'admin member context cache should stay warm long enough for selection');
assert.match(agentContextBlock, /READ_TTL_MEDIUM_MS/, 'agent member context cache should stay warm long enough for selection');

console.log('testOperatorBettingMemberContextPrefetch: ok');
