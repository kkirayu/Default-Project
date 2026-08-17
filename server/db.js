const path = require('path')
const fs = require('fs')

// Deployment mode:
//  - TURSO_DATABASE_URL set  → hosted libSQL (Vercel). Uses @libsql/client over HTTP/WS (no native deps at runtime).
//  - otherwise               → local SQLite file via node:sqlite (dev / normal machine).
const USE_TURSO = !!process.env.TURSO_DATABASE_URL

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar        TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('income','expense')),
  icon       TEXT NOT NULL DEFAULT 'more',
  color      TEXT NOT NULL DEFAULT '#1677ff',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  type        TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount      REAL NOT NULL,
  note        TEXT,
  date        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budgets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,
  allocated   REAL NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (user_id, category_id, month)
);

CREATE TABLE IF NOT EXISTS reminders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  amount     REAL NOT NULL DEFAULT 0,
  recurrence TEXT NOT NULL DEFAULT 'once' CHECK (recurrence IN ('daily','weekly','monthly','once')),
  due_date   TEXT NOT NULL,
  notes      TEXT,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS families (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS family_members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id  INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  created_at TEXT NOT NULL,
  UNIQUE (family_id, user_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id  INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  email      TEXT,
  code       TEXT NOT NULL UNIQUE,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions (user_id, date);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_budget_user ON budgets (user_id, month);
CREATE INDEX IF NOT EXISTS idx_reminder_user ON reminders (user_id);
CREATE INDEX IF NOT EXISTS idx_fm_user ON family_members (user_id);
CREATE INDEX IF NOT EXISTS idx_inv_code ON invitations (code);
`

let db
let schemaPromise

if (USE_TURSO) {
  const { createClient } = require('@libsql/client')
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  db = {
    isTurso: true,
    prepare(sql) {
      return {
        run: async (...args) => {
          const r = await client.execute({ sql, args })
          return {
            changes: r.rowsAffected,
            lastInsertRowid: r.lastInsertRowid === undefined ? undefined : Number(r.lastInsertRowid),
          }
        },
        get: async (...args) => (await client.execute({ sql, args })).rows[0],
        all: async (...args) => (await client.execute({ sql, args })).rows,
      }
    },
    exec: async (sql) => {
      await client.executeMultiple(sql)
    },
    batch: async (stmts) => {
      const results = await client.batch(stmts.map((s) => ({ sql: s.sql, args: s.args || [] })))
      return results.map((r) => ({
        changes: r.rowsAffected,
        lastInsertRowid: r.lastInsertRowid === undefined ? undefined : Number(r.lastInsertRowid),
      }))
    },
  }

  // Turso: prepare() never touches the server, so module-level statements are safe.
  // Schema is applied lazily on the first request via init().
  schemaPromise = null
} else {
  const { DatabaseSync } = require('node:sqlite')
  const DATA_DIR = path.join(__dirname, '..', 'data')
  const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'wallet.db')
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

  const client = new DatabaseSync(DB_PATH)
  client.exec('PRAGMA journal_mode = WAL;')
  client.exec('PRAGMA foreign_keys = ON;')
  client.exec('PRAGMA busy_timeout = 5000;')

  db = {
    isTurso: false,
    prepare(sql) {
      const stmt = client.prepare(sql)
      return {
        run: async (...args) => {
          const info = stmt.run(...args)
          return { changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) }
        },
        get: async (...args) => stmt.get(...args),
        all: async (...args) => stmt.all(...args),
      }
    },
    exec: async (sql) => {
      client.exec(sql)
    },
    batch: async (stmts) => {
      client.exec('BEGIN')
      try {
        const out = []
        for (const s of stmts) {
          const info = client.prepare(s.sql).run(...(s.args || []))
          out.push({ changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) })
        }
        client.exec('COMMIT')
        return out
      } catch (err) {
        client.exec('ROLLBACK')
        throw err
      }
    },
  }

  // node:sqlite: tables must exist before any module-level prepare() runs,
  // so apply the schema synchronously at load time.
  client.exec(SCHEMA)
  schemaPromise = Promise.resolve()
}

function init() {
  if (!schemaPromise) schemaPromise = db.exec(SCHEMA)
  return schemaPromise
}

module.exports = db
module.exports.init = init
