import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { parseExchangeLemma, parseTags, splitSenses } from '@shared/domain/dict-format'
import { lemmaCandidates } from '@shared/domain/lemma'
import type { DictEntry, DictStatus, LemmaSource, LookupResponse } from '@shared/types'
import { DictionaryDb, type DictRow } from '../data/dictionary-db'

/**
 * 查词服务：把"用户输入的形态"变成"一条整理好的词条"。
 *
 * 查询顺序是刻意设计的，从最可靠到最不可靠：
 *   1. 直接命中词条——绝大多数情况走这里；
 *   2. 词库自带的词形表——处理 running / better / mice 这类变形，可靠；
 *   3. 规则推断——兜住词表漏掉的常规变形，可靠性最差，所以排最后。
 * 三步都失败才给候选，绝不猜一个词硬塞给用户。
 */

let database: DictionaryDb | null = null
let status: DictStatus = { ready: false, path: '', entries: 0 }

/** 词库文件位置：开发时在仓库里，打包后在 asar 解包目录（electron-builder 的 asarUnpack 配置） */
export function dictionaryPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'ecdict.db')
    : join(app.getAppPath(), 'resources', 'ecdict.db')
}

export function openDictionary(): void {
  const path = dictionaryPath()
  try {
    if (!existsSync(path)) {
      status = {
        ready: false,
        path,
        entries: 0,
        error: '词库文件不存在，请先运行 python scripts/build_dict.py'
      }
      return
    }
    database = new DictionaryDb(path)
    status = { ready: true, path, entries: database.countEntries() }
  } catch (error) {
    database = null
    status = {
      ready: false,
      path,
      entries: 0,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export function closeDictionary(): void {
  database?.close()
  database = null
}

export function dictionaryStatus(): DictStatus {
  return status
}

export function suggestWords(prefix: string, limit = 8): string[] {
  const term = prefix.trim()
  if (!database || term.length < 2) return []
  return database.suggestPrefix(term, limit)
}

type LemmaHint = {
  lemma: string
  source: LemmaSource
  kind?: string
}

/**
 * 词条自己的 exchange 里就写着原形。
 *
 * 必须单独做这一步：running / better / mice 这类形态在 ECDICT 里**本身就是词条**，
 * 查询会直接命中，压根走不到"靠词形还原才查到"的分支。可用户依然需要知道原形是谁，
 * 所以提示要从词条自身读，而不是只在还原分支里给。
 */
function lemmaFromRow(row: DictRow): LemmaHint | undefined {
  const parsed = parseExchangeLemma(row.exchange)
  if (!parsed || parsed.lemma.toLowerCase() === row.word.toLowerCase()) return undefined
  return { lemma: parsed.lemma, source: 'ecdict', kind: parsed.kind }
}

function toEntry(row: DictRow, query: string, hint?: LemmaHint): DictEntry {
  const lemma = hint ?? lemmaFromRow(row)
  return {
    word: row.word,
    query,
    phonetic: row.phonetic ?? undefined,
    pos: row.pos ?? undefined,
    collins: row.collins ?? undefined,
    oxford: row.oxford === 1,
    tags: parseTags(row.tag),
    bnc: row.bnc ?? undefined,
    frq: row.frq ?? undefined,
    exchange: row.exchange ?? undefined,
    sensesZh: splitSenses(row.translation),
    sensesEn: splitSenses(row.definition),
    lemma: lemma?.lemma,
    lemmaSource: lemma?.source,
    lemmaKind: lemma?.kind
  }
}

export function lookupWord(raw: string): LookupResponse {
  const query = raw.trim()
  if (!database || query.length === 0) {
    return { query, entry: null, suggestions: [] }
  }

  // 1. 直接命中
  const direct = database.getWord(query)
  if (direct) {
    return { query, entry: toEntry(direct, query), suggestions: [] }
  }

  // 2. 词形表
  const lemmaRow = database.getLemma(query)
  if (lemmaRow) {
    const target = database.getWord(lemmaRow.lemma)
    if (target) {
      return {
        query,
        entry: toEntry(target, query, {
          lemma: lemmaRow.lemma,
          source: lemmaRow.source === 'ecdict' ? 'ecdict' : 'lemma.en.txt',
          kind: lemmaRow.kind ?? undefined
        }),
        suggestions: []
      }
    }
  }

  // 3. 规则兜底：候选逐个验证，谁先命中用谁
  for (const candidate of lemmaCandidates(query)) {
    const fromTable = database.getLemma(candidate)
    const resolved = fromTable?.lemma ?? candidate
    const target = database.getWord(resolved)
    if (target) {
      return {
        query,
        entry: toEntry(target, query, { lemma: target.word, source: 'heuristic' }),
        suggestions: []
      }
    }
  }

  // 4. 都没命中：给候选，让用户自己判断
  return { query, entry: null, suggestions: suggestWords(query) }
}
