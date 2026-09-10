---
name: figma-read
description: "读取 Figma 设计稿。当用户给 figma.com/design 或 figma.com/file 链接，要求读取设计稿节点、提取设计值（字号/颜色/间距/圆角）、渲染节点截图、解析设计变量、对齐 UI 实现、检查样式差异，或把设计上下文导出为可复用快照时使用。不负责：分析用户已贴的设计稿截图、创建或修改 Figma 文件、Code Connect、FigJam，以及无 inspect 需求的原型预览链接。"
---

# figma-read：快照定位，原生取值

先把 Figma 链接物化为可复用快照，后续从快照理解设计；需要精确值、截图或变量时再调用 Figma REST API。快照减少重复整树抓取，不取代原始数据源。

## 功能

| 功能 | 数据源 | 产出 |
|---|---|---|
| 设计快照 | Framelink `fetch` | 可复用的 `design.yaml` |
| 设计读取 | Framelink 快照 | 节点层级、文本、布局、组件关系 |
| 精确取值 | Figma REST `files/nodes` | 字号、字重、字体、颜色、圆角、间距等原始值 |
| 节点截图 | Figma REST `images` | 本地 `preview.png` |
| 设计变量 | Figma REST `variables/local` | 变量名、mode 与值（Enterprise 限定） |
| UI 对齐 | 快照定位 + REST 精确值 + 当前代码 | 逐元素差异表 |
| 无 Token 备选 | ego-browser | 页面截图 + 属性面板部分值 |

职责边界：Framelink 只负责生成和复用快照；精确值、截图、变量与最终对齐基准全部保留原生 REST 方案。

## 工作流

```text
Figma URL
   │
   ├─ 解析 file_key / node_id / api_node_id
   │
   ├─ Framelink 快照存在且未要求刷新？
   │    ├─ 是 ─→ 无需 Token，复用 design.yaml
   │    └─ 否
   │         ├─ 有 Token ─→ 原子导出 design.yaml
   │         └─ 无 Token ─→ ego-browser 有限结果 → 标注边界并结束
   │
   ├─ 先读快照回答
   │        │
   │        ├─ 信息足够 ─→ 输出结果
   │        └─ 需要精确/视觉/变量
   │                 ├─ files/nodes
   │                 ├─ images
   │                 └─ variables/local
   │
   └─ 需要对齐代码 ─→ 快照定位 × REST 精确值 × 当前实现
```

## 凭证约定

读取已有快照不需要 Token。只有创建/刷新快照或调用原生 REST 时才需要 Personal Access Token，获取优先级：

1. `$FIGMA_TOKEN`（原生 REST 约定）
2. `$FIGMA_API_KEY`（Framelink 原生变量名）
3. 都不可用 → 不联网；已有快照继续读取，否则走 Step 2a

不要输出、记录或写入 Token。原生 REST 调用统一在当前 shell 中取：

```bash
FIGMA_PAT="${FIGMA_TOKEN:-${FIGMA_API_KEY:-}}"
```

需要新 Token 时，告知生成位置：Figma → Settings → Security → Personal access tokens。

## Step 1: 解析链接

Figma 链接：

```text
https://www.figma.com/design/{file_key}/{title}?node-id={node_id}&...
```

- `file_key`：URL 路径第三段
- `node_id`：query param `node-id`，如 `2112-9905`
- `api_node_id`：把 `node_id` 的 `-` 换成 `:`，如 `2112:9905`

## Step 2: 创建或复用 Framelink 快照

完整读取 `references/framelink.md`，按其中流程确定快照路径、判断复用或刷新、执行原子导出并处理失败。

本步骤必须返回：

- `snapshot_dir` 的实际绝对路径
- `snapshot_file` 的实际绝对路径
- 状态：`reused` / `created` / `refreshed` / `failed`

只有用户明确要求刷新时才能替换已有快照。Framelink 失败时可以继续原生 REST 一次性读取，但不得把 REST 响应冒充快照成功。

## Step 2a: 无快照且无 Token 备选

当 Step 2 没有可复用快照、又因缺少 Token 无法导出时，用 ego-browser 打开设计稿、截图并读取右栏属性面板文本。完整流程与能力边界见 `references/ego-browser-channel.md`。

- 面板文本只够快查，不作对齐基准
- 截图只做视觉参考，不推精确数值
- 不得把网页面板结果伪装成 Framelink 快照或 REST 原生值

## Step 3: 先读快照

同一 `file_key + node_id` 的后续问题默认搜索和局部读取 `snapshot_file`，不重新请求 Framelink。先定位节点名、ID、文本或样式键，再读取相邻片段，避免把整份大文件一次塞进上下文。

快照适合回答：层级关系、文本内容、布局方式、组件关系和相关节点位置。字段缺失、需要像素级确认或用户明确要求原始值时进入 Step 4。

## Step 4: 用原生 REST 取精确节点值

```bash
FIGMA_PAT="${FIGMA_TOKEN:-${FIGMA_API_KEY:-}}"
curl -fsS -H "X-Figma-Token: $FIGMA_PAT" \
  "https://api.figma.com/v1/files/{file_key}/nodes?ids={api_node_id}"
```

返回 JSON 位于 `nodes.{api_node_id}.document`。需要一次列出常用精确值时，保持原生响应直接进入本地提取器：

```bash
FIGMA_PAT="${FIGMA_TOKEN:-${FIGMA_API_KEY:-}}"
curl -fsS -H "X-Figma-Token: $FIGMA_PAT" \
  "https://api.figma.com/v1/files/{file_key}/nodes?ids={api_node_id}" \
  | python3 -c '
import json, sys

data = json.load(sys.stdin)

def walk(node):
    node_type = node.get("type", "")
    name = node.get("name", "")
    node_id = node.get("id", "")
    if node_type == "TEXT":
        style = node.get("style", {})
        print(node_id, node_type, repr(name), repr(node.get("characters", "")),
              "fontSize=", style.get("fontSize"),
              "fontWeight=", style.get("fontWeight"),
              "fontFamily=", style.get("fontFamily"))
    elif node_type in ("FRAME", "RECTANGLE", "COMPONENT", "INSTANCE"):
        padding = {key: node.get(key) for key in
                   ("paddingLeft", "paddingRight", "paddingTop", "paddingBottom")
                   if node.get(key) is not None}
        print(node_id, node_type, repr(name),
              "fills=", node.get("fills", []),
              "cornerRadius=", node.get("cornerRadius"),
              "padding=", padding)
    for child in node.get("children", []):
        walk(child)

for entry in data.get("nodes", {}).values():
    walk(entry.get("document", {}))
'
```

| 属性 | Figma REST 字段 | 对应 CSS |
|---|---|---|
| 字号 | `style.fontSize` | `font-size` |
| 字重 | `style.fontWeight` | `font-weight` |
| 字体 | `style.fontFamily` | `font-family` |
| 文案 | `characters` | innerText |
| 背景色 | `fills[].color`（RGBA 0-1） | `background-color` |
| 圆角 | `cornerRadius` / `rectangleCornerRadii` | `border-radius` |
| 内边距 | `paddingLeft/Right/Top/Bottom` | `padding` |

颜色示例：`{r: 0.96, g: 0.96, b: 0.98, a: 1}` → `#f5f5fa`。

## Step 5: 用原生 REST 渲染节点截图（可选）

需要视觉参考时调用 images 端点，把最终图片保存到 Step 2 返回的 `snapshot_dir/preview.png`：

```bash
FIGMA_PAT="${FIGMA_TOKEN:-${FIGMA_API_KEY:-}}"
curl -fsS -H "X-Figma-Token: $FIGMA_PAT" \
  "https://api.figma.com/v1/images/{file_key}?ids={api_node_id}&format=png&scale=2"
# 从响应 images.{api_node_id} 取临时 URL，再下载到：
curl -fsSL '<返回的临时 URL>' -o "$SNAPSHOT_DIR/preview.png"
```

- `scale`：0.01–4；`format`：`jpg` / `png` / `svg` / `pdf`
- 返回 URL 约 30 天过期；本地 `preview.png` 后续仍有效
- 值为 `null` 表示节点渲染失败
- 截图只做视觉参考，不用于推断精确数值

## Step 6: 用原生 REST 解析设计变量（可选）

```bash
FIGMA_PAT="${FIGMA_TOKEN:-${FIGMA_API_KEY:-}}"
curl -fsS -H "X-Figma-Token: $FIGMA_PAT" \
  "https://api.figma.com/v1/files/{file_key}/variables/local"
```

- 前置：Enterprise 组织 Full seat，Token 需含 `file_variables:read` scope
- `meta.variables[id]` 给出 `name` / `resolvedType` / `valuesByMode`
- 403 时回退 Step 4：仍可取得解析后的生效值与 `boundVariables`，但没有完整变量名和多 mode 映射

## Step 7: 与代码实现对比

先用快照定位元素，再以 Step 4 的原生值作为精确基准：

```text
元素: 「标题文字」
Figma: 14px, fontWeight 600, #333333
代码: text-md(14px), font-semibold(600), text-secondary
差异: 已对齐 ✅
```

## 原生链路故障

| 问题 | 原因 | 处理 |
|---|---|---|
| REST 返回 401/403 | Token 无效、scope 不足或文件无权限 | 核对 Token、scope 与文件权限，不降级成猜值 |
| images 返回 `null` | 节点无法被 Figma 渲染 | 报告失败，不拿网页截图冒充 API 渲染结果 |
| variables 返回 403 | 计划、seat 或 scope 不满足 | 回退 Step 4 的解析后生效值 |

## 不要

- 不要把 Framelink 快照当成原始 Figma JSON；快照负责复用上下文，精确值走 REST
- 不要跳过 `references/framelink.md` 自行拼快照命令
- 不要专为读取几个值安装或依赖官方 Figma MCP；环境已有时可辅助，但不是前置
- 不要凭截图推断字号或颜色 hex
- 不要硬编码 Token，或把密钥写进参数、快照和日志
- 不要忘记 Figma 颜色是 0-1 浮点 RGBA
- 不要在非 Enterprise 环境反复调用 variables 端点
