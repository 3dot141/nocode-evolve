# ego-browser 网页端通道（无 Token 备选）

`$FIGMA_TOKEN` 与 `$FIGMA_API_KEY` 都拿不到、但用户浏览器已登录 Figma 时的备选取数通道：ego-browser 的 task space **继承用户登录态**，打开设计稿链接后截图 + 读右栏属性面板 DOM 文本。

## 分流定位

| 通道 | 前置 | 值完备性 | 用途 |
|---|---|---|---|
| Framelink 快照 | `$FIGMA_TOKEN` / `$FIGMA_API_KEY` + Node.js | 精简后的模型友好上下文 | 跨轮复用、定位节点与结构 |
| REST API（精确值主路） | `$FIGMA_TOKEN` / `$FIGMA_API_KEY` | 原生节点响应 | 对齐基准、截图、变量 |
| ego-browser（本通道） | 浏览器登录态 | 渲染快照的部分值 | 快查、视觉确认、引导登录 |
| 官方 Figma MCP | 远程 OAuth 或桌面服务 | 加工后的设计上下文 | 环境已有时可辅助，本 Skill 不依赖 |

## 流程

```bash
ego-browser nodejs <<'EOF'
const task = await useOrCreateTaskSpace('figma design read')

// 1. 打开链接——URL 带 node-id 时 Figma 自动选中该节点，右栏直接显示其属性
await openOrReuseTab(
  'https://www.figma.com/design/{file_key}?node-id={node_id}',
  { wait: true, timeout: 30 }
)
await waitForNetworkIdle()

// 2. 截图：视觉参考（画布是 canvas，这是唯一可靠的画布观察方式）
await captureScreenshot()

// 3. 右栏属性面板是 DOM——提取文本里的设计值
//    保守策略：不绑深层选择器，取全文后按面板文案模式匹配
const text = await js(String.raw`(() => document.body.innerText)()`)
cliLog(text)

// 4. 长属性列表可能虚拟化：滚动面板区逐段收集，滚过即回收
// 5. 收尾：任务完成关闭空间
await completeTaskSpace(task.id, { keep: false })
EOF
```

关键机制：

- **登录态**：task space 继承用户登录态。未登录时 `handOffTaskSpace(task.id)` 引导用户在空间内登录，用户确认后 `takeOverTaskSpace(task.id)` 继续
- **节点定位**：靠 URL `node-id` 参数自动选中，**不做 canvas 内坐标点击**（画布无 DOM 可命中）
- **取值范围**：只有右栏属性面板的 DOM 文本（X/Y/W/H、fill 色值、字号、圆角等）；Dev Mode/Code 面板付费才可见，本通道不依赖

## 为什么面板值不完备（四层损耗）

面板确实「显示」了设计师需要的值，但 agent 从 DOM **提取**时有损耗：

| 层 | 机制 | 例子 |
|---|---|---|
| 显示 ≠ 全量 | 面板是设计师视角摘要，非 API 视角数据 | 多重填充折叠为 `Linear gradient +2`；effects 折叠；变量绑定显示变量名而非值；文本 `characters` 不在属性面板 |
| 虚拟化 | 面板长列表只渲染视口内行，不在视口的行不在 DOM | 复杂节点需滚动逐段收集 |
| 格式化 | 面板显示格式化文本 | 颜色 `#333333`（API 是 0-1 浮点 RGBA）；字号可能四舍五入 |
| 版本漂移 | Figma 前端改版，面板 DOM/文案随之变 | 文本匹配模式会失效；REST API 契约稳定，这是本质差异 |

另有两个**可缓解**的工程问题：

- **交互前置**（属性行 hover/click 才展开进 DOM）：视觉工作流循环「截图定位折叠行（如 `Linear gradient +2`）→ `click([x,y])` 展开 → 再提取」；能解但轮次多，快查场景不划算，要全量走 REST
- **异步加载**（页面 idle ≠ 面板渲染完）：轮询「内容稳定」判定——面板特征文本出现且**连续两次采样 `innerText` 不变**再提取；失败模式是多等一轮而非拿错值

真正结构性不可解的是**格式化**与**版本漂移**——这是本通道不作对齐基准的根因。

**结论**：本通道产出标注「网页面板快照」，够快查与视觉确认；拿到 Token 后先补 Framelink 快照，逐项对齐仍以 REST 原生响应为准。

## 纪律

- 截图只做视觉参考，不推精确数值
- 文本提取用面板文案模式匹配，不绑深层 DOM 选择器（改版即断）
- 结束必收尾 `completeTaskSpace(..., { keep: false })`，不留悬挂空间
- 用户接管（"user is controlling"）是硬停：不要重试，问用户
