import { randomBytes } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { formatUuidV7 } from '@shared/domain/id'

/**
 * 可写库（user.db）的连接与迁移。
 *
 * 与只读词库严格分开：`ecdict.db` 整体可替换升级，`user.db` 是你的全部数据，
 * 两者唯一的联系是词条里存的"释义快照"。
 *
 * 迁移用 `PRAGMA user_version` 记版本号，每次迁移包在一个事务里：
 * 中途失败就整体回滚，不会留下半新半旧的库。
 */

export type Migration = {
  version: number
  description: string
  up: (db: DatabaseSync) => void
}

/**
 * 迁移列表只能追加，不能修改历史项——已经跑过的迁移在别人的库上是既成事实。
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: '生词本、卡片、复习日志、查询历史',
    up: (db) => {
      db.exec(`
        CREATE TABLE words (
          id            TEXT PRIMARY KEY,
          lemma         TEXT NOT NULL,
          display       TEXT NOT NULL,
          phonetic      TEXT,
          brief_zh      TEXT NOT NULL,
          detail_zh     TEXT,
          definition_en TEXT,
          exchange      TEXT,
          exam_tags     TEXT,
          user_tags     TEXT NOT NULL DEFAULT '[]',
          note          TEXT,
          source        TEXT,
          contexts      TEXT NOT NULL DEFAULT '[]',
          status        TEXT NOT NULL DEFAULT 'active',
          created_at    INTEGER NOT NULL,
          updated_at    INTEGER NOT NULL,
          deleted_at    INTEGER
        );
        CREATE INDEX idx_words_lemma ON words(lemma COLLATE NOCASE);
        CREATE INDEX idx_words_status ON words(status);

        CREATE TABLE cards (
          id             TEXT PRIMARY KEY,
          word_id        TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
          due            INTEGER NOT NULL,
          stability      REAL NOT NULL DEFAULT 0,
          difficulty     REAL NOT NULL DEFAULT 0,
          elapsed_days   INTEGER NOT NULL DEFAULT 0,
          scheduled_days INTEGER NOT NULL DEFAULT 0,
          reps           INTEGER NOT NULL DEFAULT 0,
          lapses         INTEGER NOT NULL DEFAULT 0,
          state          TEXT NOT NULL DEFAULT 'New',
          last_review    INTEGER,
          suspended      INTEGER NOT NULL DEFAULT 0
        );
        CREATE UNIQUE INDEX idx_cards_word ON cards(word_id);
        CREATE INDEX idx_cards_due ON cards(due);

        CREATE TABLE review_logs (
          id           TEXT PRIMARY KEY,
          card_id      TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
          rating       INTEGER NOT NULL,
          reviewed_at  INTEGER NOT NULL,
          duration_ms  INTEGER NOT NULL DEFAULT 0,
          state_before TEXT NOT NULL,
          state_after  TEXT NOT NULL
        );
        CREATE INDEX idx_review_logs_card ON review_logs(card_id);

        CREATE TABLE lookups (
          id               TEXT PRIMARY KEY,
          term             TEXT NOT NULL,
          lemma            TEXT NOT NULL,
          looked_up_at     INTEGER NOT NULL,
          source_app       TEXT,
          promoted_word_id TEXT
        );
        CREATE INDEX idx_lookups_time ON lookups(looked_up_at DESC);
        CREATE INDEX idx_lookups_term ON lookups(term COLLATE NOCASE);
      `)
    }
  }
]

/** 用当前时间与随机字节生成一个 v7 主键 */
export function newId(now: number = Date.now()): string {
  return formatUuidV7(now, randomBytes(10))
}

/** 按顺序应用未执行过的迁移，返回最终版本号 */
export function migrate(db: DatabaseSync, migrations: readonly Migration[] = MIGRATIONS): number {
  const current = readUserVersion(db)
  const pending = migrations
    .filter((migration) => migration.version > current)
    .sort((left, right) => left.version - right.version)

  for (const migration of pending) {
    db.exec('BEGIN')
    try {
      migration.up(db)
      db.exec(`PRAGMA user_version = ${migration.version}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  return readUserVersion(db)
}

function readUserVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined
  return row?.user_version ?? 0
}

export function openUserDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  // WAL：读写不互相阻塞；外键约束默认是关的，必须显式打开
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
  return db
}
