import { useEffect, useState } from 'react'
import type { RuntimeStatus } from '@shared/ipc-contract'
import CapturePanel from './features/capture/CapturePanel'
import HistoryPanel from './features/history/HistoryPanel'
import LookupPanel from './features/lookup/LookupPanel'
import VocabularyPanel from './features/vocabulary/VocabularyPanel'

/**
 * 主窗口。
 *
 * 暂时用最简单的标签切换，不引路由：现在只有四个页面，一个状态就够。
 * 切标签会重新挂载面板，等于顺带刷新数据（生词本刚加入的词立刻能看到）。
 */

type TabKey = 'lookup' | 'vocabulary' | 'history' | 'capture'

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: 'lookup', label: '查词' },
  { key: 'vocabulary', label: '生词本' },
  { key: 'history', label: '历史' },
  { key: 'capture', label: '调试' }
]

function App(): React.JSX.Element {
  const [status, setStatus] = useState<RuntimeStatus | null>(null)
  const [tab, setTab] = useState<TabKey>('lookup')

  useEffect(() => {
    void window.api.getRuntimeStatus().then(setStatus)
  }, [])

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4 overflow-y-auto p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">WordBox</h1>
        <p className="text-sm text-slate-400">离线词典 · 断网可用，词库就在本地。</p>
      </header>

      {status && !status.dictionary.ready ? (
        <p className="rounded-lg bg-rose-950/60 p-3 text-sm text-rose-200">
          词库未就绪：{status.dictionary.error ?? '未知原因'}
        </p>
      ) : null}
      {status && !status.userStore.ready ? (
        <p className="rounded-lg bg-rose-950/60 p-3 text-sm text-rose-200">
          生词本数据库未就绪，查询历史与生词本都不可用：{status.userStore.error}
        </p>
      ) : null}

      <nav className="flex gap-1 border-b border-slate-800">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={
              item.key === tab
                ? '-mb-px border-b-2 border-sky-500 px-4 py-2 text-sm font-medium text-sky-400'
                : '-mb-px border-b-2 border-transparent px-4 py-2 text-sm text-slate-400 hover:text-slate-200'
            }
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'lookup' ? <LookupPanel /> : null}
      {tab === 'vocabulary' ? <VocabularyPanel /> : null}
      {tab === 'history' ? <HistoryPanel /> : null}
      {tab === 'capture' ? <CapturePanel status={status} /> : null}

      <footer className="text-xs text-slate-500">
        {status
          ? `WordBox ${status.appVersion} · Electron ${status.electronVersion} · 词库 ${
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
