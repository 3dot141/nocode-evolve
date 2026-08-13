# dev-verify

Build 后的新鲜证据门。Verify 从当前 Handoff / DES scope 出发，运行测试、构建、集成、E2E、性能或失败恢复检查，并生成逐 DES evidence matrix。

失败但不改变设计的 obligation 回 Build；改变设计语义的证据回同一 dev-design Log；没有当前证据的 required DES ID 不得宣称通过。
