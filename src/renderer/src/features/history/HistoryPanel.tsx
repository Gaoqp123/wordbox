import { useEffect, useState } from 'react'
import type { LookupRecord } from '@shared/types'

/** 查询历史列表。反复查过的词会在这里显出来——这正是"查询历史"存在的意义。 */
export default function HistoryPanel(): React.JSX.Element {
  const [records, setRecords] = useState<LookupRecord[]>([])

  useEffect(() => {
    void window.api.listLookups(100).then(setRecords)
  }, [])

  if (records.length === 0) {
    return (
      <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 text-sm text-slate-400">
        还没有查询记录。查一个词就会自动记一笔。
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">最近 {records.length} 次查询（新的在上面）</p>
      <ul className="divide-y divide-slate-800 rounded-xl border border-slate-700 bg-slate-900/60">
        {records.map((record) => (
          <li key={record.id} className="flex items-baseline gap-3 px-4 py-2 text-sm">
            <span className="font-medium text-slate-100">{record.term}</span>
            {record.lemma.toLowerCase() !== record.term.toLowerCase() ? (
              <span className="text-xs text-slate-500">→ {record.lemma}</span>
            ) : null}
            <span className="ml-auto text-xs text-slate-500">
              {new Date(record.lookedUpAt).toLocaleString('zh-CN', { hour12: false })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
