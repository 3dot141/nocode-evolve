import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { graalvmCandidates, isGraalvm, detectGraalvm, readJavaHomeCache, writeJavaHomeCache, GRAALVM_IMAGE } from './graalvm.mjs';

function fakeJdk() {
  const home = mkdtempSync(join(tmpdir(), 'jdk-'));
  mkdirSync(join(home, 'bin'), { recursive: true });
  writeFileSync(join(home, 'bin/java'), '#!/bin/sh\necho stub');
  chmodSync(join(home, 'bin/java'), 0o755);
  return home;
}

test('graalvmCandidates: 含 8 条固定路径 + userprofile 时追加 2 条', () => {
  const base = graalvmCandidates({ home: '/h' });
  assert.equal(base.length, 8);
  assert.ok(base[0].includes('.jdks/graalvm-21/Contents/Home'));
  const withUp = graalvmCandidates({ home: '/h', userprofile: '/up' });
  assert.equal(withUp.length, 10);
});

test('isGraalvm: -version 输出含 graalvm 关键字返回 true（注入 mock exec）', () => {
  const home = fakeJdk();
  const mockExec = () => 'openjdk version "21.0.1" 2026-01-01\nGraalVM CE 21.0.1\n';
  assert.equal(isGraalvm(home, { exec: mockExec }), true);
});

test('isGraalvm: 普通 JDK（无 graalvm 关键字）返回 false', () => {
  const home = fakeJdk();
  const mockExec = () => 'openjdk version "21.0.1"\nOpenJDK Runtime Environment Temurin\n';
  assert.equal(isGraalvm(home, { exec: mockExec }), false);
});

test('isGraalvm: bin/java 不存在直接返回 false，不调用 exec', () => {
  let called = false;
  const mockExec = () => { called = true; return ''; };
  assert.equal(isGraalvm('/not/exist', { exec: mockExec }), false);
  assert.equal(called, false);
});

test('detectGraalvm: env.JAVA_HOME 已是 GraalVM 时直接采用并写缓存', () => {
  const home = fakeJdk();
  const serverDir = mkdtempSync(join(tmpdir(), 'srv-'));
  const mockExec = () => 'GraalVM CE 21.0.1\n';
  const result = detectGraalvm({ serverDir, env: { JAVA_HOME: home }, exec: mockExec });
  assert.deepEqual(result, { mode: 'local', javaHome: home });
  assert.equal(readJavaHomeCache(serverDir), home);
});

test('detectGraalvm: 无 env 也无缓存，候选路径全 miss，有 docker → 降级容器', () => {
  const serverDir = mkdtempSync(join(tmpdir(), 'srv-'));
  const mockExec = () => { throw new Error('not found'); };
  const result = detectGraalvm({ serverDir, env: {}, exec: mockExec, hasDocker: true });
  assert.deepEqual(result, { mode: 'container', image: GRAALVM_IMAGE });
});

test('detectGraalvm: 无 docker 时返回 missing', () => {
  const serverDir = mkdtempSync(join(tmpdir(), 'srv-'));
  const mockExec = () => { throw new Error('not found'); };
  const result = detectGraalvm({ serverDir, env: {}, exec: mockExec, hasDocker: false });
  assert.deepEqual(result, { mode: 'missing' });
});

test('readJavaHomeCache/writeJavaHomeCache: 幂等读写', () => {
  const serverDir = mkdtempSync(join(tmpdir(), 'srv-'));
  assert.equal(readJavaHomeCache(serverDir), '');
  writeJavaHomeCache(serverDir, '/opt/graalvm-21');
  assert.equal(readJavaHomeCache(serverDir), '/opt/graalvm-21');
});
