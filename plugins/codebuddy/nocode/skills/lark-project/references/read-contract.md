# 读取透传契约（按需加载）

> 触发：arguments 含读取/了解工作项意图（读问题、看缺陷/需求、排查上下文、**取视图数据**）。透传须带完整读取约束——**不只读默认字段**，三路同步：

1. `workitem get --fields ["_all"]`（附件在 `multi_attachment` 字段，默认字段集不含）与 `comment list` **并行**——两者都只需 project-key + work-item-id，互不依赖。
2. 附件按需下载：从 `multi_attachment` 字段值或评论里的附件引用取 file_url，`attachment +download <file-url>` 落盘（依赖第 1 步返回，串行在后）。
3. **视图（issueView URL）取数走 MQL 复刻筛选条件，`view get` 只当清单用**（261013 实测）：
   - `view get` 三个局限：`--fields` 不生效（field_key / 中文名都只返回基础字段）；「当前负责人」拿不到（工作流节点负责人不在 role_members）；视图保存的筛选只部分应用（同视图三次查询 118/68/55 条漂移 vs 页面 35 条）。
   - 正确路径：浏览器打开视图 → 点「筛选 · N」读「设置筛选条件」面板 → 条件逐条翻译成 MQL → `workitem query` 复刻**全部**条件。当前负责人 = `array_contains(current_status_operator, '<id:userkey>')`，不是角色查询。
   - MQL 值位坑：multi-select / business 树形叶子的 option_id 必须 `<id:option_id>` 包裹（裸 ID 返回 0 条且不报错）；「全部选项均不属于」未展开时反转成白名单 `IN (...)`（状态全量从 meta-fields 拿到后相减）。
   - 口径自检：查询条数必须与页面「共 N 个」一致后再交付——漏一个筛选条件就会口径漂移（实测漏标签条件 41 条 vs 实际 22 条）。

业务上复现步骤常在评论、截图日志常在附件，漏读即误判；视图取数漏条件即口径错误。
