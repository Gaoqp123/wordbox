/**
 * 词形还原的兜底规则。
 *
 * 主力是词库自带的 lemma 表（ECDICT 逐词条标注的变形关系，连 better → good、
 * mice → mouse 这类不规则变化都有）。这里只处理词表漏掉的常规变形，
 * 是"查不到再退一步"的第三道防线，优先级排在词表之后。
 *
 * 为什么要留这道防线：词表来自语料统计，总有覆盖不到的新词或生僻变形；
 * 而规则推断能覆盖绝大多数规则变化。规则永远不如查表准，所以只在前两步失败后才用。
 */

function isVowel(character: string): boolean {
  return 'aeiou'.includes(character)
}

/** 末尾是否辅音重复，如 runn、stopp —— 这类词去后缀时要去掉一个字母 */
function hasDoubledEnding(stem: string): boolean {
  if (stem.length < 2) return false
  const last = stem[stem.length - 1]
  const previous = stem[stem.length - 2]
  return last === previous && !isVowel(last)
}

/**
 * 按可能性从高到低给出候选原形。
 *
 * 返回的是**候选列表**而不是单一答案：调用方按顺序去词库验证，谁先命中用谁——
 * 这样规则可以写得宽松些，也不会因为一个错误的猜测而查不到词。
 */
export function lemmaCandidates(term: string): string[] {
  const word = term.trim().toLowerCase()
  const candidates: string[] = []

  const add = (value: string): void => {
    const candidate = value.trim()
    if (candidate.length >= 2 && candidate !== word && !candidates.includes(candidate)) {
      candidates.push(candidate)
    }
  }

  // 所有格：teacher's / teachers'
  if (word.endsWith("'s")) add(word.slice(0, -2))
  if (word.endsWith("s'")) add(word.slice(0, -1))

  // 复数与第三人称单数
  if (word.endsWith('ies')) add(`${word.slice(0, -3)}y`)
  if (word.endsWith('ves')) {
    add(`${word.slice(0, -3)}f`)
    add(`${word.slice(0, -3)}fe`)
  }
  if (word.endsWith('es')) {
    add(word.slice(0, -2))
    add(word.slice(0, -1))
  }
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && !word.endsWith('is')) {
    add(word.slice(0, -1))
  }

  // 过去式与过去分词
  if (word.endsWith('ied')) add(`${word.slice(0, -3)}y`)
  if (word.endsWith('ed')) {
    const stem = word.slice(0, -2)
    add(stem)
    add(`${stem}e`)
    if (hasDoubledEnding(stem)) add(stem.slice(0, -1))
  }

  // 现在分词：making → make、running → run
  if (word.endsWith('ing')) {
    const stem = word.slice(0, -3)
    add(stem)
    add(`${stem}e`)
    if (hasDoubledEnding(stem)) add(stem.slice(0, -1))
  }

  // 比较级与最高级
  if (word.endsWith('iest')) add(`${word.slice(0, -4)}y`)
  if (word.endsWith('ier')) add(`${word.slice(0, -3)}y`)
  if (word.endsWith('est')) {
    const stem = word.slice(0, -3)
    add(stem)
    add(`${stem}e`)
    if (hasDoubledEnding(stem)) add(stem.slice(0, -1))
  }
  if (word.endsWith('er')) {
    const stem = word.slice(0, -2)
    add(stem)
    add(`${stem}e`)
    if (hasDoubledEnding(stem)) add(stem.slice(0, -1))
  }

  return candidates
}
