/**
 * Chromium Search Keyword Blocker
 * options/options.js
 * 
 * Complete Administrator Console logic:
 * - Keyword CRUD with protection levels (Normal, Protected, Mandatory)
 * - Password authorization gates for sensitive operations
 * - Session timeout management and progressive backoff lockout
 * - Search engine toggles, matching mode, and blocking mode settings
 * - Bulk import and sanitized JSON export
 * - Factory reset protection with typing verification
 */

(async function () {
  'use strict';

  let config = null;
  let sessionTimerInterval = null;
  let pendingAuthResolve = null;
  let pendingAuthReject = null;
  let deleteTargetIndex = null;
  let editTargetIndex = null;

  // DOM Elements
  const sessionDot = document.getElementById('session-dot');
  const sessionLabel = document.getElementById('session-label');
  const sessionClock = document.getElementById('session-clock');
  const btnSessionToggle = document.getElementById('btn-session-toggle');
  const setupBanner = document.getElementById('setup-banner');
  const btnSetupPasswordTrigger = document.getElementById('btn-setup-password-trigger');

  // Keyword Table & Add Form
  const formAddKeyword = document.getElementById('form-add-keyword');
  const inputNewKeyword = document.getElementById('input-new-keyword');
  const selectKeywordLevel = document.getElementById('select-keyword-level');
  const inputSearchFilter = document.getElementById('input-search-filter');
  const keywordTableBody = document.getElementById('keyword-table-body');
  const emptyState = document.getElementById('empty-state');
  const badgeTotalKeywords = document.getElementById('badge-total-keywords');

  // Settings
  const settingEnabled = document.getElementById('setting-enabled');
  const settingBlockingMode = document.getElementById('setting-blocking-mode');
  const settingMatchMode = document.getElementById('setting-match-mode');
  const settingSessionMinutes = document.getElementById('setting-session-minutes');
  const engineGoogle = document.getElementById('engine-google');
  const engineBrave = document.getElementById('engine-brave');
  const engineBing = document.getElementById('engine-bing');
  const engineDuckduckgo = document.getElementById('engine-duckduckgo');
  const engineYahoo = document.getElementById('engine-yahoo');

  // Action Buttons
  const btnOpenBulkImport = document.getElementById('btn-open-bulk-import');
  const btnExportConfig = document.getElementById('btn-export-config');
  const btnChangePassword = document.getElementById('btn-change-password');
  const btnResetExtension = document.getElementById('btn-reset-extension');
  const toastEl = document.getElementById('toast');

  // Modals
  const modalAuth = document.getElementById('modal-auth');
  const authReasonEl = document.getElementById('auth-reason');
  const inputAuthPassword = document.getElementById('input-auth-password');
  const modalAuthError = document.getElementById('modal-auth-error');
  const btnCancelAuthModal = document.getElementById('btn-cancel-auth-modal');
  const formVerifyAuth = document.getElementById('form-verify-auth');

  const modalSetupPassword = document.getElementById('modal-setup-password');
  const formSetupPassword = document.getElementById('form-setup-password');
  const inputSetupPassword = document.getElementById('input-setup-password');
  const inputSetupConfirm = document.getElementById('input-setup-confirm');
  const setupError = document.getElementById('setup-error');
  const btnCancelSetup = document.getElementById('btn-cancel-setup');

  const modalDeleteConfirm = document.getElementById('modal-delete-confirm');
  const deleteTargetKeyword = document.getElementById('delete-target-keyword');
  const btnCancelDelete = document.getElementById('btn-cancel-delete');
  const btnConfirmDelete = document.getElementById('btn-confirm-delete');

  const modalEditKeyword = document.getElementById('modal-edit-keyword');
  const formEditKeyword = document.getElementById('form-edit-keyword');
  const inputEditKeywordText = document.getElementById('input-edit-keyword-text');
  const selectEditKeywordLevel = document.getElementById('select-edit-keyword-level');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');

  const modalBulkImport = document.getElementById('modal-bulk-import');
  const formBulkImport = document.getElementById('form-bulk-import');
  const textareaBulkKeywords = document.getElementById('textarea-bulk-keywords');
  const selectBulkLevel = document.getElementById('select-bulk-level');
  const btnCancelBulk = document.getElementById('btn-cancel-bulk');

  const modalResetConfirm = document.getElementById('modal-reset-confirm');
  const formResetConfirm = document.getElementById('form-reset-confirm');
  const inputResetConfirmationText = document.getElementById('input-reset-confirmation-text');
  const resetError = document.getElementById('reset-error');
  const btnCancelReset = document.getElementById('btn-cancel-reset');

  // ==================== TOAST & UTILS ====================
  function showToast(message, duration = 3000) {
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    setTimeout(() => toastEl.classList.add('hidden'), duration);
  }

  function formatDate(timestamp) {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // ==================== INITIALIZATION ====================
  async function init() {
    config = await StorageService.getConfig();
    const credentials = await StorageService.getAuthCredentials();

    // Check if password setup is needed
    if (!credentials) {
      setupBanner.classList.remove('hidden');
    } else {
      setupBanner.classList.add('hidden');
    }

    renderSettingsValues();
    renderKeywordsTable();
    await updateSessionUI();
  }

  function renderSettingsValues() {
    settingEnabled.checked = config.enabled;
    settingBlockingMode.value = config.blockingMode || 'blank';
    settingMatchMode.value = config.matchMode || 'contains';
    settingSessionMinutes.value = String(config.security.adminSessionMinutes || 5);

    engineGoogle.checked = config.searchEngines.google !== false;
    engineBrave.checked = config.searchEngines.brave !== false;
    engineBing.checked = config.searchEngines.bing !== false;
    engineDuckduckgo.checked = config.searchEngines.duckduckgo !== false;
    engineYahoo.checked = config.searchEngines.yahoo !== false;
  }

  // ==================== ADMIN SESSION & AUTH GATE ====================
  async function updateSessionUI() {
    const isUnlocked = await StorageService.isAdminSessionActive();
    if (isUnlocked) {
      sessionDot.classList.add('unlocked');
      sessionLabel.textContent = 'Admin Terbuka';
      sessionClock.classList.remove('hidden');
      btnSessionToggle.textContent = 'Kunci Sesi';
      startSessionTimer();
    } else {
      sessionDot.classList.remove('unlocked');
      sessionLabel.textContent = 'Admin Terkunci';
      sessionClock.classList.add('hidden');
      btnSessionToggle.textContent = 'Buka Kunci';
      if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    }
  }

  function startSessionTimer() {
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);

    async function tick() {
      const remaining = await StorageService.getAdminSessionRemainingSeconds();
      if (remaining <= 0) {
        await updateSessionUI();
      } else {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        sessionClock.textContent = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
      }
    }

    tick();
    sessionTimerInterval = setInterval(tick, 1000);
  }

  btnSessionToggle.addEventListener('click', async () => {
    const isUnlocked = await StorageService.isAdminSessionActive();
    if (isUnlocked) {
      await StorageService.lockAdminSession();
      await updateSessionUI();
      showToast('Sesi administrator telah dikunci.');
    } else {
      const authorized = await requestAdminAuth('Buka kunci sesi administrator.');
      if (authorized) {
        showToast('Sesi administrator aktif.');
      }
    }
  });

  /**
   * Universal Admin Auth Gate:
   * Resolves immediately if session is unlocked or no admin password exists.
   * Prompts password modal otherwise.
   */
  async function requestAdminAuth(reasonDescription) {
    const credentials = await StorageService.getAuthCredentials();
    if (!credentials || !config.security.adminPasswordEnabled) {
      return true; // No password configured
    }

    const isUnlocked = await StorageService.isAdminSessionActive();
    if (isUnlocked) {
      return true;
    }

    // Check brute force lockout
    const lockoutState = await StorageService.getLockoutState();
    const status = AuthEngine.checkLockout(lockoutState.failedAttempts, lockoutState.lockoutUntil);

    return new Promise((resolve, reject) => {
      pendingAuthResolve = resolve;
      pendingAuthReject = reject;

      authReasonEl.textContent = reasonDescription || 'Masukkan password admin untuk melanjutkan.';
      inputAuthPassword.value = '';
      modalAuthError.textContent = '';
      modalAuthError.classList.add('hidden');

      if (status.isLocked) {
        modalAuthError.textContent = `Akses terkunci sementara karena terlalu banyak kegagalan. Coba lagi dalam ${status.remainingSeconds} detik.`;
        modalAuthError.classList.remove('hidden');
        inputAuthPassword.disabled = true;
        document.getElementById('btn-submit-auth-modal').disabled = true;
      } else {
        inputAuthPassword.disabled = false;
        document.getElementById('btn-submit-auth-modal').disabled = false;
      }

      modalAuth.classList.remove('hidden');
      setTimeout(() => inputAuthPassword.focus(), 60);
    });
  }

  formVerifyAuth.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = inputAuthPassword.value;
    const credentials = await StorageService.getAuthCredentials();

    const isValid = await AuthEngine.verifyPassword(password, credentials);

    if (isValid) {
      const minutes = parseInt(settingSessionMinutes.value, 10) || 5;
      await StorageService.unlockAdminSession(minutes);
      await updateSessionUI();

      modalAuth.classList.add('hidden');
      if (pendingAuthResolve) {
        pendingAuthResolve(true);
        pendingAuthResolve = null;
      }
    } else {
      const lockoutState = await StorageService.getLockoutState();
      const penalty = AuthEngine.calculateFailedAttemptPenalty(lockoutState.failedAttempts);
      await StorageService.saveLockoutState(penalty);

      if (penalty.isLocked) {
        modalAuthError.textContent = `Password salah. Terkunci selama ${penalty.penaltySeconds} detik.`;
        inputAuthPassword.disabled = true;
        document.getElementById('btn-submit-auth-modal').disabled = true;
      } else {
        const remaining = (AuthEngine.MAX_FAILED_ATTEMPTS - penalty.failedAttempts);
        modalAuthError.textContent = `Password salah. Sisa kesempatan: ${remaining}`;
      }
      modalAuthError.classList.remove('hidden');
      inputAuthPassword.select();
    }
  });

  btnCancelAuthModal.addEventListener('click', () => {
    modalAuth.classList.add('hidden');
    if (pendingAuthResolve) {
      pendingAuthResolve(false);
      pendingAuthResolve = null;
    }
  });

  // ==================== KEYWORDS TABLE & MANAGEMENT ====================
  function renderKeywordsTable() {
    const filterQuery = (inputSearchFilter.value || '').trim().toLowerCase();
    const keywords = config.blockedKeywords || [];

    keywordTableBody.innerHTML = '';
    let visibleCount = 0;

    keywords.forEach((item, index) => {
      const kw = item.keyword;
      if (filterQuery && !kw.toLowerCase().includes(filterQuery)) {
        return;
      }
      visibleCount++;

      const tr = document.createElement('tr');

      // Col 1: Keyword
      const tdKw = document.createElement('td');
      tdKw.innerHTML = `<span class="kw-badge">${escapeHtml(kw)}</span>`;
      tr.appendChild(tdKw);

      // Col 2: Level
      const tdLevel = document.createElement('td');
      let levelBadgeClass = 'level-normal';
      let levelLabel = 'Normal';
      if (item.level === 'protected') {
        levelBadgeClass = 'level-protected';
        levelLabel = '🔒 Protected';
      } else if (item.level === 'mandatory') {
        levelBadgeClass = 'level-mandatory';
        levelLabel = '🛡️ Mandatory';
      }
      tdLevel.innerHTML = `<span class="badge-tag-level ${levelBadgeClass}">${levelLabel}</span>`;
      tr.appendChild(tdLevel);

      // Col 3: Date
      const tdDate = document.createElement('td');
      tdDate.className = 'table-date';
      tdDate.textContent = formatDate(item.createdAt);
      tr.appendChild(tdDate);

      // Col 4: Actions
      const tdActions = document.createElement('td');
      tdActions.className = 'col-actions';
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'row-actions';

      // Edit Button
      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn-icon-action';
      btnEdit.title = 'Edit kata kunci';
      btnEdit.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
      btnEdit.addEventListener('click', () => openEditKeywordModal(index));
      actionsDiv.appendChild(btnEdit);

      // Delete Button
      const btnDelete = document.createElement('button');
      btnDelete.type = 'button';
      btnDelete.className = 'btn-icon-action btn-delete';
      btnDelete.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

      if (item.level === 'mandatory') {
        btnDelete.disabled = true;
        btnDelete.title = 'Kata kunci Mandatory tidak dapat dihapus melalui antarmuka biasa.';
      } else {
        btnDelete.title = 'Hapus kata kunci';
        btnDelete.addEventListener('click', () => initiateDeleteKeyword(index));
      }
      actionsDiv.appendChild(btnDelete);

      tdActions.appendChild(actionsDiv);
      tr.appendChild(tdActions);

      keywordTableBody.appendChild(tr);
    });

    badgeTotalKeywords.textContent = `${keywords.length} kata kunci`;

    if (visibleCount === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  inputSearchFilter.addEventListener('input', renderKeywordsTable);

  // Add Keyword
  formAddKeyword.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawVal = inputNewKeyword.value.trim();
    if (!rawVal) return;

    const normalized = Normalizer ? Normalizer.normalize(rawVal) : rawVal.toLowerCase();
    const level = selectKeywordLevel.value;

    // Check duplicate
    const exists = config.blockedKeywords.some(k => k.keyword.toLowerCase() === normalized);
    if (exists) {
      showToast(`Kata kunci "${normalized}" sudah ada di blacklist.`);
      return;
    }

    config.blockedKeywords.push({
      keyword: normalized,
      level: level,
      createdAt: Date.now()
    });

    await StorageService.saveConfig(config);
    inputNewKeyword.value = '';
    renderKeywordsTable();
    showToast(`Kata kunci "${normalized}" berhasil ditambahkan.`);
  });

  // Edit Keyword
  async function openEditKeywordModal(index) {
    const item = config.blockedKeywords[index];
    if (!item) return;

    const authorized = await requestAdminAuth(`Ubah kata kunci "${item.keyword}".`);
    if (!authorized) return;

    editTargetIndex = index;
    inputEditKeywordText.value = item.keyword;
    selectEditKeywordLevel.value = item.level || 'normal';
    modalEditKeyword.classList.remove('hidden');
    inputEditKeywordText.focus();
  }

  formEditKeyword.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (editTargetIndex === null) return;

    const updatedText = inputEditKeywordText.value.trim();
    const normalized = Normalizer ? Normalizer.normalize(updatedText) : updatedText.toLowerCase();
    const updatedLevel = selectEditKeywordLevel.value;

    config.blockedKeywords[editTargetIndex].keyword = normalized;
    config.blockedKeywords[editTargetIndex].level = updatedLevel;

    await StorageService.saveConfig(config);
    modalEditKeyword.classList.add('hidden');
    editTargetIndex = null;
    renderKeywordsTable();
    showToast(`Kata kunci berhasil diperbarui.`);
  });

  btnCancelEdit.addEventListener('click', () => {
    modalEditKeyword.classList.add('hidden');
    editTargetIndex = null;
  });

  // Delete Keyword Flow
  async function initiateDeleteKeyword(index) {
    const item = config.blockedKeywords[index];
    if (!item) return;

    if (item.level === 'mandatory') {
      showToast('Kata kunci mandatory tidak dapat dihapus.');
      return;
    }

    // Step 1: Admin password authentication
    const authorized = await requestAdminAuth(`Hapus kata kunci "${item.keyword}".`);
    if (!authorized) return;

    // Step 2: Show confirmation modal (PRD Section 38: Confirm removal? Keyword: vpn)
    deleteTargetIndex = index;
    deleteTargetKeyword.textContent = item.keyword;
    modalDeleteConfirm.classList.remove('hidden');
  }

  btnConfirmDelete.addEventListener('click', async () => {
    if (deleteTargetIndex === null) return;
    const item = config.blockedKeywords[deleteTargetIndex];
    if (item) {
      config.blockedKeywords.splice(deleteTargetIndex, 1);
      await StorageService.saveConfig(config);
      showToast(`Kata kunci "${item.keyword}" telah dihapus.`);
    }
    modalDeleteConfirm.classList.add('hidden');
    deleteTargetIndex = null;
    renderKeywordsTable();
  });

  btnCancelDelete.addEventListener('click', () => {
    modalDeleteConfirm.classList.add('hidden');
    deleteTargetIndex = null;
  });

  // ==================== BULK IMPORT ====================
  btnOpenBulkImport.addEventListener('click', async () => {
    const authorized = await requestAdminAuth('Bulk import kata kunci blacklist.');
    if (!authorized) return;

    textareaBulkKeywords.value = '';
    modalBulkImport.classList.remove('hidden');
    textareaBulkKeywords.focus();
  });

  btnCancelBulk.addEventListener('click', () => {
    modalBulkImport.classList.add('hidden');
  });

  formBulkImport.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawLines = textareaBulkKeywords.value.split('\n');
    const level = selectBulkLevel.value;
    const existing = new Set(config.blockedKeywords.map(k => k.keyword.toLowerCase()));

    let addedCount = 0;
    for (let line of rawLines) {
      line = line.trim();
      if (!line) continue;
      const normalized = Normalizer ? Normalizer.normalize(line) : line.toLowerCase();
      if (normalized && !existing.has(normalized)) {
        existing.add(normalized);
        config.blockedKeywords.push({
          keyword: normalized,
          level: level,
          createdAt: Date.now()
        });
        addedCount++;
      }
    }

    await StorageService.saveConfig(config);
    modalBulkImport.classList.add('hidden');
    renderKeywordsTable();
    showToast(`${addedCount} kata kunci berhasil diimpor.`);
  });

  // ==================== EXPORT CONFIG ====================
  btnExportConfig.addEventListener('click', async () => {
    const exported = await StorageService.exportSanitizedConfig();
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-keyword-blocker-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Konfigurasi aman berhasil diekspor.');
  });

  // ==================== SETTINGS MODIFICATIONS ====================
  settingEnabled.addEventListener('change', async () => {
    if (!settingEnabled.checked) {
      // Trying to disable protection requires auth
      const authorized = await requestAdminAuth('Nonaktifkan proteksi keyword blocker.');
      if (!authorized) {
        settingEnabled.checked = true; // revert
        return;
      }
    }
    config.enabled = settingEnabled.checked;
    await StorageService.saveConfig(config);
    showToast(`Proteksi telah di${config.enabled ? 'aktifkan' : 'nonaktifkan'}.`);
  });

  settingBlockingMode.addEventListener('change', async () => {
    const authorized = await requestAdminAuth('Ubah mode pemblokiran.');
    if (!authorized) {
      settingBlockingMode.value = config.blockingMode;
      return;
    }
    config.blockingMode = settingBlockingMode.value;
    await StorageService.saveConfig(config);
    showToast('Mode pemblokiran diperbarui.');
  });

  settingMatchMode.addEventListener('change', async () => {
    const authorized = await requestAdminAuth('Ubah metode pencocokan kata kunci.');
    if (!authorized) {
      settingMatchMode.value = config.matchMode;
      return;
    }
    config.matchMode = settingMatchMode.value;
    await StorageService.saveConfig(config);
    showToast('Metode pencocokan diperbarui.');
  });

  settingSessionMinutes.addEventListener('change', async () => {
    config.security.adminSessionMinutes = parseInt(settingSessionMinutes.value, 10) || 5;
    await StorageService.saveConfig(config);
    showToast('Durasi sesi admin diperbarui.');
  });

  // Engine toggles
  const engineCheckboxes = [
    { el: engineGoogle, key: 'google' },
    { el: engineBrave, key: 'brave' },
    { el: engineBing, key: 'bing' },
    { el: engineDuckduckgo, key: 'duckduckgo' },
    { el: engineYahoo, key: 'yahoo' }
  ];

  engineCheckboxes.forEach(({ el, key }) => {
    el.addEventListener('change', async () => {
      const authorized = await requestAdminAuth(`Ubah setelan pemantauan mesin pencari.`);
      if (!authorized) {
        el.checked = config.searchEngines[key] !== false;
        return;
      }
      config.searchEngines[key] = el.checked;
      await StorageService.saveConfig(config);
      showToast(`Setelan ${key} diperbarui.`);
    });
  });

  // ==================== ADMIN PASSWORD SETUP & CHANGE ====================
  btnSetupPasswordTrigger.addEventListener('click', () => {
    inputSetupPassword.value = '';
    inputSetupConfirm.value = '';
    setupError.classList.add('hidden');
    modalSetupPassword.classList.remove('hidden');
    inputSetupPassword.focus();
  });

  btnChangePassword.addEventListener('click', async () => {
    const authorized = await requestAdminAuth('Ganti password administrator.');
    if (!authorized) return;

    inputSetupPassword.value = '';
    inputSetupConfirm.value = '';
    setupError.classList.add('hidden');
    modalSetupPassword.classList.remove('hidden');
    inputSetupPassword.focus();
  });

  btnCancelSetup.addEventListener('click', () => {
    modalSetupPassword.classList.add('hidden');
  });

  formSetupPassword.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = inputSetupPassword.value;
    const confirm = inputSetupConfirm.value;

    if (pass.length < 8) {
      setupError.textContent = 'Password harus memiliki minimal 8 karakter.';
      setupError.classList.remove('hidden');
      return;
    }

    if (pass !== confirm) {
      setupError.textContent = 'Konfirmasi password tidak cocok.';
      setupError.classList.remove('hidden');
      return;
    }

    try {
      const credential = await AuthEngine.createPasswordCredential(pass);
      await StorageService.saveAuthCredentials(credential);

      modalSetupPassword.classList.add('hidden');
      setupBanner.classList.add('hidden');
      showToast('Password administrator berhasil disimpan.');

      // Automatically unlock session
      const minutes = parseInt(settingSessionMinutes.value, 10) || 5;
      await StorageService.unlockAdminSession(minutes);
      await updateSessionUI();
    } catch (err) {
      setupError.textContent = err.message || 'Gagal menyimpan password.';
      setupError.classList.remove('hidden');
    }
  });

  // ==================== RESET EXTENSION ====================
  btnResetExtension.addEventListener('click', async () => {
    const authorized = await requestAdminAuth('Reset seluruh konfigurasi extension.');
    if (!authorized) return;

    inputResetConfirmationText.value = '';
    resetError.classList.add('hidden');
    modalResetConfirm.classList.remove('hidden');
    inputResetConfirmationText.focus();
  });

  btnCancelReset.addEventListener('click', () => {
    modalResetConfirm.classList.add('hidden');
  });

  formResetConfirm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const typed = inputResetConfirmationText.value.trim();
    if (typed !== 'RESET') {
      resetError.textContent = 'Konfirmasi tidak sesuai. Harap ketik "RESET".';
      resetError.classList.remove('hidden');
      return;
    }

    await StorageService.resetConfig();
    modalResetConfirm.classList.add('hidden');
    showToast('Extension telah di-reset ke setelan pabrik.');
    setTimeout(() => window.location.reload(), 800);
  });

  await init();
})();
