import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, existsSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync, execFileSync } from 'node:child_process';
import { resolvePersonalDir, projectId, ensureBareRepo } from '../scripts/personal-snapshot.mjs';

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'ps-test-'));
}

function gitLog(bareDir) {
  return execSync(`git --git-dir="${bareDir}" log --oneline`, { encoding: 'utf8' }).trim();
}

function runScript(env = {}, args = []) {
  const script = join(import.meta.dirname, '..', 'scripts', 'personal-snapshot.mjs');
  return execFileSync('node', [script, '--json', ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// ── BF1: 检测与 resolve ──

test('case 1.1 — 无 .agents-personal/ 时 skip', () => {
  const tmp = makeTmpDir();
  try {
    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: join(tmp, 'history') });
    const result = JSON.parse(out);
    assert.equal(result.status, 'skipped');
    assert.ok(!existsSync(join(tmp, 'history')), 'bare repo 不应被创建');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 1.2 — 有 .agents-personal/ (非 symlink) 走 snapshot', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'test.md'), '# test');
  try {
    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    assert.equal(result.status, 'committed');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 1.3 — symlink 场景 resolve 到物理路径', () => {
  const tmp = makeTmpDir();
  const mainProject = join(tmp, 'main-project');
  const worktreeProject = join(tmp, 'worktree');
  const physicalPersonal = join(mainProject, '.agents-personal');
  const history = join(tmp, 'history');

  mkdirSync(physicalPersonal, { recursive: true });
  writeFileSync(join(physicalPersonal, 'wiki.md'), '# wiki');
  mkdirSync(worktreeProject, { recursive: true });
  symlinkSync(physicalPersonal, join(worktreeProject, '.agents-personal'));

  try {
    const out = runScript({ CLAUDE_PROJECT_DIR: worktreeProject, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    assert.equal(result.status, 'committed');

    const resolved = resolvePersonalDir(worktreeProject);
    const mainResolved = resolvePersonalDir(mainProject);
    assert.equal(realpathSync(resolved), realpathSync(mainResolved), 'symlink 应 resolve 到同一物理路径');
    assert.equal(projectId(resolved), projectId(mainResolved), 'project-id 应相同');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 1.4 — 断裂 symlink 不崩溃', () => {
  const tmp = makeTmpDir();
  const history = join(tmp, 'history');
  symlinkSync('/nonexistent/path/.agents-personal', join(tmp, '.agents-personal'));
  try {
    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    assert.equal(result.status, 'skipped');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── BF2: 首次初始化 ──

test('case 2.1 — 首次 init + initial commit', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(join(personal, 'wiki'), { recursive: true });
  writeFileSync(join(personal, 'AGENTS.md'), '# AGENTS');
  writeFileSync(join(personal, 'wiki', 'index.md'), '# index');
  writeFileSync(join(personal, 'wiki', 'page.md'), '# page');

  try {
    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    assert.equal(result.status, 'committed');

    const id = projectId(personal);
    const bareDir = join(history, id);
    const log = gitLog(bareDir);
    assert.equal(log.split('\n').length, 1, '应有 1 个 commit');
    assert.match(log, /auto:/, 'commit message 应含 auto:');

    const files = execSync(`git --git-dir="${bareDir}" ls-tree -r --name-only HEAD`, { encoding: 'utf8' }).trim();
    assert.ok(files.includes('AGENTS.md'));
    assert.ok(files.includes('wiki/index.md'));
    assert.ok(files.includes('wiki/page.md'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 2.2 — 幂等, bare repo 已存在不重复 init', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'test.md'), '# v1');

  try {
    runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });

    const created = ensureBareRepo(join(history, projectId(personal)));
    assert.equal(created, false, '已存在的 bare repo 不应重新 init');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── BF3: 增量快照 ──

test('case 3.1 — 新增文件产生增量 commit', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'v1.md'), '# v1');

  try {
    runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });

    writeFileSync(join(personal, 'v2.md'), '# v2');
    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    assert.equal(result.status, 'committed');

    const bareDir = join(history, projectId(personal));
    const log = gitLog(bareDir);
    assert.equal(log.split('\n').length, 2, '应有 2 个 commit');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 3.2 — 修改文件产生增量 commit', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'doc.md'), '# original');

  try {
    runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });

    writeFileSync(join(personal, 'doc.md'), '# modified');
    runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });

    const bareDir = join(history, projectId(personal));
    const diff = execSync(`git --git-dir="${bareDir}" diff HEAD~1 HEAD`, { encoding: 'utf8' });
    assert.ok(diff.includes('-# original'));
    assert.ok(diff.includes('+# modified'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 3.3 — 无变更不产生空 commit', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'doc.md'), '# stable');

  try {
    runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    assert.equal(result.status, 'no_changes');

    const bareDir = join(history, projectId(personal));
    const log = gitLog(bareDir);
    assert.equal(log.split('\n').length, 1, '应仍然只有 1 个 commit');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 3.4 — --dry-run 不执行 commit', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'doc.md'), '# test');

  try {
    runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    writeFileSync(join(personal, 'new.md'), '# new');

    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history }, ['--dry-run']);
    const result = JSON.parse(out);
    assert.equal(result.status, 'dry_run');
    assert.equal(result.changes, true);

    const bareDir = join(history, projectId(personal));
    const log = gitLog(bareDir);
    assert.equal(log.split('\n').length, 1, '--dry-run 不应产生新 commit');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 3.5 — project-id 确定性', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  mkdirSync(personal, { recursive: true });

  try {
    const id1 = projectId(personal);
    const id2 = projectId(personal);
    assert.equal(id1, id2, '同一路径的 project-id 应相同');
    assert.match(id1, /.+-[0-9a-f]{8}$/, 'project-id 应为 basename-md5_8 格式');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
