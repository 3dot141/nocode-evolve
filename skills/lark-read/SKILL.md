---
name: lark-read
description: 完整读取飞书文档（含图片）。当需要读取飞书文档的文字内容和嵌入图片时使用，处理 media scope 配置、图片下载（API 优先 + curl 直链兜底）、嵌入资源识别和路由。不负责文档编辑（走 lark-doc）、知识空间管理（走 lark-wiki）。
metadata:
  requires:
    bins: ["lark-cli"]
---

# lark-read：完整读取飞书文档（含图片）

读一篇飞书文档，把文字和图片都拿下来，让 agent 能完整理解文档内容。

> **与 lark-doc 的区别**：lark-doc 是底层 API skill，lark-read 是上层阅读流程（文字+图片一起读完整），内部会调用 lark-doc。

## 前置

**CRITICAL — 开始前 MUST 先调 `Skill(lark-shared)` 确认认证就绪。**（外部 skill，随 lark-cli 技能包安装；不可用时跳过，报错时提示用户安装。）

## 流程

### Step 1: 拉取文字内容

```bash
lark-cli docs +fetch --api-version v2 --doc "<URL>" --doc-format markdown --as user
```

拿到文档的完整文字内容。

### Step 2: 识别嵌入图片

从返回内容中找 `<img>` 标签，提取图片信息（`id`、`name`、`href`），同时识别嵌入资源块（`<sheet>`、`<bitable>`、`<whiteboard>` 标签），记录 token 备用。

### Step 3: 下载图片

**优先路径 — lark-cli media 能力**：

```bash
lark-cli docs +media-download --token "<media_token>" --output ./tmp-media --as user
```

**兜底路径 — curl 直链**：如果 media scope 未授权，图片直链通常带 authcode，可以直接下载：

```bash
curl -sL -o /tmp/image.png "<直链URL>"
file /tmp/image.png  # 确认是图片不是错误页
```

遇到 `missing required scope(s): docs:document.media:download` 错误时，若 curl 直链兜底也失败，提示用户跑 `lark-cli auth login --scope "docs:document.media:download"` 完成授权后重试。

### Step 4: 处理嵌入资源

如果文档中有嵌入的资源块：

| 标签 | 提取字段 | 路由到 |
|---|---|---|
| `<sheet>` / `<cite file-type="sheets">` | token → spreadsheet_token | `lark-sheets` |
| `<bitable>` / `<cite file-type="bitable">` | token → app_token | `lark-base` |
| `<whiteboard>` | — | `lark-doc` +media-download --type whiteboard |

对应 skill 未安装 → 报告哪个 skill 缺失并建议安装，不静默跳过。

### Step 5: 输出

把文字内容 + 图片（已下载到本地可 Read）整合输出。图片用 Read 工具读取本地文件让 agent 看到内容。

## 不要

- 不要跳过图片只读文字——除非用户明确说"不需要图片"
- 不要用 WebFetch 抓飞书文档——SPA 页面拿不到正文
- 不要把图片 URL 直接贴给用户当结果——要下载下来让 agent 能看到
