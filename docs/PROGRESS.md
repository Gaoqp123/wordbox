# WordBox 进度记录

> 配套文档：[PROJECT_PLAN.md](./PROJECT_PLAN.md)（为什么这么做）、本文件（做到哪一步了）。
> 规则：每个工作片段结束就更新本文件。只写事实、证据、产出和下一步，不写感想。
> 最后更新：2026-10-04

---

## 1. 当前状态

| 项目 | 值 |
|---|---|
| 当前阶段 | M0 骨架 + 取词验证 |
| 阶段进度 | 2 / 7 |
| 本次已完成 | 仓库初始化 |
| 下一步 | 脚手架：electron-vite + React + TS + Tailwind + 质量工具 |
| 阻塞项 | 无 |
| 待拍板 | 3 项，见第 5 节 |

---

## 2. 里程碑总览

| 里程碑 | 内容 | 状态 | 完成日 |
|---|---|---|---|
| M0 | 骨架 + 取词验证 | 进行中 | — |
| M1 | 离线词典 | 未开始 | — |
| M2 | 生词本 + 复习闭环 | 未开始 | — |
| M3 | 快速查询窗 | 未开始 | — |
| M4 | 打磨与发布 | 未开始 | — |

### M0 任务清单

- [x] 环境准备与核对（2026-10-04）
- [x] 仓库初始化：`git init`、MIT LICENSE、`.gitignore`、`.editorconfig`、README（2026-10-04，另加 `.gitattributes`）
- [ ] 脚手架：electron-vite + React + TS + Tailwind + ESLint / Prettier / Vitest
- [ ] 三段式骨架跑通：主窗口能开、preload 能通信、渲染进程能读写主进程数据
- [ ] CI：lint / typecheck / test / build
- [ ] `docs/adr/`：规划第 2 节的 13 条决策各一条
- [ ] 技术验证：模拟 Ctrl+C 取词（Readest / 浏览器）+ SQLite 方案二选一

### M1-M4 任务清单

展开后的清单在 [PROJECT_PLAN.md](./PROJECT_PLAN.md) 第 7 节；进入对应里程碑时复制到本文件。

---

## 3. 环境基线（2026-10-04 实测）

在真实终端（非 Codex 沙箱）下测得：

| 项目 | 实测值 | 判定 |
|---|---|---|
| Node.js | v24.15.0 | 可用 |
| npm | 12.0.2（`%APPDATA%\npm` 那份生效；node 自带 11.12.1 并存） | 可用 |
| pnpm | 11.22.0（由 corepack 托管，非独立安装） | 可用 |
| git | 2.53.0.windows.3 | 可用 |
| git 身份 | `Gaoqp123` / `3539722845@qq.com` | 已配置 |
| Python | 3.14.4（内置 sqlite3 3.50.4） | 可用 |
| npm registry | npmmirror | 已配置 |
| pnpm store | `%LOCALAPPDATA%\pnpm\store\v11` | 已就位 |
| 磁盘剩余 | 326 GB | 充足 |

**结论**：规划第 5.2 节里"pnpm 未真正安装""npm 入口有问题"两条是 Codex 沙箱内的探测假象，
真实终端下两者都正常。不需要安装或修改任何东西。

---

## 4. 会话日志

### 2026-10-04 · 仓库初始化（第二步）

- 做了：`git init -b main`；新增 MIT LICENSE、`.gitignore`、`.editorconfig`、`.gitattributes`、README 门面；
  把规划与进度两份文档一并纳入首次提交。
- 产出：提交 `d1f91e6`（6 个文件、930 行）与 `b6e6ed9`（`.gitattributes`）；分支 `main`。
- 踩到的坑（都已解决）：
  - 沙箱把 `.git` 目录设为只读，git 的写操作（`add` / `commit`）必须提权执行。
  - `git init` 由沙箱账号执行，`.git` 属主变成 `CodexSandboxOffline`，**连你自己的终端都会报 dubious ownership**；
    已删除这个零提交的空仓库，改用你的账号重建。
  - 沙箱创建的文件属主同样是 `CodexSandboxOffline`（写权限正常，属主只是元数据）；
    已用 `icacls /setowner` 统一改回 `Gaoqp`。
- 结论：仓库可用，工作区干净，无残留。

### 2026-10-04 · 建立进度记录

- 做了：新增本文件，作为与规划文档配套的进度跟踪；在规划文档的目录结构、环境章节、文档规范三处挂上引用。
- 结论：规划文档回答"为什么这么做"，本文件回答"做到哪一步了"；此后每个工作片段都要在这里留痕。
- 产出：`docs/PROGRESS.md`（新建）、`docs/PROJECT_PLAN.md`（3 处引用与 1 处环境复核说明）。

### 2026-10-04 · 环境核对（第一步）

- 做了：逐项核对 node / npm / pnpm / git / Python / registry / 磁盘；定位两个疑似故障的真实原因。
- 结论：环境健康，无需安装 pnpm，无需改 npm 配置。
- 插曲：一度把 npm 全局前缀改成 `C:\z_software\nodejs`，随后发现该目录普通用户无写权限（`npm i -g` 会失败），
  已还原为默认值；`%USERPROFILE%\.npmrc` 现存内容仅为 `registry=https://registry.npmmirror.com`。
- 产出：无文件改动（当时的项目目录仍只有 `docs/PROJECT_PLAN.md`）。

### 2026-10-03 → 10-04 · 规划定稿

- 产出：`docs/PROJECT_PLAN.md` v0.2.1（文件时间 2026-10-04 00:13）。
- 内容：定位、需求分级、13 条决策、架构、数据模型、技术设计、里程碑 M0-M4、测试验收、风险对策。

---

## 5. 待拍板的问题

| # | 问题 | 建议默认值 | 状态 |
|---|---|---|---|
| 1 | 现在就建 GitHub 远端仓库，还是先本地攒几天 | 先本地，M0 骨架绿了再推 | 待定 |
| 2 | 取词模拟方案：原生输入模拟库 vs PowerShell 辅助进程 | 由 M0 技术验证实测决定 | 待定 |
| 3 | `ecdict.db` 打包策略：CI 现跑数据管线 vs 作为 Release 资产下载 | M4 前必须定，现在缓 | 待定 |

---

## 6. 已知约束与坑

| 项 | 现象 | 处理 |
|---|---|---|
| Codex 沙箱隔离 `%APPDATA%` / `%LOCALAPPDATA%\node\corepack` | 沙箱内裸调 `npm` 报 `MODULE_NOT_FOUND`；`pnpm` 一律 EPERM（corepack 要写 `lastKnownGood.json`）；且这些路径在沙箱里 `Test-Path` 返回 True 而 `dir` 说找不到 | 无法靠配置绕过（沙箱只允许写工作区与临时目录）。涉及 pnpm 的操作要么提权执行，要么在你自己的终端里跑 |
| 沙箱把仓库 `.git` 设为只读 | git 的写操作（`add`、`commit`、`tag`、`push`）在沙箱内一律 `Permission denied` | 只读命令（`status`、`log`、`diff`）需要前缀 `git -c safe.directory='*'`；写操作提权执行 |
| 沙箱创建的文件属主为 `CodexSandboxOffline` | 不影响读写（有写权限），但属主不是你 | 工作片段收尾时用 `icacls <文件> /setowner` 改回 `Gaoqp` |
| `C:\z_software\nodejs` 目录权限 | 仅 Administrators 有完全控制权 | 不要把它设为 npm 全局前缀；不要往那里装东西 |
| 两份 npm 并存 | 终端里生效的是 12.0.2，node 自带 11.12.1 | 日常无影响，不处理 |

---

## 7. 更新规则

1. 每个工作片段结束：更新第 1 节的「当前状态」与「下一步」，勾选第 2 节的清单。
2. 每个工作片段结束：在第 4 节**追加**一条会话日志（日期 + 做了 + 结论 + 产出），不覆盖历史。
3. 出现新的待拍板事项或阻塞：写进第 5 / 6 节，解决后标注状态，不删行。
4. 里程碑完成：在总览表填上完成日，并把下一个里程碑的清单从规划文档复制过来展开。
