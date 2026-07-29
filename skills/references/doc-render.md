# doc-render — approved Markdown → Open Design 页面

共享 render 协议，供技术设计、PRD、RFC、ADR 与研究报告使用。它只负责忠实呈现和持久化产物关系，不修改源文档，不复制 Open Design 的实现命令。

## Iron Law

- Markdown 是唯一规范性内容源。
- render 是纯输出；页面和 receipt 都不能反向改变已评审结论。
- provider 能力统一 handoff 给 `open-design`，本协议不维护一套会漂移的 CLI / tool surface。

## Enter Gate

- 源文档路径存在且内容已定稿。
- 对 Design 文档，frontmatter 必须 `status: approved`，且 `designDigest` 可用。
- 调用方已明确选择 render。

## StagePlan

render 维护内部阶段清单，不覆盖主流程计划：

```text
1. 读取源文档并提取章节、图、表与代码清单
2. handoff Open Design，忠实生成与发布
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

“内容忠实”指结论、措辞、章节和约束不失真，不要求逐像素镜像 Markdown。ASCII 图可转为 DOM / SVG / Mermaid 等更适合页面的呈现，但语义节点与关系不得丢失。

## Step 2：handoff Open Design

把完整文档、结构分析和以下要求传给 Open Design：

- 忠实覆盖全部规范性章节
- 长文档提供可定位的导航
- 视觉语言与文档主题匹配
- 生成 / 更新可回读的页面产物
- 返回真实 project、conversation、run、preview 和入口文件信息

<!-- nocode:platform claude -->
Open Design handoff 使用 `Skill(nocode:open-design)`。
<!-- /nocode:platform -->

<!-- nocode:platform codex -->
Open Design handoff 使用 `$open-design`。
<!-- /nocode:platform -->

Open Design 不可用或执行失败时，明确返回 render 未完成；Markdown 仍是最终交付。不得伪造 provider ID、URL 或本地 fallback。

## Step 3：覆盖核对

回读 Open Design 产物，至少检查：

1. 源文档所有规范性章节均有页面落点。
2. Q / BF / API / DATA / SEC / IDEM / TO 等 Registry ID 没有因视觉重组丢失。
3. 决策表、失败路径、关键契约和验证目标完整。
4. 导航可定位主要章节。
5. `sourceDoc` 内容与 `sourceDigest` 在 render 期间未变化。

将结果写入 `coverage`：

```yaml
coverage:
  sourceSections: integer
  renderedSections: integer
  missingSections: []
  registryIdsChecked: integer
  missingRegistryIds: []
  navigationChecked: true | false
```

任一规范性章节或 Registry ID 缺失都算 render 失败，不能只给 preview URL。

## Step 4：持久化 receipt

成功后生成：

```yaml
RenderReceipt:
  sourceDoc: /absolute/path/to/doc.md
  sourceDigest: sha256:...
  projectId: string
  conversationId: string
  runId: string
  previewUrl: string
  entryFile: string
  coverage: object
  receiptPath: /absolute/path/to/doc.render-receipt.json
```

receipt 固定写到源文档同目录的 `<basename>.render-receipt.json`。它是**非规范性元数据** sidecar：

- 不参与 Design `designDigest`
- 不承载新的设计结论
- 可随相同 `sourceDigest` 更新 provider 状态
- 源 digest 变化后立即 stale，必须重新 render，不能复用旧 receipt

返回调用方前再次确认：

- receipt 文件已落盘，字段齐全
- `entryFile` 可回读
- `previewUrl` 来自真实 provider 结果
- coverage 无缺口
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
- render 回写“可视化说明”到 approved Markdown
- provider 不可用时伪造本地页面或 ID
