import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared traceability separates immutable DEC and DES namespaces from the process Log", async () => {
  const protocol = await read("skills/references/design-traceability.md");

  assert.match(protocol, /DEC-to-DES Traceability Protocol/);
  assert.match(protocol, /DEC-###/);
  assert.match(protocol, /DES-###/);
  assert.match(protocol, /sourceDecisionIds/);
  assert.match(protocol, /ROUND-N.*Event N.*do not receive DEC IDs/s);
  assert.match(protocol, /never deleted, reused, renumbered, or silently redefined/);
  assert.match(protocol, /Every Decision the coverage table marks `required` maps to at least one DES ID/);
  assert.match(protocol, /Every DES ID cites at least one real sourceDecisionId/);
  assert.doesNotMatch(protocol, /designRevision\s*:|designDigest\s*:|sourceAnchor\s*:/);
});

test("Plan Build and Verify consume the same DES scope", async () => {
  const [plan, build, executing, subagent, verify] = await Promise.all([
    read("skills/dev-plan/SKILL.md"),
    read("skills/dev-build/SKILL.md"),
    read("skills/dev-build/references/dev-build-executing.md"),
    read("skills/dev-build/references/dev-build-subagent.md"),
    read("skills/dev-verify/SKILL.md"),
  ]);

  for (const [path, content] of [
    ["Plan", plan],
    ["Build", build],
    ["executing", executing],
    ["subagent", subagent],
    ["Verify", verify],
  ]) assert.match(content, /DES/, path);

  assert.match(plan, /`designCovers` DES IDs/);
  assert.match(plan, /Handoff\.designIds/);
  assert.match(build, /completedDesignCovers/);
  assert.match(build, /must equal that slice's `designCovers`/);
  assert.match(verify, /DES evidence matrix/i);
  assert.match(verify, /fresh evidence/i);
});

test("Handoff is the routing authority and design changes return to the same Log", async () => {
  const [protocol, devflow] = await Promise.all([
    read("skills/references/design-traceability.md"),
    read("skills/devflow/SKILL.md"),
  ]);

  for (const target of ["Debug", "Plan", "Env", "Build", "Verify", "Review", "Land", "dev-design"]) {
    assert.match(devflow, new RegExp(`\\| ${target.replace("-", "\\-")} \\|`));
  }
  assert.match(protocol, /To: .*\bEnv\b/);
  assert.match(protocol, /return the finding to dev-design/i);
  assert.match(protocol, /evidence changes goal, scope, solution, contract, Preserve, acceptance, or DES meaning/i);
  assert.match(devflow, /Event N — stage-transition/);
  assert.match(devflow, /never receives a DEC ID or `designDisposition`/);
});

test("bidirectional coverage detects a missing required source deterministically", () => {
  const decisions = ["DEC-001", "DEC-002", "DEC-003"];
  const design = [
    { id: "DES-001", sourceDecisionIds: ["DEC-001", "DEC-002"] },
    { id: "DES-002", sourceDecisionIds: ["DEC-003"] },
  ];
  const covered = new Set(design.flatMap(({ sourceDecisionIds }) => sourceDecisionIds));
  const missing = decisions.filter((id) => !covered.has(id));
  assert.deepEqual(missing, []);

  const incomplete = design.filter(({ id }) => id !== "DES-002");
  const incompleteCovered = new Set(incomplete.flatMap(({ sourceDecisionIds }) => sourceDecisionIds));
  assert.deepEqual(decisions.filter((id) => !incompleteCovered.has(id)), ["DEC-003"]);
});

test("engineering runtime sources do not revive legacy baseline machinery", async () => {
  const sources = await Promise.all([
    "skills/devflow/SKILL.md",
    "skills/dev-design/SKILL.md",
    "skills/dev-plan/SKILL.md",
    "skills/dev-build/SKILL.md",
    "skills/dev-verify/SKILL.md",
  ].map(read));
  const combined = sources.join("\n");

  assert.doesNotMatch(combined, /designRevision\s*:|designDigest\s*:|sourceAnchor\s*:/);
  assert.doesNotMatch(combined, /## (?:Scenario|Full|Standard|Fix|Mini)|\| (?:Full|Standard|Fix|Mini) \|/);
});
