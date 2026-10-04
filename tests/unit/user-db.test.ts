import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import { migrate, MIGRATIONS, openUserDatabase } from '../../src/main/data/user-db'
import { UserRepository } from '../../src/main/data/user-repository'

const NOW = 1_700_000_000_000

function freshDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
  return db
}

describe('migrate', () => {
  it('空库迁移到最新版本', () => {
    const db = new DatabaseSync(':memory:')
    expect(migrate(db)).toBe(MIGRATIONS[MIGRATIONS.length - 1].version)
  })

  it('重复迁移是幂等的', () => {
    const db = new DatabaseSync(':memory:')
    const first = migrate(db)
    const second = migrate(db)
    expect(second).toBe(first)
  })

  it('记录版本号，且不重复执行已完成的迁移', () => {
    const db = new DatabaseSync(':memory:')
    migrate(db)

    let executed = false
    migrate(db, [
      ...MIGRATIONS,
      {
        version: MIGRATIONS[MIGRATIONS.length - 1].version + 1,
        description: '测试用',
        up: () => {
          executed = true
        }
      }
    ])

    expect(executed).toBe(true)
    migrate(db)
    expect(executed).toBe(true)
  })
})

describe('落盘与 WAL', () => {
  it('写到真实文件后重开仍能读到数据，版本号也记住了', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wordbox-userdb-'))
    const path = join(dir, 'user.db')

    try {
      const first = openUserDatabase(path)
      const version = first.prepare('PRAGMA user_version').get() as { user_version: number }
      expect(version.user_version).toBe(MIGRATIONS[MIGRATIONS.length - 1].version)

      new UserRepository(first).recordLookup({ term: 'run', lemma: 'run', now: NOW })
      first.close()

      const second = openUserDatabase(path)
      expect(new UserRepository(second).listLookups()).toHaveLength(1)
      second.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('迁移 v2', () => {
  it('给 cards 表补上 FSRS 需要的 learning_steps 列', () => {
    const db = freshDatabase()
    const columns = db.prepare('PRAGMA table_info(cards)').all() as Array<{ name: string }>
    expect(columns.map((column) => column.name)).toContain('learning_steps')
    expect(MIGRATIONS[MIGRATIONS.length - 1].version).toBe(2)
  })
})

describe('UserRepository · 卡片与复习流水', () => {
  let repo: UserRepository

  beforeEach(() => {
    repo = new UserRepository(freshDatabase())
  })

  const word = {
    lemma: 'run',
    display: 'running',
    briefZh: 'n. 赛跑',
    contexts: []
  }

  it('按 id 取卡，并能写回新状态', () => {
    const { card } = repo.addWord(word, NOW)
    const loaded = repo.getCardById(card.id)
    expect(loaded?.state).toBe('New')

    repo.updateCard({
      ...card,
      due: NOW + 86_400_000,
      stability: 3.5,
      difficulty: 5.2,
      scheduledDays: 1,
      learningSteps: 2,
      reps: 1,
      state: 'Review',
      lastReview: NOW
    })

    const updated = repo.getCardById(card.id)
    expect(updated?.due).toBe(NOW + 86_400_000)
    expect(updated?.state).toBe('Review')
    expect(updated?.learningSteps).toBe(2)
    expect(updated?.reps).toBe(1)
  })

  it('追加流水后能按时间统计', () => {
    const { card } = repo.addWord(word, NOW)
    repo.appendReviewLog({
      cardId: card.id,
      rating: 3,
      reviewedAt: NOW,
      stateBefore: 'New',
      stateAfter: 'Review'
    })
    repo.appendReviewLog({
      cardId: card.id,
      rating: 1,
      reviewedAt: NOW + 5000,
      stateBefore: 'Review',
      stateAfter: 'Relearning'
    })

    expect(repo.countReviewLogsSince(NOW - 1)).toBe(2)
    expect(repo.countReviewLogsSince(NOW + 1)).toBe(1)
    expect(repo.countReviewLogsSince(NOW + 10_000)).toBe(0)
  })

  it('加入生词本时回填查询历史的 promoted_word_id', () => {
    repo.recordLookup({ term: 'running', lemma: 'run', now: NOW })
    repo.recordLookup({ term: 'run', lemma: 'run', now: NOW + 1 })
    repo.recordLookup({ term: 'mice', lemma: 'mouse', now: NOW + 2 })

    const { word: added } = repo.addWord(word, NOW + 3)

    const lookups = repo.listLookups()
    const mine = lookups.filter((item) => item.lemma === 'run')
    const other = lookups.find((item) => item.lemma === 'mouse')

    expect(mine.every((item) => item.promotedWordId === added.id)).toBe(true)
    expect(other?.promotedWordId).toBeUndefined()
  })
})

describe('UserRepository · 查询历史', () => {
  let repo: UserRepository

  beforeEach(() => {
    repo = new UserRepository(freshDatabase())
  })

  it('记录并倒序读出', () => {
    repo.recordLookup({ term: 'running', lemma: 'run', now: NOW })
    repo.recordLookup({ term: 'mice', lemma: 'mouse', now: NOW + 1000 })

    const list = repo.listLookups()
    expect(list.map((item) => item.term)).toEqual(['mice', 'running'])
    expect(list[0].lookedUpAt).toBe(NOW + 1000)
  })

  it('能统计同一个词被查了多少次', () => {
    repo.recordLookup({ term: 'ubiquitous', lemma: 'ubiquitous', now: NOW })
    repo.recordLookup({ term: 'ubiquitous', lemma: 'ubiquitous', now: NOW + 1 })
    repo.recordLookup({ term: 'mice', lemma: 'mouse', now: NOW + 2 })
    expect(repo.countLookupsByTerm('ubiquitous')).toBe(2)
  })
})

describe('UserRepository · 生词本', () => {
  let repo: UserRepository

  beforeEach(() => {
    repo = new UserRepository(freshDatabase())
  })

  const sampleWord = {
    lemma: 'run',
    display: 'running',
    phonetic: 'rʌniŋ',
    briefZh: 'n. 赛跑；a. 流动的',
    detailZh: 'n. 赛跑\n a. 流动的',
    definitionEn: 'the act of running',
    exchange: '0:run/1:i',
    examTags: 'gk',
    userTags: ['阅读'],
    note: '在读的那本书里遇到',
    source: 'Some Book',
    contexts: [{ sentence: 'He came running.', capturedAt: NOW, source: 'Readest' }]
  }

  it('加入生词本时同时建一张到期卡', () => {
    const { word, card } = repo.addWord(sampleWord, NOW)

    expect(word.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(word.status).toBe('active')
    expect(word.userTags).toEqual(['阅读'])
    expect(word.contexts[0].sentence).toBe('He came running.')
    expect(card.wordId).toBe(word.id)
    expect(card.state).toBe('New')
    expect(card.due).toBe(NOW)
    expect(card.reps).toBe(0)
  })

  it('新词立刻出现在到期列表里', () => {
    repo.addWord(sampleWord, NOW)
    expect(repo.listDueCards(NOW)).toHaveLength(1)
    expect(repo.listDueCards(NOW - 1)).toHaveLength(0)
  })

  it('可以按原形、显示形态或备注搜索', () => {
    repo.addWord(sampleWord, NOW)
    expect(repo.listWords({ query: 'run' })).toHaveLength(1)
    expect(repo.listWords({ query: 'running' })).toHaveLength(1)
    expect(repo.listWords({ query: '那本书' })).toHaveLength(1)
    expect(repo.listWords({ query: 'running' })).toHaveLength(1)
    expect(repo.listWords({ query: '不存在' })).toHaveLength(0)
  })

  it('搜索里的通配符被转义，不会退化成任意匹配', () => {
    repo.addWord(sampleWord, NOW)
    expect(repo.listWords({ query: '%' })).toHaveLength(0)
  })

  it('更新备注与标签', () => {
    const { word } = repo.addWord(sampleWord, NOW)
    const updated = repo.updateWord(
      word.id,
      { note: '改过的备注', userTags: ['阅读', '高频'] },
      NOW + 5
    )

    expect(updated?.note).toBe('改过的备注')
    expect(updated?.userTags).toEqual(['阅读', '高频'])
    expect(updated?.updatedAt).toBe(NOW + 5)
  })

  it('归档后默认列表看不到，卡片也被停用', () => {
    const { word } = repo.addWord(sampleWord, NOW)
    expect(repo.archiveWord(word.id, NOW + 10)).toBe(true)

    expect(repo.listWords()).toHaveLength(0)
    expect(repo.listWords({ status: 'archived' })).toHaveLength(1)
    expect(repo.listWords({ status: 'all' })).toHaveLength(1)
    expect(repo.getCardByWord(word.id)?.suspended).toBe(true)
    expect(repo.listDueCards(NOW + 100)).toHaveLength(0)
  })

  it('归档一个不存在的 id 返回 false', () => {
    expect(repo.archiveWord('missing', NOW)).toBe(false)
  })

  it('contexts 与 userTags 能原样往返', () => {
    const { word } = repo.addWord(
      {
        ...sampleWord,
        contexts: [
          { sentence: 'First.', capturedAt: NOW },
          { sentence: 'Second.', capturedAt: NOW + 1, source: 'Chrome' }
        ]
      },
      NOW
    )

    const loaded = repo.getWord(word.id)
    expect(loaded?.contexts).toHaveLength(2)
    expect(loaded?.contexts[1].source).toBe('Chrome')
  })

  it('按原形查重时忽略大小写，且只看未归档的', () => {
    const { word } = repo.addWord(sampleWord, NOW)
    expect(repo.findActiveByLemma('RUN')?.id).toBe(word.id)
    expect(repo.findActiveByLemma('run')?.id).toBe(word.id)
    expect(repo.findActiveByLemma('mouse')).toBeNull()

    repo.archiveWord(word.id, NOW + 1)
    expect(repo.findActiveByLemma('run')).toBeNull()
  })
})
