# Visual forms for technical explanation

共享 reference，多 skill 按需 Read。

Distilled from [humanlayer/skills `show-me`](https://github.com/humanlayer/skills/tree/main/plugins/show-me) (2026-08), adapted to this plugin's conventions. Use it whenever explaining technical content — design documents, review findings, plans, or everyday technical replies — and a wall of prose starts forming.

## Discipline

- Pick the **smallest view that makes the current point clear**. One point, one view; using every form at once overwhelms the reader.
- Place each visual **next to the short text it supports**, not in an appendix.
- Keep only the calls, files, props, states, and boundaries needed to answer the **current** question — never a panorama of everything known.
- When prose runs past one point, stop and check whether a form below carries it better.

## Form selection

| Content to show | Form |
|---|---|
| Logic / algorithm | Pseudocode block |
| Runtime control flow | Call tree |
| UI structure, state, module boundaries | Component tree |
| File responsibility / broad refactor | Shallow annotated file tree |
| Participant order, return, timeout, retry, concurrency | Sequence diagram |
| **What changes** is the point | Diff-shaped tree / pseudocode |
| Whole-system panorama: layers/stages a payload flows through (entry → pipeline → reconcile → storage) | Layered pipeline diagram |
| Dense concept, layout, or state comparison too dense for the above | Single-file HTML |

Pseudocode block:

```text
on(save)
  if content is unchanged
    return cached result
  write new content
  return fresh result
```

Call tree:

```text
submitForm
  createSession
    persistPrompt
    launchAgent
  navigateToSession
```

Component tree — include state and the module boundaries that matter, with real file paths:

```tsx
<SessionPage> (apps/example/src/routes/session.tsx)
  useSessionEvents()
  <SessionToolbar>
    <RunSkillButton> (packages/ui)
```

Shallow file tree — annotate responsibility, stay one or two levels deep:

```text
src/
├── commands/       # parses user actions
├── sessions/       # owns session state
└── transport/      # sends API requests
```

Diff-shaped forms — when the discussion point is the change itself, diff the tree instead of writing before/after prose. Works on call trees, file trees, component trees, and pseudocode:

```diff
 submitForm
   createSession
     persistPrompt
+    expandSkillMention
     launchAgent
-  navigateToSession
+  navigateToSession
+    subscribeToEvents
```

```diff
 src/
 ├── commands/
+│   └── show-me.ts       # expands the slash command
 ├── sessions/
-└── transport.ts
+└── transport/
+    ├── client.ts
+    └── stream.ts
```

Layered pipeline diagram — a whole-system panorama where a payload flows through distinct layers. One double-lined box per layer, stacked vertically with `│ ▼` marking the flow between boxes. Box anatomy: header = number + layer name + one-line mechanism summary in parentheses; body = tree entries (`├─` `└─`) with short annotations; bottom = **invariant line** — an equation/constraint that must always hold in that layer, which is the essence of this form (mark it when one exists). Optional: a `┄┄` separated trailing section for cross-cutting concerns (e.g. observability) that span every layer:

```text
╔════════════════════════════════════╗
║ ① 入口 · 命令流（参数→执行计划）    ║
╠════════════════════════════════════╣
║   ├─ create   首发，锚点=第一支     ║
║   └─ update   增量，锚点=现存∪新增  ║
║   不变式：建模图 == 资产卡集合      ║
╚════════════════════════════════════╝
                │
                ▼
╔════════════════════════════════════╗
║ ② 产线 · 分批生成（checkpoint 恢复）║
╚════════════════════════════════════╝
```

Use for README top-level panoramas of directories with a real dataflow/pipeline/state machine; a directory without one should use a boundary diagram instead, not a fake stacked-box pipeline (README writing rules: `{NOCODE_PLUGIN_ROOT}/skills/references/readme-writing.md`).

Single-file HTML — for a visual UI, layout, state comparison, or a concept too dense for text forms: write one focused HTML file (diagram, infographic, or short slide deck), use real labels and data, then open it for the user. Boundaries:

- A design baseline's `design.html` is owned by `dev-design`'s render protocol; do not use this form to bypass it.
- HTML is for explanation, not a normative source — the normative fact stays in the document it explains.

## Context boundaries

- In `dev-design` artifacts the **normative diagram source is ASCII** in `design.md` (see the skill's own writing protocol). This vocabulary guides *which* form to draw; it does not replace ASCII with Mermaid in the baseline, and DES ID annotation rules still apply.
- Sequence diagrams may be Mermaid in chat replies and derived HTML; in `design.md` prefer ASCII unless the relationship genuinely cannot be drawn that way.
- Do not show a whole block of code when a sketch carries the point. Show the full block only when most of it is new, when omission would hide ownership or order, or when the reader needs a copyable target shape.
