# Cross-cutting Concerns Checklist

Design Doc 类型**必须**在文档末尾用 checklist 应对以下维度——**即使"不适用"也要明示**理由。

PRD / RFC / ADR 不强制，但鼓励。

## Checklist 模板

复制到 design-doc 文档下半部末尾，逐项回应：

```md
## Cross-cutting Concerns

- [ ] **Security / Privacy**: <内容 or "N/A，理由：xxx">
- [ ] **Monitoring / Observability**: <内容 or "N/A，理由：xxx">
- [ ] **Performance Budget**: <内容 or "N/A，理由：xxx">
- [ ] **Migration / Rollout**: <内容 or "N/A，理由：xxx">
- [ ] **Backwards Compatibility**: <内容 or "N/A，理由：xxx">
- [ ] **Documentation Updates**: <内容 or "N/A，理由：xxx">
```

## 各维度详解

### Security / Privacy

授权检查、敏感数据处理、审计日志、token 处理、SQL injection / XSS / CSRF 防护、第三方依赖的安全性。

涉及用户数据 / 外部接入 / 跨权限边界时**必写实质内容**（不能 N/A 敷衍）。

### Monitoring / Observability

新增指标（QPS / 延迟 / 错误率）、日志关键事件、告警阈值、tracing。

生产服务、用户面功能、批处理任务建议写。

### Performance Budget

QPS、P99 延迟、内存 / CPU / IO 预期、批量任务时长。

高频路径、用户面、限流敏感场景建议写。

### Migration / Rollout

灰度策略、向后兼容性、数据迁移脚本、回滚预案、feature flag。

新功能上线、schema 变更、API breaking 时**必写**。

### Backwards Compatibility

API 兼容、数据 schema 兼容、配置文件兼容、客户端 SDK 兼容。

公开 API 或多消费方的接口变更时**必写**。

### Documentation Updates

需要同步更新的文档（README、ARCHITECTURE.md、运维手册、对外 SDK 文档、CHANGELOG）。

## 反模式

- ❌ **跳过 checklist**：design-doc 不写出来就是没考虑——reviewer 会报 Critical
- ❌ **N/A 不写理由**：「Security: N/A」——为什么 N/A？没说就是敷衍
- ❌ **每条都堆几句套话**：「需要保证安全性」式空话不算回应
- ❌ **只写 happy path**：错误处理 / 失败模式只写"会处理错误"——要列具体场景

## 各 doc-type 的 checklist 强制度

| doc-type | checklist 是否必填 | 理由 |
|---|---|---|
| PRD | 鼓励但不强制 | PRD 主要给产品看，工程视角弱 |
| RFC | 鼓励 | RFC 内已含 Drawbacks，部分 overlap |
| **Design Doc** | **必填** | 这是设计文档的核心责任 |
| ADR | 鼓励 | ADR 内已含 Consequences，部分 overlap |
