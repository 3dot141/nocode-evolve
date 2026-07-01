import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, existsSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync, execFileSync } from 'node:child_process';
import { resolvePersonalDir, projectId, ensureNestedRepo, snapshot } from '../scripts/personal-snapshot.mjs';

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'ps-test-'));
}

function nestedGit(personalDir, cmd) {
  return execSync(`git --git-dir="${join(personalDir, '.git')}" --work-tree="${personalDir}" ${cmd}`, {
    encoding: 'utf8',
  }).trim();
}

function nestedGitLog(personalDir) {
  return nestedGit(personalDir, 'log --oneline');
}

function makeOldBareRepoWithHistory(bareDir, seedFileName = 'legacy.md', seedContent = '# legacy history') {
  mkdirSync(bareDir, { recursive: true });
  execSync(`git init --bare -b main "${bareDir}"`, { stdio: 'pipe' });
  const seedWorktree = mkdtempSync(join(tmpdir(), 'ps-seed-'));
  writeFileSync(join(seedWorktree, seedFileName), seedContent);
  execSync(`git --git-dir="${bareDir}" --work-tree="${seedWorktree}" add -A -f`, { stdio: 'pipe' });
  execSync(
    `git -c user.name=seed -c user.email=seed@local --git-dir="${bareDir}" --work-tree="${seedWorktree}" commit -m "legacy commit"`,
    { stdio: 'pipe' }
  );
  rmSync(seedWorktree, { recursive: true, force: true });
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
    assert.ok(!existsSync(join(tmp, 'history')), '历史目录不应被创建');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 1.2 — 有 .agents-personal/ (非 symlink) 走 snapshot, 建立嵌套仓库', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'test.md'), '# test');
  try {
    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    assert.equal(result.status, 'committed');
    assert.ok(existsSync(join(personal, '.git')), '嵌套仓库应建立在 .agents-personal/ 自身内');
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
    assert.ok(existsSync(join(physicalPersonal, '.git')), '嵌套仓库应建在物理目录, 不是 symlink 内');

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

// ── BF2: 首次初始化 (ensureNestedRepo) ──

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

    const log = nestedGitLog(personal);
    assert.equal(log.split('\n').length, 1, '应有 1 个 commit');
    assert.match(log, /auto:/, 'commit message 应含 auto:');

    const files = nestedGit(personal, 'ls-tree -r --name-only HEAD');
    assert.ok(files.includes('AGENTS.md'));
    assert.ok(files.includes('wiki/index.md'));
    assert.ok(files.includes('wiki/page.md'));
    assert.ok(!files.includes('.git'), '顶层 .git 目录不应被追踪进自己的历史');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 2.2 — 幂等: .git 已存在时 ensureNestedRepo 跳过, 不重新 init', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'test.md'), '# v1');

  const prevHistoryRoot = process.env.NOCODE_HISTORY_ROOT;
  process.env.NOCODE_HISTORY_ROOT = history;
  try {
    const created1 = ensureNestedRepo(personal);
    assert.equal(created1, true, '首次应新建');
    assert.ok(existsSync(join(personal, '.git')));

    snapshot(personal); // 建仓后落一次 commit, 才有 HEAD 可比较
    const logBefore = nestedGitLog(personal);
    const created2 = ensureNestedRepo(personal);
    assert.equal(created2, false, '.git 已存在的仓库不应重新 init');
    const logAfter = nestedGitLog(personal);
    assert.equal(logBefore, logAfter, '幂等调用不应改变仓库历史');
  } finally {
    if (prevHistoryRoot === undefined) delete process.env.NOCODE_HISTORY_ROOT;
    else process.env.NOCODE_HISTORY_ROOT = prevHistoryRoot;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 2.3 — .git 不存在 + 检测到旧 bare repo → 触发迁移, 嵌套仓库导入旧历史', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'current.md'), '# current state');

  const id = projectId(personal);
  const oldBareDir = join(history, id);
  makeOldBareRepoWithHistory(oldBareDir);

  try {
    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    // ensureNestedRepo 内部的迁移已经吸收了当前磁盘漂移并 commit 过一次,
    // main() 紧接着再跑的 snapshot() 已无新变化可提交.
    assert.equal(result.status, 'no_changes');
    assert.ok(existsSync(join(personal, '.git')), '嵌套仓库应已建立');

    const log = nestedGitLog(personal);
    const commits = log.split('\n').filter(Boolean);
    assert.equal(commits.length, 2, '应有旧历史 1 commit + 迁移吸收漂移 1 commit');
    assert.ok(log.includes('legacy commit'), '应导入旧仓库历史');

    const files = nestedGit(personal, 'ls-tree -r --name-only HEAD');
    assert.ok(files.includes('current.md'), '迁移后应吸收当前磁盘状态');

    assert.ok(existsSync(`${oldBareDir}.migrated`), '旧 bare repo 应被改名为 .migrated');
    assert.ok(!existsSync(oldBareDir), '旧路径不应再存在');
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

    const log = nestedGitLog(personal);
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

    const diff = nestedGit(personal, 'diff HEAD~1 HEAD');
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

    const log = nestedGitLog(personal);
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

    const log = nestedGitLog(personal);
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

// ── BF4: 并发锁 ──

test('case 4.1 — snapshot 拿不到锁时返回 skipped_locked, 不阻塞', () => {
  const tmp = makeTmpDir();
  const personal = join(tmp, '.agents-personal');
  const history = join(tmp, 'history');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'doc.md'), '# v1');

  try {
    runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const logBefore = nestedGitLog(personal);

    // 手工占用锁, 模拟另一进程正在写
    writeFileSync(join(personal, '.dream.lock'), '999999');
    writeFileSync(join(personal, 'doc.md'), '# v2 while locked');

    const out = runScript({ CLAUDE_PROJECT_DIR: tmp, NOCODE_HISTORY_ROOT: history });
    const result = JSON.parse(out);
    assert.equal(result.status, 'skipped_locked');

    const logAfter = nestedGitLog(personal);
    assert.equal(logBefore, logAfter, '拿不到锁时不应产生新 commit');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
