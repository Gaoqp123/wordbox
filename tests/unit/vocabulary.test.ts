import { describe, expect, it } from 'vitest'
import { toWordSnapshot } from '@shared/domain/vocabulary'
import type { DictEntry } from '@shared/types'

const NOW = 1_700_000_000_000

function entry(overrides: Partial<DictEntry> = {}): DictEntry {
  return {
    word: 'run',
    query: 'running',
    phonetic: 'rʌniŋ',
    pos: 'v:80/n:20',
    collins: 4,
    oxford: true,
    tags: ['gk', 'cet4'],
    bnc: 3269,
    frq: 3252,
    exchange: '0:run/1:i',
    sensesZh: ['n. 赛跑', 'a. 流动的'],
    sensesEn: ['the act of running', 'moving quickly'],
    lemma: 'run',
    lemmaSource: 'ecdict',
    lemmaKind: 'i',
    ...overrides
  }
}

describe('toWordSnapshot', () => {
  it('原形取 lemma，显示形态取你查的那个词', () => {
    const snapshot = toWordSnapshot(entry())
    expect(snapshot.lemma).toBe('run')
    expect(snapshot.display).toBe('running')
  })

  it('本身就是原形时，lemma 就是词条本身', () => {
    const snapshot = toWordSnapshot(
      entry({ word: 'ubiquitous', query: 'ubiquitous', lemma: undefined }),
      {}
    )
    expect(snapshot.lemma).toBe('ubiquitous')
    expect(snapshot.display).toBe('ubiquitous')
  })

  it('简洁释义取前两个义项，详细释义保留全部', () => {
    const snapshot = toWordSnapshot(entry({ sensesZh: ['a', 'b', 'c', 'd'] }))
    expect(snapshot.briefZh).toBe('a；b')
    expect(snapshot.detailZh).toBe('a\nb\nc\nd')
  })

  it('考试标签按空格拼接，可以直接存库', () => {
    expect(toWordSnapshot(entry()).examTags).toBe('gk cet4')
  })

  it('有原句时写进 contexts', () => {
    const snapshot = toWordSnapshot(entry(), {
      context: { sentence: 'He came running.', capturedAt: NOW, source: 'Readest' }
    })
    expect(snapshot.contexts).toHaveLength(1)
    expect(snapshot.contexts?.[0].sentence).toBe('He came running.')
  })

  it('没有原句时 contexts 是空数组而不是 undefined', () => {
    expect(toWordSnapshot(entry()).contexts).toEqual([])
  })

  it('备注与你自己打的标签原样带上', () => {
    const snapshot = toWordSnapshot(entry(), { note: '读书时遇到', userTags: ['阅读'] })
    expect(snapshot.note).toBe('读书时遇到')
    expect(snapshot.userTags).toEqual(['阅读'])
  })
})
