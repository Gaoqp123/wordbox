import { DatabaseSync } from 'node:sqlite'

/**
 * 只读词库的访问层。
 *
 * 用 Electron 内置的 `node:sqlite`（M0 已验证可用，见 ADR-0008）：
 * 免原生模块、免 ABI 重编译。这一层只被 services 调用，界面永远碰不到 SQL。
 *
 * 词库是只读的：它整体可替换、可升级，用户数据一个字都不写在这里。
 */

export type DictRow = {
  word: string
  phonetic: string | null
  translation: string | null
  definition: string | null
  pos: string | null
  collins: number | null
  oxford: number | null
  tag: string | null
  bnc: number | null
  frq: number | null
  exchange: string | null
}

export type LemmaRow = {
  form: string
  lemma: string
  kind: string | null
  source: string
}

const SELECT_COLUMNS =
  'word, phonetic, translation, definition, pos, collins, oxford, tag, bnc, frq, exchange'

/** LIKE 里的通配符要转义，否则用户查 "50%" 会退化成任意匹配 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

export class DictionaryDb {
  private readonly db: DatabaseSync

  constructor(path: string) {
    this.db = new DatabaseSync(path)
    // 就算代码里写错了写操作，这一行也会让它在数据库层面直接失败
    this.db.exec('PRAGMA query_only = ON')
  }

  /**
   * 精确查词。
   *
   * 不需要写 `lower(word) = lower(?)`：建库时 `word` 就是 NOCASE 主键，
   * 直接用主键索引，大小写不敏感由排序规则保证。
   */
  getWord(word: string): DictRow | null {
    const row = this.db.prepare(`SELECT ${SELECT_COLUMNS} FROM dict WHERE word = ?`).get(word) as
      DictRow | undefined
    return row ?? null
  }

  /** 查词形反查表：running → run */
  getLemma(form: string): LemmaRow | null {
    const row = this.db
      .prepare('SELECT form, lemma, kind, source FROM lemma WHERE form = ?')
      .get(form) as LemmaRow | undefined
    return row ?? null
  }

  /**
   * 前缀候选，用于"你是不是想查……"。
   *
   * 排序里那个 `bnc IS NULL` 是必须的：SQLite 里 NULL 在升序中最小，
   * 直接 `ORDER BY bnc` 会把最生僻、没有词频数据的词顶到最前面
   * （实测 `ubiqu%` 的第一条是 ubiquinol，而 ubiquitous 反而被挤下去）。
   */
  suggestPrefix(prefix: string, limit: number): string[] {
    const rows = this.db
      .prepare(
        `SELECT word FROM dict WHERE word LIKE ? ESCAPE '\\'
         ORDER BY bnc IS NULL, bnc, frq IS NULL, frq, length(word), word
         LIMIT ?`
      )
      .all(`${escapeLike(prefix)}%`, limit) as Array<{ word: string }>
    return rows.map((row) => row.word)
  }

  countEntries(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS total FROM dict').get() as
      { total: number } | undefined
    return row?.total ?? 0
  }

  close(): void {
    this.db.close()
  }
}
