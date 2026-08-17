# Grilling loop

Shared interview principles for `dev-design`. Plan does not call this file.

Interview until the current phase has a shared understanding. Map the work as a **task tree** whose nodes come in three kinds: **decisions** (a choice other choices hang off), **terms** (a noun the user's wording introduces that will land in a DEC — closed only when its meaning, test, and boundary are explicit), and **assumptions** (a claim the plan silently depends on). The tree grows from this request, the user's own wording, and already-confirmed DEC IDs. Do not walk `feat` / `bug` / `refactor` question numbers to choose the next question.

## One question

Work the tree one node at a time. The next question is the earliest unclosed node whose prerequisites are closed. If several are ready, pick the one that can invalidate the most downstream work. A term node stays open while the word has two live readings — ask it as "When you say <word>, do you mean A or B?" with your recommended reading attached; the user's wording is the densest source of ambiguity, so treat every new noun from the user as a node, never as defined vocabulary.

Each question includes a committable recommended answer and the reason. Do not ask the user to “confirm” a blank. Do not ask two decisions in one turn.

## Facts versus decisions

Finding facts is the agent’s job. Never ask the user for something the environment can prove.

- **Feat 产品:** do not read implementation to learn what the system already does. If the relevant subsystem cannot be named, ask one locating question, then continue the interview.
- **Bug 问题 / refactor Before:** read only to record current structure, actual, or repro. Do not design 修复 or After here.
- **Lower half** (`开发` / `修复` / `After`): read the current implementation for the active block before proposing how to reach it.

Decisions stay with the user. Persist the waiting ROUND, then ask, then stop the turn.

## Best design

Recommend the best design, not the smallest diff and not the fastest ship. “Compatible” and “quick” may appear only as costs.

If the best design would break an existing public contract or data shape, do not silently compromise. Open a ROUND that contains only that conflict: recommended best design, cost of breaking, cost of yielding. Wait for the answer.

A look-and-feel question that talking cannot settle is ungrillable. Record it under that block’s `问题`. Do not invent an interface to fill it.

## Persist then ask

Before asking, persist a waiting ROUND with 背景, 问题, and 方案; leave 回答 empty. After the answer, write the full decision-bearing reply, update DEC IDs, close the ROUND, then persist the next waiting ROUND before asking again. The calling skill owns the Log file layout.

Do not write the lower half until the user confirms the upper-half outline. Feat 产品 does not read implementation to invent the function tree.

Absorb before advancing. An answer or a mid-interview user message first crosses off the branches it kills, adds the branches it opens, and is checked against confirmed DEC IDs. A conflict reopens the affected DEC through succession instead of being recorded and bypassed. Do not advance on an unintegrated answer.

## Done

The phase is done when its tree is empty, the last three questions opened no new node and surfaced no new weakness, and the type coverage check for that half passes. A tree that empties while questions still find new branches was closed over the question generator, not over the work. Before declaring done, ask once — "What did we assume that we did not write down?" — and turn each answer into a node. A gap reopens the responsible block. The session is not finished until the user confirms the completed `design.md`.
