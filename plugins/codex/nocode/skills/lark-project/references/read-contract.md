# 读取透传契约（按需加载）

> 触发：arguments 含读取/了解工作项意图（读问题、看缺陷/需求、排查上下文、**取视图数据**）。透传须带完整读取约束——**不只读默认字段**，三路同步：

1. `workitem get --fields ["_all"]`（附件在 `multi_attachment` 字段，默认字段集不含）与 `comment list` **并行**——两者都只需 project-key + work-item-id，互不依赖。
2. 附件按需下载：从 `multi_attachment` 字段值或评论里的附件引用取 file_url，`attachment +download <file-url>` 落盘（依赖第 1 步返回，串行在后）。
3. **视图（issueView / multiProjectView URL）取数走 MQL 复刻筛选条件，`view get` 只当清单用**（261013 实测，261016 强化）：
   - **路径纪律：MQL 是唯一路径，view get 不可用时唯一正确方向仍是 MQL 复刻**。multiProjectView 连清单都拿不到（`view get` 直接报 `ErrNotSupportMultiProjectView`）；此时浏览器滚动收集 ID、Network 抓包（`mget_ui` 返回的是视图结构元数据不是数据）都是死路，不要试。
   - **浏览器只做三件事**：确认 quickFilter 激活态、抓页面 `issue/detail/{id}` 锚点 ID 集合、读「共 N 个」；随后全部转 MQL。
   - `view get` 三个局限：`--fields` 不生效（field_key / 中文名都只返回基础字段）；「当前负责人」拿不到（工作流节点负责人不在 role_members）；视图保存的筛选只部分应用（同视图三次查询 118/68/55 条漂移 vs 页面 35 条）。
   - 正确路径：浏览器打开视图 → 点「筛选 · N」读「设置筛选条件」面板 → 条件逐条翻译成 MQL → `workitem query` 复刻**全部**条件。当前负责人 = `array_contains(current_status_operator, '<id:userkey>')`，不是角色查询。
   - MQL 值位坑：multi-select / business 树形叶子的 option_id 必须 `<id:option_id>` 包裹（裸 ID 返回 0 条且不报错）；「全部选项均不属于」未展开时反转成白名单 `IN (...)`（状态全量从 meta-fields 拿到后相减）。
   - **筛选面板折叠值不展开**（261016）：「+2/+3」折叠 tag 用 DOM click / 鼠标坐标都打不开（Semi Design 组件）；也不需要展开——meta-types / meta-fields 拿全集，结合面板已见值近似补全，先跑 MQL 再按口径收敛。「工作项类型」筛选在多项目视图是**跨空间聚合的模板名**（一般BUG/迭代BUG），单空间 `template` 字段可能只有部分选项——不硬翻译模板 IN，用名称/状态等已确认条件近似即可收敛。
   - **空间定位坑**（261016）：URL simple_name 可能多义，直接传报 `ProjectMultipleMatches`；从报错 JSON 的候选里选 simple_name 精确匹配的那个 project_key（另一个是同名空间）。
   - **口径自检升级为锚点交集**（261016）：页面「共 N 个」本身可能有误（实测被用户指出），不要只对计数；把页面锚点 ID 集合与 MQL 结果求交集验证（实测 29/29 命中即闭环），交集不满再补条件收敛。
   - **返回结构坑**（261016）：总数在顶层 `list[0].count`、`session_id` 在顶层；翻页只传 `--session-id` + `--group-pagination-list`，不重传 mql；行字段在 `moql_field_list[].value`，`value_type` 有 long_value / string_value / key_label_value / cascade_key_label_value / user_value_list 多种且 `value` 可为 null——解析时逐类型判空。

业务上复现步骤常在评论、截图日志常在附件，漏读即误判；视图取数漏条件即口径错误。
