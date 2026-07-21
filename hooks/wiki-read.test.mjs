import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DEFAULT_PREAMBLE, parseStatusMd, readWikiPage, writeStatusAtomic,
} from '../scripts/wiki-read.mjs';
import { executeProjectWiki } from '../core/domains/personal-knowledge/providers/project-wiki/scripts/wiki-read.mjs';
import { buildExpectedTree } from '../scripts/lib/platform-compiler.mjs';
import { loadDomainRegistry } from '../scripts/lib/domain-registry.mjs';
import { assertSchemaValue } from '../scripts/lib/schema-validator.mjs';
import { claudeAdapter } from '../adapters/claude/adapter.mjs';
import { codexAdapter } from '../adapters/codex/adapter.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const METADATA = JSON.parse(readFileSync(path.join(ROOT, 'plugin/metadata.json'), 'utf8'));
const PLATFORM_ADAPTERS = { claude: claudeAdapter, codex: codexAdapter };

function fixture(prefix = 'wiki-read-') {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  const personal = path.join(root, '.agents-personal');
  const page = path.join(personal, 'wiki', 'pages', 'architecture.md');
  mkdirSync(path.dirname(page), { recursive: true });
  writeFileSync(page, '# Architecture\n\nDecision record.\n');
  return { root, personal, page, status: path.join(personal, 'wiki', 'status.md') };
}

test('page read returns content and increments status exactly once', () => {
  const f = fixture();
  try {
    const result = readWikiPage({ projectRoot: f.root, path: f.page, sessionId: 'session-a' }, { now: () => '260721' });
    assert.equal(result.content, '# Architecture\n\nDecision record.\n');
    assert.equal(result.usageRecorded, true);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(parseStatusMd(readFileSync(f.status, 'utf8')).rows, [
      { key: 'pages/architecture', count: 1, lastReferenced: '260721' },
    ]);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('missing or failed page read never records usage', () => {
  const f = fixture();
  try {
    assert.throws(
      () => readWikiPage({ projectRoot: f.root, path: path.join(f.personal, 'wiki/pages/missing.md'), sessionId: 's' }),
      (error) => error.code === 'WIKI_PAGE_UNAVAILABLE'
        && !Object.hasOwn(error, 'committed') && !Object.hasOwn(error, 'retrySafe'),
    );
    assert.equal(existsSync(f.status), false);
    assert.throws(
      () => readWikiPage({ projectRoot: f.root, path: f.page, sessionId: 's' }, { readPage: () => { throw new Error('denied'); } }),
      (error) => error.code === 'WIKI_PAGE_READ_FAILED',
    );
    assert.equal(existsSync(f.status), false);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('short lock timeout returns content with a usage warning', () => {
  const f = fixture();
  try {
    const repoLock = { acquire: () => null, release: () => assert.fail('unowned lock released') };
    const result = readWikiPage({ projectRoot: f.root, path: f.page, sessionId: 's' }, { repoLock, lockTimeoutMs: 5 });
    assert.match(result.content, /Architecture/);
    assert.equal(result.usageRecorded, false);
    assert.deepEqual(result.warnings, ['WIKI_USAGE_LOCKED']);
    assert.equal(existsSync(f.status), false);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('status writes fsync a temp file before atomic rename', () => {
  const calls = [];
  const ops = {
    open: (file, flags, mode) => { calls.push(['open', file, flags, mode]); return 7; },
    write: (fd, content) => calls.push(['write', fd, content]),
    fsync: (fd) => calls.push(['fsync', fd]),
    close: (fd) => calls.push(['close', fd]),
    rename: (from, to) => calls.push(['rename', from, to]),
    unlink: (file) => calls.push(['unlink', file]),
  };
  writeStatusAtomic('/project/.agents-personal/wiki/status.md', `${DEFAULT_PREAMBLE}\n`, { ops, tempSuffix: '.fixed' });
  assert.deepEqual(calls.map(([name]) => name), ['open', 'write', 'fsync', 'close', 'rename']);
  assert.equal(calls[0][1], '/project/.agents-personal/wiki/status.md.fixed');
  assert.deepEqual(calls.at(-1).slice(1), [
    '/project/.agents-personal/wiki/status.md.fixed', '/project/.agents-personal/wiki/status.md',
  ]);
});

test('symlinked worktree resolves to one physical usage identity', () => {
  const f = fixture();
  const worktree = mkdtempSync(path.join(tmpdir(), 'wiki-worktree-'));
  try {
    symlinkSync(f.personal, path.join(worktree, '.agents-personal'));
    const first = readWikiPage({ projectRoot: f.root, path: f.page, sessionId: 'main' }, { now: () => '260721' });
    const second = readWikiPage({ projectRoot: worktree, path: '.agents-personal/wiki/pages/architecture.md', sessionId: 'worktree' }, { now: () => '260721' });
    assert.equal(first.path, second.path);
    assert.equal(parseStatusMd(readFileSync(f.status, 'utf8')).rows[0].count, 2);
  } finally {
    rmSync(worktree, { recursive: true, force: true });
    rmSync(f.root, { recursive: true, force: true });
  }
});

test('direct filesystem or shell reads bypass usage accounting', () => {
  const f = fixture();
  try {
    assert.match(readFileSync(f.page, 'utf8'), /Architecture/);
    execFileSync('sh', ['-c', 'test -s "$1"', 'sh', f.page]);
    assert.equal(existsSync(f.status), false);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('project-wiki provider returns domain results and generated integration', () => {
  const f = fixture();
  try {
    const read = executeProjectWiki('personal-knowledge.page.read', { sessionId: 's', path: f.page }, { projectRoot: f.root });
    assert.equal(read.usageRecorded, true);
    const usage = executeProjectWiki('personal-knowledge.usage.record', { sessionId: 's', path: f.page }, {
      projectRoot: f.root, recordUsage: () => ({ recorded: true, count: 2, warning: null }),
    });
    assert.deepEqual(usage, { recorded: true, count: 2, warning: null });
    const lockedUsage = executeProjectWiki('personal-knowledge.usage.record', { sessionId: 's', path: f.page }, {
      projectRoot: f.root,
      recordUsage: () => ({ recorded: false, count: null, warning: 'WIKI_USAGE_LOCKED' }),
    });
    const usageSchema = JSON.parse(readFileSync(path.join(
      ROOT, 'core/domains/personal-knowledge/contracts/usage-result.schema.json',
    ), 'utf8'));
    assert.doesNotThrow(() => assertSchemaValue(usageSchema, lockedUsage));
    const snapshotResult = executeProjectWiki('personal-knowledge.snapshot', {
      sessionId: 's', snapshotMessage: 'smoke',
    }, {
      projectRoot: f.root, createSnapshot: () => ({ created: true, commit: 'abc123' }),
    });
    assert.deepEqual(snapshotResult, { created: true, commit: 'abc123' });
    const registry = loadDomainRegistry(ROOT);
    for (const platform of ['claude', 'codex']) {
      const tree = buildExpectedTree({
        root: ROOT, metadata: METADATA, adapter: PLATFORM_ADAPTERS[platform],
        registry, resolution: registry.resolvePlatform(platform),
      });
      const names = new Set(tree.keys());
      assert.ok(names.has('skills/using-nocode/scripts/providers/project-wiki/scripts/wiki-read.mjs'));
      assert.ok(names.has('skills/using-nocode/references/personal-knowledge.md'));
      const generated = tree.get('skills/using-nocode/references/personal-knowledge.md').toString('utf8');
      for (const entry of ['personal-knowledge.page.read', 'personal-knowledge.usage.record', 'personal-knowledge.snapshot']) {
        assert.match(generated, new RegExp(entry.replace('.', '\\.')));
      }
      const hooks = tree.get('hooks/hooks.json').toString('utf8');
      assert.doesNotMatch(hooks, /usage-tracker|"matcher"\s*:\s*"Read"/);
    }
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
