/**
 * Unit Tests: core/keyword-matcher.js
 */

const assert = require('assert');
const KeywordMatcher = require('../core/keyword-matcher');

function runKeywordMatcherTests() {
  console.log('--- Testing core/keyword-matcher.js ---');

  const blacklist = [
    { keyword: 'vpn', level: 'protected' },
    { keyword: 'proxy', level: 'normal' },
    { keyword: 'tor', level: 'mandatory' }
  ];

  // AC-01: Blacklist 'vpn', Search 'vpn' -> BLOCK
  const res1 = KeywordMatcher.matchKeyword('vpn', blacklist, 'contains');
  assert.strictEqual(res1.matched, true, 'AC-01: vpn must be blocked');
  assert.strictEqual(res1.matchedKeyword, 'vpn');
  assert.strictEqual(res1.level, 'protected');

  // AC-02: Search 'VPN' -> BLOCK
  const res2 = KeywordMatcher.matchKeyword('VPN', blacklist, 'contains');
  assert.strictEqual(res2.matched, true, 'AC-02: Uppercase VPN must be blocked');

  // AC-03: Search 'best vpn' -> BLOCK
  const res3 = KeywordMatcher.matchKeyword('best vpn', blacklist, 'contains');
  assert.strictEqual(res3.matched, true, 'AC-03: best vpn must be blocked');

  // AC-04: Search 'download VPN windows' -> BLOCK
  const res4 = KeywordMatcher.matchKeyword('download VPN windows', blacklist, 'contains');
  assert.strictEqual(res4.matched, true, 'AC-04: download VPN windows must be blocked');

  // AC-05: Search 'windows networking' -> ALLOW
  const res5 = KeywordMatcher.matchKeyword('windows networking', blacklist, 'contains');
  assert.strictEqual(res5.matched, false, 'AC-05: windows networking must be allowed');

  // Test Exact match mode
  const resExact1 = KeywordMatcher.matchKeyword('vpn', blacklist, 'exact');
  assert.strictEqual(resExact1.matched, true, 'Exact mode: vpn matches vpn');

  const resExact2 = KeywordMatcher.matchKeyword('best vpn', blacklist, 'exact');
  assert.strictEqual(resExact2.matched, false, 'Exact mode: best vpn does not match vpn');

  // Test Word Boundary match mode
  const resWb1 = KeywordMatcher.matchKeyword('best vpn 2026', blacklist, 'word_boundary');
  assert.strictEqual(resWb1.matched, true, 'Word boundary: vpn as word matches');

  const resWb2 = KeywordMatcher.matchKeyword('evpntest', blacklist, 'word_boundary');
  assert.strictEqual(resWb2.matched, false, 'Word boundary: evpntest should not match standalone vpn');

  // Test strings array instead of objects
  const simpleBlacklist = ['vpn', 'proxy'];
  const resSimple = KeywordMatcher.matchKeyword('free vpn', simpleBlacklist, 'contains');
  assert.strictEqual(resSimple.matched, true, 'Simple strings array works');

  console.log('✓ KeywordMatcher tests passed successfully.');
}

if (require.main === module) {
  runKeywordMatcherTests();
}

module.exports = runKeywordMatcherTests;
