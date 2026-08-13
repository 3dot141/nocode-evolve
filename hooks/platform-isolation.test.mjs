import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const LEGACY_ALLOWLIST = new Set();

const FORBIDDEN_NATIVE = {
  claude: /\b(?:spawn_agent|wait_agent|followup_task|interrupt_agent|request_user_input|update_plan)\b/,
  codex: /\b(?:AskUserQuestion|TaskCreate|TaskUpdate|EnterWorktree)\b/,
  pi: /\b(?:AskUserQuestion|TaskCreate|TaskUpdate|EnterWorktree|update_plan|request_user_input|spawn_agent)\b|Skill\(nocode:/,
};
const OBSOLETE = /\bCapability\(|"profile"\s*:|fallbackPolicy/;
const PLATFORM_MARKER = /<!-- \/?nocode:platform\b/;

function markdownFiles(root) {
  const files = [];
  function visit(directory, prefix = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute, relative);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(relative);
    }
  }
  visit(root);
  return files.sort();
}

test('generated Markdown contains no platform block markers or opposite-platform tools', () => {
  for (const platform of ['claude', 'codex', 'pi']) {
    const pluginRoot = path.join(ROOT, 'plugins', platform, 'nocode');
    for (const relative of markdownFiles(pluginRoot)) {
      const source = readFileSync(path.join(pluginRoot, relative), 'utf8');
      assert.doesNotMatch(source, PLATFORM_MARKER, `${platform}:${relative}`);
      assert.doesNotMatch(source, FORBIDDEN_NATIVE[platform], `${platform}:${relative}`);
    }
  }
});

test('legacy runtime syntax exists only in the shrinking migration allowlist', () => {
  for (const platform of ['claude', 'codex', 'pi']) {
    const pluginRoot = path.join(ROOT, 'plugins', platform, 'nocode');
    const actual = new Set();
    for (const relative of markdownFiles(pluginRoot)) {
      const source = readFileSync(path.join(pluginRoot, relative), 'utf8');
      if (OBSOLETE.test(source)) actual.add(relative);
    }
    assert.deepEqual([...actual].sort(), [...LEGACY_ALLOWLIST].sort(), platform);
  }
});
