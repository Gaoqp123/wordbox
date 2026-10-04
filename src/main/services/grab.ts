import { execFile } from 'child_process'
import { clipboard } from 'electron'
import type { GrabResult, HotkeyTrigger } from '@shared/ipc-contract'
import { judgeCapture } from '@shared/domain/grab-guard'

/**
 * 取词：程序无关地拿到"用户选中的东西"。
 *
 * 唯一依赖的前提是"目标程序支持把选中文本复制下来"。Electron 读不到别的程序里的选区，
 * 这是操作系统隔离，所以这里先备份剪贴板，再模拟一次 Ctrl+C，随后读剪贴板并立刻还原。
 *
 * 三个必须守住的细节（对应规划 4.1）：
 * 1. 还原剪贴板——绝不污染用户原有的内容；
 * 2. 判断是否真的有选区——内容没变/为空/不含字母都算没选中，退化成空输入窗；
 * 3. 时序——窗口必须先不抢焦点，取完词再显示。
 *
 * 模拟按键走 PowerShell 的 SendKeys：没有原生模块、不需要重编译，
 * 代价是多一个短命子进程。如果实测某些程序不响应，再考虑原生输入模拟库。
 */

const COPY_KEYSTROKE_SCRIPT =
  'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^c")'

const POLL_INTERVAL_MS = 40
const DEFAULT_TIMEOUT_MS = 600

type ClipboardSnapshot = {
  text: string
  html: string
  rtf: string
}

function snapshot(): ClipboardSnapshot {
  return {
    text: clipboard.readText(),
    html: clipboard.readHTML(),
    rtf: clipboard.readRTF()
  }
}

function restore(snap: ClipboardSnapshot): void {
  if (snap.text.length === 0 && snap.html.length === 0 && snap.rtf.length === 0) {
    clipboard.clear()
    return
  }
  clipboard.write({ text: snap.text, html: snap.html, rtf: snap.rtf })
}

function sendCopyKeystroke(): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-WindowStyle',
        'Hidden',
        '-Command',
        COPY_KEYSTROKE_SCRIPT
      ],
      { windowsHide: true, timeout: 5000 },
      (error) => {
        if (error) reject(error)
        else resolve()
      }
    )
  })
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 读剪贴板直到它变化或超时。
 *
 * 返回最后一次读到的内容：即使没变化也要返回，交给 judgeCapture 给出
 * "内容没变"这个明确的失败原因，而不是抛异常。
 */
async function waitForClipboardChange(before: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs
  let current = before
  while (Date.now() < deadline) {
    await wait(POLL_INTERVAL_MS)
    current = clipboard.readText()
    if (current !== before) return current
  }
  return current
}

export async function grabSelection(
  trigger: HotkeyTrigger,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<GrabResult> {
  const startedAt = Date.now()
  const before = snapshot()

  try {
    await sendCopyKeystroke()
    const captured = await waitForClipboardChange(before.text, timeoutMs)
    const verdict = judgeCapture(before.text, captured)
    const elapsedMs = Date.now() - startedAt

    if (verdict.ok) {
      return { ok: true, trigger, text: verdict.text, elapsedMs }
    }
    return { ok: false, trigger, reason: verdict.reason, elapsedMs }
  } catch (error) {
    return {
      ok: false,
      trigger,
      reason: 'error',
      detail: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startedAt
    }
  } finally {
    restore(before)
  }
}
