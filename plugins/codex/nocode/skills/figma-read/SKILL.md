---
name: figma-read
description: "\"读取 Figma 设计稿。当用户给 figma.com/design 或 figma.com/file 链接，要求读取设计稿节点、提取设计值（字号/颜色/间距/圆角）、渲染节点截图、解析设…"
---

# figma-read：读取 Figma 设计稿节点属性

读 Figma 链接对应的节点树，提取精确设计值，供 UI 对齐与样式差异检查。数据源是 Figma REST API 返回的原始 JSON——无损、精确。

```
Figma URL ─→ file_key + node_id
                │
                ├─ Step 3  files/nodes  ─→ 设计值（字号/颜色/圆角/内边距）
                ├─ Step 4  images       ─→ 节点 PNG 截图（视觉参考，可选）
                ├─ Step 5  variables    ─→ 变量名 ↔ 值（Enterprise 限定，可选）
                │
                └─ Step 6  设计值 × 当前代码实现 ─→ 差异表

无 $FIGMA_TOKEN 时：Step 2a ego-browser 网页端（截图 + 面板部分值，备选）
```

## Step 1: 解析 URL

从 Figma 链接提取 `file_key` 和 `node_id`：

```
https://www.figma.com/design/{file_key}/{title}?node-id={node_id}&...
```

- `file_key`: URL 路径第三段（如 `UGqo4qAoGMd24IeaNIdNHL`）
- `node_id`: query param `node-id`（如 `2112-9905`，API 传时保持 `-` 分隔）

## Step 2: 确认 Token

Figma Personal Access Token 是首选。获取优先级：

1. **环境变量 `$FIGMA_TOKEN`**（常配置在 `~/.zshenv`，先试直接引用）
2. 拿不到但浏览器已登录 Figma → 走 **Step 2a** ego-browser 网页端通道（零配置快路径，值不完备），同时告知用户可生成 token 换全量精确值
3. 都不行 → 问用户要，并告知生成方式：Figma 网页端 → 头像 → Settings → Personal access tokens → Generate new token（`figd_xxxx` 格式，生成后只显示一次）

curl 调用时直接引用环境变量：`-H "X-Figma-Token: $FIGMA_TOKEN"`。

## Step 2a: 无 Token 备选——ego-browser 网页端通道

无 `$FIGMA_TOKEN` 且浏览器已登录 Figma 时，可用 ego-browser 复用登录态打开设计稿：截图做视觉参考 + 读右栏属性面板 DOM 文本取部分设计值。**完整流程、脚本与能力边界见 `references/ego-browser-channel.md`**。

要点纪律：

- 面板文本是**渲染快照的部分值**（折叠/虚拟化/格式化/版本漂移四层损耗）——够快查，不作对齐基准；拿到 token 后仍以 Step 3 REST 为准
- 截图只做视觉参考，不推精确数值

## Step 3: 取节点 JSON，提取设计值

```bash
curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/{file_key}/nodes?ids={node_id}"
```

返回 JSON 嵌套较深（`nodes.{node_id}.document.children[...]`）。用 python3 提取关键属性：

```bash
curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/{file_key}/nodes?ids={node_id}" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)

def walk(node, depth=0):
    t = node.get('type','')
    name = node.get('name','')
    nid = node.get('id','')
    if t == 'TEXT':
        s = node.get('style', {})
        print(f\"  I{nid} [TEXT] name='{name}' chars='{node.get('characters','')}' \
fontSize={s.get('fontSize')} fontWeight={s.get('fontWeight')} fontFamily={s.get('fontFamily')}\")
    elif t in ('FRAME','RECTANGLE','COMPONENT','INSTANCE'):
        fills = node.get('fills', [])
        bg = fills[0].get('color','') if fills else ''
        cr = node.get('cornerRadius', '')
        pad = {k: node.get(k) for k in ('paddingLeft','paddingRight','paddingTop','paddingBottom') if node.get(k)}
        print(f\"  I{nid} [{t}] name='{name}' bg={bg} cornerRadius={cr} padding={pad or ''}\")
    for c in node.get('children', []):
        walk(c, depth+1)

for nid, v in data.get('nodes', {}).items():
    walk(v.get('document', {}))
"
```

设计值 → CSS 对照：

| 属性 | Figma 字段 | 对应 CSS |
|---|---|---|
| 字号 | `style.fontSize` | `font-size` |
| 字重 | `style.fontWeight` | `font-weight` |
| 字体 | `style.fontFamily` | `font-family` |
| 文案 | `characters` | innerText |
| 背景色 | `fills[0].color` (RGBA 0-1) | `background-color`（乘 255 转 hex） |
| 圆角 | `cornerRadius` | `border-radius` |
| 内边距 | `paddingLeft/Right/Top/Bottom` | `padding` |

颜色转换：Figma 返回 `{r: 0.96, g: 0.96, b: 0.98, a: 1}`，转 hex = `#f5f5fa`。

## Step 4: 渲染节点截图（可选）

需要视觉参考时用 images 端点渲染节点 PNG（比浏览器截图可靠——无需登录态）：

```bash
curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/images/{file_key}?ids={node_id}&format=png&scale=2"
# → {"images":{"2112-9905":"https://s3-..."}}
curl -sL "<返回的 URL>" -o /tmp/figma-node.png
```

- `scale`: 0.01–4；`format`: `jpg` / `png` / `svg` / `pdf`
- 返回 URL **30 天过期**；值为 `null` 表示该节点渲染失败
- 截图只做视觉参考，不用于推断精确数值

## Step 5: 解析设计变量（可选，Enterprise 限定）

需要「变量名 ↔ 值」映射（如 `color/brand/primary` → `#3B82F6`）时：

```bash
curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/{file_key}/variables/local"
```

- **前置**：Enterprise 组织 Full seat，token 需含 `file_variables:read` scope。返回 403 即计划/scope 不满足
- 结构：`meta.variables[id]`（`name` / `resolvedType` / `valuesByMode`）+ `meta.variableCollections[id]`（`name` / `modes`）；mode 的值只看得到 local 端点——`variables/published` 只给轻量清单
- **非 Enterprise 回退**：直接用 Step 3 的 nodes JSON——`fills` 等字段给出的是变量解析后的实际生效值，`boundVariables` 标注了变量绑定关系。能拿到值，拿不到变量名与多 mode 切换

## Step 6: 与代码实现对比输出

拿到设计值后，与当前代码实现逐项对比，输出差异表：

```
元素: 「标题文字」
Figma: 14px, fontWeight 600, #333333
代码: text-md(14px), font-semibold(600), text-secondary
差异: 已对齐 ✅
```

## 不要

- ❌ 用浏览器打开 Figma 页面提取设计值 — 需要登录，且读不到 inspect 面板数据
- ❌ 专为取几个值去装 figma MCP — curl REST 即可；环境已有 figma MCP 时可用它辅助定位，但精确设计值以 REST 原始 JSON 为准（MCP 的 `get_code` 是有损翻译，不作对齐基准）
- ❌ 凭截图推断精确数值（字号 / 颜色 hex） — 截图只做视觉参考，精确值走 API
- ❌ 硬编码 Figma Token — 用 `$FIGMA_TOKEN` 环境变量，不在命令里写明文
- ❌ 忘记颜色转换 — Figma 颜色是 0-1 浮点 RGBA，不是 0-255
- ❌ 非 Enterprise 环境硬调 variables 端点 — 预期 403，直接回退 Step 3 的 nodes JSON
