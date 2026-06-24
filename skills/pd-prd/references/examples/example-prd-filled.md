# 示例：填好的 PRD（团队协作功能）

> 这是一份**填好的** PRD 样例，给 pd-prd 起草时对照颗粒度用。不是模板——模板见 SKILL.md Step 2。
> 场景：一个单人记账 SaaS「Ledgerly」要加团队协作，让小团队共享账本。

---

# PRD: Ledgerly 团队协作

> Status: Draft
> Author: 3dot141
> Date: 260624
> Research: docs/nocode/prds/3dot141/research-memo-team-collab.md

## Problem

Ledgerly 现在是纯单人记账。**主因**：付费用户里 38% 在工单里问"能不能和合伙人共享账本" [SOURCE: research-memo 市场信号]，他们目前靠共享账号密码绕过，导致操作无法追溯、改错无法归因。**辅因**：共享账号让多端登录频繁触发风控登出（本 PRD 不直接解决，但协作功能落地后会缓解）。

## User Stories

- **US-1** As a 账本所有者, I want 邀请成员加入我的账本, so that 合伙人能一起记账不用共享密码 `[CONFIRMED]`
- **US-2** As a 被邀请成员, I want 通过邮件链接接受邀请, so that 不用注册流程就能加入 `[CONFIRMED]`
- **US-3** As a 账本所有者, I want 给成员设只读/可编辑权限, so that 会计只看不改、合伙人能改 `[CONFIRMED]`
- **US-4** As a 任意成员, I want 看到每笔记录是谁改的, so that 出错能追溯到人 `[ASSUMED]` — 审计需求是从工单痛点推断，待用户核验是否本期做

## Appetite

2 周封顶。理由：协作是留存功能不是增长功能，超过 2 周的投入应先验证付费转化再追加。超时则砍 US-3（权限分级）先上邀请+共享。

## Solution Direction

账本增加 members 关联表；邀请走"生成带 token 的邀请链接 + 邮件发送"；权限用 owner/editor/viewer 三档枚举。草图级，详细设计交 dev-design。

## Competitive Analysis

[来自 research-memo Feature Matrix] 竞品 YNAB 无协作、Monarch 有共享但无权限分级、QuickBooks 有完整权限但太重。差异化空间：轻量三档权限。

## Success Metrics

- Primary: 协作功能上线 30 天内，≥15% 付费账本至少邀请 1 名成员 `[CONFIRMED]`
- Secondary: 共享账号导致的风控登出工单下降 ≥50% `[ASSUMED]`
- Guardrail: 单人用户的记账核心流程 P95 延迟不恶化（协作查询不拖慢主路径）`[CONFIRMED]`

## Rabbit Holes

- 实时协同编辑（多人同时改一笔）→ 技术不确定性高，本期用乐观锁"后写覆盖 + 提示"即可 [推断]
- 邀请 token 的安全性（过期/撤销/重放）→ 需 dev-design 的 threat model 覆盖 [代码探索]

## No-Gos

- 不做实时协同光标/在线状态（over-engineering，小团队用不上）
- 不做超过 3 档的权限体系（企业级 RBAC 不在本期）
- 不做跨账本的组织/团队层级（一个账本一组成员，不做 workspace 概念）

## Open Questions

- [TBD] 免费用户能不能用协作，还是作为付费墙功能？
- [TBD] 成员数量上限设多少？

## Source Appendix

- [SOURCE: docs/nocode/prds/3dot141/research-memo-team-collab.md] 工单痛点统计 + 竞品矩阵
