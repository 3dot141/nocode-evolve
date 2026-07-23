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

test('platform metadata is the version source', () => {
  const metadata = readJson('plugin/metadata.json');
  assert.ok(metadata, 'plugin/metadata.json must exist');
  assert.equal(metadata.name, 'nocode');
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

test('obsolete capability architecture cannot reappear', () => {
  for (const obsolete of [
    'core/domains',
    'scripts/lib/domain-registry.mjs',
    'scripts/lib/domain-renderer.mjs',
    'scripts/lib/schema-validator.mjs',
    'scripts/lib/workflow-provider.mjs',
    'scripts/lib/workflow-control.mjs',
    'scripts/lib/workspace-provider.mjs',
    'scripts/workflow-state.mjs',
    'skills/using-nocode',
    'agents',
  ]) assert.equal(existsSync(path.join(ROOT, obsolete)), false, obsolete);
});
