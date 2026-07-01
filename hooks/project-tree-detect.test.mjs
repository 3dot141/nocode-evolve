// hooks/project-tree-detect.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { detectGitRepo, findUpperProjectRoot, refName } from '../scripts/project-tree-detect.mjs';

function makeTmpDir() {
  // realpath 立刻展开，避免 macOS /tmp -> /private/tmp 之类的 symlink 导致
  // 后续 git 返回值（git 内部已 realpath）与测试侧字符串比较时出现假性不等。
  return realpathSync(mkdtempSync(join(tmpdir(), 'ptd-test-')));
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function initRepo(dir) {
  git(['init', '-q', '-b', 'main', dir]);
  git(['-C', dir, 'config', 'user.email', 'test@local']);
  git(['-C', dir, 'config', 'user.name', 'test']);
  git(['-C', dir, 'commit', '--allow-empty', '-q', '-m', 'init']); // 保证 HEAD 存在，供 update-ref 测试使用
}

function checkRefFormat(name) {
  try {
    execFileSync('git', ['check-ref-format', '--allow-onelevel', name], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

function scriptPath() {
  return join(import.meta.dirname, '..', 'scripts', 'project-tree-detect.mjs');
}

function runCli(args) {
  return execFileSync('node', [scriptPath(), ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

// ── detectGitRepo ──

test('detectGitRepo — git 仓库内目录返回 true', () => {
  const tmp = makeTmpDir();
  try {
    initRepo(tmp);
    assert.equal(detectGitRepo(tmp), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('detectGitRepo — 非 git 目录返回 false', () => {
  const tmp = makeTmpDir();
  try {
    assert.equal(detectGitRepo(tmp), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('detectGitRepo — git 仓库的子目录也返回 true（git 自己逐级向上找 .git）', () => {
  const tmp = makeTmpDir();
  try {
    initRepo(tmp);
    const sub = join(tmp, 'src');
    mkdirSync(sub);
    assert.equal(detectGitRepo(sub), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── findUpperProjectRoot ──

test('findUpperProjectRoot — 目标目录本身是 git 根 → 返回自身', () => {
  const tmp = makeTmpDir();
  try {
    initRepo(tmp);
    assert.equal(findUpperProjectRoot(tmp), tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('findUpperProjectRoot — 目标目录是某仓库子目录 → 返回该仓库根', () => {
  const tmp = makeTmpDir();
  try {
    initRepo(tmp);
    const sub = join(tmp, 'src', 'nested');
    mkdirSync(sub, { recursive: true });
    assert.equal(findUpperProjectRoot(sub), tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('findUpperProjectRoot — 完全没有 .git → 返回目标目录本身（两候选退化为同一个）', () => {
  const tmp = makeTmpDir();
  try {
    const sub = join(tmp, 'no-git-here');
    mkdirSync(sub);
    assert.equal(findUpperProjectRoot(sub), sub);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── refName ──

test('refName — dirPath === gitRoot 时返回 refs/dream/last-baseline__root，不含尾部斜杠，check-ref-format 通过', () => {
  const tmp = makeTmpDir();
  try {
    const name = refName(tmp, tmp);
    assert.equal(name, 'refs/dream/last-baseline__root');
    assert.ok(!name.endsWith('/'), '不应有尾部斜杠');
    assert.ok(checkRefFormat(name), 'git check-ref-format --allow-onelevel 应校验通过');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('refName — 子目录 src 返回合法且与 root 不同的 ref 名', () => {
  const tmp = makeTmpDir();
  try {
    const src = join(tmp, 'src');
    mkdirSync(src);
    const name = refName(src, tmp);
    assert.equal(name, 'refs/dream/last-baseline__src');
    assert.notEqual(name, refName(tmp, tmp));
    assert.ok(checkRefFormat(name), 'git check-ref-format --allow-onelevel 应校验通过');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('refName — docs 与 src 两个不同子目录返回不同且都合法的 ref 名', () => {
  const tmp = makeTmpDir();
  try {
    const src = join(tmp, 'src');
    const docs = join(tmp, 'docs');
    mkdirSync(src);
    mkdirSync(docs);
    const nameSrc = refName(src, tmp);
    const nameDocs = refName(docs, tmp);
    assert.notEqual(nameSrc, nameDocs);
    assert.ok(checkRefFormat(nameSrc));
    assert.ok(checkRefFormat(nameDocs));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('refName — 多级嵌套子目录把 / 替换成 _，仍是单层合法 ref', () => {
  const tmp = makeTmpDir();
  try {
    const nested = join(tmp, 'skills', 'dev-build');
    mkdirSync(nested, { recursive: true });
    const name = refName(nested, tmp);
    assert.equal(name, 'refs/dream/last-baseline__skills_dev-build');
    assert.ok(checkRefFormat(name));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── D/F 冲突：同一 repo 先后为根目录和子目录建 ref，不冲突 ──

test('同一 repo 先后为根目录(root)和子目录(src)建 ref，两者能同时存在，不发生 D/F 冲突', () => {
  const tmp = makeTmpDir();
  try {
    initRepo(tmp);
    const src = join(tmp, 'src');
    mkdirSync(src);

    const rootRef = refName(tmp, tmp);
    const srcRef = refName(src, tmp);

    git(['-C', tmp, 'update-ref', rootRef, 'HEAD']);
    assert.doesNotThrow(() => git(['-C', tmp, 'update-ref', srcRef, 'HEAD']));

    const rootSha = git(['-C', tmp, 'rev-parse', rootRef]);
    const srcSha = git(['-C', tmp, 'rev-parse', srcRef]);
    assert.match(rootSha, /^[0-9a-f]{40}$/, 'root ref 应能解析成合法 commit sha');
    assert.match(srcSha, /^[0-9a-f]{40}$/, 'src ref 应能解析成合法 commit sha');

    const listing = git(['-C', tmp, 'for-each-ref', 'refs/dream/']);
    assert.match(listing, /last-baseline__root/, 'for-each-ref 应同时列出 root ref');
    assert.match(listing, /last-baseline__src/, 'for-each-ref 应同时列出 src ref');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── CLI 层 ──

test('CLI detect 子命令 — git 仓库返回 isGitRepo true 且带 gitRoot', () => {
  const tmp = makeTmpDir();
  try {
    initRepo(tmp);
    const out = JSON.parse(runCli(['detect', tmp]));
    assert.equal(out.isGitRepo, true);
    assert.equal(out.gitRoot, tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI detect 子命令 — 非 git 目录返回 isGitRepo false 且 gitRoot 为 null', () => {
  const tmp = makeTmpDir();
  try {
    const out = JSON.parse(runCli(['detect', tmp]));
    assert.equal(out.isGitRepo, false);
    assert.equal(out.gitRoot, null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI find-root 子命令 — 非 git 目录时 sameAsDirPath 为 true', () => {
  const tmp = makeTmpDir();
  try {
    const out = JSON.parse(runCli(['find-root', tmp]));
    assert.equal(out.sameAsDirPath, true);
    assert.equal(out.upperRoot, tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI ref-name 子命令 — 输出与直接调用 refName 一致', () => {
  const tmp = makeTmpDir();
  try {
    const src = join(tmp, 'src');
    mkdirSync(src);
    const out = JSON.parse(runCli(['ref-name', src, tmp]));
    assert.equal(out.refName, refName(src, tmp));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
