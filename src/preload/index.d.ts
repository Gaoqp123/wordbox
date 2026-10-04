import type { ElectronAPI } from '@electron-toolkit/preload'
import type { GrabResult, RuntimeStatus } from '@shared/ipc-contract'

export interface WordboxApi {
  grabSelection: () => Promise<GrabResult>
  getRuntimeStatus: () => Promise<RuntimeStatus>
  onGrabResult: (listener: (result: GrabResult) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: WordboxApi
  }
}
