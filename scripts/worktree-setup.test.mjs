import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseGitStatus,
  detectPkgManager,
  planEnvCopies,
  planIdeCopies,
  planNodeModules,
  copyWithFallback,
  setup,
  teardown,
  parseArgs,
} from './worktree-setup.mjs';

// ---- fixture 工具: 真实 tmp 目录, 不 mock fs ----
function mkfix() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-setup-'));
  const project = path.join(root, 'proj');
  const worktree = path.join(root, 'proj-branch');
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(worktree, { recursive: true });
  return { root, project, worktree, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}
function touch(p, content = '') { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); }
function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
// 记录注入的 run 调用; 可按谓词抛错
function recorder(throwIf = () => false) {
  const calls = [];
  const run = (argv) => {
    calls.push(argv);
    if (throwIf(argv)) throw new Error('injected failure: ' + argv.join(' '));
    return ''; // 默认 stdout 空 (git status clean)
  };
  return { run, calls };
}

// ===== BF4 — parseGitStatus (case 4.3) =====
test('case 4.3 — parseGitStatus 滤 ?? 行, modified 进 offenders', () => {
  const r = parseGitStatus('?? foo\n M bar\n');
  assert.equal(r.clean, false);
  assert.deepEqual(r.offenders, ['bar']);
});
test('case 4.3b — 只有 ?? 行视为 clean (gitignored cp 物正常)', () => {
  const r = parseGitStatus('?? .env.local\n?? node_modules/\n');
  assert.equal(r.clean, true);
  assert.deepEqual(r.offenders, []);
});

// ===== detectPkgManager (case 1.4 依赖) =====
test('detectPkgManager — pnpm-lock 优先识别 pnpm', () => {
  const f = mkfix();
  touch(path.join(f.worktree, 'pnpm-lock.yaml'));
  assert.equal(detectPkgManager(f.worktree), 'pnpm');
  f.cleanup();
});
test('detectPkgManager — 无任何 lock 返回 null', () => {
  const f = mkfix();
  assert.equal(detectPkgManager(f.worktree), null);
  f.cleanup();
});

// ===== BF3 同型 — planIdeCopies 幂等 (case 1.2) =====
test('case 1.2 — planIdeCopies 幂等: worktree 已有 .vscode 则不再 cp', () => {
  const f = mkfix();
  mkdir(path.join(f.project, '.vscode'));
  mkdir(path.join(f.project, '.idea'));
  mkdir(path.join(f.worktree, '.vscode')); // worktree 已有 .vscode
  const specs = planIdeCopies(f.project, f.worktree);
  const rels = specs.map((s) => s.rel);
  assert.ok(!rels.includes('.vscode'), '.vscode 已存在应跳过');
  assert.ok(rels.includes('.idea'), '.idea 不存在应 cp');
  f.cleanup();
});

// ===== BF3 — planNodeModules -prune 不重复嵌套 (case 3.1) =====
test('case 3.1 — planNodeModules 只列顶层 node_modules, 不下钻嵌套', () => {
  const f = mkfix();
  mkdir(path.join(f.project, 'node_modules', 'foo', 'node_modules')); // 顶层内嵌套
  const specs = planNodeModules(f.project, f.worktree);
  assert.equal(specs.length, 1, '只一条顶层 node_modules');
  assert.equal(specs[0].rel, 'node_modules');
  f.cleanup();
});
test('case 3.1b — 子包 node_modules 各列一条', () => {
  const f = mkfix();
  mkdir(path.join(f.project, 'node_modules'));
  mkdir(path.join(f.project, 'packages', 'a', 'node_modules'));
  const rels = planNodeModules(f.project, f.worktree).map((s) => s.rel).sort();
  assert.deepEqual(rels, ['node_modules', path.join('packages', 'a', 'node_modules')]);
  f.cleanup();
});

// ===== BF2 — planEnvCopies (v3.6.3+ 改人机分工: 脚本列候选, agent 判断 cp 哪些) =====
test('case 2.1 — 候选含 .env.local (gitignored 文件实际存在 → 候选)', () => {
  const f = mkfix();
  touch(path.join(f.project, '.gitignore'), '.env.local\nnode_modules/\n');
  touch(path.join(f.project, '.env.local'), 'X=1');
  const cands = planEnvCopies(f.project);
  assert.ok(cands.includes('.env.local'), '.env.local 应在候选');
  f.cleanup();
});

test('case 2.2 — v3.6.3+ 候选不再 filter, 列所有 gitignored 文件 (agent 决定 cp 哪些, 不脚本写死 keyword)', () => {
  const f = mkfix();
  // 旧测试期望 cands=[](锚定 pattern 排除 *.environment / *.log); v3.6.3+ 改 agent 判断, 候选全列.
  touch(path.join(f.project, '.gitignore'), 'dist/\n*.log\n*.environment\ndevelopment/\n');
  touch(path.join(f.project, 'app.environment'), '');
  mkdir(path.join(f.project, 'development'));
  touch(path.join(f.project, 'build.log'), '');
  const cands = planEnvCopies(f.project);
  assert.ok(cands.includes('app.environment'), 'app.environment 是文件应列候选 (agent 判断 cp 与否)');
  assert.ok(cands.includes('build.log'), 'build.log 是文件应列候选 (agent 判断)');
  assert.ok(!cands.includes('development'), '目录 development/ 不应列入');
  f.cleanup();
});

test('case 2.3 — 各种本地配置 (conf/config.yaml / *.local.* / 任意命名) 都进候选 (agent 上下文判断)', () => {
  const f = mkfix();
  touch(path.join(f.project, '.gitignore'), 'conf/config.yaml\napp.local.json\nmysetting.yaml\nrandomfile.txt\n');
  touch(path.join(f.project, 'conf/config.yaml'), 'k: v');
  touch(path.join(f.project, 'app.local.json'), '{}');
  touch(path.join(f.project, 'mysetting.yaml'), '');
  touch(path.join(f.project, 'randomfile.txt'), '');
  const cands = planEnvCopies(f.project);
  // 全列, agent 决定
  assert.ok(cands.includes('conf/config.yaml'), 'conf/config.yaml 候选');
  assert.ok(cands.includes('app.local.json'), 'app.local.json 候选');
  assert.ok(cands.includes('mysetting.yaml'), 'mysetting.yaml 候选');
  assert.ok(cands.includes('randomfile.txt'), 'randomfile.txt 也候选 (agent 看名字 + 上下文判断, 脚本不替它判)');
  f.cleanup();
});

test('case 2.4 — SKIP_LINES: node_modules/ / .idea/ / .vscode/ / .DS_Store / Thumbs.db 不进候选 (已由其他 plan 处理或不需 cp)', () => {
  const f = mkfix();
  touch(path.join(f.project, '.gitignore'), 'node_modules/\n.idea/\n.vscode/\n.DS_Store\nThumbs.db\nfoo.conf\n');
  mkdir(path.join(f.project, 'node_modules'));
  touch(path.join(f.project, 'node_modules/x.js'), '');
  touch(path.join(f.project, '.DS_Store'), '');
  touch(path.join(f.project, 'foo.conf'), '');
  const cands = planEnvCopies(f.project);
  assert.ok(!cands.some(c => c.startsWith('node_modules')), 'node_modules/ 跳过');
  assert.ok(!cands.includes('.DS_Store'), '.DS_Store 跳过');
  assert.ok(cands.includes('foo.conf'), 'foo.conf 进候选 (普通文件由 agent 判断)');
  f.cleanup();
});

test('case 2.5 — safety: 跳过目录 + 跳过 >5MB 文件 (避免 cp cache/data/dump)', () => {
  const f = mkfix();
  touch(path.join(f.project, '.gitignore'), 'data/\nbigfile\nsmallconfig.yaml\n');
  mkdir(path.join(f.project, 'data'));
  touch(path.join(f.project, 'data/users.sqlite'), '');
  fs.writeFileSync(path.join(f.project, 'bigfile'), Buffer.alloc(6 * 1024 * 1024));
  touch(path.join(f.project, 'smallconfig.yaml'), 'k: v');
  const cands = planEnvCopies(f.project);
  assert.ok(!cands.includes('data'), '目录跳过');
  assert.ok(!cands.includes('bigfile'), '>5MB 文件跳过 (safety)');
  assert.ok(cands.includes('smallconfig.yaml'), '小文件正常候选');
  f.cleanup();
});

test('case 2.6 — setup() 不再自动 cp env, envCandidates 列在 report + needsAttention 提示 agent 主导', () => {
  const f = mkfix();
  touch(path.join(f.project, '.gitignore'), 'conf/config.yaml\n.env.local\n');
  touch(path.join(f.project, 'conf/config.yaml'), 'k: v');
  touch(path.join(f.project, '.env.local'), 'X=1');
  const rec = recorder();
  const report = setup({ projectRoot: f.project, worktreePath: f.worktree, dryRun: true }, { run: rec.run });
  assert.deepEqual(report.envCandidates.sort(), ['.env.local', 'conf/config.yaml'].sort(), 'envCandidates 应含两个 gitignored 文件');
  assert.ok(
    !report.plannedCommands.some(c => c[0] === 'cp' && c.join(' ').includes('.env.local')),
    '.env.local 不该在 plannedCommands (agent 判断后显式 cp)',
  );
  assert.ok(
    report.needsAttention.some(s => /envCandidates|agent.*判断/i.test(s)),
    `needsAttention 应含 agent 主导提示, 实际: ${JSON.stringify(report.needsAttention)}`,
  );
  f.cleanup();
});

test('parseArgs — v3.6.2+ 同时支持 --key value (空格) 和 --key=value (=) 两种形式', () => {
  assert.deepEqual(parseArgs(['--project-root', '/p', '--worktree-path', '/w']), { projectRoot: '/p', worktreePath: '/w' }, '空格分隔 (旧)');
  assert.deepEqual(parseArgs(['--project-root=/p', '--worktree-path=/w']), { projectRoot: '/p', worktreePath: '/w' }, '= 分隔 (v3.6.2+)');
  assert.deepEqual(parseArgs(['--project-root=/p', '--worktree-path', '/w', '--dry-run']), { projectRoot: '/p', worktreePath: '/w', dryRun: true }, '混用');
  assert.deepEqual(parseArgs(['--dry-run', '--skip-install']), { dryRun: true, skipInstall: true }, 'boolean flag 不要 value');
  assert.deepEqual(parseArgs(['--pkg-manager=pnpm']), { pkgManager: 'pnpm' }, '--pkg-manager=value');
});

// ===== BF1 — setup dry-run 不碰 FS (case 1.1) =====
test('case 1.1 — setup --dry-run 输出 plannedCommands 且不落地任何文件', () => {
  const f = mkfix();
  mkdir(path.join(f.project, '.vscode'));
  mkdir(path.join(f.project, 'node_modules'));
  mkdir(path.join(f.project, '.agents-personal'));
  const rec = recorder();
  const report = setup({ projectRoot: f.project, worktreePath: f.worktree, dryRun: true }, { run: rec.run });
  const flat = report.plannedCommands.map((c) => c.join(' ')).join('\n');
  assert.match(flat, /\.vscode/, '计划含 .vscode cp');
  assert.match(flat, /node_modules/, '计划含 node_modules cp');
  assert.match(flat, /ln -s.*\.agents-personal/, '计划含 .agents-personal symlink');
  assert.equal(rec.calls.length, 0, 'dry-run 不调 run');
  assert.deepEqual(fs.readdirSync(f.worktree), [], 'worktree 无任何文件落地');
  f.cleanup();
});

// ===== BF1 — cp 失败吞而不中断 (case 1.3) =====
test('case 1.3 — 一条 cp 失败记入 needsAttention, 其余仍执行', () => {
  const f = mkfix();
  mkdir(path.join(f.project, '.vscode'));
  mkdir(path.join(f.project, 'node_modules'));
  const ideDst = path.join(f.worktree, '.vscode');
  const rec = recorder((argv) => argv.includes(ideDst)); // .vscode 的 cp (含回退) 都抛
  const report = setup(
    { projectRoot: f.project, worktreePath: f.worktree, skipInstall: true },
    { run: rec.run },
  );
  assert.ok(report.needsAttention.some((m) => m.includes('.vscode')), '失败项进 needsAttention');
  const nmDst = path.join(f.worktree, 'node_modules');
  assert.ok(rec.calls.some((c) => c.includes(nmDst)), 'node_modules cp 仍被执行');
  f.cleanup();
});

// ===== BF1 — 探测不到包管理器跳过 install (case 1.4) =====
test('case 1.4 — 有 node_modules 但无 lock 且未传 --pkg-manager → install skipped', () => {
  const f = mkfix();
  mkdir(path.join(f.project, 'node_modules'));
  const rec = recorder();
  const report = setup({ projectRoot: f.project, worktreePath: f.worktree }, { run: rec.run });
  assert.equal(report.install.status, 'skipped');
  assert.ok(report.needsAttention.some((m) => m.includes('包管理器')));
  assert.ok(!rec.calls.some((c) => /install/.test(c.join(' '))), '不调任何 install');
  f.cleanup();
});

// ===== BF3 — copyWithFallback cp -Rc 回退 cp -R (case 3.2) =====
test('case 3.2 — cp -Rc 不支持时回退 cp -R', () => {
  const rec = recorder((argv) => argv.includes('-Rc')); // -Rc 抛, -R 成功
  copyWithFallback('/src', '/dst', rec.run);
  assert.deepEqual(rec.calls[0], ['cp', '-Rc', '/src', '/dst']);
  assert.deepEqual(rec.calls[1], ['cp', '-R', '/src', '/dst']);
});

// ===== BF4 — teardown (case 4.1 / 4.2 / 4.4) =====
test('case 4.1 — teardown 先拆 symlink 再 worktree remove', () => {
  const f = mkfix();
  fs.symlinkSync(path.join(f.project, '.agents-personal'), path.join(f.worktree, '.agents-personal'));
  const report = teardown({ worktreePath: f.worktree, dryRun: true });
  const link = path.join(f.worktree, '.agents-personal');
  assert.deepEqual(report.plannedCommands[0], ['rm', link]);
  assert.deepEqual(report.plannedCommands[1], ['git', 'worktree', 'remove', f.worktree]);
  f.cleanup();
});
test('case 4.2 — 无 symlink 不拆, 只 worktree remove', () => {
  const f = mkfix();
  const report = teardown({ worktreePath: f.worktree, dryRun: true });
  assert.equal(report.plannedCommands.length, 1);
  assert.deepEqual(report.plannedCommands[0], ['git', 'worktree', 'remove', f.worktree]);
  f.cleanup();
});
test('case 4.4 — worktree remove 被拒绝记 needsAttention, 不追加 --force', () => {
  const f = mkfix();
  const rec = recorder((argv) => argv.includes('remove')); // remove 抛
  const report = teardown({ worktreePath: f.worktree }, { run: rec.run });
  assert.ok(report.needsAttention.some((m) => /remove/.test(m)));
  assert.ok(!rec.calls.some((c) => c.includes('--force')), '不自动 --force 重试');
  f.cleanup();
});
