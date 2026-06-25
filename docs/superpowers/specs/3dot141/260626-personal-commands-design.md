# Design: personal-* 命令族 + skill 参考链完善

> 状态: 草稿
> 作者: 3dot141
> 日期: 260626
> Restate: personal-* 命令族（init/recall/distill/lint/dream）+ distill 瘦身 + pd-ui/dev-design/dev-plan 参考链

## 前置调研

**代码内部** [Read 自本会话]:
- `commands/distill.md` — 462 行，包含 wiki 两层目录管理（融合/supersede/promote）、rules:project 双写、lint 9 条检查、dream scan/propose/execute。这些是要抽到 personal-distill 和 personal-dream 的主体
- `commands/recall.md` — 44 行，纯代理：spawn recall-search agent，传关键词+路径，展示结果
- `agents/recall-search.md` — 107 行，5 步搜索流程（关键词扩展→rg 召回→元数据提取→AI 打分→格式化），同时搜 wiki + vault
- `scripts/personal-lint.mjs` — 141 行，扫 `~/.nocode/personal-history/` 枚举项目，检查 AGENTS.md 变量名对齐
- `scripts/personal-snapshot.mjs` — 126 行，SessionStart 快照到 bare repo
- `commands/personal-init.md` — 269 行，创建 .agents-personal/ 结构 + 仓库扫描预填

**已有决策**:
- `.agents-personal/` 是 gitignored 的项目本地存储，worktree 通过 symlink 共享主仓的 [Read rule-git-worktree]
- personal-snapshot 用 `~/.nocode/personal-history/<project-id>/` bare repo 做版本备份
- distill 五出口：wiki:project / wiki:cross-project / rules:project / rules:plugin / skip

## 方案对比

### 核心决策：命令间如何通信

| | 方案 A: 嵌入引用 | 方案 B: Skill 调用（推荐） |
|---|---|---|
| **思路** | distill.md 直接 `Read commands/personal-distill.md` 读取写入协议并内联执行 | distill.md 调 `Skill(nocode-evolve:personal-distill)` 委派写入 |
| **优势** | 零切换开销，无 skill 加载延迟 | 职责完全隔离；personal-distill 的 context 独立于 distill；可独立 `/personal-distill` 调用 |
| **代价** | distill 的 context 膨胀（读入全部写入协议）；personal-distill 不能独立调用 | Skill 切换有一次上下文加载 |
| **可维护性** | 改 personal-distill 要确认 distill 的引用路径不变 | 完全解耦，各改各 |

**推荐方案 B**：理由——personal-* 命令要求可独立调用（用户直接 `/personal-distill`），且 distill 已是大文件（462 行），不应再膨胀。Skill 调用是插件内已有的成熟模式（devflow 调 dev-define 就是这样）。

### 方案 B 架构

```
用户 /distill
  → distill (路由层, ~150 行)
      分析会话 → 生成候选 → 表格 → 用户勾选
      ├── wiki:project + rules:project → Skill(nocode-evolve:personal-distill)
      ├── wiki:cross-project → advisor "建议 /sow"
      ├── rules:plugin → 直接改插件 (三步联动)
      └── skip → 报告

用户 /recall
  → recall (路由层, ~30 行)
      ├── .agents-personal/ → Skill(nocode-evolve:personal-recall)
      └── vault → 直接搜 (或未来 vault-recall)

用户 /personal-lint
  → personal-lint (独立, ~80 行)
      wiki 健康检查 + rules 检查 + AGENTS.md 变量对齐
      调 scripts/personal-lint.mjs (变量检查) + 内联 wiki/rules 检查

用户 /personal-dream
  → personal-dream (独立, ~100 行)
      调 personal-lint 获取健康状态
      scan → propose → 用户勾选 → execute
      不依赖 distill

用户 /personal-distill
  → personal-distill (独立, ~250 行)
      调 personal-lint 做写入前检查
      wiki 写入 (两层/融合/supersede/promote/index/log)
      rules 写入 (rule 文件 + AGENTS.md 触发条目)
      AGENTS.md 写入 (变量覆盖 + 新分节)
```

## 各命令设计

### personal-lint (commands/personal-lint.md)

**输入**: 无参数（检查当前项目）或 `--all`（扫所有项目）
**输出**: 健康报告（error/warn/info 分级）

**检查项** (合并 distill Step 0 的 9 条 + personal-lint.mjs 的变量检查):

| 类别 | 检查 | 严重度 |
|---|---|---|
| 结构 | index.md 与实际文件不一致 | error |
| 结构 | 孤立页（无 Related Pages 引用） | warn |
| 结构 | 过大页（>800 词） | info |
| 结构 | 缺 TLDR 或 TLDR ≠ description | warn |
| 结构 | draft/ 中 >30 天未 promote 的 stub | info |
| 内容 | pages/ 中 >90 天未 last_updated | info |
| 内容 | superseded_by 目标不存在 | error |
| 引用 | pages/ 页 body 引用 draft/ 页 | warn |
| 索引 | 总页数 ≥30 且平铺模式 | warn |
| 变量 | AGENTS.md 变量名不在插件当前列表 | warn |
| rules | AGENTS.md 触发条目指向不存在的 rules/ 文件 | error |

**实现**: wiki/rules 检查内联执行（Read 文件 + 判断）；变量检查调 `scripts/personal-lint.mjs`；`--all` 模式调 `scripts/personal-lint.mjs` 扫所有项目。

### personal-distill (commands/personal-distill.md)

**输入**: 从 distill 收到的结构化候选（summary + disposition + body + target）
**也可独立调用**: `/personal-distill` 用户直接指定写入内容

**职责**:
1. 写入前调 personal-lint 做健康检查（附在报告底部）
2. wiki 写入：
   - 新建 → Write draft/ 或 pages/，含 frontmatter
   - 融合 → Read 目标 + 融进合适章节（不是末尾 paste）
   - supersede → 旧页标 superseded + 建新页
   - promote → draft → pages
3. rules 写入：
   - 新建 → Write rules/\<slug\>.md + Edit AGENTS.md 加触发条目
   - 融合 → Read 目标 rule + 融进
4. AGENTS.md 写入：
   - 变量覆盖更新
   - 新分节（项目约定、协作偏好等）
5. 写入后 index 重建 + log 追加
6. 产出报告

**从 distill 抽出的逻辑**:
- 「内嵌的 wiki:project 规则」整节（目录结构/两层职责/frontmatter/maturity/body/命名/整合决策树/融合/supersede/promote）
- 「rules:project 出口」节
- Step 0 lint 调用改为 `Skill(nocode-evolve:personal-lint)`
- index 重建 + log 追加逻辑

### personal-recall (commands/personal-recall.md)

**输入**: 搜索关键词
**输出**: 按置信度排序的清单（仅 .agents-personal/ 范围）

**与 recall 的分工**:
- recall 搜两个地方：.agents-personal/wiki/ + $USER_VAULT_PATH/Memory/
- personal-recall 只搜 .agents-personal/wiki/（+ rules/ + AGENTS.md）
- recall 调 personal-recall 搜 personal 部分，自己搜 vault 部分，合并结果

**实现**: 复用 recall-search agent 的搜索逻辑（关键词扩展→rg 召回→元数据→打分），但范围限定为 .agents-personal/。

### personal-dream (commands/personal-dream.md)

**输入**: 无参数
**输出**: 动作提案表 → 用户勾选 → 执行

**三阶段**:

1. **Scan**: 调 personal-lint 获取健康状态 + 逐页检查：
   - related 代码路径是否仍存在
   - page 描述 vs 代码现状是否匹配
   - draft 停滞时间
   - 页间重叠度

2. **Propose**: 输出动作表
   | 动作 | 条件 |
   |---|---|
   | prune | draft/ >30 天 stub，未被整合 |
   | stale | related 代码路径已变化/不存在 |
   | merge | 两页主题高度重叠 |
   | promote | draft/ 已丰富（2+ sources）未提升 |
   | archive | related 路径全部不存在 |
   | ok | 无需动作 |

3. **Execute**: 用户勾选后执行（删除走 .agents-personal 护栏二次确认）

## 上游重构

### distill 瘦身

**删除**:
- Step 0 lint 逻辑（9 条检查规则）→ 改为一行：调 `Skill(nocode-evolve:personal-lint)`
- 「内嵌的 wiki:project 规则」整节（~220 行）→ 搬到 personal-distill
- 「rules:project 出口」节（~40 行）→ 搬到 personal-distill
- 「Dream 操作」整节（~45 行）→ 删除（personal-dream 是独立命令）
- `--dream` 入口 → 删除

**保留**:
- 入参处理
- 五出口定义
- Step 1 扫会话 + 生成候选
- Step 2 表格呈现 + 编号选择
- Step 3 跨仓写入确认
- Step 4 分发路由（wiki:project + rules:project 改为调 personal-distill，其余不变）
- Step 5 总报告
- wiki:cross-project advisor
- rules:plugin 三步联动
- skip 处理

**distill 分发变更**:
```
Step 4 分发:
  wiki:project → Skill(nocode-evolve:personal-distill)，传入候选列表
  rules:project → Skill(nocode-evolve:personal-distill)，传入候选列表
  wiki:cross-project → 不变（advisor → /sow）
  rules:plugin → 不变（三步联动）
  skip → 不变
```

### recall 瘦身

**变更**:
- recall-search agent 现在同时搜 wiki + vault
- 改为：personal-recall 搜 wiki，recall 自己搜 vault，合并结果
- 或更简单：recall 仍调 recall-search 搜两个源，但 personal-recall 作为独立入口只搜 personal

**推荐**: recall 保持现状（仍调 recall-search 搜两源），personal-recall 是独立入口（只搜 .agents-personal/）。不强制 recall 依赖 personal-recall——避免增加调用链复杂度。

## Part B: skill 参考链完善

### pd-ui 高保真产出

**现状**: Step 5 出高保真 HTML 时没有引用 design taste skills。
**改动**: 在 Step 5（高保真产出）加入 design taste skill 引用:
- 用户在 Step 4 选视觉方向后，mapping 到对应的 design taste skill
- 高保真 HTML 产出时 `Skill(<对应 taste skill>)` 加载规范
- 映射表:

| 视觉方向 | 对应 skill |
|---|---|
| 简约编辑风 | minimalist-ui |
| 高端质感 | high-end-visual-design |
| 机械工业风 | industrial-brutalist-ui |
| 防模板化 / 改版 | design-taste-frontend / redesign-existing-projects |

### dev-design 多 skill 引用

**现状**: 领域指南表已有 8 个引用（架构/API/安全/性能/前端/可观测/测试/迁移），Step 9 已有 design taste skill 引用。
**改动**:
1. 「前置调研」章节已在本次添加（前一个 commit）
2. Step 9 的 UI 设计节扩展：明确要求写入 UI 风格选型 + UI 架构（组件拆分/状态管理/渲染策略）+ UI 技术选型（CSS 框架/组件库）
3. 领域指南表的引用时机更明确：Step 1 探索时就按需 Read，不是等到写文档时

### dev-plan 引用

**现状**: dev-plan 已有完整流程（只读加载→依赖图→垂直切片→写 task→checkpoint→validation→确认）。
**改动**: 在 Step 0（加载计划前）明确引用:
- `superpowers:writing-plans` — plan 硬约束（每步贴代码/禁占位符/HARD-GATE）
- 垂直切片参考 agent-skills 的 planning-and-task-breakdown 方法论（sizing ≤5 文件/checkpoint/依赖图）
- 这些引用已体现在现有流程中，需要更显式地标注来源

## 验证策略

本任务全部是 markdown 文件（命令/skill 定义），无可执行代码新增（除 personal-lint.mjs 已有）。

| TO | 覆盖 | 层级 | 说明 |
|---|---|---|---|
| TO-1 | personal-lint | 手动 | `/personal-lint` 能跑通，输出健康报告 |
| TO-2 | personal-distill | 手动 | 读 personal-distill 命令内容，确认包含完整 wiki 写入协议 |
| TO-3 | personal-dream | 手动 | 读 personal-dream 命令内容，确认 scan/propose/execute 三阶段完整 |
| TO-4 | personal-recall | 手动 | 读 personal-recall 命令内容，确认搜索范围正确 |
| TO-5 | distill 瘦身 | 手动 | 读 distill.md，确认无 wiki 写入逻辑/lint/dream 残留 |
| TO-6 | recall | 手动 | 读 recall.md，确认 personal-recall 引用正确 |
| TO-7 | pd-ui | 手动 | 读 pd-ui SKILL.md，确认高保真步骤引用 design taste skills |
| TO-8 | dev-design | 手动 | 读 dev-design SKILL.md，确认 UI 节扩展 |
| TO-9 | dev-plan | 手动 | 读 dev-plan SKILL.md，确认引用标注 |
| TO-10 | 交叉引用 | 自动 | `node --test 'hooks/*.test.mjs'` 通过 |
| TO-11 | catalog 一致性 | 自动 | `node hooks/generate.mjs --check` 无漂移 |

**不测项**: 实际运行 /personal-distill 写入 wiki（需要真实会话上下文触发 distill 才能端到端验证，本次不具备条件，标注为"首次实际使用时人工验证"）。
