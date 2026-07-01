import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  resolveKey,
  recordUsage,
  parseStatusMd,
  renderStatusMd,
  todayDate,
  DEFAULT_PREAMBLE,
} from './usage-tracker.mjs';
import { RepoLock } from '../scripts/repo-lock.mjs';

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'ut-test-'));
}

function runScript(stdinObj, env = {}) {
  const script = join(import.meta.dirname, 'usage-tracker.mjs');
  return execFileSync('node', [script], {
    encoding: 'utf8',
    input: JSON.stringify(stdinObj),
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

test('resolveKey: 非 Read 工具调用 → null，无副作用', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'pages', 'foo.md'), '# foo');
    const event = { tool_name: 'Write', tool_input: { file_path: join(personal, 'wiki', 'pages', 'foo.md') } };
    assert.equal(resolveKey(event, tmp), null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: Read 但 file_path 不含 "wiki" 子串 → null', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(personal, { recursive: true });
    const outside = join(tmp, 'README.md');
    writeFileSync(outside, '# readme');
    const event = { tool_name: 'Read', tool_input: { file_path: outside } };
    assert.equal(resolveKey(event, tmp), null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: 无 .agents-personal/ → null', () => {
  const tmp = makeTmpDir();
  try {
    const event = { tool_name: 'Read', tool_input: { file_path: join(tmp, 'some-wiki-file.md') } };
    assert.equal(resolveKey(event, tmp), null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: Read wiki/ 下但非 pages|draft（如 index.md）→ 跳过', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'index.md'), '# index');
    const event = { tool_name: 'Read', tool_input: { file_path: join(personal, 'wiki', 'index.md') } };
    assert.equal(resolveKey(event, tmp), null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: Read wiki/pages/ 页面 → 命中，key 去掉 .md 前缀含 pages/', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'pages', 'project-overview.md'), '# overview');
    const event = { tool_name: 'Read', tool_input: { file_path: join(personal, 'wiki', 'pages', 'project-overview.md') } };
    assert.equal(resolveKey(event, tmp), 'pages/project-overview');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: Read wiki/draft/ 页面 → 命中，key 含 draft/ 前缀（与同名 pages/ 页不合并）', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki', 'draft'), { recursive: true });
    mkdirSync(join(personal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'draft', '260701-foo.md'), '# draft foo');
    writeFileSync(join(personal, 'wiki', 'pages', 'foo.md'), '# real foo');
    const draftEvent = { tool_name: 'Read', tool_input: { file_path: join(personal, 'wiki', 'draft', '260701-foo.md') } };
    const pageEvent = { tool_name: 'Read', tool_input: { file_path: join(personal, 'wiki', 'pages', 'foo.md') } };
    assert.equal(resolveKey(draftEvent, tmp), 'draft/260701-foo');
    assert.equal(resolveKey(pageEvent, tmp), 'pages/foo');
    assert.notEqual(resolveKey(draftEvent, tmp), resolveKey(pageEvent, tmp));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: 相对路径输入以 projectDir 为基准解析（不依赖 process.cwd()，Round 2 复审 W8）', () => {
  const tmp = makeTmpDir();
  const cwdBefore = process.cwd();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'pages', 'rel.md'), '# rel');
    process.chdir(tmpdir()); // 故意让 cwd 偏离 projectDir，验证解析不依赖 cwd
    const event = { tool_name: 'Read', tool_input: { file_path: '.agents-personal/wiki/pages/rel.md' } };
    assert.equal(resolveKey(event, tmp), 'pages/rel');
  } finally {
    process.chdir(cwdBefore);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: file_path 已不存在（realpathSync 失败）→ null，不抛出', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki', 'pages'), { recursive: true });
    const event = { tool_name: 'Read', tool_input: { file_path: join(personal, 'wiki', 'pages', 'gone.md') } };
    assert.doesNotThrow(() => resolveKey(event, tmp));
    assert.equal(resolveKey(event, tmp), null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: tool_input 缺失 / file_path 非字符串 → null，不抛出', () => {
  assert.equal(resolveKey({ tool_name: 'Read' }, '/tmp'), null);
  assert.equal(resolveKey({ tool_name: 'Read', tool_input: {} }, '/tmp'), null);
  assert.equal(resolveKey({ tool_name: 'Read', tool_input: { file_path: 123 } }, '/tmp'), null);
});

test('resolveKey: worktree symlink 场景下 key 与主仓一致（不会因入口路径不同而分裂成两行）', () => {
  const tmp = makeTmpDir();
  try {
    const mainProject = join(tmp, 'main-project');
    const worktreeProject = join(tmp, 'worktree');
    const physicalPersonal = join(mainProject, '.agents-personal');

    mkdirSync(join(physicalPersonal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(physicalPersonal, 'wiki', 'pages', 'shared.md'), '# shared');
    mkdirSync(worktreeProject, { recursive: true });
    symlinkSync(physicalPersonal, join(worktreeProject, '.agents-personal'));

    const eventFromMain = {
      tool_name: 'Read',
      tool_input: { file_path: join(mainProject, '.agents-personal', 'wiki', 'pages', 'shared.md') },
    };
    const eventFromWorktree = {
      tool_name: 'Read',
      tool_input: { file_path: join(worktreeProject, '.agents-personal', 'wiki', 'pages', 'shared.md') },
    };

    const keyFromMain = resolveKey(eventFromMain, mainProject);
    const keyFromWorktree = resolveKey(eventFromWorktree, worktreeProject);

    assert.equal(keyFromMain, 'pages/shared');
    assert.equal(keyFromWorktree, 'pages/shared');
    assert.equal(keyFromMain, keyFromWorktree, '同一物理页面无论从哪个 worktree 读, key 必须一致');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveKey: 断裂 symlink（指向不存在路径）→ null，不崩溃', () => {
  const tmp = makeTmpDir();
  try {
    symlinkSync('/nonexistent/path/.agents-personal', join(tmp, '.agents-personal'));
    const event = { tool_name: 'Read', tool_input: { file_path: join(tmp, '.agents-personal', 'wiki', 'pages', 'x.md') } };
    assert.doesNotThrow(() => resolveKey(event, tmp));
    assert.equal(resolveKey(event, tmp), null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('parseStatusMd: 空内容 → 默认 preamble，rows 为空', () => {
  const parsed = parseStatusMd('');
  assert.equal(parsed.preamble, DEFAULT_PREAMBLE);
  assert.deepEqual(parsed.rows, []);
});

test('parseStatusMd: 无合法表格（损坏内容）→ 退化为默认骨架', () => {
  const parsed = parseStatusMd('# 随便写点什么\n没有表格\n');
  assert.equal(parsed.preamble, DEFAULT_PREAMBLE);
  assert.deepEqual(parsed.rows, []);
});

test('parseStatusMd: 解析已有表格行', () => {
  const content = `${DEFAULT_PREAMBLE}\n| pages/project-overview | 12 | 260701 |\n| draft/260701-hooks-system | 3 | 260628 |\n`;
  const parsed = parseStatusMd(content);
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(parsed.rows[0], { key: 'pages/project-overview', count: 12, lastReferenced: '260701' });
  assert.deepEqual(parsed.rows[1], { key: 'draft/260701-hooks-system', count: 3, lastReferenced: '260628' });
});

test('renderStatusMd → parseStatusMd 往返一致', () => {
  const rows = [
    { key: 'pages/a', count: 1, lastReferenced: '260701' },
    { key: 'draft/260701-b', count: 5, lastReferenced: '260630' },
  ];
  const rendered = renderStatusMd({ preamble: DEFAULT_PREAMBLE, rows });
  const reparsed = parseStatusMd(rendered);
  assert.deepEqual(reparsed.rows, rows);
});

test('todayDate: 返回 6 位 YYMMDD 格式', () => {
  assert.match(todayDate(), /^\d{6}$/);
});

test('recordUsage: status.md 不存在 → 创建骨架并写入新行', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(personal, { recursive: true });
    const result = recordUsage(personal, 'pages/new-page', { repoLock: RepoLock, now: () => '260701' });
    assert.equal(result.status, 'recorded');
    assert.equal(result.count, 1);

    const statusPath = join(personal, 'wiki', 'status.md');
    assert.ok(existsSync(statusPath));
    const parsed = parseStatusMd(readFileSync(statusPath, 'utf8'));
    assert.deepEqual(parsed.rows, [{ key: 'pages/new-page', count: 1, lastReferenced: '260701' }]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('recordUsage: 已有 key → 计数+1，最后引用时间刷新', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'status.md'), `${DEFAULT_PREAMBLE}\n| pages/existing | 4 | 260601 |\n`);

    const result = recordUsage(personal, 'pages/existing', { repoLock: RepoLock, now: () => '260701' });
    assert.equal(result.status, 'recorded');
    assert.equal(result.count, 5);

    const parsed = parseStatusMd(readFileSync(join(personal, 'wiki', 'status.md'), 'utf8'));
    assert.deepEqual(parsed.rows, [{ key: 'pages/existing', count: 5, lastReferenced: '260701' }]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('recordUsage: 新 key（status.md 里没有）→ 新增一行，已有行不受影响', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'status.md'), `${DEFAULT_PREAMBLE}\n| pages/old | 2 | 260601 |\n`);

    recordUsage(personal, 'pages/brand-new', { repoLock: RepoLock, now: () => '260701' });

    const parsed = parseStatusMd(readFileSync(join(personal, 'wiki', 'status.md'), 'utf8'));
    assert.equal(parsed.rows.length, 2);
    assert.deepEqual(parsed.rows[0], { key: 'pages/old', count: 2, lastReferenced: '260601' });
    assert.deepEqual(parsed.rows[1], { key: 'pages/brand-new', count: 1, lastReferenced: '260701' });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('recordUsage: 拿不到锁 → 返回 skipped_locked，不写文件，不阻塞', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(personal, { recursive: true });
    const fakeLock = { acquire: () => null, release: () => { throw new Error('不应被调用'); } };
    const result = recordUsage(personal, 'pages/x', { repoLock: fakeLock });
    assert.equal(result.status, 'skipped_locked');
    assert.ok(!existsSync(join(personal, 'wiki', 'status.md')));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('集成: 复用同一把 RepoLock — 锁被占用时短超时返回 null 不阻塞，释放后立即可用', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(personal, { recursive: true });

    const handle = RepoLock.acquire(personal, 2000);
    assert.ok(handle, '应先成功拿到锁');

    const blocked = recordUsage(personal, 'pages/x', { repoLock: RepoLock, timeoutMs: 150 });
    assert.equal(blocked.status, 'skipped_locked', '锁被占用时应短超时跳过而不是死等');

    RepoLock.release(handle);

    const ok = recordUsage(personal, 'pages/x', { repoLock: RepoLock, now: () => '260701' });
    assert.equal(ok.status, 'recorded', '锁释放后应能立即成功记录');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI: 非 Read 事件 → exit 0，无副作用', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'pages', 'foo.md'), '# foo');
    runScript(
      { tool_name: 'Write', tool_input: { file_path: join(personal, 'wiki', 'pages', 'foo.md') } },
      { CLAUDE_PROJECT_DIR: tmp },
    );
    assert.ok(!existsSync(join(personal, 'wiki', 'status.md')));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI: 命中 wiki 页 → status.md 落盘且计数正确', () => {
  const tmp = makeTmpDir();
  try {
    const personal = join(tmp, '.agents-personal');
    mkdirSync(join(personal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(personal, 'wiki', 'pages', 'foo.md'), '# foo');

    runScript(
      { tool_name: 'Read', tool_input: { file_path: join(personal, 'wiki', 'pages', 'foo.md') } },
      { CLAUDE_PROJECT_DIR: tmp },
    );
    runScript(
      { tool_name: 'Read', tool_input: { file_path: join(personal, 'wiki', 'pages', 'foo.md') } },
      { CLAUDE_PROJECT_DIR: tmp },
    );

    const parsed = parseStatusMd(readFileSync(join(personal, 'wiki', 'status.md'), 'utf8'));
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].key, 'pages/foo');
    assert.equal(parsed.rows[0].count, 2);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI: worktree symlink 场景下正确记到主仓真实项目', () => {
  const tmp = makeTmpDir();
  try {
    const mainProject = join(tmp, 'main-project');
    const worktreeProject = join(tmp, 'worktree');
    const physicalPersonal = join(mainProject, '.agents-personal');

    mkdirSync(join(physicalPersonal, 'wiki', 'pages'), { recursive: true });
    writeFileSync(join(physicalPersonal, 'wiki', 'pages', 'shared.md'), '# shared');
    mkdirSync(worktreeProject, { recursive: true });
    symlinkSync(physicalPersonal, join(worktreeProject, '.agents-personal'));

    runScript(
      { tool_name: 'Read', tool_input: { file_path: join(worktreeProject, '.agents-personal', 'wiki', 'pages', 'shared.md') } },
      { CLAUDE_PROJECT_DIR: worktreeProject },
    );

    const statusPath = join(physicalPersonal, 'wiki', 'status.md');
    assert.ok(existsSync(statusPath), 'status.md 应写入主仓物理路径');
    const parsed = parseStatusMd(readFileSync(statusPath, 'utf8'));
    assert.deepEqual(parsed.rows, [{ key: 'pages/shared', count: 1, lastReferenced: todayDate() }]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI: 非法 JSON stdin → exit 0，不抛异常', () => {
  const tmp = makeTmpDir();
  try {
    const script = join(import.meta.dirname, 'usage-tracker.mjs');
    assert.doesNotThrow(() => {
      execFileSync('node', [script], {
        encoding: 'utf8',
        input: '{ 不是合法 json',
        env: { ...process.env, CLAUDE_PROJECT_DIR: tmp },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
