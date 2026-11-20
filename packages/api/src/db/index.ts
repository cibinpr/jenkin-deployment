import Database from 'better-sqlite3';
import { config } from '../config.js';

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin','client')),
  totp_secret TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,               -- sha256 of the token
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  ip TEXT, user_agent TEXT
);
CREATE TABLE IF NOT EXISTS domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE,
  web_root TEXT NOT NULL,
  php_version TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  ssl_status TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, action TEXT NOT NULL, target TEXT,
  ip TEXT, result TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

export function audit(userId: number | null, action: string, target: string | null, ip: string, result: string) {
  db.prepare('INSERT INTO audit_log (user_id, action, target, ip, result) VALUES (?,?,?,?,?)').run(userId, action, target, ip, result);
}
