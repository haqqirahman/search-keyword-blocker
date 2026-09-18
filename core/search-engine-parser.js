/**
 * Chromium Search Keyword Blocker
 * core/search-engine-parser.js
 * 
 * Modular parser for search engine URLs and query extraction.
 * Supports: Google, Google Indonesia, Bing, Brave Search, DuckDuckGo, Yahoo.
 * Includes loop protection (chrome-extension://) and non-search page filtering.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SearchEngineParser = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SEARCH_ENGINES = {
    google: {
      id: 'google',
      name: 'Google',
      // Matches google.com, google.co.id, www.google.com, etc.
      hostRegex: /^(?:.*\.)?google\.(?:com|co\.[a-z]{2}|[a-z]{2,3})$/i,
      pathRegex: /^\/(?:search|webhp|imghp|images)?$/i,
      queryParameters: ['q', 'as_q', 'oq']
    },
    bing: {
      id: 'bing',
      name: 'Bing',
      hostRegex: /^(?:.*\.)?bing\.com$/i,
      pathRegex: /^\/(?:search|images\/search|videos\/search|news\/search|shop\/search)?$/i,
      queryParameters: ['q', 'pq']
    },
    brave: {
      id: 'brave',
      name: 'Brave Search',
      hostRegex: /^search\.brave\.com$/i,
      pathRegex: /^\/(?:search|images|videos|news)?$/i,
      queryParameters: ['q']
    },
    duckduckgo: {
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      hostRegex: /^(?:.*\.)?duckduckgo\.com$/i,
      pathRegex: /^\/(?:html\/|lite\/)?$/i,
      queryParameters: ['q']
    },
    yahoo: {
      id: 'yahoo',
      name: 'Yahoo',
      hostRegex: /^(?:.*\.)?search\.yahoo\.com$/i,
      pathRegex: /^\/(?:search|yhs\/search)?$/i,
      queryParameters: ['p']
    }
  };

  /**
   * Identifies which search engine matches the provided URL object or string.
   */
  function identifyEngine(urlObj) {
    const hostname = urlObj.hostname.toLowerCase();
    for (const key of Object.keys(SEARCH_ENGINES)) {
      const engine = SEARCH_ENGINES[key];
      if (engine.hostRegex.test(hostname)) {
        return engine;
      }
    }
    return null;
  }

  /**
   * Extracts the query from a given URL.
   * Returns:
   * {
   *   engine: 'google' | 'bing' | 'brave' | 'duckduckgo' | 'yahoo',
   *   query: string,
   *   url: string
   * } or null if not a search query page.
   */
  function parseSearchUrl(rawUrl, enabledEngines) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;

    // 1. Loop Protection: Ignore internal extension pages
    if (rawUrl.startsWith('chrome-extension://') || 
        rawUrl.startsWith('chrome://') || 
        rawUrl.startsWith('about:') || 
        rawUrl.startsWith('edge://') || 
        rawUrl.startsWith('brave://')) {
      return null;
    }

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch (e) {
      return null;
    }

    // Only inspect http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    const engine = identifyEngine(parsed);
    if (!engine) return null;

    // If enabledEngines filter is provided, verify this engine is turned on
    if (enabledEngines && typeof enabledEngines === 'object') {
      if (enabledEngines[engine.id] === false) {
        return null;
      }
    }

    // Path check: DuckDuckGo root '/' can have ?q=, Google has /search or /?q=
    // Check query parameters
    const searchParams = parsed.searchParams;
    let extractedQuery = null;

    for (const paramName of engine.queryParameters) {
      if (searchParams.has(paramName)) {
        const val = searchParams.get(paramName);
        if (val && val.trim().length > 0) {
          extractedQuery = val;
          break;
        }
      }
    }

    // Edge-case: URL hash based queries (e.g., older or instant search patterns #q=...)
    if (!extractedQuery && parsed.hash && parsed.hash.length > 1) {
      try {
        const hashParams = new URLSearchParams(parsed.hash.substring(1));
        for (const paramName of engine.queryParameters) {
          if (hashParams.has(paramName)) {
            const val = hashParams.get(paramName);
            if (val && val.trim().length > 0) {
              extractedQuery = val;
              break;
            }
          }
        }
      } catch (e) {
        // Ignore hash parse errors
      }
    }

    if (!extractedQuery) {
      return null;
    }

    return {
      engine: engine.id,
      engineName: engine.name,
      query: extractedQuery,
      url: rawUrl
    };
  }

  return {
    SEARCH_ENGINES: SEARCH_ENGINES,
    identifyEngine: identifyEngine,
    parseSearchUrl: parseSearchUrl
  };
}));
