import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/shared/OperatorBetting.jsx', import.meta.url), 'utf8');
const match = source.match(/const clearComposer = async \(\) => \{([\s\S]*?)\n  \};/);

assert.ok(match, 'clearComposer function should exist');

const body = match[1];

assert.equal(
  body.includes('setSavedDraftEntries'),
  false,
  'clearComposer must not clear saved draft entries shown in the preview panel'
);

assert.equal(
  body.includes('clearPersistedDraft'),
  false,
  'clearComposer must not clear the whole persisted draft scope'
);

assert.equal(
  body.includes('clearComposerFields'),
  true,
  'clearComposer should still clear the active composer fields'
);

console.log('testOperatorBettingClearComposer passed');
