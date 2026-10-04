import { useCallback, useEffect, useState } from 'react'
import { GRADES, GRADE_LABELS, describeInterval, type Grade } from '@shared/domain/review-format'
import type { ReviewQueueItem } from '@shared/types'

/**
 * 复习页。
 *
 * 设计上只有一件事要守住：**不定量、不打卡**。
 * 这里没有"今天必须复习 N 张"，也没有连续打卡天数——打开就有到期卡，随时可以停。
 * 所以界面上刻意不显示"还剩多少没做"的压迫感，只有一句"本次已复习 N 张"。
 */

function startOfToday(now: number): number {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export default function ReviewPanel(): React.JSX.Element {
  const [queue, setQueue] = useState<ReviewQueueItem[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [lastMessage, setLastMessage] = useState<string | null>(null)

  useEffect(() => {
    void window.api.dueCards(50).then(setQueue)
    void window.api.reviewedSince(startOfToday(Date.now())).then(setReviewedCount)
  }, [])

  const current = queue[index]

  const grade = useCallback(
    async (rating: Grade): Promise<void> => {
      if (!current) return
      const now = Date.now()
      const result = await window.api.gradeCard(current.card.id, rating)

      if (result) {
        setReviewedCount((value) => value + 1)
        setLastMessage(
          `${current.word.lemma} · 评「${GRADE_LABELS[rating]}」→ 下次${describeInterval(now, result.card.due)}`
        )
      }
      setRevealed(false)
      setIndex((value) => value + 1)
    },
    [current]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!current) return
      if (event.code === 'Space') {
        event.preventDefault()
        setRevealed(true)
        return
      }
      if (!revealed) return
      const rating = Number(event.key)
      if (rating >= 1 && rating <= 4) {
        event.preventDefault()
        void grade(rating as Grade)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [current, revealed, grade])

  if (queue.length === 0) {
    return (
      <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 text-sm text-slate-400">
        没有到期的卡片。去「生词本」里加几个词，它们会立刻变成待复习的卡。
      </p>
    )
  }

  if (!current) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-5 text-sm text-emerald-200">
          这一轮复习完了，共 {reviewedCount} 张。随时可以停下——没有打卡，明天再来也行。
        </p>
        <button
          type="button"
          onClick={() => {
            setIndex(0)
            setLastMessage(null)
            void window.api.dueCards(50).then(setQueue)
          }}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600"
        >
          再看看有没有新的到期卡
        </button>
      </div>
    )
  }

  const hasContext = current.word.contexts.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between text-xs text-slate-500">
        <span>
          本轮第 {index + 1} 张 / 共 {queue.length} 张
        </span>
        <span>今天已复习 {reviewedCount} 张</span>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-8 text-center">
        <p className="text-3xl font-semibold">{current.word.lemma}</p>
        {current.word.display.toLowerCase() !== current.word.lemma.toLowerCase() ? (
          <p className="mt-1 text-xs text-slate-500">你遇到的是 {current.word.display}</p>
        ) : null}

        {hasContext ? (
          <p className="mx-auto mt-4 max-w-xl border-l-2 border-slate-700 pl-3 text-left text-sm text-slate-400">
            {current.word.contexts[0].sentence}
          </p>
        ) : null}

        {revealed ? (
          <div className="mt-6 space-y-2">
            {current.word.phonetic ? (
              <p className="text-sm text-slate-400">/{current.word.phonetic}/</p>
            ) : null}
            <p className="text-lg text-slate-100">{current.word.briefZh}</p>
            {current.word.note ? (
              <p className="text-sm text-amber-200/80">备注：{current.word.note}</p>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="mt-6 rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            显示答案（空格）
          </button>
        )}
      </div>

      {revealed ? (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => void grade(rating)}
              className="rounded-lg border border-slate-600 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              <span className="mr-1 text-slate-500">{rating}</span>
              {GRADE_LABELS[rating]}
            </button>
          ))}
        </div>
      ) : null}

      {lastMessage ? <p className="text-xs text-slate-500">{lastMessage}</p> : null}
    </div>
  )
}
