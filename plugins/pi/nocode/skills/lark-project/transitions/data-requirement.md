# 数据需求模板流转说明（b2rl2h 空间「数据需求」）

> lark-project 流转路由的模板级说明。命中条件：`workitem get` 的 `template.name == "数据需求"`（b2rl2h/一体化产研团队 空间的数据需求与产研任务类工作项）。meegle 只提供基础动作，本文件定义该模板下「先定型、再定阶段、后执行」的完整口径。

## 任务流程（节点链）

```text
数据组员处理 → 数据组长分配 → 组员开发 → ──【研发处理后评估 field_90f734 路由】──→
                                          ├─ 转测试处理 → 测试组员验收（直接进入）
                                          └─ 无需测试   → 跳过测试段
                                          → 创建者验收 → 数据组员验收 → 测试组员验收 → 完成
```

节点状态经 `workflow get-node --node-id-list '["_all"]'` 读取（status: finished/doing/not_started；当前阶段 = doing 节点）。

## 阶段与动作

| 阶段（节点） | 流转动作 | 必填/注意 |
|---|---|---|
| 组员开发（node_key=state_1） | 填「研发处理后评估」→ `workflow transition --action confirm --node-id state_1` | 必填 radio `field_90f734`，**路由字段**（值决定去向）；写入走 `workitem update`（`update-node` 静默不落库，见 meegle sop-transition-node 4.3.1），写入后 `get-node` 回读确认再流转 |
| 创建者验收 / 数据组员验收 / 测试组员验收 | 由对应角色在其节点 confirm（负责人视角操作，一般不由研发 agent 代流转） | 按节点实际必填项处理 |
| 完成 | 终态 | — |

## 研发处理后评估（field_90f734）值域

| 值 | option_id | 流转去向 |
|---|---|---|
| 转测试处理 | `kgm22yogh` | 流转直接进入测试组员验收；创建者/数据组员验收后置（顺序验收） |
| 无需测试 | `wqfzu2wtp` | 跳过测试段 |

选值原则：工作项配了测试验收节点与测试负责人的，默认「转测试处理」，不替测试侧判断「无需测试」；值先与用户确认再流转（值=路径）。

## 实测记录

- 2026-09-07（g-7073131785）：`update-node --fields` 三种形态（option_id / label / stringified 对象）全部返回 success 但回读 null；改 `workitem update --fields '[{"field_key":"field_90f734","field_value":"kgm22yogh"}]'` 一次落值；流转后 doing 节点 = 测试组员验收（路由语义验证）。
- option_id 无 API 配置来源（`meta-node-fields` 只返回系统节点字段）：用 MQL 查存量推值——`SELECT field_90f734 FROM \`一体化产研团队\`.\`产研任务\` WHERE field_90f734 is not null LIMIT 30`。
