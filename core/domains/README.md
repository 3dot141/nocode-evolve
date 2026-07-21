# Domain registry

`core/domains/` 是 nocode 的领域能力单源。每个领域只维护三类内容：

- `capabilities/`：稳定的 `domain.action` 语义与输入/输出 contract。
- `contracts/`：领域数据结构。
- `providers/`：Claude、Codex 或共享 provider 的能力覆盖、运行方式与使用说明。

六个领域分别是 Design、Workflow、Runtime State、Personal Knowledge、Lifecycle 和 Workspace。每个 `domain.json` 只引用本领域文件；registry 校验 capability 所有权、provider 覆盖、schema 与跨领域依赖。

业务 Skill 在正文保留 `Capability(domain.action, <json>)` 语义标记，不声明 provider。compiler 从 registry 为每个平台生成 `skills/using-nocode/references/<domain>.md`；运行时由 `using-nocode` 读取对应领域 reference，按当前平台的原生 provider 指引执行。

本层不生成逐 capability 私有 Skill，也没有 gateway、Consumer grants、attempt token、transaction receipt 或自动 fallback。副作用继续由 Claude/Codex 原生 approval 控制；fallback 只能按 reference 明确告知用户后人工选择。

正常 release gate：

```bash
node scripts/check-skills.mjs --root . --platform source
node scripts/compile.platform.mjs
node scripts/compile.platform.mjs --check
```

`plugins/claude/nocode/` 与 `plugins/codex/nocode/` 都是生成物，禁止手改。
