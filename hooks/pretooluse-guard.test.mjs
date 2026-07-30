import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRules, decide } from './pretooluse-guard.mjs';

const RULES = [
  { rule: 'dev-finish-branch', pattern: 'gh\\s+pr\\s+create', decision: 'inject', reason: '提 PR 前先调 dev-finish-branch 走 Gate Title-Body/PR' },
  { rule: 'dev-finish-branch', pattern: 'bkt\\s+api\\s+.*--method\\s+PUT', decision: 'block', reason: '禁 bkt api PUT 改 PR 元数据, 用 bkt pr edit' },
];

test('matchRules: gh pr create 命中 inject 靶', () => {
  const hits = matchRules('gh pr create --fill', RULES);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].decision, 'inject');
});

test('matchRules: 无关命令不命中', () => {
  assert.equal(matchRules('git status -sb', RULES).length, 0);
});

test('decide: inject → 无 permissionDecision (不 auto-approve) + additionalContext', () => {
  const out = decide([RULES[0]]);
  assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(out.hookSpecificOutput.permissionDecision, undefined, 'inject 不该返回 permissionDecision (否则跳过权限框)');
  assert.match(out.hookSpecificOutput.additionalContext, /dev-finish-branch/);
});

test('decide: block 优先于 inject → deny', () => {
  const out = decide([RULES[0], RULES[1]]);
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /禁 bkt api PUT/);
});

test('decide: 无命中 → null', () => {
  assert.equal(decide([]), null);
});

test('decide: execute 每次实际检查, 同一 rule 多 matcher 命中只执行一次', () => {
  let calls = 0;
  const executeHits = [
    { rule: 'git-freshness', decision: 'execute', reason: 'check freshness' },
    { rule: 'git-freshness', decision: 'execute', reason: 'check freshness' },
  ];
  const options = {
    cwd: '/workspace',
    spawnSync(command, args, options) {
      calls += 1;
      assert.equal(command, process.execPath);
      assert.match(args[0], /scripts\/freshness-check\.mjs$/);
      assert.deepEqual(args.slice(1), ['--max-behind=5', '--ttl=7200']);
      assert.equal(options.cwd, '/workspace');
      return {
        status: 0,
        stdout: JSON.stringify({ gate: 'ok', message: 'freshness ok' }),
        stderr: '',
      };
    },
  };
  const first = decide(executeHits, 'claude', options);
  const second = decide(executeHits, 'claude', options);
  assert.equal(calls, 2, '两次 PreToolUse 各执行一次，同次重复 matcher 不重复执行');
  assert.equal(first, null, '检查通过后无需再发文字提醒');
  assert.equal(second, null, '后续每次检查通过同样静默放行');
});

test('decide: freshness gate 转成真正的 block 决策', () => {
  const out = decide(
    [{ rule: 'git-freshness', decision: 'execute', reason: 'check freshness' }],
    'claude',
    {
      cwd: '/workspace',
      spawnSync() {
        return {
          status: 2,
          stdout: JSON.stringify({ gate: 'gate', message: 'main behind origin/main 5 commits. 三选' }),
          stderr: '',
        };
      },
    },
  );
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /behind origin\/main 5 commits.*三选/);
});

test('decide: Codex 也先实际检查，再把 gate 编码为安全消息', () => {
  let calls = 0;
  const out = decide(
    [{ rule: 'git-freshness', decision: 'execute', reason: 'check freshness' }],
    'codex',
    {
      spawnSync() {
        calls += 1;
        return {
          status: 2,
          stdout: JSON.stringify({ gate: 'gate', message: 'main 首次检查. 三选' }),
          stderr: '',
        };
      },
    },
  );
  assert.equal(calls, 1);
  assert.deepEqual(Object.keys(out), ['systemMessage']);
  assert.match(out.systemMessage, /无法硬阻断.*main 首次检查.*三选/);
});

test('decide: freshness 异常失败时 fail closed', () => {
  const out = decide(
    [{ rule: 'git-freshness', decision: 'execute', reason: 'check freshness' }],
    'claude',
    {
      spawnSync() {
        return { status: 1, stdout: '', stderr: 'unexpected failure' };
      },
    },
  );
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /freshness-check 执行失败.*unexpected failure/);
});

test('matchRules: 换行/行续 不能绕过 block 靶 (Codex review)', () => {
  // shell 行续: 反斜杠+换行
  assert.equal(matchRules('bkt api x \\\n  --method PUT', RULES).length, 1, '行续 PUT 应仍命中 block');
  // 纯换行 + 多空格
  assert.equal(matchRules('bkt api x\n   --method PUT', RULES).length, 1, '换行 PUT 应仍命中 block');
});

// ===== v3.6.2 regression: branch / worktree add pattern 不误命中 =====
const BRANCH_RULE = [{ rule: 'git-worktree', pattern: 'git\\s+(checkout\\s+-[bB]|switch\\s+-[cC]|branch\\s+[^-\\s|]\\S*)', decision: 'inject', reason: '原则: 每个分支都要 worktree' }];

test('v3.6.2 regression: branch -d / branch | grep / branch -a 不误命中"新建分支"靶', () => {
  assert.equal(matchRules('git branch -d worktree-batch1-p0', BRANCH_RULE).length, 0, 'branch -d 是删除, 不该命中"新建"靶');
  assert.equal(matchRules('git branch -d a b c', BRANCH_RULE).length, 0, 'branch -d 多个 同理');
  assert.equal(matchRules('git branch | grep worktree-', BRANCH_RULE).length, 0, 'branch | pipe 是查询, 不该命中');
  assert.equal(matchRules('git branch -a', BRANCH_RULE).length, 0, 'branch -a 是列表, 不该命中');
  assert.equal(matchRules('git branch -v', BRANCH_RULE).length, 0, 'branch -v 是查询, 不该命中');
});

test('v3.6.2 regression: branch <name> / branch <name> <start> 仍命中"新建分支"靶', () => {
  assert.equal(matchRules('git branch foo', BRANCH_RULE).length, 1, 'branch <name> 应命中');
  assert.equal(matchRules('git branch myfeature origin/main', BRANCH_RULE).length, 1, 'branch <name> <start> 应命中');
  assert.equal(matchRules('git checkout -b foo', BRANCH_RULE).length, 1, 'checkout -b 应命中');
  assert.equal(matchRules('git switch -c foo', BRANCH_RULE).length, 1, 'switch -c 应命中');
});

const WORKTREE_ADD_RULE = [{ rule: 'git-worktree', pattern: '(?:^|[;&|])\\s*git\\s+worktree\\s+add\\b', decision: 'inject', reason: '建 worktree 前先 Read rule-git-worktree.md' }];

test('v3.6.2 regression: git worktree add 字面在 commit message 内不误命中', () => {
  const cmd = 'git commit -m "fixed git worktree add pattern false positive"';
  assert.equal(matchRules(cmd, WORKTREE_ADD_RULE).length, 0, 'quote 内字面文本不该命中');
  // heredoc 场景 (norm 折叠空白后)
  const cmd2 = 'git commit -m "$(cat <<EOF feat: 改 git worktree add pattern EOF )"';
  assert.equal(matchRules(cmd2, WORKTREE_ADD_RULE).length, 0, 'heredoc 内字面文本不该命中');
});

test('v3.6.2 regression: git worktree add 真命令调用仍命中', () => {
  assert.equal(matchRules('git worktree add /tmp/foo bar', WORKTREE_ADD_RULE).length, 1, '命令位置应命中');
  assert.equal(matchRules('cd /tmp && git worktree add foo', WORKTREE_ADD_RULE).length, 1, '&& 后应命中');
  assert.equal(matchRules('fetch ; git worktree add foo', WORKTREE_ADD_RULE).length, 1, '; 后应命中');
  assert.equal(matchRules('echo done | git worktree add foo', WORKTREE_ADD_RULE).length, 1, '| 后应命中');
});
