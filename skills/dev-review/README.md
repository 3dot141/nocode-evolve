# dev-review

Verify 后的代码标准评审，默认由主会话按正确性、可读性、架构、安全和性能五轴检查当前 diff。DES scope 作为上下文传入，但需求 / 设计符合性已由 Plan、Build、Verify 的 DES coverage 负责，Review 不再创建第二套 Spec 矩阵。

Build 已有质量审查覆盖时，正确性 / 可读性 / 架构只补跨 slice 增量问题；安全和性能始终全量检查。Critical 不可 override，任何修复改代码后必须重新 Build → Verify → Review。
