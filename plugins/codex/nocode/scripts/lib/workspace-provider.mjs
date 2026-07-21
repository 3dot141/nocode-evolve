import path from 'node:path';
import { existsSync, realpathSync } from 'node:fs';

export class WorkspaceProviderError extends Error {
  constructor(code, message) { super(`${code}: ${message}`); this.code = code; }
}

function safeRoot(cwd) {
  if (typeof cwd !== 'string' || !path.isAbsolute(cwd) || cwd.includes('\0')) {
    throw new WorkspaceProviderError('WORKSPACE_CWD_INVALID', 'cwd must be an absolute path');
  }
  return path.normalize(cwd);
}

function safePath(value, root) {
  if (typeof value !== 'string' || !value || value.includes('\0')) {
    throw new WorkspaceProviderError('WORKSPACE_PATH_INVALID', 'path must be a non-empty string');
  }
  const target = path.isAbsolute(value) ? path.normalize(value) : path.resolve(root, value);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new WorkspaceProviderError('WORKSPACE_PATH_OUTSIDE_ROOT', 'path escapes the allowed workspace root');
  }
  if (existsSync(root)) {
    const realRoot = realpathSync(root);
    let existing = target;
    while (!existsSync(existing)) {
      const parent = path.dirname(existing);
      if (parent === existing) break;
      existing = parent;
    }
    const realExisting = realpathSync(existing);
    const realRelative = path.relative(realRoot, realExisting);
    if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`)
      || path.isAbsolute(realRelative)) {
      throw new WorkspaceProviderError('WORKSPACE_PATH_OUTSIDE_ROOT', 'path resolves outside the allowed workspace root');
    }
  }
  return target;
}

function safeBranch(value) {
  if (typeof value !== 'string' || !value || value.startsWith('-') || /[\s~^:?*[\\]|\.\./.test(value)) {
    throw new WorkspaceProviderError('WORKSPACE_BRANCH_INVALID', 'branch is not a safe git ref');
  }
  return value;
}

export function workspaceProviderPlan(platform, capability, input, { cwd = process.cwd() } = {}) {
  if (!['claude', 'codex'].includes(platform)) {
    throw new WorkspaceProviderError('WORKSPACE_PLATFORM_INVALID', 'unknown platform');
  }
  cwd = safeRoot(cwd);
  const operation = capability.replace(/^workspace\./, '');
  if (operation === 'read' || operation === 'write') {
    const target = safePath(input.path, cwd);
    return { operation, tool: operation === 'read' ? 'read_file' : 'apply_patch', path: target,
      ...(operation === 'write' ? { content: input.content } : {}) };
  }
  if (operation === 'exec') {
    if (!Array.isArray(input.argv) || input.argv.length === 0
      || input.argv.some((item) => typeof item !== 'string' || !item)
      || /\s/.test(input.argv[0])) {
      throw new WorkspaceProviderError('WORKSPACE_ARGV_INVALID', 'exec requires argv and forbids shell strings');
    }
    return { operation, command: input.argv[0], args: input.argv.slice(1), workdir: cwd, shell: false };
  }
  if (operation === 'browser.verify') {
    if (typeof input.url !== 'string' || !/^https?:\/\//.test(input.url)) {
      throw new WorkspaceProviderError('WORKSPACE_URL_INVALID', 'browser URL must be http(s)');
    }
    return { operation, tool: 'browser', url: input.url };
  }
  if (operation === 'worktree.current') {
    return { operation, command: 'git', args: ['-C', cwd, 'rev-parse', '--show-toplevel'], workdir: cwd, shell: false };
  }
  if (operation === 'worktree.create') {
    const target = safePath(input.path, path.dirname(cwd));
    const branch = safeBranch(input.branch);
    const startPoint = input.startPoint == null ? null : safeBranch(input.startPoint);
    return {
      operation, command: 'git',
      args: ['-C', cwd, 'worktree', 'add', target, '-b', branch,
        ...(startPoint ? [startPoint] : [])],
      workdir: cwd, shell: false,
    };
  }
  if (operation === 'worktree.enter') {
    const target = safePath(input.path, path.dirname(cwd));
    return platform === 'claude'
      ? { operation, nativeTool: 'EnterWorktree', path: target }
      : { operation, workdir: target, commandPrefix: ['git', '-C', target], shell: false };
  }
  throw new WorkspaceProviderError('WORKSPACE_CAPABILITY_UNSUPPORTED', capability);
}

export function workspaceReceipt(plan, { ok = true, output = null } = {}) {
  return {
    operation: plan.operation,
    ok,
    path: plan.path || plan.workdir || null,
    output,
    details: { shell: plan.shell ?? null },
  };
}
