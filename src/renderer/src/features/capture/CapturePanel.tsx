import { useCallback, useEffect, useState } from 'react'
import type { GrabFailureReason, GrabResult, GrabSource, RuntimeStatus } from '@shared/ipc-contract'

const FAILURE_TEXT: Record<GrabFailureReason, string> = {
  'clipboard-unchanged': '没取到东西：目标程序没有响应模拟复制，或当前没有选中任何文本',
  'own-window-focused':
    '按下的瞬间焦点在 WordBox 窗口上，模拟复制只会复制到我们自己。请先点回目标程序再按快捷键',
  'need-manual-copy':
    '模拟复制不可用（多半被安全软件拦了）。用法：在目标程序里选中文本，按 Ctrl+C，再按快捷键',
  empty: '取到的内容是空的',
  'no-letters': '取到的内容里没有英文字母，不像一个词或句子',
  error: '取词过程出错'
}

const SOURCE_TEXT: Record<GrabSource, string> = {
  'synthetic-copy': '模拟复制（我们替你按了 Ctrl+C）',
  'clipboard-fallback': '剪贴板兜底（你按的 Ctrl+C）'
}

/** 诊断面板：定位"为什么没取到"用，可以整段复制发给开发者 */
function Diagnostics({ result }: { result: GrabResult }): React.JSX.Element | null {
  const diagnostics = result.diagnostics
  if (!diagnostics) return null

  const rows: Array<[string, string]> = [
    ['焦点在自身窗口', diagnostics.ownWindowFocused ? '是' : '否'],
    ['模拟前的前台窗口', diagnostics.foregroundBefore ?? '(未采集)'],
    ['模拟后的前台窗口', diagnostics.foregroundAfter ?? '(未采集)'],
    ['剪贴板（取词前）', diagnostics.clipboardBefore ?? '(未采集)'],
    ['剪贴板（取词后）', diagnostics.clipboardAfter ?? '(未采集)'],
    [
      '模拟复制退出码',
      diagnostics.copyExitCode === undefined ? '(未运行)' : String(diagnostics.copyExitCode)
    ],
    ['模拟复制错误输出', diagnostics.copyStderr ?? '(无)'],
    ['模拟复制无法发起', diagnostics.copyError ?? '(无)'],
    ['等待 / 尝试次数', `${diagnostics.waitedMs} ms / ${diagnostics.attempts} 次`]
  ]

  return (
    <details className="mt-3 rounded-lg bg-slate-950/70 p-3 text-xs">
      <summary className="cursor-pointer text-slate-400">
        诊断信息（定位问题用，可整段复制）
      </summary>
      <table className="mt-2 w-full table-fixed">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="w-36 align-top text-slate-500">{label}</td>
              <td className="break-all text-slate-300 select-text">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

export default function CapturePanel({
  status
}: {
  status: RuntimeStatus | null
}): React.JSX.Element {
  const [result, setResult] = useState<GrabResult | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => window.api.onGrabResult(setResult), [])

  const grabManually = useCallback(async (): Promise<void> => {
    setBusy(true)
    try {
      setResult(await window.api.grabSelection())
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <div className="space-y-4 pt-4">
      <ul className="space-y-2 text-sm">
        {status?.hotkeys.map((hotkey) => (
          <li key={hotkey.accelerator} className="flex items-center gap-3">
            <span className={hotkey.registered ? 'text-emerald-400' : 'text-rose-400'}>
              {hotkey.registered ? '已注册' : '未注册'}
            </span>
            <code className="rounded bg-slate-800 px-2 py-0.5">{hotkey.accelerator}</code>
            {hotkey.error ? <span className="text-rose-300">{hotkey.error}</span> : null}
          </li>
        )) ?? <li className="text-slate-500">读取中…</li>}
        {status ? (
          <li className="flex items-center gap-3">
            <span className={status.syntheticCopy.disabled ? 'text-amber-400' : 'text-emerald-400'}>
              {status.syntheticCopy.disabled ? '已熔断' : '启用中'}
            </span>
            <span className="text-slate-300">模拟复制</span>
            <span className="text-slate-500">
              连续失败 {status.syntheticCopy.failureStreak} / {status.syntheticCopy.limit}{' '}
              次即自动停用
            </span>
          </li>
        ) : null}
      </ul>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300">本次取词结果</h2>
        <button
          type="button"
          onClick={() => void grabManually()}
          disabled={busy}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-600 disabled:opacity-50"
        >
          {busy ? '取词中…' : '手动取词'}
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-slate-500">
          用法：目标程序里选中文本 → <code className="rounded bg-slate-800 px-1">Ctrl+C</code> →{' '}
          <code className="rounded bg-slate-800 px-1">Ctrl+Alt+D</code>
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            触发方式 {result.trigger} · 耗时 {result.elapsedMs} ms
            {result.ok ? ` · 来源：${SOURCE_TEXT[result.source]}` : ''}
          </p>
          {result.ok ? (
            <p className="rounded-lg bg-slate-800 p-3 text-base break-words">{result.text}</p>
          ) : (
            <p className="rounded-lg bg-rose-950/60 p-3 text-sm text-rose-200">
              {FAILURE_TEXT[result.reason]}
              {result.detail ? `（${result.detail}）` : ''}
            </p>
          )}
          {result.ok && result.source === 'clipboard-fallback' ? (
            <p className="rounded-lg bg-amber-950/60 p-3 text-sm text-amber-200">
              模拟复制没能生效，这里显示的是剪贴板里的内容。正确用法：在目标程序里选中文本，先按
              Ctrl+C，再按快捷键。
            </p>
          ) : null}
          <Diagnostics result={result} />
        </div>
      )}
    </div>
  )
}
