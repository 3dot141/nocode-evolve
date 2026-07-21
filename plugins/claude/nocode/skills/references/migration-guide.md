# 迁移与废弃指南

共享 reference，多 skill 按需 Read。

代码是负债，不是资产。每一行代码都有持续的维护成本——要修的 bug、要更新的依赖、要打的安全补丁、要让新工程师上手理解。废弃（deprecation）是移除不再值得保留的代码的纪律，迁移（migration）是把用户安全地从旧实现搬到新实现的过程。

大多数工程组织擅长造东西，很少有组织擅长拆东西。本指南针对的就是这个空缺。

## Core Principles

### Code Is a Liability（代码是负债）

每一行代码都有持续成本：它需要测试、文档、安全补丁、依赖更新，以及任何在它附近工作的人的心智负担。代码的价值在于它提供的功能，而不是代码本身。当同样的功能可以用更少的代码、更低的复杂度、更好的抽象来提供时——旧代码就应该消失。

### Hyrum's Law Makes Removal Hard（海勒姆定律让移除变难）

只要用户足够多，每一个可观测的行为都会被依赖——包括 bug、时序怪癖、未文档化的副作用。这就是为什么废弃需要主动迁移，而不只是发个公告。当用户依赖的行为是替代品没有复刻的，他们就无法"直接切换"。

### Deprecation Planning Starts at Design Time（废弃规划从设计阶段就开始）

在造新东西时就要问："3 年后我们要怎么移除它？"用干净接口、feature flag、最小表面积设计的系统，比那些把实现细节到处泄漏的系统更容易废弃。

## The Deprecation Decision

在废弃任何东西之前，先回答这些问题：

```
1. 这个系统是否仍提供独特价值？
   → 如果是，维护它。如果不是，继续往下。

2. 有多少用户/消费方依赖它？
   → 量化迁移范围。

3. 替代品是否已存在？
   → 如果没有，先把替代品造出来。没有替代品就别废弃。

4. 每个消费方的迁移成本是多少？
   → 如果能轻易自动化，就做。如果是手动且高成本，与维护成本权衡。

5. 不废弃的持续维护成本是多少？
   → 安全风险、工程师时间、复杂度带来的机会成本。
```

## Compulsory vs Advisory Deprecation

| 类型 | 何时使用 | 机制 |
|------|----------|------|
| **Advisory（建议性）** | 迁移是可选的，旧系统稳定 | 警告、文档、提示。用户按自己的节奏迁移。 |
| **Compulsory（强制性）** | 旧系统有安全问题、阻碍进展，或维护成本不可持续 | 硬性截止日期。旧系统将在 X 日期被移除。提供迁移工具。 |

**默认用 advisory。** 只有当维护成本或风险足以justify强制迁移时才用 compulsory。强制性废弃要求你提供迁移工具、文档和支持——你不能只是宣布一个截止日期。

## The Migration Process

### Step 1: Build the Replacement（构建替代品）

没有可用的替代品就别废弃。替代品必须：

- 覆盖旧系统所有关键用例
- 有文档和迁移指南
- 在生产环境中得到验证（不只是"理论上更好"）

### Step 2: Announce and Document（公告并文档化）

```markdown
## Deprecation Notice: OldService

**Status:** Deprecated as of 2025-03-01
**Replacement:** NewService (see migration guide below)
**Removal date:** Advisory — no hard deadline yet
**Reason:** OldService requires manual scaling and lacks observability.
            NewService handles both automatically.

### Migration Guide
1. Replace `import { client } from 'old-service'` with `import { client } from 'new-service'`
2. Update configuration (see examples below)
3. Run the migration verification script: `npx migrate-check`
```

### Step 3: Migrate Incrementally（增量迁移）

逐个迁移消费方，不要一次性全迁。对每个消费方：

```
1. 识别与被废弃系统的所有接触点
2. 更新为使用替代品
3. 验证行为一致（测试、集成检查）
4. 移除对旧系统的引用
5. 确认无回归
```

### Step 4: Remove the Old System（移除旧系统）

只有在所有消费方都已迁移后：

```
1. 验证零活跃使用（指标、日志、依赖分析）
2. 移除代码
3. 移除相关测试、文档和配置
4. 移除废弃公告
5. 庆祝——移除代码是一种成就
```

## Migration Patterns

### Strangler Pattern（绞杀者模式）

让新旧系统并行运行。把流量增量地从旧路由到新。当旧系统处理 0% 流量时，移除它。

```
Phase 1: 新系统处理 0%，旧系统处理 100%
Phase 2: 新系统处理 10%（canary）
Phase 3: 新系统处理 50%
Phase 4: 新系统处理 100%，旧系统空闲
Phase 5: 移除旧系统
```

### Adapter Pattern（适配器模式）

创建一个适配器，把对旧接口的调用翻译到新实现。消费方继续用旧接口，同时你迁移后端。

```typescript
// Adapter: old interface, new implementation
class LegacyTaskService implements OldTaskAPI {
  constructor(private newService: NewTaskService) {}

  // Old method signature, delegates to new implementation
  getTask(id: number): OldTask {
    const task = this.newService.findById(String(id));
    return this.toOldFormat(task);
  }
}
```

### Feature Flag Migration（特性开关迁移）

用 feature flag 逐个把消费方从旧系统切到新系统：

```typescript
function getTaskService(userId: string): TaskService {
  if (featureFlags.isEnabled('new-task-service', { userId })) {
    return new NewTaskService();
  }
  return new LegacyTaskService();
}
```

## Zombie Code（僵尸代码）

僵尸代码是没人拥有但人人依赖的代码。它没有被主动维护，没有明确的 owner，并不断累积安全漏洞和兼容性问题。识别信号：

- 6 个月以上没有 commit，但存在活跃消费方
- 没有指定的维护者或团队
- 失败的测试没人修
- 已知漏洞的依赖没人更新
- 文档引用了已不存在的系统

**处置：** 要么指派一个 owner 并妥善维护，要么用一份具体的迁移计划废弃它。僵尸代码不能停留在中间地带——它要么获得投入，要么被移除。

## The Churn Rule（流失规则）

**如果你拥有被废弃的基础设施，你就有责任迁移你的用户——或者提供无需迁移的向后兼容更新。** 不要宣布废弃然后把用户晾在一边让他们自己想办法。

## Common Rationalizations

| 自我合理化 | 现实 |
|---|---|
| "它还能用，为什么要移除？" | 没人维护的可用代码会累积安全债务和复杂度。维护成本在悄悄增长。 |
| "以后可能有人需要" | 如果以后需要，可以重建。"以防万一"留着没用的代码，比重建成本更高。 |
| "迁移太贵了" | 把迁移成本与 2-3 年的持续维护成本对比。长期看迁移通常更便宜。 |
| "等我们做完新系统再废弃旧的" | 废弃规划从设计阶段就开始。等新系统做完，你已经有新优先级了。现在就规划。 |
| "用户会自己迁移" | 他们不会。提供工具、文档和激励——或者自己来做迁移（Churn Rule）。 |
| "我们可以无限期维护两套系统" | 两套系统做同一件事意味着双倍的维护、测试、文档和上手成本。 |

## Red Flags

- 被废弃的系统没有可用替代品
- 废弃公告没有迁移工具或文档
- "软"废弃多年仍是建议性，毫无进展
- 僵尸代码没有 owner 却有活跃消费方
- 给被废弃系统添加新特性（应该投入替代品）
- 不测量当前使用量就废弃
- 不验证零活跃消费方就移除代码
