/**
 * Chromium Search Keyword Blocker
 * core/normalizer.js
 * 
 * Normalizes search queries and keyword strings into canonical format.
 * Follows PRD specifications:
 * 1. Recursive URL Decode (handling +, %20, hex sequences like %76%70%6E)
 * 2. Unicode normalization (NFKC)
 * 3. Lowercase
 * 4. Normalize multiple spaces to single space
 * 5. Trim leading and trailing whitespace
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Normalizer = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function safeUrlDecode(input) {
    if (typeof input !== 'string') return '';
    
    // Replace '+' with space (standard application/x-www-form-urlencoded)
    let decoded = input.replace(/\+/g, ' ');

    // Perform iterative decoding up to 3 passes to handle nested percent-encoding (e.g. %2520 -> %20 -> space)
    let previous = decoded;
    for (let i = 0; i < 3; i++) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch (e) {
        // If malformed URI sequence, keep current decoded state
        break;
      }
      if (decoded === previous) break;
      previous = decoded;
    }

    return decoded;
  }

  function normalize(input) {
    if (input === null || input === undefined) return '';
    let str = String(input);

    // 1. Decode URL and query parameters
    str = safeUrlDecode(str);

    // 2. Unicode Normalization (NFKC - Normalization Form Compatibility Composition)
    if (typeof str.normalize === 'function') {
      str = str.normalize('NFKC');
    }

    // 3. Lowercase
    str = str.toLowerCase();

    // 4. Collapse all whitespace types (tabs, newlines, non-breaking spaces) into a single space
    str = str.replace(/[\s\uFEFF\xA0]+/g, ' ');

    // 5. Trim leading and trailing whitespace
    str = str.trim();

    return str;
  }

  return {
    normalize: normalize,
    safeUrlDecode: safeUrlDecode
  };
}));
