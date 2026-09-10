> 提取自 everything-claude-code v1.2.0 e2e-runner agent (MIT)，Playwright E2E 场景特化

# Playwright E2E 速查

用 Playwright 做端到端测试时参考：测试组织、Page Object 模式、flaky 隔离、artifact 管理。

## 常用命令

```bash
npx playwright test                         # 跑全部
npx playwright test tests/foo.spec.ts       # 跑单文件
npx playwright test --headed                # 带浏览器界面
npx playwright test --debug                 # Inspector 调试
npx playwright codegen http://localhost:3000  # 录制生成测试
npx playwright test --trace on              # 带 trace
npx playwright show-report                  # 看 HTML 报告
npx playwright test --repeat-each=10        # 重复跑（查 flaky）
npx playwright test --project=chromium      # 指定浏览器
```

## 测试组织

```
tests/
├── e2e/
│   ├── auth/login.spec.ts
│   ├── ...
├── fixtures/          # 测试数据和 helper
└── playwright.config.ts
```

## Page Object Model

把选择器和交互封装进 Page 类，测试只调语义方法——UI 变化时只改一处：

```typescript
// pages/ListPage.ts
import { Page, Locator } from '@playwright/test'

export class ListPage {
  readonly page: Page
  readonly searchInput: Locator
  readonly itemCards: Locator

  constructor(page: Page) {
    this.page = page
    this.searchInput = page.locator('[data-testid="search-input"]')
    this.itemCards = page.locator('[data-testid="item-card"]')
  }

  async goto() {
    await this.page.goto('/list')
    await this.page.waitForLoadState('networkidle')
  }

  async search(query: string) {
    await this.searchInput.fill(query)
    await this.page.waitForResponse(r => r.url().includes('/api/search'))
  }

  async itemCount() {
    return await this.itemCards.count()
  }
}
```

## 测试写法（AAA + data-testid）

```typescript
import { test, expect } from '@playwright/test'
import { ListPage } from '../pages/ListPage'

test.describe('Search', () => {
  let listPage: ListPage

  test.beforeEach(async ({ page }) => {
    listPage = new ListPage(page)
    await listPage.goto()
  })

  test('returns results for a keyword', async ({ page }) => {
    await listPage.search('foo')                       // Act
    expect(await listPage.itemCount()).toBeGreaterThan(0)  // Assert
    await expect(listPage.itemCards.first()).toContainText(/foo/i)
  })

  test('handles no results', async ({ page }) => {
    await listPage.search('zzz-nonexistent')
    await expect(page.locator('[data-testid="no-results"]')).toBeVisible()
  })
})
```

要点：优先用 `data-testid` 选择器（比 CSS/XPath 稳）；关键步骤加断言；失败处截图。

## Flaky test 管理

### 识别

```bash
npx playwright test tests/foo.spec.ts --repeat-each=10   # 重复跑看稳不稳
npx playwright test tests/foo.spec.ts --retries=3
```

### 隔离（quarantine）

```typescript
test('flaky case', async ({ page }) => {
  test.fixme(true, 'flaky — Issue #123')   // 标记待修，先移出阻塞
})
```

### 常见 flaky 原因 → 修法

**竞态：** 别假设元素就绪。用 `locator().click()`（内置 auto-wait），不用裸 `page.click()`。

**网络时序：** 别用 `waitForTimeout(5000)`（武断），用 `waitForResponse(r => r.url().includes('/api/...'))`（等具体条件）。

**动画时序：** 点击前先 `waitFor({ state: 'visible' })` + `waitForLoadState('networkidle')`。

## Artifact 管理

```typescript
// 截图
await page.screenshot({ path: 'artifacts/step.png' })
await page.screenshot({ path: 'artifacts/full.png', fullPage: true })
await page.locator('[data-testid="chart"]').screenshot({ path: 'artifacts/chart.png' })
```

config 里配置 trace / video 自动留存（失败时）：

```typescript
// playwright.config.ts
use: {
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  actionTimeout: 10000,
  navigationTimeout: 30000,
},
retries: process.env.CI ? 2 : 0,
```

## 验收指标

E2E 跑完后确认：关键路径 100% 通过；总通过率 > 95%；flaky 率 < 5%；无失败测试阻塞部署；artifact 已上传；HTML 报告已生成。

> 注：上游 e2e-runner agent 默认优先用 Vercel Agent Browser（AI 优化的语义选择器，基于 Playwright），本文只保留通用 Playwright 部分。若项目装了 agent-browser，可用其 snapshot + ref 体系替代脆弱的 CSS 选择器。
