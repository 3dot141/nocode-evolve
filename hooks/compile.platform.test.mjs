import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildExpectedTree,
  diffTree,
  validateAdapterResolution,
  validateMetadata,
  writeExpectedTree,
} from '../scripts/lib/platform-compiler.mjs';
import { parseArgs, run } from '../scripts/compile.platform.mjs';
import { claudeAdapter } from '../adapters/claude/adapter.mjs';
import { codexAdapter } from '../adapters/codex/adapter.mjs';
import { loadDomainRegistry } from '../scripts/lib/domain-registry.mjs';

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

function fixtureResolution(platform = 'claude') {
  return { platform, domains: { workflow: { 'workflow.skill.invoke': { primary: `${platform}-control` } } }, excluded: {} };
}

function fixtureAdapter(platform = 'claude') {
  return {
    platform,
    providerSupport: [`${platform}-control`],
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

test('adapter validates domain provider support instead of a legacy capability table', () => {
  assert.doesNotThrow(() => validateAdapterResolution(fixtureAdapter(), fixtureResolution()));
  assert.throws(
    () => validateAdapterResolution({ ...fixtureAdapter(), providerSupport: [] }, fixtureResolution()),
    /missing provider support: claude-control/,
  );
  assert.throws(
    () => validateAdapterResolution(fixtureAdapter(), fixtureResolution('codex')),
    /platform mismatch/,
  );
  assert.throws(
    () => validateAdapterResolution(fixtureAdapter(), { platform: 'claude', domains: {}, excluded: {} }),
    /must contain at least one capability/,
  );
});

test('buildExpectedTree is deterministic and includes the rendered manifest', (t) => {
  const root = fixtureRepo(t);
  const adapter = fixtureAdapter();
  const metadata = fixtureMetadata();

  const resolution = fixtureResolution();
  const first = buildExpectedTree({ root, metadata, adapter, resolution });
  const second = buildExpectedTree({ root, metadata, adapter, resolution });

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
    resolution: fixtureResolution(),
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

test('writeExpectedTree restores the executable bit for .sh/.py scripts', (t) => {
  const root = fixtureRepo(t);
  const outputRoot = path.join(root, 'plugins', 'claude', 'nocode');
  const expected = new Map([
    ['hooks/inject-nocode.sh', Buffer.from('#!/bin/sh\n')],
    ['skills/x/scripts/run.py', Buffer.from('print(1)\n')],
    ['skills/x/SKILL.md', Buffer.from('doc\n')],
  ]);
  writeExpectedTree(expected, outputRoot, root);

  const modeOf = (relative) => statSync(path.join(outputRoot, relative)).mode & 0o777;
  assert.equal(modeOf('hooks/inject-nocode.sh'), 0o755);
  assert.equal(modeOf('skills/x/scripts/run.py'), 0o755);
  assert.equal(modeOf('skills/x/SKILL.md'), 0o644);
});

test('compile CLI argument parser defaults to both platforms and rejects unknown input', () => {
  assert.deepEqual(parseArgs([]), { check: false, platforms: ['claude', 'codex'] });
  assert.deepEqual(parseArgs(['--check', '--platform=codex']), {
    check: true,
    platforms: ['codex'],
  });
  assert.throws(() => parseArgs(['--platform', 'other']), /unknown platform/);
  assert.throws(() => parseArgs(['--audit=inventory']), /unknown argument/);
  assert.throws(() => parseArgs(['--wat']), /unknown argument/);
});

test('compile CLI run writes both manifests and then detects drift', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'platform-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'plugin'), { recursive: true });
  mkdirSync(path.join(root, 'core', 'domains', 'workflow', 'capabilities'), { recursive: true });
  mkdirSync(path.join(root, 'core', 'domains', 'workflow', 'contracts'), { recursive: true });
  mkdirSync(path.join(root, 'core', 'domains', 'workflow', 'providers', 'claude-control'), { recursive: true });
  mkdirSync(path.join(root, 'core', 'domains', 'workflow', 'providers', 'codex-control'), { recursive: true });
  mkdirSync(path.join(root, 'core', 'contracts'), { recursive: true });
  mkdirSync(path.join(root, 'commands'), { recursive: true });
  mkdirSync(path.join(root, 'agents'), { recursive: true });
  writeFileSync(
    path.join(root, 'plugin', 'metadata.json'),
    JSON.stringify(fixtureMetadata()),
  );
  writeFileSync(path.join(root, 'core/contracts/provider-attempt.schema.json'), JSON.stringify({
    $id: 'nocode.provider-attempt', type: 'object', additionalProperties: true,
  }));
  const input = { $id: 'workflow.input', type: 'object' };
  const output = { $id: 'workflow.output', type: 'object' };
  writeFileSync(path.join(root, 'core/domains/workflow/contracts/input.schema.json'), JSON.stringify(input));
  writeFileSync(path.join(root, 'core/domains/workflow/contracts/output.schema.json'), JSON.stringify(output));
  writeFileSync(path.join(root, 'core/domains/workflow/capabilities/invoke.json'), JSON.stringify({
    id: 'workflow.skill.invoke', domain: 'workflow', inputSchema: 'contracts/input.schema.json', outputSchema: 'contracts/output.schema.json', fallbackOn: 'never',
    platforms: { claude: { primary: 'claude-control' }, codex: { primary: 'codex-control' } },
  }));
  mkdirSync(path.join(root, 'core/domains/workflow/entrypoints/skill.invoke'), { recursive: true });
  writeFileSync(path.join(root, 'core/domains/workflow/entrypoints/skill.invoke/SKILL.md'), `---
name: _nocode-domain-workflow-skill.invoke
description: Synthetic workflow entry.
---

### Provider: claude-control

Return a provider-attempt envelope.

### Provider: codex-control

Return a provider-attempt envelope.
`);
  writeFileSync(path.join(root, 'core/domains/workflow/entrypoints/skill.invoke/route.mjs'), "export const capability = 'workflow.skill.invoke';\n");
  for (const [provider, platform] of [['claude-control', 'claude'], ['codex-control', 'codex']]) {
    writeFileSync(path.join(root, `core/domains/workflow/providers/${provider}/provider.json`), JSON.stringify({
      id: provider, domain: 'workflow', execution: 'native', pluginData: false,
      platforms: [platform], dependencies: [],
      capabilities: { 'workflow.skill.invoke': { inputSchema: 'contracts/input.schema.json', outputSchema: 'contracts/output.schema.json' } },
    }));
  }
  writeFileSync(path.join(root, 'core/domains/workflow/domain.json'), JSON.stringify({
    id: 'workflow', capabilities: ['capabilities/invoke.json'], contracts: ['contracts/input.schema.json', 'contracts/output.schema.json'],
    providers: ['providers/claude-control/provider.json', 'providers/codex-control/provider.json'],
  }));

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

test('Claude adapter builds shared entry skills and agent references', () => {
  const metadata = JSON.parse(readFileSync(path.join(REPO_ROOT, 'plugin/metadata.json'), 'utf8'));
  const registry = loadDomainRegistry(REPO_ROOT);
  const resolution = registry.resolvePlatform('claude');
  const tree = buildExpectedTree({ root: REPO_ROOT, metadata, adapter: claudeAdapter, resolution, registry });
  const required = [
    '.claude-plugin/plugin.json',
    '.mcp.json',
    'hooks/hooks.json',
    'model/agent-nocode.md',
    'model/agent-about.md',
    'references/skill-integration-map.md',
    'rules/rule-codex-review.md',
    'scripts/compile.rule.js',
    'skills/devflow/SKILL.md',
    'skills/task/SKILL.md',
    'skills/using-nocode/SKILL.md',
    'skills/using-nocode/references/agents/planner.md',
    'skills/using-nocode/references/design.md',
  ];
  for (const relative of required) {
    assert.ok(tree.has(relative), `Claude artifact missing ${relative}`);
  }
  assert.equal(tree.has('skills/sow/scripts/test_script.py'), false);
  assert.equal([...tree.keys()].some((relative) => relative.startsWith('vendor/codex/')), false);
  for (const developmentOnly of [
    'scripts/check-skills.mjs',
    'scripts/compile.platform.mjs',
    'scripts/vendor-sync.mjs',
    'scripts/lib/domain-registry.mjs',
  ]) assert.equal(tree.has(developmentOnly), false, `${developmentOnly} must not be published`);
  const claudeMcp = tree.get('.mcp.json').toString();
  assert.match(claudeMcp, /skills\/using-nocode\/scripts\/providers\/open-design\/scripts\/launch\.mjs/);
  assert.doesNotMatch(claudeMcp, /providers\/claude-plugin-data\/scripts\/entry\.mjs/);
  assert.doesNotMatch(claudeMcp, /\/Users\//);
  for (const nonComponentDoc of [
    'agents/AGENTS.md',
    'agents/README.md',
    'commands/AGENTS.md',
    'commands/README.md',
  ]) {
    assert.equal(tree.has(nonComponentDoc), false, `${nonComponentDoc} must not be auto-discovered`);
  }
  assert.equal(
    [...tree.keys()].some((relative) => relative.startsWith('agents/') || relative.startsWith('commands/')),
    false,
    'Claude agents and commands must be compiled into shared skills instead of published natively',
  );
  assert.equal(tree.has('docs/superpowers/specs/INDEX.md'), false);
  assert.deepEqual(
    JSON.parse(tree.get('.claude-plugin/plugin.json').toString()),
    claudeAdapter.renderManifest(metadata),
  );
  assert.match(tree.get('skills/devflow/SKILL.md').toString(), /Capability\(workflow\.plan\.create/);
  const claudeTask = tree.get('skills/task/SKILL.md').toString();
  assert.match(claudeTask, /^---\nname: task\ndescription:/);
  assert.doesNotMatch(claudeTask, /x-nocode:/);
  assert.match(claudeTask, /\$ARGUMENTS/);
  assert.match(
    tree.get('skills/using-nocode/references/agents/planner.md').toString(),
    /planning/i,
  );
  const claudeHooks = JSON.parse(tree.get('hooks/hooks.json').toString());
  assert.equal('Stop' in claudeHooks.hooks, false);
  assert.doesNotMatch(JSON.stringify(claudeHooks), /handoff|plan-change/);
  assert.match(JSON.stringify(claudeHooks.hooks.SessionStart), /model-nocode/);
  const claudeInjector = tree.get('hooks/inject-nocode.sh').toString();
  assert.match(claudeInjector, /skills\/using-nocode\/scripts\/providers\/claude-hooks\/context-budget\.json/);
  assert.doesNotMatch(claudeInjector, /providers\/codex-hooks\//);
});

test('Codex adapter builds shared entry skills and agent references', () => {
  const metadata = JSON.parse(readFileSync(path.join(REPO_ROOT, 'plugin/metadata.json'), 'utf8'));
  const registry = loadDomainRegistry(REPO_ROOT);
  const resolution = registry.resolvePlatform('codex');
  const tree = buildExpectedTree({ root: REPO_ROOT, metadata, adapter: codexAdapter, resolution, registry });
  const required = [
    '.codex-plugin/plugin.json',
    '.mcp.json',
    'skills/sow/scripts/script.py',
    'hooks/hooks.json',
    'model/agent-nocode.md',
    'model/agent-about.md',
    'rules/rule-git-worktree.md',
    'scripts/compile.rule.js',
    'skills/references/testing-guide.md',
    'skills/agents-launcher/agents/openai.yaml',
    'skills/devflow/SKILL.md',
    'skills/task/SKILL.md',
    'skills/using-nocode/SKILL.md',
    'skills/using-nocode/references/agents/planner.md',
    'skills/using-nocode/references/workflow.md',
  ];
  for (const relative of required) {
    assert.ok(tree.has(relative), `Codex artifact missing ${relative}`);
  }
  assert.equal(tree.has('skills/sow/scripts/test_script.py'), false);
  const codexMcp = tree.get('.mcp.json').toString();
  assert.match(codexMcp, /skills\/using-nocode\/scripts\/providers\/open-design\/scripts\/launch\.mjs/);
  assert.doesNotMatch(codexMcp, /skills\/using-nocode\/scripts\/runtime-entry\.mjs/);
  assert.doesNotMatch(codexMcp, /providers\/codex-plugin-data\/scripts\/entry\.mjs/);
  assert.doesNotMatch(codexMcp, /\/Users\//);
  assert.equal([...tree.keys()].some((relative) => relative.startsWith('vendor/codex/')), false);
  assert.equal(tree.has('scripts/compile.platform.mjs'), false);
  assert.equal(tree.has('scripts/lib/platform-compiler.mjs'), false);
  assert.equal([...tree.keys()].some((relative) => relative.startsWith('shared/references/')), false);
  assert.equal(
    [...tree.keys()].some((relative) => relative.startsWith('agents/') || relative.startsWith('commands/')),
    false,
    'Codex agents and commands must be compiled into shared skills instead of copied twice',
  );

  const manifest = JSON.parse(tree.get('.codex-plugin/plugin.json').toString());
  assert.equal(manifest.name, path.basename(path.join(REPO_ROOT, 'plugins/codex/nocode')));
  assert.equal(manifest.version, metadata.version);
  assert.equal(manifest.skills, './skills/');
  assert.equal('hooks' in manifest, false, 'default hooks/hooks.json discovery is sufficient');
  assert.ok(Array.isArray(manifest.interface.capabilities));
  assert.ok(Array.isArray(manifest.interface.defaultPrompt));

  const devflow = tree.get('skills/devflow/SKILL.md').toString();
  assert.match(devflow, /Capability\(workflow\.plan\.create/);
  assert.match(
    tree.get('skills/dev-build/SKILL.md').toString(),
    /\$\{PLUGIN_ROOT\}\/skills\/references/,
  );
  const launcher = tree.get('skills/agents-launcher/SKILL.md').toString();
  assert.doesNotMatch(launcher, /disable-model-invocation/);
  assert.match(
    tree.get('skills/agents-launcher/agents/openai.yaml').toString(),
    /interface:\n  display_name: "agents-launcher"\n  short_description: "本仓 fx-data-agents.+"\npolicy:\n  allow_implicit_invocation: false/,
  );
  for (const nested of ['decision', 'writing']) {
    assert.match(
      tree.get(`skills/dev-design/${nested}/SKILL.md`).toString(),
      /^---\nname: dev-design-(?:decision|writing)\ndescription:/,
    );
    assert.match(
      tree.get(`skills/dev-design/${nested}/agents/openai.yaml`).toString(),
      /allow_implicit_invocation: false/,
    );
  }
  const commandTask = tree.get('skills/task/SKILL.md').toString();
  assert.match(commandTask, /^---\nname: task\ndescription:/);
  assert.doesNotMatch(commandTask, /x-nocode:/);
  assert.doesNotMatch(commandTask, /\$ARGUMENTS/);
  assert.match(commandTask, /用户本次调用参数/);
  assert.match(
    tree.get('skills/using-nocode/references/agents/planner.md').toString(),
    /planning/i,
  );
  assert.equal(tree.has('skills/agent-profiles/SKILL.md'), false);
  const codexHooks = JSON.parse(tree.get('hooks/hooks.json').toString());
  assert.equal('Stop' in codexHooks.hooks, false);
  assert.doesNotMatch(JSON.stringify(codexHooks), /handoff|plan-change/);
  assert.match(JSON.stringify(codexHooks.hooks.SessionStart), /model-nocode/);
  const codexInjector = tree.get('hooks/inject-nocode.sh').toString();
  assert.match(codexInjector, /providers\/codex-hooks\/context-budget\.json/);
  assert.doesNotMatch(codexInjector, /providers\/claude-hooks\//);
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
