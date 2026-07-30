import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("dev-design is the only owner of the platform workflow plan", async () => {
  const [coordinator, decision, writing, render] = await Promise.all([
    read("skills/dev-design/SKILL.md"),
    read("skills/dev-design/decision/SKILL.md"),
    read("skills/dev-design/writing/SKILL.md"),
    read("skills/references/doc-render.md"),
  ]);

  assert.match(coordinator, /全局 plan 的唯一写入者/);
  for (const stage of [decision, writing, render]) {
    assert.doesNotMatch(stage, /TaskCreate|TaskUpdate|update_plan/);
    assert.doesNotMatch(stage, /StagePlan/);
  }
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

test("dev-design uses ordinary conversational pauses instead of a checkpoint runtime", async () => {
  const [coordinator, decision, writing] = await Promise.all([
    read("skills/dev-design/SKILL.md"),
    read("skills/dev-design/decision/SKILL.md"),
    read("skills/dev-design/writing/SKILL.md"),
  ]);

  assert.match(coordinator, /单一会话流程/);
  assert.match(coordinator, /普通会话暂停/);
  assert.match(coordinator, /全局计划[\s\S]*设计文档[\s\S]*继续/);

  for (const source of [coordinator, decision, writing]) {
    assert.doesNotMatch(
      source,
      /StageCheckpoint|checkpoint_required|needs_user_input|resumeState|dedupeKey/,
    );
  }

  for (const gate of [
    "packet-review",
    "structure-review",
    "finding-triage",
    "render-choice",
    "risk-acceptance",
    "final-gate",
  ]) {
    assert.match(coordinator, new RegExp(gate));
  }
  assert.match(decision, /展示完整 Packet[\s\S]*结束当前回合等待用户答复/);
  assert.match(writing, /展示完整结构骨架[\s\S]*结束当前回合等待用户答复/);
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

test("technical design render explains the design to humans with development diagrams", async () => {
  const [coordinator, render] = await Promise.all([
    read("skills/dev-design/SKILL.md"),
    read("skills/references/doc-render.md"),
  ]);

  assert.match(coordinator, /documentType:\s*technical-design/);
  assert.match(coordinator, /audience:\s*human/);
  assert.match(coordinator, /不是.*Agent prompt/);
  for (const diagram of ["流程图", "架构图", "时序图", "状态图"]) {
    assert.match(coordinator, new RegExp(diagram));
    assert.match(render, new RegExp(diagram));
  }
  assert.match(coordinator, /一屏摘要[\s\S]*端到端主流程[\s\S]*系统边界[\s\S]*关键场景/);
  assert.match(render, /humanReadabilityChecked/);
  assert.match(render, /missingDiagrams/);
  assert.match(render, /图表缺失[\s\S]*render 失败/);
});

test("shared render creates three cards in parallel conversations under one project", async () => {
  const [coordinator, render, openDesign] = await Promise.all([
    read("skills/dev-design/SKILL.md"),
    read("skills/references/doc-render.md"),
    read("skills/open-design/SKILL.md"),
  ]);

  assert.match(render, /技术设计、PRD、RFC、ADR 与研究报告[\s\S]*所有文档类型/);
  assert.match(render, /variantCount:\s*3[\s\S]*projectCount:\s*1[\s\S]*conversationCount:\s*3[\s\S]*dispatch:\s*parallel/);
  assert.match(render, /只创建一个 project[\s\S]*conversation 映射为 `card-a`/);
  assert.match(render, /三个 run 全部异步启动[\s\S]*不得等待 A 完成/);
  assert.match(render, /variants\/card-a\/[\s\S]*variants\/card-b\/[\s\S]*variants\/card-c\//);
  assert.match(render, /status:\s*pending[\s\S]*selectedVariantId:\s*null/);
  assert.match(coordinator, /一个 Open Design project[\s\S]*A \/ B \/ C 三个 conversation 并行生成/);
  assert.doesNotMatch(coordinator, /variantSet:/);
  assert.match(coordinator, /不能只换颜色、字体或标题/);
  assert.match(openDesign, /conversation new "\$PROJECT_ID"/);
  assert.match(openDesign, /CONVERSATION_A_ID="\$CONVERSATION_ID"/);
  assert.match(openDesign, /Do not create or duplicate three projects/);

  const conversationBlock = openDesign.match(/CONVERSATION_A_ID=[\s\S]*?```/);
  assert.ok(conversationBlock);
  assert.equal((conversationBlock[0].match(/conversation new/g) ?? []).length, 2);

  const parallelRunBlock = openDesign.match(/Start all three runs without `--follow`[\s\S]*?```bash([\s\S]*?)```/);
  assert.ok(parallelRunBlock);
  assert.equal((parallelRunBlock[1].match(/run start/g) ?? []).length, 3);
  assert.doesNotMatch(parallelRunBlock[1], /--follow/);
  assert.match(openDesign, /only then begin watching or waiting/);
  assert.match(openDesign, /exclusive output root/);
  assert.match(render, /未选择不是 render 失败/);
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
