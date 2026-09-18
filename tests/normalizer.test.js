/**
 * Unit Tests: core/normalizer.js
 */

const assert = require('assert');
const Normalizer = require('../core/normalizer');

function runNormalizerTests() {
  console.log('--- Testing core/normalizer.js ---');

  // Test 1: Basic lowercase & whitespace
  assert.strictEqual(Normalizer.normalize('  VPN  '), 'vpn');
  assert.strictEqual(Normalizer.normalize('VpN   GrAtIs'), 'vpn gratis');

  // Test 2: URL decoding with +
  assert.strictEqual(Normalizer.normalize('vpn+gratis'), 'vpn gratis');
  assert.strictEqual(Normalizer.normalize('download+vpn+windows'), 'download vpn windows');

  // Test 3: URL decoding with %20 and hex encoded chars
  assert.strictEqual(Normalizer.normalize('vpn%20gratis'), 'vpn gratis');
  assert.strictEqual(Normalizer.normalize('%76%70%6E'), 'vpn', 'Hex encoded %76%70%6E must normalize to vpn');
  assert.strictEqual(Normalizer.normalize('%56%50%4E'), 'vpn', 'Hex uppercase %56%50%4E must normalize to vpn');

  // Test 4: Nested percent-encoding
  assert.strictEqual(Normalizer.normalize('%2576%2570%256E'), 'vpn');

  // Test 5: Unicode normalization
  // Fullwidth characters 'ＶＰＮ' (U+FF36 U+FF30 U+FF2E)
  const fullwidth = '\uFF36\uFF30\uFF2E';
  assert.strictEqual(Normalizer.normalize(fullwidth), 'vpn', 'Fullwidth unicode characters must normalize to canonical vpn');

  // Test 6: Empty & null values
  assert.strictEqual(Normalizer.normalize(''), '');
  assert.strictEqual(Normalizer.normalize(null), '');
  assert.strictEqual(Normalizer.normalize(undefined), '');

  console.log('✓ Normalizer tests passed successfully.');
}

if (require.main === module) {
  runNormalizerTests();
}

module.exports = runNormalizerTests;
