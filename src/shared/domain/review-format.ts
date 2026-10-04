/**
 * 复习相关的纯展示逻辑。
 *
 * 单独放一个模块、**不引任何第三方库**是刻意的：这些小函数界面要用，
 * 如果和 `srs.ts` 放在一起，前端打包时会顺着 import 把整个 ts-fsrs 拖进渲染进程的包。
 * 规划里写着"界面不直接引 ts-fsrs"，这里就是那条边界的落点。
 */

/** 1 忘了 / 2 有点难 / 3 记得 / 4 太简单 */
export type Grade = 1 | 2 | 3 | 4

export const GRADES: readonly Grade[] = [1, 2, 3, 4]

export const GRADE_LABELS: Readonly<Record<Grade, string>> = {
  1: '忘了',
  2: '有点难',
  3: '记得',
  4: '太简单'
}

/** 把"下次什么时候再来"说成人话 */
export function describeInterval(from: number, to: number): string {
  const minutes = Math.max(0, Math.round((to - from) / 60000))
  if (minutes < 1) return '马上'
  if (minutes < 60) return `${minutes} 分钟后`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时后`

  return `${Math.round(hours / 24)} 天后`
}
