#!/usr/bin/env python3
"""把 ECDICT 的 CSV 转成可以直接查询的 SQLite 词库（resources/ecdict.db）。

三个产物：

1. `dict`  —— 77 万词条本体，字段与 ECDICT 一一对应。
   `word` 用 NOCASE 主键：既支持大小写不敏感的精确查询，也能让 `LIKE 'abc%'`
   走索引（前缀候选要用）。
2. `lemma` —— 词形反查表：running → run、better → good、mice → mouse。
   数据有两个来源，优先级不同，理由见 load_lemmas 的注释。
3. 字段清洗：ECDICT 的 translation / definition 用**字面量 `\\n`** 分隔多个义项
   （整个文件一行一条记录），这里换成真正的换行，界面直接按行拆分即可。

用法：
    python scripts/build_dict.py
    python scripts/build_dict.py --csv data/raw/ecdict.csv --out resources/ecdict.db

数据来源：https://github.com/skywind3000/ECDICT （MIT License, Copyright (c) 2025 Linwei）
"""

from __future__ import annotations

import argparse
import csv
import sqlite3
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DEFAULT_CSV = ROOT / "data" / "raw" / "ecdict.csv"
DEFAULT_LEMMA = ROOT / "data" / "raw" / "lemma.en.txt"
DEFAULT_OUT = ROOT / "resources" / "ecdict.db"

SCHEMA = """
DROP TABLE IF EXISTS dict;
DROP TABLE IF EXISTS lemma;
DROP TABLE IF EXISTS lemma_src;

CREATE TABLE dict (
  word        TEXT PRIMARY KEY COLLATE NOCASE,  -- 保留原始大小写，比较时不区分
  phonetic    TEXT,
  translation TEXT,   -- 中文释义，多义项以真实换行分隔
  definition  TEXT,   -- 英文释义，多义项以真实换行分隔
  pos         TEXT,   -- 词性占比，如 n:46/v:54
  collins     INTEGER,
  oxford      INTEGER,
  tag         TEXT,   -- 空格分隔：zk gk cet4 cet6 ky toefl ielts gre
  bnc         INTEGER,
  frq         INTEGER,
  exchange    TEXT,   -- 词形变化，格式见 README
  detail      TEXT,
  audio       TEXT
);

CREATE TABLE lemma (
  form   TEXT PRIMARY KEY COLLATE NOCASE,  -- 你遇到的那个形态，如 running
  lemma  TEXT NOT NULL,                    -- 原形，如 run
  kind   TEXT,                             -- 变形类型：i/s/r/t/d/p/3，来自 exchange 的 1: 项
  source TEXT NOT NULL                     -- ecdict / lemma.en.txt
);

CREATE INDEX idx_lemma_lemma ON lemma(lemma);
"""


def to_int(value: str) -> int | None:
    text = (value or "").strip()
    return int(text) if text.isdigit() else None


def to_rank(value: str) -> int | None:
    """词频排名：ECDICT 用 0 表示"未收录进词频表"，按缺失处理。

    0 不是有效排名，但它在排序里比任何真实排名都小——不归一化的话，
    按词频排序时最生僻的词会排在最前面（前缀候选的实测就踩到了这个坑）。
    """
    rank = to_int(value)
    return rank if rank and rank > 0 else None


def to_text(value: str | None) -> str | None:
    """空字段统一存 NULL，而不是空字符串——查询时少一类边界情况。"""
    text = (value or "").strip()
    return text or None


def unfold_lines(value: str | None) -> str | None:
    """把字面量 \\n 换成真实换行。"""
    text = to_text(value)
    return None if text is None else text.replace("\\n", "\n")


def parse_exchange(exchange: str | None) -> tuple[str | None, str | None]:
    """从 exchange 里取出 (原形, 变形类型)。

    格式形如 `0:good/1:r/d:bettered/s:betters`：
    0 是 lemma（原形），1 是"当前词相对原形是什么变形"。
    没有 0 项说明这个词本身就是原形。
    """
    if not exchange:
        return None, None

    lemma: str | None = None
    kind: str | None = None

    for item in exchange.split("/"):
        key, _, value = item.partition(":")
        if not value:
            continue
        if key == "0":
            lemma = value.strip()
        elif key == "1":
            kind = value.strip()

    return lemma or None, kind or None


def load_dict(cursor: sqlite3.Cursor, csv_path: Path) -> int:
    """导入词条本体。"""
    insert = (
        "INSERT OR REPLACE INTO dict (word, phonetic, translation, definition, pos, collins,"
        " oxford, tag, bnc, frq, exchange, detail, audio)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )

    count = 0
    batch: list[tuple] = []
    with csv_path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            batch.append(
                (
                    row["word"].strip(),
                    to_text(row["phonetic"]),
                    unfold_lines(row["translation"]),
                    unfold_lines(row["definition"]),
                    to_text(row["pos"]),
                    to_int(row["collins"]),
                    to_int(row["oxford"]),
                    to_text(row["tag"]),
                    to_rank(row["bnc"]),
                    to_rank(row["frq"]),
                    to_text(row["exchange"]),
                    to_text(row["detail"]),
                    to_text(row["audio"]),
                )
            )
            count += 1
            if len(batch) >= 5000:
                cursor.executemany(insert, batch)
                batch.clear()

    if batch:
        cursor.executemany(insert, batch)

    return count


def load_lemma_from_exchange(cursor: sqlite3.Cursor) -> int:
    """从 exchange 字段生成词形反查。

    这是**首选来源**：它是 ECDICT 自己给出的、逐词条标注的变形关系，
    比统计得来的词干表干净得多。kind 一并留下，将来界面就能说
    "running 是 run 的现在分词"，而不只是干巴巴地还原。
    """
    cursor.execute("SELECT word, exchange FROM dict WHERE exchange LIKE '%0:%'")

    rows: list[tuple[str, str, str | None, str]] = []
    for word, exchange in cursor.fetchall():
        lemma, kind = parse_exchange(exchange)
        if lemma and lemma.casefold() != word.casefold():
            rows.append((word, lemma, kind, "ecdict"))

    cursor.executemany(
        "INSERT OR REPLACE INTO lemma (form, lemma, kind, source) VALUES (?, ?, ?, ?)", rows
    )
    return len(rows)


def load_lemma_from_bnc(cursor: sqlite3.Cursor, lemma_path: Path) -> int:
    """把 BNC 词干表的补充条目并入。

    这份表的覆盖面更大（18.6 万个词形 / 8.4 万组），但**有噪声**：
    例如 `they` 同时被列在 `it` 和 `he` 名下。所以只接受满足两个条件的映射：

    1. 该词形在词典里**查不到**（能查到就不需要还原，更不该被改写成别的词）；
    2. 映射到的原形在词典里**查得到**（否则还原过去也是个空条目）。

    这样既扩了覆盖，又不会把 they→it 这类脏数据带进查询路径。
    """
    rows: list[tuple[str, str, None, str]] = []
    if lemma_path.exists():
        with lemma_path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line or line.startswith(";") or "->" not in line:
                    continue

                head, _, forms = line.partition("->")
                lemma = head.split("/", 1)[0].strip()
                if not lemma:
                    continue

                for form in forms.split(","):
                    form = form.strip()
                    if form:
                        rows.append((form, lemma, None, "lemma.en.txt"))

    cursor.executemany(
        "INSERT INTO lemma_src (form, lemma, kind, source) VALUES (?, ?, ?, ?)", rows
    )

    cursor.execute(
        """
        INSERT OR IGNORE INTO lemma (form, lemma, kind, source)
        SELECT s.form, s.lemma, s.kind, s.source
        FROM lemma_src s
        WHERE NOT EXISTS (SELECT 1 FROM dict d WHERE d.word = s.form COLLATE NOCASE)
          AND EXISTS (SELECT 1 FROM dict d WHERE d.word = s.lemma COLLATE NOCASE)
        """
    )
    accepted = cursor.rowcount
    cursor.execute("DROP TABLE lemma_src")
    return accepted


def build(csv_path: Path, lemma_path: Path, out_path: Path) -> None:
    if not csv_path.exists():
        raise SystemExit(f"找不到 {csv_path}，请先下载 ECDICT 数据（见 scripts/README.md）")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()

    started = time.perf_counter()
    connection = sqlite3.connect(out_path)
    cursor = connection.cursor()

    # 建库期间关掉耐久性换取速度：这份数据是可再生的，崩了重跑即可。
    cursor.execute("PRAGMA journal_mode = OFF")
    cursor.execute("PRAGMA synchronous = OFF")
    cursor.execute("PRAGMA temp_store = MEMORY")

    cursor.executescript(SCHEMA)
    cursor.execute("CREATE TABLE lemma_src (form TEXT, lemma TEXT, kind TEXT, source TEXT)")

    entries = load_dict(cursor, csv_path)
    exchange_lemmas = load_lemma_from_exchange(cursor)
    bnc_lemmas = load_lemma_from_bnc(cursor, lemma_path)

    connection.commit()
    cursor.execute("ANALYZE")
    connection.commit()
    connection.close()

    elapsed = time.perf_counter() - started
    size_mb = out_path.stat().st_size / 1024 / 1024

    print(f"output      : {out_path}")
    print(f"entries     : {entries}")
    print(f"lemma rows  : {exchange_lemmas + bnc_lemmas} (ecdict {exchange_lemmas} + bnc {bnc_lemmas})")
    print(f"size        : {size_mb:.1f} MB")
    print(f"elapsed     : {elapsed:.1f} s")


def main() -> None:
    parser = argparse.ArgumentParser(description="ECDICT CSV -> SQLite")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV, help="ecdict.csv 路径")
    parser.add_argument("--lemma", type=Path, default=DEFAULT_LEMMA, help="lemma.en.txt 路径")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="输出的 sqlite 路径")
    args = parser.parse_args()

    build(args.csv, args.lemma, args.out)


if __name__ == "__main__":
    main()
