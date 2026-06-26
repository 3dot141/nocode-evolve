# Step 1 展开：竞品与产品探索

## 方向 A: 竞品探索

### 三块并行获取

对每个竞品的每个关键功能，三块并行：

| 块 | 获取什么 | 方法 |
|---|---|---|
| **文字说明** | 产品功能描述、交互模式、设计理念 | WebSearch / Exa 搜产品 blog / changelog / 设计文章 |
| **HTML** | 页面真实 HTML 结构（组件/布局/CSS 类名） | Playwright `page.content()` 或 agent-browser |
| **截图** | 页面视觉截图（布局/配色/间距/层级） | Playwright `screenshot --full-page` 或 agent-browser |

### 降级链

按可用性依次尝试：

1. Playwright 可用 → HTML + 截图同时拿
2. Playwright 不可用 → agent-browser skill
3. 竞品需要登录/付费墙 → 搜索公开截图（Product Hunt / 官方 blog / review 站配图）
4. 都拿不到 → 列出产品名 + 具体功能场景，请用户提供截图

### Playwright 用法

```bash
npx playwright install chromium
npx playwright screenshot <url> --full-page -o <output.png>
```

无头模式，不需要 GUI。

### 竞品参考表格式

| 竞品 | 关键页/功能 | 文字说明 | HTML 要点 | 截图 | 值得借鉴的 | 不想要的 |
|---|---|---|---|---|---|---|

## 方向 B: 产品现状

### 改造已有产品

用 agent-browser 或 Playwright 截取当前产品的相关页面，记录现状。

### 全新产品

扫描代码库的 UI 组件/设计系统（有的话），确认可复用的视觉资产。

### 现状清单格式

- 已有什么（页面/组件/设计系统）
- 要新建什么
- 要改什么
