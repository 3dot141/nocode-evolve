#!/usr/bin/env node
// worktree post-create 补齐 + teardown 的确定性步骤 (方案3 部分脚本化)。
// 设计: docs/superpowers/specs/3dot141/260602-worktree-setup-script-design.md
//
// 计划层 (plan*/parse*/detect*): 只读 fs, 决定"要做什么", 单测打这里。
// 执行层 (run/copyWithFallback/setup/teardown): execFileSync 跑 cp/ln/git, 有副作用; --dry-run 不调。
// 不做不可逆决定: 遇 cp 失败 / status 不 clean / 探测不到包管理器 → 写 needsAttention[] 让 agent 判。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ---------- 执行层默认 runner ----------
export function defaultRun(argv) {
  return execFileSync(argv[0], argv.slice(1), { encoding: 'utf8' });
}

// ---------- 计划层 (只读, 无写副作用) ----------

// git status -s 解析: ?? (untracked, 含 gitignored cp 物) 不算 offender; 其余进 offenders。
export function parseGitStatus(raw) {
  const offenders = [];
  for (const line of String(raw).split('\n')) {
    if (!line.trim()) continue;
    if (line.startsWith('??')) continue; // untracked: cp 来的 gitignored 物正常, 不算脏
    const file = line.slice(3).trim(); // porcelain 前 2 列状态, 第 3 列起是路径
    if (file) offenders.push(file);
  }
  return { clean: offenders.length === 0, offenders };
}

// 按 lock 文件 sniff 包管理器; 探测不到返回 null (调用方据此跳过 install)。
export function detectPkgManager(worktreePath) {
  if (fs.existsSync(path.join(worktreePath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(worktreePath, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(worktreePath, 'package-lock.json'))) return 'npm';
  return null;
}

// 锚定 pattern: 只命中 .env / .env.* / config.local.* / *secret* 的文件名,
// 不用裸 /\.env/ 子串 (会误命中 app.environment 之类)。
const ENV_PATTERNS = [/(^|\/)\.env(\.[^/]+)?$/, /(^|\/)config\.local\./, /secret/i];
const ENV_KEYWORD = /env|config\.local|secret/i; // 粗筛 .gitignore 行

// 扫 .gitignore → 粗筛 env-ish 行 → glob 展开实际文件 → 锚定精筛文件名。
export function planEnvCopies(projectRoot) {
  const out = new Set();
  for (const gi of findGitignores(projectRoot)) {
    const baseDir = path.dirname(gi);
    let lines = [];
    try { lines = fs.readFileSync(gi, 'utf8').split('\n'); } catch { continue; }
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      if (!ENV_KEYWORD.test(line)) continue; // 粗筛
      for (const f of expandGlob(baseDir, line)) {
        const base = path.basename(f);
        if (ENV_PATTERNS.some((p) => p.test(base))) out.add(path.relative(projectRoot, f));
      }
    }
  }
  return [...out];
}

// .vscode / .idea: 存在且 worktree 尚无 → 整目录 cp (幂等跳过已存在)。
export function planIdeCopies(projectRoot, worktreePath) {
  const specs = [];
  for (const name of ['.vscode', '.idea']) {
    const src = path.join(projectRoot, name);
    const dst = path.join(worktreePath, name);
    if (!fs.existsSync(src)) continue;
    if (fs.existsSync(dst)) continue; // 幂等
    specs.push({ kind: 'dir', rel: name, src, dst });
  }
  return specs;
}

// 递归找 node_modules, 命中即 prune (不下钻嵌套, 随父目录一起 cp)。
export function planNodeModules(projectRoot, worktreePath) {
  const specs = [];
  for (const src of findNodeModules(projectRoot)) {
    const rel = path.relative(projectRoot, src);
    const dst = path.join(worktreePath, rel);
    if (fs.existsSync(dst)) continue; // 幂等
    specs.push({ kind: 'dir', rel, src, dst });
  }
  return specs;
}

// .agents-personal: 主仓存在且 worktree 尚无 → symlink (共享主仓, 区别于 cp 的独立副本)。
export function planSymlink(projectRoot, worktreePath) {
  const target = path.join(projectRoot, '.agents-personal');
  const link = path.join(worktreePath, '.agents-personal');
  if (!fs.existsSync(target)) return null;
  if (fs.existsSync(link) || isSymlink(link)) return null;
  return { target, link };
}

// ---------- 执行层 ----------

// cp -Rc (clonefile 写时复制) 失败 (非 APFS / 无 reflink) → 回退 cp -R。
export function copyWithFallback(src, dst, run) {
  try { run(['cp', '-Rc', src, dst]); return 'reflink'; }
  catch { run(['cp', '-R', src, dst]); return 'plain'; }
}

export function setup(opts, deps = {}) {
  const run = deps.run || defaultRun;
  const { projectRoot, worktreePath, dryRun = false, pkgManager = null, skipInstall = false } = opts;

  const env = planEnvCopies(projectRoot);
  const ide = planIdeCopies(projectRoot, worktreePath);
  const nm = planNodeModules(projectRoot, worktreePath);
  const link = planSymlink(projectRoot, worktreePath);

  const plannedCommands = [];
  for (const rel of env) plannedCommands.push(['cp', path.join(projectRoot, rel), path.join(worktreePath, rel)]);
  for (const s of ide) plannedCommands.push(['cp', '-Rc', s.src, s.dst]);
  for (const s of nm) plannedCommands.push(['cp', '-Rc', s.src, s.dst]);
  if (link) plannedCommands.push(['ln', '-s', link.target, link.link]);

  const report = {
    verb: 'setup', worktreePath,
    copied: { env: [], ide: [], nodeModules: [] },
    symlinked: [], install: { status: 'skipped' },
    gitStatusClean: null, needsAttention: [], plannedCommands,
  };
  if (dryRun) return report; // 计划层结果, 不碰 FS

  for (const rel of env) {
    const src = path.join(projectRoot, rel), dst = path.join(worktreePath, rel);
    try { fs.mkdirSync(path.dirname(dst), { recursive: true }); run(['cp', src, dst]); report.copied.env.push(rel); }
    catch (e) { report.needsAttention.push(`cp env 失败 ${rel}: ${e.message}`); }
  }
  for (const s of ide) {
    try { copyWithFallback(s.src, s.dst, run); report.copied.ide.push(s.rel); }
    catch (e) { report.needsAttention.push(`cp IDE 失败 ${s.rel}: ${e.message}`); }
  }
  for (const s of nm) {
    try { copyWithFallback(s.src, s.dst, run); report.copied.nodeModules.push(s.rel); }
    catch (e) { report.needsAttention.push(`cp node_modules 失败 ${s.rel}: ${e.message}`); }
  }
  if (link) {
    try { run(['ln', '-s', link.target, link.link]); report.symlinked.push('.agents-personal'); }
    catch (e) { report.needsAttention.push(`symlink .agents-personal 失败: ${e.message}`); }
  }

  // 增量 install: 有 node_modules 才跑; 探测不到包管理器不擅自 install
  if (skipInstall) {
    report.install = { status: 'skipped' };
  } else if (nm.length === 0) {
    report.install = { status: 'no-node-modules' };
  } else {
    const mgr = pkgManager || detectPkgManager(worktreePath);
    if (!mgr) {
      report.install = { status: 'skipped' };
      report.needsAttention.push('未识别包管理器, install 已跳过, 请手动对齐依赖');
    } else {
      try { run([mgr, '--prefix', worktreePath, 'install']); report.install = { status: 'ran', manager: mgr }; }
      catch (e) { report.install = { status: 'skipped', manager: mgr }; report.needsAttention.push(`install 失败 (${mgr}): ${e.message}`); }
    }
  }

  // status 校验: cp 的 gitignored 物不应进 tracking
  try {
    const raw = run(['git', '-C', worktreePath, 'status', '-s']);
    const st = parseGitStatus(raw || '');
    report.gitStatusClean = st.clean;
    if (!st.clean) report.needsAttention.push(`git status 不 clean: ${st.offenders.join(', ')}`);
  } catch (e) {
    report.gitStatusClean = null;
    report.needsAttention.push(`git status 校验失败: ${e.message}`);
  }
  return report;
}

export function teardown(opts, deps = {}) {
  const run = deps.run || defaultRun;
  const { worktreePath, dryRun = false } = opts;
  const link = path.join(worktreePath, '.agents-personal');

  const plannedCommands = [];
  if (isSymlink(link)) plannedCommands.push(['rm', link]); // 先拆链 (只删 symlink 自身, 不递归 target)
  plannedCommands.push(['git', 'worktree', 'remove', worktreePath]); // 拆链后无须 --force

  const report = { verb: 'teardown', worktreePath, plannedCommands, needsAttention: [] };
  if (dryRun) return report;

  for (const cmd of plannedCommands) {
    try { run(cmd); }
    catch (e) { report.needsAttention.push(`${cmd.join(' ')} 失败: ${e.message}`); break; } // 不自动 --force 重试
  }
  return report;
}

// ---------- 内部辅助 ----------

function isSymlink(p) { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } }

function findGitignores(root) {
  const found = [];
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isFile() && e.name === '.gitignore') found.push(path.join(dir, e.name));
      else if (e.isDirectory() && e.name !== '.git' && e.name !== 'node_modules') walk(path.join(dir, e.name));
    }
  })(root);
  return found;
}

function findNodeModules(root) {
  const found = [];
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === '.git') continue;
      const full = path.join(dir, e.name);
      if (e.name === 'node_modules') { found.push(full); continue; } // prune: 不下钻
      walk(full);
    }
  })(root);
  return found;
}

// .gitignore 行 → baseDir 下实际匹配的文件路径 (简单 glob: * → [^/]*)
function expandGlob(baseDir, pattern) {
  const p = pattern.replace(/^\//, '').replace(/\/$/, '');
  if (p.includes('/')) {
    const dir = path.join(baseDir, path.dirname(p));
    return listMatch(dir, path.basename(p));
  }
  return listMatch(baseDir, p);
}
function listMatch(dir, seg) {
  const re = globToRe(seg);
  let entries = [];
  try { entries = fs.readdirSync(dir); } catch { return []; }
  return entries.filter((e) => re.test(e)).map((e) => path.join(dir, e));
}
function globToRe(seg) {
  const esc = seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '.');
  return new RegExp('^' + esc + '$');
}

// ---------- CLI ----------
function parseArgs(rest) {
  const o = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--project-root') o.projectRoot = rest[++i];
    else if (a === '--worktree-path') o.worktreePath = rest[++i];
    else if (a === '--pkg-manager') o.pkgManager = rest[++i];
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--skip-install') o.skipInstall = true;
  }
  return o;
}
function usage() {
  process.stderr.write(
    'usage:\n' +
    '  worktree-setup.mjs setup --project-root <p> --worktree-path <p> [--dry-run] [--pkg-manager npm|pnpm|yarn] [--skip-install]\n' +
    '  worktree-setup.mjs teardown --worktree-path <p> [--dry-run]\n',
  );
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const verb = argv[0];
  const opts = parseArgs(argv.slice(1));
  let report;
  if (verb === 'setup') {
    if (!opts.projectRoot || !opts.worktreePath) { usage(); process.exit(2); }
    report = setup(opts);
  } else if (verb === 'teardown') {
    if (!opts.worktreePath) { usage(); process.exit(2); }
    report = teardown(opts);
  } else { usage(); process.exit(2); }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(0);
}
