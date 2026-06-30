# architecture-method — 架构评审方法 card

> reviewing 框架的方法库 card。被 `skeleton.md` 方法选择表「架构决策」行选中,或 architect / dev-review 架构轴派发时 Read。
> 领域清单(架构原则 / 模式 / Trade-Off / Red Flags / System Design Checklist)**单源在此**,从原 `agents/architect.md` 抽取。

## 一、评审维度(domainAxes,注入 skeleton 第 3 步)

**架构原则五维**:
1. **模块化与关注点分离**:单一职责、高内聚低耦合、清晰接口、独立可部署
2. **可扩展性**:水平扩展能力、无状态设计、高效查询、缓存策略、负载均衡
3. **可维护性**:清晰组织、一致模式、文档、易测、易理解
4. **安全**:纵深防御、最小权限、边界输入校验、默认安全、审计轨迹
5. **性能**:高效算法、最小网络请求、查询优化、合适缓存、懒加载

**常见模式参考**(判断是否合理套用,非强制):
- 前端:组件组合 / 容器-展示 / 自定义 hook / Context 全局态 / 代码分割
- 后端:Repository / Service 层 / 中间件 / 事件驱动 / CQRS
- 数据:规范化 / 读优化反规范化 / 事件溯源 / 缓存层 / 最终一致

**Trade-Off 分析**(每个架构决策必做):Pros / Cons / Alternatives / Decision + rationale

**System Design Checklist**:功能需求(用户故事 / API 契约 / 数据模型 / UI 流)· 非功能(性能目标 / 扩展性 / 安全 / 可用性 %)· 技术设计(架构图 / 组件职责 / 数据流 / 集成点 / 错误处理 / 测试策略)· 运维(部署 / 监控告警 / 备份恢复 / 回滚)

## 二、Red Flags(架构反模式,命中即 finding)

- **Big Ball of Mud**:无清晰结构
- **Golden Hammer**:一种方案解决所有
- **Premature Optimization**:过早优化
- **Not Invented Here**:拒绝现成方案
- **Analysis Paralysis**:过度规划、低交付
- **Magic**:不清晰、未文档化的行为
- **Tight Coupling**:组件过度依赖
- **God Object**:单一组件 / 类做所有事

## 三、输出契约

套 `findings-contract.md`:
- `axis` = 上述架构维度名(模块化 / 可扩展性 / 可维护性 / 安全 / 性能)或 Red Flag 名
- 架构 finding 多为设计层判断:结构性问题(命中 location 时)用 `[文件/模块锚点]`;纯设计权衡类不强制 file:line(非代码事实声明),但要有可追溯理由
- `severity`:Tight Coupling / God Object / Big Ball of Mud 等结构性问题倾向 Critical/Warning;风格建议 Suggestion
- `fix` 的 Structural Remedy 形态 = **ADR**(重大架构决策):`# ADR-NNN: 标题` + Context / Decision / Consequences(Positive/Negative)/ Alternatives Considered / Status / Date

## 四、派发策略

| 对象 | 档位 | 方法 | 独立性 |
|---|---|---|---|
| 架构决策(评审已有设计) | 重档 | architecture-method(本卡)+ red-blue-adversarial 异源交叉 | 异源 |
| 架构选型 / 多方案僵持 | 重档 | red-blue-adversarial 主导(对抗思辨),本卡提供维度 | 异源 |
| 轻量架构问题(单模块边界) | 轻档 | checklist 自评 | 无 |

> 架构评审默认重档 + 异源(codex / 独立 subagent,CLAIM 剥离)。codex 不可用降级单 subagent 并标「同模型(降级)」。
