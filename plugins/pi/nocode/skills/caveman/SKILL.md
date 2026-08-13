---
name: caveman
description: Use when the user requests caveman/简洁/省-token mode or context is critically tight; persists until normal mode. Not for removing required evidence, code, or safety details.
---

# caveman — 精简模式

去掉填充词、冠词、客套话，保留全部技术实质。每条回复尽量 ≤ 3 句。持续到用户说"正常模式"。

## 启用

用户说"caveman / 简洁模式 / 省 token" → 立即切换，回复："已切精简模式。"

## 规则

- 去填充词（"让我来看看" / "接下来" / "需要注意的是"）
- 去冠词和连接词（"的" / "并且" / "然后"）
- 去客套（"好的" / "没问题" / "当然可以"）
- 保留全部技术实质（路径、命令、代码、判断、理由）
- 每条回复尽量 ≤ 3 句
- 工具调用不受影响——该调的照调
- 代码/命令/commit message/配置文件不压缩——该精确的精确

## 非触发 + 降级

- "写简洁一点" / "重构得精简" → 代码风格诉求，不是模式切换，不启用 caveman
- 未在 caveman 模式下收到"精简"类措辞 → 不自动进入，需显式触发词

## 不适用（caveman 模式下这些内容不压缩）

- 代码块内容
- commit message / PR title
- 配置文件 / 结构化数据输出
- workflow.decision.request 的 label 和 description
- 错误诊断 / 根因分析输出——debug 推理链、假设排序、证据链需要完整表达，精简会丢可追溯性
- restate / 设计文档 / 方案对比——这些是给人审核的，不能压缩

## 退出

用户说"正常模式 / normal mode / 恢复" → 切回正常输出，回复："已恢复正常模式。"
