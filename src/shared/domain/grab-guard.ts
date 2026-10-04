import type { GrabFailureReason } from '../ipc-contract'

/**
 * 取词结果的判定与清理。
 *
 * 这里是纯函数、零 IO、零 Electron 依赖：给一段"取词前的剪贴板"和"取词后的剪贴板"，
 * 判断这次到底有没有真的取到东西、取到的东西能不能用。
 * 真实环境里"没选中任何东西"是最常见的失败，必须在这一层被识别出来，
 * 而不是把用户剪贴板里的旧内容当成查询结果。
 */

/** 排版字符归一：弯引号、破折号、省略号、不间断空格等 */
const TYPOGRAPHY_MAP: ReadonlyArray<readonly [RegExp, string]> = [
  [/[\u2018\u2019\u201B\u2032]/g, "'"],
  [/[\u201C\u201D\u2033]/g, '"'],
  [/[\u2010-\u2015\u2212]/g, '-'],
  [/\u2026/g, '...'],
  [/\u00A0/g, ' ']
]

/** 首尾常见标点与装饰字符 */
const EDGE_PUNCTUATION = /^[\s"'`.,;:!?()[\]{}<>/\\|*_~-]+|[\s"'`.,;:!?()[\]{}<>/\\|*_~-]+$/g

export function normalizeTypography(input: string): string {
  return TYPOGRAPHY_MAP.reduce((text, [pattern, replacement]) => {
    return text.replace(pattern, replacement)
  }, input)
}

export function stripEdgePunctuation(input: string): string {
  return input.replace(EDGE_PUNCTUATION, '')
}

/**
 * 把抓到的原始文本清理成可查询的形态：
 * 归一排版字符、把连续空白（含换行）压成单个空格、去掉首尾空白与标点。
 */
export function cleanCapturedText(raw: string): string {
  return stripEdgePunctuation(normalizeTypography(raw).replace(/\s+/g, ' ').trim())
}

export function hasLetters(text: string): boolean {
  return /[A-Za-z]/.test(text)
}

/** 诊断信息里展示文本时的截断长度 */
export const PREVIEW_MAX = 60

/** 把一段文本压成单行并截断，只用于诊断展示 */
export function previewText(input: string, max: number = PREVIEW_MAX): string {
  const flattened = input.replace(/\r?\n/g, '\\n')
  return flattened.length <= max ? flattened : `${flattened.slice(0, max)}…`
}

export type CaptureVerdict = { ok: true; text: string } | { ok: false; reason: GrabFailureReason }

/**
 * 判断一次取词是否成功。
 *
 * 顺序很重要：先比"有没有变化"，再看内容。这两步都不能省——
 * 只看内容会把用户剪贴板里原有的旧文本误判成本次查询结果。
 */
export function judgeCapture(before: string, after: string): CaptureVerdict {
  if (after === before) {
    return { ok: false, reason: 'clipboard-unchanged' }
  }

  const text = cleanCapturedText(after)
  if (text.length === 0) {
    return { ok: false, reason: 'empty' }
  }
  if (!hasLetters(text)) {
    return { ok: false, reason: 'no-letters' }
  }

  return { ok: true, text }
}
