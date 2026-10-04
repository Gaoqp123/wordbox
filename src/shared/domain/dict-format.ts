/**
 * 词条数据的解析与呈现规则。
 *
 * 纯函数、零依赖，因为"释义怎么拆、标签怎么显示"这类判断最容易出错，
 * 也最值得单测覆盖——它们直接决定用户看到什么。
 */

/** 把建库时换成的真实换行拆成义项列表 */
export function splitSenses(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/** ECDICT 的 tag 字段是空格分隔的字符串 */
export function parseTags(tag: string | null | undefined): string[] {
  if (!tag) return []
  return tag
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

const TAG_LABELS: Readonly<Record<string, string>> = {
  zk: '中考',
  gk: '高考',
  cet4: '四级',
  cet6: '六级',
  ky: '考研',
  toefl: '托福',
  ielts: '雅思',
  gre: 'GRE'
}

export function tagLabel(tag: string): string {
  return TAG_LABELS[tag] ?? tag
}

const LEMMA_KIND_LABELS: Readonly<Record<string, string>> = {
  p: '过去式',
  d: '过去分词',
  i: '现在分词',
  '3': '第三人称单数',
  s: '复数',
  r: '比较级',
  t: '最高级'
}

/**
 * 变形类型的中文说明。
 *
 * 有这一层，界面上就能写"running 是 run 的现在分词"，
 * 而不是只有"已还原为 run"——ECDICT 的 exchange 字段本来就带了这个信息，不用白不用。
 */
export function lemmaKindLabel(kind: string | null | undefined): string | undefined {
  if (!kind) return undefined
  return LEMMA_KIND_LABELS[kind]
}

/** 简洁层：取前几个义项拼成一行 */
export function briefTranslation(senses: string[], max = 2): string {
  return senses.slice(0, max).join('；')
}
