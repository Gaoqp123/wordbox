import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS, type GrabResult, type RuntimeStatus } from '@shared/ipc-contract'

/**
 * 白名单 IPC 接口：界面能做什么，由这里唯一决定。
 * 界面永远不直接接触 Node 与 Electron。
 */
const api = {
  grabSelection: (): Promise<GrabResult> => ipcRenderer.invoke(IPC_CHANNELS.grabManual),

  getRuntimeStatus: (): Promise<RuntimeStatus> => ipcRenderer.invoke(IPC_CHANNELS.runtimeStatus),

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
