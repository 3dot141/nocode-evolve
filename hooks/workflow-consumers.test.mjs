import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('codex-review is a provider-neutral independent-review contract', () => {
  const source = read('rules/rule-codex-review.md');
  assert.match(source, /Capability\(workflow\.execute, \{"tasks":\[\{"id":"independent-review"/);
  assert.match(source, /"profile":"review\.cross-model-preferred"/);
  assert.match(source, /"writeScope":"none"/);
  assert.match(source, /Capability\(workflow\.wait,/);
  assert.match(source, /Capability\(workflow\.collect,/);
  for (const mode of ['cross-model', 'isolated-same-model', 'inline-self-review']) {
    assert.match(source, new RegExp(`\\b${mode}\\b`));
  }
  assert.doesNotMatch(source, /\b(?:Agent|Bash)\s*\(/);
  assert.doesNotMatch(source, /\$\{(?:CLAUDE|CODEX)_PLUGIN_ROOT\}/);
});

test('every workflow execution consumer waits through running and collects terminal results', () => {
  for (const file of [
    'model/agent-about.md', 'rules/rule-codex-review.md',
    'skills/dev-build/SKILL.md', 'skills/dev-define/SKILL.md',
    'skills/dev-plan/SKILL.md', 'skills/dispatching-parallel-agents/SKILL.md',
    'skills/research-workflow/SKILL.md',
  ]) {
    const source = read(file);
    assert.match(source, /Capability\(workflow\.wait, \{"executionId":"<execution-id>","timeoutMs":/, file);
    assert.match(source, /status=running.*workflow\.wait|workflow\.wait.*status=running/s, file);
    assert.match(source, /Capability\(workflow\.collect, \{"executionId":"<execution-id>"\}\)/, file);
    assert.match(source, /tasks\[\]\.result|tasks\[<task-id>\]\.result|tasks\[0\]\.result/, file);
  }
});

test('research workflow passes collected evidence explicitly between execution rounds', () => {
  const source = read('skills/research-workflow/SKILL.md');
  assert.match(source, /不得让同一 graph 的下游 task 猜测前序 resultRef/);
  assert.match(source, /<collected-search-results>/);
  assert.match(source, /tasks\[\]\.result/);
  assert.match(source, /Scope.*Search.*Evaluate.*Refine.*Extract.*Verify.*Synthesize/s);
  assert.match(source, /三票|3 票/);
  assert.doesNotMatch(source, /综合所有搜索 task 的 resultRef/);
  assert.doesNotMatch(source, /代码层的循环/);
});

test('dev-build dispatches one plan task at a time and preserves review/fix gates', () => {
  const source = read('skills/dev-build/SKILL.md');
  assert.match(source, /每次 graph 只含当前一个 plan task/);
  assert.match(source, /<plan-task-id>-spec-review/);
  assert.match(source, /approved=false.*修复.*重新.*review/s);
  assert.match(source, /前一个 task.*Gate.*下一 task/s);
  assert.match(source, /不得把所有 plan task.*同一.*graph/s);
});

test('parallel dispatch example embeds concrete failures and constraints in each cold-start objective', () => {
  const source = read('skills/dispatching-parallel-agents/SKILL.md');
  for (const detail of [
    'partial output capture', 'fast tool aborted instead of completed', 'expects 3 results but gets 0',
  ]) assert.match(source, new RegExp(detail));
  assert.match(source, /objective":"Fix agent-tool-abort[^\n]*partial output capture/);
  assert.match(source, /objective":"Fix batch-completion[^\n]*fast tool aborted instead of completed/);
  assert.match(source, /objective":"Fix tool-approval[^\n]*expects 3 results but gets 0/);
});

test('workflow consumers never dispatch an empty task graph', () => {
  for (const file of [
    'model/agent-about.md', 'rules/rule-codex-review.md',
    'skills/dev-build/SKILL.md', 'skills/dev-define/SKILL.md',
    'skills/dev-plan/SKILL.md', 'skills/dispatching-parallel-agents/SKILL.md',
    'skills/research-workflow/SKILL.md',
  ]) {
    assert.doesNotMatch(read(file), /Capability\(workflow\.execute, \{"tasks":\[\]/, file);
  }
});

test('worktree consumers use explicit create and absolute enter contracts', () => {
  for (const file of ['rules/rule-git-worktree.md', 'skills/using-git-worktrees/SKILL.md']) {
    const source = read(file);
    assert.match(source, /Capability\(workspace\.worktree\.create,/);
    assert.match(source, /Capability\(workspace\.worktree\.enter, \{"path":"<absolute-/);
    assert.doesNotMatch(source, /Capability\(workspace\.worktree\.enter, \{"path":"\."\}/);
  }
});

test('multi-step coordinators create and update stable plan snapshots', () => {
  for (const file of [
    'skills/dev-build/SKILL.md', 'skills/dev-define/SKILL.md', 'skills/dev-design/SKILL.md',
    'skills/dev-design/decision/SKILL.md', 'skills/dev-design/writing/SKILL.md',
    'skills/dev-plan/SKILL.md', 'skills/dev-review/SKILL.md', 'skills/dev-verify/SKILL.md',
    'skills/pd-ix/SKILL.md', 'skills/pd-prd/SKILL.md', 'skills/pd-research/SKILL.md',
    'skills/pd-vd/SKILL.md', 'skills/pdflow/SKILL.md',
  ]) {
    const source = read(file);
    assert.match(source, /Capability\(workflow\.plan\.create, \{"items":\[\{"id":/, file);
    assert.match(source, /Capability\(workflow\.plan\.update, \{"planRef":/, file);
    assert.doesNotMatch(source, /"items":\[\]/, file);
  }
});

test('devflow full snapshot updates do not require a handoff marker', () => {
  const source = read('skills/devflow/SKILL.md');
  assert.match(source, /workflow\.plan\.update[^\n]*"status":"pending"/);
  assert.doesNotMatch(source, /"handoff":"<preserve-final-item-handoff; otherwise omit>"/);
  assert.doesNotMatch(source, /handoff.*保留|保留.*handoff/s);
});

test('skill handoffs use a self-contained context envelope instead of an ambient-context placeholder', () => {
  for (const file of [
    'model/agent-about.md', 'rules/rule-superpowers-brainstorming.md',
    'skills/dev-build/SKILL.md', 'skills/dev-review/SKILL.md', 'skills/reviewing/SKILL.md',
    'skills/pdflow/SKILL.md', 'commands/distill.md', 'commands/nocodehub.md',
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /"input":"<current command arguments and stage context>"/, file);
    if (source.includes('Capability(workflow.skill.invoke')) {
      assert.match(source, /"request":"<verbatim-current-request-or-command-arguments>"/, file);
      assert.match(source, /"artifacts":\["<[^">]+>"\]/, file);
      assert.match(source, /"planRef":"<current-planRef-or-omit>"/, file);
    }
  }
});

test('skill invocation payloads carry the business fields claimed by their callers', () => {
  const distill = read('commands/distill.md');
  for (const field of [
    '"disposition":"<create|merge|skip>"', '"target_layer":"<wiki/pages|wiki/draft>"',
    '"slug":"<rule-slug>"', '"section_type":"<agents-section-type>"',
    '"target_dir":"<project-relative-target-directory>"', '"target_file":"<agents|readme|both>"',
    '"target":"<rule-or-skill-path>"', '"description":"<routing-description>"',
  ]) assert.match(distill, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  for (const file of [
    'skills/reviewing/SKILL.md', 'skills/dev-review/SKILL.md',
    'skills/dev-define/SKILL.md', 'skills/dev-design/writing/SKILL.md',
    'skills/pd-prd/SKILL.md', 'skills/pd-vd/SKILL.md',
    'skills/brainstorming/SKILL.md', 'skills/red-blue-deep/SKILL.md',
    'rules/rule-superpowers-brainstorming.md',
  ]) {
    const source = read(file);
    assert.match(source, /"payload":\{"object":\{"type":/, file);
    assert.match(source, /"dimensions":\[/, file);
    assert.match(source, /"method":/, file);
    assert.match(source, /"contextCapsule":\{"facts":/, file);
    assert.match(source, /"depth":/, file);
    for (const line of source.split('\n').filter((value) => value.includes('"skill":"reviewing"'))) {
      assert.match(line, /"payload":/, `${file}: reviewing call omitted payload`);
    }
  }
});

test('distill caller and targets share one candidates payload contract', () => {
  const caller = read('commands/distill.md');
  const personal = read('commands/personal-distill.md');
  const plugin = read('commands/plugin-distill.md');
  const project = read('commands/project-distill.md');

  assert.match(caller, /"target":"wiki","disposition":"<create\|merge\|supersede\|promote\|skip>"/);
  assert.match(caller, /"target":"rules","disposition":"<create\|merge\|skip>"/);
  assert.match(caller, /"target":"agents","disposition":"<create\|merge\|skip>"/);
  assert.match(caller, /"skill":"plugin-distill"[^\n]+"disposition":"<merge\|create\|skip>"/);
  assert.match(caller, /"skill":"project-distill"[^\n]+"target_file":"<agents\|readme\|both>"/);
  for (const target of [personal, plugin, project]) {
    assert.match(target, /arguments\.payload\.candidates\[\]/);
  }
  assert.match(personal, /disposition ∈ \{create, merge, supersede, promote, skip\}/);
  assert.match(plugin, /disposition ∈ \{create, merge, skip\}/);
  assert.match(project, /target_file\s+agents \| readme \| both/);
});
