import { describe, expect, it } from 'vitest'
import { newCard, schedule } from '@shared/domain/srs'
import { describeInterval } from '@shared/domain/review-format'
import type { Card } from '@shared/types'

const NOW = 1_700_000_000_000
const DAY = 24 * 60 * 60 * 1000

function freshCard(overrides: Partial<Card> = {}): Card {
  return { ...newCard('word-1', NOW), ...overrides }
}

describe('schedule', () => {
  it('新卡评"记得"后不再是 New，并推迟到未来', () => {
    const result = schedule(freshCard(), 3, NOW)
    expect(result.card.reps).toBe(1)
    expect(result.card.state).not.toBe('New')
    expect(result.card.due).toBeGreaterThan(NOW)
    expect(result.card.lastReview).toBe(NOW)
  })

  it('评分越高，下次间隔越长', () => {
    const again = schedule(freshCard(), 1, NOW)
    const good = schedule(freshCard(), 3, NOW)
    const easy = schedule(freshCard(), 4, NOW)

    expect(again.card.due).toBeLessThanOrEqual(good.card.due)
    expect(good.card.due).toBeLessThan(easy.card.due)
  })

  it('同一张卡连评两次"记得"，间隔会变长', () => {
    const first = schedule(freshCard(), 3, NOW)
    const second = schedule(first.card, 3, NOW + DAY)

    const firstInterval = first.card.due - NOW
    const secondInterval = second.card.due - (NOW + DAY)
    expect(secondInterval).toBeGreaterThan(firstInterval)
  })

  it('评"忘了"会记一次遗忘', () => {
    const reviewed = schedule(
      freshCard({ state: 'Review', reps: 3, stability: 10, difficulty: 5 }),
      1,
      NOW
    )
    expect(reviewed.card.lapses).toBe(1)
    expect(reviewed.card.state).toBe('Relearning')
  })

  it('是纯函数：同样的输入得到同样的结果', () => {
    const card = freshCard()
    expect(schedule(card, 3, NOW)).toEqual(schedule(card, 3, NOW))
  })

  it('日志记录评分前后的状态', () => {
    const result = schedule(freshCard(), 3, NOW)
    expect(result.log.rating).toBe(3)
    expect(result.log.stateBefore).toBe('New')
    expect(result.log.stateAfter).toBe(result.card.state)
    expect(result.log.due).toBe(result.card.due)
  })

  it('保留率调低 = 允许自己忘一点，间隔变长、复习更少', () => {
    const reviewed = freshCard({ state: 'Review', reps: 5, stability: 30, difficulty: 5 })
    const strict = schedule(reviewed, 3, NOW, { requestRetention: 0.95 })
    const loose = schedule(reviewed, 3, NOW, { requestRetention: 0.8 })
    expect(loose.card.due).toBeGreaterThan(strict.card.due)
  })

  it('保留率超出范围会报错，而不是悄悄算出一个怪结果', () => {
    expect(() => schedule(freshCard(), 3, NOW, { requestRetention: 1.5 })).toThrow()
  })
})

describe('describeInterval', () => {
  it('按分钟 / 小时 / 天给出人话', () => {
    expect(describeInterval(NOW, NOW + 10 * 60 * 1000)).toBe('10 分钟后')
    expect(describeInterval(NOW, NOW + 5 * 60 * 60 * 1000)).toBe('5 小时后')
    expect(describeInterval(NOW, NOW + 3 * DAY)).toBe('3 天后')
  })
})
