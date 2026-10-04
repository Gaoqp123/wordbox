import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { openUserDatabase } from '../data/user-db'
import { UserRepository } from '../data/user-repository'

/**
 * 可写库（user.db）的生命周期。
 *
 * 位置放在 Electron 的 userData 目录，而不是程序目录：
 * 程序可以随意升级、重装、换版本，你的数据必须留在原地。
 */

let connection: DatabaseSync | null = null
let repository: UserRepository | null = null
let error: string | undefined

export function userDatabasePath(): string {
  return join(app.getPath('userData'), 'user.db')
}

export function openUserStore(): void {
  try {
    connection = openUserDatabase(userDatabasePath())
    repository = new UserRepository(connection)
    error = undefined
  } catch (cause) {
    connection = null
    repository = null
    error = cause instanceof Error ? cause.message : String(cause)
  }
}

export function closeUserStore(): void {
  connection?.close()
  connection = null
  repository = null
}

/** 库里还没装载好时返回 null——调用方要能容忍"历史记不了"，它不该拖垮查词 */
export function userRepository(): UserRepository | null {
  return repository
}

export function userStoreStatus(): { ready: boolean; path: string; error?: string } {
  return { ready: repository !== null, path: userDatabasePath(), error }
}
