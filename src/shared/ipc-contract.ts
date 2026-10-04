/**
 * 主进程与渲染进程共用的通道名与载荷类型。
 *
 * 放在 shared 里的意义：两端引用同一份定义，通道名或数据结构写错会直接编译失败，
 * 而不是等到运行期才发现"界面收不到数据"。
 */

export const IPC_CHANNELS = {
  /** 界面按钮手动触发一次取词 */
  grabManual: 'grab:manual',
  /** 主进程 -> 渲染进程：全局快捷键触发的取词结果 */
  grabFromHotkey: 'grab:from-hotkey',
  /** 渲染进程询问运行时状态（快捷键是否注册成功等） */
  runtimeStatus: 'runtime:status'
} as const

/** 这次取词是谁触发的：查词快捷键 / 查句快捷键 / 界面按钮 */
export type HotkeyTrigger = 'word' | 'sentence' | 'manual'

export type HotkeyBinding = {
  /** Electron accelerator，例如 Control+Alt+D */
  accelerator: string
  /** 注册是否成功。失败必须让用户看见，不能静默失效 */
  registered: boolean
  error?: string
}

export type RuntimeStatus = {
  appVersion: string
  electronVersion: string
  chromeVersion: string
  nodeVersion: string
  hotkeys: HotkeyBinding[]
}

export type GrabFailureReason =
  /** 剪贴板内容与取词前完全一致：目标程序没有响应模拟复制 */
  | 'clipboard-unchanged'
  /** 取到的内容是空的 */
  | 'empty'
  /** 取到的内容里没有字母，不像英文词或句子 */
  | 'no-letters'
  /** 取词过程本身出错 */
  | 'error'

export type GrabResult =
  | {
      ok: true
      trigger: HotkeyTrigger
      text: string
      elapsedMs: number
    }
  | {
      ok: false
      trigger: HotkeyTrigger
      reason: GrabFailureReason
      detail?: string
      elapsedMs: number
    }
