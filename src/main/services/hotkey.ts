import { globalShortcut } from 'electron'
import type { HotkeyBinding } from '@shared/ipc-contract'

/**
 * 两个全局快捷键，各管一件事（规划 4.1.1）：
 * 查词键把选中的东西整体当一个词条，查句键把整句切成可点的词。
 *
 * 全局快捷键是抢占式的：注册成功就意味着这个组合在系统里被我们吃掉了。
 * 所以默认值挑冷门组合，而且注册失败（返回 false 或抛异常）必须带出来给界面显示，
 * 不能静默失效让人以为键盘坏了。
 */

export const DEFAULT_HOTKEYS = {
  word: 'Control+Alt+D',
  sentence: 'Control+Alt+S'
} as const

export type HotkeyHandlers = {
  word: () => void
  sentence: () => void
}

export function registerDefaultHotkeys(handlers: HotkeyHandlers): HotkeyBinding[] {
  const bindings: HotkeyBinding[] = []

  for (const trigger of ['word', 'sentence'] as const) {
    const accelerator = DEFAULT_HOTKEYS[trigger]
    const binding: HotkeyBinding = { accelerator, registered: false }

    try {
      binding.registered = globalShortcut.register(accelerator, handlers[trigger])
      if (!binding.registered) {
        binding.error = '注册失败：该组合可能已被其他程序占用'
      }
    } catch (error) {
      binding.registered = false
      binding.error = error instanceof Error ? error.message : String(error)
    }

    bindings.push(binding)
  }

  return bindings
}

export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll()
}
