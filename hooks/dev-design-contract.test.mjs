import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("dev-design is the only owner of the platform workflow plan", async () => {
  const [coordinator, decision, writing] = await Promise.all([
    read("skills/dev-design/SKILL.md"),
    read("skills/dev-design/decision/SKILL.md"),
    read("skills/dev-design/writing/SKILL.md"),
  ]);

  assert.match(coordinator, /全局 plan 的唯一写入者/);
  assert.doesNotMatch(decision, /使用 `update_plan`/);
  assert.doesNotMatch(writing, /使用 `update_plan`/);
  assert.match(decision, /StagePlan[\s\S]*checkpoints\[\]/);
  assert.match(writing, /StagePlan[\s\S]*checkpoints\[\]/);
});

test("Decision Packet separates schema version, instance revision, and mode", async () => {
  const [coordinator, decision, writing] = await Promise.all([
    read("skills/dev-design/SKILL.md"),
    read("skills/dev-design/decision/SKILL.md"),
    read("skills/dev-design/writing/SKILL.md"),
  ]);

  assert.match(decision, /schemaVersion\s*:\s*1/);
  assert.match(decision, /packetRevision\s*:\s*[1-9]/);
  assert.match(decision, /mode\s*:\s*solution\s*\|\s*research/);
  assert.match(coordinator, /mode:\s*research[\s\S]*writing[\s\S]*跳过/);
  assert.match(writing, /schemaVersion/);
  assert.match(writing, /packetRevision/);
});

test("all planned user interactions return checkpoints to the coordinator", async () => {
  const [coordinator, decision, writing] = await Promise.all([
    read("skills/dev-design/SKILL.md"),
    read("skills/dev-design/decision/SKILL.md"),
    read("skills/dev-design/writing/SKILL.md"),
  ]);

  assert.match(coordinator, /checkpoint_required/);
  assert.match(coordinator, /StageCheckpoint/);
  assert.match(decision, /checkpoint_required/);
  assert.match(writing, /checkpoint_required/);
  assert.doesNotMatch(decision, /由 decision 阶段自行执行/);
  assert.doesNotMatch(writing, /末尾问「这个结构可以吗/);
});

test("cross-cutting contract represents items and an explicit empty exemption", async () => {
  const [decision, writing, crossCutting, feat, bug, refactor, example] =
    await Promise.all([
      read("skills/dev-design/decision/SKILL.md"),
      read("skills/dev-design/writing/SKILL.md"),
      read("skills/dev-design/writing/references/cross-cutting-design.md"),
      read("skills/dev-design/writing/references/template-feat.md"),
      read("skills/dev-design/writing/references/template-bug.md"),
      read("skills/dev-design/writing/references/template-refactor.md"),
      read("skills/dev-design/writing/references/example-feat-skeleton.md"),
    ]);

  assert.match(decision, /crossCutting\s*\{[\s\S]*items\[\][\s\S]*exemption\?/);
  assert.doesNotMatch(decision, /crossCutting\[\]/);
  assert.match(writing, /crossCutting\.items/);
  assert.match(crossCutting, /providerOrOwner/);
  assert.match(crossCutting, /layerResponsibilities/);
  assert.match(crossCutting, /decisionRefs/);
  for (const template of [feat, bug, refactor]) {
    assert.match(template, /references\/cross-cutting-design\.md/);
  }
  assert.doesNotMatch(bug, /feat 模板 Step 4c/);
  assert.doesNotMatch(refactor, /feat 模板 Step 4c/);
  assert.match(example, /## 实施设计项清单[\s\S]*IDEM-1/);
});

test("review approval is bound to the post-fix document revision", async () => {
  const writing = await read("skills/dev-design/writing/SKILL.md");

  assert.match(writing, /DesignReviewVerdict/);
  assert.match(writing, /reviewedRevision/);
  assert.match(writing, /blockingOpenQuestions/);
  assert.match(writing, /Delta Verification/);
  assert.match(writing, /正文发生任何修订[\s\S]*不得沿用旧 verdict/);
});

test("traceability binds all downstream evidence to a stable design baseline", async () => {
  const [protocol, plan, build, verify] = await Promise.all([
    read("skills/references/design-traceability.md"),
    read("skills/dev-plan/SKILL.md"),
    read("skills/dev-build/SKILL.md"),
    read("skills/dev-verify/SKILL.md"),
  ]);

  for (const content of [protocol, plan, build, verify]) {
    assert.match(content, /designRevision/);
    assert.match(content, /designDigest/);
  }
  assert.match(protocol, /sourceAnchor/);
  assert.match(protocol, /规范性内容变更[\s\S]*下游.*失效/);
});

test("render delegates to open-design and persists a non-normative receipt", async () => {
  const [coordinator, render] = await Promise.all([
    read("skills/dev-design/SKILL.md"),
    read("skills/references/doc-render.md"),
  ]);

  assert.match(render, /\$open-design|Skill\(nocode:open-design\)/);
  for (const field of [
    "projectId",
    "conversationId",
    "runId",
    "previewUrl",
    "entryFile",
    "sourceDigest",
    "receiptPath",
  ]) {
    assert.match(render, new RegExp(field));
  }
  assert.match(render, /非规范性元数据/);
  assert.doesNotMatch(coordinator, /create_project|start_run|get_run|get_artifact/);
});

test("DDD guidance treats service boundaries as signals and permits multiple aggregates", async () => {
  const [principles, ddd] = await Promise.all([
    read("skills/dev-design/writing/references/writing-principles.md"),
    read("skills/dev-design/writing/references/ddd-modeling.md"),
  ]);

  assert.match(principles, /业务能力.*统一语言.*一致性边界/);
  assert.match(ddd, /仓.*服务.*部署单元.*信号/);
  assert.match(ddd, /一个限界上下文可以包含多个聚合/);
  assert.doesNotMatch(ddd, /每个上下文有且仅有明确聚合根/);
});

test("decision evals cover focused depth, replan revision, and cross-cutting placement", async () => {
  const evals = await read("skills/dev-design/decision/evals/evals.json");

  for (const id of [
    "validation-focused-design",
    "validation-replan-revision",
    "validation-cross-cutting-provider-consumer",
    "validation-cross-cutting-exemption",
  ]) {
    assert.match(evals, new RegExp(`"id": "${id}"`));
  }
});
