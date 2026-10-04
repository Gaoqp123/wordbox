import type { ElectronAPI } from '@electron-toolkit/preload'
import type { GrabResult, RuntimeStatus } from '@shared/ipc-contract'
import type { LookupResponse } from '@shared/types'

export interface WordboxApi {
  grabSelection: () => Promise<GrabResult>
  getRuntimeStatus: () => Promise<RuntimeStatus>
  lookup: (term: string) => Promise<LookupResponse>
  suggest: (prefix: string, limit?: number) => Promise<string[]>
  onGrabResult: (listener: (result: GrabResult) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: WordboxApi
  }
}
