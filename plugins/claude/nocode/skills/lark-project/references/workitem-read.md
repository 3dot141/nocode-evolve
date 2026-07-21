# 读取飞书项目工作项 (含附件) 的标准流程

飞书项目 = Meego (project.feishu.cn), 工作项含需求 / 缺陷 / 任务等. 用户给 `project.feishu.cn/<simple_name>/issue/detail/<id>` 链接要求读取时, 走 `FeishuProjectMcp` 工具, 不用 WebFetch (页面是 SPA, WebFetch 抓不到内容).

## 触发

用户给 `project.feishu.cn` 链接 (或 Meego 工作项 id) 要求读取 / 总结 / 看附件 / 分析需求或缺陷内容时. URL 形如 `https://project.feishu.cn/b2rl2h/issue/detail/7018798150`, 路径段 `b2rl2h` 是 simple_name, `7018798150` 是 work_item_id.

**不触发**: 飞书云文档 (docx / wiki, feishu.cn/docx 或 /wiki) — 那走 lark-doc / lark-wiki skill, 不是飞书项目 MCP.

## 流程

### 1. 加载 MCP 工具

`FeishuProjectMcp__*` 是 deferred 工具, 先 `ToolSearch` 按名加载常用几个:

```
select:mcp__FeishuProjectMcp__get_workitem_brief,mcp__FeishuProjectMcp__get_download_url,mcp__FeishuProjectMcp__list_workitem_comments
```

### 2. 读工作项完整字段

`get_workitem_brief` 传 `url` (自动解析出 project_key / work_item_id) + `fields:["_all"]` 一次拿全部字段:

- `work_item_attribute`: 类型 / 状态 / 角色成员 (报告人 / 开发者 / 测试者等) / 时间
- `work_item_fields`: 含 `description` (缺陷描述, **Markdown 富文本**) / `multi_attachment` (附件列表) / 各 `field_xxx` 自定义字段

只要基础字段时不传 `fields`; 要 description 富文本 + 附件就必须 `["_all"]`.

### 3. project_key 多匹配处理

simple_name (如 `b2rl2h`) 可能撞多个空间, 工具报 `multiple matches` 并列出候选. **改用返回里的真实 project_key** (24 位 hex, 如 `67d7ba04296cba3d3ece0694`) 重试 — 不要再传 simple_name. 真实 key 也可从 step 2 返回的 `owned_project.key` 拿.

### 4. 评论要另调

评论不在 `_all` 里, 单独调 `list_workitem_comments(project_key, work_item_id)`. 返回 `total:0` 即无评论.

### 5. 下载附件查看

`multi_attachment` 里每个附件有 `url` / `fileToken`. 下载两步:

1. `get_download_url(project_key, work_item_id, file_url)` → 拿 `download_url` + `sign`
2. `curl -s -H "X-Meego-File-Sign: <sign>" "<download_url>" -o /tmp/xxx.png` 下载, 再 `Read` 图片

sign 是必须的 header, 漏了下载得到的是错误响应不是图片. 多附件可并行 get_download_url, 再用一条 `curl && curl && ...` 串行下载. `is_multipart:true` 才需分片 (附件大时), 一般 false 直接下.

## 不要

- ❌ 用 WebFetch 抓 project.feishu.cn 链接 — SPA 拿不到正文
- ❌ simple_name 撞多空间时反复传 simple_name — 改传真实 project_key
- ❌ 下载附件漏 `X-Meego-File-Sign` header — 得不到图片
- ❌ 只读基础字段就下结论 — 要 description / 附件才完整, 传 `["_all"]`
- ❌ 把飞书云文档 (docx / wiki) 当飞书项目工作项 — 路由到 lark-doc / lark-wiki
