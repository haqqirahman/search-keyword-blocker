/**
 * Chromium Search Keyword Blocker
 * storage/storage.js
 * 
 * Abstraction layer over chrome.storage.local and chrome.storage.session.
 * Provides unified access, default initial state, sanitized export/import,
 * session lifecycle management, and privacy-friendly block counters.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StorageService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEYS = {
    CONFIG: 'skb_config',
    AUTH: 'skb_auth',
    LOCKOUT: 'skb_lockout',
    STATS: 'skb_stats',
    SESSION: 'skb_session'
  };

  const DEFAULT_CONFIG = {
    enabled: true,
    blockingMode: 'blank', // 'blank' | 'blocked'
    matchMode: 'contains', // 'contains' | 'exact' | 'word_boundary'
    blockedKeywords: [
      {
        keyword: 'vpn',
        level: 'protected', // 'normal' | 'protected' | 'mandatory'
        createdAt: Date.now()
      }
    ],
    searchEngines: {
      google: true,
      bing: true,
      brave: true,
      duckduckgo: true,
      yahoo: true
    },
    security: {
      adminPasswordEnabled: false,
      adminSessionMinutes: 5,
      maxFailedAttempts: 5
    }
  };

  const DEFAULT_STATS = {
    blockedCount: 0,
    blockedToday: 0,
    lastDate: new Date().toISOString().slice(0, 10)
  };

  // In-memory fallback if chrome.storage is unavailable (e.g. Node tests)
  const memoryLocal = {};
  const memorySession = {};

  function isChromeStorageAvailable() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  function isChromeSessionStorageAvailable() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session;
  }

  // --- Generic Local Storage Get / Set ---
  function getLocal(key) {
    return new Promise((resolve) => {
      if (isChromeStorageAvailable()) {
        chrome.storage.local.get([key], (result) => {
          resolve(result ? result[key] : null);
        });
      } else {
        resolve(memoryLocal[key] || null);
      }
    });
  }

  function setLocal(key, value) {
    return new Promise((resolve) => {
      if (isChromeStorageAvailable()) {
        chrome.storage.local.set({ [key]: value }, () => {
          resolve();
        });
      } else {
        memoryLocal[key] = value;
        resolve();
      }
    });
  }

  // --- Generic Session Storage Get / Set ---
  function getSession(key) {
    return new Promise((resolve) => {
      if (isChromeSessionStorageAvailable()) {
        chrome.storage.session.get([key], (result) => {
          resolve(result ? result[key] : null);
        });
      } else {
        resolve(memorySession[key] || null);
      }
    });
  }

  function setSession(key, value) {
    return new Promise((resolve) => {
      if (isChromeSessionStorageAvailable()) {
        chrome.storage.session.set({ [key]: value }, () => {
          resolve();
        });
      } else {
        memorySession[key] = value;
        resolve();
      }
    });
  }

  function removeSession(key) {
    return new Promise((resolve) => {
      if (isChromeSessionStorageAvailable()) {
        chrome.storage.session.remove([key], () => {
          resolve();
        });
      } else {
        delete memorySession[key];
        resolve();
      }
    });
  }

  // --- High Level Methods ---

  /**
   * Retrieves active extension configuration, merging with defaults if missing.
   */
  async function getConfig() {
    const stored = await getLocal(STORAGE_KEYS.CONFIG);
    if (!stored) {
      // Save initial defaults
      await setLocal(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
      return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
    // Deep merge defaults to ensure newly added keys are present
    return Object.assign({}, DEFAULT_CONFIG, stored);
  }

  /**
   * Saves updated configuration.
   */
  async function saveConfig(newConfig) {
    await setLocal(STORAGE_KEYS.CONFIG, newConfig);
    return newConfig;
  }

  /**
   * Retrieves stored admin credentials (salt & hash).
   */
  async function getAuthCredentials() {
    return await getLocal(STORAGE_KEYS.AUTH);
  }

  /**
   * Stores admin credentials.
   */
  async function saveAuthCredentials(credentials) {
    await setLocal(STORAGE_KEYS.AUTH, credentials);
    const config = await getConfig();
    config.security.adminPasswordEnabled = true;
    await saveConfig(config);
  }

  /**
   * Checks if an admin session is currently unlocked and not expired.
   */
  async function isAdminSessionActive() {
    const session = await getSession(STORAGE_KEYS.SESSION);
    if (!session || !session.adminUnlocked) {
      return false;
    }
    if (Date.now() > session.unlockExpiresAt) {
      await lockAdminSession();
      return false;
    }
    return true;
  }

  /**
   * Gets remaining seconds of active admin session.
   */
  async function getAdminSessionRemainingSeconds() {
    const session = await getSession(STORAGE_KEYS.SESSION);
    if (!session || !session.adminUnlocked) {
      return 0;
    }
    const remainingMs = session.unlockExpiresAt - Date.now();
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  }

  /**
   * Unlocks admin session for specified minutes.
   */
  async function unlockAdminSession(minutes) {
    const durationMinutes = minutes || 5;
    const expiresAt = Date.now() + (durationMinutes * 60 * 1000);
    const sessionData = {
      adminUnlocked: true,
      unlockExpiresAt: expiresAt
    };
    await setSession(STORAGE_KEYS.SESSION, sessionData);
    // Reset failed attempts on successful unlock
    await resetLockout();
    return sessionData;
  }

  /**
   * Locks admin session immediately.
   */
  async function lockAdminSession() {
    await removeSession(STORAGE_KEYS.SESSION);
  }

  /**
   * Gets current lockout and failed attempts data.
   */
  async function getLockoutState() {
    const stored = await getLocal(STORAGE_KEYS.LOCKOUT);
    return stored || { failedAttempts: 0, lockoutUntil: 0 };
  }

  /**
   * Saves updated lockout state.
   */
  async function saveLockoutState(state) {
    await setLocal(STORAGE_KEYS.LOCKOUT, state);
  }

  /**
   * Resets lockout counters.
   */
  async function resetLockout() {
    await setLocal(STORAGE_KEYS.LOCKOUT, { failedAttempts: 0, lockoutUntil: 0 });
  }

  /**
   * Records a blocked search event (privacy-safe: only increments counters).
   */
  async function recordBlockedSearch() {
    const today = new Date().toISOString().slice(0, 10);
    let stats = await getLocal(STORAGE_KEYS.STATS) || DEFAULT_STATS;

    if (stats.lastDate !== today) {
      stats.blockedToday = 0;
      stats.lastDate = today;
    }

    stats.blockedCount = (stats.blockedCount || 0) + 1;
    stats.blockedToday = (stats.blockedToday || 0) + 1;

    await setLocal(STORAGE_KEYS.STATS, stats);
    return stats;
  }

  /**
   * Gets privacy-safe statistics.
   */
  async function getStats() {
    const today = new Date().toISOString().slice(0, 10);
    let stats = await getLocal(STORAGE_KEYS.STATS) || DEFAULT_STATS;
    if (stats.lastDate !== today) {
      stats.blockedToday = 0;
      stats.lastDate = today;
      await setLocal(STORAGE_KEYS.STATS, stats);
    }
    return stats;
  }

  /**
   * Exports sanitized configuration (NO passwords, NO salts, NO session data).
   */
  async function exportSanitizedConfig() {
    const config = await getConfig();
    return {
      version: '1.1',
      exportedAt: new Date().toISOString(),
      enabled: config.enabled,
      blockingMode: config.blockingMode,
      matchMode: config.matchMode,
      searchEngines: config.searchEngines,
      blockedKeywords: config.blockedKeywords
    };
  }

  /**
   * Validates and imports configuration safely.
   */
  async function importConfig(importedData) {
    if (!importedData || typeof importedData !== 'object') {
      throw new Error('Invalid configuration format.');
    }

    const currentConfig = await getConfig();

    if (typeof importedData.enabled === 'boolean') {
      currentConfig.enabled = importedData.enabled;
    }
    if (['blank', 'blocked'].includes(importedData.blockingMode)) {
      currentConfig.blockingMode = importedData.blockingMode;
    }
    if (['contains', 'exact', 'word_boundary'].includes(importedData.matchMode)) {
      currentConfig.matchMode = importedData.matchMode;
    }
    if (importedData.searchEngines && typeof importedData.searchEngines === 'object') {
      currentConfig.searchEngines = Object.assign({}, currentConfig.searchEngines, importedData.searchEngines);
    }
    if (Array.isArray(importedData.blockedKeywords)) {
      // Normalize keyword objects
      const sanitizedList = [];
      const seen = new Set();
      for (const item of importedData.blockedKeywords) {
        let kw = typeof item === 'string' ? item.trim() : (item.keyword || '').trim();
        let level = (item.level && ['normal', 'protected', 'mandatory'].includes(item.level)) ? item.level : 'normal';
        if (kw && !seen.has(kw.toLowerCase())) {
          seen.add(kw.toLowerCase());
          sanitizedList.push({
            keyword: kw,
            level: level,
            createdAt: item.createdAt || Date.now()
          });
        }
      }
      currentConfig.blockedKeywords = sanitizedList;
    }

    await saveConfig(currentConfig);
    return currentConfig;
  }

  /**
   * Resets configuration to defaults.
   */
  async function resetConfig() {
    await setLocal(STORAGE_KEYS.CONFIG, JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
    await resetLockout();
    await lockAdminSession();
    return DEFAULT_CONFIG;
  }

  return {
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    getConfig: getConfig,
    saveConfig: saveConfig,
    getAuthCredentials: getAuthCredentials,
    saveAuthCredentials: saveAuthCredentials,
    isAdminSessionActive: isAdminSessionActive,
    getAdminSessionRemainingSeconds: getAdminSessionRemainingSeconds,
    unlockAdminSession: unlockAdminSession,
    lockAdminSession: lockAdminSession,
    getLockoutState: getLockoutState,
    saveLockoutState: saveLockoutState,
    resetLockout: resetLockout,
    recordBlockedSearch: recordBlockedSearch,
    getStats: getStats,
    exportSanitizedConfig: exportSanitizedConfig,
    importConfig: importConfig,
    resetConfig: resetConfig
  };
}));
