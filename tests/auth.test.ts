import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, randomBytes, scryptSync, createHash } from 'node:crypto';
import { authAction } from '../src/server/auth';
import { localDb } from '../src/server/repositories/local';
process.env.STAVIRA_MODE = 'local';
process.env.STAVIRA_DATA_DIR = mkdtempSync(join(tmpdir(), 'stavira-auth-'));
const hashOf = (password: string, salt: string) => scryptSync(password, salt, 64).toString('hex');
function createUser(email: string, password = 'Original-pass-1!') {
  const db = localDb();
  const id = randomUUID();
  const salt = randomBytes(16).toString('hex');
  try {
    db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
      id,
      email,
      'Tester',
      `${salt}:${hashOf(password, salt)}`,
    );
  } finally {
    db.close();
  }
  return id;
}
function storedHash(id: string) {
  const db = localDb();
  try {
    return String(
      (db.prepare('SELECT hash FROM users WHERE id=?').get(id) as { hash: string }).hash,
    );
  } finally {
    db.close();
  }
}
const matches = (hash: string, password: string) => {
  const [salt, digest] = hash.split(':');
  return hashOf(password, salt) === digest;
};
const codeFrom = (link: string) => new URL(link).searchParams.get('code') as string;
async function requestReset(email: string) {
  return (await authAction('forgot', { email })) as { sent: boolean; devLink?: string };
}
test('a reset link rebinds the account password and is single use', async () => {
  const email = 'single-use@example.com';
  const id = createUser(email);
  const { devLink } = await requestReset(email);
  assert.ok(devLink, 'a known account receives a reset link');
  const code = codeFrom(devLink!);
  await authAction('reset', {
    email,
    code,
    password: 'Brand-new-pass-9!',
    confirm: 'Brand-new-pass-9!',
  });
  assert.ok(matches(storedHash(id), 'Brand-new-pass-9!'), 'the new password is stored');
  await assert.rejects(
    authAction('reset', {
      email,
      code,
      password: 'Third-pass-attempt-3!',
      confirm: 'Third-pass-attempt-3!',
    }),
    /expired or was already used/,
    'the same link cannot be replayed',
  );
});
test('requesting a reset never reveals whether an account exists', async () => {
  const known = 'enumeration-known@example.com';
  createUser(known);
  const real = await requestReset(known);
  const missing = await requestReset('enumeration-absent@example.com');
  assert.equal(real.sent, true);
  assert.deepEqual(
    missing,
    { sent: true },
    'an unknown email produces no link and no distinct shape',
  );
});
test('a reset code only works for the email it was issued to', async () => {
  const owner = 'link-owner@example.com';
  const other = 'link-other@example.com';
  createUser(owner);
  const victim = createUser(other);
  const { devLink } = await requestReset(owner);
  await assert.rejects(
    authAction('reset', {
      email: other,
      code: codeFrom(devLink!),
      password: 'Stolen-reset-pass-7!',
      confirm: 'Stolen-reset-pass-7!',
    }),
    /expired or was already used/,
  );
  assert.ok(matches(storedHash(victim), 'Original-pass-1!'), 'the other account is untouched');
});
test('completing a reset revokes every existing session', async () => {
  const email = 'session-revoke@example.com';
  const id = createUser(email);
  const db = localDb();
  try {
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(
      createHash('sha256').update('live-token').digest('hex'),
      id,
      Date.now() + 86400000,
    );
  } finally {
    db.close();
  }
  const { devLink } = await requestReset(email);
  await authAction('reset', {
    email,
    code: codeFrom(devLink!),
    password: 'Revoke-sessions-5!',
    confirm: 'Revoke-sessions-5!',
  });
  const after = localDb();
  try {
    assert.equal(after.prepare('SELECT COUNT(*) AS n FROM sessions WHERE userId=?').get(id)?.n, 0);
  } finally {
    after.close();
  }
});
test('a mismatched confirmation is rejected before the password changes', async () => {
  const email = 'mismatch@example.com';
  const id = createUser(email);
  const { devLink } = await requestReset(email);
  await assert.rejects(
    authAction('reset', {
      email,
      code: codeFrom(devLink!),
      password: 'Typed-one-way-4!',
      confirm: 'Typed-other-way-4!',
    }),
    /must match/,
  );
  assert.ok(matches(storedHash(id), 'Original-pass-1!'), 'the password is unchanged');
});
test('an expired reset link is refused', async () => {
  const email = 'expired@example.com';
  const id = createUser(email);
  const { devLink } = await requestReset(email);
  const code = codeFrom(devLink!);
  const db = localDb();
  try {
    db.prepare('UPDATE resets SET expires=? WHERE userId=?').run(Date.now() - 1000, id);
  } finally {
    db.close();
  }
  await assert.rejects(
    authAction('reset', { email, code, password: 'Too-late-pass-8!', confirm: 'Too-late-pass-8!' }),
    /expired or was already used/,
  );
});
