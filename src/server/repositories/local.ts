import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Repository, RecordKind, Stored, Write } from './types';
import { AppError } from '../errors';
export function localDb() {
  const dir = resolve(/* turbopackIgnore: true */ process.env.STAVIRA_DATA_DIR ?? '.data');
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(resolve(dir, 'stavira.sqlite'));
  db.exec(
    'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records (owner TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(owner,kind,id)); CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, hash TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, userId TEXT NOT NULL, expires INTEGER NOT NULL);',
  );
  return db;
}
export class LocalRepository implements Repository {
  async list(userId: string) {
    const db = localDb();
    try {
      return db
        .prepare('SELECT kind,id,revision,data FROM records WHERE owner=?')
        .all(userId)
        .map((r) => ({ ...r, data: JSON.parse(r.data as string) }) as Stored);
    } finally {
      db.close();
    }
  }
  async get(userId: string, kind: RecordKind, id: string) {
    const db = localDb();
    try {
      const r = db
        .prepare('SELECT kind,id,revision,data FROM records WHERE owner=? AND kind=? AND id=?')
        .get(userId, kind, id);
      return r ? ({ ...r, data: JSON.parse(r.data as string) } as Stored) : null;
    } finally {
      db.close();
    }
  }
  async commit(userId: string, writes: Write[]) {
    const db = localDb();
    try {
      db.exec('BEGIN IMMEDIATE');
      for (const w of writes) {
        const current = db
          .prepare('SELECT revision FROM records WHERE owner=? AND kind=? AND id=?')
          .get(userId, w.kind, w.id);
        if ((current?.revision ?? 0) !== w.expectedRevision)
          throw new AppError(409, 'This work changed in another session. Refresh and try again.');
        db.prepare(
          'INSERT INTO records VALUES (?,?,?,?,?) ON CONFLICT(owner,kind,id) DO UPDATE SET revision=excluded.revision,data=excluded.data',
        ).run(userId, w.kind, w.id, w.expectedRevision + 1, JSON.stringify(w.data));
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    } finally {
      db.close();
    }
  }
}
