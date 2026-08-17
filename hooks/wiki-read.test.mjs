import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  DEFAULT_PREAMBLE, parseStatusMd, readWikiPage, writeStatusAtomic,
} from '../scripts/wiki-read.mjs';
import { buildExpectedTree } from '../scripts/lib/platform-packager.mjs';
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

test('wiki-root relative paths from index links resolve without the personal prefix', () => {
  const f = fixture();
  try {
    const result = readWikiPage({ projectRoot: f.root, path: 'pages/architecture.md', sessionId: 'session-rel' }, { now: () => '260721' });
    assert.match(result.content, /Architecture/);
    assert.equal(result.usageRecorded, true);
    assert.deepEqual(parseStatusMd(readFileSync(f.status, 'utf8')).rows, [
      { key: 'pages/architecture', count: 1, lastReferenced: '260721' },
    ]);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('unavailable page error reports the attempted absolute paths', () => {
  const f = fixture();
  try {
    assert.throws(
      () => readWikiPage({ projectRoot: f.root, path: 'pages/missing.md', sessionId: 's' }),
      (error) => error.code === 'WIKI_PAGE_UNAVAILABLE' && /tried: /.test(error.message),
    );
    assert.equal(existsSync(f.status), false);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('cli stderr includes message alongside the error code', () => {
  const f = fixture();
  try {
    const outcome = spawnSync(process.execPath, [
      path.join(ROOT, 'scripts/wiki-read.mjs'),
      '--project-root', f.root, '--path', 'pages/missing.md', '--session-id', 's',
    ], { encoding: 'utf8' });
    assert.equal(outcome.status, 2);
    const payload = JSON.parse(outcome.stderr);
    assert.equal(payload.code, 'WIKI_PAGE_UNAVAILABLE');
    assert.match(payload.message, /wiki page does not exist/);
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

test('both platform artifacts package the direct wiki reader without provider wrappers', () => {
  for (const platform of ['claude', 'codex']) {
    const tree = buildExpectedTree({
      root: ROOT, metadata: METADATA, adapter: PLATFORM_ADAPTERS[platform],
    });
    assert.ok(tree.has('scripts/wiki-read.mjs'));
    assert.equal([...tree.keys()].some((name) => name.includes('project-wiki')
      || name.includes('personal-knowledge')), false);
    const hooks = tree.get('hooks/hooks.json').toString('utf8');
    assert.doesNotMatch(hooks, /usage-tracker|"matcher"\s*:\s*"Read"/);
  }
});
