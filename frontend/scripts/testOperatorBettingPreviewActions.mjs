import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/shared/OperatorBetting.jsx', import.meta.url), 'utf8');

assert.equal(
  source.includes('const handleOpenPreviewDialog'),
  false,
  'operator preview panel should not keep an open-preview popup handler'
);

assert.equal(
  source.includes('previewDialogOpen && preview'),
  false,
  'operator preview panel should not render the summary popup modal'
);

assert.ok(
  source.includes('onClick={handleCopyAsImage}'),
  'preview panel header action should copy the slip image directly'
);

assert.ok(
  source.includes('onClick={handleSubmitSlip}'),
  'preview panel save action should submit directly'
);

assert.equal(
  source.includes('onClick={handleOpenPreviewDialog}'),
  false,
  'preview panel buttons should not open the summary popup'
);

const copyImageHandler = source.match(/const handleCopyAsImage = async \(\) => \{[\s\S]*?\n  \};/);
assert.ok(copyImageHandler, 'copy image handler should exist');
assert.equal(
  copyImageHandler[0].includes('handlePreview()'),
  false,
  'copy image handler should not call parse preview before rendering the image'
);

console.log('testOperatorBettingPreviewActions passed');
