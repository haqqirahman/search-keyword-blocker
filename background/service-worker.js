/**
 * Chromium Search Keyword Blocker
 * background/service-worker.js
 * 
 * Manifest V3 Service Worker:
 * - High-speed in-memory config cache (< 1ms detection)
 * - webNavigation.onBeforeNavigate listener for pre-render redirection
 * - Storage synchronization via chrome.storage.onChanged
 * - Message listener for content scripts & popup
 */

importScripts(
  '../core/normalizer.js',
  '../core/search-engine-parser.js',
  '../core/keyword-matcher.js',
  '../storage/storage.js'
);

let cachedConfig = null;

// Initialize and sync configuration cache
async function initCache() {
  try {
    cachedConfig = await StorageService.getConfig();
  } catch (err) {
    console.error('[SKB ServiceWorker] Failed to load config:', err);
    cachedConfig = StorageService.DEFAULT_CONFIG;
  }
}

initCache();

// Listen for storage changes to invalidate/update cache in real time
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes['skb_config']) {
    cachedConfig = changes['skb_config'].newValue;
  }
});

/**
 * Checks if a given URL should be blocked based on active keywords and settings.
 * Returns match object or null.
 */
function shouldBlockUrl(url) {
  if (!cachedConfig || !cachedConfig.enabled) {
    return null;
  }

  const parsed = SearchEngineParser.parseSearchUrl(url, cachedConfig.searchEngines);
  if (!parsed || !parsed.query) {
    return null;
  }

  const matchResult = KeywordMatcher.matchKeyword(
    parsed.query,
    cachedConfig.blockedKeywords,
    cachedConfig.matchMode
  );

  if (matchResult.matched) {
    return {
      parsed: parsed,
      match: matchResult
    };
  }

  return null;
}

// 1. webNavigation onBeforeNavigate: intercept at earliest navigation stage
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only process main frame navigasi (frameId === 0)
  if (details.frameId !== 0) return;

  const blockResult = shouldBlockUrl(details.url);
  if (blockResult) {
    const blockedUrl = chrome.runtime.getURL('pages/blocked.html');
    
    // Check if target is not already the blocked page (avoid redirect loops)
    if (details.url !== blockedUrl) {
      try {
        await chrome.tabs.update(details.tabId, { url: blockedUrl });
        await StorageService.recordBlockedSearch();
      } catch (e) {
        // Tab might have been closed or already redirected
      }
    }
  }
});

// 2. Messaging interface for content script fallback & UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  if (message.action === 'evaluateQuery') {
    const blockResult = shouldBlockUrl(message.url || (sender.tab ? sender.tab.url : ''));
    if (blockResult) {
      StorageService.recordBlockedSearch();
      sendResponse({ blocked: true, data: blockResult });
    } else {
      sendResponse({ blocked: false });
    }
    return true;
  }

  if (message.action === 'getConfig') {
    sendResponse({ config: cachedConfig });
    return false;
  }

  return false;
});

// Handle extension install / update
chrome.runtime.onInstalled.addListener(async () => {
  await initCache();
});
