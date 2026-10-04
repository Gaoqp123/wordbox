import type { DatabaseSync } from 'node:sqlite'
import type {
  Card,
  CardState,
  ContextEntry,
  LookupRecord,
  NewWord,
  Word,
  WordStatus
} from '@shared/types'
import { newId } from './user-db'

/**
 * 用户数据的读写入口。
 *
 * 只被 services 调用，界面永远碰不到 SQL。所有写操作都走事务语义（单条语句本身即事务），
 * 时间戳由调用方注入，方便测试里固定时间。
 */

type WordRow = {
  id: string
  lemma: string
  display: string
  phonetic: string | null
  brief_zh: string
  detail_zh: string | null
  definition_en: string | null
  exchange: string | null
  exam_tags: string | null
  user_tags: string
  note: string | null
  source: string | null
  contexts: string
  status: string
  created_at: number
  updated_at: number
  deleted_at: number | null
}

type CardRow = {
  id: string
  word_id: string
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  state: string
  last_review: number | null
  suspended: number
}

type LookupRow = {
  id: string
  term: string
  lemma: string
  looked_up_at: number
  source_app: string | null
  promoted_word_id: string | null
}

/**
 * JSON 列解析要能扛住脏数据：库里存的是自己写的 JSON，但一旦文件被手工改过，
 * 一个解析异常不该让整个列表打不开。所以解析失败退化成空数组。
 */
function parseJsonArray<T>(text: string): T[] {
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function toWord(row: WordRow): Word {
  return {
    id: row.id,
    lemma: row.lemma,
    display: row.display,
    phonetic: row.phonetic ?? undefined,
    briefZh: row.brief_zh,
    detailZh: row.detail_zh ?? undefined,
    definitionEn: row.definition_en ?? undefined,
    exchange: row.exchange ?? undefined,
    examTags: row.exam_tags ?? undefined,
    userTags: parseJsonArray<string>(row.user_tags),
    note: row.note ?? undefined,
    source: row.source ?? undefined,
    contexts: parseJsonArray<ContextEntry>(row.contexts),
    status: row.status === 'archived' ? 'archived' : 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined
  }
}

function toCard(row: CardRow): Card {
  return {
    id: row.id,
    wordId: row.word_id,
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsedDays: row.elapsed_days,
    scheduledDays: row.scheduled_days,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as CardState,
    lastReview: row.last_review ?? undefined,
    suspended: row.suspended === 1
  }
}

function toLookup(row: LookupRow): LookupRecord {
  return {
    id: row.id,
    term: row.term,
    lemma: row.lemma,
    lookedUpAt: row.looked_up_at,
    sourceApp: row.source_app ?? undefined,
    promotedWordId: row.promoted_word_id ?? undefined
  }
}

export class UserRepository {
  constructor(private readonly db: DatabaseSync) {}

  // ---- 查询历史 ------------------------------------------------------------

  recordLookup(
    input: { term: string; lemma: string; sourceApp?: string; now?: number },
    id: string = newId()
  ): LookupRecord {
    const now = input.now ?? Date.now()
    this.db
      .prepare(
        'INSERT INTO lookups (id, term, lemma, looked_up_at, source_app) VALUES (?, ?, ?, ?, ?)'
      )
      .run(id, input.term, input.lemma, now, input.sourceApp ?? null)

    return {
      id,
      term: input.term,
      lemma: input.lemma,
      lookedUpAt: now,
      sourceApp: input.sourceApp
    }
  }

  listLookups(limit = 100): LookupRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM lookups ORDER BY looked_up_at DESC, id DESC LIMIT ?')
      .all(limit) as LookupRow[]
    return rows.map(toLookup)
  }

  /** 同一个词被查了多少次——"哪些词我反复查过"就是从这张表算出来的 */
  countLookupsByTerm(term: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS total FROM lookups WHERE term = ?')
      .get(term) as { total: number } | undefined
    return row?.total ?? 0
  }

  // ---- 生词本 --------------------------------------------------------------

  /** 加入生词本：写词条快照 + 立刻建一张待复习的卡（state = New，due = 现在） */
  addWord(input: NewWord, now: number = Date.now()): { word: Word; card: Card } {
    const wordId = newId(now)
    const cardId = newId(now)

    this.db.exec('BEGIN')
    try {
      this.db
        .prepare(
          `INSERT INTO words (
             id, lemma, display, phonetic, brief_zh, detail_zh, definition_en, exchange,
             exam_tags, user_tags, note, source, contexts, status, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
        )
        .run(
          wordId,
          input.lemma,
          input.display,
          input.phonetic ?? null,
          input.briefZh,
          input.detailZh ?? null,
          input.definitionEn ?? null,
          input.exchange ?? null,
          input.examTags ?? null,
          JSON.stringify(input.userTags ?? []),
          input.note ?? null,
          input.source ?? null,
          JSON.stringify(input.contexts ?? []),
          now,
          now
        )

      this.db
        .prepare(
          `INSERT INTO cards (id, word_id, due, stability, difficulty, elapsed_days,
             scheduled_days, reps, lapses, state, last_review, suspended)
           VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 'New', NULL, 0)`
        )
        .run(cardId, wordId, now)

      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }

    const word = this.getWord(wordId)
    const card = this.getCardByWord(wordId)
    if (!word || !card) {
      throw new Error('写入生词本后读不回来，库状态异常')
    }
    return { word, card }
  }

  getWord(id: string): Word | null {
    const row = this.db.prepare('SELECT * FROM words WHERE id = ?').get(id) as WordRow | undefined
    return row ? toWord(row) : null
  }

  /**
   * 按原形找一条还在生词本里的词条。
   *
   * 用途是查重：running 和 run 是同一个词的不同形态，加入生词本时应该认出来，
   * 而不是让同一个原形出现两条。比较走 NOCASE（与 idx_words_lemma 索引的排序规则一致）。
   */
  findActiveByLemma(lemma: string): Word | null {
    const row = this.db
      .prepare(
        `SELECT * FROM words
         WHERE lemma COLLATE NOCASE = ? AND status = 'active'
         ORDER BY created_at DESC, id DESC
         LIMIT 1`
      )
      .get(lemma) as WordRow | undefined
    return row ? toWord(row) : null
  }

  listWords(options: { query?: string; status?: WordStatus | 'all'; limit?: number } = {}): Word[] {
    const status = options.status ?? 'active'
    const clauses: string[] = []
    const params: Array<string | number> = []

    if (status !== 'all') {
      clauses.push('status = ?')
      params.push(status)
    }
    if (options.query) {
      clauses.push(
        "(lemma LIKE ? ESCAPE '\\' OR display LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\')"
      )
      const pattern = `%${options.query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
      params.push(pattern, pattern, pattern)
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
    params.push(options.limit ?? 200)

    const rows = this.db
      .prepare(`SELECT * FROM words ${where} ORDER BY created_at DESC, id DESC LIMIT ?`)
      .all(...params) as WordRow[]
    return rows.map(toWord)
  }

  updateWord(
    id: string,
    patch: Partial<Pick<NewWord, 'display' | 'note' | 'source' | 'userTags' | 'contexts'>>,
    now: number = Date.now()
  ): Word | null {
    const assignments: string[] = []
    const params: Array<string | number | null> = []

    if (patch.display !== undefined) {
      assignments.push('display = ?')
      params.push(patch.display)
    }
    if (patch.note !== undefined) {
      assignments.push('note = ?')
      params.push(patch.note)
    }
    if (patch.source !== undefined) {
      assignments.push('source = ?')
      params.push(patch.source)
    }
    if (patch.userTags !== undefined) {
      assignments.push('user_tags = ?')
      params.push(JSON.stringify(patch.userTags))
    }
    if (patch.contexts !== undefined) {
      assignments.push('contexts = ?')
      params.push(JSON.stringify(patch.contexts))
    }

    if (assignments.length === 0) return this.getWord(id)

    assignments.push('updated_at = ?')
    params.push(now, id)

    this.db.prepare(`UPDATE words SET ${assignments.join(', ')} WHERE id = ?`).run(...params)
    return this.getWord(id)
  }

  /** 归档（软删除）：卡片一并停用，但数据留着，导出与将来的同步都用得上 */
  archiveWord(id: string, now: number = Date.now()): boolean {
    this.db.exec('BEGIN')
    try {
      const result = this.db
        .prepare(
          "UPDATE words SET status = 'archived', deleted_at = ?, updated_at = ? WHERE id = ?"
        )
        .run(now, now, id)
      this.db.prepare('UPDATE cards SET suspended = 1 WHERE word_id = ?').run(id)
      this.db.exec('COMMIT')
      return result.changes > 0
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  // ---- 卡片 ----------------------------------------------------------------

  getCardByWord(wordId: string): Card | null {
    const row = this.db.prepare('SELECT * FROM cards WHERE word_id = ?').get(wordId) as
      CardRow | undefined
    return row ? toCard(row) : null
  }

  listDueCards(now: number, limit = 20): Card[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM cards
         WHERE suspended = 0 AND due <= ?
         ORDER BY due, id
         LIMIT ?`
      )
      .all(now, limit) as CardRow[]
    return rows.map(toCard)
  }
}
