import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const exists = (path) => existsSync(new URL(path, root));

test("dev-design is one thin public Skill with the confirmed private reference tree", async () => {
  const trunk = await read("skills/dev-design/SKILL.md");
  for (const step of ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"]) {
    assert.match(trunk, new RegExp(step));
  }
  assert.doesNotMatch(trunk, /TaskCreate|TaskUpdate|update_plan|workflow\.plan/);
  assert.doesNotMatch(trunk, /## (?:Scenario|Full|Standard|Fix|Mini)|designRevision\s*:|designDigest\s*:|Registry\s*:/);

  for (const path of [
    "skills/dev-design/references/grilling.md",
    "skills/dev-design/references/writing.md",
    "skills/dev-design/references/handoff.md",
    "skills/dev-design/references/render.md",
    ...["bug", "feat", "refactor"].flatMap((type) =>
      ["questions", "closure", "document"].map(
        (name) => `skills/dev-design/references/${type}/${name}.md`,
      ),
    ),
  ]) {
    assert.equal(exists(path), true, path);
  }
  assert.equal(exists("skills/dev-design/decision/SKILL.md"), false);
  assert.equal(exists("skills/dev-design/writing/SKILL.md"), false);
  assert.equal(exists("skills/dev-define/SKILL.md"), false);
});

test("grilling persists one complete round before advancing", async () => {
  const [trunk, grilling] = await Promise.all([
    read("skills/dev-design/SKILL.md"),
    read("skills/dev-design/references/grilling.md"),
  ]);

  for (const section of [
    "Header",
    "Decisions",
    "Decision Tree",
    "Terms",
    "Handoff",
    "# Log",
  ]) assert.match(grilling, new RegExp(section));

  for (const part of [
    "Background / Evidence",
    "Question",
    "Agent Recommendation \\+ Reason",
    "User Answer",
    "Decision Changes",
    "Term Changes",
    "Flow Impact",
    "Next Node",
  ]) assert.match(grilling, new RegExp(part));

  assert.match(grilling, /persist Background, one Question, and a concrete Recommendation[\s\S]*waiting/);
  assert.match(grilling, /fill every part[\s\S]*mark it `closed`[\s\S]*ask the next question/);
  assert.match(trunk, /Persist a waiting Round with one question/);
  assert.match(grilling, /At most one node is active/);
});

test("grilling separates formed Decisions from lossless per-round process", async () => {
  const grilling = await read("skills/dev-design/references/grilling.md");

  assert.match(grilling, /## DEC-001/);
  assert.match(grilling, /### Body/);
  assert.match(grilling, /### 正文/);
  assert.match(grilling, /`DEC-###` is the current semantic result/);
  assert.match(grilling, /`Round N` is the chronological decision process/);
  assert.match(grilling, /Do not reduce `User Answer` to “用户已确认”/);
  assert.match(grilling, /`sourceEntries` names the Round \/ Event entries[\s\S]*`evidence` binds each material claim/);
  assert.match(grilling, /four asset cards[\s\S]*complete writing rule[\s\S]*every approved card/);
  assert.match(grilling, /accepted, changed, superseded, or consumed independently[\s\S]*One Round may form several Decisions/);
  assert.match(grilling, /same DEC ID[\s\S]*without changing its meaning/);
  assert.match(grilling, /Missing decision content keeps the Round `waiting`/);
  assert.match(grilling, /Event itself never receives `designDisposition` and never maps to a DES ID/);
});

test("bug feat and refactor have distinct dynamic decision trees with benchmarks", async () => {
  const [bug, feat, refactor] = await Promise.all([
    read("skills/dev-design/references/bug/questions.md"),
    read("skills/dev-design/references/feat/questions.md"),
    read("skills/dev-design/references/refactor/questions.md"),
  ]);

  assert.match(bug, /Problem pass[\s\S]*Repair pass/);
  assert.match(bug, /Handoff to Debug/);
  assert.match(feat, /F0[\s\S]*F14/);
  assert.match(refactor, /R0[\s\S]*R13/);
  assert.match(bug, /Benchmark and precedent/i);
  assert.match(feat, /Competitor and comparable solutions/i);
  assert.match(refactor, /Comparable architecture and migration precedents/i);
  assert.match(refactor, /code smell|inelegance|awkward|ugly/i);
  assert.match(refactor, /stopping condition/i);
});

test("design writing uses DEC to DES coverage and normative ASCII diagrams", async () => {
  const [writing, bug, feat, refactor] = await Promise.all([
    read("skills/dev-design/references/writing.md"),
    read("skills/dev-design/references/bug/document.md"),
    read("skills/dev-design/references/feat/document.md"),
    read("skills/dev-design/references/refactor/document.md"),
  ]);

  assert.match(writing, /Decisions are the current semantic source[\s\S]*Log is the chronological source/);
  assert.match(writing, /design\.md.*normative downstream baseline/);
  assert.match(writing, /DES-001/);
  assert.match(writing, /sourceDecisionIds/);
  assert.match(writing, /Every Decision.*designDisposition: required[\s\S]*DES ID/);
  assert.match(writing, /normative diagram source is ASCII/);
  for (const content of [bug, feat, refactor]) {
    assert.match(content, /Opening panorama/);
    assert.match(content, /ASCII|```text/);
  }
});

test("every design type includes verified interface implementation and impacted files", async () => {
  const [writing, feat, bug, refactor] = await Promise.all([
    read("skills/dev-design/references/writing.md"),
    read("skills/dev-design/references/feat/document.md"),
    read("skills/dev-design/references/bug/document.md"),
    read("skills/dev-design/references/refactor/document.md"),
  ]);

  assert.match(writing, /Every design baseline must identify the implementation surface at repository-verifiable depth/);
  assert.match(writing, /external API \/ command \/ event[\s\S]*internal entry point/);
  assert.match(writing, /Do not invent a path, symbol, signature, or schema[\s\S]*investigation DES/);
  assert.match(writing, /repository-relative tree[\s\S]*NEW \/ MODIFY \/ DELETE \/ PRESERVE[\s\S]*numbered change points/);
  assert.match(writing, /realization views[\s\S]*Joint DES set[\s\S]*Integrated proof/);
  assert.match(writing, /presentation and reasoning boundary, not a third identity namespace/);
  assert.match(writing, /DES collaboration[\s\S]*Requires from sibling DES[\s\S]*Provides to sibling DES/);
  assert.match(writing, /consolidated impacted-files index[\s\S]*exposes collisions/);
  assert.match(writing, /Current signature:[\s\S]*Target signature:[\s\S]*Implementation flow:/);
  assert.match(writing, /Defined at:[\s\S]*Input:[\s\S]*Output:[\s\S]*Errors:[\s\S]*Guards:/);
  assert.match(writing, /Unresolved implementation surface[\s\S]*Search \/ proof stop condition/);
  assert.match(writing, /existing-file\.ext[\s\S]*new-file\.ext[\s\S]*obsolete-file\.ext[\s\S]*invariant-file\.ext/);
  for (const content of [feat, bug, refactor]) {
    assert.match(content, /realization views/i);
    assert.match(content, /verified interfaces/);
    assert.match(content, /impacted files/i);
    assert.match(content, /Consolidated impacted-files index/);
    assert.match(content, /DES IDs/);
  }
});

test("confirmation and rendering add no second design baseline", async () => {
  const [handoff, render] = await Promise.all([
    read("skills/dev-design/references/handoff.md"),
    read("skills/dev-design/references/render.md"),
  ]);

  assert.match(handoff, /One explicit user confirmation/);
  assert.match(handoff, /ConfirmedBy: Round N/);
  assert.doesNotMatch(handoff, /^kind: design-confirmation$/m);
  for (const field of ["From:", "To:", "ConfirmedBy:", "Reason:", "Read:", "Preserve:", "Open:"]) {
    assert.match(handoff, new RegExp(field));
  }
  assert.match(render, /only when the user explicitly requests rendering/i);
  assert.match(render, /\$open-design|Skill\(nocode:open-design\)/);
  assert.match(render, /design\.html/);
  assert.match(render, /load online CSS, fonts, scripts/);
  assert.match(render, /Mermaid/i);
  assert.doesNotMatch(`${handoff}\n${render}`, /sourceDigest\s*:|receiptPath\s*:|designRevision\s*:|designDigest\s*:|manifest\s*:/);
});
