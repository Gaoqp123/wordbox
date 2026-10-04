import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import {
  IPC_CHANNELS,
  type GrabResult,
  type HotkeyBinding,
  type RuntimeStatus
} from '@shared/ipc-contract'
import { grabSelection } from './services/grab'
import { registerDefaultHotkeys, unregisterAllHotkeys } from './services/hotkey'
import { createMainWindow } from './windows/main-window'

let mainWindow: BrowserWindow | null = null
let hotkeyBindings: HotkeyBinding[] = []

/**
 * 取词必须先于窗口显示完成：我们的窗口一旦拿到焦点，模拟的 Ctrl+C 就打到我们自己身上了。
 * 所以顺序固定为"取词 -> 再显示窗口"。
 */
async function handleHotkey(trigger: 'word' | 'sentence'): Promise<void> {
  const result = await grabSelection(trigger, {
    ownWindowFocused: mainWindow?.isFocused() ?? false
  })

  if (mainWindow && !mainWindow.isDestroyed()) {
    // showInactive：显示结果但不抢走阅读器/浏览器的焦点，方便连续取词
    mainWindow.showInactive()
    mainWindow.webContents.send(IPC_CHANNELS.grabFromHotkey, result)
  }
}

function buildRuntimeStatus(): RuntimeStatus {
  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    hotkeys: hotkeyBindings
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.gaoqp.wordbox')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  mainWindow = createMainWindow()
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  hotkeyBindings = registerDefaultHotkeys({
    word: () => void handleHotkey('word'),
    sentence: () => void handleHotkey('sentence')
  })

  ipcMain.handle(IPC_CHANNELS.grabManual, (): Promise<GrabResult> =>
    grabSelection('manual', { ownWindowFocused: mainWindow?.isFocused() ?? false })
  )
  ipcMain.handle(IPC_CHANNELS.runtimeStatus, (): RuntimeStatus => buildRuntimeStatus())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      mainWindow.on('closed', () => {
        mainWindow = null
      })
    }
  })
})

app.on('will-quit', () => {
  unregisterAllHotkeys()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
