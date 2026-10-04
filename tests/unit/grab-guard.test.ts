import { describe, expect, it } from 'vitest'
import {
  cleanCapturedText,
  hasLetters,
  judgeCapture,
  normalizeTypography,
  stripEdgePunctuation
} from '@shared/domain/grab-guard'

describe('normalizeTypography', () => {
  it('把弯引号、破折号、省略号归一成 ASCII 形态', () => {
    expect(normalizeTypography('\u201Cdon\u2019t\u201D')).toBe('"don\'t"')
    expect(normalizeTypography('well\u2014known')).toBe('well-known')
    expect(normalizeTypography('wait\u2026')).toBe('wait...')
  })

  it('把不间断空格换成普通空格', () => {
    expect(normalizeTypography('in\u00A0terms')).toBe('in terms')
  })
})

describe('stripEdgePunctuation', () => {
  it('去掉首尾标点与空白', () => {
    expect(stripEdgePunctuation('  "ubiquitous,"  ')).toBe('ubiquitous')
    expect(stripEdgePunctuation('(running)')).toBe('running')
  })

  it('不动词内部的连字符', () => {
    expect(stripEdgePunctuation('well-known')).toBe('well-known')
  })
})

describe('cleanCapturedText', () => {
  it('压平换行与连续空白', () => {
    expect(cleanCapturedText('  hello\n\n   world  ')).toBe('hello world')
  })

  it('组合处理排版字符与首尾标点', () => {
    expect(cleanCapturedText('\u201CToo \u2014 much.\u201D')).toBe('Too - much')
  })
})

describe('hasLetters', () => {
  it('识别英文字母', () => {
    expect(hasLetters('run')).toBe(true)
    expect(hasLetters('123')).toBe(false)
    expect(hasLetters('。，')).toBe(false)
  })
})

describe('judgeCapture', () => {
  it('剪贴板没变就是没取到东西', () => {
    expect(judgeCapture('previous', 'previous')).toEqual({
      ok: false,
      reason: 'clipboard-unchanged'
    })
  })

  it('空内容被单独识别', () => {
    expect(judgeCapture('previous', '   ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('没有字母的内容不算查询目标', () => {
    expect(judgeCapture('previous', '123 456')).toEqual({ ok: false, reason: 'no-letters' })
  })

  it('正常取词返回清理后的文本', () => {
    expect(judgeCapture('previous', '  \u201Cubiquitous,\u201D ')).toEqual({
      ok: true,
      text: 'ubiquitous'
    })
  })

  it('剪贴板里原来就是同一个词时仍然算没取到', () => {
    expect(judgeCapture('run', 'run')).toEqual({ ok: false, reason: 'clipboard-unchanged' })
  })
})
