import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { git, gitQuiet, gitArgs, parsePorcelain } from '../scripts/git-exec.mjs';

function makeRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'git-exec-test-'));
  execFileSync('git', ['init', '-q', '-b', 'main', repo]);
  execFileSync('git', ['-C', repo, 'config', 'user.email', 't@t.com']);
  execFileSync('git', ['-C', repo, 'config', 'user.name', 't']);
  return repo;
}

test('gitArgs — 组装 --git-dir/--work-tree/-C/-c 前缀参数', () => {
  assert.deepEqual(gitArgs({ gitDir: '/a/.git', workTree: '/a' }), ['--git-dir=/a/.git', '--work-tree=/a']);
  assert.deepEqual(gitArgs({ cwd: '/a' }), ['-C', '/a']);
  assert.deepEqual(gitArgs({ cwd: '/a', config: { 'user.name': 'x' } }), ['-c', 'user.name=x', '-C', '/a']);
});

test('git — 正常执行返回 trim 过尾部空白的输出', () => {
  const repo = makeRepo();
  try {
    writeFileSync(join(repo, 'a.txt'), 'hello');
    execFileSync('git', ['-C', repo, 'add', '-A']);
    execFileSync('git', ['-C', repo, 'commit', '-q', '-m', 'init']);
    const out = git({ cwd: repo }, ['rev-parse', '--abbrev-ref', 'HEAD']);
    assert.equal(out, 'main');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('git — 路径含空格时也能正确工作（不再依赖字符串拼接, Round 2 复审 W1 修复）', () => {
  const parent = mkdtempSync(join(tmpdir(), 'git-exec-space-'));
  const repo = join(parent, 'has space');
  try {
    execFileSync('git', ['init', '-q', '-b', 'main', repo]);
    execFileSync('git', ['-C', repo, 'config', 'user.email', 't@t.com']);
    execFileSync('git', ['-C', repo, 'config', 'user.name', 't']);
    writeFileSync(join(repo, 'a.txt'), 'hello');
    const gitDir = join(repo, '.git');
    git({ gitDir, workTree: repo }, ['add', '-A']);
    git({ gitDir, workTree: repo, config: { 'user.name': 'snapshot', 'user.email': 'snapshot@local' } }, ['commit', '-m', 'auto: test']);
    const log = git({ gitDir }, ['log', '--oneline']);
    assert.match(log, /auto: test/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('git — 子命令参数含 shell 元字符时不被解释（分支名场景, Round 2 复审 C1 修复）', () => {
  const repo = makeRepo();
  try {
    writeFileSync(join(repo, 'a.txt'), 'v1');
    execFileSync('git', ['-C', repo, 'add', '-A']);
    execFileSync('git', ['-C', repo, 'commit', '-q', '-m', 'init']);
    // git 分支名不允许空格/$()/反引号, 但允许分号 —— 用 ${IFS} 代替字面空格构造一个
    // "合法的 git 分支名, 但若被朴素字符串拼接进 shell 命令会执行任意命令" 的 PoC。
    const maliciousBranch = 'pwn;touch${IFS}/tmp/should-not-exist-git-exec-test;echo${IFS}x';
    execFileSync('git', ['-C', repo, 'checkout', '-q', '-b', maliciousBranch]);
    const branch = git({ cwd: repo }, ['rev-parse', '--abbrev-ref', 'HEAD']);
    assert.equal(branch, maliciousBranch, '分支名原样返回，不应触发任何命令执行');
    // 用这个"恶意"分支名去构造 git config key（不逃逸），确认不会执行任何命令
    git({ cwd: repo, allowFail: true }, ['config', `branch.${branch}.test-key`, 'value'], { allowFail: true });
    assert.ok(!existsSync('/tmp/should-not-exist-git-exec-test'), '恶意分支名不应触发任何 shell 命令执行');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('git — allowFail=true 时命令失败返回空字符串而不抛异常', () => {
  const repo = makeRepo();
  try {
    const out = git({ cwd: repo }, ['config', 'nonexistent.key'], { allowFail: true });
    assert.equal(out, '');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('git — allowFail=false（默认）时命令失败抛出携带 status 的异常', () => {
  const repo = makeRepo();
  try {
    assert.throws(() => git({ cwd: repo }, ['config', 'nonexistent.key']), (e) => typeof e.status === 'number');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('gitQuiet — 只关心成功/失败', () => {
  const repo = makeRepo();
  try {
    assert.equal(gitQuiet({ cwd: repo }, ['rev-parse', 'HEAD']), false, '无 commit 时应失败');
    writeFileSync(join(repo, 'a.txt'), 'v1');
    execFileSync('git', ['-C', repo, 'add', '-A']);
    execFileSync('git', ['-C', repo, 'commit', '-q', '-m', 'init']);
    assert.equal(gitQuiet({ cwd: repo }, ['rev-parse', 'HEAD']), true);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('parsePorcelain — 解析普通改动行', () => {
  assert.deepEqual(parsePorcelain(' M rules/rule-foo.md\n?? new.md\n'), ['rules/rule-foo.md', 'new.md']);
});

test('parsePorcelain — rename 行取箭头后的新路径', () => {
  const result = parsePorcelain('R  old.txt -> new.txt\n');
  assert.deepEqual(result, ['new.txt']);
});

test('parsePorcelain — 空输入返回空数组', () => {
  assert.deepEqual(parsePorcelain(''), []);
  assert.deepEqual(parsePorcelain(null), []);
});
