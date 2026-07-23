import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  generateDockerStartScript,
  runGeneratedDockerStart,
} from './docker-adapter.mjs';

const SOURCE = `#!/bin/bash

docker login example.invalid
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
IMAGE_PREFIX="dev"

# IMAGE_PREFIX=$IMAGE_PREFIX docker compose pull
docker compose stop jsy-webui
IMAGE_PREFIX=$IMAGE_PREFIX docker compose up -d
docker image prune -f
`;

test('generateDockerStartScript: 每次生成严格模式，并只 pull/up 非 agents services', () => {
  const generated = generateDockerStartScript(SOURCE);

  assert.match(generated, /^#!\/bin\/bash\nset -euo pipefail\n/);
  assert.match(generated, /docker compose config --services/);
  assert.match(generated, /\[ "\$NOCODE_SERVICE" != "fx-data-agents" \]/);
  assert.match(generated, /docker compose pull "\$\{NOCODE_SERVICES\[@\]\}"/);
  assert.match(generated, /docker compose up -d "\$\{NOCODE_SERVICES\[@\]\}"/);
  assert.doesNotMatch(generated, /^IMAGE_PREFIX=.*docker compose up -d$/m);
  assert.doesNotThrow(() => execFileSync('bash', ['-n'], { input: generated }));
});

test('generateDockerStartScript: 兼容没有 IMAGE_PREFIX 前缀的 compose up', () => {
  const generated = generateDockerStartScript('#!/bin/bash\ndocker compose up -d\n');
  assert.match(generated, /agents-launcher derived compose block/);
  assert.match(generated, /docker compose up -d "\$\{NOCODE_SERVICES\[@\]\}"/);
});

test('generateDockerStartScript: 已启用的全量 compose pull 被派生块替代', () => {
  const source = SOURCE.replace(
    '# IMAGE_PREFIX=$IMAGE_PREFIX docker compose pull',
    'IMAGE_PREFIX=$IMAGE_PREFIX docker compose pull',
  );
  const generated = generateDockerStartScript(source);

  assert.equal(
    generated.match(/docker compose pull "\$\{NOCODE_SERVICES\[@\]\}"/g)?.length,
    1,
  );
  assert.doesNotMatch(generated, /^IMAGE_PREFIX=.*docker compose pull$/m);
});

test('generateDockerStartScript: 找不到唯一 compose up 锚点时 fail loud', () => {
  assert.throws(
    () => generateDockerStartScript('#!/bin/bash\ndocker compose start\n'),
    /唯一.*docker compose up -d/,
  );
  assert.throws(
    () => generateDockerStartScript('#!/bin/bash\ndocker compose up -d redis\n'),
    /不支持带额外参数或服务名/,
  );
});

test('runGeneratedDockerStart: 从目标 server 仓读取、在该仓执行，并始终清理临时文件', () => {
  const serverDir = mkdtempSync(join(tmpdir(), 'server-docker-source-'));
  writeFileSync(join(serverDir, 'dockerstart.sh'), SOURCE);
  let generatedPath = '';
  let executedSource = '';

  const result = runGeneratedDockerStart({
    serverDir,
    exec: (cmd, args, opts) => {
      assert.equal(cmd, 'bash');
      assert.equal(opts.cwd, serverDir);
      generatedPath = args[0];
      assert.equal(existsSync(generatedPath), true);
      executedSource = readFileSync(generatedPath, 'utf8');
      return '';
    },
  });

  assert.equal(result.sourcePath, join(serverDir, 'dockerstart.sh'));
  assert.match(executedSource, /\[ "\$NOCODE_SERVICE" != "fx-data-agents" \]/);
  assert.equal(existsSync(generatedPath), false);
});

test('runGeneratedDockerStart: 执行失败也清理临时目录', () => {
  const serverDir = mkdtempSync(join(tmpdir(), 'server-docker-fail-'));
  mkdirSync(serverDir, { recursive: true });
  writeFileSync(join(serverDir, 'dockerstart.sh'), SOURCE);
  let generatedPath = '';

  assert.throws(
    () => runGeneratedDockerStart({
      serverDir,
      exec: (_cmd, args) => {
        generatedPath = args[0];
        throw new Error('docker failed');
      },
    }),
    /docker failed/,
  );
  assert.equal(existsSync(generatedPath), false);
});

test('runGeneratedDockerStart: 缺少目标仓脚本时拒绝执行', () => {
  const serverDir = mkdtempSync(join(tmpdir(), 'server-docker-missing-'));
  assert.throws(
    () => runGeneratedDockerStart({ serverDir, exec: () => '' }),
    /dockerstart\.sh 不存在/,
  );
});
