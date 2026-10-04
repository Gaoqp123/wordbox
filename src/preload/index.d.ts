import type { ElectronAPI } from '@electron-toolkit/preload'
import type { GrabResult, RuntimeStatus } from '@shared/ipc-contract'
import type { LookupResponse } from '@shared/types'
import type {
  AddWordRequest,
  AddWordResult,
  LookupRecord,
  VocabularyPatch,
  Word,
  WordStatus
} from '@shared/types'

export interface WordboxApi {
  grabSelection: () => Promise<GrabResult>
  getRuntimeStatus: () => Promise<RuntimeStatus>
  lookup: (term: string) => Promise<LookupResponse>
  suggest: (prefix: string, limit?: number) => Promise<string[]>
  addWord: (request: AddWordRequest) => Promise<AddWordResult>
  listWords: (options?: {
    query?: string
    status?: WordStatus | 'all'
    limit?: number
  }) => Promise<Word[]>
  updateWord: (id: string, patch: VocabularyPatch) => Promise<Word | null>
  archiveWord: (id: string) => Promise<boolean>
  listLookups: (limit?: number) => Promise<LookupRecord[]>
  onGrabResult: (listener: (result: GrabResult) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: WordboxApi
  }
}
