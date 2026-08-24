# figma-read

读取 Figma 设计稿节点属性：提取精确设计值（字号/颜色/间距/圆角）、渲染节点截图、解析设计变量，供 UI 对齐与样式差异检查。

## 溯源

- 前身是 plugin rule `rules/rule-figma-design-read.md`（SessionStart catalog 路由触发），2026-08 改造为 skill 形态：触发从常驻 catalog 行变为 skill description 按需加载，正文得以承载更完整的端点细节
- 改造时经红蓝对抗评审（结论：REST 原始 JSON 无损、裸环境可跑，优于依赖桌面 App 常开 + 付费计划的 Dev Mode MCP），评审 findings 已融入：
  - **F1**：补 `/v1/images`（节点 PNG 渲染）与 `/v1/files/{key}/variables/local`（变量解析）两个端点，堵住「MCP 有 get_screenshot/get_variable 而本 skill 无对应」的能力差。注意 variables 端点为 Enterprise 限定，skill 内含非 Enterprise 回退路径
  - **F2**：澄清与 figma MCP 的关系（背景说明，不进 SKILL.md 正文）——本 skill 不依赖 figma MCP：官方 Dev Mode MCP 需 Figma 桌面 App 常开 + 付费计划，多平台环境无法保证该前置；环境已装时不禁用，可用它辅助定位（如快速查 node 元数据）；但取精确设计值以 REST 原始 JSON 为准，`get_code` 有损翻译不作对齐基准。SKILL.md 仅在「不要」清单保留一条自包含的执行纪律
