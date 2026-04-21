import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/utils/slipImage.js', import.meta.url), 'utf8');

assert.ok(
  source.includes('const SLIP_IMAGE_MAX_PIXEL_RATIO = 1.25;'),
  'slip image renderer should cap high-DPI canvas scale to keep copy-to-clipboard fast'
);

assert.equal(
  source.includes('window.devicePixelRatio > 1 ? 2 : 1'),
  false,
  'slip image renderer should not force 2x canvas rendering on high-DPI screens'
);

console.log('testSlipImagePerformanceBudget passed');
