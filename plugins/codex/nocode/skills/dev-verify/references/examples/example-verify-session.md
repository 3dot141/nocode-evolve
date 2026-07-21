# Example: 一次完整的 Verify 过程

场景：Build 完成了「商品搜索接口」，restate 里有 3 条验收标准（SC1 响应 < 200ms p95、SC2 无 lint warning、SC3 支持中文搜索）。下面是走完 6a → 6b → 6e 的真实记录。

---

## 6a. 证据收集（命令 + 输出 + 通过/失败）

跑完整测试套件，不只本次 slice 的单测：

```
$ npm test
Test Suites: 14 passed, 14 total
Tests:       127 passed, 127 total
Time:        8.3s
→ ✅ 全套件通过
```

Build 干净（无 error/warning）：

```
$ npm run build
✓ built in 4.1s
→ ✅ build 通过，输出无 warning
```

## 6b. 集成测试（跨模块契约 + 数据流）

单测全绿不代表接口真能用，跑端到端集成：

```
$ npm run test:integration -- search
POST /api/search {"q":"laptop"} → 200, 12 results, schema ✓
POST /api/search {"q":""}       → 400, {"error":"query required"} ✓
→ ✅ 契约 + 错误路径都对
```

## 6e. 验收逐条核对

从 restate 的 3 条 SC 逐条核对，每条带证据：

```
验收核对:
- [x] SC1: "搜索响应 < 200ms (p95)" → ✅ p95=142ms
      [命令: npm run bench:search → p50=88ms p95=142ms]
- [x] SC2: "无 lint warning" → ✅ 0 warnings
      [命令: npm run lint → 0 problems]
- [ ] SC3: "支持中文搜索" → ❌ 中文查询返回空
      [命令: curl '/api/search?q=笔记本' → {"results":[]}
       输出: 期望命中"笔记本电脑"，实际 0 结果]
```

## 结论：SC3 ❌ → 回 Build

3 条里 2 条过，SC3 失败。**任一条 ❌ 即不通过 Verify**——不是"大部分过了就算"。

回 Build 修复方向（已定位）：搜索分词器没装中文 analyzer，英文 tokenizer 把"笔记本电脑"当一个 token，匹配不上。修完回 Build → 重新 Verify（SC1/SC2 也要重跑，因为改了分词逻辑可能影响性能）。

> 反面教材：如果这里写"基本都通过了，SC3 是小问题先 Review"——这就是 Iron Law 要挡的 dishonesty。证据说 ❌ 就是 ❌。
