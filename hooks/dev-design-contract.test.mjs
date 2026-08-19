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
    "skills/grill-me/SKILL.md",
    "skills/show-me/SKILL.md",
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
  assert.equal(exists("skills/grilling/SKILL.md"), false);
  assert.equal(exists("skills/references/grilling-loop.md"), false);
  assert.equal(exists("skills/dev-design/decision/SKILL.md"), false);
  assert.equal(exists("skills/dev-design/writing/SKILL.md"), false);
  assert.equal(exists("skills/dev-define/SKILL.md"), false);
});

test("grilling persists one complete ROUND before advancing", async () => {
  const [trunk, grilling, upstream, writing] = await Promise.all([
    read("skills/dev-design/SKILL.md"),
    read("skills/dev-design/references/grilling.md"),
    read("skills/grill-me/SKILL.md"),
    read("skills/dev-design/references/writing.md"),
  ]);

  for (const section of ["Header", "Decisions", "# ROUND", "Handoff"]) {
    assert.match(grilling, new RegExp(section));
  }
  assert.doesNotMatch(grilling, /# Decision Tree|# Terms/);

  for (const part of ["### 背景", "### 问题", "### 方案", "### 过程"]) {
    assert.match(grilling, new RegExp(part));
  }

  assert.match(grilling, /Persist 背景, 问题, and a concrete 方案[\s\S]*waiting/);
  assert.match(grilling, /mark the ROUND `closed`[\s\S]*ask the next question/);
  assert.match(trunk, /Persist a waiting ROUND with one question/);
  assert.match(grilling, /At most one block is active/);
  assert.match(trunk, /do not write the lower half before the upper half is confirmed/i);
  assert.match(trunk, /Feat 产品 does not read implementation/);
  assert.match(trunk, /persist a new waiting ROUND, ask that one question, and stop the turn/);

  // interview method is delegated to the upstream skill, not a local copy
  assert.match(trunk, /Skill\(nocode:grill-me\)/);
  assert.match(grilling, /Skill\(nocode:grill-me\)/);
  assert.match(upstream, /frontier/);
  assert.match(upstream, /Finding _facts_ is your job, never the user's/);
  // visual vocabulary is delegated to the upstream show-me skill
  assert.match(writing, /Skill\(nocode:show-me\)/);
  assert.doesNotMatch(writing, /visual-forms/);

  const plan = await read("skills/dev-plan/SKILL.md");
  assert.doesNotMatch(plan, /grilling-loop/);
});

test("grilling separates formed Decisions from lossless per-ROUND process", async () => {
  const grilling = await read("skills/dev-design/references/grilling.md");

  assert.match(grilling, /## DEC-001/);
  assert.match(grilling, /- 描述:/);
  assert.match(grilling, /- 内容:/);
  assert.match(grilling, /- 过程:/);
  assert.match(grilling, /- 引用:/);
  assert.match(grilling, /`DEC-###` is the current semantic result/);
  assert.match(grilling, /`ROUND-###` is the chronological decision process/);
  assert.match(grilling, /Do not reduce `过程` to “用户已确认”/);
  assert.match(grilling, /DEC\.`过程`.*cross-round lifecycle/);
  assert.match(grilling, /lossless/);
  assert.match(grilling, /open thread/);
  assert.match(grilling, /DECs derive from ROUNDs/);
  assert.match(grilling, /One ROUND may form several Decisions/);
  assert.match(grilling, /Missing decision content keeps the ROUND `waiting`/);
  assert.match(grilling, /Event itself never receives `designDisposition` and never maps to a DES ID/);
});

test("bug feat and refactor have distinct coverage halves not question scripts", async () => {
  const [bug, feat, refactor, trunk] = await Promise.all([
    read("skills/dev-design/references/bug/questions.md"),
    read("skills/dev-design/references/feat/questions.md"),
    read("skills/dev-design/references/refactor/questions.md"),
    read("skills/dev-design/SKILL.md"),
  ]);

  assert.match(bug, /## 问题[\s\S]*## 修复/);
  assert.match(bug, /Handoff target is Debug|Debug has investigation/);
  assert.match(feat, /## 产品[\s\S]*## 开发/);
  assert.match(refactor, /## Before[\s\S]*## After/);
  assert.match(bug, /precedent|内部数据|internal-data|unavailable/i);
  assert.match(feat, /Competitor insight/i);
  assert.match(refactor, /stopping condition/i);
  assert.match(refactor, /elegance|不优雅|taste/i);
  for (const content of [bug, feat, refactor]) {
    assert.match(content, /does not generate the next question/i);
  }
  assert.match(trunk, /never as the next-question script/);
  assert.doesNotMatch(trunk, /Select the earliest unclosed node whose dependencies are closed/);
});

test("design writing uses DEC to DES coverage and normative ASCII diagrams", async () => {
  const [writing, bug, feat, refactor] = await Promise.all([
    read("skills/dev-design/references/writing.md"),
    read("skills/dev-design/references/bug/document.md"),
    read("skills/dev-design/references/feat/document.md"),
    read("skills/dev-design/references/refactor/document.md"),
  ]);

  assert.match(writing, /Decisions are the current semantic source[\s\S]*ROUND entries are the chronological source/);
  assert.match(writing, /design\.md.*normative downstream baseline/);
  assert.match(writing, /DES-001/);
  assert.match(writing, /sourceDecisionIds/);
  assert.match(writing, /Every Decision the coverage table marks `required`[\s\S]*DES ID/);
  assert.match(writing, /normative diagram source is ASCII/);
  for (const content of [bug, feat, refactor]) {
    assert.match(content, /Opening panorama/);
    assert.match(content, /ASCII|```text/);
  }
});

test("every design type uses function groups, block trio, and closing overview", async () => {
  const [writing, feat, bug, refactor] = await Promise.all([
    read("skills/dev-design/references/writing.md"),
    read("skills/dev-design/references/feat/document.md"),
    read("skills/dev-design/references/bug/document.md"),
    read("skills/dev-design/references/refactor/document.md"),
  ]);

  assert.match(writing, /Every design baseline must identify the implementation surface at repository-verifiable depth/);
  assert.match(writing, /external API \/ command \/ event[\s\S]*internal entry point/);
  assert.match(writing, /Do not invent a path, symbol, signature, or schema[\s\S]*investigation DES/);
  assert.match(writing, /block must contain 接口, 伪代码, and 影响文件/);
  assert.match(writing, /not a third identity namespace/);
  assert.match(writing, /block tree, group consolidation, repository-wide closing tree/);
  assert.match(writing, /repository-relative ASCII tree[\s\S]*NEW \/ MODIFY \/ DELETE \/ PRESERVE[\s\S]*numbered change points/);
  assert.match(writing, /collisions surface here/);
  assert.match(writing, /## Closing overview[\s\S]*`# 总览`[\s\S]*`## 架构`[\s\S]*`## 文件`/);
  assert.match(writing, /language tag \(`ts` \/ `tsx` \/ `text`\)/);
  assert.match(writing, /Current signature:[\s\S]*Target signature:[\s\S]*Implementation flow:/);
  assert.match(writing, /Defined at:[\s\S]*Input:[\s\S]*Output:[\s\S]*Errors:[\s\S]*Guards:/);
  assert.match(writing, /Unresolved implementation surface[\s\S]*Search \/ proof stop condition/);
  assert.match(writing, /existing-file\.ext[\s\S]*new-file\.ext[\s\S]*obsolete-file\.ext[\s\S]*invariant-file\.ext/);
  for (const content of [feat, bug, refactor]) {
    assert.match(content, /背景/);
    assert.match(content, /目标/);
    assert.match(content, /接口/);
    assert.match(content, /伪代码/);
    assert.match(content, /问题/);
    assert.match(content, /影响文件汇总/);
    assert.match(content, /Closing overview/);
    assert.match(content, /DES IDs/);
  }
  assert.match(feat, /Function groups/);
  assert.match(bug, /Per-mechanism groups/);
  assert.match(refactor, /Per-group sections/);
});

test("confirmation and rendering add no second design baseline", async () => {
  const [handoff, render] = await Promise.all([
    read("skills/dev-design/references/handoff.md"),
    read("skills/dev-design/references/render.md"),
  ]);

  assert.match(handoff, /One explicit user confirmation/);
  assert.match(handoff, /ConfirmedBy: ROUND-N/);
  assert.doesNotMatch(handoff, /^kind: design-confirmation$/m);
  for (const field of ["From:", "To:", "ConfirmedBy:", "Reason:", "Read:", "Preserve:", "Open:"]) {
    assert.match(handoff, new RegExp(field));
  }
  assert.match(handoff, /Bug repair baseline -> Env/);
  assert.doesNotMatch(handoff, /Bug repair baseline -> Build/);
  assert.match(render, /only when the user explicitly requests rendering/i);
  assert.match(render, /\$open-design|Skill\(nocode:open-design\)/);
  assert.match(render, /design\.html/);
  assert.match(render, /load online CSS, fonts, scripts/);
  assert.match(render, /Mermaid/i);
  assert.doesNotMatch(`${handoff}\n${render}`, /sourceDigest\s*:|receiptPath\s*:|designRevision\s*:|designDigest\s*:|manifest\s*:/);
});
