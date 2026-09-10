# Eval — 定量验证 + SkillOpt 有界迭代

写完 skill 后的定量验证与迭代纪律。防两个真实失败：**改了不知道好坏**（没有数字基准）、**过拟合回归**（对单 case 修补，整体变差）。

## 1. 建 eval 集 + train/validation 切分

写真实的测试 prompt。**最少 8 条**（切分后 train ≥5、validation ≥3）。

按 60/40 切成训练集和验证集，带切分标记存 `evals/evals.json`。

为什么 validation ≥3：更少的话 pass_rate 粒度太粗（33%/67%/100%），验证门就成了噪声。

## 2. 跑 with-skill + baseline 双组

```
claude -p "hello" --output-format json
         │
         ├─ 成功 ──→ run_eval.py（../skill-creator/scripts/）
         │
         └─ 失败（command not found / error）
                  │
                  └──→ subagent 兜底
                       每条 prompt 一次 with-skill + 一次 without
                       存 workspace/iteration-N/eval-ID/
                       报告 "CLI 不可用（原因: …），改用 subagent 兜底"
```

**永远先试 CLI。** Claude Code 会话内嵌套 `claude -p` 是支持的。只有拿到具体失败才降级——"可能不行"不是跳过的理由。

## 3. 跑的同时起草断言

不要干等——给每个测试 case 起草定量断言。好断言是客观可验证的。

- 纪律型 skill：聚焦"压力下 agent 守没守规矩？"
- 主观输出（写作风格类）：跳过断言，靠人工 review

## 4. 评分 + 基准 + viewer

1. 用 `../skill-creator/agents/grader.md` 给每次运行评分
2. 用 `../skill-creator/scripts/aggregate_benchmark.py` 聚合
3. 用 `../skill-creator/eval-viewer/generate_review.py` 生成 viewer

**重要**：viewer 只展示训练集结果。验证集结果保持隐藏——只用于迭代时的验证门。

分数定义：`pass_rate = 通过断言数 / 总断言数`（每 case）。聚合 = 各 case pass_rate 均值。

用户反馈从 `feedback.json` 读（只含训练集）。

## 5. SkillOpt 迭代四硬约束（一条都不能省）

### 5a. Aggregate Reflect

读反馈 + 基准数据。跨 case 归纳成模式——不要对单 case 过拟合。纪律型 skill 还要从 transcript 里提取新的合理化借口。

**给每个失败分类**：
- `SKILL_DEFECT`——skill 文本错误/不完整 → 修 skill
- `EXECUTION_LAPSE`——指令清晰但 agent 失手 → 不改 skill

只有 `SKILL_DEFECT` 驱动 5b 的编辑。把 EXECUTION_LAPSE 的补丁写进 skill 只会灌水。

### 5b. Bounded Edits

每轮迭代：对 SKILL.md 最多 3 处改动（增/删/替换）。不做整体重写。顺手删掉不干活的内容。

### 5c. Validation Gate

改完重跑验证集（留出的 40%），`new_score` 对比 `previous_score`：

- `new_score < previous_score` → **拒绝**本轮编辑，回滚，换思路
- `new_score >= previous_score` → **接受**，更新 previous_score

**Codex 交叉验证**：至少 1 条验证 case 过 codex（同 baseline 的交叉逻辑）。codex 失败而 subagent 成功 → 大概率 SKILL_DEFECT（指令依赖了模型特有推理，写得不够显式），喂回下一轮 5a。codex 不可用则跳过并声明。

连续 3 轮被拒 → 停下问用户要约束（"X 和 Y 哪个对你更重要？"）。

### 5d. 收敛

收敛阈值随样本量自适应：`1 / len(validation_set)`。
- 4 条验证 → 25% 阈值；10 条 → 10%；20 条 → 5%

满足任一即停：
- 用户说满意
- 所有反馈为空（都看着不错）
- 验证集 pass_rate 变化 ≤ 阈值，连续 2 轮

未收敛 → 回到第 2 步重跑 eval。

## 通过判据

- [ ] eval 集 ≥8 条，train/validation 已切分
- [ ] with-skill + baseline 双组跑完，基准有数字 pass_rate
- [ ] 已收敛（或用户满意），验证分不低于进场分（无回归）
