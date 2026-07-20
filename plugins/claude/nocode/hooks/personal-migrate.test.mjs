import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { migrateIfNeeded } from '../scripts/personal-migrate.mjs';
import { acquire, release } from '../scripts/repo-lock.mjs';

const IS_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'pm-test-'));
}

function nestedGit(personalDir, cmd) {
  return execSync(`git --git-dir="${join(personalDir, '.git')}" --work-tree="${personalDir}" ${cmd}`, {
    encoding: 'utf8',
  }).trim();
}

function makeOldBareRepoWithHistory(bareDir, seedFileName = 'legacy.md', seedContent = '# legacy history') {
  mkdirSync(bareDir, { recursive: true });
  execSync(`git init --bare -b main "${bareDir}"`, { stdio: 'pipe' });
  const seedWorktree = mkdtempSync(join(tmpdir(), 'pm-seed-'));
  writeFileSync(join(seedWorktree, seedFileName), seedContent);
  execSync(`git --git-dir="${bareDir}" --work-tree="${seedWorktree}" add -A -f`, { stdio: 'pipe' });
  execSync(
    `git -c user.name=seed -c user.email=seed@local --git-dir="${bareDir}" --work-tree="${seedWorktree}" commit -m "legacy commit"`,
    { stdio: 'pipe' }
  );
  rmSync(seedWorktree, { recursive: true, force: true });
}

test('case 1 — 完整迁移: 导入历史 + 迁移后 snapshot 产生新 commit + 旧 repo 改名 .migrated', () => {
  const tmp = makeTmpDir();
  const projectDir = join(tmp, 'project');
  const personal = join(projectDir, '.agents-personal');
  const oldBareDir = join(tmp, 'old-history-repo');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'current.md'), '# current state');
  makeOldBareRepoWithHistory(oldBareDir);

  try {
    const result = migrateIfNeeded(projectDir, oldBareDir);
    assert.equal(result.status, 'migrated');
    assert.ok(existsSync(join(personal, '.git')), '嵌套仓库应建立');

    const log = nestedGit(personal, 'log --oneline');
    const commits = log.split('\n').filter(Boolean);
    assert.equal(commits.length, 2, '应有旧历史 1 commit + 迁移后 snapshot 1 commit');
    assert.ok(log.includes('legacy commit'), '应导入旧仓库历史');

    const files = nestedGit(personal, 'ls-tree -r --name-only HEAD');
    assert.ok(files.includes('current.md'), '迁移后 snapshot 应吸收当前磁盘状态');
    assert.ok(!files.includes('legacy.md'), 'legacy.md 磁盘上已不存在, 迁移 snapshot 应体现为已删除');

    assert.ok(existsSync(`${oldBareDir}.migrated`), '旧 bare repo 应被改名为 .migrated');
    assert.ok(!existsSync(oldBareDir), '旧路径不应再存在');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 2 — git fetch 失败 (旧 repo 损坏): 不改动任何现状, 只 warn, 返回 failed', () => {
  const tmp = makeTmpDir();
  const projectDir = join(tmp, 'project');
  const personal = join(projectDir, '.agents-personal');
  const oldBareDir = join(tmp, 'corrupt-old-repo');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'current.md'), '# current state');
  mkdirSync(oldBareDir, { recursive: true });
  writeFileSync(join(oldBareDir, 'not-a-git-repo'), 'garbage');

  try {
    const result = migrateIfNeeded(projectDir, oldBareDir);
    assert.equal(result.status, 'failed');
    assert.ok(!existsSync(join(personal, '.git')), '.git 不应被建立, 现状不应改动');
    assert.ok(existsSync(oldBareDir), '旧目录不应被改名或删除');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 3 — 拿不到 RepoLock: 返回 skipped_locked, 不阻塞', () => {
  const tmp = makeTmpDir();
  const projectDir = join(tmp, 'project');
  const personal = join(projectDir, '.agents-personal');
  const oldBareDir = join(tmp, 'old-history-repo');
  mkdirSync(personal, { recursive: true });
  makeOldBareRepoWithHistory(oldBareDir);

  const handle = acquire(personal, 2000);
  assert.ok(handle, '预先占用锁应成功');

  try {
    const result = migrateIfNeeded(projectDir, oldBareDir);
    assert.equal(result.status, 'skipped_locked');
    assert.ok(!existsSync(join(personal, '.git')), '拿不到锁时不应有任何写入');
  } finally {
    release(handle);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test(
  'case 4 — 旧 repo 改名步骤失败: .git 已迁移完成不受影响, 下次调用直接补做改名',
  { skip: IS_ROOT ? 'root 用户会绕过权限检查, 跳过' : false },
  () => {
    const tmp = makeTmpDir();
    const projectDir = join(tmp, 'project');
    const personal = join(projectDir, '.agents-personal');
    const oldBareDir = join(tmp, 'old-history-repo');
    mkdirSync(personal, { recursive: true });
    writeFileSync(join(personal, 'current.md'), '# current state');
    makeOldBareRepoWithHistory(oldBareDir);

    try {
      chmodSync(tmp, 0o555); // tmp 只读 → rename(oldBareDir, oldBareDir+'.migrated') 必然失败
      const result = migrateIfNeeded(projectDir, oldBareDir);
      assert.equal(result.status, 'migrated', '.git 迁移本身应成功, 不受改名失败影响');
      assert.ok(existsSync(join(personal, '.git')), '.git 应已就绪');
      assert.ok(existsSync(oldBareDir), '改名失败, 旧目录应仍在原位');

      chmodSync(tmp, 0o755);
      const beforeLog = nestedGit(personal, 'log --oneline');
      const result2 = migrateIfNeeded(projectDir, oldBareDir);
      assert.equal(result2.status, 'migrated_rename_completed');
      assert.ok(existsSync(`${oldBareDir}.migrated`), '补做改名应成功');
      assert.ok(!existsSync(oldBareDir));
      const afterLog = nestedGit(personal, 'log --oneline');
      assert.equal(beforeLog, afterLog, '补做改名不应重新导入历史, commit 历史不变');
    } finally {
      try {
        chmodSync(tmp, 0o755);
      } catch {
        /* ignore */
      }
      rmSync(tmp, { recursive: true, force: true });
    }
  }
);

test('case 5 — .git 不存在 + 旧 repo 也不存在: 无需迁移', () => {
  const tmp = makeTmpDir();
  const projectDir = join(tmp, 'project');
  const personal = join(projectDir, '.agents-personal');
  const oldBareDir = join(tmp, 'never-existed');
  mkdirSync(personal, { recursive: true });

  try {
    const result = migrateIfNeeded(projectDir, oldBareDir);
    assert.equal(result.status, 'no_old_repo');
    assert.ok(!existsSync(join(personal, '.git')));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('case 6 — .git 已存在 + 旧 repo 不存在: 视为已完成迁移, 无操作', () => {
  const tmp = makeTmpDir();
  const projectDir = join(tmp, 'project');
  const personal = join(projectDir, '.agents-personal');
  const oldBareDir = join(tmp, 'never-existed');
  mkdirSync(personal, { recursive: true });
  execSync(`git init -b main "${personal}"`, { stdio: 'pipe' });

  try {
    const result = migrateIfNeeded(projectDir, oldBareDir);
    assert.equal(result.status, 'already_migrated');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
