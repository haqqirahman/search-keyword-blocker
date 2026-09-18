/**
 * Unit Tests: core/auth.js
 */

const assert = require('assert');
const AuthEngine = require('../core/auth');

async function runAuthTests() {
  console.log('--- Testing core/auth.js ---');

  // Test 1: Generate random salt
  const salt = AuthEngine.generateRandomSaltHex(16);
  assert.strictEqual(typeof salt, 'string');
  assert.strictEqual(salt.length, 32, '16 bytes in hex is 32 characters');

  // Test 2: Password hashing & AC-15 (Non-plaintext check)
  const plainPassword = 'SuperSecretAdminPassword123!';
  const credential = await AuthEngine.createPasswordCredential(plainPassword);

  assert.strictEqual(credential.algorithm, 'PBKDF2-SHA256');
  assert.strictEqual(credential.iterations, 310000);
  assert.strictEqual(typeof credential.salt, 'string');
  assert.strictEqual(typeof credential.hash, 'string');
  assert.notStrictEqual(credential.hash, plainPassword, 'AC-15: Password must NOT be stored as plaintext');
  assert.strictEqual(credential.hash.includes(plainPassword), false, 'Hash must not contain plaintext password');

  // Test 3: Password verification (Correct password)
  const isCorrect = await AuthEngine.verifyPassword(plainPassword, credential);
  assert.strictEqual(isCorrect, true, 'Valid password must be verified as true');

  // Test 4: Password verification (Incorrect password)
  const isWrong = await AuthEngine.verifyPassword('WrongPassword999!', credential);
  assert.strictEqual(isWrong, false, 'Invalid password must be rejected as false');

  // Test 5: Minimum length requirement
  let shortPasswordError = null;
  try {
    await AuthEngine.createPasswordCredential('short');
  } catch (err) {
    shortPasswordError = err;
  }
  assert.notStrictEqual(shortPasswordError, null, 'Password shorter than 8 chars must be rejected');

  // Test 6: Rate limiting and progressive backoff
  let penaltyState = AuthEngine.calculateFailedAttemptPenalty(0);
  assert.strictEqual(penaltyState.failedAttempts, 1);
  assert.strictEqual(penaltyState.isLocked, false);

  // 5 failed attempts triggers 30s lockout
  for (let i = 2; i <= 5; i++) {
    penaltyState = AuthEngine.calculateFailedAttemptPenalty(penaltyState.failedAttempts);
  }
  assert.strictEqual(penaltyState.failedAttempts, 5);
  assert.strictEqual(penaltyState.isLocked, true, '5th failed attempt must trigger lock');
  assert.strictEqual(penaltyState.penaltySeconds, 30, 'Initial lock penalty must be 30 seconds');

  const lockoutCheck = AuthEngine.checkLockout(penaltyState.failedAttempts, penaltyState.lockoutUntil);
  assert.strictEqual(lockoutCheck.isLocked, true);
  assert(lockoutCheck.remainingSeconds > 0 && lockoutCheck.remainingSeconds <= 30);

  console.log('✓ AuthEngine tests passed successfully.');
}

if (require.main === module) {
  runAuthTests().catch(err => {
    console.error('Auth test failed:', err);
    process.exit(1);
  });
}

module.exports = runAuthTests;
