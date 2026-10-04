import type { Grade } from '@shared/domain/review-format'
import { schedule } from '@shared/domain/srs'
import type { ReviewQueueItem } from '@shared/types'
import { userRepository } from './user-store'

/**
 * 复习服务。
 *
 * 调度计算全在 `shared/domain/srs`（纯函数），这里只负责"取到期卡 → 算新状态 →
 * 写回卡片并追加流水"。界面拿到的永远是整理好的东西，不需要知道 FSRS 长什么样。
 */

export function dueCards(now: number = Date.now(), limit = 30): ReviewQueueItem[] {
  const repository = userRepository()
  if (!repository) return []

  const items: ReviewQueueItem[] = []
  for (const card of repository.listDueCards(now, limit)) {
    const word = repository.getWord(card.wordId)
    if (word) items.push({ card, word })
  }
  return items
}

/**
 * 给一张卡评分。
 *
 * 卡片与流水必须一起写：只更新卡片不记流水，就永远算不出"这个词我忘了多少次"，
 * 而复习日志正是将来调参、甚至换算法的唯一依据。
 */
export function gradeCard(
  cardId: string,
  grade: Grade,
  now: number = Date.now()
): ReviewQueueItem | null {
  const repository = userRepository()
  if (!repository) return null

  const card = repository.getCardById(cardId)
  if (!card) return null

  const { card: nextCard, log } = schedule(card, grade, now)

  repository.updateCard(nextCard)
  repository.appendReviewLog({
    cardId,
    rating: log.rating,
    reviewedAt: log.reviewedAt,
    stateBefore: log.stateBefore,
    stateAfter: log.stateAfter
  })

  const word = repository.getWord(nextCard.wordId)
  return word ? { card: nextCard, word } : null
}

export function reviewedSince(since: number): number {
  return userRepository()?.countReviewLogsSince(since) ?? 0
}
