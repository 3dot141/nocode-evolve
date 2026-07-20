---
name: agent-profiles
description: Dispatch a nocode specialist profile with spawn_agent when isolated work is useful.
---

# nocode agent profiles

Select the closest profile below, read its private reference, then call `spawn_agent` with that role intent and the concrete task. If collaboration is unavailable, execute the profile in the main session and state the degradation.

- `architect`: Software architecture specialist for system design, scalability, and technical decision-making.
- `code-reviewer`: Expert code review specialist.
- `database-reviewer`: PostgreSQL database specialist for query optimization, schema design, security, and performance.
- `planner`: Expert planning specialist for complex features and refactoring.
- `recall-search`: 搜索 wiki 和 vault 中的已沉淀内容，返回按置信度排序的精简清单。用于 /recall command 委派搜索，避免搜索过程污染主 agent context。
- `security-reviewer`: Security vulnerability detection and remediation specialist.
- `semble-search`: Code search agent for exploring any codebase.
- `tdd-guide`: Test-Driven Development specialist enforcing write-tests-first methodology.
