# rules/ — 在此目录工作的约束

每个 `rule-<id>.md` 文件顶部的 frontmatter（`name`/`description`/`skip`）是该规则的**唯一真值
源**——没有 `manifest.json` 这层中转。`model/agent-rule-catalog-*.md`（catalog 分片）和
`hooks/pretooluse-rules.json` 是**生成物，禁止手改**——手改会在下次跑 compile 脚本或 SessionStart
的 `--check` 时被覆盖 / 报漂移。

## 增删改一条 rule 的标准工序

1. **改对应 `rules/rule-<id>.md` 的 frontmatter**——唯一入口。新增规则：新建 `rule-<slug>.md`，
   顶部加 `name: <slug>` / `description: >- ...`（触发条件 + 不触发边界写进一句话）/
   `skip: false`。改触发条件：只改这一个文件的 `description`，不用去别处同步。
2. **跑生成器**：`node scripts/compile.rule.js`——重新生成 `model/agent-rule-catalog-N.md`。不要
   跳过这一步，否则常驻 context 里的路由表会与源文件脱节。
   - 若改的是 PreToolUse 硬拦截 pattern（`block`/`inject`），走另一条独立链：直接改
     `scripts/compile.hooks.js` 里硬编码的规则数组，跑 `node scripts/compile.hooks.js`。这条链
     不读本目录任何文件。
3. **测试**：`node --test 'hooks/*.test.mjs'`。
4. **升版本**：`rules/` 属于插件加载路径，改动后必须按 CLAUDE.md「修改插件后，升级版本号」升级
   `plugin/metadata.json` 的 `version`，并运行 `node scripts/compile.platform.mjs`（新增 rule → minor；措辞/触发词微调 → patch；
   frontmatter schema/路径改名等破坏性变更 → major），并把版本变更放进同一个 commit。
5. **commit 前一致性兜底**：不放心的话手动跑一次 `node scripts/compile.rule.js --check` +
   `node scripts/compile.hooks.js --check`——SessionStart 也会跑这两步，drift 只 warn 不阻断
   session，但 commit 前自己确认更省心。

## 硬约束

- **禁止手改生成物**：`model/agent-rule-catalog-1.md`（及未来可能新增的分片）、
  `hooks/pretooluse-rules.json`。这几个文件顶部都标注了「本文件由脚本生成，禁手改」。真要改
  内容，改源（rule frontmatter 或 `compile.hooks.js`）再重新生成。
- **不再有「桶」这层抽象**：每条规则独立一行渲染进 catalog，`description` 自己承担全部触发/不
  触发判断，不要在别处（例如某个共享文件）重新定义分组或粗触发摘要。
- **rule 文件命名**：`rule-<id>.md`，`<id>` 必须与文件自身 frontmatter 的 `name` 字段完全一致
  （如 `name: git-worktree` → `rules/rule-git-worktree.md`）。
- **不是所有触发规则都要建 `rule-*.md`**：纯 `Skill(nocode:xxx)` 路由的规则，触发条件写进该
  skill 自己 `SKILL.md` 的 `description` 就够（Claude Code 原生 skill 发现机制已覆盖），不要在
  本目录重复建一份；本来就常驻不需要按需触发的规则（如删除护栏）内容归属对应的常驻 `model/*.md`
  文件，PreToolUse pattern 单独进 `scripts/compile.hooks.js`。
- **分片上限**：catalog 按行切分，单条规则不会被截断；总片数超过 `MAX_CATALOG_SHARDS`（当前 5）
  会在生成时直接 throw。新增大量规则导致要开新分片时，先在 `hooks/hooks.json` 和
  `hooks/inject-nocode.sh` 加对应 `model-rule-catalog-N` segment，再调高 `compile.rule.js` 里的
  `MAX_CATALOG_SHARDS`，顺序不能反——反了会静默漏注入。

## rule-*.md 正文的结构约定

参考现有文件（`rule-git-worktree.md` / `rule-git-freshness.md` / `rule-codex-review.md` 等），
惯例结构：

- frontmatter（`name`/`description`/`skip`）。
- 开头一段点明这条规则解决什么问题、相对哪个 skill/默认行为是「覆盖」还是「独立流程」。
- `## 触发` / `## 不触发`（或「不含」）——展开 frontmatter `description` 没写完的边界细节。
- 中间是规则正文（流程步骤、路径模板、决策表等，视规则复杂度而定）。
- 结尾常有 `## 不要`——列反模式，帮助避免规则被误用或部分执行。

这只是惯例不是强制 schema——`compile.rule.js --check` 只比对生成物与源 frontmatter，不校验
rule-*.md 正文内部格式。但保持结构一致有助于新规则被快速读懂。

## rule-references/ 的角色

`rule-references/` 是给**单条 rule 内容过大、需要拆成多个子文件**时用的预留目录（镜像 skill 的
`references/` 模式）。历史上 `rule-references/rule-finishing-branch/` 存过
`pr-flow-gh.md` / `pr-flow-bkt.md` / `prflow.md` 等子文件，随着该 rule 在
`1ba0052`（feat!: Land 拆分）中升级为独立 skill，后又并回 `nocode:dev-land`（v11.0.0），这些内容已迁移到
`skills/dev-land/references/`，`rule-references/` 目前为空（只剩 `.DS_Store`）。

- 该目录当前**没有被任何生成逻辑读取**（`compile.rule.js` 不扫描它），纯粹是未来复杂 rule 的
  预留落点。
- 若某条 rule 正文写到需要拆子文件的规模，评估是否该 rule 其实该升级为 skill（像
  finishing-branch 那样）——目前的先例是「规则复杂到需要拆分」往往意味着它该是 skill 而不是 rule。
  只有确定仍是「rule 性质」（轻量、无多步交互）但内容确实分几块时才用本目录。
- 不要往这里塞与规则无关的文档；不要手动创建子目录结构而不先确认对应 rule 是否真的需要拆分。

## 快速核对清单（改完 rule 后自查）

- [ ] `rule-<id>.md` 文件名与自身 frontmatter 的 `name` 字段一致
- [ ] `node scripts/compile.rule.js` 跑过，无报错（未超分片上限）
- [ ] `node scripts/compile.rule.js --check` exit 0（生成物与源一致）
- [ ] 若碰了 PreToolUse pattern：`node scripts/compile.hooks.js` 跑过 + `--check` exit 0
- [ ] `node --test 'hooks/*.test.mjs'` 通过
- [ ] `plugin/metadata.json` 的 `version` 已按 SemVer 升级，双平台发布物已重新生成，且和本次改动在同一个 commit
- [ ] 没有手改 `model/agent-rule-catalog-*.md` / `hooks/pretooluse-rules.json`
