/**
 * Chromium Search Keyword Blocker
 * pages/blocked.js
 * 
 * Determines whether to display a pure blank page (Mode A)
 * or an informative blocked notice (Mode B).
 */

(async function () {
  'use strict';

  try {
    const config = (typeof StorageService !== 'undefined')
      ? await StorageService.getConfig()
      : { blockingMode: 'blank' };

    const noticeEl = document.getElementById('notice-container');
    const bodyEl = document.body;

    if (config.blockingMode === 'blocked') {
      // Mode B: Blocked Warning Card
      bodyEl.classList.remove('is-blank');
      noticeEl.classList.remove('hidden');
      document.title = 'Pencarian Dibatasi';
    } else {
      // Mode A: Blank Page (Default)
      bodyEl.classList.add('is-blank');
      noticeEl.classList.add('hidden');
      document.title = '';
    }
  } catch (err) {
    // Default fallback: remain blank
    document.body.classList.add('is-blank');
  }
})();
