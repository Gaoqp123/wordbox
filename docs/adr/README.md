# 架构决策记录（ADR）

这里按顺序记录 WordBox 的每一条重要决策：**为什么这么做、当时还有哪些备选、代价是什么、
什么情况下应该重新考虑**。

规划文档（[../PROJECT_PLAN.md](../PROJECT_PLAN.md)）第 2 节是决策总表，适合快速浏览；
本目录的每一条记录展开讲清前因后果，适合回答"当初为什么不是那样做"。

## 格式

每条记录包含：背景 → 决策 → 备选方案 → 后果 → 复核触发条件。

**复核触发条件**是最容易被忽略、却最有价值的一节：决策会过期，
写清楚"什么情况变了就该重来"，才不会把当年的正确选择变成后来的枷锁。

## 索引

| 编号 | 决策 | 状态 |
|---|---|---|
| [0001](./0001-electron-desktop.md) | 桌面端用 Electron，不用 PWA | 已接受 |
| [0002](./0002-no-builtin-reader.md) | 不做内置阅读器 | 已接受 |
| [0003](./0003-hotkey-not-clipboard-watch.md) | 显式快捷键为主，剪贴板监听默认关闭 | 已接受 |
| [0004](./0004-lookup-history-separate.md) | 查询历史与生词本分离 | 已接受 |
| [0005](./0005-explicit-promotion.md) | 加入生词本是显式动作 | 已接受 |
| [0006](./0006-fsrs.md) | 复习调度用 FSRS | 已接受 |
| [0007](./0007-ecdict-offline.md) | 离线词库用 ECDICT 全量 | 已接受 |
| [0008](./0008-sqlite-two-databases.md) | 存储用 SQLite 双库 | 已接受（选型待定） |
| [0009](./0009-no-mobile-first-version.md) | 第一版不做手机端 | 已接受 |
| [0010](./0010-no-browser-extension.md) | 不做浏览器扩展 | 已接受 |
| [0011](./0011-no-external-examples.md) | 不抓取外部例句 | 已接受 |
| [0012](./0012-app-agnostic-capture.md) | 取词程序无关 | 已接受 |
| [0013](./0013-two-hotkeys.md) | 两个快捷键：查词 / 查句 | 已接受 |
| [0014](./0014-clipboard-fallback.md) | 模拟复制降级为加速路径 | 已接受（M0 实测后修订） |
