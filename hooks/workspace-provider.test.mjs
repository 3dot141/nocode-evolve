import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  workspaceProviderPlan, workspaceReceipt,
} from '../scripts/lib/workspace-provider.mjs';

test('Workspace providers produce safe plans for read/write/exec/browser', () => {
  assert.equal(workspaceProviderPlan('claude', 'workspace.read', { path: 'a.md' }, { cwd: '/work' }).path,
    '/work/a.md');
  assert.equal(workspaceProviderPlan('codex', 'workspace.write', {
    path: 'a.md', content: 'x',
  }, { cwd: '/work' }).tool, 'apply_patch');
  const exec = workspaceProviderPlan('codex', 'workspace.exec', { argv: ['node', 'a.mjs'] }, { cwd: '/work' });
  assert.deepEqual(exec.args, ['a.mjs']);
  assert.equal(exec.shell, false);
  assert.throws(() => workspaceProviderPlan('codex', 'workspace.exec', { argv: ['node a.mjs'] }),
    (error) => error.code === 'WORKSPACE_ARGV_INVALID');
  assert.throws(() => workspaceProviderPlan('codex', 'workspace.read', {
    path: '../outside.md',
  }, { cwd: '/work/project' }), (error) => error.code === 'WORKSPACE_PATH_OUTSIDE_ROOT');
  assert.throws(() => workspaceProviderPlan('codex', 'workspace.read', {
    path: '/etc/passwd',
  }, { cwd: '/work/project' }), (error) => error.code === 'WORKSPACE_PATH_OUTSIDE_ROOT');
  assert.throws(() => workspaceProviderPlan('codex', 'workspace.exec', {
    argv: ['git', 'status'],
  }, { cwd: 'relative' }), (error) => error.code === 'WORKSPACE_CWD_INVALID');
  assert.throws(() => workspaceProviderPlan('codex', 'workspace.worktree.current', {}, {
    cwd: 'relative',
  }), (error) => error.code === 'WORKSPACE_CWD_INVALID');
  assert.equal(workspaceProviderPlan('claude', 'workspace.browser.verify', {
    url: 'http://localhost:3000',
  }).tool, 'browser');
});

test('Claude and Codex create explicitly, while Claude may enter natively', () => {
  const claude = workspaceProviderPlan('claude', 'workspace.worktree.create', {
    branch: 'feature/x', path: '/work/x', startPoint: 'origin/main',
  }, { cwd: '/work/main' });
  assert.deepEqual(claude.args,
    ['-C', '/work/main', 'worktree', 'add', '/work/x', '-b', 'feature/x', 'origin/main']);
  assert.equal(claude.shell, false);
  const codex = workspaceProviderPlan('codex', 'workspace.worktree.create', {
    branch: 'feature/x', path: '/work/x',
  }, { cwd: '/work/main' });
  assert.deepEqual(codex.args, ['-C', '/work/main', 'worktree', 'add', '/work/x', '-b', 'feature/x']);
  assert.equal(codex.shell, false);
  assert.equal(workspaceProviderPlan('claude', 'workspace.worktree.enter', {
    path: '/work/x',
  }, { cwd: '/work/main' }).nativeTool, 'EnterWorktree');
  assert.throws(() => workspaceProviderPlan('codex', 'workspace.worktree.create', {
    branch: '--force', path: '/work/x',
  }, { cwd: '/work/main' }), (error) => error.code === 'WORKSPACE_BRANCH_INVALID');
  assert.throws(() => workspaceProviderPlan('codex', 'workspace.worktree.create', {
    branch: 'feature/x', path: '/tmp/outside',
  }, { cwd: '/work/main' }), (error) => error.code === 'WORKSPACE_PATH_OUTSIDE_ROOT');
  assert.throws(() => workspaceProviderPlan('codex', 'workspace.read', {
    path: 'a.md',
  }, { cwd: 'relative' }), (error) => error.code === 'WORKSPACE_CWD_INVALID');
  assert.deepEqual(workspaceReceipt({ operation: 'worktree.enter', workdir: '/work/x', shell: false }), {
    operation: 'worktree.enter', ok: true, path: '/work/x', output: null, details: { shell: false },
  });
});

test('Workspace path validation rejects symlink escapes for existing and new targets', (t) => {
  const parent = mkdtempSync(path.join(os.tmpdir(), 'nocode-workspace-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'project');
  const outside = path.join(parent, 'outside');
  mkdirSync(root);
  mkdirSync(outside);
  writeFileSync(path.join(outside, 'secret.txt'), 'secret');
  symlinkSync(outside, path.join(root, 'link'));
  assert.throws(() => workspaceProviderPlan('codex', 'workspace.read', {
    path: 'link/secret.txt',
  }, { cwd: root }), (error) => error.code === 'WORKSPACE_PATH_OUTSIDE_ROOT');
  assert.throws(() => workspaceProviderPlan('codex', 'workspace.write', {
    path: 'link/new.txt', content: 'x',
  }, { cwd: root }), (error) => error.code === 'WORKSPACE_PATH_OUTSIDE_ROOT');
});
