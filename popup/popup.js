/**
 * Chromium Search Keyword Blocker
 * popup/popup.js
 * 
 * Logic for extension popup:
 * - Real-time protection status display & toggling
 * - Password authorization modal for turning protection OFF
 * - Display active keyword counts and daily blocked metrics
 * - Session timer display
 */

(async function () {
  'use strict';

  let currentConfig = null;
  let sessionTimerInterval = null;

  // DOM Elements
  const toggleProtection = document.getElementById('toggle-protection');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const statKeywordCount = document.getElementById('stat-keyword-count');
  const statBlockedToday = document.getElementById('stat-blocked-today');
  const btnOpenOptions = document.getElementById('btn-open-options');
  const sessionBadge = document.getElementById('session-badge');
  const sessionTimer = document.getElementById('session-timer');

  // Auth Modal Elements
  const authModal = document.getElementById('auth-modal');
  const authForm = document.getElementById('auth-form');
  const authPassword = document.getElementById('auth-password');
  const authError = document.getElementById('auth-error');
  const btnCancelAuth = document.getElementById('btn-cancel-auth');

  async function loadData() {
    currentConfig = await StorageService.getConfig();
    const stats = await StorageService.getStats();

    // Update UI Elements
    updateProtectionStatusUI(currentConfig.enabled);
    statKeywordCount.textContent = (currentConfig.blockedKeywords || []).length;
    statBlockedToday.textContent = stats.blockedToday || 0;

    await updateSessionUI();
  }

  function updateProtectionStatusUI(isEnabled) {
    toggleProtection.checked = isEnabled;
    if (isEnabled) {
      statusDot.classList.add('active');
      statusText.textContent = 'Aktif';
      statusText.style.color = '#f8fafc';
    } else {
      statusDot.classList.remove('active');
      statusText.textContent = 'Nonaktif';
      statusText.style.color = '#94a3b8';
    }
  }

  async function updateSessionUI() {
    const isActive = await StorageService.isAdminSessionActive();
    if (isActive) {
      sessionBadge.classList.remove('hidden');
      startSessionCountdown();
    } else {
      sessionBadge.classList.add('hidden');
      if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    }
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function startSessionCountdown() {
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);

    async function tick() {
      const remaining = await StorageService.getAdminSessionRemainingSeconds();
      if (remaining <= 0) {
        sessionBadge.classList.add('hidden');
        clearInterval(sessionTimerInterval);
      } else {
        sessionTimer.textContent = formatTime(remaining);
      }
    }

    tick();
    sessionTimerInterval = setInterval(tick, 1000);
  }

  // Toggle protection event
  toggleProtection.addEventListener('click', async (e) => {
    const wantsToEnable = toggleProtection.checked;

    if (wantsToEnable) {
      // Enabling protection never requires password
      currentConfig.enabled = true;
      await StorageService.saveConfig(currentConfig);
      updateProtectionStatusUI(true);
    } else {
      // User is attempting to turn OFF protection
      e.preventDefault(); // Pause toggle until verified

      const isSessionActive = await StorageService.isAdminSessionActive();
      const credentials = await StorageService.getAuthCredentials();

      // If no admin password configured yet OR session is active, allow disable
      if (!credentials || !currentConfig.security.adminPasswordEnabled || isSessionActive) {
        currentConfig.enabled = false;
        await StorageService.saveConfig(currentConfig);
        updateProtectionStatusUI(false);
        return;
      }

      // Password required! Open modal
      openAuthModal();
    }
  });

  function openAuthModal() {
    authPassword.value = '';
    authError.textContent = '';
    authError.classList.add('hidden');
    authModal.classList.remove('hidden');

    checkLockoutState();
    setTimeout(() => authPassword.focus(), 50);
  }

  function closeAuthModal() {
    authModal.classList.add('hidden');
    // Ensure toggle stays checked since disable was cancelled
    updateProtectionStatusUI(currentConfig.enabled);
  }

  async function checkLockoutState() {
    const lockoutState = await StorageService.getLockoutState();
    const status = AuthEngine.checkLockout(lockoutState.failedAttempts, lockoutState.lockoutUntil);

    if (status.isLocked) {
      authError.textContent = `Terlalu banyak percobaan. Terkunci ${status.remainingSeconds} detik.`;
      authError.classList.remove('hidden');
      authPassword.disabled = true;
      document.getElementById('btn-submit-auth').disabled = true;
      return false;
    }

    authPassword.disabled = false;
    document.getElementById('btn-submit-auth').disabled = false;
    return true;
  }

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const canAttempt = await checkLockoutState();
    if (!canAttempt) return;

    const enteredPassword = authPassword.value;
    const credentials = await StorageService.getAuthCredentials();

    const isValid = await AuthEngine.verifyPassword(enteredPassword, credentials);

    if (isValid) {
      // Password correct: unlock session & disable protection
      await StorageService.unlockAdminSession(currentConfig.security.adminSessionMinutes || 5);
      currentConfig.enabled = false;
      await StorageService.saveConfig(currentConfig);
      updateProtectionStatusUI(false);
      await updateSessionUI();
      closeAuthModal();
    } else {
      // Password incorrect
      const lockoutState = await StorageService.getLockoutState();
      const penalty = AuthEngine.calculateFailedAttemptPenalty(lockoutState.failedAttempts);
      await StorageService.saveLockoutState(penalty);

      if (penalty.isLocked) {
        authError.textContent = `Password salah. Terkunci selama ${penalty.penaltySeconds} detik.`;
      } else {
        const remaining = (AuthEngine.MAX_FAILED_ATTEMPTS - penalty.failedAttempts);
        authError.textContent = `Password salah. Sisa kesempatan: ${remaining}`;
      }
      authError.classList.remove('hidden');
      authPassword.select();
      await checkLockoutState();
    }
  });

  btnCancelAuth.addEventListener('click', closeAuthModal);

  btnOpenOptions.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  });

  await loadData();
})();
