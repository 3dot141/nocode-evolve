# 性能度量指南

适用 6d 步骤——Define 验收标准含性能要求时。无性能需求整步跳过。

## Core Web Vitals 阈值

| 指标 | 含义 | 达标阈值 | 需改进 | 差 |
|---|---|---|---|---|
| **LCP** | 最大内容绘制（加载速度） | ≤ 2.5s | 2.5–4.0s | > 4.0s |
| **INP** | 交互到下一次绘制（响应性） | ≤ 200ms | 200–500ms | > 500ms |
| **CLS** | 累积布局偏移（视觉稳定） | ≤ 0.1 | 0.1–0.25 | > 0.25 |

> 取 **p75**（第 75 百分位）作为代表值，不是均值——均值会被掩盖长尾。
> INP 已取代旧的 FID，度量整个交互生命周期。

## 工具阶梯

| 场景 | 工具 | 取证 |
|---|---|---|
| Web 页面整体 | Lighthouse（CI 或 DevTools 面板） | 导出 HTML/JSON 报告，记三项 CWV |
| 真实交互延迟 | DevTools Performance 面板录制 | 导出 trace，标注长任务 |
| 后端 / 函数热点 | profiler（node --prof / py-spy / pprof） | 火焰图，标注 top 帧 |
| 吞吐 / 延迟基线 | benchmark（k6 / wrk / autocannon / pytest-bench） | p50/p95/p99 + 对比基线 |
| 内存 | heap snapshot / massif | 快照对比，标注增长点 |

## 度量纪律

- **先定基线**：改动前的数值，否则"快了"无从谈起
- **同环境对比**：同机器、同网络节流档（Lighthouse 用 Slow 4G + 4x CPU 节流）
- **多次取样**：单次跑有噪声，跑 ≥ 3 次取 p75
- **回归即失败**：任一指标比基线劣化超阈值 → 当作未通过，回 Build

## 报告模板

```markdown
## Performance Evidence

环境: <机器/网络节流档>
工具: Lighthouse <版本>

| 指标 | 基线 | 本次 | 阈值 | 结论 |
|---|---|---|---|---|
| LCP | 2.1s | 2.3s | ≤ 2.5s | ✅ |
| INP | 150ms | 180ms | ≤ 200ms | ✅ |
| CLS | 0.05 | 0.06 | ≤ 0.1 | ✅ |

报告产物: ./artifacts/lighthouse.html
```

## Gate

三项 CWV（或 Define 指定的性能指标）全部达标 + 无回归 → 6d 通过。任一项超阈值 → 回 Build 优化。
