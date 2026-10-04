/**
 * M0 技术验证：SQLite 驱动选型。
 *
 * 要回答的问题：Electron 内置的 Node 里，`node:sqlite` 能不能直接当数据库用。
 *
 *   A. node:sqlite     —— Electron 自带，免原生模块、免 ABI 重编译
 *   B. better-sqlite3  —— 成熟稳定，但属于原生模块，需要按 Electron ABI 重编译
 *
 * 为什么必须真跑一次：Node 官方有没有这个模块，和"Electron 内置的 Node 里能不能 require 到"
 * 是两件事。Electron 对 Node 的编译选项与官方发行版并不完全一致。
 *
 * 用法：pnpm exec electron scripts/spike/sqlite-check.cjs
 * 结果同时打印到控制台并写入 out/sqlite-spike.txt（Windows 上 Electron 的 stdout 有时不回显，
 * 写文件是为了稳妥地拿到结论）。
 */

const { app } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const lines = []

function log(text = '') {
  lines.push(text)
}

function checkNodeSqlite() {
  let sqlite
  try {
    sqlite = require('node:sqlite')
  } catch (error) {
    log(`  ✗ require('node:sqlite') 失败：${error.message}`)
    return false
  }

  if (typeof sqlite.DatabaseSync !== 'function') {
    log('  ✗ 模块加载成功，但没有 DatabaseSync 构造器')
    return false
  }
  log('  ✓ 模块可加载，DatabaseSync 可用')

  try {
    const db = new sqlite.DatabaseSync(':memory:')
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, word TEXT NOT NULL)')
    const insert = db.prepare('INSERT INTO t (word) VALUES (?)')
    insert.run('ubiquitous')
    insert.run('ephemeral')
    const rows = db.prepare('SELECT word FROM t ORDER BY word').all()
    db.close()
    log(`  ✓ 内存库读写正常：${rows.map((row) => row.word).join(', ')}`)
  } catch (error) {
    log(`  ✗ 内存库读写失败：${error.message}`)
    return false
  }

  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wordbox-sqlite-'))
    const file = path.join(dir, 'probe.db')

    const created = new sqlite.DatabaseSync(file)
    created.exec('CREATE TABLE t (word TEXT)')
    created.prepare('INSERT INTO t (word) VALUES (?)').run('断网可用')
    created.close()
    const size = fs.statSync(file).size

    const reopened = new sqlite.DatabaseSync(file)
    const row = reopened.prepare('SELECT word FROM t').get()
    reopened.close()
    fs.rmSync(dir, { recursive: true, force: true })

    log(`  ✓ 文件库读写正常（${size} 字节），中文往返：${row.word}`)
  } catch (error) {
    log(`  ✗ 文件库读写失败：${error.message}`)
    return false
  }

  return true
}

function writeReport(text) {
  const outDir = path.join(process.cwd(), 'out')
  try {
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, 'sqlite-spike.txt'), text, 'utf8')
  } catch (error) {
    console.error('写入报告失败：', error.message)
  }
}

app.whenReady().then(() => {
  log('WordBox · M0 SQLite 驱动验证')
  log(
    `Electron ${process.versions.electron} · Node ${process.versions.node} · Chromium ${process.versions.chrome}`
  )
  log()
  log('[A] node:sqlite（Electron 内置）')

  const nodeSqliteOk = checkNodeSqlite()

  log()
  log(
    nodeSqliteOk
      ? '结论：选 A —— node:sqlite 可用，免原生模块、免重编译。'
      : '结论：选 B —— node:sqlite 不可用，改用 better-sqlite3（需按 Electron ABI 重编译）。'
  )

  const report = lines.join('\n')
  console.log(report)
  writeReport(report)

  app.exit(nodeSqliteOk ? 0 : 1)
})
