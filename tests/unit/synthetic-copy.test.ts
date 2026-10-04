import { describe, expect, it } from 'vitest'
import {
  afterSyntheticAttempt,
  disableSyntheticCopy,
  initialSyntheticCopyState,
  SYNTHETIC_FAILURE_LIMIT
} from '@shared/domain/synthetic-copy'

describe('afterSyntheticAttempt', () => {
  it('成功时把连续失败清零', () => {
    const state = afterSyntheticAttempt({ failureStreak: 2, disabled: false }, false)
    expect(state).toEqual({ failureStreak: 0, disabled: false })
  })

  it('连续失败到上限才熔断', () => {
    let state = initialSyntheticCopyState()
    for (let i = 1; i < SYNTHETIC_FAILURE_LIMIT; i += 1) {
      state = afterSyntheticAttempt(state, true)
      expect(state.disabled).toBe(false)
    }
    state = afterSyntheticAttempt(state, true)
    expect(state).toEqual({ failureStreak: SYNTHETIC_FAILURE_LIMIT, disabled: true })
  })

  it('中途成功会重新计数', () => {
    let state = afterSyntheticAttempt(initialSyntheticCopyState(), true)
    state = afterSyntheticAttempt(state, true)
    state = afterSyntheticAttempt(state, false)
    expect(state).toEqual({ failureStreak: 0, disabled: false })
  })

  it('熔断后不会因为一次成功就恢复', () => {
    const state = afterSyntheticAttempt({ failureStreak: 3, disabled: true }, false)
    expect(state.disabled).toBe(true)
  })
})

describe('disableSyntheticCopy', () => {
  it('硬错误一次到位：直接熔断，不占用失败额度', () => {
    expect(disableSyntheticCopy()).toEqual({
      failureStreak: SYNTHETIC_FAILURE_LIMIT,
      disabled: true
    })
  })
})
