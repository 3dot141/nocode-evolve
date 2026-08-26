# figma-read

读取 Figma 设计稿节点：用 Framelink 生成可复用的模型友好快照，用 Figma REST API 提取精确值、渲染截图和解析变量，供 UI 对齐与样式差异检查。

## 当前架构

```text
Framelink fetch → design.yaml → 层级/文本/布局定位与跨轮复用
Figma REST API  → 原始响应  → 精确字段、截图、变量与最终对齐基准
ego-browser     → 页面快照  → 无 Token 时的有限备选
```

职责边界：

- Framelink 只承担快照导出，不取代原生 REST；其 `fetch` 使用与 `get_figma_data` 相同的精简管线，适合落盘后按需读取
- Framelink 的可执行契约集中在 `references/framelink.md`；主 `SKILL.md` 只保留功能、总工作流和调用入口
- REST 原生响应保持精确值基准；截图仍走 `/v1/images`，变量仍走 `/v1/files/{key}/variables/local`
- 官方 Figma MCP 现在同时提供远程和桌面服务，能力比早期版本更完整；本 Skill 不依赖它，是为了让五个平台只凭 shell + Token 也能运行，而不是因为官方 MCP 必须桌面 App 常开

## 溯源

- 前身是 plugin rule `rules/rule-figma-design-read.md`，2026-08 改造为 skill 形态
- 初版以 REST 原始 JSON 为唯一主路，随后增加 ego-browser 无 Token 备选
- 2026-08 引入 Framelink `fetch` 作为快照层：确定性路径、已有快照复用、显式刷新、同目录临时文件 + 原子替换；精确值与图像/变量端点保持原生
- Framelink 上游：<https://github.com/GLips/Figma-Context-MCP>
- `fetch` 契约：<https://www.framelink.ai/docs/fetch>
