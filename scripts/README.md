# 数据管线

词库不进仓库（体积大），只进脚本。任何人都能用下面三步复现出同一个 `ecdict.db`。

## 1. 下载原始数据

来源：[ECDICT](https://github.com/skywind3000/ECDICT)，MIT License（Copyright (c) 2025 Linwei）。

```powershell
New-Item -ItemType Directory -Force -Path data\raw | Out-Null
$base = 'https://raw.githubusercontent.com/skywind3000/ECDICT/master'
Invoke-WebRequest "$base/ecdict.csv"   -OutFile data\raw\ecdict.csv     # 约 63 MB
Invoke-WebRequest "$base/lemma.en.txt" -OutFile data\raw\lemma.en.txt   # 约 2.2 MB
Invoke-WebRequest "$base/LICENSE"      -OutFile data\raw\LICENSE        # 保留版权声明
```

> 网络受限时（例如 `github.com:443` 被阻断但 `raw.githubusercontent.com` 正常），
> 上面的地址仍然可用；如果连 raw 也不通，可以用 `codeload.github.com` 下载整包 zip。

`data/raw/` 已在 `.gitignore` 中，不会提交。

## 2. 生成词库

```powershell
python scripts\build_dict.py
```

产物是 `resources/ecdict.db`，同样不提交，但打包进安装包。

## 3. 产物说明

### `dict` 表

字段与 ECDICT 的 CSV 一一对应（`word` / `phonetic` / `definition` / `translation` /
`pos` / `collins` / `oxford` / `tag` / `bnc` / `frq` / `exchange` / `detail` / `audio`），
做了四处清洗：

1. `word` 用 **NOCASE 主键**：精确查询大小写不敏感，且 `LIKE 'abc%'` 能走索引（前缀候选要用）。
2. `translation` / `definition` 里的**字面量 `\n` 换成真实换行**。
   ECDICT 整个文件是一行一条记录，多个义项用两个字符 `\` `n` 分隔，界面按行拆分即可。
3. 空字段存 `NULL` 而不是空字符串，查询时少一类边界情况。
4. **`bnc` / `frq` 里的 0 归一化成 `NULL`**：ECDICT 用 0 表示"没进词频表"，
   而 0 在排序中比任何真实排名都小，不处理的话按词频排序会把最生僻的词顶到最前面
   （实测 `ubiqu%` 的第一条会是 ubiquinol 而不是 ubiquitous）。

### `lemma` 表

词形反查：`running → run`、`better → good`、`mice → mouse`。两个来源，优先级不同：

| 来源            | 条数（实测） | 说明                                                                                                                                               |
| --------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exchange` 字段 | 58,625       | **首选**。ECDICT 逐词条标注的变形关系，干净。`kind` 字段保留变形类型（i 现在分词 / s 复数 / r 比较级 / t 最高级 / d 过去分词 / p 过去式 / 3 三单） |
| `lemma.en.txt`  | 见运行输出   | **补充**。BNC 语料统计得来的词干表，覆盖更广但有噪声                                                                                               |

补充来源只接受同时满足两个条件的映射：**该词形在 `dict` 里查不到**，且**映射到的原形在 `dict` 里查得到**。
否则会把 `they` 这种本身有词条的词改写成 `it`（lemma.en.txt 里它确实同时挂在 `it` 和 `he` 名下），
查询路径就被脏数据污染了。

### 实测数据（2026-10-04）

| 指标                | 值                                     |
| ------------------- | -------------------------------------- |
| 词条数              | 770,611                                |
| 带 `0:lemma` 的词条 | 58,625                                 |
| `lemma` 表总行数    | 89,314（exchange 56,409 + BNC 32,905） |
| `ecdict.db` 体积    | **95.9 MB**                            |
| 建库耗时            | **4.6 秒**                             |
| 精确查询耗时        | 约 0.03 ms / 次                        |

> **前缀候选的排序**：SQLite 里 `NULL` 在升序中最小，所以查询层仍要写
> `ORDER BY bnc IS NULL, bnc, ...` —— 建库时把 0 归一化成 NULL 只是让"未收录"
> 只有一种表示，排序表达式该写还得写。

## 为什么不用 ECDICT 官方提供的 sqlite 包

官方 Release 里有现成的 sqlite，但那是 2017 年生成的、字段与索引按它的需要设计。
我们要自己的 `word` 排序规则、自己的 lemma 合并规则（两条来源的取舍）、
以及将来可能加的词频预处理。脚本 30 秒能跑完，不值得为省这点时间放弃可控性。
