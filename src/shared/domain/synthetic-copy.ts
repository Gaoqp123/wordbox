/**
 * 模拟复制（合成 Ctrl+C）的熔断器。
 *
 * 背景：合成键盘输入是安全软件重点盯防的行为——隐藏进程 + 伪造按键，
 * 正是恶意软件的经典特征。被拦截时的表现是"剪贴板毫无变化"，
 * 而且往往每次尝试都会触发一次拦截提示，非常烦人。
 *
 * 所以连续失败若干次就自动停用，改走"用户自己按 Ctrl+C，我们只读剪贴板"的兜底路径。
 * 这里写成纯函数，是为了让"什么时候该熔断"这件事可以被单独测试。
 */

export type SyntheticCopyState = {
  /** 连续失败次数 */
  failureStreak: number
  /** 是否已在本会话内停用 */
  disabled: boolean
}

export const SYNTHETIC_FAILURE_LIMIT = 3

export function initialSyntheticCopyState(): SyntheticCopyState {
  return { failureStreak: 0, disabled: false }
}

/**
 * 直接判定这条路不可用。
 *
 * 用在"连子进程都创建不了"这种硬错误上（例如安全软件拒绝 spawn）：
 * 这不是偶发失败，再试只会一遍遍触发拦截提示，不如一次就停。
 */
export function disableSyntheticCopy(limit: number = SYNTHETIC_FAILURE_LIMIT): SyntheticCopyState {
  return { failureStreak: limit, disabled: true }
}

/**
 * 记录一次模拟复制的成败，返回新的状态。
 *
 * 注意：已经熔断之后不会再自动恢复。恢复要由用户显式操作（改设置或重启），
 * 否则"失败几次就恢复"会和拦截提示来回拉锯。
 */
export function afterSyntheticAttempt(
  state: SyntheticCopyState,
  failed: boolean,
  limit: number = SYNTHETIC_FAILURE_LIMIT
): SyntheticCopyState {
  if (!failed) {
    return { failureStreak: 0, disabled: state.disabled }
  }

  const failureStreak = state.failureStreak + 1
  return { failureStreak, disabled: state.disabled || failureStreak >= limit }
}
