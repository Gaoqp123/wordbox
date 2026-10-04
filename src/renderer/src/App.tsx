import { useEffect, useState } from 'react'
import type { RuntimeStatus } from '@shared/ipc-contract'
import CapturePanel from './features/capture/CapturePanel'
import LookupPanel from './features/lookup/LookupPanel'

function App(): React.JSX.Element {
  const [status, setStatus] = useState<RuntimeStatus | null>(null)

  useEffect(() => {
    void window.api.getRuntimeStatus().then(setStatus)
  }, [])

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-5 overflow-y-auto p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">WordBox</h1>
        <p className="text-sm text-slate-400">离线词典 · 断网可用，词库就在本地。</p>
      </header>

      {status && !status.dictionary.ready ? (
        <p className="rounded-lg bg-rose-950/60 p-3 text-sm text-rose-200">
          词库未就绪：{status.dictionary.error ?? '未知原因'}
        </p>
      ) : null}

      <LookupPanel />

      <details className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <summary className="cursor-pointer text-sm text-slate-400">取词调试面板</summary>
        <CapturePanel status={status} />
      </details>

      <footer className="text-xs text-slate-500">
        {status
          ? `WordBox ${status.appVersion} · Electron ${status.electronVersion} · Node ${status.nodeVersion} · 词库 ${
              status.dictionary.ready
                ? `${status.dictionary.entries.toLocaleString()} 条`
                : '未装载'
            }`
          : '读取运行环境…'}
      </footer>
    </div>
  )
}

export default App
