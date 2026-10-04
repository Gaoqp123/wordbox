import { toWordSnapshot } from '@shared/domain/vocabulary'
import type {
  AddWordRequest,
  AddWordResult,
  LookupRecord,
  VocabularyPatch,
  Word,
  WordStatus
} from '@shared/types'
import { userRepository } from './user-store'

/**
 * 生词本服务。
 *
 * 与查词服务分开：查词是只读词库、随时可用；生词本是可写库，可能因为文件权限等原因没起来。
 * "一个坏了另一个还能用"这条边界在这里被明确表达，而不是混在一起。
 */

export function addWord(request: AddWordRequest, now: number = Date.now()): AddWordResult {
  const repository = userRepository()
  if (!repository) {
    return { status: 'error', message: '可写库未就绪，无法加入生词本' }
  }

  try {
    const snapshot = toWordSnapshot(request.entry, {
      note: request.note,
      userTags: request.userTags,
      source: request.source,
      context: request.context
    })

    // 查重按原形：running 和 run 是同一个词，不该在生词本里出现两条
    const existing = repository.findActiveByLemma(snapshot.lemma)
    if (existing) {
      return { status: 'duplicate', word: existing }
    }

    const { word, card } = repository.addWord(snapshot, now)
    return { status: 'added', word, card }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}

export function listWords(
  options: { query?: string; status?: WordStatus | 'all'; limit?: number } = {}
): Word[] {
  return userRepository()?.listWords(options) ?? []
}

export function updateWord(
  id: string,
  patch: VocabularyPatch,
  now: number = Date.now()
): Word | null {
  return userRepository()?.updateWord(id, patch, now) ?? null
}

export function archiveWord(id: string, now: number = Date.now()): boolean {
  return userRepository()?.archiveWord(id, now) ?? false
}

export function listLookups(limit = 100): LookupRecord[] {
  return userRepository()?.listLookups(limit) ?? []
}
