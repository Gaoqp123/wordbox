import type { DictStatus } from './types'

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
  runtimeStatus: 'runtime:status',
  /** 查词 */
  dictLookup: 'dict:lookup',
  /** 前缀候选（"你是不是想查……"） */
  dictSuggest: 'dict:suggest',
  /** 生词本 */
  vocabAdd: 'vocab:add',
  vocabList: 'vocab:list',
  vocabUpdate: 'vocab:update',
  vocabArchive: 'vocab:archive',
  /** 查询历史 */
  historyList: 'history:list'
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
  /** 词库装载状态 */
  dictionary: DictStatus
  /** 可写库（user.db）状态：查询历史与生词本都写在这里 */
  userStore: {
    ready: boolean
    path: string
    error?: string
  }
  /** 模拟复制（合成 Ctrl+C）的健康状况 */
  syntheticCopy: {
    disabled: boolean
    failureStreak: number
    limit: number
  }
}

/**
 * 这次取到的文本是怎么来的。
 *
 * 分成两种来源是必要的：模拟复制被安全软件拦下时，我们退化成读用户自己复制的剪贴板内容，
 * 界面上必须如实标明——否则用户会以为"我明明没选中它"。
 */
export type GrabSource = 'synthetic-copy' | 'clipboard-fallback'

export type GrabFailureReason =
  /** 剪贴板内容与取词前完全一致：目标程序没有响应模拟复制 */
  | 'clipboard-unchanged'
  /** 按下快捷键时焦点在我们自己的窗口上，模拟复制只能复制到我们自己 */
  | 'own-window-focused'
  /** 模拟复制不可用，需要用户自己按 Ctrl+C 复制一次 */
  | 'need-manual-copy'
  /** 取到的内容是空的 */
  | 'empty'
  /** 取到的内容里没有字母，不像英文词或句子 */
  | 'no-letters'
  /** 取词过程本身出错 */
  | 'error'

/**
 * 取词诊断信息。
 *
 * M0 阶段专门用来回答"为什么没取到"：前台窗口是谁、剪贴板前后是什么、
 * 模拟复制的子进程有没有报错。这些不是给最终用户看的，是给开发者定位问题的。
 */
export type GrabDiagnostics = {
  /** 触发取词时，焦点是否在 WordBox 自己的窗口上 */
  ownWindowFocused: boolean
  /** 本次是否跳过了模拟复制（已熔断） */
  syntheticDisabled: boolean
  /** 模拟按键时 Windows 的前台窗口标题 */
  foregroundBefore?: string
  /** 按键发完之后的前台窗口标题 */
  foregroundAfter?: string
  /** 取词前剪贴板内容预览（截断） */
  clipboardBefore?: string
  /** 取词后剪贴板内容预览（截断） */
  clipboardAfter?: string
  /** 模拟复制子进程的退出码 */
  copyExitCode?: number
  /** 模拟复制子进程的错误输出 */
  copyStderr?: string
  /** 模拟复制根本无法发起时（例如被安全软件拒绝创建子进程）的错误信息 */
  copyError?: string
  /** 等待剪贴板变化的累计时长 */
  waitedMs: number
  /** 实际尝试了几次模拟复制 */
  attempts: number
}

export type GrabResult =
  | {
      ok: true
      trigger: HotkeyTrigger
      text: string
      source: GrabSource
      elapsedMs: number
      diagnostics?: GrabDiagnostics
    }
  | {
      ok: false
      trigger: HotkeyTrigger
      reason: GrabFailureReason
      detail?: string
      elapsedMs: number
      diagnostics?: GrabDiagnostics
    }
