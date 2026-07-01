# TS/JS 测试配方

> 提取自 everything-claude-code v1.2.0 tdd-workflow skill (MIT)，TS/JS 项目场景特化

通用 mock 策略和测试原则见 `{NOCODE_SKILL_REF}/testing-guide.md`。本文只放 TS/JS 栈的可粘贴代码样例。

## 单元测试（Jest / Vitest）

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button Component', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

## API 集成测试

```typescript
import { NextRequest } from 'next/server'
import { GET } from './route'

describe('GET /api/markets', () => {
  it('returns markets successfully', async () => {
    const request = new NextRequest('http://localhost/api/markets')
    const response = await GET(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.data)).toBe(true)
  })

  it('validates query parameters', async () => {
    const request = new NextRequest('http://localhost/api/markets?limit=invalid')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })
})
```

## E2E 测试（Playwright）

```typescript
import { test, expect } from '@playwright/test'

test('user can search and filter', async ({ page }) => {
  await page.goto('/')
  await page.click('a[href="/markets"]')
  await expect(page.locator('h1')).toContainText('Markets')

  await page.fill('input[placeholder="Search markets"]', 'election')
  await page.waitForTimeout(600) // debounce

  const results = page.locator('[data-testid="market-card"]')
  await expect(results).toHaveCount(5, { timeout: 5000 })

  await page.click('button:has-text("Active")')
  await expect(results).toHaveCount(3)
})
```

**选择器原则**：用语义选择器（`button:has-text("Submit")`、`[data-testid="..."]`），别用脆弱的 CSS class（`.css-class-xyz`）。

## Mock 外部服务

外部依赖才 mock（DB / 缓存 / 第三方 API），核心业务逻辑不 mock。

```typescript
// Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({
          data: [{ id: 1, name: 'Test' }], error: null
        }))
      }))
    }))
  }
}))

// Redis
jest.mock('@/lib/redis', () => ({
  searchByVector: jest.fn(() => Promise.resolve([
    { slug: 'test', similarity_score: 0.95 }
  ])),
}))

// OpenAI（embedding 维度对齐）
jest.mock('@/lib/openai', () => ({
  generateEmbedding: jest.fn(() => Promise.resolve(new Array(1536).fill(0.1)))
}))
```

## 覆盖率阈值

```json
{
  "jest": {
    "coverageThresholds": {
      "global": { "branches": 80, "functions": 80, "lines": 80, "statements": 80 }
    }
  }
}
```

```bash
npm run test:coverage   # 验证 80%+
npm test -- --watch     # 开发时 watch
```
