/**
 * Chromium Search Keyword Blocker
 * content/search-filter.js
 * 
 * Runs at document_start to enforce zero-latency anti-flash protection:
 * 1. Immediately hides document element before search results paint
 * 2. Parses query from URL
 * 3. Checks blacklist
 * 4. If blocked: immediately replaces window location with blocked page
 * 5. If safe: restores visibility instantly
 * 6. Monitors client-side SPA / AJAX query changes
 */

(function () {
  'use strict';

  // 1. Immediate Anti-Flash Protection
  let antiFlashStyle = null;
  function applyAntiFlash() {
    if (document.documentElement) {
      document.documentElement.classList.add('skb-evaluating');
    }
    if (!antiFlashStyle) {
      antiFlashStyle = document.createElement('style');
      antiFlashStyle.id = 'skb-anti-flash-style';
      antiFlashStyle.textContent = 'html { visibility: hidden !important; }';
      (document.head || document.documentElement).appendChild(antiFlashStyle);
    }
  }

  function removeAntiFlash() {
    if (document.documentElement) {
      document.documentElement.classList.remove('skb-evaluating');
    }
    if (antiFlashStyle && antiFlashStyle.parentNode) {
      antiFlashStyle.parentNode.removeChild(antiFlashStyle);
      antiFlashStyle = null;
    }
    if (document.documentElement) {
      document.documentElement.style.visibility = 'visible';
    }
  }

  // Check if current URL is even a search engine before hiding page
  const currentUrl = window.location.href;
  const isCandidateSearch = (typeof SearchEngineParser !== 'undefined')
    ? SearchEngineParser.parseSearchUrl(currentUrl)
    : (currentUrl.includes('google.') || currentUrl.includes('bing.') || currentUrl.includes('brave.com') || currentUrl.includes('duckduckgo.') || currentUrl.includes('yahoo.'));

  if (isCandidateSearch) {
    applyAntiFlash();
  }

  // 2. Evaluation Logic
  function evaluateCurrentPage() {
    const url = window.location.href;

    // Send evaluation request to background service worker
    chrome.runtime.sendMessage({ action: 'evaluateQuery', url: url }, (response) => {
      if (chrome.runtime.lastError) {
        // Fallback: local evaluation via bundled modules if service worker was waking up
        fallbackLocalEvaluation(url);
        return;
      }

      if (response && response.blocked) {
        // Match found! Redirect immediately
        const blockedUrl = chrome.runtime.getURL('pages/blocked.html');
        window.location.replace(blockedUrl);
      } else {
        // Query safe
        removeAntiFlash();
      }
    });
  }

  function fallbackLocalEvaluation(url) {
    chrome.storage.local.get(['skb_config'], (result) => {
      const config = result ? result.skb_config : null;
      if (!config || !config.enabled) {
        removeAntiFlash();
        return;
      }

      if (typeof SearchEngineParser !== 'undefined' && typeof KeywordMatcher !== 'undefined') {
        const parsed = SearchEngineParser.parseSearchUrl(url, config.searchEngines);
        if (parsed && parsed.query) {
          const matchResult = KeywordMatcher.matchKeyword(parsed.query, config.blockedKeywords, config.matchMode);
          if (matchResult.matched) {
            const blockedUrl = chrome.runtime.getURL('pages/blocked.html');
            window.location.replace(blockedUrl);
            return;
          }
        }
      }

      removeAntiFlash();
    });
  }

  // Initial evaluate
  evaluateCurrentPage();

  // 3. Client-Side SPA / In-Page Search Monitoring (Google instant search / hash / pushState)
  let lastUrl = window.location.href;

  function onUrlChange() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      evaluateCurrentPage();
    }
  }

  // Listen to popstate and hashchange
  window.addEventListener('popstate', onUrlChange);
  window.addEventListener('hashchange', onUrlChange);

  // Monitor DOM URL changes or address bar updates via lightweight interval check
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      onUrlChange();
    }
  }, 150);

  // Safeguard: Ensure anti-flash doesn't keep page hidden indefinitely if network/API hangs
  setTimeout(() => {
    if (document.documentElement && document.documentElement.classList.contains('skb-evaluating')) {
      // If we're not redirected within 800ms and not blocked, reveal to avoid white screen lock
      removeAntiFlash();
    }
  }, 800);
})();
