import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepare } from './server-cli.mjs';

function fakeServerRepo({ withAntlrOutput = true } = {}) {
  const serverDir = mkdtempSync(join(tmpdir(), 'srv-'));
  writeFileSync(join(serverDir, 'gradlew'), '#!/bin/sh');
  const moduleDir = join(serverDir, 'fx-agent-workspace');
  mkdirSync(moduleDir, { recursive: true });
  if (withAntlrOutput) {
    const outDir = join(moduleDir, 'src/main/antlr-generated/com/fanruan/x');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'WorkspaceDslParser.java'), 'class WorkspaceDslParser {}');
  }
  return serverDir;
}

test('prepare: 模块目录不存在时抛清晰错误，不静默跳过', async () => {
  const serverDir = mkdtempSync(join(tmpdir(), 'srv-'));
  writeFileSync(join(serverDir, 'gradlew'), '#!/bin/sh');
  await assert.rejects(
    prepare({ serverDir, exec: () => '' }),
    /fx-agent-workspace 模块缺失或路径不对/,
  );
});

test('prepare: 跑 gradlew 生成 task，产物目录非空则成功', async () => {
  const serverDir = fakeServerRepo({ withAntlrOutput: true });
  const calls = [];
  const mockExec = (cmd, args, opts) => { calls.push([cmd, args, opts]); return ''; };
  const result = await prepare({ serverDir, exec: mockExec, log: () => {} });
  assert.ok(calls.some(([cmd, args]) => cmd === './gradlew' && args.includes(':fx-agent-workspace:generateGrammarSource')));
  assert.equal(result.antlrOutputDir, 'src/main/antlr-generated');
});

test('prepare: gradlew 跑完但两个候选目录都空，报错提示新 worktree 首次必跑', async () => {
  const serverDir = fakeServerRepo({ withAntlrOutput: false });
  const mockExec = () => '';
  await assert.rejects(
    prepare({ serverDir, exec: mockExec, log: () => {} }),
    /未检出产物/,
  );
});

test('prepare: 无 GraalVM 时向 gradle 传 java_home -v 21 解析出的 JAVA_HOME', async () => {
  const serverDir = fakeServerRepo({ withAntlrOutput: true });
  let gradleEnv = null;
  const mockExec = (cmd, args, opts) => {
    if (cmd === '/usr/libexec/java_home') return '/jdk/ms-21\n';
    if (cmd === './gradlew') { gradleEnv = opts.env; return ''; }
    throw new Error('java not found');   // isGraalvm 全 miss
  };
  await prepare({ serverDir, exec: mockExec, log: () => {} });
  assert.equal(gradleEnv.JAVA_HOME, '/jdk/ms-21');
  assert.ok(gradleEnv.PATH.startsWith('/jdk/ms-21/bin:'));
});

test('prepare: 返回 graalvm 检测结果（容器降级场景）', async () => {
  const serverDir = fakeServerRepo({ withAntlrOutput: true });
  const mockExec = (cmd) => {
    if (cmd === './gradlew') return '';
    throw new Error('java not found');   // isGraalvm 检测全 miss
  };
  const result = await prepare({ serverDir, exec: mockExec, log: () => {} });
  assert.equal(result.graalvm.mode, 'container');
});
