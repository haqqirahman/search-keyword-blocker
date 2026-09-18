/**
 * Test Runner: Chromium Search Keyword Blocker
 * Executes all unit test suites.
 */

const runNormalizerTests = require('./normalizer.test');
const runKeywordMatcherTests = require('./keyword-matcher.test');
const runSearchEngineParserTests = require('./search-engine-parser.test');
const runAuthTests = require('./auth.test');

async function main() {
  console.log('====================================================');
  console.log('  RUNNING TESTS: CHROMIUM SEARCH KEYWORD BLOCKER   ');
  console.log('====================================================\n');

  try {
    runNormalizerTests();
    console.log('');
    runKeywordMatcherTests();
    console.log('');
    runSearchEngineParserTests();
    console.log('');
    await runAuthTests();
    console.log('\n====================================================');
    console.log('  ALL ACCEPTANCE TESTS (AC-01 TO AC-16) PASSED! ✓  ');
    console.log('====================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error);
    process.exit(1);
  }
}

main();
