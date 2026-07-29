---
name: figma-design-read
description: >-
  用户给 figma.com/design 或 figma.com/file 链接, 要求读取设计稿、提取
  设计值 (字号/颜色/间距/圆角)、对齐 UI 实现、检查样式差异时触发——走
  Figma REST API, 不依赖 MCP/agent-browser 登录。不触发: 只看用户贴的
  设计稿截图 (不需要 API)、Figma 原型预览链接 (无 inspect 需求)。
skip: false
---

# 读取 Figma 设计稿节点属性的标准流程

用户给 Figma 链接要求提取设计值（字号 / 颜色 / 间距 / 圆角等）时，走 Figma REST API，不依赖 Figma MCP server 或 agent-browser 登录。

## 触发

用户给 `figma.com/design/...` 或 `figma.com/file/...` 链接，要求读取设计稿、提取设计值、对齐 UI 实现、检查样式差异。

**不触发**: 只看设计稿截图（用户已贴图，不需要 API）；Figma 原型预览（prototype 链接，无 inspect 需求）。

## 流程

### 1. 解析 URL

从 Figma 链接提取 `file_key` 和 `node_id`：

```
https://www.figma.com/design/{file_key}/{title}?node-id={node_id}&...
```

- `file_key`: URL 路径第三段（如 `UGqo4qAoGMd24IeaNIdNHL`）
- `node_id`: query param `node-id`（如 `2112-9905`，API 传时保持 `-` 分隔）

### 2. 获取 Token

Figma Personal Access Token 是必须的。获取优先级：

1. **环境变量 `$FIGMA_TOKEN`**（已配置在 `~/.zshenv`，直接用）
2. 都没有 → 问用户要，并告知生成方式：Figma 网页端 → 头像 → Settings → Personal access tokens → Generate new token（`figd_xxxx` 格式，生成后只显示一次）

curl 调用时直接引用环境变量：`-H "X-Figma-Token: $FIGMA_TOKEN"`。

### 3. 调用 API 获取节点

```bash
curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/{file_key}/nodes?ids={node_id}"
```

返回 JSON 结构嵌套较深（`nodes.{node_id}.document.children[...]`）。用 python3 或 jq 提取关键属性：

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

### 4. 提取设计值

从输出中提取 UI 实现需要的属性：

| 属性 | Figma 字段 | 对应 CSS |
|---|---|---|
| 字号 | `style.fontSize` | `font-size` |
| 字重 | `style.fontWeight` | `font-weight` |
| 字体 | `style.fontFamily` | `font-family` |
| 文案 | `characters` | innerText |
| 背景色 | `fills[0].color` (RGBA 0-1) | `background-color`（乘 255 转 hex） |
| 圆角 | `cornerRadius` | `border-radius` |
| 内边距 | `paddingLeft/Right/Top/Bottom` | `padding` |

颜色值转换：Figma 返回 `{r: 0.96, g: 0.96, b: 0.98, a: 1}`，转 hex = `#f5f5fa`。

### 5. 对比输出

拿到设计值后，与当前代码实现逐项对比，输出差异表：

```
元素: 「标题文字」
Figma: 14px, fontWeight 600, #333333
代码: text-md(14px), font-semibold(600), text-secondary
差异: 已对齐 ✅
```

### 6. 截图辅助（可选）

如果用户浏览器已登录 Figma，可用 agent-browser 截图作为视觉参考：

```bash
agent-browser open "<figma_url>" && agent-browser screenshot /tmp/figma.png
```

但 Figma 需登录，agent-browser 通常未登录 → 截图会是登录页。**不依赖截图作为唯一信息源**，API 数据才是准确的。

## 不要

- ❌ 用 agent-browser 点击 Figma 页面提取设计值 — 需要登录，且无法读取 inspect 面板数据
- ❌ 装 Figma MCP server 只为提取几个值 — 太重，直接 curl REST API
- ❌ 凭截图推断精确数值（字号 / 颜色 hex） — 截图只做视觉参考，精确值走 API
- ❌ 硬编码 Figma Token — 用 `$FIGMA_TOKEN` 环境变量，不在命令里写明文
- ❌ 忘记颜色转换 — Figma 颜色是 0-1 浮点 RGBA，不是 0-255
