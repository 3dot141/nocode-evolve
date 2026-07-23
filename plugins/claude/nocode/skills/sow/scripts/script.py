#!/usr/bin/env python3
"""/sow v2 命令的 frontmatter + 路径生成脚本。

设计文档：docs/plans/3dot141/260521-sow-multi-layer-design.md

v2 vs v1 变更：
- env 改名 + 上移：USER_WIKI_PATH (v1, 指 Memory/05-Outputs 子目录)
  → USER_VAULT_PATH (v2, 指 vault 根, 如 ~/AI/MyJarvis)。
- Memory/ 前缀由脚本硬编 (MEMORY_SUBDIR 常量), 不进 env, 跨命令复用同一 env。
- 加 --layer 必填参数 (inbox / inputs / outputs), 决定子目录路径。
- exit 3 语义扩为「目录相关错误」, 含 missing subdir + mkdir failed 两子类型,
  stderr 子类型前缀区分。
- --layer 非法走 argparse 默认 SystemExit(2), 与 env 错共用 exit 2 (语义都属"配置/参数错")。

输入：--layer / --intent / --title / --summary（CLI flag）+ $USER_VAULT_PATH（env）
输出（stdout 双段，固定格式）：
    <完整 frontmatter，--- 包围>
    <空行>
    TARGET_PATH: <绝对路径>
Exit code：
    0 成功
    1 路径冲突 (目标文件已存在)
    2 env 错 ($USER_VAULT_PATH 未设 / 不是目录)
    3 目录相关错误:
        子类型 "missing subdir:" — <vault>/Memory/{01-Inbox|02-Inputs|05-Outputs} 任一不存在
        子类型 "mkdir failed:"  — <yymm>/ 子目录 makedirs 失败 (权限 / 磁盘满)
    4 --layer 参数非法 (AI 内部错)
"""

import argparse
import hashlib
import os
import sys
from datetime import datetime


# Memory 子目录名 (sow 内部硬编, 不进 env)
MEMORY_SUBDIR = "Memory"

# layer → 子目录名映射
LAYER_DIR_MAP = {
    "inbox": "01-Inbox",
    "inputs": "02-Inputs",
    "outputs": "05-Outputs",
}


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Generate frontmatter + path for /sow v2"
    )
    parser.add_argument("--layer", required=True,
                        choices=list(LAYER_DIR_MAP.keys()),
                        help="target layer: inbox / inputs / outputs")
    parser.add_argument("--intent", required=True,
                        help="user intent verbatim (audit only, not written to frontmatter)")
    parser.add_argument("--title", required=True,
                        help="AI-inferred title, 5-25 display chars, already cleaned")
    parser.add_argument("--summary", required=True,
                        help="AI-written summary, <=30 chars")
    return parser.parse_args(argv)


def format_created_date(dt):
    """`YYYY-MM-DD HH:MM` 格式——与 vault 现有样本对齐（如 260227-工作流设计.md）。"""
    return dt.strftime("%Y-%m-%d %H:%M")


def format_yymm(dt):
    """4 位年月，如 2605——用于月份目录分组。"""
    return dt.strftime("%y%m")


def format_yymmdd(dt):
    """6 位年月日，如 260514——用于文件名前缀。"""
    return dt.strftime("%y%m%d")


def compute_permalink(title, created_date):
    """`posts/<32 位 hex>`——种子是 title + "\\n" + created_date。

    用换行 `\\n` 分隔（spec 写 `|` 是描述意图，实现选更稳的分隔符）：
    title 禁止换行字符 + created_date 固定 `YYYY-MM-DD HH:MM` 格式不含换行，
    所以任意 (title, date) 拼接出的 seed 串都唯一——真正零冲突。
    截 32 位与 vault 现有样本格式对齐
    （样本：permalink: posts/294e4b74b81db1aa5e05f1166ced1207）。
    """
    seed = f"{title}\n{created_date}"
    digest = hashlib.md5(seed.encode("utf-8")).hexdigest()
    return f"posts/{digest[:32]}"


def _yaml_double_quote(s):
    """把字符串 escape 成 yaml 双引号形式。

    yaml 双引号字符串里需要 escape：`\\` 和 `"`；其它字符（含 `:` `#` 中文）原样。
    https://yaml.org/spec/1.2.2/#double-quoted-style
    """
    escaped = s.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def render_frontmatter(summary, created_date, modified_date, permalink):
    """拼 yaml frontmatter 字符串。

    字段顺序固定（与 vault 现有样本对齐）：
    aliases / draft / tags / summary / source / created_date / modified_date / permalink

    tags 三层共用 [ai-distill]——layer 信息已在文件路径里反映 (`01-Inbox/...`),
    不冗余进 tag；vault 现有 frontmatter `tags:` 大多为空, 无 layer-specific tag
    命名惯例 (设计文档 W6 决议)。

    summary 用 yaml 双引号字符串包围 + escape，避免含 ":" "#" 等导致 parse 错。
    """
    return (
        "---\n"
        "aliases: []\n"
        "draft: false\n"
        "tags: [ai-distill]\n"
        f"summary: {_yaml_double_quote(summary)}\n"
        "source: chat-distill\n"
        f"created_date: {created_date}\n"
        f"modified_date: {modified_date}\n"
        f"permalink: {permalink}\n"
        "---\n"
    )


def build_memory_root(vault_path):
    """vault 根加 Memory/ 子前缀, 得到 Memory 根。"""
    return os.path.join(vault_path, MEMORY_SUBDIR)


def build_target_path(memory_root, layer, yymm, yymmdd, title):
    """拼目标文件绝对路径 `<memory_root>/<layer-dir>/<yymm>/<yymmdd>-<title>.md`。"""
    return os.path.join(memory_root, LAYER_DIR_MAP[layer], yymm, f"{yymmdd}-{title}.md")


def check_layer_subdirs(memory_root):
    """校验 memory_root 下三个 layer 子目录全部存在。

    返回缺失子目录的完整路径列表 (空列表 = 全部就位)。
    sow 不自动创建 layer 子目录——防止 typo / 错根目录被静默接受。
    """
    missing = []
    for dirname in LAYER_DIR_MAP.values():
        path = os.path.join(memory_root, dirname)
        if not os.path.isdir(path):
            missing.append(path)
    return missing


def ensure_yymm_dir(memory_root, layer, yymm):
    """创建 `<memory_root>/<layer-dir>/<yymm>/` 子目录；已存在不报错。

    失败（权限不足 / 磁盘满）时抛 OSError——由 caller 决定 exit code。
    """
    os.makedirs(
        os.path.join(memory_root, LAYER_DIR_MAP[layer], yymm),
        exist_ok=True,
    )


def target_exists(target_path):
    """目标文件是否已存在——同日同 title 重跑会触发。"""
    return os.path.exists(target_path)


def main(argv=None):
    args = parse_args(argv)

    vault_path = os.environ.get("USER_VAULT_PATH")
    if not vault_path or not os.path.isdir(vault_path):
        print(
            "ERROR: $USER_VAULT_PATH 未设或不是目录。请在 shell rc 里 "
            "`export USER_VAULT_PATH=<vault 根, 例 ~/AI/MyJarvis>`。",
            file=sys.stderr,
        )
        return 2

    memory_root = build_memory_root(vault_path)
    missing = check_layer_subdirs(memory_root)
    if missing:
        print(
            f"ERROR: missing subdir: {', '.join(missing)}。请手动 mkdir 后重试。",
            file=sys.stderr,
        )
        return 3

    now = datetime.now()
    created_date = format_created_date(now)
    modified_date = created_date
    yymm = format_yymm(now)
    yymmdd = format_yymmdd(now)
    permalink = compute_permalink(args.title, created_date)

    try:
        ensure_yymm_dir(memory_root, args.layer, yymm)
    except OSError as e:
        target_yymm_dir = os.path.join(memory_root, LAYER_DIR_MAP[args.layer], yymm)
        print(
            f"ERROR: mkdir failed: {e} (path={target_yymm_dir})",
            file=sys.stderr,
        )
        return 3

    target_path = build_target_path(memory_root, args.layer, yymm, yymmdd, args.title)
    if target_exists(target_path):
        print(
            f"ERROR: 已存在 {target_path}。请改 title 后重试，"
            f"或人工删除原文件再跑。",
            file=sys.stderr,
        )
        return 1

    frontmatter = render_frontmatter(
        summary=args.summary,
        created_date=created_date,
        modified_date=modified_date,
        permalink=permalink,
    )

    # stdout 协议：frontmatter（含末尾 ---\n）+ 空行 + TARGET_PATH: <path>
    sys.stdout.write(frontmatter)
    sys.stdout.write("\n")  # 空行作唯一分隔符
    sys.stdout.write(f"TARGET_PATH: {target_path}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
