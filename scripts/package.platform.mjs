#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeAdapter } from '../adapters/claude/adapter.mjs';
import { codebuddyAdapter } from '../adapters/codebuddy/adapter.mjs';
import { codexAdapter } from '../adapters/codex/adapter.mjs';
import {
  buildExpectedTree,
  diffTree,
  formatDiff,
  loadJson,
  validateMetadata,
  writeExpectedTree,
} from './lib/platform-packager.mjs';

// 活跃打包平台。CodeBuddy 独立发布（.codebuddy-plugin/plugin.json + ${CODEBUDDY_PLUGIN_ROOT}），
// 不走 Claude 发布物复用。
// Qoder、Pi 与 DeepSeek 已从打包入口停用：适配器源码仍保留在 adapters/ 与 platform/ 下，
// 但不再生成 plugins/qoder|pi|deepseek，也不再参与默认 --check 与发布 smoke。
export const ACTIVE_PLATFORMS = ['claude', 'codex', 'codebuddy'];

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parseArgs(args) {
  const options = { check: false, platforms: [...ACTIVE_PLATFORMS] };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--check') options.check = true;
    else if (arg === '--platform') {
      const platform = args[++index];
      if (!platform) throw new Error(`--platform requires ${ACTIVE_PLATFORMS.join(', ')}`);
      options.platforms = [platform];
    } else if (arg.startsWith('--platform=')) {
      options.platforms = [arg.slice('--platform='.length)];
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  for (const platform of options.platforms) {
    if (!ACTIVE_PLATFORMS.includes(platform)) {
      throw new Error(`unknown platform: ${platform}`);
    }
  }
  return options;
}

export function run(options, root = ROOT) {
  const metadata = validateMetadata(loadJson(path.join(root, 'plugin/metadata.json')));
  const adapters = {
    claude: claudeAdapter,
    codex: codexAdapter,
    codebuddy: codebuddyAdapter,
  };

  const messages = [];
  let hasDrift = false;
  const builds = [];
  for (const platform of options.platforms) {
    const expected = buildExpectedTree({
      root,
      metadata,
      adapter: adapters[platform],
    });
    const outputRoot = path.join(root, 'plugins', platform, metadata.name);
    builds.push({ platform, expected, outputRoot });
  }

  for (const { platform, expected, outputRoot } of builds) {
    if (options.check) {
      const lines = formatDiff(platform, diffTree(expected, outputRoot));
      messages.push(...lines);
      if (lines.length > 0) hasDrift = true;
    } else {
      writeExpectedTree(expected, outputRoot, root);
      messages.push(`${platform}: generated ${expected.size} files`);
    }
  }
  return { hasDrift, messages };
}

export function main(args = process.argv.slice(2)) {
  try {
    const result = run(parseArgs(args));
    if (result.messages.length) process.stdout.write(`${result.messages.join('\n')}\n`);
    if (result.hasDrift) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`package.platform: ${error.message}\n`);
    process.exitCode = 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
