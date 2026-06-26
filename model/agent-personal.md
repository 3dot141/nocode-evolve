> 项目本地资源 .agents-personal/ — 何时检索 / 删除护栏

# 项目本地资源 `.agents-personal/`

`<project>/.agents-personal/` 是项目本地放给 agent 的资源目录(gitignored / 用户本地, 不入插件 history)。含:

- `wiki/` — 历史记忆(设计决策 / 术语 / 踩坑 / 子系统背景)。被动检索, 可被新决策 superseded。
- `AGENTS.md` + `rules/` — 当前指令(触发条件 + 操作细节)。主动按触发匹配读。

wiki 是事实记录, rules 是工作指令——不把 wiki 当指令执行, 不把 rules 当可质疑历史。

> 变量解析优先级(占位符 `{username}` 等从 `.agents-personal/AGENTS.md` 优先解析)见 `agent-about.md` 的「全局占位符」节, 本文不重复。

## wiki/ — 何时检索

wiki 是 AI 的**项目知识第一站**，两层内容（`draft/` 草稿 + `pages/` 成熟）+ 控制文件（`index.md` 全局索引 + `log.md` 操作日志）。

会话开局只做存在性检查(`ls`)。实际 Read `wiki/index.md` 推迟到命中下列任一:

- 即将调 `nocode-evolve:brainstorming` / `nocode-evolve:design-doc-writing`;
- 用户消息含「设计 / 选型 / 方案 / 架构 / 重构 / RFC / 提案」等设计性意图;
- 需要项目历史背景才能动手: 上手 / 调试某子系统(如 SigNoz 查询、本地联调、agent 装配、system prompt 构成), 或问「为什么这么设计 / 之前怎么决定 / 踩过什么坑」;
- **即将排查 / 调试 / 联调任何环境或功能问题**（本地功能看不见 / 进不去 / 灰度开关 / 白名单 / 权限不通 / 环境配置差异 / 接口不返回预期数据）→ **默认先查 wiki/index.md**，不等识别为"项目特有知识"再查（排查类任务的项目特有知识命中率高，先查 wiki 的成本远低于漏查的代价）;
- **AI 工作中需要项目特有知识**（子系统机制 / 配置约定 / 联调踩坑 / 架构背景）→ **先查 wiki/index.md 再走代码探索**；代码探索产出可复用的项目知识时，回写 `wiki/draft/` 作 stub + 追加 `wiki/log.md`（query-write）;
- 当前任务升级为以上。

index.md 同一会话只 Read 一次; 读了必引用。进一步 Read `pages/<file>` 或 `draft/<file>` 按需。

**maturity 感知**（读 wiki 页时按 maturity 分级信任）:
- `active` / `draft` (pages/) → 直接引用
- `stub` (draft/) → 参考 + 注明"单源待验证"
- `superseded` → 跳过（除非用户问历史决策演进）
- 有 `⚠ stale` 标记（dream 标注） → 引用 + 注明"可能过时"

不触发(纯执行 / 纯事实, 不查 wiki): 已知精确路径直接改 / 一次性事实查询 / 与项目历史无关的通用问题。

不要: 读了不引用 / 无脑拉所有 pages / 把 wiki 当绝对真理 / 自己写 wiki(日常沉淀走 `/distill`; query-write 回写是唯一例外, 仅限可复用的项目特有知识)。

## AGENTS.md + rules/ — 何时检索

`AGENTS.md` 是路由表只列触发条件; `rules/<topic>.md` 放具体指令, 一个 topic 一文件。新会话首次响应实质问题前 Read `AGENTS.md` 一次, `rules/<topic>.md` 按触发命中再 Read, 命中即引用。

不要: 在 AGENTS.md 写命令模板 / 把 rule 当历史质疑 / 自己往 `.agents-personal/` 写(沉淀走 `/distill`)。

## 删除护栏 — `.agents-personal/` + `$USER_VAULT_PATH` 删除前必须二次确认

内容是用户沉淀的项目历史 + 当前指令, **不可恢复** (gitignored / vault, 无 git history)。误删 = 工作丢失。

**触发**: 即将 rm / mv / `find -delete` / Write 覆盖已存在文件 / Edit 大段删 (≥5 行) 这些目录下任何文件或子目录 (subagent 同理)。纯读 (Read / cat / grep / ls) 不触发。

**动作**: 停手 → 描述将删什么 (路径 + 内容范围) + 原因 + 影响 → 等用户明确确认再执行, 不脑补"用户应该同意"。用户主动指示删: 视为已确认, 但删前回显路径让其最后一刻能反悔。

**不要**:
- distill / sow "顺手"清理旧 wiki / rule (除非命令定义了清理且用户已勾选)
- 为"重新组织"批量 mv / rm (结构改 = 删除等价物); 别假设 git mv 不算删 (gitignored, mv = delete + create)
- 因"过时 / 跟新决策矛盾"自己拍板删 (superseded 仍有参考价值, 由用户判断删还是标 `superseded by ...`)

> `$USER_VAULT_PATH`: `/distill` 的 `wiki:cross-project advisor` 出口建议跑 `/sow`, 写到 `$USER_VAULT_PATH/Memory/<layer>/`, 同等护栏。 (v1 `USER_WIKI_PATH` 已弃用, sow v2 改读 `USER_VAULT_PATH`。)
