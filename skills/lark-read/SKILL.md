---
name: lark-read
description: "完整读取飞书文档（含图片）。当需要读取飞书文档的文字内容和嵌入图片时使用，处理 media scope 配置、图片下载（API 优先 + curl 直链兜底）、嵌入资源识别和路由。不负责文档编辑（走 lark-doc）、知识空间管理（走 lark-wiki）。"
metadata:
  requires:
    bins: ["lark-cli"]
---

# lark-read：完整读取飞书文档（含图片）

读一篇飞书文档，把文字和图片都拿下来，让 agent 能完整理解文档内容。

> **与 lark-doc 的区别**：lark-doc 是底层 API 操作 skill（怎么调 lark-cli docs 命令），lark-read 是上层阅读流程（怎么把一篇文章连图片一起读完整）。lark-read 内部会调用 lark-doc 的能力。

## 前置

<!-- nocode:platform claude -->
开始前调用已安装的 `lark-shared` Skill，传入当前 request、stage、artifacts、constraints 和 decision，确认认证就绪。
<!-- /nocode:platform -->
<!-- nocode:platform codex -->
开始前调用 `$lark-shared`，传入当前 request、stage、artifacts、constraints 和 decision，确认认证就绪。
<!-- /nocode:platform -->
<!-- nocode:platform pi -->
开始前调用 `/skill:lark-shared`，传入当前 request、stage、artifacts、constraints 和 decision，确认认证就绪。
<!-- /nocode:platform -->

`lark-shared` 是外部 Skill，随 lark-cli 技能包安装，不在本插件内；不可用时跳过此步，认证报错时再提示用户安装 lark-cli 技能包。

## 流程

### Step 1: 拉取文字内容

```bash
lark-cli docs +fetch --api-version v2 --doc "<URL>" --doc-format markdown --as user
```

拿到文档的完整文字内容。

### Step 2: 识别嵌入图片

从返回内容中找 `<img>` 标签，提取图片信息（`id`、`name`、`href`）。飞书文档图片 URL 通常形如：

- `internal-api-drive-stream.feishu.cn/space/api/box/stream/download/...`

同时识别嵌入资源块（`<sheet>`、`<bitable>`、`<whiteboard>` 标签），记录 token 备用。

### Step 3: 下载图片

**优先路径 — lark-cli media 能力**：

```bash
# 预览（快速查看，适合多数场景）
lark-cli docs +media-preview --doc "<URL>" --as user

# 下载到本地目录
lark-cli docs +media-download --token "<media_token>" --output ./tmp-media --as user
```

**兜底路径 — curl 直链**：如果 media scope 未授权，图片直链通常带 authcode，可以直接下载：

```bash
curl -sL -o /tmp/image.png "<直链URL>"
file /tmp/image.png  # 确认是图片不是错误页
```

**scope 未授权时的引导**：

遇到 `missing required scope(s): docs:document.media:download` 错误时：

1. 先尝试 curl 直链兜底（文档 fetch 返回的图片 href 通常带 authcode）
2. 直链也失败 → 引导用户授权：

```
需要 docs:document.media:download 权限才能下载文档图片。
请跑：lark-cli auth login --scope "docs:document.media:download"
完成授权后告诉我，我来继续下载。
```

### Step 4: 处理嵌入资源

如果文档中有嵌入的资源块：

| 标签 | 提取字段 | 路由到 |
|---|---|---|
| `<sheet token="..." sheet-id="...">` | token → spreadsheet_token | `lark-sheets` |
| `<bitable token="..." table-id="...">` | token → app_token | `lark-base` |
| `<whiteboard>` | — | `lark-doc` +media-download --type whiteboard |
| `<cite type="doc" file-type="sheets" ...>` | 同 `<sheet>` | `lark-sheets` |
| `<cite type="doc" file-type="bitable" ...>` | 同 `<bitable>` | `lark-base` |

对应 skill 未安装 → 报告哪个 skill 缺失并建议安装，不静默跳过。

### Step 5: 输出

把文字内容 + 图片（已下载到本地可 Read）整合输出。图片用 Read 工具读取本地文件让 agent 看到内容。

## 不要

- 不要跳过图片只读文字——除非用户明确说"不需要图片"
- 不要在 scope 未授权时静默放弃——先试 curl 兜底，不行再引导授权
- 不要用 WebFetch 抓飞书文档——SPA 页面拿不到正文
- 不要把图片 URL 直接贴给用户当结果——要下载下来让 agent 能看到
