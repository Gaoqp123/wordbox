import { useCallback, useState } from 'react'
import { briefTranslation, lemmaKindLabel, tagLabel } from '@shared/domain/dict-format'
import type { DictEntry, LookupResponse } from '@shared/types'

/**
 * 查词面板。
 *
 * 两级释义是同一份数据的两级展开：简洁层给音标、词性加前两个核心义项，
 * 详细层展开全部中英释义与词形变化。默认简洁——查词时你要的是"它是什么意思"，
 * 而不是"它一共有多少种意思"。
 */

/** 发音走系统语音合成：离线、免费、不需要音频文件 */
function speak(word: string): void {
  const synthesis = window.speechSynthesis
  if (!synthesis) return
  synthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(word)
  utterance.lang = 'en-US'
  utterance.rate = 0.9
  synthesis.speak(utterance)
}

function Restoration({ entry }: { entry: DictEntry }): React.JSX.Element | null {
  const restored =
    entry.lemma !== undefined && entry.lemma.toLowerCase() !== entry.query.toLowerCase()
  if (!restored) return null

  const kind = lemmaKindLabel(entry.lemmaKind)
  return (
    <p className="text-xs text-sky-300/80">
      已还原：{entry.query} → {entry.lemma}
      {kind ? `（${kind}）` : ''}
      {entry.lemmaSource === 'heuristic' ? '（按拼写规则推断）' : ''}
    </p>
  )
}

function Meta({ entry }: { entry: DictEntry }): React.JSX.Element {
  const parts: string[] = []
  if (entry.collins) parts.push(`柯林斯 ${'★'.repeat(entry.collins)}`)
  if (entry.oxford) parts.push('牛津3000')
  if (entry.bnc) parts.push(`BNC #${entry.bnc}`)
  if (entry.frq) parts.push(`当代 #${entry.frq}`)

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {entry.tags.map((tag) => (
        <span key={tag} className="rounded bg-sky-900/60 px-1.5 py-0.5 text-sky-200">
          {tagLabel(tag)}
        </span>
      ))}
      {parts.length > 0 ? <span className="text-slate-500">{parts.join(' · ')}</span> : null}
    </div>
  )
}

function EntryCard({ entry }: { entry: DictEntry }): React.JSX.Element {
  const [detailed, setDetailed] = useState(false)

  return (
    <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl font-semibold">{entry.word}</h2>
        {entry.phonetic ? <span className="text-slate-400">/{entry.phonetic}/</span> : null}
        <button
          type="button"
          onClick={() => speak(entry.word)}
          className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          🔊 发音
        </button>
        <button
          type="button"
          onClick={() => setDetailed((value) => !value)}
          className="ml-auto rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          {detailed ? '只看简洁' : '展开详细'}
        </button>
      </div>

      <Restoration entry={entry} />
      <Meta entry={entry} />

      {detailed ? (
        <div className="space-y-3 text-sm">
          <div>
            <p className="mb-1 text-xs text-slate-500">中文释义</p>
            <ul className="space-y-0.5">
              {entry.sensesZh.map((sense, index) => (
                <li key={`zh-${index}`} className="text-slate-200">
                  {sense}
                </li>
              ))}
            </ul>
          </div>
          {entry.sensesEn.length > 0 ? (
            <div>
              <p className="mb-1 text-xs text-slate-500">英文释义</p>
              <ul className="space-y-0.5">
                {entry.sensesEn.map((sense, index) => (
                  <li key={`en-${index}`} className="text-slate-400">
                    {sense}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {entry.exchange ? (
            <p className="text-xs text-slate-500">
              词形变化：<span className="font-mono">{entry.exchange}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-base text-slate-100">{briefTranslation(entry.sensesZh)}</p>
      )}
    </div>
  )
}

export default function LookupPanel(): React.JSX.Element {
  const [term, setTerm] = useState('')
  const [response, setResponse] = useState<LookupResponse | null>(null)
  const [busy, setBusy] = useState(false)

  const search = useCallback(async (value: string): Promise<void> => {
    const query = value.trim()
    if (!query) return
    setBusy(true)
    try {
      setResponse(await window.api.lookup(query))
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void search(term)
            if (event.key === 'Escape') {
              setTerm('')
              setResponse(null)
            }
          }}
          placeholder="输入英文单词，回车查询（Esc 清空）"
          className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-base outline-none focus:border-sky-500"
        />
        <button
          type="button"
          onClick={() => void search(term)}
          disabled={busy}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? '查询中…' : '查询'}
        </button>
      </div>

      {response === null ? (
        <p className="text-sm text-slate-500">断网也能查——词库就在本地。</p>
      ) : response.entry ? (
        <EntryCard entry={response.entry} />
      ) : (
        <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-300">
            词库里没有「{response.query}」
            {response.suggestions.length > 0 ? '，你是不是想查：' : '。'}
          </p>
          {response.suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {response.suggestions.map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => {
                    setTerm(word)
                    void search(word)
                  }}
                  className="rounded border border-slate-600 px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                >
                  {word}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
