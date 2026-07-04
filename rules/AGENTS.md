# rules/ — 在此目录工作的约束

`rules/manifest.json` 是本目录的**唯一真值源**。`model/agent-catalog-*.md`（catalog 分片）和
`hooks/pretooluse-rules.json` 是**生成物，禁止手改**——手改会在下次 `generate.mjs` 或
SessionStart 的 `--check` 时被覆盖 / 报漂移。

## 增删改一条 rule 的标准工序

1. **改 `rules/manifest.json`**——唯一入口。新增/修改 rule 定义（`bucket` / `triggers` /
   `summary` / `guard` / `pretooluse` 等字段，完整字段见 README）；新增 rule 需要正文内容时，
   同时加 `rules/rule-<slug>.md`（`<slug>` 与 manifest 里的 `id` 一致）。
2. **跑生成器**：`node hooks/generate.mjs`——重新生成 `model/agent-catalog-N.md` 分片 +
   `hooks/pretooluse-rules.json`。不要跳过这一步，否则常驻
   context 里的路由表和 PreToolUse 拦截规则会与 manifest 脱节。
3. **测试**：`node --test 'hooks/*.test.mjs'`（尤其 `hooks/generate.test.mjs` /
   `hooks/manifest.test.mjs`）。
4. **升版本**：`rules/` 属于插件加载路径，改动后必须按 CLAUDE.md「修改插件后，升级版本号」升级
   `.claude-plugin/plugin.json` 的 `version`（新增 rule → minor；措辞/触发词微调 → patch；
   bucket 语义反转等破坏性变更 → major），并把版本变更放进同一个 commit。
5. **commit 前一致性兜底**：不放心的话手动跑一次 `node hooks/generate.mjs --check`——
   SessionStart 也会跑这一步，drift 只 warn 不阻断 session，但 commit 前自己确认更省心。

## 硬约束

- **禁止手改生成物**：`model/agent-catalog-1.md` / `model/agent-catalog-2.md`（及未来可能新增的
  分片）、`hooks/pretooluse-rules.json`。这几个文件顶部都标注了
  「本文件由 `hooks/generate.mjs` 生成，禁手改」。真要改内容，改 `manifest.json` 再重新生成。
- **manifest 是 buckets + rules 的唯一结构**：不要在别处（例如某个 rule-*.md 顶部）重新定义
  bucket 归属或触发词——那些信息只活在 manifest 里，rule-*.md 只放规则正文。
- **rule 文件命名**：`rule-<id>.md`，`<id>` 必须与 manifest 中该 rule 的 `id` 字段完全一致
  （如 `id: "git-worktree"` → `rules/rule-git-worktree.md`）。不是每条 rule 都有对应文件——
  `action` 直接指向 `Skill(nocode:xxx)` 的 rule（`read` 字段为空）不需要 rule-*.md，正文住在对应
  skill 里，manifest 只做路由。
- **分片上限**：catalog 按桶切分，单条 rule 不会被截断；总片数超过 `MAX_CATALOG_SHARDS`（当前
  5）会在生成时直接 throw。新增大量 rule 导致要开新分片时，先在 `hooks/hooks.json` 和
  `hooks/inject-rules.sh` 加对应 `catalog-N` segment，再调高 `generate.mjs` 里的
  `MAX_CATALOG_SHARDS`，顺序不能反——反了会静默漏注入。

## rule-*.md 正文的结构约定

参考现有文件（`rule-git-worktree.md` / `rule-push-summary.md` / `rule-codex-review.md` 等），
惯例结构：

- 开头一段点明这条规则解决什么问题、相对哪个 skill/默认行为是「覆盖」还是「独立流程」。
- `## 触发` / `## 不触发`（或「不含」）——明确正例反例边界，与 manifest 里的 `trigger_desc` /
  `triggers` 呼应但可以展开更多细节。
- 中间是规则正文（流程步骤、路径模板、决策表等，视规则复杂度而定）。
- 结尾常有 `## 不要`——列反模式，帮助避免规则被误用或部分执行。

这只是惯例不是强制 schema——manifest 才是校验点（`node hooks/generate.mjs --check` 只比对生成物
与源，不校验 rule-*.md 内部格式）。但保持结构一致有助于新规则被快速读懂。

## rule-references/ 的角色

`rule-references/` 是给**单条 rule 内容过大、需要拆成多个子文件**时用的预留目录（镜像 skill 的
`references/` 模式）。历史上 `rule-references/rule-finishing-branch/` 存过
`pr-flow-gh.md` / `pr-flow-bkt.md` / `prflow.md` 等子文件，随着该 rule 在
`1ba0052`（feat!: Land 拆分）中升级为独立 skill `nocode:dev-finish-branch`，这些内容已迁移到
`skills/dev-finish-branch/references/`，`rule-references/` 目前为空（只剩 `.DS_Store`）。

- 该目录当前**没有被任何生成逻辑读取**（`generate.mjs` 不扫描它），纯粹是未来复杂 rule 的
  预留落点。
- 若某条 rule 正文写到需要拆子文件的规模，评估是否该 rule 其实该升级为 skill（像
  finishing-branch 那样）——目前的先例是「规则复杂到需要拆分」往往意味着它该是 skill 而不是 rule。
  只有确定仍是「rule 性质」（轻量、无多步交互）但内容确实分几块时才用本目录。
- 不要往这里塞与规则无关的文档；不要手动创建子目录结构而不先看 manifest 里对应 rule 是否需要
  `read` 指向这些子文件。

## 快速核对清单（改完 rule 后自查）

- [ ] `manifest.json` 里的 `id` 与新增/改动的 `rules/rule-<id>.md` 文件名一致
- [ ] `node hooks/generate.mjs` 跑过，无报错（未超分片上限）
- [ ] `node hooks/generate.mjs --check` exit 0（生成物与 manifest 一致）
- [ ] `node --test 'hooks/*.test.mjs'` 通过
- [ ] `.claude-plugin/plugin.json` 的 `version` 已按 SemVer 升级，且和本次改动在同一个 commit
- [ ] 没有手改 `model/agent-catalog-*.md` / `hooks/pretooluse-rules.json`
