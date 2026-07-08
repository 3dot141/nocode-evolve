# model/agent-about.md + agent-catalog-using.md 重写计划

> 计划文档，**尚未执行任何落盘改动**。字符数口径统一用 `wc -m`。

## 为什么改用重写而不是增量删减

上一版计划(`model-compression-plan-3500.md`)是"逐段判断删/留/合并"的增量编辑思路，价值分析后自然落点约 5570 / 3790，仍高于 3500。改成**整篇重写**——不是先保留原句再砍，而是基于价值分析结论（`model-value-analysis` 讨论中确定的 CRITICAL-KEEP / CUT / FIX 清单）直接用更密的表达重新组织，去掉连接性 filler 和重复框架句。结果：

| 文件 | 原始 | 重写稿 | 降幅 |
|---|---|---|---|
| `model/agent-about.md` | 7760 | **3566** | 54% |
| `model/agent-catalog-using.md` | 4808 | **2597** | 46% |

两份重写稿都已优于 3500 目标，且未触碰任何此前标为"唯一防线"的内容。

## 重写稿位置

- `docs/dev/3dot141/260704-01-context-optimization/agent-about-rewrite-draft.md`
- `docs/dev/3dot141/260704-01-context-optimization/agent-catalog-using-rewrite-draft.md`

## 保留内容清单（不可动的唯一防线，双审重点核对项）

1. **git-freshness 命令**逐字保留：`node "${CLAUDE_PLUGIN_ROOT}/scripts/freshness-check.mjs" --max-behind=5 --ttl=7200`，exit 2 三选、cache TTL 2h、worktree 例外的语义全在。
2. **全局占位符两张表**本体不动：`{username}`/`{NOCODE_SKILL_REF}` + 6 行产出路径变量（`pd_research_output`/`pd_prd_output`/`pd_ix_output`/`pd_vd_output`/`dev_design_output`/`dev_plan_output`），这些被 `pd-research`/`pd-prd`/`pd-ix`/`pd-vd`/`dev-define`/`dev-design-refine`/`devflow` 的 SKILL.md 直接消费。
3. **AskUserQuestion payload 自足**三条子规则（payload 自足 / 禁止前文指代 / 超长内容降级 step→step）+ ❌/✅ 示例全部保留——这个例子讲的是非显然的机制性 bug（harness 吞文本），保留插图。
4. **偏离 rule/skill 授权**规则 + ❌/✅ 示例保留——示例澄清"模糊信号 ≠ 显式授权"这个容易判错的自然语言边界。
5. **代码搜索默认走 semble-search** + fallback 链完整保留（包括"不触发"三种原生工具场景 + grep→rg 替换规则）。
6. **评估类提问调红蓝军**触发语句原样保留。
7. `agent-catalog-using.md` 的**"进了 skill 就走完"四条硬约束**全部保留、语义不合并——这是 Hook A（防跳步机制）被删除后**唯一剩下的防跳步机制**。
8. **触发协议(Step 0)+ fork/subagent 降级**规则完整保留。

## 主动删除/改写的内容（价值分析已判定为重复或低价值）

| 内容 | 处置 | 理由 |
|---|---|---|
| "先扫 4 个粗桶" | 改成不带数字的指针，指向 `agent-catalog-using.md` | 数字已过期(实际 6 个)，且与 catalog-using.md 重复表述 |
| "单源生成: rules/manifest.json → hooks/generate.mjs…" 整条 bullet | 删除 | 与项目根 `CLAUDE.md` 规则 3 逐字重复，两者都常驻 |
| "硬护栏"具体命令清单(force push/gh api PATCH/bkt PUT/裸curl) | 泛化成一句"危险 Bash 命令自动 inject/block" | hook 自动生效不依赖 agent 读到这段文字，且清单会随 `pretooluse-rules.json` 演进而漂移(与"4个粗桶"同类风险) |
| "语气规范—工程动词"整节(含反例/正例表) | 整节删除 | 零功能后果，性质与已删除的"说人话"节相同 |
| Red Flags 表(11行) | 合并到 5 组(按语义相近合并，如"先看背景/先看代码/先查git"合一) | 原表多行语义高度重叠，合并不减覆盖率 |
| 跳步的借口表(6行)+ ❌/✅ dev-plan 示例 | 表合并到 4 组，**删除示例** | 上面 4 条编号约束已精确表述规则，示例是装饰性重复(区别于第 3/4 条那两个示例，那两个澄清的是非显然的自然语言/机制歧义) |
| 用户离场信号 | 保留全部语义，压缩措辞 | 无重复，纯粹更密的表达 |
| 全局约定 | 保留 3 条要点，删除元提示句("新增约定追加到本文件") | 元提示对模型无行为价值 |

## 下一步

对这份重写计划(两份草稿 + 上面两张清单)做 **强制双审档**独立评审——两个独立评审者(subagent + Codex)各自逐条核对：草稿是否真的保留了"不可动清单"的全部语义、有没有事实错漏(命令/占位符/表格数据)、有没有本会话已出现过两次的那类数据污染痕迹(字面占位符/YAML语法泄漏/截断句子)。评审结果见后续更新。
