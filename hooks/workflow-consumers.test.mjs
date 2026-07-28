import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('codex-review uses native isolated reviewers and reports actual independence', () => {
  const source = read('rules/rule-codex-review.md');
  assert.match(source, /<!-- nocode:platform claude -->/);
  assert.match(source, /<!-- nocode:platform codex -->/);
  assert.match(source, /\bAgent\b/);
  assert.match(source, /\bspawn_agent\b/);
  assert.match(source, /\bwait_agent\b/);
  assert.match(source, /同模型隔离审查；不是跨模型/);
  assert.match(source, /主会话自审；不具备独立性/);
  assert.doesNotMatch(source, /Capability\(|"profile"\s*:|fallbackPolicy/);
  assert.doesNotMatch(source, /\$\{(?:CLAUDE|CODEX)_PLUGIN_ROOT\}/);
});

test('research workflow passes terminal evidence explicitly between native agent rounds', () => {
  const source = read('skills/research-workflow/SKILL.md');
  assert.match(source, /每个原生 agent 的终态结果.*显式嵌入下一轮任务/s);
  assert.match(source, /<terminal-search-results>/);
  assert.match(source, /Scope.*Search.*Evaluate.*Refine.*Extract.*Verify.*Synthesize/s);
  assert.match(source, /三票|3 票/);
  assert.match(source, /spawn_agent/);
  assert.match(source, /wait_agent/);
  assert.doesNotMatch(source, /综合所有搜索 task 的 resultRef/);
  assert.doesNotMatch(source, /代码层的循环/);
  assert.doesNotMatch(source, /Capability\(|"profile"\s*:|fallbackPolicy/);
});

test('dev-build dispatches one native agent at a time and preserves review/fix gates', () => {
  const source = read('skills/dev-build/SKILL.md');
  assert.match(source, /每次只派发当前一个 plan task/);
  assert.match(source, /<plan-task-id>-spec-review/);
  assert.match(source, /approved=false.*修复.*重新.*review/s);
  assert.match(source, /前一个 task.*Gate.*下一 task/s);
  assert.match(source, /spawn_agent/);
  assert.match(source, /wait_agent/);
  assert.doesNotMatch(source, /Capability\(|"profile"\s*:|fallbackPolicy/);
});

test('parallel dispatch example embeds concrete failures and constraints in each cold-start objective', () => {
  const source = read('skills/dispatching-parallel-agents/SKILL.md');
  for (const detail of [
    'partial output capture', 'fast tool aborted instead of completed', 'expects 3 results but gets 0',
  ]) assert.match(source, new RegExp(detail));
  assert.match(source, /Fix agent-tool-abort[^\n]*partial output capture/);
  assert.match(source, /Fix batch-completion[^\n]*fast tool aborted instead of completed/);
  assert.match(source, /Fix tool-approval[^\n]*expects 3 results but gets 0/);
  assert.match(source, /spawn_agent/);
  assert.match(source, /wait_agent/);
  assert.doesNotMatch(source, /Capability\(|"profile"\s*:|fallbackPolicy/);
});

test('workflow consumers never dispatch an empty task graph', () => {
  for (const file of [
    'model/agent-about.md',
  ]) {
    assert.doesNotMatch(read(file), /Capability\(workflow\.execute, \{"tasks":\[\]/, file);
  }
});

test('worktree consumers use platform-native create and enter contracts', () => {
  for (const file of ['rules/rule-git-worktree.md', 'skills/using-git-worktrees/SKILL.md']) {
    const source = read(file);
    assert.match(source, /<!-- nocode:platform claude -->/);
    assert.match(source, /<!-- nocode:platform codex -->/);
    assert.match(source, /EnterWorktree/);
    assert.match(source, /git worktree add/);
    assert.match(source, /绝对路径|absolute path/);
    assert.doesNotMatch(source, /Capability\(|"profile"\s*:|fallbackPolicy/);
  }
});

test('using-git-worktrees uses the flat sibling path and rejects legacy containers', () => {
  const source = read('skills/using-git-worktrees/SKILL.md');
  assert.match(source, /<project-parent>\/<project-name>-<branch-flat>/);
  assert.match(source, /branch_flat/);
  assert.doesNotMatch(source, /~\/\.config\/superpowers\/worktrees/);
  assert.doesNotMatch(source, /(?:^|[^\w])\.worktrees\//m);
  assert.doesNotMatch(source, /(?:^|[^\w])worktrees\//m);
});

test('development documents use topic directories under docs/dev', () => {
  const about = read('model/agent-about.md');

  assert.match(about, /docs\/dev\/\{username\}\/\{yymmdd\}-\{serial\}-\{topic\}/);
  assert.equal(existsSync(new URL('../docs/dev/INDEX.md', import.meta.url)), true);
  assert.equal(existsSync(new URL('../docs/plans', import.meta.url)), false);
  assert.equal(existsSync(new URL('../docs/superpowers', import.meta.url)), false);
});

test('global model avoids forced semantic-search agents', () => {
  for (const file of [
    'model/agent-about.md', 'model/agent-personal.md',
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /Capability\(|"profile"\s*:|fallbackPolicy/, file);
  }
  const about = read('model/agent-about.md');
  assert.match(about, /语义搜索默认由当前会话.*代码搜索工具/s);
  assert.match(about, /不得仅因.*语义搜索.*强制派发/s);
});

test('product workflows use native plans, decisions, and direct skill handoffs', () => {
  for (const file of [
    'skills/pd-ix/SKILL.md', 'skills/pd-prd/SKILL.md', 'skills/pd-research/SKILL.md',
    'skills/pd-vd/SKILL.md', 'skills/pdflow/SKILL.md',
  ]) {
    const source = read(file);
    assert.match(source, /<!-- nocode:platform claude -->/, file);
    assert.match(source, /<!-- nocode:platform codex -->/, file);
    assert.match(source, /TaskCreate|AskUserQuestion/, file);
    assert.match(source, /update_plan|request_user_input/, file);
    assert.doesNotMatch(source, /Capability\(|"profile"\s*:|fallbackPolicy/, file);
  }
  assert.match(read('skills/pdflow/SKILL.md'), /Skill\(nocode:pd-research\)/);
  assert.match(read('skills/pdflow/SKILL.md'), /\$pd-research/);
  assert.match(read('skills/pd-vd/SKILL.md'), /create_project/);
  assert.match(read('skills/pd-vd/SKILL.md'), /get_artifact/);
});

test('design and review subflows use native plans and direct Skill calls', () => {
  for (const file of [
    'skills/dev-design/decision/SKILL.md',
    'skills/dev-design/writing/SKILL.md',
    'skills/brainstorming/SKILL.md',
    'skills/reviewing/SKILL.md',
    'skills/red-blue-deep/SKILL.md',
  ]) {
    assert.doesNotMatch(read(file), /Capability\(|"profile"\s*:|fallbackPolicy/, file);
  }
  for (const file of [
    'skills/dev-design/decision/SKILL.md',
    'skills/dev-design/writing/SKILL.md',
  ]) {
    const source = read(file);
    assert.match(source, /TaskCreate/);
    assert.match(source, /TaskUpdate/);
    assert.match(source, /update_plan/);
  }
  assert.match(read('skills/dev-design/writing/SKILL.md'), /Skill\(nocode:reviewing\)/);
  assert.match(read('skills/red-blue-deep/SKILL.md'), /Skill\(nocode:reviewing\)/);
  const reviewing = read('skills/reviewing/SKILL.md');
  for (const field of ['request:', 'context:', 'object:', 'dimensions:', 'method:', 'contextCapsule:', 'depth:']) {
    assert.match(reviewing, new RegExp(field));
  }
});

test('brainstorming broadens options without forcing delivery artifacts', () => {
  const brainstorming = read('skills/brainstorming/SKILL.md');
  assert.match(brainstorming, /multiple materially different plausible directions/);
  assert.match(brainstorming, /Generate 3-5 genuinely different directions/);
  assert.match(brainstorming, /Do not force a spec, design document, commit, worktree, implementation plan, or workflow handoff/);
  assert.doesNotMatch(brainstorming, /HARD-GATE|dev_design_output|Skill\(nocode:|TaskCreate|update_plan/);
  for (const removed of [
    'skills/brainstorming/visual-companion.md',
    'skills/brainstorming/spec-document-reviewer-prompt.md',
    'skills/brainstorming/scripts/server.cjs',
  ]) {
    assert.equal(existsSync(new URL(`../${removed}`, import.meta.url)), false, removed);
  }
});

test('engineering coordinators use native plan and direct Skill handoffs', () => {
  const expectedHandoffs = new Map([
    ['skills/dev-define/SKILL.md', 'using-git-worktrees'],
    ['skills/dev-design/SKILL.md', 'dev-plan'],
    ['skills/dev-build/SKILL.md', 'dev-verify'],
    ['skills/dev-verify/SKILL.md', 'dev-review'],
  ]);
  for (const [file, handoff] of expectedHandoffs) {
    const source = read(file);
    assert.match(source, /<!-- nocode:platform claude -->/, file);
    assert.match(source, /<!-- nocode:platform codex -->/, file);
    assert.match(source, /TaskCreate/, file);
    assert.match(source, /TaskUpdate/, file);
    assert.match(source, /update_plan/, file);
    assert.match(source, new RegExp(`Skill\\(nocode:${handoff}\\)`), file);
    assert.doesNotMatch(
      source,
      /Capability\(workflow\.(?:plan\.(?:create|update)|skill\.invoke|decision\.request)/,
      file,
    );
  }
  for (const file of [
    'skills/dev-define/SKILL.md',
    'skills/dev-design/SKILL.md',
    'skills/dev-verify/SKILL.md',
  ]) {
    assert.doesNotMatch(read(file), /Capability\(|"profile"\s*:|fallbackPolicy/, file);
  }
  const define = read('skills/dev-define/SKILL.md');
  assert.match(define, /Skill\(nocode:reviewing\)/);
  assert.match(define, /7 个 define-review 维度.*context capsule.*independent/s);
});

test('dev-plan uses native plan, decision, search, and Skill handoff instructions', () => {
  const source = read('skills/dev-plan/SKILL.md');
  assert.doesNotMatch(source, /Capability\(|"profile"\s*:|fallbackPolicy/);
  for (const platform of ['claude', 'codex']) {
    assert.match(source, new RegExp(`<!-- nocode:platform ${platform} -->`));
  }
  assert.match(source, /TaskCreate/);
  assert.match(source, /TaskUpdate/);
  assert.match(source, /AskUserQuestion/);
  assert.match(source, /update_plan/);
  assert.match(source, /request_user_input/);
  assert.match(source, /Skill\(nocode:dev-build\)/);
  assert.match(source, /Skill\(nocode:red-blue-deep\)/);
  assert.match(source, /当前会话.*(?:rg|代码搜索工具).*补搜/s);
});

test('remaining workflow coordinators use native control and honest independence', () => {
  for (const file of [
    'skills/dev-land/SKILL.md', 'skills/dev-review/SKILL.md', 'skills/devflow/SKILL.md',
    'skills/skill-writing/SKILL.md', 'skills/larkhub/SKILL.md',
  ]) {
    const source = read(file);
    assert.match(source, /<!-- nocode:platform claude -->/, file);
    assert.match(source, /<!-- nocode:platform codex -->/, file);
    assert.doesNotMatch(source, /Capability\(|"profile"\s*:|fallbackPolicy/, file);
  }
  assert.match(read('skills/devflow/SKILL.md'), /TaskCreate/);
  assert.match(read('skills/devflow/SKILL.md'), /update_plan/);
  assert.match(read('skills/skill-writing/SKILL.md'), /spawn_agent/);
  assert.match(read('skills/skill-writing/SKILL.md'), /wait_agent/);
  assert.match(read('skills/skill-writing/SKILL.md'), /未证明跨模型|不是跨模型/);
  assert.match(read('skills/larkhub/SKILL.md'), /已安装的 `lark-doc`/);
  assert.match(read('skills/larkhub/SKILL.md'), /\$lark-doc/);
});

test('dev-land has one panorama gate and never adds a runtime confirmation', () => {
  const land = read('skills/dev-land/SKILL.md');
  const prflow = read('skills/dev-land/references/prflow.md');
  const prCheck = read('skills/dev-land/references/pr-check.mjs');

  assert.match(land, /用户只确认一次完整全景/);
  assert.match(land, /推不定 → 不提问，进入候选全景/);
  assert.match(land, /发布策略直接进入全景/);
  assert.match(land, /执行失败或出现全景未覆盖的新风险.*不临时追问是否继续/s);
  assert.doesNotMatch(land, /AskUserQuestion|request_user_input|askUser|四选一菜单|全景确认前追问/);

  assert.match(prflow, /执行时才撞 non-fast-forward → 停止并报告，不追加询问/);
  assert.doesNotMatch(prflow, /typed `force`|安全例外/);
  assert.match(land, /pr-check\.mjs --watch/);
  assert.match(prflow, /periodic-runner\.mjs/);
  assert.match(prCheck, /from '\.\/periodic-runner\.mjs'/);
  assert.doesNotMatch(`${land}\n${prflow}`, /CronCreate|CronList|CronDelete/);
});

test('skill handoffs use a self-contained context envelope instead of an ambient-context placeholder', () => {
  for (const file of [
    'model/agent-about.md',
    'skills/dev-build/SKILL.md', 'skills/dev-review/SKILL.md', 'skills/reviewing/SKILL.md',
    'skills/pdflow/SKILL.md', 'commands/distill.md', 'commands/nocodehub.md',
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /"input":"<current command arguments and stage context>"/, file);
    if (/调用 `[^`]+` Skill，传入 `arguments=/.test(source)) {
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

  const prd = read('skills/pd-prd/SKILL.md');
  assert.match(prd, /对象 = PRD.*全部 8 维.*checklist.*Context Capsule.*深度 = auto/s);
  const vd = read('skills/pd-vd/SKILL.md');
  assert.match(vd, /\.ix\.md.*\.vd\.md.*全部 9 个维度.*checklist.*Context Capsule.*full-heavy.*iteration-light/s);
  const devReview = read('skills/dev-review/SKILL.md');
  assert.match(devReview, /代码 diff.*五轴维度.*checklist.*Context Capsule.*independent/s);
});

test('distill caller and targets share one candidates payload contract', () => {
  const caller = read('commands/distill.md');
  const personal = read('commands/personal-distill.md');
  const plugin = read('commands/plugin-distill.md');
  const project = read('commands/project-distill.md');

  assert.match(caller, /"target":"wiki","disposition":"<create\|merge\|supersede\|promote\|skip>"/);
  assert.match(caller, /"target":"rules","disposition":"<create\|merge\|skip>"/);
  assert.match(caller, /"target":"agents","disposition":"<create\|merge\|skip>"/);
  assert.match(caller, /调用 `plugin-distill` Skill[^\n]+"disposition":"<merge\|create\|skip>"/);
  assert.match(caller, /调用 `project-distill` Skill[^\n]+"target_file":"<agents\|readme\|both>"/);
  for (const target of [personal, plugin, project]) {
    assert.match(target, /arguments\.payload\.candidates\[\]/);
  }
  assert.match(personal, /disposition ∈ \{create, merge, supersede, promote, skip\}/);
  assert.match(plugin, /disposition ∈ \{create, merge, skip\}/);
  assert.match(project, /target_file\s+agents \| readme \| both/);
});

test('command and hub entrypoints use native decisions and direct named Skill handoffs', () => {
  for (const file of [
    'commands/distill.md', 'commands/personalhub.md', 'commands/projecthub.md',
    'commands/nocodehub.md', 'commands/plugin-dream.md', 'commands/personal-distill.md',
    'commands/plugin-distill.md', 'commands/personal-dream.md', 'commands/project-dream.md',
    'commands/sow.md', 'commands/eval.md', 'commands/personal-init.md',
    'commands/personal-recall.md',
  ]) {
    const source = read(file);
    assert.match(source, /<!-- nocode:platform claude -->/, file);
    assert.match(source, /<!-- nocode:platform codex -->/, file);
    assert.match(source, /AskUserQuestion/, file);
    assert.match(source, /request_user_input/, file);
    assert.doesNotMatch(source, /Capability\(|"profile"\s*:|fallbackPolicy/, file);
  }
  const larkRead = read('skills/lark-read/SKILL.md');
  assert.match(larkRead, /已安装的 `lark-shared` Skill/);
  assert.match(larkRead, /\$lark-shared/);
  assert.doesNotMatch(larkRead, /Capability\(|fallbackPolicy/);
});
