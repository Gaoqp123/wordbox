import { describe, expect, it } from 'vitest'
import { lemmaCandidates } from '@shared/domain/lemma'

describe('lemmaCandidates', () => {
  it('现在分词：去 ing，并处理双写与结尾的 e', () => {
    expect(lemmaCandidates('running')).toContain('run')
    expect(lemmaCandidates('making')).toContain('make')
    expect(lemmaCandidates('studying')).toContain('study')
  })

  it('过去式：去 ed，并处理双写与结尾的 e', () => {
    expect(lemmaCandidates('stopped')).toContain('stop')
    expect(lemmaCandidates('used')).toContain('use')
    expect(lemmaCandidates('cried')).toContain('cry')
  })

  it('复数与三单', () => {
    expect(lemmaCandidates('apples')).toContain('apple')
    expect(lemmaCandidates('boxes')).toContain('box')
    expect(lemmaCandidates('studies')).toContain('study')
    expect(lemmaCandidates('knives')).toContain('knife')
  })

  it('所有格', () => {
    expect(lemmaCandidates("teacher's")).toContain('teacher')
    expect(lemmaCandidates('teachers')).toContain('teacher')
  })

  it('比较级与最高级', () => {
    expect(lemmaCandidates('bigger')).toContain('big')
    expect(lemmaCandidates('happiest')).toContain('happy')
  })

  it('不猜不规则变化——那些交给词表', () => {
    expect(lemmaCandidates('mice')).toEqual([])
    expect(lemmaCandidates('went')).toEqual([])
    expect(lemmaCandidates('teeth')).toEqual([])
  })

  it('结果去重，且不包含输入本身', () => {
    const candidates = lemmaCandidates('used')
    expect(new Set(candidates).size).toBe(candidates.length)
    expect(candidates).not.toContain('used')
  })

  it('过短的候选被丢弃', () => {
    expect(lemmaCandidates('as')).toEqual([])
  })
})
