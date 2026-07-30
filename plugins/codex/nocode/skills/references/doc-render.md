# doc-render — approved Markdown → Open Design 三候选页面

共享 render 协议，供技术设计、PRD、RFC、ADR 与研究报告使用。所有文档类型都在一个 Open Design project 内并行生成 A / B / C 三个候选，供用户之后抽卡。它只负责忠实呈现和持久化产物关系，不修改源文档，不复制 Open Design 的实现命令。

## Iron Law

- Markdown 是唯一规范性内容源。
- render 是纯输出；页面和 receipt 都不能反向改变已评审结论。
- provider 能力统一 handoff 给 `open-design`，本协议不维护一套会漂移的 CLI / tool surface。
- 每次 render 只创建一个 project，在其中使用三个 conversation 并行生成三个完整候选；不得退化为三项目、单线程串行或单 run 生成三份文件。

## Enter Gate

- 源文档路径存在且内容已定稿。
- 对 Design 文档，frontmatter 必须 `status: approved`，且 `designDigest` 可用。
- 调用方已明确选择 render。

## 内部执行清单

render 维护内部阶段清单，不覆盖主流程计划：

```text
1. 读取源文档并提取章节、图、表与代码清单
2. handoff Open Design，创建一个项目并行生成 A / B / C
3. 回读产物并做覆盖核对
4. 写非规范性 receipt sidecar，返回调用方
```

## Step 1：分析源文档

只读源文档并记录：

- `sourceDoc`
- `sourceDigest`：Design 使用 frontmatter `designDigest`；其他文档计算文件 SHA-256
- 章节树
- 图清单：位置、类型、复杂度
- 表格 / 代码清单
- 调用方的 `renderBrief`：文档类型、目标人类读者、沟通目标、阅读顺序、图表要求与呈现规则；缺失字段从源文档补推并标记为 inference，不能默认为 Agent 或机器消费
- 固定生成拓扑：`variantCount: 3`、`mode: draw-later`、`projectCount: 1`、`conversationCount: 3`、`dispatch: parallel`

“内容忠实”指结论、措辞、章节和约束不失真，不要求逐像素镜像 Markdown。ASCII 图可转为 DOM / SVG / Mermaid 等更适合页面的呈现，但语义节点与关系不得丢失。

## Step 2：handoff Open Design

把完整文档、结构分析、`renderBrief` 和以下要求传给 Open Design：

- 忠实覆盖全部规范性章节
- 页面首先是给人类阅读的独立解释，不呈现为 Agent prompt、工作流日志、schema dump 或 Markdown 镜像
- 按 `readingOrder` 重组信息层级；长文档提供可定位的导航，首屏先交代问题、结论、范围与关键取舍
- 按语义选图：流程与分支用流程图，系统边界与依赖用架构图，跨参与者调用用时序图，生命周期用状态图，数据变化或模型关系用数据流图 / 实体关系图
- 每张图必须有标题、图例或必要标注，以及紧邻的解释文字；复杂关系拆图，不用超大画布、微小字号或交叉线堆叠制造“图很多”的假象
- 图中使用人类可读名称，精确 ID、接口、事件和 Registry ID 作为次级标注；规范性内容可以移入附录，但不得省略
- 视觉语言与文档主题匹配
- 生成 / 更新可回读的页面产物
- 返回真实 project、conversation、run、preview 和入口文件信息

Open Design handoff 必须执行同一拓扑：

1. 只创建一个 project；项目创建返回的 conversation 映射为 `card-a`。
2. 在该 project 内再创建 `card-b`、`card-c` 两个 conversation，最终恰好三条候选线程。
3. 从 live directions 中选择三个实质不同的方向；给三条线程相同源快照、相同内容约束和不同方向，分别限定输出根 `variants/card-a/`、`variants/card-b/`、`variants/card-c/`。
4. 三个 run 全部异步启动并取得 run ID 后才开始 watch / wait；不得等待 A 完成后再启动 B、C。
5. 每条 conversation 生成一个覆盖完整源文档的独立页面，不把章节拆成三张卡，也不让并发 run 写同一路径。

三张卡按稳定 `variantId` 命名，并用 `directionId` / `directionSummary` 说明差异。只换色、字体、标题或装饰不算不同；视觉探索不得产生新的规范性结论。生成前不要求用户选方向，生成后保持 `selection.status: pending`。


Open Design handoff 使用 `$open-design`。

Open Design 不可用或执行失败时，明确返回 render 未完成；Markdown 仍是最终交付。不得伪造 provider ID、URL 或本地 fallback。

## Step 3：覆盖核对

回读 Open Design 产物，至少检查：

1. 源文档所有规范性章节均有页面落点。
2. Q / BF / API / DATA / SEC / IDEM / TO 等 Registry ID 没有因视觉重组丢失。
3. 决策表、失败路径、关键契约和验证目标完整。
4. 导航可定位主要章节。
5. `sourceDoc` 内容与 `sourceDigest` 在 render 期间未变化。
6. 页面无需会话上下文即可按 `renderBrief.communicationGoal` 读懂；正文不是 Agent 指令、执行轨迹或原始 schema 堆叠。
7. `diagramRequirements` 逐项有对应图，且图的类型、标题、标注、解释和可读尺寸符合要求；该画而未画、用散文替代或大图不可读都算缺口。
8. A / B / C 逐个检查完整性与 coverage；三个 conversation / run 均属于同一个 project，文件位于各自独占输出根，差异达到要求。
9. 三个 run 在任何 watch / wait 前均已取得 run ID；不存在 A 完成后才启动 B、C 的串行退化。

将结果写入 `coverage`：

```yaml
coverage:
  sourceSections: integer
  renderedSections: integer
  missingSections: []
  registryIdsChecked: integer
  missingRegistryIds: []
  navigationChecked: true | false
  humanReadabilityChecked: true | false
  diagramRequirements: integer
  renderedDiagrams: integer
  missingDiagrams: []
```

任一规范性章节、Registry ID、`renderBrief` 必需图表缺失，或 `humanReadabilityChecked: false`，都算 render 失败。任一候选缺失、不完整、不可回读、coverage 有缺口、写错输出根或只有表面差异，也算整个 render 失败。三个项目、少于三条 conversation / run 或串行执行同样失败。

## Step 4：持久化 receipt

成功后生成：

```yaml
RenderReceipt:
  sourceDoc: /absolute/path/to/doc.md
  sourceDigest: sha256:...
  projectId: string
  variantCount: 3
  execution:
    projectCount: 1
    conversationCount: 3
    runCount: 3
    dispatch: parallel
    allRunsStartedBeforeFirstWait: true
  variants:
    - variantId: string
      directionId: string
      directionSummary: string
      conversationId: string
      runId: string
      outputRoot: string
      previewUrl: string
      entryFile: string
      coverage: object
  selection:
    status: pending | selected
    selectedVariantId: string | null
  receiptPath: /absolute/path/to/doc.render-receipt.json
```

三张卡都记录在 `variants`，共享同一个 `projectId`，但各自持有不同的 `conversationId`、`runId`、输出根、预览和入口文件。`draw-later` 完成时写 `selection.status: pending` 与 `selectedVariantId: null`，未选择不是 render 失败。用户以后选择时，只把 selection 更新为 `selected` 并记录真实 `variantId`；不得改源 Markdown、删除未选候选或伪造新的生成结果。

receipt 固定写到源文档同目录的 `<basename>.render-receipt.json`。它是**非规范性元数据** sidecar：

- 不参与 Design `designDigest`
- 不承载新的设计结论
- 可随相同 `sourceDigest` 更新 provider 状态
- 源 digest 变化后立即 stale，必须重新 render，不能复用旧 receipt

返回调用方前再次确认：

- receipt 文件已落盘，字段齐全
- 三个 variant 的 `entryFile` 都可回读，`previewUrl` 都来自真实 provider 结果，coverage 均无缺口
- receipt 中只有一个 `projectId`，三个 `conversationId` 和三个 `runId` 各不相同
- `outputRoot` 分别为 `variants/card-a/`、`variants/card-b/`、`variants/card-c/`，没有跨线程覆盖
- `execution` 证明三个 run 均在首次 watch / wait 前启动，且 `selection.status: pending`
- 源 Markdown 未变化

## 返回

成功：

```yaml
status: completed
receipt: <RenderReceipt>
```

失败：

```yaml
status: failed
sourceDoc: string
sourceDigest: string
reason: string
partialProviderRefs: {}
```

失败不得修改源 Markdown，也不得写看似成功的 receipt。

## Red Flags

- 在本协议硬编码 provider 命令，和 open-design skill 形成双实现
- 只在会话里报告 URL，没有持久化 `receiptPath`
- receipt 没有 `sourceDigest`，无法判断是否过期
- 页面好看但漏了规范性章节、Registry ID 或失败路径
- 把页面做成 Agent prompt、工作流日志、schema dump 或逐段 Markdown 镜像
- 技术关系只用长段落解释，缺少应有的流程图、架构图、时序图或状态图
- 为追求“图多”生成一张不可读的超大关系图，或图没有标题、标注和解释
- 为 A / B / C 各建一个 project，或在一个 conversation / run 里生成三份文件
- 等 A 完成后再创建或启动 B、C，伪装成“同批生成”
- 三个并发 run 写同一入口文件或输出目录，相互覆盖
- 只生成一个，或把一个页面的三个章节冒充三张卡
- 三个候选只换颜色 / 字体 / 标题，或某张卡为了求新而改了设计事实、漏了 coverage
- 还没抽卡就自动选中或删除其它候选
- render 回写“可视化说明”到 approved Markdown
- provider 不可用时伪造本地页面或 ID
