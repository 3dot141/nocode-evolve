# 证据收集模板

Verify 阶段每一项断言都要落成可贴出的证据。**没有输出 = 没有断言。**

## 单项证据三元组

```markdown
### [验证项名称]

**命令**:
```
$ <实际执行的命令>
```

**输出**（截断到关键部分，保留 error/warning 原文）:
```
<stdout / stderr 原文>
```

**结论**: ✅ 通过 / ❌ 失败
**新鲜度**: 本次改动后于 <时间> 跑出
```

## Verify 证据汇总表

```markdown
## Verify Evidence — <任务名>

| 验证项 | 命令 | 结论 | 证据 |
|---|---|---|---|
| 完整测试套件 | `npm test` | ✅ | 全部 N 项通过, 0 失败 |
| Build | `npm run build` | ✅ | 退出码 0, 无 warning |
| Lint / 类型 | `npm run lint && tsc --noEmit` | ✅ | 0 error |
| 集成测试 | `npm run test:integration` | ✅ | 跨模块 M 项通过 |
| 数据流端到端 | <命令/步骤> | ✅ | 入口→出口数据正确 |
| API 契约 | <命令> | ✅ | schema/状态码符合 |
| E2E | 见 e2e-guide | ✅ | 截图 ./artifacts/*.png |
| 性能 | 见 performance-guide | ✅ | LCP/INP/CLS 达标 |
```

## 验收标准核对表（对接 Define）

```markdown
## Acceptance Criteria Check

来源: Define restate 的 Success Criteria

- [✅] 标准 1: <原文> — 证据: <命令/输出/截图>
- [✅] 标准 2: <原文> — 证据: <...>
- [❌] 标准 3: <原文> — 原因: <为何未通过> → 回 Build
```

## 硬规则

- 输出必须保留 error / warning **原文**，不许概括成"没问题"
- 任一项 ❌ → 整个 Gate 不通过，回 Build / Debug
- 测试 flaky 不算 ✅——隔离、标记、如实记录
- 证据过期（改动后未重跑）等于无证据
