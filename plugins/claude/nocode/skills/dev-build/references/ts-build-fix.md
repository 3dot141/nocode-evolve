# TS 构建排错配方

> 提取自 everything-claude-code v1.2.0 build-error-resolver agent (MIT)，TS 构建排错场景特化

**核心原则：最小 diff，只修错误，不重构、不优化、不改架构。** 目标是让 build 变绿，不是让代码变好。

## 诊断命令

```bash
npx tsc --noEmit --pretty                 # 类型检查（不 emit）
npx tsc --noEmit --pretty --incremental false  # 显示全部错误，不止第一个
npx tsc --noEmit path/to/file.ts          # 单文件
npx eslint . --ext .ts,.tsx,.js,.jsx      # ESLint（也会挂 build）
npm run build                             # Next.js 生产构建
rm -rf .next node_modules/.cache && npm run build  # 清缓存重建
```

## 工作流

1. **收集全部错误**——`tsc --noEmit` 捕获所有，不止第一个；按类型归类（推断失败 / 缺类型 / import / 配置 / 依赖）。
2. **逐个最小修复**——读懂错误 → 找最小修法 → 每修一个重新 `tsc` → 确认没引入新错误。
3. **迭代到通过**——一次修一个，重编译，记录进度 X/Y。

## 常见错误与修法

| 错误 | 最小修法 |
|---|---|
| `implicitly has 'any' type` | 加类型标注 `function add(x: number, y: number)` |
| `Object is possibly 'undefined'` | 可选链 `user?.name?.toUpperCase()` |
| `Property 'x' does not exist` | 接口补字段（可选 `age?: number`） |
| `Cannot find module '@/lib/utils'` | 查 tsconfig paths / 改相对 import / 装缺失包 |
| `Type 'string' not assignable to 'number'` | `parseInt(x, 10)` 或改类型 |
| `Type 'T' not assignable` | 加泛型约束 `<T extends { length: number }>` |
| `Hook cannot be called conditionally` | 把 hook 移到组件顶层 |
| `'await' only allowed in async` | 函数加 `async` |
| `Cannot find module 'react'` | `npm i react` + `npm i -D @types/react` |

## 配置类（tsconfig paths）

```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

## 最小 diff 示例

```typescript
// 200 行文件，错误在第 45 行
// ❌ 错：重构整个文件，改 50 行
// ✅ 对：只在第 45 行加类型标注，改 1 行
function processData(data: any[]) {   // 只改这一行
  return data.map(item => item.value)
}
```

**该做**：加类型标注 / 加 null 检查 / 修 import-export / 装依赖 / 改配置。
**别做**：重构无关代码 / 改架构 / 改名 / 加功能 / 改逻辑 / 优化性能 / 改风格。

## 停止条件

需要重构（交给 refactor）/ 需要架构改动（交给 architect）/ 需要新功能（交给 planner）/ 测试失败（交给测试流程）→ 超出本配方范围，停手报告。

## 成功标准

`npx tsc --noEmit` exit 0、`npm run build` 成功、无新错误、改动 < 受影响文件的 5%。
