import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractRoutes,
  extractOwnRefs,
  checkSkillText,
  checkAll,
  routeTargetSet,
  listSkills,
  listCommandTargets,
  metadataBudget,
  checkPlatformSyntax,
  parseCheckArgs,
} from '../scripts/check-skills.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 构造 ctx / skill 文本的辅助 (纯函数测试, 不碰文件系统)
const ctx = (over = {}) => ({
  targets: new Set(['reviewing', 'dev-build', 'plugin-distill']),
  hasRefDir: true,
  refExists: () => true,
  ...over,
});
const skill = (name, desc, body = '') => `---\nname: ${name}\ndescription: ${desc}\n---\n\n${body}`;

// --- A. 提取函数 (占位符 / 前缀边界) ---

test('extractRoutes: 提取真实 nocode 路由目标', () => {
  assert.deepEqual(extractRoutes('调 `Skill(nocode:reviewing)` 和 Skill(nocode:dev-build)'), ['reviewing', 'dev-build']);
});

test('extractRoutes: 排除文档占位符 (<name>/xxx/.../中文)', () => {
  assert.deepEqual(
    extractRoutes('Skill(nocode:<name>) Skill(nocode:xxx) Skill(nocode:...) Skill(nocode:<阶段 skill>)'),
    [],
  );
});

test('extractRoutes: 无 nocode: 前缀的外部 skill 不提取', () => {
  assert.deepEqual(extractRoutes('Skill(lark-doc) Skill(lark-wiki)'), []);
});

test('extractOwnRefs: 提取裸 references/x.md', () => {
  assert.deepEqual(extractOwnRefs('端到端示例见 `references/example.md`'), ['example.md']);
});

test('extractOwnRefs: 排除指向别的 skill 的完整路径', () => {
  assert.deepEqual(extractOwnRefs('Read `skills/dev-finish-branch/references/post-merge.md`'), []);
});

// --- B. checkSkillText 端到端: 能抓坏 ---

test('污染: description 含 JSON schema 关键词 "type": → error', () => {
  const { errors } = checkSkillText('foo', skill('foo', 'blah "type": "string" blah'), ctx());
  assert.ok(errors.some((e) => e.includes('污染')), errors.join('\n'));
});

test('污染: description 含 $schema → error', () => {
  const { errors } = checkSkillText('foo', skill('foo', 'x $schema y'), ctx());
  assert.ok(errors.some((e) => e.includes('污染')));
});

test('name 与目录名不一致 → error', () => {
  const { errors } = checkSkillText('foo', skill('bar', 'Use when 正常且足够长的描述文本'), ctx());
  assert.ok(errors.some((e) => e.includes('不一致')));
});

test('路由断链: 目标不在白名单 → error', () => {
  const { errors } = checkSkillText('foo', skill('foo', 'Use when 正常且足够长的描述文本', 'Skill(nocode:ghost-skill)'), ctx());
  assert.ok(errors.some((e) => e.includes('路由断链') && e.includes('ghost-skill')));
});

test('reference 断链: 私有 reference 缺失 → error', () => {
  const { errors } = checkSkillText(
    'foo',
    skill('foo', 'Use when 正常且足够长的描述文本', '见 `references/gone.md`'),
    ctx({ refExists: () => false }),
  );
  assert.ok(errors.some((e) => e.includes('reference 断链') && e.includes('gone.md')));
});

// --- B. checkSkillText 端到端: 零误报 ---

test('command 目标不误报 (skill 与 command 共享 nocode 命名空间)', () => {
  const { errors } = checkSkillText('foo', skill('foo', 'Use when 正常且足够长的描述文本', 'Skill(nocode:plugin-distill)'), ctx());
  assert.deepEqual(errors, []);
});

test('占位符路由 Skill(nocode:xxx) 不误报 (即使白名单为空)', () => {
  const { errors } = checkSkillText('foo', skill('foo', 'Use when 正常且足够长的描述文本', 'Skill(nocode:xxx)'), ctx({ targets: new Set() }));
  assert.deepEqual(errors, []);
});

test('占位符 reference references/xxx-review.md 不误报', () => {
  const { errors } = checkSkillText(
    'foo',
    skill('foo', 'Use when 正常且足够长的描述文本', '`references/xxx-review.md`'),
    ctx({ refExists: () => false }),
  );
  assert.deepEqual(errors, []);
});

test('无 references/ 目录时裸 references/ 引用不误报 (指向共享/别处)', () => {
  const { errors } = checkSkillText(
    'foo',
    skill('foo', 'Use when 正常且足够长的描述文本', '见 `references/testing-anti-patterns.md` (plugin root)'),
    ctx({ hasRefDir: false, refExists: () => false }),
  );
  assert.deepEqual(errors, []);
});

test('干净 skill (含反引号 Skill()/中文冒号的真实风格 description) → 零 error', () => {
  const desc = '通用 review 引擎，被 `Skill(nocode:reviewing)` 调用：审代码/方案/设计文档都用它。不触发纯事实查询。';
  const { errors } = checkSkillText('reviewing', skill('reviewing', desc), ctx());
  assert.deepEqual(errors, []);
});

test('self-loop 越界: 正文指路 model/agent-*.md → warning', () => {
  const { warnings } = checkSkillText('foo', skill('foo', 'Use when 正常且足够长的描述文本', '见 `model/agent-about.md`「路径变量」'), ctx());
  assert.ok(warnings.some((w) => w.includes('self-loop')));
});

// --- C. 现状回归守护 (最重要: 保证仓库始终无真断链/污染) ---

test('checkAll: 当前仓库无真断链/污染 (error=0)', () => {
  const { errors } = checkAll();
  assert.deepEqual(errors, [], '现状应无 error:\n' + errors.join('\n'));
});

test('routeTargetSet: 同时含 skill 与 command 两类目标', () => {
  const t = routeTargetSet();
  assert.ok(t.has('reviewing'), '应含 skill reviewing');
  assert.ok(t.has('plugin-distill'), '应含 command plugin-distill');
});

test('listSkills / listCommandTargets: 均非空', () => {
  assert.ok(listSkills().length >= 20, 'skill 数应 ≥20');
  assert.ok(listCommandTargets().length >= 5, 'command 数应 ≥5');
});

test('Codex syntax checker rejects unresolved Claude tool vocabulary', () => {
  const errors = checkPlatformSyntax(
    'Skill(nocode:dev-build) AskUserQuestion TaskCreate EnterWorktree plugins/claude/nocode',
    'skills/foo/SKILL.md',
    'codex',
  );
  assert.equal(errors.length, 5);
  assert.deepEqual(checkPlatformSyntax('$dev-build update_plan', 'skills/foo/SKILL.md', 'codex'), []);
  assert.deepEqual(checkPlatformSyntax('Skill(nocode:dev-build)', 'skills/foo/SKILL.md', 'claude'), []);
});

test('metadataBudget counts generated skill names and descriptions', () => {
  const codexRoot = path.join(ROOT, 'plugins', 'codex', 'nocode');
  const budget = metadataBudget(codexRoot);
  assert.ok(budget.entries.length >= 50, `expected generated skills, got ${budget.entries.length}`);
  assert.ok(budget.total > 0);
  assert.ok(budget.total <= 8000, `Codex metadata budget ${budget.total} exceeds 8000`);
});

test('checkAll validates the generated Codex plugin with zero errors', () => {
  const codexRoot = path.join(ROOT, 'plugins', 'codex', 'nocode');
  const { errors } = checkAll({ root: codexRoot, platform: 'codex' });
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('check-skills CLI parser accepts explicit root/platform', () => {
  assert.deepEqual(parseCheckArgs(['--check', '--root', '/tmp/plugin', '--platform=codex']), {
    root: '/tmp/plugin',
    platform: 'codex',
  });
  assert.throws(() => parseCheckArgs(['--platform=other']), /platform/);
  assert.throws(() => parseCheckArgs(['--unknown']), /unknown argument/);
});
