# Framelink 快照导出

本参考只负责把一个 Figma 文件或节点链接导出为可复用的模型友好快照。精确设计值、截图和变量不走本参考；快照完成后由调用方继续使用 Figma REST 原生链路。

## 能力与边界

| 项目 | 契约 |
|---|---|
| 工具 | `figma-developer-mcp fetch` |
| 验证版本 | `0.13.2` |
| Node.js | `>=20.20.0` |
| 输入 | Figma `/design/` 或 `/file/` URL，可带 `node-id` |
| 输出 | YAML / JSON / experimental tree；本 Skill 固定使用 YAML |
| 认证 | `$FIGMA_API_KEY`，兼容从 `$FIGMA_TOKEN` 做进程级映射 |
| 安全性 | 只读 Figma；会在当前项目创建或替换快照文件 |
| 数据性质 | 与 MCP `get_figma_data` 相同的精简管线，不是 REST 原始 JSON |

## Step 1: 确定路径

从调用方取得 `FIGMA_URL`、`file_key` 和 `node_id`：

- `node_slug`：把 `node_id` 中不属于 `[A-Za-z0-9._-]` 的字符换成 `_`
- URL 无 `node-id` 时，`node_slug=file`
- 用户指定输出目录时服从用户路径

默认路径：

```text
snapshot_dir  = $PWD/.figma-context/{file_key}/{node_slug}
snapshot_file = {snapshot_dir}/design.yaml
```

不要自动修改项目 `.gitignore`；是否提交快照由用户决定。

## Step 2: 决定复用或导出

```text
snapshot_file 存在且非空？
     │
     ├─ 是 + 用户未要求刷新 ─→ 返回 reused，不联网
     ├─ 是 + 用户明确要求刷新 ─→ 原子导出，成功后返回 refreshed
     └─ 否 ──────────────────→ 原子导出，成功后返回 created
```

只有用户明确说“刷新、重新抓取、更新快照”等同义意图时才能替换已有快照。同一 `file_key + node_id` 的普通后续问题不构成刷新授权。

## Step 3: 原子导出

不要把 stdout 直接重定向到正式快照。shell 会在 Framelink 启动前截断目标文件，失败刷新会破坏上一份可用数据。

在正式文件同目录创建临时文件，Framelink 成功且产物非空后再 `mv`：

```bash
set -eu

FIGMA_URL='<完整且已加引号的 Figma URL>'
SNAPSHOT_DIR='<解析得到的绝对 snapshot_dir>'
SNAPSHOT_FILE="$SNAPSHOT_DIR/design.yaml"

mkdir -p "$SNAPSHOT_DIR"
TEMP_FILE=$(mktemp "$SNAPSHOT_DIR/.design.XXXXXX")
trap 'rm -f "$TEMP_FILE"' EXIT

FIGMA_API_KEY="${FIGMA_API_KEY:-${FIGMA_TOKEN:-}}" \
  npx --yes figma-developer-mcp@0.13.2 fetch "$FIGMA_URL" \
    --format=yaml --no-telemetry > "$TEMP_FILE"

test -s "$TEMP_FILE"
mv "$TEMP_FILE" "$SNAPSHOT_FILE"
```

URL 必须整体加引号；其中的 `&` 等 shell 字符不能裸露。Token 只通过环境变量进入子进程，不写进 CLI 参数、快照或日志。

## Step 4: 验证与回执

机械验证：

```bash
test -s "$SNAPSHOT_FILE"
rg -n '^(metadata|name|nodes|globalVars|components):' "$SNAPSHOT_FILE"
```

`rg` 只用于快速确认和后续定位；不同文件不一定包含所有顶层键，不能因缺少某个可选键判定失败。

返回：

```text
snapshot_dir: <绝对路径>
snapshot_file: <绝对路径>
status: reused | created | refreshed | failed
```

失败时保留已有正式快照不动，报告 Framelink 的具体错误。调用方可继续 REST 一次性读取，但状态仍为 `failed`。

## Step 5: 后续读取

同一 `file_key + node_id` 的后续请求从 `snapshot_file` 搜索并局部读取，不再次执行 `fetch`：

```bash
rg -n '<节点名|node id|fontSize|fills|padding|borderRadius>' "$SNAPSHOT_FILE"
```

快照用于理解层级、文本、布局和组件关系。任何缺失字段、像素级确认或原始值请求都交回原生 REST 链路。

## Failure modes

| 问题 | 原因 | 处理 |
|---|---|---|
| `fetch` 提示 Node 版本 | 0.13.2 要求 Node.js `>=20.20.0`（docs） | 报告环境差距；不伪造快照 |
| 提示缺少凭证 | Framelink 不读取 `$FIGMA_TOKEN`（observed） | 按 Step 3 映射到子进程 `$FIGMA_API_KEY` |
| URL 在 `&` 处被截断 | URL 没有整体加引号（docs） | 重新以完整引号包裹 URL |
| 刷新失败后快照变空 | `>` 直接指向正式文件（shell behavior） | 同目录临时文件成功后再 `mv` |
| 找不到某个原始字段 | 精简管线省略或转换字段（docs） | 用快照定位，再交回 REST 原生链路 |

## 纪律

- 已有快照且未获刷新授权时，只返回 `reused`
- 不把 REST 响应保存成 `design.yaml` 冒充 Framelink 产物
- 不把 Framelink 快照描述为无损或原始 JSON
- 不用 Framelink 的图片工具；节点截图保留原生 REST `images` 端点
- 不自动修改 `.gitignore` 或提交快照
