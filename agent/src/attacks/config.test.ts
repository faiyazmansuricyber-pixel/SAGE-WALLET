import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { requiredPrivateKey } from './config.js';

test('requiredPrivateKey accepts an explicitly supplied valid key', () => {
  const key = `0x${randomBytes(32).toString('hex')}`;
  assert.equal(requiredPrivateKey('ATTACKER_PRIVATE_KEY', key).length, 66);
});

test('requiredPrivateKey rejects a missing value without including a key', () => {
  assert.throws(
    () => requiredPrivateKey('ATTACKER_PRIVATE_KEY', undefined),
    { message: 'Missing or invalid ATTACKER_PRIVATE_KEY' },
  );
});

test('requiredPrivateKey rejects malformed and zero values', () => {
  assert.throws(() => requiredPrivateKey('ATTACKER_PRIVATE_KEY', 'invalid'), {
    message: 'Missing or invalid ATTACKER_PRIVATE_KEY',
  });
  assert.throws(() => requiredPrivateKey('ATTACKER_PRIVATE_KEY', `0x${'0'.repeat(64)}`), {
    message: 'Missing or invalid ATTACKER_PRIVATE_KEY',
  });
});
