/**
 * Chromium Search Keyword Blocker
 * core/keyword-matcher.js
 * 
 * Implements keyword matching strategies:
 * - 'contains' (default)
 * - 'exact'
 * - 'word_boundary'
 * 
 * Supports both string keywords and keyword objects with protection levels:
 * - Level 1: 'normal'
 * - Level 2: 'protected'
 * - Level 3: 'mandatory'
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const Normalizer = require('./normalizer');
    module.exports = factory(Normalizer);
  } else {
    root.KeywordMatcher = factory(root.Normalizer);
  }
}(typeof self !== 'undefined' ? self : this, function (Normalizer) {
  'use strict';

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Evaluates if a query matches any blocked keyword.
   * 
   * @param {string} rawQuery - The search query to test
   * @param {Array<string|Object>} keywords - List of keywords or keyword objects
   * @param {string} [matchMode='contains'] - 'contains' | 'exact' | 'word_boundary'
   * @returns {Object} { matched: boolean, matchedKeyword: string|null, level: string|null, mode: string, canonicalQuery: string }
   */
  function matchKeyword(rawQuery, keywords, matchMode) {
    const mode = matchMode || 'contains';
    const canonicalQuery = Normalizer ? Normalizer.normalize(rawQuery) : String(rawQuery).toLowerCase().trim();

    if (!canonicalQuery || !Array.isArray(keywords) || keywords.length === 0) {
      return {
        matched: false,
        matchedKeyword: null,
        level: null,
        mode: mode,
        canonicalQuery: canonicalQuery
      };
    }

    for (const item of keywords) {
      if (!item) continue;

      let kwRaw = '';
      let kwLevel = 'normal';

      if (typeof item === 'string') {
        kwRaw = item;
      } else if (typeof item === 'object') {
        kwRaw = item.keyword || '';
        kwLevel = item.level || 'normal';
      }

      const canonicalKeyword = Normalizer ? Normalizer.normalize(kwRaw) : String(kwRaw).toLowerCase().trim();
      if (!canonicalKeyword) continue;

      let isMatch = false;

      if (mode === 'exact') {
        // Exact match
        isMatch = (canonicalQuery === canonicalKeyword);
      } else if (mode === 'word_boundary') {
        // Word boundary match: keyword must match as a discrete word or phrase surrounded by word boundaries or whitespace
        const escaped = escapeRegex(canonicalKeyword);
        const regex = new RegExp('(?:^|\\s|[.,!?;:()[\\]{}"]|^)' + escaped + '(?:$|\\s|[.,!?;:()[\\]{}"]|$)', 'i');
        isMatch = regex.test(canonicalQuery);
      } else {
        // Default: 'contains'
        isMatch = canonicalQuery.includes(canonicalKeyword);
      }

      if (isMatch) {
        return {
          matched: true,
          matchedKeyword: canonicalKeyword,
          rawKeyword: kwRaw,
          level: kwLevel,
          mode: mode,
          canonicalQuery: canonicalQuery
        };
      }
    }

    return {
      matched: false,
      matchedKeyword: null,
      level: null,
      mode: mode,
      canonicalQuery: canonicalQuery
    };
  }

  return {
    matchKeyword: matchKeyword
  };
}));
