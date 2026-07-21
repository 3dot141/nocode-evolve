import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmodSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { claudeAdapter } from '../adapters/claude/adapter.mjs';
import { codexAdapter } from '../adapters/codex/adapter.mjs';
import { loadDomainRegistry } from '../scripts/lib/domain-registry.mjs';
import { buildExpectedTree } from '../scripts/lib/platform-compiler.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const METADATA = JSON.parse(readFileSync(path.join(ROOT, 'plugin/metadata.json'), 'utf8'));
const ADAPTERS = { claude: claudeAdapter, codex: codexAdapter };
const LEGACY_DATA_DIR = ['homun', 'culus'].join('');
const EXCLUDED = [
  'skills/continuous-learning-v2',
  'commands/evolve.md',
  'commands/instinct-status.md',
  'commands/instinct-import.md',
  'commands/instinct-export.md',
];

function hashSource(relative) {
  const absolute = path.join(ROOT, relative);
  const chunks = [];
  const visit = (current) => {
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const name of readdirSync(current).sort()) visit(path.join(current, name));
    } else chunks.push(readFileSync(current));
  };
  visit(absolute);
  return createHash('sha256').update(Buffer.concat(chunks)).digest('hex');
}

test('Continuous Learning sources remain byte-identical and are absent from both artifacts', () => {
  const before = Object.fromEntries(EXCLUDED.map((relative) => [relative, hashSource(relative)]));
  const registry = loadDomainRegistry(ROOT);
  for (const platform of ['claude', 'codex']) {
    const tree = buildExpectedTree({
      root: ROOT, metadata: METADATA, adapter: ADAPTERS[platform],
      resolution: registry.resolvePlatform(platform), registry,
    });
    const files = [...tree.keys()];
    assert.equal(files.some((file) => file.startsWith('skills/continuous-learning-v2/')), false);
    for (const command of ['evolve', 'instinct-status', 'instinct-import', 'instinct-export']) {
      assert.equal(files.includes(`commands/${command}.md`), false);
      assert.equal(files.includes(`skills/${command}/SKILL.md`), false);
    }
    const hooks = tree.get('hooks/hooks.json').toString('utf8');
    assert.doesNotMatch(hooks, new RegExp(`continuous-learning-v2|${LEGACY_DATA_DIR}`));
    assert.equal(tree.has('capability-resolution.json'), false);
  }
  assert.deepEqual(Object.fromEntries(EXCLUDED.map((relative) => [relative, hashSource(relative)])), before);
});

test('compilation does not inspect or mutate legacy learning data', () => {
  const fakeHome = mkdtempSync(path.join(tmpdir(), 'nocode-home-'));
  const legacyData = path.join(fakeHome, '.claude', LEGACY_DATA_DIR);
  const sentinel = path.join(legacyData, 'sentinel');
  mkdirSync(legacyData, { recursive: true });
  writeFileSync(sentinel, 'do-not-read-or-touch');
  const before = statSync(sentinel);
  chmodSync(legacyData, 0o000);
  const previousHome = process.env.HOME;
  try {
    process.env.HOME = fakeHome;
    const registry = loadDomainRegistry(ROOT);
    for (const platform of ['claude', 'codex']) {
      const tree = buildExpectedTree({
        root: ROOT, metadata: METADATA, adapter: ADAPTERS[platform],
        resolution: registry.resolvePlatform(platform), registry,
      });
      assert.equal([...tree.values()].some((value) => value.toString('utf8').includes(LEGACY_DATA_DIR)), false);
    }
  } finally {
    if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
    chmodSync(legacyData, 0o700);
  }
  assert.equal(readFileSync(sentinel, 'utf8'), 'do-not-read-or-touch');
  assert.equal(statSync(sentinel).mtimeMs, before.mtimeMs);
  rmSync(fakeHome, { recursive: true, force: true });
});
