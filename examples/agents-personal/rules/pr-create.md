# 提 PR

> 触发于 `.agents-personal/AGENTS.md > 项目指令 > 提 PR` —— 用户说「提 PR / 提交 PR / 创建 PR」时读本文件。

## 背景

<!--
描述本项目 PR 流程的特殊性。例如：
- 跨 fork 工作流（fork → upstream）
- 强制 base 分支（必须 → release，不允许 → main）
- 特殊 reviewer 规则（部分文件触发 default reviewers）
- 自定义 CLI 选择（gh / glab / bkt / hub）
- 工具的坑（如某个常用 CLI 在本场景下不可用，必须走裸 REST）

如无特殊性，可写「标准 `gh pr create` 流程」并删除下面的命令模板章节。
-->

## 命令模板

```bash
# <TODO: 项目特定的 PR 创建命令>
# 含 repo id / host / 工具选择等项目常量
# 可包含 <source> / <target> / <title> 等会话填空的占位符
```

<!-- 命令解释 / 返回值用法 / 易混淆的坑 -->

## PR 标题 / 描述生成规则

**标题来源**（按优先级取）：

1. **分支名或 commit message 含任务标识** → 直接用任务标识（如 `f-12345` / `bug-2-3` / `feat/xxx`）
2. **无任务标识** → 总结所有 commit 的核心改动为一句话标题（动宾式，参考 commit subject 风格）

**描述要求**：

1. **抽象细节**：提炼「改了什么类型的事 / 为什么改」，不堆 commit 拼接、不贴 diff stat
2. **抓住关键**：reviewer 不读 diff、只读描述也能判断 PR 目的与影响范围；一两句话能讲明白就别写第三句

## PR 创建前 echo 确认（hard gate）

执行 PR 创建命令**之前**，必须在对话里 echo 以下格式给用户确认：

```
上传到 <project>/<repo> 仓库的 <target-branch> 分支。
标题为：<标题>
描述为：<描述>
是否上传？
```

**用户回答"上传 / 是 / OK / yes"等明确同意后**，才执行创建命令。
用户提出修改、补充 reviewer、调整文案等任何反馈时，更新后再次 echo 同一格式确认，**不得跳过**。

**不允许的反模式**：
- 不 echo 直接执行 → 出错时用户没机会拦
- echo 但同步执行（没等用户回复就发） → 等于没 echo
- echo 简化格式（漏 target 分支 / 漏描述） → 用户看不清要发到哪
