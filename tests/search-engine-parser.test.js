/**
 * Unit Tests: core/search-engine-parser.js
 */

const assert = require('assert');
const SearchEngineParser = require('../core/search-engine-parser');

function runSearchEngineParserTests() {
  console.log('--- Testing core/search-engine-parser.js ---');

  // AC-06: Google & Google Indonesia
  const g1 = SearchEngineParser.parseSearchUrl('https://www.google.com/search?q=vpn');
  assert.notStrictEqual(g1, null, 'Google search must be detected');
  assert.strictEqual(g1.engine, 'google');
  assert.strictEqual(g1.query, 'vpn');

  const gId = SearchEngineParser.parseSearchUrl('https://www.google.co.id/search?q=best+vpn+2026');
  assert.notStrictEqual(gId, null, 'Google Indonesia search must be detected');
  assert.strictEqual(gId.engine, 'google');
  assert.strictEqual(gId.query, 'best vpn 2026');

  // Google Images / Tabs (PRD Section 26)
  const gImg = SearchEngineParser.parseSearchUrl('https://www.google.com/search?q=vpn&tbm=isch');
  assert.notStrictEqual(gImg, null);
  assert.strictEqual(gImg.query, 'vpn');

  // AC-07: Brave Search
  const brave = SearchEngineParser.parseSearchUrl('https://search.brave.com/search?q=free+vpn');
  assert.notStrictEqual(brave, null, 'Brave search must be detected');
  assert.strictEqual(brave.engine, 'brave');
  assert.strictEqual(brave.query, 'free vpn');

  // AC-08: Bing
  const bing = SearchEngineParser.parseSearchUrl('https://www.bing.com/search?q=tor+browser');
  assert.notStrictEqual(bing, null, 'Bing search must be detected');
  assert.strictEqual(bing.engine, 'bing');
  assert.strictEqual(bing.query, 'tor browser');

  // AC-09: DuckDuckGo
  const ddg = SearchEngineParser.parseSearchUrl('https://duckduckgo.com/?q=proxy+server');
  assert.notStrictEqual(ddg, null, 'DuckDuckGo search must be detected');
  assert.strictEqual(ddg.engine, 'duckduckgo');
  assert.strictEqual(ddg.query, 'proxy server');

  // Yahoo Search (PRD Section 4: parameter 'p')
  const yahoo = SearchEngineParser.parseSearchUrl('https://search.yahoo.com/search?p=download+vpn');
  assert.notStrictEqual(yahoo, null, 'Yahoo search must be detected');
  assert.strictEqual(yahoo.engine, 'yahoo');
  assert.strictEqual(yahoo.query, 'download vpn');

  // PRD Section 29: Loop Protection (chrome-extension://)
  const extLoop = SearchEngineParser.parseSearchUrl('chrome-extension://abcdefghijk/pages/blocked.html?q=vpn');
  assert.strictEqual(extLoop, null, 'chrome-extension protocol must be ignored to prevent redirect loops');

  // Non-search URLs (homepage without query)
  const homeGoogle = SearchEngineParser.parseSearchUrl('https://www.google.com/');
  assert.strictEqual(homeGoogle, null, 'Google homepage without query is not search');

  const homeBrave = SearchEngineParser.parseSearchUrl('https://search.brave.com/');
  assert.strictEqual(homeBrave, null, 'Brave homepage without query is not search');

  // Disabled engine toggle test
  const disabledFilters = { google: false, bing: true, brave: true, duckduckgo: true, yahoo: true };
  const gDisabled = SearchEngineParser.parseSearchUrl('https://www.google.com/search?q=vpn', disabledFilters);
  assert.strictEqual(gDisabled, null, 'Disabled engine should be ignored');

  console.log('✓ SearchEngineParser tests passed successfully.');
}

if (require.main === module) {
  runSearchEngineParserTests();
}

module.exports = runSearchEngineParserTests;
