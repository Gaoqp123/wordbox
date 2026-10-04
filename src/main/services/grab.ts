import { execFile } from 'child_process'
import { clipboard } from 'electron'
import type {
  GrabDiagnostics,
  GrabFailureReason,
  GrabResult,
  HotkeyTrigger
} from '@shared/ipc-contract'
import { cleanCapturedText, hasLetters, judgeCapture, previewText } from '@shared/domain/grab-guard'
import {
  afterSyntheticAttempt,
  disableSyntheticCopy,
  initialSyntheticCopyState,
  SYNTHETIC_FAILURE_LIMIT,
  type SyntheticCopyState
} from '@shared/domain/synthetic-copy'

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

/**
 * 模拟一次 Ctrl+C，并顺带报告前后台窗口是谁。
 *
 * 用 -EncodedCommand 而不是 -Command：脚本里有引号、here-string 和反斜杠，
 * 走 base64 就完全不用跟多层转义较劲。脚本以 UTF-16LE 编码，这是 PowerShell 的要求。
 */
const COPY_KEYSTROKE_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
  'Add-Type -AssemblyName System.Windows.Forms',
  '$probeReady = $false',
  'try {',
  "  Add-Type -Namespace WordBox -Name Foreground -MemberDefinition @'",
  'using System;',
  'using System.Runtime.InteropServices;',
  'using System.Text;',
  '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);',
  'public static string Title() {',
  '  var buffer = new StringBuilder(512);',
  '  GetWindowText(GetForegroundWindow(), buffer, buffer.Capacity);',
  '  return buffer.ToString();',
  '}',
  "'@",
  '  $probeReady = $true',
  '} catch {',
  '  $probeReady = $false',
  '}',
  'function Get-ForegroundTitle {',
  "  if (-not $probeReady) { return '(probe-unavailable)' }",
  "  try { return [WordBox.Foreground]::Title() } catch { return '(probe-failed)' }",
  '}',
  '$before = Get-ForegroundTitle',
  "[System.Windows.Forms.SendKeys]::SendWait('^c')",
  'Start-Sleep -Milliseconds 80',
  '$after = Get-ForegroundTitle',
  'Write-Output ("FOREGROUND_BEFORE=" + $before)',
  'Write-Output ("FOREGROUND_AFTER=" + $after)'
].join('\n')

function encodedCommand(): string {
  return Buffer.from(COPY_KEYSTROKE_SCRIPT, 'utf16le').toString('base64')
}

const POLL_INTERVAL_MS = 40
const DEFAULT_TIMEOUT_MS = 900
/** 一次取词最多尝试几次模拟复制。取词时序敏感，重试一次能挡掉偶发的空转 */
const MAX_ATTEMPTS = 2

/** 模拟复制的熔断状态（会话级） */
let syntheticCopyState: SyntheticCopyState = initialSyntheticCopyState()

/** 上一次通过"剪贴板兜底"交给用户的文本，用来识别剪贴板里的旧内容 */
let lastFallbackText: string | null = null

export function syntheticCopyStatus(): SyntheticCopyState & { limit: number } {
  return { ...syntheticCopyState, limit: SYNTHETIC_FAILURE_LIMIT }
}

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

type CopyRunOutcome = {
  exitCode: number
  stderr: string
  foregroundBefore?: string
  foregroundAfter?: string
}

function parseForeground(
  stdout: string
): Pick<CopyRunOutcome, 'foregroundBefore' | 'foregroundAfter'> {
  const before = /^FOREGROUND_BEFORE=(.*)$/m.exec(stdout)?.[1]?.trim()
  const after = /^FOREGROUND_AFTER=(.*)$/m.exec(stdout)?.[1]?.trim()
  return {
    ...(before ? { foregroundBefore: before } : {}),
    ...(after ? { foregroundAfter: after } : {})
  }
}

/**
 * 发送一次模拟复制。
 *
 * 不抛异常：取词本身就是一个"可能失败"的动作，失败原因要作为数据往上带，
 * 而不是变成异常把整条链路打断。
 */
function sendCopyKeystroke(): Promise<CopyRunOutcome> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Sta',
        '-WindowStyle',
        'Hidden',
        '-EncodedCommand',
        encodedCommand()
      ],
      { windowsHide: true, timeout: 8000, encoding: 'utf8' },
      (error, stdout, stderr) => {
        const errorCode = (error as { code?: unknown } | null)?.code
        const exitCode = typeof errorCode === 'number' ? errorCode : error ? -1 : 0

        resolve({
          exitCode,
          stderr: (stderr ?? '').trim() || (error?.message ?? ''),
          ...parseForeground(stdout ?? '')
        })
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
  options: { timeoutMs?: number; ownWindowFocused?: boolean } = {}
): Promise<GrabResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const startedAt = Date.now()
  const before = snapshot()
  const diagnostics: GrabDiagnostics = {
    ownWindowFocused: options.ownWindowFocused ?? false,
    syntheticDisabled: syntheticCopyState.disabled,
    clipboardBefore: previewText(before.text),
    waitedMs: 0,
    attempts: 0
  }

  try {
    let captured = before.text
    let attempts = 0

    if (!syntheticCopyState.disabled) {
      let hardFailure = false
      try {
        while (attempts < MAX_ATTEMPTS) {
          attempts += 1
          const outcome = await sendCopyKeystroke()
          diagnostics.copyExitCode = outcome.exitCode
          if (outcome.foregroundBefore) diagnostics.foregroundBefore = outcome.foregroundBefore
          if (outcome.foregroundAfter) diagnostics.foregroundAfter = outcome.foregroundAfter
          if (outcome.stderr) diagnostics.copyStderr = previewText(outcome.stderr, 200)

          const waitStartedAt = Date.now()
          captured = await waitForClipboardChange(before.text, timeoutMs)
          diagnostics.waitedMs += Date.now() - waitStartedAt

          if (captured !== before.text) break
        }
      } catch (error) {
        // 例如安全软件直接拒绝创建子进程（spawn EPERM）。
        // 记下来就好，绝不能让这一步把整条链路打断——后面还有剪贴板兜底这条正路。
        diagnostics.copyError = error instanceof Error ? error.message : String(error)
        hardFailure = true
      }

      syntheticCopyState = hardFailure
        ? disableSyntheticCopy()
        : afterSyntheticAttempt(syntheticCopyState, captured === before.text)
      diagnostics.syntheticDisabled = syntheticCopyState.disabled
    }

    diagnostics.attempts = attempts
    diagnostics.clipboardAfter = previewText(captured)

    const verdict = judgeCapture(before.text, captured)
    const elapsedMs = Date.now() - startedAt

    if (verdict.ok) {
      lastFallbackText = null
      return {
        ok: true,
        trigger,
        text: verdict.text,
        source: 'synthetic-copy',
        elapsedMs,
        diagnostics
      }
    }

    // 兜底：模拟复制不可用时，退化成"用户自己按 Ctrl+C，我们只读剪贴板"。
    // 只有内容与上次兜底交出去的文本不同才算数，避免把很久以前留在剪贴板里的东西当成本次查询。
    const fallbackText = cleanCapturedText(before.text)
    if (fallbackText.length > 0 && hasLetters(fallbackText) && fallbackText !== lastFallbackText) {
      lastFallbackText = fallbackText
      return {
        ok: true,
        trigger,
        text: fallbackText,
        source: 'clipboard-fallback',
        elapsedMs,
        diagnostics
      }
    }

    const synthesisUnavailable =
      diagnostics.syntheticDisabled || diagnostics.copyError !== undefined

    let reason: GrabFailureReason = verdict.reason
    if (verdict.reason === 'clipboard-unchanged' && diagnostics.ownWindowFocused) {
      reason = 'own-window-focused'
    } else if (synthesisUnavailable) {
      reason = 'need-manual-copy'
    }

    return { ok: false, trigger, reason, elapsedMs, diagnostics }
  } catch (error) {
    return {
      ok: false,
      trigger,
      reason: 'error',
      detail: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startedAt,
      diagnostics
    }
  } finally {
    restore(before)
  }
}
