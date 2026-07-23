import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const sharedReference = "skills/references/design-traceability.md";
const consumers = [
  "skills/dev-design/SKILL.md",
  "skills/dev-design/decision/SKILL.md",
  "skills/dev-design/writing/SKILL.md",
  "skills/dev-plan/SKILL.md",
  "skills/dev-build/SKILL.md",
  "skills/dev-build/references/dev-build-executing.md",
  "skills/dev-build/references/dev-build-subagent.md",
  "skills/dev-verify/SKILL.md",
  "skills/devflow/SKILL.md",
];

test("traceability protocol has one shared schema consumed by every stage", async () => {
  const protocol = await read(sharedReference);

  for (const state of ["required", "verify-only", "deferred", "n/a"]) {
    assert.match(protocol, new RegExp(`\\b${state.replace("-", "\\-")}\\b`));
  }
  for (const heading of [
    "Implementation Item Registry",
    "Design → Task Coverage Matrix",
    "Design → Evidence Matrix",
  ]) {
    assert.match(protocol, new RegExp(heading));
  }

  for (const path of consumers) {
    const content = await read(path);
    assert.match(
      content,
      /\{NOCODE_SKILL_REF\}\/design-traceability\.md/,
      `${path} must consume the shared traceability protocol`,
    );
  }
});

test("Design closes one approved document with a bidirectional registry", async () => {
  const [
    coordinator,
    decision,
    writing,
    review,
    ...templates
  ] = await Promise.all([
    read("skills/dev-design/SKILL.md"),
    read("skills/dev-design/decision/SKILL.md"),
    read("skills/dev-design/writing/SKILL.md"),
    read("skills/dev-design/writing/references/design-doc-review.md"),
    read("skills/dev-design/writing/references/template-feat.md"),
    read("skills/dev-design/writing/references/template-bug.md"),
    read("skills/dev-design/writing/references/template-refactor.md"),
  ]);

  assert.match(coordinator, /Implementation Item Registry/);
  assert.match(coordinator, /frontmatter.*approved/i);
  assert.match(coordinator, /单一.*docPath|单一设计文档/);
  assert.match(decision, /Registry 输入/);
  assert.match(writing, /Registry ↔ 来源章节|双向.*orphan/);
  assert.match(writing, /frontmatter.*approved/i);
  assert.match(review, /规范性.*补充文档|单一.*docPath/);
  assert.match(review, /Registry.*来源章节|来源章节.*Registry/);
  for (const template of templates) {
    assert.match(template, /## 实施设计项清单/);
  }
});

test("Plan rejects required design orphans and preserves all four states", async () => {
  const [plan, taskTemplate, example] = await Promise.all([
    read("skills/dev-plan/SKILL.md"),
    read("skills/dev-plan/references/task-template.md"),
    read("skills/dev-plan/references/examples/example-plan-output.md"),
  ]);

  assert.match(plan, /Design.*status.*approved|frontmatter.*approved/i);
  assert.match(plan, /从.*Registry.*反向遍历|Registry.*左表/);
  assert.match(plan, /required.*orphan|orphan.*required/);
  assert.match(plan, /verify-only/);
  assert.match(plan, /deferred/);
  assert.match(plan, /n\/a/);
  assert.match(taskTemplate, /\*\*designCovers\*\*/);
  assert.match(example, /Design → Task Coverage Matrix/);
});

test("Build reports designCovers and Verify records fresh per-ID evidence", async () => {
  const [build, executing, subagent, verify] = await Promise.all([
    read("skills/dev-build/SKILL.md"),
    read("skills/dev-build/references/dev-build-executing.md"),
    read("skills/dev-build/references/dev-build-subagent.md"),
    read("skills/dev-verify/SKILL.md"),
  ]);

  for (const content of [build, executing, subagent]) {
    assert.match(content, /designCovers/);
  }
  assert.match(build, /required.*Design ID|Design ID.*required/);
  assert.match(verify, /Design → Evidence Matrix/);
  assert.match(verify, /required.*verify-only|verify-only.*required/);
  assert.match(verify, /新鲜证据|fresh evidence/i);
  assert.match(verify, /缺.*证据.*Build|回 Build/);
});

test("nine-log fixture exposes an omitted downstream mapping deterministically", () => {
  const logEvents = [
    "checkpoint.started",
    "checkpoint.loaded",
    "checkpoint.persisted",
    "checkpoint.resumed",
    "checkpoint.skipped",
    "checkpoint.failed",
    "distill.started",
    "distill.completed",
    "distill.failed",
  ];
  const registry = logEvents.map((event, index) => ({
    id: `LOG-${index + 1}`,
    event,
    state: "required",
  }));
  const taskMappings = registry.map(({ id }) => id);
  const findRequiredOrphans = (items, coveredIds) =>
    items
      .filter(({ state }) => state === "required")
      .filter(({ id }) => !coveredIds.includes(id))
      .map(({ id }) => id);

  assert.deepEqual(findRequiredOrphans(registry, taskMappings), []);
  assert.deepEqual(
    findRequiredOrphans(registry, taskMappings.filter((id) => id !== "LOG-6")),
    ["LOG-6"],
  );
});
