/**
 * Chromium Search Keyword Blocker
 * core/auth.js
 * 
 * Cryptographic authentication engine using Web Crypto API (SubtleCrypto).
 * Specifications:
 * - PBKDF2-SHA256 with 310,000 iterations
 * - Cryptographically secure 16-byte random salt
 * - Constant-time secure comparison
 * - Admin Session timeout handling (default 5 minutes)
 * - Rate limiting / progressive backoff on failed attempts
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const cryptoModule = typeof crypto !== 'undefined' ? crypto : require('crypto').webcrypto;
    module.exports = factory(cryptoModule);
  } else {
    root.AuthEngine = factory(root.crypto);
  }
}(typeof self !== 'undefined' ? self : this, function (cryptoObj) {
  'use strict';

  const PBKDF2_ITERATIONS = 310000;
  const HASH_LENGTH_BITS = 256; // 32 bytes
  const SALT_LENGTH_BYTES = 16;
  const DEFAULT_SESSION_MINUTES = 5;
  const MAX_FAILED_ATTEMPTS = 5;

  // Progressive lockout penalties (in seconds)
  const LOCKOUT_TIERS = [30, 60, 120, 300];

  function getSubtle() {
    if (cryptoObj && cryptoObj.subtle) {
      return cryptoObj.subtle;
    }
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
      return globalThis.crypto.subtle;
    }
    throw new Error('Web Crypto API (subtle) is not supported in this environment.');
  }

  function bufferToHex(buffer) {
    const byteArray = new Uint8Array(buffer);
    let hex = '';
    for (let i = 0; i < byteArray.length; i++) {
      hex += byteArray[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  function hexToBuffer(hexString) {
    if (!hexString || hexString.length % 2 !== 0) {
      return new Uint8Array(0);
    }
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
      bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }
    return bytes;
  }

  function generateRandomSaltHex(length = SALT_LENGTH_BYTES) {
    const saltBytes = new Uint8Array(length);
    if (cryptoObj && cryptoObj.getRandomValues) {
      cryptoObj.getRandomValues(saltBytes);
    } else if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
      globalThis.crypto.getRandomValues(saltBytes);
    } else {
      throw new Error('crypto.getRandomValues is not available.');
    }
    return bufferToHex(saltBytes);
  }

  /**
   * Derives PBKDF2-SHA256 hash from password string and hex salt.
   */
  async function derivePasswordHash(password, saltHex, iterations = PBKDF2_ITERATIONS) {
    const subtle = getSubtle();
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    const saltBytes = hexToBuffer(saltHex);

    const baseKey = await subtle.importKey(
      'raw',
      passwordBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: iterations,
        hash: 'SHA-256'
      },
      baseKey,
      HASH_LENGTH_BITS
    );

    return bufferToHex(derivedBits);
  }

  /**
   * Constant-time comparison between two hex strings to prevent timing attacks.
   */
  function secureCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }
    if (a.length !== b.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Generates a new credential record for a password.
   */
  async function createPasswordCredential(password) {
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    const salt = generateRandomSaltHex(SALT_LENGTH_BYTES);
    const hash = await derivePasswordHash(password, salt, PBKDF2_ITERATIONS);

    return {
      algorithm: 'PBKDF2-SHA256',
      iterations: PBKDF2_ITERATIONS,
      salt: salt,
      hash: hash,
      createdAt: Date.now()
    };
  }

  /**
   * Verifies an input password against stored credentials.
   */
  async function verifyPassword(password, credential) {
    if (!credential || !credential.salt || !credential.hash) {
      return false;
    }
    const iterations = credential.iterations || PBKDF2_ITERATIONS;
    const computedHash = await derivePasswordHash(password, credential.salt, iterations);
    return secureCompare(computedHash, credential.hash);
  }

  /**
   * Calculates rate-limiting and lockout penalty based on failed attempts.
   * @param {number} failedAttempts 
   * @param {number} lockoutUntilTimestamp
   * @returns {Object} { isLocked: boolean, remainingSeconds: number, penaltySeconds: number }
   */
  function checkLockout(failedAttempts, lockoutUntilTimestamp) {
    const now = Date.now();
    if (lockoutUntilTimestamp && now < lockoutUntilTimestamp) {
      const remainingMs = lockoutUntilTimestamp - now;
      return {
        isLocked: true,
        remainingSeconds: Math.ceil(remainingMs / 1000)
      };
    }

    return {
      isLocked: false,
      remainingSeconds: 0
    };
  }

  /**
   * Computes new lockout state after a failed attempt.
   */
  function calculateFailedAttemptPenalty(currentFailedAttempts) {
    const newCount = (currentFailedAttempts || 0) + 1;
    let penaltySeconds = 0;
    let isLocked = false;

    if (newCount >= MAX_FAILED_ATTEMPTS) {
      // Pick penalty based on how many times past threshold
      const tierIndex = Math.min(newCount - MAX_FAILED_ATTEMPTS, LOCKOUT_TIERS.length - 1);
      penaltySeconds = LOCKOUT_TIERS[tierIndex];
      isLocked = true;
    }

    return {
      failedAttempts: newCount,
      isLocked: isLocked,
      penaltySeconds: penaltySeconds,
      lockoutUntil: isLocked ? Date.now() + (penaltySeconds * 1000) : 0
    };
  }

  return {
    PBKDF2_ITERATIONS: PBKDF2_ITERATIONS,
    DEFAULT_SESSION_MINUTES: DEFAULT_SESSION_MINUTES,
    MAX_FAILED_ATTEMPTS: MAX_FAILED_ATTEMPTS,
    generateRandomSaltHex: generateRandomSaltHex,
    derivePasswordHash: derivePasswordHash,
    secureCompare: secureCompare,
    createPasswordCredential: createPasswordCredential,
    verifyPassword: verifyPassword,
    checkLockout: checkLockout,
    calculateFailedAttemptPenalty: calculateFailedAttemptPenalty
  };
}));
