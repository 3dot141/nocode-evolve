# 性能评审清单

有不必要的开销吗？评审先看**算法 / IO 量级**，再看微优化。过早优化是噪声，但 N+1 / unbounded 是真问题。

---

## N+1 查询

循环里逐条查 DB / 调 API = N+1。最高频的性能缺陷。

```js
// BAD: N+1
for (const o of orders) o.user = await db.user.findUnique({ where: { id: o.userId } });
// GOOD: 一次 include / batch / DataLoader
const orders = await db.order.findMany({ include: { user: true } });
```

排查信号：`for` / `map` 内有 `await db.` / `await fetch`。

---

## 分页 / unbounded fetch

- 查全表 / 拉全量无 `LIMIT` / 无分页 → 数据量涨了就 OOM / 超时。
- 任何"列表"接口都该有分页（cursor / offset）+ 上限。
- 内存里 `.filter()` 全量数据该下推到 DB `WHERE`。

```sql
-- BAD
SELECT * FROM events;
-- GOOD
SELECT * FROM events WHERE created_at > $1 ORDER BY created_at LIMIT 100;
```

---

## 不必要同步 / 串行

- 本可并行的独立异步操作串行 await → 用 `Promise.all`。
- CPU 密集同步操作阻塞事件循环 → worker / 异步化。

```js
// BAD 串行 → GOOD 并行
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

---

## React 重渲染

- 渲染中新建对象 / 数组 / 内联函数 → 子组件 props 引用每次变 → 白重渲。用 `useMemo` / `useCallback`（仅在确有热路径时）。
- 列表缺稳定 `key`（用 index 当 key 且列表会增删）→ reconcile 出错 + 重渲。
- 把可派生的值存进 state → 额外渲染 + 失同步。改为渲染期直接算。
- 大列表 → 虚拟化（react-window 等）。

---

## Bundle 体积

- 引入重型库只用其中一个函数 → tree-shaking 失效 / 直接 import 子路径（`lodash/debounce` 而非 `lodash`）。
- 大依赖该懒加载（动态 `import()` + code splitting）。
- 评审新依赖时看体积（bundlephobia 量级）。

---

## Profiling 工具（验证再优化，不靠猜）

- **Node**：`node --prof` / `clinic` / `0x`（火焰图）。
- **浏览器**：DevTools Performance / React DevTools Profiler。
- **DB**：`EXPLAIN ANALYZE` 看查询计划 / 缺索引。
- **Python**：`cProfile` / `py-spy`。

原则：**先测后优**。没有 profile 数据支撑的"性能优化"是 Suggestion，不是 Critical。

---

## Core Web Vitals（前端用户感知）

- **LCP**（最大内容绘制）< 2.5s：图片优化 / 关键资源预加载 / 减少阻塞渲染的 JS。
- **INP**（交互到下次绘制）< 200ms：拆长任务 / 减少主线程阻塞。
- **CLS**（累积布局偏移）< 0.1：图片 / 广告位预留尺寸，避免回流跳动。
