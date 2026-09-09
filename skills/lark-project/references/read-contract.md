# 读取透传契约（按需加载）

> 触发：arguments 含读取/了解工作项意图（读问题、看缺陷/需求、排查上下文）。透传须带完整读取约束——**不只读默认字段**，三路同步：

1. `workitem get --fields ["_all"]`（附件在 `multi_attachment` 字段，默认字段集不含）与 `comment list` **并行**——两者都只需 project-key + work-item-id，互不依赖。
2. 附件按需下载：从 `multi_attachment` 字段值或评论里的附件引用取 file_url，`attachment +download <file-url>` 落盘（依赖第 1 步返回，串行在后）。

业务上复现步骤常在评论、截图日志常在附件，漏读即误判。
