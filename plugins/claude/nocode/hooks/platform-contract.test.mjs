import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(path.join(ROOT, relativePath), 'utf8'));
  } catch {
    return null;
  }
}

test('platform metadata is the 14.0.0 version source', () => {
  const metadata = readJson('plugin/metadata.json');
  assert.ok(metadata, 'plugin/metadata.json must exist');
  assert.equal(metadata.name, 'nocode');
  assert.equal(metadata.version, '14.0.0');
  assert.match(metadata.version, /^\d+\.\d+\.\d+$/);
  assert.equal(metadata.author?.name, 'Harrison');
  assert.equal(metadata.license, 'MIT');
});

test('generated platform manifests cannot drift from metadata after cutover', () => {
  const metadata = readJson('plugin/metadata.json');
  assert.ok(metadata, 'plugin metadata must exist');
  assert.equal(existsSync(path.join(ROOT, '.claude-plugin/plugin.json')), false);
  for (const manifestPath of [
    'plugins/claude/nocode/.claude-plugin/plugin.json',
    'plugins/codex/nocode/.codex-plugin/plugin.json',
  ]) {
    const manifest = readJson(manifestPath);
    assert.ok(manifest, `${manifestPath} must exist`);
    assert.equal(manifest.name, metadata.name);
    assert.equal(manifest.version, metadata.version);
    assert.deepEqual(manifest.author, metadata.author);
    assert.equal(manifest.license, metadata.license);
  }
});

test('runtime maintenance commands use the shared metadata version source', () => {
  for (const relativePath of [
    'commands/nocodehub.md',
    'commands/plugin-distill.md',
    'commands/plugin-dream.md',
  ]) {
    const content = readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.doesNotMatch(content, /\.claude-plugin\/plugin\.json/);
  }
});

test('Claude-discovered frontmatter quotes values that contain YAML syntax', () => {
  for (const relativePath of [
    'skills/pd-vd/SKILL.md',
    'skills/agents-launcher/SKILL.md',
  ]) {
    const content = readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.match(content, /^---\n(?:.|\n)*?description: >-\n/m, relativePath);
  }
  for (const relativePath of [
    'commands/personal-distill.md',
    'commands/eval.md',
  ]) {
    const content = readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.match(content, /^argument-hint: "[^"\n]+"$/m, relativePath);
  }
});

test('capability contract covers both platform adapters', () => {
  const contract = readJson('core/capabilities/contract.json');
  assert.ok(contract, 'core/capabilities/contract.json must exist');
  assert.equal(contract.schemaVersion, 1);
  assert.deepEqual(Object.keys(contract.platforms).sort(), ['claude', 'codex']);

  const expected = [
    'agent.dispatch',
    'agent.wait',
    'hook.pretool_decision',
    'hook.session_context',
    'hook.stop_decision',
    'plan.create',
    'plan.update',
    'skill.invoke',
    'user.ask',
    'workspace.enter',
  ];
  assert.deepEqual(contract.capabilities.map((item) => item.name).sort(), expected);

  for (const capability of contract.capabilities) {
    for (const platform of ['claude', 'codex']) {
      const mapping = capability.platforms?.[platform];
      assert.ok(mapping, `${capability.name} must define ${platform}`);
      assert.match(mapping.status, /^(supported|degraded|unsupported)$/);
      assert.ok(mapping.implementation, `${capability.name}.${platform} needs implementation`);
      if (mapping.status !== 'supported') {
        assert.ok(mapping.fallback, `${capability.name}.${platform} needs fallback`);
      }
    }
  }
});
