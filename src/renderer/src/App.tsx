import { useCallback, useEffect, useState } from 'react'
import type { GrabFailureReason, GrabResult, RuntimeStatus } from '@shared/ipc-contract'

const FAILURE_TEXT: Record<GrabFailureReason, string> = {
  'clipboard-unchanged': '没取到东西：目标程序没有响应模拟复制，或当前没有选中任何文本',
  empty: '取到的内容是空的',
  'no-letters': '取到的内容里没有英文字母，不像一个词或句子',
  error: '取词过程出错'
}

function App(): React.JSX.Element {
  const [status, setStatus] = useState<RuntimeStatus | null>(null)
  const [result, setResult] = useState<GrabResult | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.api.getRuntimeStatus().then(setStatus)
    return window.api.onGrabResult(setResult)
  }, [])

  const grabManually = useCallback(async (): Promise<void> => {
    setBusy(true)
    try {
      setResult(await window.api.grabSelection())
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-6 overflow-y-auto p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">WordBox · M0 取词验证</h1>
        <p className="text-sm text-slate-400">
          这一步只验证一件事：能不能程序无关地拿到你选中的文本，并且不破坏剪贴板。
        </p>
      </header>

      <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">快捷键注册状态</h2>
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
        </ul>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">怎么测</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
          <li>先复制一段文字到剪贴板记住它，最后用来检查有没有被污染</li>
          <li>切到别的程序（阅读器 / 浏览器 / 记事本），选中一个英文词</li>
          <li>
            按 <code className="rounded bg-slate-800 px-1.5 py-0.5">Ctrl+Alt+D</code>
            ，看这个窗口里有没有出现那个词
          </li>
          <li>选中一整句再按一次，看整句能不能取到</li>
        </ol>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">本次取词结果</h2>
          <button
            type="button"
            onClick={() => void grabManually()}
            disabled={busy}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? '取词中…' : '手动取词'}
          </button>
        </div>

        {result === null ? (
          <p className="text-sm text-slate-500">还没有取过词</p>
        ) : result.ok ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              触发方式 {result.trigger} · 耗时 {result.elapsedMs} ms
            </p>
            <p className="rounded-lg bg-slate-800 p-3 text-base break-words">{result.text}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              触发方式 {result.trigger} · 耗时 {result.elapsedMs} ms
            </p>
            <p className="rounded-lg bg-rose-950/60 p-3 text-sm text-rose-200">
              {FAILURE_TEXT[result.reason]}
              {result.detail ? `（${result.detail}）` : ''}
            </p>
          </div>
        )}
      </section>

      <footer className="text-xs text-slate-500">
        {status
          ? `WordBox ${status.appVersion} · Electron ${status.electronVersion} · Chromium ${status.chromeVersion} · Node ${status.nodeVersion}`
          : '读取运行环境…'}
      </footer>
    </div>
  )
}

export default App
