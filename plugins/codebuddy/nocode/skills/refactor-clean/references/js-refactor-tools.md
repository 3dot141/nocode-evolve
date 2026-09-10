> 提取自 everything-claude-code v1.2.0 refactor-cleaner agent (MIT)，JS/TS 项目场景特化

# JS/TS 清理工具链

## 检测工具

### knip — 最全面的死代码检测

找未使用的文件、export、依赖、类型。一个工具覆盖大部分检测需求。

```bash
npx knip
```

knip 理解 TypeScript 的 import/export 关系，比 grep 准确。但它不知道动态 `import()` 和框架约定文件（Next.js 的 `page.tsx`、`layout.tsx` 等），这些要在 Step 3 审查时注意。

### depcheck — 未使用依赖检测

```bash
npx depcheck
```

专找 package.json 里装了但没 import 的包。比 knip 的依赖检测更细（会看 config 文件里的引用）。

### ts-prune — 未使用 TypeScript export

```bash
npx ts-prune
```

只查 export 级别的未使用，比 knip 窄但更专注。适合快速扫一眼哪些 export 可以砍。

### eslint — 未使用变量和 disable 指令

```bash
npx eslint . --report-unused-disable-directives
```

找残留的 `// eslint-disable` 注释——对应的规则可能已经不触发了，注释变成了垃圾。

## 推荐执行顺序

```bash
# 1. 先跑 knip 拿全景
npx knip

# 2. depcheck 补充依赖维度
npx depcheck

# 3. eslint 扫残留注释
npx eslint . --report-unused-disable-directives
```

ts-prune 和 knip 有重叠，通常 knip 够了。knip 漏的再用 ts-prune 补。

## 常见可安全删除的

| 类型 | 示例 | 判断依据 |
|---|---|---|
| 未使用 import | `import { useMemo } from 'react'` 但组件没用 useMemo | IDE/lint 就能看到 |
| 死分支 | `if (false) { ... }` | 永远不执行 |
| 注释掉的代码 | `// const oldHandler = ...` 整块注释 | git history 里有，不需要注释保留 |
| 未使用依赖 | `lodash` 在 package.json 但没 import | depcheck 报告 |
| 被替代的依赖 | `moment` 已被 `date-fns` 替代 | grep 确认无 import |

## 风险点

- **Next.js/Remix 约定文件**：`page.tsx`、`layout.tsx`、`middleware.ts`、`route.ts` 等是框架约定，没有显式 import 但在用。knip 可配 `next` plugin 识别
- **Barrel files**（`index.ts` re-export）：`export * from './foo'` 可能让 knip 以为 foo 的 export 在用，实际没人 import barrel
- **`__tests__` 里的 import**：测试文件 import 了不代表生产代码在用，两个维度分别看
- **CSS Modules**：`.module.css` 里的 className 通过字符串引用，静态分析可能漏判
