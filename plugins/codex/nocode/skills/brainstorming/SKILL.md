---
name: brainstorming
description: "Use when the user asks to brainstorm, broaden ideas, explore possibilities, or when a request h…"
---

# Brainstorming

Broaden the user's thinking without turning exploration into a mandatory delivery workflow.
This Skill generates useful directions, connections, and trade-offs; it does not require a design document.

## Choose the depth

- Explicit brainstorming request: explore broadly.
- Proactive use for a multi-direction request: keep the exploration compact and relevant to the decision.
- Straightforward request with no meaningful alternatives: do not invoke this Skill.

## Explore

1. Restate the underlying goal in one sentence.
2. Use existing context and constraints. Ask at most one clarifying question only when proceeding would
   otherwise produce generic ideas.
3. Generate 3-5 genuinely different directions. Include:
   - the most direct option;
   - one adjacent option that changes the framing;
   - one bolder or counter-intuitive option when it is useful.
4. For each direction, state its central idea, upside, trade-off, and the condition under which it wins.
5. Look for combinations between directions instead of treating every option as mutually exclusive.
6. Recommend a promising starting point or small experiment, while keeping the other directions visible.

Scale the response to the problem. A small decision may need three short bullets; a broad product or
architecture question may benefit from a compact comparison table.

## Boundaries

- Do not force a spec, design document, commit, worktree, implementation plan, or workflow handoff.
- Do not block implementation merely because more ideas could exist.
- Do not ask a long interview sequence before offering useful possibilities.
- Do not pad the list with cosmetic variations of the same idea.
- Do not present unsupported guesses as facts; label assumptions and unknowns.
- If choosing a direction would materially change scope, cost, risk, or external behavior, let the user
  choose. Otherwise provide a recommendation and continue with the requested task.

The successful outcome is expanded decision space with clear trade-offs, not a completed design artifact.
