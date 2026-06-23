# E2E / Browser 测试指南

适用 6c 步骤——有 UI 变更时。无 UI 变更整步跳过。

## 路径推导

不要凭感觉点。从 Define 的验收标准逐条推导测试路径：

- **Golden path**：用户达成核心目标的主干路径（验收标准的正向场景）
- **边界 case**：空输入 / 超长输入 / 非法输入 / 网络失败 / 并发 / 权限缺失
- 每条验收标准至少对应一条 e2e 断言

## 优先级阶梯

1. **agent-browser**（首选）：`Skill(agent-browser)` 驱动真实浏览器，自动导航 + 截图 + 断言
2. **DevTools 手动检查**：agent-browser 不可用时降级
3. **纯手动**：连 DevTools 都不可用时，手动操作 + 逐步骤记录

## DevTools 面板取证

| 面板 | 验什么 | 取证 |
|---|---|---|
| **Console** | 无 JS error / warning | 截图整个 Console，留时间戳 |
| **Network** | 请求状态码、payload、耗时；无 4xx/5xx | 截图请求列表 + 关键请求详情 |
| **Elements** | DOM 结构、ARIA 属性、无障碍树 | 截图关键节点 |
| **Performance** | 主线程阻塞、长任务、布局抖动 | 录制一次交互，导出 trace |
| **Application** | localStorage / cookie / 缓存状态 | 截图存储面板 |

## 截图取证规范

- **关键步骤** 各截一张：初始态 → 操作中 → 结果态
- 截图带**可识别上下文**：URL 栏、关键文案、时间戳
- 失败 case 必截——红色 error、空状态、报错弹窗都是证据
- 落盘到 `./artifacts/` 或任务目录，文件名含步骤序号
- 录屏用于多步交互流（表单提交、向导、拖拽）

## 无障碍检查清单

- [ ] 键盘可达：Tab 能走遍所有交互元素，焦点可见
- [ ] 对比度：文字/背景对比度达 WCAG AA（≥ 4.5:1 正文）
- [ ] ARIA：交互元素有正确 role / label / state
- [ ] 屏幕阅读器语义：标题层级、表单 label 关联
- [ ] 无纯色彩传达信息（红绿盲可辨）

## Gate

- golden path 全绿 + 边界 case 已覆盖 + 截图落盘 + 无障碍过线 → 6c 通过
- 任一 e2e 失败 → Debug 横切定位，回 Build
