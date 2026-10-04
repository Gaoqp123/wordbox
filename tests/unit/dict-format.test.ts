import { describe, expect, it } from 'vitest'
import {
  briefTranslation,
  lemmaKindLabel,
  parseTags,
  splitSenses,
  tagLabel
} from '@shared/domain/dict-format'

describe('splitSenses', () => {
  it('按行拆义项并去掉空行', () => {
    expect(splitSenses('n. 赛跑\n\n a. 流动的 \n')).toEqual(['n. 赛跑', 'a. 流动的'])
  })

  it('空值返回空数组', () => {
    expect(splitSenses(null)).toEqual([])
    expect(splitSenses('')).toEqual([])
  })
})

describe('parseTags', () => {
  it('按空白拆分考试标签', () => {
    expect(parseTags('cet4 cet6  ky')).toEqual(['cet4', 'cet6', 'ky'])
  })

  it('空值返回空数组', () => {
    expect(parseTags(null)).toEqual([])
  })
})

describe('tagLabel', () => {
  it('已知标签翻译成中文，未知标签原样返回', () => {
    expect(tagLabel('cet6')).toBe('六级')
    expect(tagLabel('unknown')).toBe('unknown')
  })
})

describe('lemmaKindLabel', () => {
  it('把变形类型翻译成中文', () => {
    expect(lemmaKindLabel('i')).toBe('现在分词')
    expect(lemmaKindLabel('s')).toBe('复数')
    expect(lemmaKindLabel('r')).toBe('比较级')
  })

  it('空值返回 undefined', () => {
    expect(lemmaKindLabel(null)).toBeUndefined()
  })
})

describe('briefTranslation', () => {
  it('只取前几个义项', () => {
    expect(briefTranslation(['a', 'b', 'c'])).toBe('a；b')
    expect(briefTranslation(['a'])).toBe('a')
  })
})
