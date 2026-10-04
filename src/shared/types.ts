/**
 * 跨进程共用的实体类型。
 *
 * 这里只放"传得过去"的纯数据：主进程查完词库，把结果整理成 DictEntry 交给界面，
 * 界面不需要知道 SQLite 长什么样，也不需要知道查询走过哪几步。
 */

/** 一条词条。字段名与 ECDICT 对齐，另外补上"用户当初查的形态"与还原信息。 */
export type DictEntry = {
  /** 词库里真正的词条，例如查 running 命中 run 时这里是 run */
  word: string
  /** 用户实际查询的形态，例如 running */
  query: string
  phonetic?: string
  /** 词性占比，形如 n:46/v:54 */
  pos?: string
  collins?: number
  /** 是否牛津三千核心词 */
  oxford: boolean
  /** 考试标签，已拆成数组：cet4 / cet6 / ky / toefl / ielts / gre */
  tags: string[]
  bnc?: number
  frq?: number
  /** 词形变化原文，供"详细"层展示 */
  exchange?: string
  /** 中文释义，已按义项拆行 */
  sensesZh: string[]
  /** 英文释义，已按义项拆行 */
  sensesEn: string[]
  /** 若发生过词形还原，原形是谁（与 word 相同则省略） */
  lemma?: string
  /** 还原依据：ecdict 词形表 / lemma.en.txt 补充表 / 规则推断 */
  lemmaSource?: LemmaSource
  /** 变形类型：i 现在分词 / s 复数 / r 比较级 / t 最高级 / d 过去分词 / p 过去式 / 3 三单 */
  lemmaKind?: string
}

export type LemmaSource = 'ecdict' | 'lemma.en.txt' | 'heuristic'

export type LookupResponse = {
  /** 用户输入的原始文本 */
  query: string
  /** 查到了就是词条，没查到是 null */
  entry: DictEntry | null
  /** 没查到时给出的候选（按常用度排序） */
  suggestions: string[]
}

/** 词库文件的装载状态，界面用它显示"词典是否就绪" */
export type DictStatus = {
  ready: boolean
  /** 词库文件路径 */
  path: string
  /** 词条总数 */
  entries: number
  error?: string
}
