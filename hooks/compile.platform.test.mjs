import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildExpectedTree,
  diffTree,
  validateContract,
  validateMetadata,
  writeExpectedTree,
} from '../scripts/lib/platform-compiler.mjs';
import { parseArgs, run } from '../scripts/compile.platform.mjs';
import { claudeAdapter } from '../adapters/claude/adapter.mjs';
import { codexAdapter } from '../adapters/codex/adapter.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixtureRepo(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'platform-compiler-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'skills', 'hello'), { recursive: true });
  writeFileSync(path.join(root, 'skills', 'hello', 'SKILL.md'), 'hello\n');
  return root;
}

function fixtureMetadata() {
  return {
    name: 'nocode',
    version: '14.0.0',
    description: 'test',
    author: { name: 'Harrison' },
    license: 'MIT',
  };
}

function fixtureContract() {
  return {
    platforms: { claude: {}, codex: {} },
    capabilities: [
      {
        name: 'skill.invoke',
        platforms: {
          claude: { status: 'supported', implementation: 'Skill' },
          codex: { status: 'degraded', implementation: '$skill', fallback: 'main session' },
        },
      },
    ],
  };
}

function fixtureAdapter(platform = 'claude') {
  return {
    platform,
    capabilities: ['skill.invoke'],
    sourceRoots: [{ source: 'skills', target: 'skills' }],
    manifestPath: platform === 'claude'
      ? '.claude-plugin/plugin.json'
      : '.codex-plugin/plugin.json',
    renderManifest(metadata) {
      return { name: metadata.name, version: metadata.version };
    },
    transformFile({ content }) {
      return content;
    },
  };
}

test('validateMetadata accepts strict SemVer and rejects invalid metadata', () => {
  assert.doesNotThrow(() => validateMetadata(fixtureMetadata()));
  assert.throws(
    () => validateMetadata({ ...fixtureMetadata(), version: '14' }),
    /SemVer/,
  );
  assert.throws(
    () => validateMetadata({ ...fixtureMetadata(), author: {} }),
    /author\.name/,
  );
});

test('validateContract rejects a missing adapter capability and missing fallback', () => {
  const contract = fixtureContract();
  assert.doesNotThrow(() => validateContract(contract, {
    claude: fixtureAdapter('claude'),
    codex: fixtureAdapter('codex'),
  }));

  assert.throws(
    () => validateContract(contract, {
      claude: { ...fixtureAdapter('claude'), capabilities: [] },
      codex: fixtureAdapter('codex'),
    }),
    /skill\.invoke.*claude/,
  );

  const withoutFallback = structuredClone(contract);
  delete withoutFallback.capabilities[0].platforms.codex.fallback;
  assert.throws(
    () => validateContract(withoutFallback, {
      claude: fixtureAdapter('claude'),
      codex: fixtureAdapter('codex'),
    }),
    /fallback/,
  );
});

test('buildExpectedTree is deterministic and includes the rendered manifest', (t) => {
  const root = fixtureRepo(t);
  const adapter = fixtureAdapter();
  const metadata = fixtureMetadata();

  const first = buildExpectedTree({ root, metadata, adapter });
  const second = buildExpectedTree({ root, metadata, adapter });

  assert.deepEqual([...first.keys()], [
    '.claude-plugin/plugin.json',
    'skills/hello/SKILL.md',
  ]);
  assert.deepEqual([...first], [...second]);
  assert.equal(first.get('skills/hello/SKILL.md').toString(), 'hello\n');
  assert.deepEqual(
    JSON.parse(first.get('.claude-plugin/plugin.json').toString()),
    { name: 'nocode', version: '14.0.0' },
  );
});

test('writeExpectedTree cleans stale files and diffTree reports changed/missing/extra', (t) => {
  const root = fixtureRepo(t);
  const outputRoot = path.join(root, 'plugins', 'claude', 'nocode');
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(path.join(outputRoot, 'stale.txt'), 'stale');

  const expected = buildExpectedTree({
    root,
    metadata: fixtureMetadata(),
    adapter: fixtureAdapter(),
  });
  writeExpectedTree(expected, outputRoot, root);

  assert.deepEqual(diffTree(expected, outputRoot), {
    changed: [],
    missing: [],
    extra: [],
  });
  assert.equal(readFileSync(path.join(outputRoot, 'skills/hello/SKILL.md'), 'utf8'), 'hello\n');

  writeFileSync(path.join(outputRoot, 'skills/hello/SKILL.md'), 'changed\n');
  rmSync(path.join(outputRoot, '.claude-plugin/plugin.json'));
  writeFileSync(path.join(outputRoot, 'extra.txt'), 'extra');
  assert.deepEqual(diffTree(expected, outputRoot), {
    changed: ['skills/hello/SKILL.md'],
    missing: ['.claude-plugin/plugin.json'],
    extra: ['extra.txt'],
  });
});

test('writeExpectedTree refuses to clean a path outside repo plugins/<platform>', (t) => {
  const root = fixtureRepo(t);
  const expected = new Map([['safe.txt', Buffer.from('safe')]]);
  assert.throws(
    () => writeExpectedTree(expected, path.join(root, 'skills'), root),
    /plugins\/(claude|codex)\/nocode/,
  );
});

test('compile CLI argument parser defaults to both platforms and rejects unknown input', () => {
  assert.deepEqual(parseArgs([]), { check: false, platforms: ['claude', 'codex'] });
  assert.deepEqual(parseArgs(['--check', '--platform=codex']), {
    check: true,
    platforms: ['codex'],
  });
  assert.throws(() => parseArgs(['--platform', 'other']), /unknown platform/);
  assert.throws(() => parseArgs(['--wat']), /unknown argument/);
});

test('compile CLI run writes both manifests and then detects drift', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'platform-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'plugin'), { recursive: true });
  mkdirSync(path.join(root, 'core', 'capabilities'), { recursive: true });
  mkdirSync(path.join(root, 'commands'), { recursive: true });
  mkdirSync(path.join(root, 'agents'), { recursive: true });
  writeFileSync(
    path.join(root, 'plugin', 'metadata.json'),
    JSON.stringify(fixtureMetadata()),
  );
  writeFileSync(
    path.join(root, 'core', 'capabilities', 'contract.json'),
    JSON.stringify(fixtureContract()),
  );

  const generated = run({ check: false, platforms: ['claude', 'codex'] }, root);
  assert.equal(generated.hasDrift, false);
  assert.ok(readFileSync(path.join(root, 'plugins/claude/nocode/.claude-plugin/plugin.json')));
  assert.ok(readFileSync(path.join(root, 'plugins/codex/nocode/.codex-plugin/plugin.json')));

  assert.deepEqual(run({ check: true, platforms: ['claude', 'codex'] }, root), {
    hasDrift: false,
    messages: [],
  });
  writeFileSync(path.join(root, 'plugins/codex/nocode/.codex-plugin/plugin.json'), '{}\n');
  const drift = run({ check: true, platforms: ['codex'] }, root);
  assert.equal(drift.hasDrift, true);
  assert.match(drift.messages.join('\n'), /codex: changed: \.codex-plugin\/plugin\.json/);
});

test('Claude adapter builds a behavior-equivalent runtime artifact', () => {
  const metadata = JSON.parse(readFileSync(path.join(REPO_ROOT, 'plugin/metadata.json'), 'utf8'));
  const tree = buildExpectedTree({ root: REPO_ROOT, metadata, adapter: claudeAdapter });
  const required = [
    '.claude-plugin/plugin.json',
    'agents/code-reviewer.md',
    'commands/task.md',
    'hooks/hooks.json',
    'model/agent-about.md',
    'references/skill-integration-map.md',
    'rules/rule-codex-review.md',
    'scripts/compile.rule.js',
    'skills/devflow/SKILL.md',
    'vendor/codex/scripts/codex-companion.mjs',
  ];
  for (const relative of required) {
    assert.ok(tree.has(relative), `Claude artifact missing ${relative}`);
  }
  for (const nonComponentDoc of [
    'agents/AGENTS.md',
    'agents/README.md',
    'commands/AGENTS.md',
    'commands/README.md',
  ]) {
    assert.equal(tree.has(nonComponentDoc), false, `${nonComponentDoc} must not be auto-discovered`);
  }
  assert.equal(tree.has('docs/superpowers/specs/INDEX.md'), false);
  assert.deepEqual(
    JSON.parse(tree.get('.claude-plugin/plugin.json').toString()),
    claudeAdapter.renderManifest(metadata),
  );
  assert.ok(
    tree.get('skills/devflow/SKILL.md').equals(
      readFileSync(path.join(REPO_ROOT, 'skills/devflow/SKILL.md')),
    ),
    'Claude renderer must preserve workflow bytes',
  );
});

test('Codex adapter builds native skills, command skills, and private agent profiles', () => {
  const metadata = JSON.parse(readFileSync(path.join(REPO_ROOT, 'plugin/metadata.json'), 'utf8'));
  const tree = buildExpectedTree({ root: REPO_ROOT, metadata, adapter: codexAdapter });
  const required = [
    '.codex-plugin/plugin.json',
    'commands/sow-reference/script.py',
    'hooks/hooks.json',
    'model/agent-about.md',
    'rules/rule-git-worktree.md',
    'scripts/compile.rule.js',
    'shared/references/testing-guide.md',
    'skills/agents-launcher/agents/openai.yaml',
    'skills/devflow/SKILL.md',
    'skills/task/SKILL.md',
    'skills/agent-profiles/SKILL.md',
    'skills/agent-profiles/references/code-reviewer.md',
  ];
  for (const relative of required) {
    assert.ok(tree.has(relative), `Codex artifact missing ${relative}`);
  }
  assert.equal([...tree.keys()].some((relative) => relative.startsWith('vendor/codex/')), false);
  assert.equal([...tree.keys()].some((relative) => relative.startsWith('skills/references/')), false);
  assert.equal(
    [...tree.keys()].some((relative) => /^commands\/[^/]+\.md$/.test(relative)),
    false,
    'Codex command markdown must be compiled to skills instead of copied twice',
  );

  const manifest = JSON.parse(tree.get('.codex-plugin/plugin.json').toString());
  assert.equal(manifest.name, path.basename(path.join(REPO_ROOT, 'plugins/codex/nocode')));
  assert.equal(manifest.version, metadata.version);
  assert.equal(manifest.skills, './skills/');
  assert.equal('hooks' in manifest, false, 'default hooks/hooks.json discovery is sufficient');
  assert.ok(Array.isArray(manifest.interface.capabilities));
  assert.ok(Array.isArray(manifest.interface.defaultPrompt));

  const devflow = tree.get('skills/devflow/SKILL.md').toString();
  assert.doesNotMatch(devflow, /Skill\(nocode:/);
  assert.match(devflow, /\$dev-(define|build|plan)/);
  assert.match(
    tree.get('skills/dev-build/SKILL.md').toString(),
    /\$\{PLUGIN_ROOT\}\/shared\/references/,
  );
  const launcher = tree.get('skills/agents-launcher/SKILL.md').toString();
  assert.doesNotMatch(launcher, /disable-model-invocation/);
  assert.match(
    tree.get('skills/agents-launcher/agents/openai.yaml').toString(),
    /interface:\n  display_name: "agents-launcher"\n  short_description: "本仓 fx-data-agents.+"\npolicy:\n  allow_implicit_invocation: false/,
  );
  const commandTask = tree.get('skills/task/SKILL.md').toString();
  assert.match(commandTask, /^---\nname: task\ndescription:/);
  assert.doesNotMatch(commandTask, /\$ARGUMENTS/);
  assert.match(commandTask, /用户本次调用参数/);
  assert.match(
    tree.get('skills/agent-profiles/SKILL.md').toString(),
    /spawn_agent/,
  );
  const codexHooks = JSON.parse(tree.get('hooks/hooks.json').toString());
  assert.equal('Stop' in codexHooks.hooks, false);
  assert.doesNotMatch(JSON.stringify(codexHooks), /usage-tracker\.mjs/);
  assert.match(JSON.stringify(codexHooks), /\$\{PLUGIN_ROOT\}/);
  assert.doesNotMatch(JSON.stringify(codexHooks), /\$\{CLAUDE_PLUGIN_ROOT\}/);
});

test('repo Codex marketplace points at the name-matched generated plugin root', () => {
  const marketplace = JSON.parse(
    readFileSync(path.join(REPO_ROOT, '.agents/plugins/marketplace.json'), 'utf8'),
  );
  assert.equal(marketplace.name, 'nocode-market');
  assert.equal(marketplace.interface.displayName, 'nocode');
  assert.equal(marketplace.plugins.length, 1);
  assert.deepEqual(marketplace.plugins[0], {
    name: 'nocode',
    source: { source: 'local', path: './plugins/codex/nocode' },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
    category: 'Productivity',
  });
  const claudeMarketplace = JSON.parse(
    readFileSync(path.join(REPO_ROOT, '.claude-plugin/marketplace.json'), 'utf8'),
  );
  assert.match(claudeMarketplace.description, /Claude Code.*Codex|Codex.*Claude Code/);
  assert.equal(claudeMarketplace.plugins[0].source, './plugins/claude/nocode');
});
