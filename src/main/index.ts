import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import {
  IPC_CHANNELS,
  type GrabResult,
  type HotkeyBinding,
  type RuntimeStatus
} from '@shared/ipc-contract'
import type { LookupResponse } from '@shared/types'
import { grabSelection, syntheticCopyStatus } from './services/grab'
import { registerDefaultHotkeys, unregisterAllHotkeys } from './services/hotkey'
import {
  closeDictionary,
  dictionaryStatus,
  lookupWord,
  openDictionary,
  suggestWords
} from './services/dictionary'
import {
  closeUserStore,
  openUserStore,
  userRepository,
  userStoreStatus
} from './services/user-store'
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
    hotkeys: hotkeyBindings,
    syntheticCopy: syntheticCopyStatus(),
    dictionary: dictionaryStatus(),
    userStore: userStoreStatus()
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

  // 词库在窗口创建后立刻装载：装载失败不影响程序启动，状态会通过 runtimeStatus 报给界面
  openDictionary()
  openUserStore()

  hotkeyBindings = registerDefaultHotkeys({
    word: () => void handleHotkey('word'),
    sentence: () => void handleHotkey('sentence')
  })

  ipcMain.handle(IPC_CHANNELS.grabManual, (): Promise<GrabResult> =>
    grabSelection('manual', { ownWindowFocused: mainWindow?.isFocused() ?? false })
  )
  ipcMain.handle(IPC_CHANNELS.runtimeStatus, (): RuntimeStatus => buildRuntimeStatus())
  ipcMain.handle(IPC_CHANNELS.dictLookup, (_event, term: unknown): LookupResponse => {
    const response = lookupWord(typeof term === 'string' ? term : '')

    // 查到词就顺手记一笔历史。只记命中：查不到的东西不是"我查过的词"，
    // 混进去只会让历史列表变成输入法垃圾场。
    // 历史写不进去（库里出问题）也不该让查词失败，所以吞掉异常。
    if (response.entry) {
      try {
        userRepository()?.recordLookup({
          term: response.query,
          lemma: response.entry.lemma ?? response.entry.word
        })
      } catch {
        // 忽略：历史是附加价值，不是查词的必要条件
      }
    }

    return response
  })
  ipcMain.handle(IPC_CHANNELS.dictSuggest, (_event, prefix: unknown, limit: unknown): string[] =>
    suggestWords(typeof prefix === 'string' ? prefix : '', typeof limit === 'number' ? limit : 8)
  )

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
  closeDictionary()
  closeUserStore()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
