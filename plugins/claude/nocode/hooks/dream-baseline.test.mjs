import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { diffSinceBaseline, advanceBaseline, projectLockDir } from '../scripts/dream-baseline.mjs';

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'db-test-'));
}

function initRepo(tmp) {
  execSync(`git init -q -b main "${tmp}"`, { stdio: ['pipe', 'pipe', 'pipe'] });
  const gitDir = join(tmp, '.git');
  execSync(`git --git-dir="${gitDir}" config user.email test@test.com`);
  execSync(`git --git-dir="${gitDir}" config user.name test`);
  return { gitDir, workTree: tmp };
}

function commitAll(gitDir, workTree, message) {
  execSync(`git --git-dir="${gitDir}" --work-tree="${workTree}" add -A`);
  execSync(`git --git-dir="${gitDir}" --work-tree="${workTree}" commit -q -m "${message}"`);
}

function revParse(gitDir, ref) {
  return execSync(`git --git-dir="${gitDir}" rev-parse ${ref}`, { encoding: 'utf8' }).trim();
}

// ── 首次 / 损坏降级 ──

test('diffSinceBaseline — ref 不存在（首次运行）返回 null，不抛异常', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'a.txt'), 'hello');
    commitAll(gitDir, workTree, 'init');

    const result = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline');
    assert.equal(result, null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('diffSinceBaseline — ref 存在但指向已丢失的 commit（损坏）返回 null，不崩溃', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'a.txt'), 'hello');
    commitAll(gitDir, workTree, 'init');

    const refPath = join(gitDir, 'refs', 'dream', 'last-baseline');
    mkdirSync(dirname(refPath), { recursive: true });
    writeFileSync(refPath, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n');

    assert.doesNotThrow(() => {
      const result = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline');
      assert.equal(result, null);
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── excludePaths ──

test('diffSinceBaseline — excludePaths 排除 wiki/status.md 自身变化（personal-dream 用例）', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    mkdirSync(join(tmp, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(tmp, 'wiki', 'status.md'), '# status v1');
    writeFileSync(join(tmp, 'wiki', 'pages', 'foo.md'), '# foo v1');
    commitAll(gitDir, workTree, 'init');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline HEAD`);

    writeFileSync(join(tmp, 'wiki', 'status.md'), '# status v2');
    writeFileSync(join(tmp, 'wiki', 'pages', 'foo.md'), '# foo v2');
    commitAll(gitDir, workTree, 'update');

    const result = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline', {
      excludePaths: ['wiki/status.md'],
    });
    assert.ok(Array.isArray(result));
    assert.ok(result.includes('wiki/pages/foo.md'), 'status.md 以外的变化应出现在结果里');
    assert.ok(!result.includes('wiki/status.md'), 'status.md 自身变化应被排除');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── advanceBaseline / hadFailures ──

test('advanceBaseline — hadFailures=true 不移动 ref', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'a.txt'), 'v1');
    commitAll(gitDir, workTree, 'c1');
    const c1 = revParse(gitDir, 'HEAD');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline HEAD`);

    writeFileSync(join(tmp, 'a.txt'), 'v2');
    commitAll(gitDir, workTree, 'c2');

    advanceBaseline(gitDir, 'refs/dream/last-baseline', true);

    const refAfter = revParse(gitDir, 'refs/dream/last-baseline');
    assert.equal(refAfter, c1, 'hadFailures=true 时 baseline 不应前移');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('advanceBaseline — hadFailures=false 时前移 ref 到当前 HEAD', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'a.txt'), 'v1');
    commitAll(gitDir, workTree, 'c1');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline HEAD`);

    writeFileSync(join(tmp, 'a.txt'), 'v2');
    commitAll(gitDir, workTree, 'c2');
    const head = revParse(gitDir, 'HEAD');

    advanceBaseline(gitDir, 'refs/dream/last-baseline', false);

    const refAfter = revParse(gitDir, 'refs/dream/last-baseline');
    assert.equal(refAfter, head, 'hadFailures=false 时 baseline 应前移到 HEAD');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── prepareFn ──

test('diffSinceBaseline — 传入 prepareFn 时，diff 前会先调用它', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'a.txt'), 'v1');
    commitAll(gitDir, workTree, 'c1');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline HEAD`);

    let called = false;
    const prepareFn = () => {
      called = true;
      writeFileSync(join(tmp, 'b.txt'), 'from-prepare');
      commitAll(gitDir, workTree, 'prepare-snapshot');
    };

    const result = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline', { prepareFn });
    assert.equal(called, true, 'prepareFn 应被调用');
    assert.ok(result.includes('b.txt'), 'prepareFn 落的 commit 应出现在 diff 结果里');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('diffSinceBaseline — 不传 prepareFn 时跳过，不报错（project-dream 子目录场景）', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'a.txt'), 'v1');
    commitAll(gitDir, workTree, 'c1');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline HEAD`);

    assert.doesNotThrow(() => {
      const result = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline');
      assert.deepEqual(result, [], '无 prepareFn 且无新改动时应返回空数组，而非 null');
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── pathspec ──

test('diffSinceBaseline — 传入 pathspec 时，diff 结果只包含该范围内的变更文件（project-dream 子目录场景）', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    mkdirSync(join(tmp, 'src'), { recursive: true });
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, 'src', 'index.js'), 'v1');
    writeFileSync(join(tmp, 'docs', 'readme.md'), 'v1');
    commitAll(gitDir, workTree, 'init');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline__src HEAD`);

    writeFileSync(join(tmp, 'src', 'index.js'), 'v2');
    writeFileSync(join(tmp, 'docs', 'readme.md'), 'v2');
    commitAll(gitDir, workTree, 'update both dirs');

    const result = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline__src', {
      pathspec: 'src',
    });
    assert.deepEqual(result, ['src/index.js'], '只应包含 pathspec 范围内 (src/) 的变更');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── includeDirty（Round 2 复审 W1）──

test('diffSinceBaseline — includeDirty=true 时，working tree 未提交改动也计入结果（project-dream 场景）', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'a.txt'), 'v1');
    commitAll(gitDir, workTree, 'init');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline HEAD`);

    writeFileSync(join(tmp, 'a.txt'), 'v2 (uncommitted)'); // 不 commit，模拟用户正在编辑

    const withoutDirty = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline');
    assert.deepEqual(withoutDirty, [], '不传 includeDirty 时纯 commit diff 看不到未提交改动');

    const withDirty = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline', { includeDirty: true });
    assert.ok(withDirty.includes('a.txt'), 'includeDirty=true 时未提交改动应计入结果');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('diffSinceBaseline — includeDirty=true 时 rename 行取重命名后的新路径（与 plugin-dream-baseline 一致）', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'old.txt'), 'v1');
    commitAll(gitDir, workTree, 'init');
    execSync(`git --git-dir="${gitDir}" update-ref refs/dream/last-baseline HEAD`);

    execSync(`git --git-dir="${gitDir}" --work-tree="${workTree}" mv old.txt new.txt`);

    const result = diffSinceBaseline(gitDir, workTree, 'refs/dream/last-baseline', { includeDirty: true });
    assert.ok(result.includes('new.txt'), `应解析出新路径 (实际: ${JSON.stringify(result)})`);
    assert.ok(!result.some((p) => p.includes(' -> ')), '不应残留箭头分隔的组合字符串');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── lockDir 参数化（Review 复审 W3：project-dream 锁文件不应落在用户工作区）──

test('projectLockDir(gitRoot) 返回 <gitRoot>/.git', () => {
  assert.equal(projectLockDir('/foo/bar'), join('/foo/bar', '.git'));
});

test('advanceBaseline — 传入 options.lockDir 时锁文件落在指定目录而非 dirname(gitDir)', () => {
  const tmp = makeTmpDir();
  try {
    const { gitDir, workTree } = initRepo(tmp);
    writeFileSync(join(tmp, 'a.txt'), 'v1');
    commitAll(gitDir, workTree, 'c1');

    advanceBaseline(gitDir, 'refs/dream/last-baseline', false, { lockDir: projectLockDir(tmp) });

    assert.ok(!existsSync(join(tmp, '.dream.lock')), '不传 lockDir 时的默认位置不应有锁文件残留');
    assert.equal(
      execSync(`git --git-dir="${gitDir}" rev-parse refs/dream/last-baseline`, { encoding: 'utf8' }).trim(),
      execSync(`git --git-dir="${gitDir}" rev-parse HEAD`, { encoding: 'utf8' }).trim(),
      'lockDir 只影响锁文件位置，不影响 baseline 前移本身'
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
