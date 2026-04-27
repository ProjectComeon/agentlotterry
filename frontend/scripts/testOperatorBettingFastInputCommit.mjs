import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const componentSource = readFileSync(new URL('../src/pages/shared/OperatorBetting.jsx', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

assert.ok(
  componentSource.includes('const commitFastOrderInput = () => {'),
  'operator betting should expose a fast order commit helper'
);

const commitHelper = componentSource.match(/const commitFastOrderInput = \(\) => \{[\s\S]*?\n  \};/);
assert.ok(commitHelper, 'fast order commit helper should be extractable');
assert.ok(
  commitHelper[0].includes('buildFastSourceNumbers({'),
  'fast order commit should store source numbers so reverse can be recalculated later'
);
assert.ok(
  commitHelper[0].includes('setHelperFastNumbers((current) => [...current, ...nextEntries])'),
  'fast order commit should append selected source numbers to the current batch'
);
assert.ok(
  commitHelper[0].includes("setRawInput('')"),
  'fast order commit should clear the command input'
);

assert.ok(
  componentSource.includes('const handleFastOrderInputChange = (value) => {'),
  'operator betting should parse and commit command input while typing or pasting'
);

const inputChangeHandler = componentSource.match(/const handleFastOrderInputChange = \(value\) => \{[\s\S]*?\n  \};/);
assert.ok(inputChangeHandler, 'fast order input change handler should be extractable');
assert.ok(
  inputChangeHandler[0].includes("setRawInput('')"),
  'fast order input change should clear the command input after numbers are selected'
);
assert.ok(
  inputChangeHandler[0].includes('setHelperFastNumbers((current) => [...current, ...nextEntries])'),
  'fast order input change should append selected numbers to the current batch'
);
assert.ok(
  componentSource.includes('const extractFastDiscardedTokensByDigits = (rawInput, digits) => {'),
  'operator betting should extract parser-discarded text tokens'
);
assert.ok(
  inputChangeHandler[0].includes('extractFastDiscardedTokensByDigits(nextValue, getFastFamilyConfig(fastFamily).digits)'),
  'fast order input change should collect discarded raw tokens while parsing'
);
assert.ok(
  inputChangeHandler[0].includes('setParsedFastDiscardedTokens((current) => [...current, ...nextDiscardedTokens])'),
  'fast order input change should keep discarded raw tokens visible after clearing the command input'
);
assert.ok(
  componentSource.includes('const shouldDedupeFastNumbersForPricing = () => false;'),
  'fast pricing should not dedupe duplicate numbers'
);
assert.ok(
  componentSource.includes('shouldDedupeFastNumbersForPricing(fastFamily, fastTab) ? activeFastNumbers : activeFastCandidateEntries'),
  'fast pricing should use repeated candidate entries when dedupe is disabled'
);
assert.ok(
  componentSource.includes('fromRood: fastTab === \'rood\''),
  'rood fast entries should carry a source flag for downstream display and auditing'
);
assert.ok(
  componentSource.includes('setExcludedFastNumbers([]);\n                            setReverse((value) => !value);'),
  'toggling reverse should not erase numbers already keyed into the batch'
);

assert.ok(
  componentSource.includes('operator-fast-excluded-panel'),
  'operator betting should render a dedicated excluded-number panel'
);
assert.ok(
  componentSource.includes('fastExcludedDisplayItems.length'),
  'excluded panel should render when manually excluded numbers or parser-discarded tokens exist'
);
assert.ok(
  componentSource.includes("className=\"operator-fast-excluded-chip is-raw\""),
  'parser-discarded text tokens should render as raw excluded chips'
);
assert.ok(
  componentSource.includes('const discardedTokenCountMap = useMemo('),
  'parser-discarded raw tokens should be counted for duplicate badges'
);
assert.ok(
  componentSource.includes('dedupeOrderedNumbers(visibleFastDiscardedTokens)'),
  'parser-discarded raw tokens should render once per distinct token'
);
assert.ok(
  componentSource.includes('item.repeatCount > 1 ? <span className="operator-fast-chip-count">x{item.repeatCount}</span> : null'),
  'parser-discarded raw token chips should display xN when duplicated'
);
assert.ok(
  styleSource.includes('.operator-fast-excluded-panel'),
  'excluded-number panel should have dedicated styling'
);
assert.ok(
  styleSource.includes('.operator-fast-excluded-chip.is-raw'),
  'raw excluded chips should have dedicated styling'
);
assert.ok(
  styleSource.includes('grid-template-columns: minmax(140px, 1.25fr) repeat(3, minmax(82px, 0.75fr));'),
  'mobile fast 2-digit entry row should stay in one compact horizontal row'
);
assert.ok(
  styleSource.includes('.operator-fast-entry-row::-webkit-scrollbar'),
  'mobile fast entry row should hide horizontal scrollbar chrome'
);
assert.ok(
  styleSource.includes('.operator-fast-entry-row .operator-fast-amount-card'),
  'mobile fast entry row should compact amount cards'
);
assert.match(
  styleSource,
  /@media \(max-width: 760px\)[\s\S]*\.operator-composer-panel,[\s\S]*\.operator-preview-panel \{[\s\S]*padding: 10px;/,
  'mobile operator panels should use tighter padding'
);
assert.ok(
  styleSource.includes('grid-template-columns: repeat(auto-fit, minmax(44px, 1fr));'),
  'mobile fast chips should use a denser balanced grid'
);
assert.match(
  styleSource,
  /\.operator-mode-row,[\s\S]*\.operator-bettype-row,[\s\S]*\.operator-helper-row \{[\s\S]*overflow-x: auto;/,
  'mobile operator tab rows should stay compact with horizontal overflow'
);
assert.ok(
  styleSource.includes('max-height: min(46vh, 420px);'),
  'mobile preview list should have a tighter viewport budget'
);
assert.ok(
  styleSource.includes('.operator-composer-panel input[type="number"]::-webkit-inner-spin-button'),
  'operator betting amount inputs should hide browser number spinner buttons'
);
assert.ok(
  styleSource.includes('.operator-composer-panel input[type="number"] {\n  appearance: textfield;'),
  'operator betting number inputs should use textfield appearance'
);

console.log('testOperatorBettingFastInputCommit passed');
