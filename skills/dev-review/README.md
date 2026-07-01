# dev-review

devflow 第 7 阶段——五轴代码评审 + 异源交叉，产出分级 findings，Critical 不可 override。

## 在 devflow 中的位置

```
... Verify → dev-review → Land ...
              ↑ 你在这里
```

## 设计决策：Review 只查 Standards 轴，不再查 Spec 轴

`260701` 的 devflow 多层 review 收敛审查中调整。

**原来的设计**：dev-review 隐含两个正交维度——Standards 轴（代码标准合规，五轴 review 覆盖）+ Spec 轴（实现是否对齐需求/PRD/restate，由 Step 6 Path Coverage Check 覆盖，拿 PRD 原始路径清单逐条比对代码）。

**为什么删 Spec 轴（删 Step 6）**：
1. **和 dev-verify Step 7（反向审计）近乎同构重复**——两者都在拿 PRD 原始路径清单回扫代码/测试覆盖，产出几乎一样的覆盖率报告。devflow 阶段顺序是 `Build → Verify → Review`，Verify 排在前面，Review 再查一遍是纯重复劳动（dev-verify Step 7 已删，见其 README）。
2. **"哪个阶段有问题，在哪个阶段解决"**——需求对齐这件事，Design 阶段（3d 方案←→目标对齐）和 Plan 阶段（Step 8b 需求覆盖 + Step 8c 路径覆盖）已经各自查过一次；Build 的 per-task Spec Review 还会针对具体 task 再核一次（Missing requirements / Design alignment）。Review 阶段再兜底查一遍 Spec 轴，是这条对齐检查链条上的第四次重复。

**现在怎么办**：dev-review 收窄为纯 Standards 轴评审——五轴（正确性/可读性/架构/安全/性能）+ Simplification + Codex 异源交叉。需求是否遗漏/是否对齐这类问题，不再是 dev-review 的职责范围。

**代价（显式承认）**：如果 Design/Plan/Build 三处的对齐检查都失手放过同一个遗漏，devflow 里不再有任何一处会在 Review 阶段兜底拦截——这是相比"删除前"更薄的一层防御。见 `dev-verify/README.md` 里关于这条代价链更完整的说明。

## 设计决策：Quality Review（Build）与 Five-Axis（Review）分工，不重复扫描

**原来的设计**：Build per-task Quality Review（Structure/Quality/Testing/Conventions）和 Review 阶段 Five-Axis（正确性/可读性/架构/安全/性能）字面定义高度重叠，两次都是"读代码挑结构/风格问题"，同源双审，边际检出率低。

**现在怎么办**：Five-Axis 进入前先读 Build 各 task 的 Quality Review verdict——可读性/架构/正确性这三轴只找"合并后才出现"的增量问题（跨 task 才暴露的循环依赖/重复抽象），已经被 per-task 挑过的同类问题不重复记 finding。安全轴、性能轴维持全量强制检查——这两个维度 Build 的 Quality Review 完全没有，是净增量。

## 上游生产者

- `dev-verify` — 曾经的 Step 7 反向审计报告（已删除，见 `dev-verify/README.md`）
- `dev-build` — per-task Quality Review verdict，供 Five-Axis 读取避免重复扫描
