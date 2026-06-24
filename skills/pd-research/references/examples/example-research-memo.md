# 示例：填好的 Research Memo（AI 代码评审工具调研）

> 这是一份**填好的** research-memo 样例，给 pd-research 综合时对照颗粒度用。不是模板——模板见 SKILL.md Step 3。
> 场景：团队想做一个内部 AI 代码评审工具，先调研现状。

---

# Research Memo: AI 代码评审工具现状

> Date: 260624
> Author: 3dot141
> Facets: 竞品分析 / 代码现状 / 市场社区 / 已有方案

## Executive Summary

AI 代码评审已有成熟商业产品（CodeRabbit / Greptile），但都偏 SaaS、对私有代码顾虑大。开源侧有零散方案但缺"多模型交叉评审"。我们的代码库已有 codex companion 接入，差异化空间在"本地优先 + 跨模型盲点检测"。建议 **Go**。

## 竞品分析

### Feature Matrix
| Feature | CodeRabbit | Greptile | PR-Agent | 我们 |
|---|---|---|---|---|
| PR 自动评审 | ✅ | ✅ | ✅ | [TBD] |
| 多模型交叉 | ❌ | ❌ | ❌ | 差异点 |
| 本地/私有部署 | ❌ | ⚠️ 企业版 | ✅ | ✅ |
| 五轴结构化 finding | ⚠️ | ❌ | ⚠️ | ✅ |

### 关键发现
- [SOURCE: coderabbit.ai/pricing] 商业产品都按 seat 收费，小团队成本高
- [SOURCE: github.com/Codium-ai/pr-agent] PR-Agent 开源但单模型，与作者同源盲点未解决

## 代码现状
- [Read skills/dev-review/SKILL.md:80] 已有 Codex Cross-Review 机制，跨模型交叉评审基础设施已就位
- [Read rules/rule-codex-review.md] codex companion 接入封装完整，可复用
- 可复用模块：five-axis-guide.md 五轴检查点已沉淀
- 现有 pattern：findings 统一 schema（id/axis/evidence/fix/action）

## 市场/社区信号
- [SOURCE: news.ycombinator.com/item AI review 讨论] 开发者抱怨 AI review 噪音大、nit 太多淹没真问题
- [SOURCE: reddit.com/r/ExperiencedDevs] 痛点：reviewer 不读真实代码就指控（幻觉 finding）

## 已有方案
- [SOURCE: github.com/Codium-ai/pr-agent] PR-Agent：开源、可自托管，但单模型
- [SOURCE: deepwiki coderabbitai] CodeRabbit：交互式 + 学习团队风格，闭源

## 踩坑 / Pitfalls
- [SOURCE: HN 评论串] AI review 最大失败模式是"doubt theater"——为了显得在审查而堆砌无意义反驳。设计时要有噪音抑制
- [SOURCE: 代码现状] Evidence Gate 已是我们的解法（无 path:line 不上 Critical），是相对竞品的优势

## Go/No-Go 建议
**建议**: Go
**理由**: 基础设施（codex 接入 + 五轴）已就位，差异化清晰（本地 + 跨模型 + 噪音抑制），市场痛点明确
**Stop Criteria**: 若跨模型交叉评审的额外 token 成本 > 单模型 3 倍且无质量提升，则降级为单模型
**[ASSUMED]**: 团队愿意承担多模型 token 成本——需用户核验预算
