import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS, type GrabResult, type RuntimeStatus } from '@shared/ipc-contract'
import type { LookupResponse } from '@shared/types'
import type {
  AddWordRequest,
  AddWordResult,
  LookupRecord,
  VocabularyPatch,
  Word,
  WordStatus
} from '@shared/types'

/**
 * 白名单 IPC 接口：界面能做什么，由这里唯一决定。
 * 界面永远不直接接触 Node 与 Electron。
 */
const api = {
  grabSelection: (): Promise<GrabResult> => ipcRenderer.invoke(IPC_CHANNELS.grabManual),

  getRuntimeStatus: (): Promise<RuntimeStatus> => ipcRenderer.invoke(IPC_CHANNELS.runtimeStatus),

  /** 查词：词形还原与词库查询都在主进程完成 */
  lookup: (term: string): Promise<LookupResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.dictLookup, term),

  /** 前缀候选 */
  suggest: (prefix: string, limit?: number): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.dictSuggest, prefix, limit),

  /** 把一条查询结果加入生词本：写释义快照 + 建卡片 */
  addWord: (request: AddWordRequest): Promise<AddWordResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.vocabAdd, request),

  listWords: (
    options: { query?: string; status?: WordStatus | 'all'; limit?: number } = {}
  ): Promise<Word[]> => ipcRenderer.invoke(IPC_CHANNELS.vocabList, options),

  updateWord: (id: string, patch: VocabularyPatch): Promise<Word | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.vocabUpdate, id, patch),

  archiveWord: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.vocabArchive, id),

  listLookups: (limit?: number): Promise<LookupRecord[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.historyList, limit),

  /** 订阅快捷键触发的取词结果；返回取消订阅的函数 */
  onGrabResult: (listener: (result: GrabResult) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, result: GrabResult): void => {
      listener(result)
    }
    ipcRenderer.on(IPC_CHANNELS.grabFromHotkey, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.grabFromHotkey, handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
