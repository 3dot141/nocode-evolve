# 项目本地 `.agents-personal/` 使用约定

`<project>/.agents-personal/` 是项目本地放给 agent 的资源目录, 含:

- `wiki/` — 历史记忆 (设计决策 / 术语 / 踩坑). 被动检索, 可被新决策 superseded.
- `AGENTS.md` + `rules/` — 当前指令 (触发条件 + 操作细节). 主动按触发匹配读.

wiki 是事实记录, rules 是工作指令——不把 wiki 当指令执行, 不把 rules 当可质疑历史.

---

## §1 wiki/ — 历史记忆

会话开局只做存在性检查 (`ls`), 实际 Read `INDEX.md` 推迟到下列任一信号:

1. 即将调 `superpowers:brainstorming` 或 `nocode-evolve:design-doc-writing`
2. 用户消息含「设计 / 选型 / 方案 / 架构 / 重构 / RFC / 提案」
3. 当前任务进行中升级为以上 → 回头 Read

INDEX 同一会话只 Read 一次. 三条 OR 全不触发的纯执行 / 纯小修任务**全程不读**.
读了 INDEX 必引用——description 命中当前任务的条要点名, 否则等于没读.

进一步 Read `pages/<file>` 按需, 触发: 对项目某设计 / 约定 / 术语不确定; 用户暗示"之前讨论过"; 你的判断可能跟过往决策冲突; 用户问"这个项目里 X 怎么处理的"; INDEX 某条 description 明显覆盖当前决策点.

不要: 读了不引用; 无脑拉所有 pages; 把 wiki 当绝对真理 (它会被 superseded); 自己写 wiki (沉淀走 `/sediment`).

沉淀: 发现项目级新知识时建议用户跑 `/sediment`, 命令自动贴 `wiki:project` / `rules:project` 标签, 不替用户决定.

---

## §2 AGENTS.md + rules/ — 当前指令

`.agents-personal/AGENTS.md` 是**路由表**, 只列触发条件:

```markdown
## 提 PR
**触发**: 用户说「提 PR / 创建 PR / push 完想合并」, 或贴 Bitbucket create PR 链接.
**读**: rules/pr-create.md
```

`.agents-personal/rules/<topic>.md` 放具体指令 (命令模板 / 事实表 / 坑 / 示例), 一个 topic 一文件.

读取: 新会话首次响应实质性问题前 Read AGENTS.md 一次. `rules/<topic>.md` 按触发命中再 Read. 命中即引用.

触发条件写法: 一句"当 X 时"或"用户说 Y 时"陈述, agent 读完能直判 yes/no. 不写「可能 / 也许 / 看情况 / 需要时」——含糊触发等于没触发.

不要: 在 AGENTS.md 写命令模板 / 长事实表 (挪 rule); 把 rule 当历史质疑 (改请用户改); 自己往 `.agents-personal/` 写东西 (沉淀走 `/sediment`).

沉淀: 项目级新指令建议用户跑 `/sediment`, 命令自动贴 `rules:project` 标签, 落地时双写 `.agents-personal/rules/<topic>.md` + AGENTS.md 触发条件.

---

## §3 删除护栏 — `.agents-personal/` 下任何删除前必须用户二次确认

内容是用户沉淀的项目历史 + 当前指令, **不可恢复** (gitignored, 没 git history). 误删 = 工作丢失.

### 触发

即将 rm / mv / `find -delete` / Write 覆盖已存在文件 / Edit 大段删 (≥5 行) `.agents-personal/` 下任何文件或子目录; subagent 任务含上述操作同理. Read / cat / grep / ls 等纯读不触发.

### 动作

停手 → 描述将删什么 (具体路径 + 内容范围) + 原因 + 影响 → 等用户明确确认 → 再执行. 不能 agent 脑补"用户应该同意".

### 用户主动指示删

视为已确认, 但删前回显具体路径让用户最后一刻能反悔. 没继续否定就执行.

### 不要

- sediment / sow "顺手"清理旧 wiki / 旧 rule (除非命令定义了清理动作且用户已勾选)
- 为"重新组织"批量 mv / rm (结构改也是删除等价物)
- 假设 git mv 不算删除 (`.agents-personal/` 是 gitignored, mv = delete + create)
- 因"过时 / 跟新决策矛盾"自己拍板删 (superseded 仍有参考价值, 由用户判断该删还是标 `superseded by ...` 保留)

### `$USER_WIKI_PATH` 同等护栏

`/sediment` 的 `wiki:cross-project advisor` 出口写到 `$USER_WIKI_PATH/`, 同等不可恢复, 同等护栏. 本节凡处推广.
