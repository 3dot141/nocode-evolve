# On-demand rendering

Read this reference only when the user explicitly requests rendering and current `design.md` exists.

## Primary path

Invoke `nocode:open-design` with the current `design.md` as its only content source. Ask it to produce one human-readable technical-design HTML artifact and export or place it as sibling `design.html`.

Use `/open-design`.

Rendering may improve hierarchy, typography, navigation, diagrams, and interaction. It cannot add, remove, reinterpret, or hide design facts; key DES IDs and their relationships remain visible.

## Artifact rules

- Deliver one local `design.html`; it may load online CSS, fonts, scripts, or other presentation resources.
- Do not require offline operation, dependency pinning, a dependency manifest, a receipt, or a source digest.
- `design.html` is derived and never participates in confirmation or Handoff.
- Do not specify Open Design's HTML, CSS, SVG, or layout implementation.

## Fallback

```text
Open Design produces readable design.html
  yes -> use it
  no  -> create a Mermaid-based derived design.html from the same ASCII relationships
           and report why the primary renderer was unavailable
```

The fallback may reduce visual or interaction quality, but it must preserve DES IDs, nodes, edges, order, failures, and recovery. It must not replace the normative ASCII diagrams in `design.md`.

Existing HTML staleness management is intentionally unspecified. Never treat an old HTML file as the current baseline; re-read `design.md`.
