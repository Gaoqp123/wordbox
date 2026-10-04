import type { ContextEntry, DictEntry, NewWord } from '../types'
import { briefTranslation } from './dict-format'

/**
 * 把一条查询结果变成生词本词条。
 *
 * 关键在于"快照"：这里存的是加入那一刻的释义副本，不是对词库的引用。
 * 词库将来整体升级、甚至换一个词库，你已经背过的卡片内容都不会被改写；
 * 导出的 JSON 也自带可读内容，不依赖词库文件就能看懂。
 */

export type SnapshotOptions = {
  note?: string
  userTags?: string[]
  source?: string
  /** 句模式下遇到的原文；单词模式下没有 */
  context?: ContextEntry
}

export function toWordSnapshot(entry: DictEntry, options: SnapshotOptions = {}): NewWord {
  // entry.lemma 是"这不是原形"时才有的；没有就说明它本身就是原形
  const lemma = entry.lemma ?? entry.word

  return {
    lemma,
    display: entry.query,
    phonetic: entry.phonetic,
    briefZh: briefTranslation(entry.sensesZh),
    detailZh: entry.sensesZh.join('\n'),
    definitionEn: entry.sensesEn.join('\n'),
    exchange: entry.exchange,
    examTags: entry.tags.join(' '),
    userTags: options.userTags ?? [],
    note: options.note,
    source: options.source,
    contexts: options.context ? [options.context] : []
  }
}
