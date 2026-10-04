# WordBox 进度记录

> 配套文档：[PROJECT_PLAN.md](./PROJECT_PLAN.md)（为什么这么做）、本文件（做到哪一步了）。
> 规则：每个工作片段结束就更新本文件。只写事实、证据、产出和下一步，不写感想。
> 最后更新：2026-10-04

---

## 1. 当前状态

| 项目 | 值 |
|---|---|
| 当前阶段 | M2 生词本 + 复习闭环 |
| 阶段进度 | M2 4 / 6 |
| 本次已完成 | 加入生词本（释义快照 + 建卡）与生词本列表；查询历史列表 |
| 下一步 | 复习页（需要先装 `ts-fsrs`），然后导出/导入 JSON |
| 阻塞项 | 无 |
| 待拍板 | 2 项，见第 5 节（第 1 项已决） |

---

## 2. 里程碑总览

| 里程碑 | 内容 | 状态 | 完成日 |
|---|---|---|---|
| M0 | 骨架 + 取词验证 | 已完成 | 2026-10-04 |
| M1 | 离线词典 | 未开始 | — |
| M2 | 生词本 + 复习闭环 | 未开始 | — |
| M3 | 快速查询窗 | 未开始 | — |
| M4 | 打磨与发布 | 未开始 | — |

### M0 任务清单

- [x] 环境准备与核对（2026-10-04）
- [x] 仓库初始化：`git init`、MIT LICENSE、`.gitignore`、`.editorconfig`、README（2026-10-04，另加 `.gitattributes`）
- [x] 脚手架：electron-vite + React + TS + Tailwind + ESLint / Prettier / Vitest（2026-10-04）
- [x] 三段式骨架跑通：主窗口能开、preload 能通信、渲染进程能收主进程推送（2026-10-04）
- [x] CI：lint / typecheck / test / build（2026-10-04，首次运行 54 秒全绿）
- [x] `docs/adr/`：规划第 2 节的 14 条决策各一条（2026-10-04，含 M0 实测新增的 D14）
- [x] 技术验证（取词部分，2026-10-04）：**结论 = 模拟按键不能做主路径，改用剪贴板兜底**
- [x] 技术验证（SQLite 部分，2026-10-04）：选定 `node:sqlite`，免原生模块重编译

### M1 任务清单（离线词典）

- [x] 下载 ECDICT，读 README 确认字段与许可（2026-10-04，MIT License）
- [x] 写 `scripts/build_dict.py`，产出 `ecdict.db` 并记录实测体积与耗时（2026-10-04）
- [x] 主窗口查询页：输入 + 简洁/详细两级释义 + 发音（2026-10-04，实机试查通过）
- [x] `shared/domain/lemma.ts`：词形还原，单元测试（2026-10-04）
- [x] 查询历史写入（2026-10-04，随 M2 存储层完成；列表 UI 归入 M2）

**验收**：断网状态下查任意常用词都能秒出中英释义，`running` 能提示原形。

### M2 任务清单（生词本 + 复习闭环）

- [x] `user.db` schema v1 + Repository（含迁移与测试）（2026-10-04）
- [x] 查询历史写入与列表（2026-10-04）
- [x] 加入生词本：写释义快照 + 建卡片；备注与标签可编辑（2026-10-04）
- [ ] 复习页：翻卡、4 档评分、`shared/domain/srs` 调度（含单测）
- [x] 生词本列表：搜索、编辑备注与标签、归档（2026-10-04）
- [ ] 导出 / 导入 JSON

### M2-M4 任务清单

展开后的清单在 [PROJECT_PLAN.md](./PROJECT_PLAN.md) 第 7 节。

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

### 2026-10-04 · 加入生词本与生词本列表

- 做了：`shared/domain/vocabulary.ts`（释义快照构造）、`main/services/vocabulary.ts`（生词本服务）、
  四个生词本 IPC 与一个历史 IPC；界面拆成 **查词 / 生词本 / 历史 / 调试** 四个标签页，
  查词卡片上多了「＋ 加入生词本」，生词本页支持搜索、编辑备注与标签、归档。
- 四处设计取舍：
  1. **查重按原形**：running 和 run 是同一个词，不该在生词本里出现两条；
     已归档的不参与查重，所以"归档后反悔"还能重新加回来。
  2. **释义是加入那一刻的快照**（`toWordSnapshot`），不是对词库的引用——
     词库整体升级也不会改写你已经背过的卡片，导出的 JSON 也自带可读内容。
  3. **可写库没就绪时返回结构化错误，而不是抛异常**：
     "查词随时可用、生词本可能因为文件权限起不来"是真实边界，得在类型里表达出来。
  4. **IPC 入参做校验**：渲染进程传来的对象最终要写进数据库，缺关键字段就该挡在门外，
     而不是让 SQLite 抛一个没人看得懂的错。
- 两处被工具抓住的问题：`toWordSnapshot` 的 `now` 参数其实没用上（快照不带时间戳，时间由仓储写入）；
  ESLint 的 react-hooks 规则拦住了"在 effect 里直接调用会 setState 的函数"这种写法，改成 promise 回调。
- 验证：typecheck / ESLint / **66 个单元测试** / 生产构建全绿。

### 2026-10-04 · M2 地基：user.db schema v1 与迁移框架

- 做了：`src/main/data/user-db.ts`（连接 + 迁移框架）、`user-repository.ts`（查询历史 / 生词本 / 卡片）、
  `src/shared/domain/id.ts`（UUID v7）、`shared/types.ts` 补实体类型、
  `src/main/services/user-store.ts`（user.db 生命周期），并在查词命中后自动记一笔历史。
- 四处设计取舍：
  1. **主键用 UUID v7**：v4 完全随机，做主键时索引随机写入，而且按 id 排序看不出创建顺序；
     v7 把毫秒时间戳放在高位，天然按时间递增。时间戳与随机字节由调用方注入，所以能脱离运行时单测。
  2. **`contexts` / `userTags` 存 JSON 列**（规划里写明"MVP 只追加不管理"，将来要按语境复习时再拆表，
     数据结构不用改）；解析失败退化成空数组——库被手工改坏时不该让整个列表打不开。
  3. **归档 = 软删除**：`status='archived'` 加卡片停用，数据全部留着，导出与将来的同步都用得上。
  4. **历史只记命中的查询**：查不到的东西不是"我查过的词"，混进去只会让历史变成输入法垃圾场；
     而且历史写失败不影响查词（吞异常）——历史是附加价值，不是必要条件。
- 被测试抓住的 bug：UUID v7 的**变体位**我写到了第 8 个字节，应该是第 2 个（对应 UUID 第 9 字节），
  结果变体位跑到了最后一组。`id.test.ts` 的格式断言直接拦住——这种"看起来像 UUID 但格式不合规"
  的错误，不写断言根本发现不了。
- 验证：typecheck / ESLint / **58 个单元测试**（含真实文件落盘 + WAL + 重开读取）/ 生产构建全绿。

### 2026-10-04 · 修正原形提示（命中词条时也要给）

- 现象：实机查 `running`，只显示 running 自己的词条，没有任何原形提示。
- 原因：**不是 bug，是设计漏了一块**。running 在 ECDICT 里本身就是词条
  （n. 赛跑 / 流出 / 运转），查询直接命中，根本走不到"靠词形还原才查到"的分支；
  而我把原形提示只做在了那个分支里。规划写的是"查 running **提示**原形 run"，
  这层提示当时确实没做。
- 决策：**不做词条替换**。你在读句子时要知道的是 `running` 在这句话里的意思，
  换成 `run` 的释义反而更差。正确做法是显示它自己的词条，同时明确标出原形与变形类型，
  并提供"查原形 run"的跳转按钮。
- 实现：从词条自身的 `exchange` 字段解析原形与类型（新增 `parseExchangeLemma`），
  两种情况措辞分开——"已还原：X → Y"（我们真的换了词）vs "X 是 Y 的现在分词"（没换词），
  避免让用户以为词被偷偷替换了。
- 验证：新增 3 条断言（共 39 个测试全过）；直连词库核对 running / better / mice /
  loving / perceive / ubiquitous 六个词的判定，结果与预期一致。

### 2026-10-04 · M1 查询链路（词库 → 主进程 → 界面）

- 做了：
  - `src/main/data/dictionary-db.ts`：`node:sqlite` 只读访问层。开库即 `PRAGMA query_only = ON`，
    从数据库层面杜绝误写——词库整体可替换，用户数据一个字都不写在这里。
  - `src/main/services/dictionary.ts`：三级查询，从最可靠到最不可靠依次是
    直接命中 → 词库词形表 → 规则推断，三者都失败才给候选，绝不猜一个词硬塞给用户。
  - `src/shared/domain/lemma.ts`：兜底规则（所有格 / 复数 / 三单 / 过去式 / 现在分词 / 比较级 / 最高级，
    含双写辅音与结尾 e 的处理）。
  - `src/shared/domain/dict-format.ts`：义项拆分、考试标签中文名、变形类型中文名、简洁层拼接。
  - IPC 新增 `dict:lookup` 与 `dict:suggest`；运行时状态里带上词库装载情况。
  - 界面拆成 `features/lookup/`（查词主面板）与 `features/capture/`（M0 的取词调试面板，收进折叠区）。
- 修掉两个 bug：
  1. `-er` / `-est` 漏了双写辅音处理，`bigger` 推不出 `big`——**单元测试抓住的**；
  2. ECDICT 用 `bnc = 0` 表示"未收录"，而 0 比任何真实排名都小，
     导致前缀候选把最生僻的词排在最前（`ubiqu%` 第一条是 ubiquinol）。
     修法是在建库时把 0 归一化成 NULL，而不是在 SQL 里堆条件——"未收录"应该只有一种表示。
- 验证：typecheck / ESLint / **36 个单元测试** / 生产构建全绿；
  另用独立脚本直连 `ecdict.db` 核对 SQL 语义（NOCASE 精确查询、词形表、前缀排序、`mice` 的 bnc/frq 已为 NULL）。
- 待实机确认：界面里查词是否秒出、发音按钮是否有声音（Web Speech API 在 Electron 里的可用性，
  规划的风险表里列了这一条）。

### 2026-10-04 · M1 数据管线（ECDICT → ecdict.db）

- 做了：读 ECDICT 的 README 与 LICENSE 确认字段含义与许可；下载 `ecdict.csv`（62.9 MB）、
  `lemma.en.txt`（2.2 MB）、`LICENSE` 到 `data/raw/`（已 gitignore）；写
  `scripts/build_dict.py` 产出 `resources/ecdict.db`；写 `scripts/README.md` 记录复现步骤与实测数据。
- 数据事实（与规划相符，另有三处细节补充）：
  1. CSV 一行一条记录，**多义项用字面量 `\n` 分隔**（不是真换行）——建库时换成真实换行；
  2. 58,625 个词条带 `0:lemma`，`1:` 给出变形类型（i 现在分词 / s 复数 / r 比较级 / t 最高级 /
     d 过去分词 / p 过去式 / 3 三单），这一列将来能让界面说"running 是 run 的现在分词"；
  3. `lemma.en.txt` 有噪声（`they` 同时挂在 `it` 和 `he` 名下），因此只接受
     "词形查不到 + 原形查得到"的映射，避免把有词条的词改写成别的词。
- 实测：770,611 词条；`lemma` 表 89,314 行（exchange 56,409 + BNC 32,905）；
  `ecdict.db` 95.9 MB；建库 4.6 秒；精确查询约 0.03 ms/次。
- 验收核对：大小写不敏感查询通过；running/better/mice/went/teeth 还原全部正确；
  BNC 补充映射抽样均为缩略形式，未见脏数据。
- 发现的坑（已记入 `scripts/README.md`）：前缀候选按 `bnc` 排序时 NULL 会排最前，
  查询层要用 `ORDER BY bnc IS NULL, bnc`，否则最常用的词被生僻词挤下去。
- 对体积预估的影响：词库实测 95.9 MB，比规划里"安装包 250 MB 量级"的估计更乐观。

### 2026-10-04 · CI 首次抓红 → 修复 → 转绿（顺带把远端换成 SSH）

- **CI 第一次红，红得很有价值。** 推送"SQLite 选型"那次提交后，CI 在 lint 步骤失败：
  新增的 `scripts/spike/sqlite-check.cjs` 被 ESLint 报 8 条错——
  `@typescript-eslint/no-require-imports` 与 `explicit-function-return-type`。
  原因是配置把面向 TypeScript 模块的规则套到了全仓库，而 `scripts/` 下是能独立运行的
  CommonJS 工具脚本。修复：为 `scripts/**/*.{js,cjs,mjs}` 增加 eslint 例外
  （`sourceType: 'commonjs'`，关掉这两条规则）。这条红线正是 CI 存在的意义——
  本地 `git commit` 不会拦住你，只有门禁会。
- **推送失败：`github.com:443` 连不通。** 诊断结果：`api.github.com:443` 正常、
  `codeload.github.com` 正常、`ssh.github.com:443` 与 `github.com:22` 正常，
  只有 `github.com:443` 不通，且未配任何代理——属于针对该域名的网络阻断，不是本机故障。
  处理：确认既有 SSH 密钥可通过 GitHub 认证（`ssh -T git@github.com`）后，
  把远端从 HTTPS 改为 SSH：`git remote set-url origin git@github.com:Gaoqp123/wordbox.git`。
  推送随即成功。
- 结果：CI `completed / success`，39 秒。**M0 收口，七项任务全部完成，远端与门禁均在位。**
- 遗留（不阻塞）：workflow 里的三个 action 仍是 v4（GitHub 已提示其基于 Node 20），
  最新为 `actions/checkout@v7`、`actions/setup-node@v7`、`pnpm/action-setup@v6.1`。

### 2026-10-04 · SQLite 选型确定，M0 收口

- 做了：写 `scripts/spike/sqlite-check.cjs`，在真实 Electron 进程里验证内置 SQLite。
  脚本在 Windows 上把结论同时写进 `out/sqlite-spike.txt`，不依赖 stdout 回显——
  Electron 主进程的 console 输出在 Windows 上经常不回显，这是踩过的坑。
- 结果（Electron 39.8.10 / Node 22.22.1）：`require('node:sqlite')` 成功，
  `DatabaseSync` 可用，内存库与文件库读写正常，中文往返正确。
- 结论：**选 `node:sqlite`**。核心理由是不引入原生模块，
  省掉"按 Electron ABI 重编译"这一整类故障；退路是 `better-sqlite3`，
  Repository 层已隔离驱动，替换成本集中在 `main/data/`。
- **M0（骨架 + 取词验证）7/7 全部完成**，可以进 M1。

### 2026-10-04 · CI 上线，M0 验收达成

- 做了：用户按指导手写 `.github/workflows/ci.yml`；本地先预演了 CI 的四条命令
  （含此前从未跑过的 `electron-vite build`）确认全过；建立 GitHub 远端并首次推送。
- 结果：`gh run list` 显示 `completed / success`，耗时 54 秒。
  **M0 验收条件"push 后 Actions 全绿"达成**，远端 https://github.com/Gaoqp123/wordbox.git。
- 顺带修好的环境问题：用户机器上 `C:\z_software\Git` 从未加入 PATH
  （安装时选的 "Git from Git Bash only"），导致终端里敲 `git` 找不到命令。
  已加入用户级 PATH，与卡巴斯基无关。
- 提交：`8cee91e ci: 添加 GitHub Actions 质量门禁`。

### 2026-10-04 · 决策记录（ADR）

- 做了：把规划第 2 节的 14 条决策各写成一份 ADR，放在 `docs/adr/`，并加索引 `README.md`。
- 格式：背景 → 决策 → 备选方案 → 后果 → **复核触发条件**。
  最后一节是刻意加的：决策会过期，写清"什么情况变了就该重来"，才不会让当年的正确选择变成后来的枷锁。
- 与规划文档的差别：ADR-0014 不是抄录，而是**修订**——M0 实测推翻了"模拟复制是主路径"这个前提，
  记录里保留了实测过程与四条备选方案的评估。
- 产出：`docs/adr/README.md` 加 `0001`~`0014`，共 15 个文件。

### 2026-10-04 · M0 取词验证收口（已完成）

**结论：在一台装有行为检测类安全软件的机器上，模拟 Ctrl+C 不能作为取词主路径；
"用户自己 Ctrl+C + 我们读剪贴板"的兜底路径可用，体验合格。**

- 实测过程：`pnpm dev` 起窗 → 首次取词成功 → 之后全败 → 诊断面板定位到卡巴斯基拦截 →
  拦截从"合成按键"升级到"拒绝创建子进程（spawn EPERM）" → 实现熔断与剪贴板兜底 → 复测通过。
- 复测结果（实机确认）：
  1. 选中 → 自己 Ctrl+C → 快捷键：立刻出词，来源标为"剪贴板兜底"；
  2. 未复制直接按快捷键：得到明确提示，而不是含糊的"没取到东西"；
  3. 剪贴板原有内容未被污染。
- 代价与收益：多按一次 Ctrl+C；换来零对抗、跨机器稳定，不必和安全软件拉锯。
- 遗留：一键体验（不按 Ctrl+C）在装行为检测安全软件的机器上不可靠。
  将来若要做，正路是用 UI Automation 读取选区文本，而不是继续伪造按键。

### 2026-10-04 · 兜底路径修复（异常不该跳过降级）

- 现象：实体机实测报 `取词过程出错（spawn EPERM）`，尝试次数 0 次——说明创建 PowerShell 子进程被
  系统直接拒绝（安全软件把拦截升级到了进程创建这一层）。
- 发现缺陷：异常从 `sendCopyKeystroke` 抛出后直接进了最外层 `catch`，
  **整条链路被短路，连剪贴板兜底都没走到**。这是设计错误：兜底本就该覆盖"模拟复制完全不可用"的情况。
- 修复：
  - 模拟复制的循环单独 try/catch，失败只记录到诊断（`copyError`），不再打断链路；
  - 新增失败原因 `need-manual-copy`，明确告诉用户"选中 → Ctrl+C → 快捷键"；
  - 诊断面板用 `(未采集)` 区分"没采到"与"内容为空"。
- 验证：`tsc` 0 error；`eslint` 0 error；`vitest` 19/19 通过。

### 2026-10-04 · 取词被安全软件拦截与兜底改造

- 现象：`pnpm dev` 首次取词成功，之后无论换哪个程序、哪种触发方式都失败，界面提示"没取到东西"。
- 定位：先用诊断面板采集到"模拟按键时的前台窗口 / 剪贴板前后内容 / 子进程退出码"，
  排除焦点问题与程序不响应两个可能；最终确认是**卡巴斯基拦截了合成按键行为**
  （隐藏进程 + 伪造 Ctrl+C 正是行为检测的典型目标，第一次放行、之后拦是这类检测的常见表现）。
- 改造：
  - 新增 `src/shared/domain/synthetic-copy.ts`：模拟复制的熔断器（连续失败 3 次停用）。
  - 取词增加**剪贴板兜底**：模拟复制不可用时改读用户自己 Ctrl+C 后的剪贴板，
    并在结果里标出来源（`synthetic-copy` / `clipboard-fallback`）；
    与上次兜底内容相同的剪贴板文本会被判为旧内容，不当作本次查询。
  - 界面：状态区显示模拟复制是否已熔断，兜底结果用琥珀色横幅如实标注。
  - 新增决策 D14 记入规划文档（模拟复制降级为加速路径）。
- 验证：`tsc` 0 error；`eslint` 0 error；`vitest` 19/19 通过（新增 4 条熔断器测试）。
- 遗留：一键体验（不按 Ctrl+C）在装有行为检测安全软件的机器上不可靠；
  将来可用 UI Automation 读选区替代合成按键。

### 2026-10-04 · 脚手架落地（第三步）

- 做了：用官方 `@quick-start/create-electron` 在临时目录生成 electron-vite React + TS 模板，
  按规划的三段式结构搬进仓库，补上模板没有的 Tailwind 与 Vitest，并写入 M0 取词骨架。
- 产出：
  - 根配置：`package.json`、`.npmrc`、`pnpm-workspace.yaml`、`electron.vite.config.ts`、
    `electron-builder.yml`、三份 tsconfig、`eslint.config.mjs`、Prettier 配置、`.vscode/`
  - `src/shared/ipc-contract.ts`（通道与载荷类型）、`src/shared/domain/grab-guard.ts`（纯逻辑判定）
  - `src/main/`：应用生命周期 + `services/grab.ts`（剪贴板备份还原 + PowerShell 模拟 Ctrl+C）+
    `services/hotkey.ts`（两个全局快捷键）+ `windows/main-window.ts`
  - `src/preload/`：白名单 IPC 接口；`src/renderer/`：M0 验证面板
  - `tests/unit/grab-guard.test.ts`：12 条断言
- 验证结果：`tsc` 0 error（node + web 两套）；`eslint` 0 error 0 warning；`vitest` 12/12 通过。
- 踩到的坑（都已解决）：
  - pnpm 11 不再读 `package.json` 的 `pnpm` 字段，配置要写进 `pnpm-workspace.yaml`。
  - 依赖安装脚本默认被拦下（安全策略），导致 **Electron 二进制根本没下载，但 `pnpm install` 仍然返回成功**，
    错误只以 `[ERR_PNPM_IGNORED_BUILDS]` 挂在输出最后一行。这是最危险的一类坑。
  - 改完配置后再跑 `pnpm install` 依然是 `Already up to date`，pnpm 会把上次的"忽略构建"记录原样重放，
    必须显式 `pnpm rebuild` 才真正触发构建。
- 结论：脚手架可用，已验证到编译与单测层面；窗口能否正常起来留待 `pnpm dev` 确认。

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
| 沙箱读不了 `node_modules` 里的一部分文件 | `tsc` 报 `TS5083 Cannot read file`、`vitest` 报 `EPERM`，有的文件能读有的直接拒绝访问（连 `Get-Acl` 都失败） | 这是沙箱 ACL 策略，不是仓库问题。类型检查 / 测试 / 构建一律提权跑 |
| `github.com:443` 会被网络阻断 | `git push` 报 `Failed to connect to github.com port 443`，但 `api.github.com`、`ssh.github.com:443` 都正常 | 远端已改用 SSH（`git@github.com:Gaoqp123/wordbox.git`）。遇到推送失败先别怀疑账号或密钥，先测 `Test-NetConnection github.com -Port 443` |
| `C:\z_software\nodejs` 目录权限 | 仅 Administrators 有完全控制权 | 不要把它设为 npm 全局前缀；不要往那里装东西 |
| 两份 npm 并存 | 终端里生效的是 12.0.2，node 自带 11.12.1 | 日常无影响，不处理 |

---

## 7. 更新规则

1. 每个工作片段结束：更新第 1 节的「当前状态」与「下一步」，勾选第 2 节的清单。
2. 每个工作片段结束：在第 4 节**追加**一条会话日志（日期 + 做了 + 结论 + 产出），不覆盖历史。
3. 出现新的待拍板事项或阻塞：写进第 5 / 6 节，解决后标注状态，不删行。
4. 里程碑完成：在总览表填上完成日，并把下一个里程碑的清单从规划文档复制过来展开。
