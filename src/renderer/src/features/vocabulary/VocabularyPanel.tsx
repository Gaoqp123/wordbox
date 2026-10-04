import { useCallback, useEffect, useState } from 'react'
import type { Word } from '@shared/types'

/** 生词本列表：搜索、编辑备注与标签、归档 */

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}

export default function VocabularyPanel(): React.JSX.Element {
  const [words, setWords] = useState<Word[]>([])
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [tagsDraft, setTagsDraft] = useState('')

  const load = useCallback(async (value: string): Promise<void> => {
    setWords(await window.api.listWords({ query: value.trim() || undefined }))
  }, [])

  useEffect(() => {
    // 首次进入直接取数据：setState 放在 promise 回调里，而不是在 effect 体内同步触发
    void window.api.listWords({}).then(setWords)
  }, [])

  const startEdit = (word: Word): void => {
    setEditingId(word.id)
    setNoteDraft(word.note ?? '')
    setTagsDraft(word.userTags.join(', '))
  }

  const save = async (id: string): Promise<void> => {
    const userTags = tagsDraft
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
    await window.api.updateWord(id, { note: noteDraft, userTags })
    setEditingId(null)
    await load(query)
  }

  const archive = async (id: string): Promise<void> => {
    await window.api.archiveWord(id)
    await load(query)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void load(query)
          }}
          placeholder="搜索原形、显示形态或备注（回车搜索）"
          className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-base outline-none focus:border-sky-500"
        />
        <button
          type="button"
          onClick={() => void load(query)}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600"
        >
          搜索
        </button>
      </div>

      <p className="text-xs text-slate-500">
        共 {words.length} 条{query.trim() ? `（筛选：${query.trim()}）` : ''}
      </p>

      {words.length === 0 ? (
        <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 text-sm text-slate-400">
          还没有词。去「查词」标签页查一个词，然后点「加入生词本」。
        </p>
      ) : (
        <ul className="space-y-3">
          {words.map((word) => (
            <li key={word.id} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-lg font-semibold">{word.lemma}</span>
                {word.display.toLowerCase() !== word.lemma.toLowerCase() ? (
                  <span className="text-xs text-slate-400">（收录自 {word.display}）</span>
                ) : null}
                {word.phonetic ? (
                  <span className="text-sm text-slate-400">/{word.phonetic}/</span>
                ) : null}
                <span className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => (editingId === word.id ? setEditingId(null) : startEdit(word))}
                    className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    {editingId === word.id ? '取消' : '编辑'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void archive(word.id)}
                    className="rounded border border-rose-900 px-2 py-0.5 text-xs text-rose-300 hover:bg-rose-950/50"
                  >
                    归档
                  </button>
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-200">{word.briefZh}</p>

              {word.contexts.length > 0 ? (
                <p className="mt-2 border-l-2 border-slate-700 pl-3 text-sm text-slate-400">
                  {word.contexts[0].sentence}
                </p>
              ) : null}

              {editingId === word.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="备注"
                    rows={2}
                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
                  />
                  <input
                    value={tagsDraft}
                    onChange={(event) => setTagsDraft(event.target.value)}
                    placeholder="标签，用逗号分开，例如：阅读, 高频"
                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => void save(word.id)}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-500"
                  >
                    保存
                  </button>
                </div>
              ) : (
                <div className="mt-2 space-y-1">
                  {word.note ? (
                    <p className="text-sm text-amber-200/80">备注：{word.note}</p>
                  ) : null}
                  {word.userTags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {word.userTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              <p className="mt-2 text-xs text-slate-600">加入于 {formatTime(word.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
