# 横切设计（所有场景共用）

> feat / bug / refactor 模板都必须 Read 本文件。它定义如何把 Decision Packet 的 `crossCutting` placement 契约写进同一设计文档。

## 输入契约

```yaml
crossCutting:
  items:
    - id: string
      concern: string
      decisionRefs: []
      providerOrOwner: string
      layerResponsibilities: []
      enforcementPoints: []
      dataOwners: []
      registryInputs: []
  exemption:
    reason: string
    evidence: []
```

- `items` 非空时 `exemption` 必须缺席。
- `items` 为空时 `exemption` 必填，且 reason / evidence 不能是空占位。
- `domainDecisions` 是结论权威；本章只说明 placement。每个 item 用 `decisionRefs` 指向权威决策，不复制结论。
- 每个声明为横切的 domain decision 必须被 item 反向引用，形成双向映射。

## 非空 items 的写法

### 1. 总览矩阵

先写一张纵向走查矩阵：

| 关注点 / item | decisionRefs | providerOrOwner | 各层职责 | enforcementPoints | dataOwners | Registry IDs |
|---|---|---|---|---|---|---|

要求：

- `providerOrOwner` 写明谁提供共用能力或谁对策略负责；不能只写“公共模块”。
- `layerResponsibilities` 覆盖实际存在的入口、领域、数据、异步、外部集成等层。无职责的层写“无责 + 理由”，不能留空。
- `enforcementPoints` 是真正执行规则的位置，不要把“所有层都注意”当答案。
- `dataOwners` 写清审计记录、幂等键、权限策略或错误字典等数据归谁。
- Registry IDs 来自 item 的 `registryInputs`，并回链稳定 `sourceAnchor`。

### 2. 逐关注点走查

每个 item 至少写：

1. 覆盖哪些 Q / BF / API / DATA 路径
2. 每层具体责任与无责理由
3. provider / consumer 的调用或依赖方向
4. enforcement point 与失败语义
5. data owner 与一致性要求
6. Registry ID、TO 和未决风险

如果详细设计发现 placement 落不下去，先判断：

- 只是内部模块或 contract 细化：Writing 本地修正。
- 选定 approach、核心业务能力 / 数据所有权、已承诺外部契约或硬约束失效：才返回 replan。

## 空 items 的豁免写法

仍保留「横切设计」小节，写明：

- 无适用横切关注点
- `exemption.reason`
- `exemption.evidence`
- reviewer 可复核的范围边界

“改动小”“暂不考虑”或空数组不是有效豁免。

## Review Gate

- [ ] items / exemption 互斥且有内容
- [ ] decisionRefs 全部存在，且权威决策与 placement 双向一致
- [ ] providerOrOwner、layerResponsibilities、enforcementPoints、dataOwners 齐全
- [ ] provider 与所有 consumer 路径都已走查
- [ ] 无未解释的空层
- [ ] Registry ↔ sourceAnchor 双向无 orphan
