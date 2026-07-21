import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync, execFileSync } from 'node:child_process';
import {
  diffSinceBaseline,
  setBaseline,
  hasChanges,
  currentBranch,
  MONITORED_PATHS,
} from '../scripts/plugin-dream-baseline.mjs';

function git(repo, cmd) {
  return execSync(`git -C "${repo}" ${cmd}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function commit(repo, message) {
  git(repo, 'add -A');
  git(repo, `-c user.name=test -c user.email=test@test.local commit -m "${message}"`);
}

function makeRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'pdb-test-'));
  git(repo, 'init -q -b main');
  mkdirSync(join(repo, 'rules'), { recursive: true });
  mkdirSync(join(repo, 'skills'), { recursive: true });
  mkdirSync(join(repo, 'commands'), { recursive: true });
  mkdirSync(join(repo, 'hooks'), { recursive: true });
  mkdirSync(join(repo, 'scripts'), { recursive: true });
  mkdirSync(join(repo, '.claude-plugin'), { recursive: true });
  mkdirSync(join(repo, 'docs'), { recursive: true }); // 监控范围之外的目录，用来验证"变化不计入"

  writeFileSync(join(repo, 'rules', 'rule-foo.md'), '# rule-foo v1\n');
  writeFileSync(join(repo, 'rules', 'manifest.json'), '{"buckets":[],"rules":[]}\n');
  writeFileSync(join(repo, 'hooks', 'generate.mjs'), '// generate v1\n');
  writeFileSync(join(repo, 'scripts', 'vendor-sync.mjs'), '// vendor-sync v1\n');
  writeFileSync(join(repo, '.claude-plugin', 'plugin.json'), '{"version":"1.0.0"}\n');
  writeFileSync(join(repo, 'docs', 'readme.md'), '# docs\n');
  commit(repo, 'init');

  git(repo, 'checkout -q -b feat/dream-incremental');
  return repo;
}

function cleanup(repo) {
  rmSync(repo, { recursive: true, force: true });
}

test('首次运行（无 baseline）→ 返回 null', () => {
  const repo = makeRepo();
  try {
    const result = diffSinceBaseline(repo);
    assert.equal(result, null);
  } finally {
    cleanup(repo);
  }
});

test('baseline 指向的 commit 不可达（模拟 rebase 丢失）→ 捕获异常降级为 null', () => {
  const repo = makeRepo();
  try {
    const branch = currentBranch(repo);
    const fakeSha = '0'.repeat(40);
    git(repo, `config branch.${branch}.nocode-plugin-dream-baseline ${fakeSha}`);

    const result = diffSinceBaseline(repo);
    assert.equal(result, null, '异常应被捕获，不冒泡，降级为 null（走全量分支）');
  } finally {
    cleanup(repo);
  }
});

test('commit 无变化但 working tree 有未提交改动 → 判定"有变化"', () => {
  const repo = makeRepo();
  try {
    setBaseline(repo);
    writeFileSync(join(repo, 'rules', 'rule-foo.md'), '# rule-foo v2 (uncommitted)\n');

    const result = diffSinceBaseline(repo);
    assert.notEqual(result, null);
    assert.equal(result.commitDiff.length, 0, 'commit 层面没有新变化');
    assert.ok(result.dirtyFiles.includes('rules/rule-foo.md'), 'working tree 未提交改动应被捕捉');
    assert.equal(hasChanges(result), true);
  } finally {
    cleanup(repo);
  }
});

test('setBaseline(pluginRoot) 写入当前分支的 baseline git config key，值为当前 HEAD commit sha', () => {
  const repo = makeRepo();
  try {
    const branch = currentBranch(repo);
    const headSha = git(repo, 'rev-parse HEAD');

    const result = setBaseline(repo);
    assert.equal(result.branch, branch);
    assert.equal(result.baseline, headSha);

    const configured = git(repo, `config branch.${branch}.nocode-plugin-dream-baseline`);
    assert.equal(configured, headSha);
  } finally {
    cleanup(repo);
  }
});

test('监控范围常量含 hooks/ 与 scripts/ 整个目录（不只是 generate.mjs/vendor-sync.mjs 两个具体文件）', () => {
  assert.ok(MONITORED_PATHS.includes('hooks/'));
  assert.ok(MONITORED_PATHS.includes('scripts/'));
  assert.ok(
    !MONITORED_PATHS.some((p) => p.includes('generate.mjs') || p.includes('vendor-sync.mjs')),
    '不应硬编码具体文件名——应是整个目录路径'
  );
});

test('双平台架构监控 source/adapter/metadata/marketplace，不把生成物当源', () => {
  for (const expected of [
    'core/',
    'adapters/',
    'plugin/metadata.json',
    '.claude-plugin/marketplace.json',
    '.agents/plugins/marketplace.json',
  ]) {
    assert.ok(MONITORED_PATHS.includes(expected), `应监控 ${expected}`);
  }
  assert.equal(MONITORED_PATHS.some((item) => item.startsWith('plugins/')), false);
  assert.equal(MONITORED_PATHS.includes('.claude-plugin/plugin.json'), false);
});

test('监控范围含 hooks/ scripts/ 整目录 → 该目录下新文件（非 generate.mjs/vendor-sync.mjs）也能被增量检测捕获', () => {
  const repo = makeRepo();
  try {
    setBaseline(repo);

    writeFileSync(join(repo, 'hooks', 'usage-tracker.mjs'), '// usage-tracker v1\n');
    writeFileSync(join(repo, 'scripts', 'repo-lock.mjs'), '// repo-lock v1\n');
    commit(repo, 'add usage-tracker + repo-lock');

    const result = diffSinceBaseline(repo);
    assert.notEqual(result, null);
    assert.ok(result.commitDiff.includes('hooks/usage-tracker.mjs'));
    assert.ok(result.commitDiff.includes('scripts/repo-lock.mjs'));
    assert.equal(hasChanges(result), true);
  } finally {
    cleanup(repo);
  }
});

test('baseline 之后完全无变化（无新 commit、working tree clean）→ 判定"无变化"', () => {
  const repo = makeRepo();
  try {
    setBaseline(repo);
    const result = diffSinceBaseline(repo);
    assert.deepEqual(result, { commitDiff: [], dirtyFiles: [] });
    assert.equal(hasChanges(result), false);
  } finally {
    cleanup(repo);
  }
});

test('监控范围之外的路径（如 docs/）变化不计入 diff', () => {
  const repo = makeRepo();
  try {
    setBaseline(repo);
    writeFileSync(join(repo, 'docs', 'readme.md'), '# docs v2\n');
    commit(repo, 'update docs only');

    const result = diffSinceBaseline(repo);
    assert.notEqual(result, null);
    assert.equal(result.commitDiff.length, 0, 'docs/ 不在监控范围内，不应计入 commitDiff');
    assert.equal(hasChanges(result), false);
  } finally {
    cleanup(repo);
  }
});

test('分支名含斜杠（如 feat/dream-incremental）时 baseline 读写不受影响', () => {
  const repo = makeRepo();
  try {
    const branch = currentBranch(repo);
    assert.equal(branch, 'feat/dream-incremental');

    setBaseline(repo);
    const configured = git(repo, `config branch.${branch}.nocode-plugin-dream-baseline`);
    assert.ok(configured, '带斜杠的分支名也应能正确写入/读取 git config');
  } finally {
    cleanup(repo);
  }
});

test('working tree 有 rename（如 rules/rule-foo.md → rules/rule-bar.md）→ dirtyFiles 取重命名后的新路径（Round 2 复审 W4）', () => {
  const repo = makeRepo();
  try {
    setBaseline(repo);
    git(repo, 'mv rules/rule-foo.md rules/rule-bar.md');

    const result = diffSinceBaseline(repo);
    assert.notEqual(result, null);
    assert.ok(
      result.dirtyFiles.includes('rules/rule-bar.md'),
      `rename 行应解析出新路径而非 "old -> new" 组合字符串（实际: ${JSON.stringify(result.dirtyFiles)}）`
    );
    assert.ok(!result.dirtyFiles.some((p) => p.includes(' -> ')), '不应残留箭头分隔的组合字符串');
  } finally {
    cleanup(repo);
  }
});

// ── 分支名命令注入回归测试（Review Round 复审 C1，已用 PoC 复现后修复）──

test('分支名含 shell 元字符（分号 + ${IFS}）时 currentBranch/diffSinceBaseline/setBaseline 都不触发命令执行', () => {
  const repo = makeRepo();
  try {
    // 分号 + ${IFS}（代替字面空格，git 分支名不允许空格）是一个合法的 git 分支名，
    // 若 git() helper 用字符串拼接 + execSync（shell 解释）会在这里执行 touch。
    // 用 execFileSync（参数数组，不经过 shell）建分支——这是测试 setup 代码本身要绕开
    // shell 解释才能把"字面上的 ${IFS} 四个字符"真正写进分支名，不代表被测实现也这样处理。
    const maliciousBranch = 'pwn;touch${IFS}/tmp/pdb-baseline-should-not-exist;echo${IFS}x';
    execFileSync('git', ['-C', repo, 'checkout', '-q', '-b', maliciousBranch]);

    const branch = currentBranch(repo);
    assert.equal(branch, maliciousBranch, 'currentBranch 应原样返回分支名，不应崩溃');

    assert.doesNotThrow(() => diffSinceBaseline(repo));
    assert.doesNotThrow(() => setBaseline(repo));

    assert.ok(
      !existsSync('/tmp/pdb-baseline-should-not-exist'),
      '恶意分支名不应触发任何 shell 命令执行'
    );
  } finally {
    rmSync('/tmp/pdb-baseline-should-not-exist', { force: true });
    cleanup(repo);
  }
});
