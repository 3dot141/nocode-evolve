# reviewing 引擎重构（场景-视角-方法三层执行模型）Implementation Plan

**Goal**: 按设计文档把 `skills/reviewing/` 的执行模型从"档位焊死路数"改成"场景识别→分档(执行位)→执行(打包)→Verify(场景内)→总结"五步模型。
**Architecture**: 纯 skill/prompt 内容改动（markdown 文件），无运行时代码，无自动化测试；单次原子 commit 落地（含版本号）。
**Tech Stack**: 无（markdown 内容 + 既有 hooks 测试套件 `node --test hooks/*.test.mjs` 作为回归哨兵）。
**Design Doc**: `docs/dev/3dot141/260704-02-reviewing-parallel-finders/reviewing-parallel-finders-design.md`
**Test Objectives**: 设计文档 §8.2 TO-1~TO-7（六条 Given/When/Then 案例）。
**Execution**: `executing`（内容改写非代码实现，由主 agent 直接顺序改写，不派 subagent 三阶段审查；用 Round2 强制重档 red-blue-deep 兜底跨文件一致性）

---

## 依赖图

```
Slice A: skeleton.md（改）
   │  (定义中档=Codex单审、场景识别步骤、打包执行位、Verify定义——
   │   下游所有方法卡的措辞都要引用这里的新术语)
   ▼
┌──────────────┬──────────────────────┬───────────────────────┐
▼              ▼                      ▼
Slice B        Slice C                Slice D
perspective-   checklist/error-       code-quality-method 拆分
based +        mechanism/threat-      + regression-check(NEW) +
dual-review    modeling(措辞对齐)     cross-file-impact(NEW)
（改执行方式    （低风险，纯引用       （Q7 新增子视角，中风险）
 声明）         措辞同步）
└──────────────┴──────────────────────┴───────────────────────┘
                         │
                         ▼
                  Slice E: SKILL.md 门面同步 + plugin.json 版本号
                  （依赖 A/B/C/D 全部完成，是收尾同步，不能提前做）
```

无环。B/C/D 三者互相独立，可并行填充（Round 2）；A 是唯一的前置阻塞点；E 是唯一的收尾阻塞点。

## 任务序列

### Task 1: 改 skeleton.md（Slice A）— 核心执行模型

- **Files**: Modify `skills/reviewing/references/skeleton.md`
- **covers**: 设计文档变更点①②③⑤⑧（Q1/Q2/Q3/Q5，档位定义/场景层/打包执行/Verify/保留对象界定与升档重跑）
- **设计文档段落**: §5.1 新旧步骤映射、§5.3 打包结构示例、§6 Step 1
- **HITL/AFK**: AFK（内容改写，无需人工确认单点）
- **Sizing**: 1 文件（但改动面大，是全计划风险最高的一步，risk-first 排最前）
- **Rollback-friendly**: 是，独立文件

**改动清单**（Round 2 填充时逐条落实，均已在设计文档写清楚具体文字）:
1. §1 分档判据表标题/说明从"轻档/中档/重档,路数固定"改成"自审/Codex单审/subagent+codex双审(执行位数量)"，风险信号表本身不变(仍按可逆性/影响面判断该起始档位)
2. §1a 升档判据机制保留，措辞从"路数升级"改成"执行位数量与身份升级"
3. 新增"场景识别"步骤：定义位置在"对象界定+gate"之后、"执行"之前；来源=§3命中+调用处在"领域维度"参数里声明+项目本地扩展(读约定路径，非新增调用参数)；决策类场景(red-blue命中)整体摘出不进后续步骤
4. §3 方法选择表拆分：明确区分"找问题类"(checklist/threat-modeling/error-mechanism/perspective-based)和"决策类"(red-blue-adversarial)，"代码质量"场景下 checklist 与 error-mechanism 从"二选一备选"改成"可叠加的正确性视角方法"，新增"清理"视角(引用 code-quality-method 清理小节)，新增引用 regression-check.md / cross-file-impact.md
5. §4.0 主路派发表重写：从"三档执行方式(执行者/路数/独立性)"表改成"档位=执行位数量与身份 + 打包执行"定义，含 PBR 不例外的说明(视角展开不受档位影响，档位只决定执行位身份)
6. 新增 Verify 章节：场景内部、独立第三方逐条判 confirmed/plausible/refuted，跨场景不验证

**验证**（无自动化测试，人工核对）:
- 改完后通读 skeleton.md 全文一遍，确认"中档"一词全文只对应"Codex单审"这一种身份表述，无残留"中档=subagent"字样
- 确认"对象界定+gate"和"升档重跑(§1a)"两个机制在文中仍有明确定义，未被误删
- `rg -n "中档" skills/reviewing/references/skeleton.md` 逐条核对上下文一致

### Task 2: 改 perspective-based.md + dual-review.md（Slice B）

- **Files**: Modify `skills/reviewing/references/methods/perspective-based.md`, `skills/reviewing/references/methods/dual-review.md`
- **covers**: 变更点①③⑤（PBR不再有执行方式特权、Verify机制引用）
- **设计文档段落**: §4 Q1/Q3/Q5、§6 Step 2
- **HITL/AFK**: AFK
- **Sizing**: 2 文件
- **Rollback-friendly**: 是

**改动清单**:
- `perspective-based.md`：删除"重档 / 多利益相关者对象时每个视角派一个独立 subagent 并行深读"这条执行方式声明；改为声明"这个方法的视角数 = stakeholder 数量(2-4个,按对象裁剪)，视角数展开不受档位影响；档位决定执行位身份(见 skeleton §4.0)"
- `dual-review.md`："三、合并 + 判决"这节的"主会话拿完整上下文逐条判成立性"改成引用新 Verify 机制("仅单路命中的候选，起独立第三方验证者判 confirmed/plausible/refuted，见 skeleton 新 Verify 定义")；标题可能需要从"重档默认双路合并机制"调整措辞以呼应"执行位"新术语，但不改变它作为"重档默认执行形态"的定位

**验证**:
- 两张卡跟 Task 1 改完的 skeleton.md 交叉核对：确认没有互相矛盾的执行方式描述残留

### Task 3: checklist.md / error-mechanism.md / threat-modeling.md 措辞对齐（Slice C）

- **Files**: Modify `skills/reviewing/references/methods/checklist.md`, `skills/reviewing/references/methods/error-mechanism.md`, `skills/reviewing/references/methods/threat-modeling.md`
- **covers**: 变更点②（场景/方法术语对齐）
- **设计文档段落**: §6 Step 2
- **HITL/AFK**: AFK
- **Sizing**: 3 文件（均为低风险纯措辞同步，可批量处理）
- **Rollback-friendly**: 是

**改动清单**（三张卡方法论本身均不改，只改"派发见 skeleton"这行引用措辞，确保跟新术语"场景/视角/执行位/Verify"不冲突，不用旧的"路数"字眼）:
- `checklist.md` 末尾引用行：确认"重档对象下按 §4.0 走双路"这类措辞改成呼应"执行位"新模型，不再说"路数"
- `error-mechanism.md` 末尾引用行同上
- `threat-modeling.md` 末尾引用行同上，另外它是"安全"场景默认方法，需要在文中确认这条归属关系依旧成立（不需要改动其 STRIDE/OWASP 方法论本身）

**验证**: 三张卡改完后确认没有出现"路数"字眼、没有跟 skeleton.md 新术语冲突的表述

### Task 4: code-quality-method.md 拆分 + regression-check.md(NEW) + cross-file-impact.md(NEW)（Slice D）

- **Files**: Modify `skills/reviewing/references/methods/code-quality-method.md`; Create `skills/reviewing/references/methods/regression-check.md`, `skills/reviewing/references/methods/cross-file-impact.md`
- **covers**: 变更点⑦（Q7 代码质量场景补充子视角）
- **设计文档段落**: §5.3、§6 Step 3
- **HITL/AFK**: AFK
- **Sizing**: 3 文件
- **Rollback-friendly**: 是（新文件删除 + 改动文件 revert 即可）

**改动清单**:
- `code-quality-method.md`：内部重新分节——把"总览审查清单"里的"无重复代码/代码简洁可读"和"最佳实践"组(格式不一致/魔法数字/命名差/emoji等)拆出来,独立整理成"清理维度"小节；保留"安全/代码质量/性能"三组硬伤类清单作为"正确性维度"的一部分；文末引用行说明"正确性用于 skeleton §3 代码质量场景的正确性视角，清理小节用于清理视角"
- `regression-check.md`(NEW)：仿照现有方法卡格式（标题+适用场景+维度思路+输出契约+派发引用），内容对应 Claude Code Angle B 思路——"对 diff 删除或替换的每一行，找出它原本保证的不变量/行为，检查新代码里是否在别处重新建立"，属于"代码质量"场景正确性视角下的方法，输出 findings 套 findings-contract schema，axis="回归检查"
- `cross-file-impact.md`(NEW)：仿照现有方法卡格式，内容对应 Angle C 思路——"对 diff 改动的每个函数，找出它的调用方，检查改动是否破坏调用点原有假设"，同样属于正确性视角下的方法，axis="跨文件影响"

**验证**: 两张新卡格式跟现有方法卡（如 error-mechanism.md）的骨架一致（适用场景/不适用场景/维度思路/输出契约/派发引用五段式）；确认三张卡（含改完的 code-quality-method.md）共同被 Task 1 改完的 skeleton.md §3 引用到

### Task 5: SKILL.md 门面同步 + plugin.json 版本号（Slice E，收尾）

- **Files**: Modify `skills/reviewing/SKILL.md`, `.claude-plugin/plugin.json`
- **covers**: 变更点全部（门面必须反映 Task 1-4 全部改动）
- **设计文档段落**: §6 Step 4
- **HITL/AFK**: AFK
- **Sizing**: 2 文件
- **依赖**: Task 1-4 全部完成后才能做（门面必须反映最终状态，不能提前写）

**改动清单**:
- `SKILL.md`"引擎内部：四层结构"图：更新七步流程为新五步(场景识别→分档→执行→Verify→总结，标注保留的对象界定/gate 与升档重跑在何处)
- `SKILL.md`"七步流程"表格：改成新流程表，含新术语(场景/视角/方法/执行位)
- `SKILL.md`"引擎文件地图"：补充 regression-check.md / cross-file-impact.md 两个新文件的说明
- `.claude-plugin/plugin.json`：版本号 minor 升级（读取当前版本号，升 minor 位，patch 归零）

**验证**: `SKILL.md` 头部摘要/流程图逐项核对 `references/` 下改完的实际内容，确认无门面与内部定义不一致

## Checkpoint 1（Task 1 完成后）

- [ ] `skeleton.md` 改完，通读一遍确认内部自洽（尤其"中档=Codex单审"全文一致）
- [ ] `node --test hooks/*.test.mjs` 跑一遍确认无关系统未受影响（sanity check，本次改动不触及 hooks/，预期无变化）

## Checkpoint 2（Task 2-4 完成后，可并行做完再一起过这个 checkpoint）

- [ ] 5 张受影响方法卡 + 2 张新方法卡与 Task 1 改完的 skeleton.md 交叉核对，无矛盾表述残留
- [ ] `rg -n "路数|中档.*subagent" skills/reviewing/references/` 全局搜索确认无遗留旧措辞

## Checkpoint 3（Task 5 完成后，终检）

- [ ] `SKILL.md` 门面与 `references/` 内部定义逐项核对一致
- [ ] `plugin.json` 版本号已升级
- [ ] `node hooks/generate.mjs --check` 跑一遍确认 manifest 生成物一致性未受影响（本次改动不触及 rules/manifest.json，预期无变化，只作兜底 sanity check）
- [ ] `node --test hooks/*.test.mjs` 全量跑一遍确认最终状态无关系统未受影响

## Plan Validation

- **需求覆盖**：设计文档 §5.4 变更点①-⑧ 全部有对应 Task 覆盖（① Task1 ② Task1+2 ③ Task1 ④ Task1 ⑤ Task1+2 ⑥ Task1(不改红蓝本身,只在skeleton里重申边界) ⑦ Task4 ⑧ Task1）
- **路径覆盖**：设计文档 §8.1 列出的 9 改 + 2 NEW 共 11 个文件，Task 1-5 合计覆盖 11 个文件（Task1:1 + Task2:2 + Task3:3 + Task4:3 + Task5:2 = 11），无遗漏
- **可验证**：每个 Task 都有对应的人工核对清单(无自动化测试，均已在上方"验证"栏给出具体核对动作)
- **无环**：依赖图 A→{B,C,D}→E，无循环
