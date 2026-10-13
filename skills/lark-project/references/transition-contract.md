# 流转透传契约（按需加载）

> 触发：arguments 含流转意图（流转状态 / 关闭 bug / 验收 / 状态更新）。透传 meegle 前先按本文件带齐约束，否则下游会撞坑停手。

## 三步法定型再执行（meegle 是基础动作层，模板/流程知识在本层路由）

1. **定型**：`workitem get` 读 `template.name` + `work_item_mod`（节点流 / 状态流）。
2. **定阶段**：节点流 `workflow get-node --node-id-list '["_all"]'` 读节点链与 doing 节点；状态流读当前状态。
3. **按类型说明执行**：命中 [transitions/](../transitions/) 下对应模板文档则严格按其口径流转（节点链 / 必填字段 / 路由字段 / 值域都在文档里）；未收录的模板先向用户确认路径再动。

已收录模板页：

| 模板 | 文档 | 要点 |
|---|---|---|
| b2rl2h「数据需求」（数据需求/产研任务类） | [data-requirement.md](../transitions/data-requirement.md) | 组员开发的「研发处理后评估」是路由字段（值=流转去向）；写入走 `workitem update` 而非 `update-node` |

## 状态流附加约束（transition-state 路径）

1. 状态流转走 meegle 的 `references/sop-transition-state.md` 完整 SOP（fail-fast 流转 → 必填补填 → 重试），**不是裸调 `workflow transition-state` 就完事**。
2. 流转常被 confirm_form 必填字段拦截（如缺陷的「缺陷来源于需求」）；meegle CLI **不支持在 transition-state 上传字段值**（`--params` 传 `fields`/`confirm_form` 均为 unknown_params，实测无效）——正确解法是先 `workitem update` 预填必填字段，再裸 `transition-state`。
3. 关联类必填字段（`workitem_related_multi_select`）值为 stringified 数字数组（如 `"[7071224906]"`）；**关联对象是业务判断**：须用户提供或从该工作项上下文查实（如同分支提交所挂需求），不得 mock。「缺陷来源于 X」类来源字段例外——服务端必填是**四选一**（需求/产研任务/缺陷/子任务，填一个即过校验）。按工作性质定优先序：**bug 修复优先「缺陷来源于缺陷」**（自引用：本单 ID 写入即过）；**feat 优先「缺陷来源于需求」**（MQL 搜同名需求，见下条 MQL 坑）。首选字段匹配不到（注意：**类型不匹配的写入会静默失败**——update 返回空成功但回读 null，如给「来源于需求」填缺陷 ID 被拒收）→ 依序继续试其余三个来源字段 → 四个全落不了值才问用户。**每次写入后必须回读确认生效再流转**（实测教训 PR #2065：「来源于缺陷」自引用过校验、「来源于需求」拒收缺陷 ID 且静默丢弃）。来源字段值格式与候选选择细节见官方 meegle skill 的 `references/sop-transition-state.md`。
4. MQL 查需求关联时：FROM 项目名用中文名+反引号（simple_name 撞歧义空间报 no permission），story 类字段 key 是 `work_item_id` / `work_item_status`（非 `id`/`status`）。

## 收尾动作

- **流转成功后附评论**：arguments 含修复摘要（dev-land 合并后流转传入）时，流转成功后调 meegle `comment add`（剥前缀纯数字 ID）把摘要落成工作项评论；评论失败不回滚流转，如实报告「已流转，评论失败」。
- **工时登记**：arguments 含工时意图（任务号 + 分钟数 + 描述）时按 [worklog/config.md](../worklog/config.md) 执行（动态获取为主：身份值按「动态注入项」现查注入，key 按 SOP 现抓），不走 meegle（其 `workhour` 域仅查询）。
