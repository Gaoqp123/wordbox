import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard
} from 'ts-fsrs'
import type { Card, CardState } from '../types'
import type { Grade } from './review-format'

/**
 * 复习调度。
 *
 * 对外的唯一入口是 `schedule(card, rating, now)`——**纯函数**，给同样的输入永远得到同样的输出。
 * 界面不直接接触 ts-fsrs，将来换算法也只改这一个文件（规划 ADR-0006 就是这么定的）。
 *
 * 刻意关掉 fuzz：FSRS 默认会给间隔加随机抖动，避免同一天的卡片永远挤在一起。
 * 但对"能不能被测"来说随机是不可接受的，而且个人使用量级下抖动收益很小。
 * 想开启的话把 enableFuzz 传进去即可，参数是显式的。
 */

const GRADE_TO_RATING: Readonly<Record<Grade, Rating>> = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy
}

const STATE_TO_FSRS: Readonly<Record<CardState, State>> = {
  New: State.New,
  Learning: State.Learning,
  Review: State.Review,
  Relearning: State.Relearning
}

const FSRS_TO_STATE: Readonly<Record<number, CardState>> = {
  [State.New]: 'New',
  [State.Learning]: 'Learning',
  [State.Review]: 'Review',
  [State.Relearning]: 'Relearning'
}

export type ScheduleOptions = {
  /** 期望保留率，默认 0.9。调低它就等于"允许自己忘一点，换更少的复习量" */
  requestRetention?: number
  /** 间隔随机抖动。默认关闭以保证可测，打开后会打散同一天的卡片 */
  enableFuzz?: boolean
}

export type ScheduleResult = {
  card: Card
  log: {
    rating: Grade
    stateBefore: CardState
    stateAfter: CardState
    reviewedAt: number
    due: number
  }
}

function toFsrsCard(card: Card): FsrsCard {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_TO_FSRS[card.state],
    last_review: card.lastReview === undefined ? undefined : new Date(card.lastReview)
  }
}

function fromFsrsCard(card: FsrsCard, id: string, wordId: string): Card {
  return {
    id,
    wordId,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: FSRS_TO_STATE[card.state] ?? 'New',
    lastReview: card.last_review === undefined ? undefined : card.last_review.getTime(),
    suspended: false
  }
}

export function schedule(
  card: Card,
  grade: Grade,
  now: number = Date.now(),
  options: ScheduleOptions = {}
): ScheduleResult {
  const scheduler = fsrs(
    generatorParameters({
      request_retention: options.requestRetention ?? 0.9,
      enable_fuzz: options.enableFuzz ?? false
    })
  )

  const reviewTime = new Date(now)
  const record = scheduler.repeat(toFsrsCard(card), reviewTime)[GRADE_TO_RATING[grade]]

  return {
    card: {
      ...fromFsrsCard(record.card, card.id, card.wordId),
      suspended: card.suspended
    },
    log: {
      rating: grade,
      stateBefore: card.state,
      stateAfter: FSRS_TO_STATE[record.card.state] ?? 'New',
      reviewedAt: now,
      due: record.card.due.getTime()
    }
  }
}

export function newCard(wordId: string, now: number = Date.now()): Card {
  const empty = createEmptyCard(new Date(now))
  return {
    ...fromFsrsCard(empty, '', wordId),
    due: now,
    suspended: false
  }
}
