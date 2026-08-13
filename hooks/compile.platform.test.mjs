import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildExpectedTree,
  diffTree,
  validateMetadata,
  writeExpectedTree,
} from '../scripts/lib/platform-packager.mjs';
import { parseArgs, run } from '../scripts/package.platform.mjs';
import { claudeAdapter } from '../adapters/claude/adapter.mjs';
import { codexAdapter } from '../adapters/codex/adapter.mjs';
import { piAdapter } from '../adapters/pi/adapter.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixtureRepo(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'platform-compiler-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'skills', 'hello'), { recursive: true });
  writeFileSync(path.join(root, 'skills', 'hello', 'SKILL.md'), 'hello\n');
  return root;
}

function fixtureMetadata() {
  return {
    name: 'nocode',
    version: '14.0.0',
    description: 'test',
    author: { name: 'Harrison' },
    license: 'MIT',
  };
}

function fixtureAdapter(platform = 'claude') {
  return {
    platform,
    sourceRoots: [{ source: 'skills', target: 'skills' }],
    manifestPath: platform === 'claude'
      ? '.claude-plugin/plugin.json'
      : '.codex-plugin/plugin.json',
    renderManifest(metadata) {
      return { name: metadata.name, version: metadata.version };
    },
    transformFile({ content }) {
      return content;
    },
  };
}

test('validateMetadata accepts strict SemVer and rejects invalid metadata', () => {
  assert.doesNotThrow(() => validateMetadata(fixtureMetadata()));
  assert.throws(
    () => validateMetadata({ ...fixtureMetadata(), version: '14' }),
    /SemVer/,
  );
  assert.throws(
    () => validateMetadata({ ...fixtureMetadata(), author: {} }),
    /author\.name/,
  );
});

test('buildExpectedTree is deterministic and includes the rendered manifest', (t) => {
  const root = fixtureRepo(t);
  const adapter = fixtureAdapter();
  const metadata = fixtureMetadata();

  const first = buildExpectedTree({ root, metadata, adapter });
  const second = buildExpectedTree({ root, metadata, adapter });

  assert.deepEqual([...first.keys()], [
    '.claude-plugin/plugin.json',
    'skills/hello/SKILL.md',
  ]);
  assert.deepEqual([...first], [...second]);
  assert.equal(first.get('skills/hello/SKILL.md').toString(), 'hello\n');
  assert.deepEqual(
    JSON.parse(first.get('.claude-plugin/plugin.json').toString()),
    { name: 'nocode', version: '14.0.0' },
  );
});

test('buildExpectedTree selects Markdown blocks for the adapter platform', (t) => {
  const root = fixtureRepo(t);
  writeFileSync(
    path.join(root, 'skills', 'hello', 'SKILL.md'),
    `shared
<!-- nocode:platform claude -->
use Agent
<!-- /nocode:platform -->
<!-- nocode:platform codex -->
use spawn_agent
<!-- /nocode:platform -->
`,
  );

  for (const platform of ['claude', 'codex']) {
    const tree = buildExpectedTree({
      root,
      metadata: fixtureMetadata(),
      adapter: fixtureAdapter(platform),
    });
    assert.equal(
      tree.get('skills/hello/SKILL.md').toString(),
      platform === 'claude' ? 'shared\nuse Agent\n' : 'shared\nuse spawn_agent\n',
    );
  }
});

test('buildExpectedTree applies source exclusions only to selected platforms', (t) => {
  const root = fixtureRepo(t);
  mkdirSync(path.join(root, 'plugin'), { recursive: true });
  writeFileSync(
    path.join(root, 'plugin', 'exclusions.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      sources: [{
        path: 'skills/hello',
        platforms: ['claude'],
        reason: 'Codex-only fixture',
      }],
      hookCommands: [],
    }, null, 2)}\n`,
  );

  const claudeTree = buildExpectedTree({
    root,
    metadata: fixtureMetadata(),
    adapter: fixtureAdapter('claude'),
  });
  const codexTree = buildExpectedTree({
    root,
    metadata: fixtureMetadata(),
    adapter: fixtureAdapter('codex'),
  });

  assert.equal(claudeTree.has('skills/hello/SKILL.md'), false);
  assert.equal(codexTree.has('skills/hello/SKILL.md'), true);
});

test('buildExpectedTree rejects unknown source exclusion platforms', (t) => {
  const root = fixtureRepo(t);
  mkdirSync(path.join(root, 'plugin'), { recursive: true });
  writeFileSync(
    path.join(root, 'plugin', 'exclusions.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      sources: [{
        path: 'skills/hello',
        platforms: ['cursor'],
        reason: 'invalid fixture',
      }],
      hookCommands: [],
    }, null, 2)}\n`,
  );

  assert.throws(
    () => buildExpectedTree({
      root,
      metadata: fixtureMetadata(),
      adapter: fixtureAdapter('claude'),
    }),
    /exclusion platforms must contain claude.*codex.*qoder.*pi/,
  );
});

test('buildExpectedTree selects platform blocks in adapter-generated Markdown', (t) => {
  const root = fixtureRepo(t);
  const adapter = {
    ...fixtureAdapter('claude'),
    generateFiles() {
      return new Map([[
        'skills/generated/SKILL.md',
        [
          '<!-- nocode:platform claude -->',
          'Claude native',
          '<!-- /nocode:platform -->',
          '<!-- nocode:platform codex -->',
          'Codex native',
          '<!-- /nocode:platform -->',
        ].join('\n'),
      ]]);
    },
  };
  const tree = buildExpectedTree({
    root,
    metadata: fixtureMetadata(),
    adapter,
  });
  const generated = tree.get('skills/generated/SKILL.md').toString();
  assert.match(generated, /Claude native/);
  assert.doesNotMatch(generated, /Codex native|nocode:platform/);
});

test('buildExpectedTree rejects platform blocks outside Markdown', (t) => {
  const root = fixtureRepo(t);
  writeFileSync(
    path.join(root, 'skills', 'hello', 'run.mjs'),
    '<!-- nocode:platform claude -->\n',
  );

  assert.throws(
    () => buildExpectedTree({
      root,
      metadata: fixtureMetadata(),
      adapter: fixtureAdapter(),
    }),
    /skills\/hello\/run\.mjs: platform blocks are Markdown-only/,
  );
});

test('writeExpectedTree cleans stale files and diffTree reports changed/missing/extra', (t) => {
  const root = fixtureRepo(t);
  const outputRoot = path.join(root, 'plugins', 'claude', 'nocode');
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(path.join(outputRoot, 'stale.txt'), 'stale');

  const expected = buildExpectedTree({
    root,
    metadata: fixtureMetadata(),
    adapter: fixtureAdapter(),
  });
  writeExpectedTree(expected, outputRoot, root);

  assert.deepEqual(diffTree(expected, outputRoot), {
    changed: [],
    missing: [],
    extra: [],
  });
  assert.equal(readFileSync(path.join(outputRoot, 'skills/hello/SKILL.md'), 'utf8'), 'hello\n');

  writeFileSync(path.join(outputRoot, 'skills/hello/SKILL.md'), 'changed\n');
  rmSync(path.join(outputRoot, '.claude-plugin/plugin.json'));
  writeFileSync(path.join(outputRoot, 'extra.txt'), 'extra');
  assert.deepEqual(diffTree(expected, outputRoot), {
    changed: ['skills/hello/SKILL.md'],
    missing: ['.claude-plugin/plugin.json'],
    extra: ['extra.txt'],
  });
});

test('writeExpectedTree refuses to clean a path outside repo plugins/<platform>', (t) => {
  const root = fixtureRepo(t);
  const expected = new Map([['safe.txt', Buffer.from('safe')]]);
  assert.throws(
    () => writeExpectedTree(expected, path.join(root, 'skills'), root),
    /plugins\/\{claude,codex,qoder,pi\}\/nocode/,
  );
});

test('writeExpectedTree preserves the source executable bit without assuming umask 022', (t) => {
  const root = fixtureRepo(t);
  const outputRoot = path.join(root, 'plugins', 'claude', 'nocode');
  const executable = path.join(root, 'skills', 'hello', 'executable.sh');
  const regular = path.join(root, 'skills', 'hello', 'regular.sh');
  writeFileSync(executable, '#!/bin/sh\n');
  writeFileSync(regular, 'documentation fixture\n');
  chmodSync(executable, 0o700);
  chmodSync(regular, 0o600);

  const expected = buildExpectedTree({
    root,
    metadata: fixtureMetadata(),
    adapter: fixtureAdapter(),
  });
  writeExpectedTree(expected, outputRoot, root);

  const modeOf = (relative) => statSync(path.join(outputRoot, relative)).mode & 0o777;
  assert.notEqual(modeOf('skills/hello/executable.sh') & 0o111, 0);
  assert.equal(modeOf('skills/hello/regular.sh') & 0o111, 0);
  assert.equal(modeOf('skills/hello/SKILL.md') & 0o111, 0);
});

test('package CLI argument parser defaults to both platforms and rejects unknown input', () => {
  assert.deepEqual(parseArgs([]), { check: false, platforms: ['claude', 'codex', 'qoder', 'pi'] });
  assert.deepEqual(parseArgs(['--check', '--platform=codex']), {
    check: true,
    platforms: ['codex'],
  });
  assert.throws(() => parseArgs(['--platform', 'other']), /unknown platform/);
  assert.throws(() => parseArgs(['--audit=inventory']), /unknown argument/);
  assert.throws(() => parseArgs(['--wat']), /unknown argument/);
});

test('package CLI run writes both manifests and then detects drift', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'platform-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'plugin'), { recursive: true });
  mkdirSync(path.join(root, 'commands'), { recursive: true });
  writeFileSync(
    path.join(root, 'plugin', 'metadata.json'),
    JSON.stringify(fixtureMetadata()),
  );

  const generated = run({ check: false, platforms: ['claude', 'codex'] }, root);
  assert.equal(generated.hasDrift, false);
  assert.ok(readFileSync(path.join(root, 'plugins/claude/nocode/.claude-plugin/plugin.json')));
  assert.ok(readFileSync(path.join(root, 'plugins/codex/nocode/.codex-plugin/plugin.json')));

  assert.deepEqual(run({ check: true, platforms: ['claude', 'codex'] }, root), {
    hasDrift: false,
    messages: [],
  });
  writeFileSync(path.join(root, 'plugins/codex/nocode/.codex-plugin/plugin.json'), '{}\n');
  const drift = run({ check: true, platforms: ['codex'] }, root);
  assert.equal(drift.hasDrift, true);
  assert.match(drift.messages.join('\n'), /codex: changed: \.codex-plugin\/plugin\.json/);

});

test('Claude adapter builds native skills and direct runtime overlays', () => {
  const metadata = JSON.parse(readFileSync(path.join(REPO_ROOT, 'plugin/metadata.json'), 'utf8'));
  const tree = buildExpectedTree({ root: REPO_ROOT, metadata, adapter: claudeAdapter });
  const required = [
    '.claude-plugin/plugin.json',
    'hooks/hooks.json',
    'model/agent-about.md',
    'references/skill-integration-map.md',
    'rules/rule-codex-review.md',
    'scripts/compile.rule.js',
    'skills/devflow/SKILL.md',
    'skills/task/SKILL.md',
    'runtime/context-budget.json',
    'runtime/plugin-data-entry.mjs',
  ];
  for (const relative of required) {
    assert.ok(tree.has(relative), `Claude artifact missing ${relative}`);
  }
  assert.equal(tree.has('skills/codex-nocode-reload/scripts/codex-nocode-reload.mjs'), false);
  assert.equal(tree.has('model/agent-nocode.md'), false);
  assert.equal(tree.has('skills/codex-nocode-reload/SKILL.md'), false);
  assert.equal(tree.has('skills/sow/scripts/test_script.py'), false);
  assert.equal([...tree.keys()].some((relative) => relative.startsWith('vendor/codex/')), false);
  for (const developmentOnly of [
    'scripts/check-skills.mjs',
    'scripts/package.platform.mjs',
    'scripts/vendor-sync.mjs',
    'scripts/lib/domain-registry.mjs',
  ]) assert.equal(tree.has(developmentOnly), false, `${developmentOnly} must not be published`);
  assert.equal(tree.has('.mcp.json'), false);
  assert.equal(tree.has('scripts/open-design-launch.mjs'), false);
  for (const nonComponentDoc of [
    'agents/AGENTS.md',
    'agents/README.md',
    'commands/AGENTS.md',
    'commands/README.md',
  ]) {
    assert.equal(tree.has(nonComponentDoc), false, `${nonComponentDoc} must not be auto-discovered`);
  }
  assert.equal(
    [...tree.keys()].some((relative) => relative.startsWith('agents/') || relative.startsWith('commands/')),
    false,
    'Claude agents and commands must be compiled into shared skills instead of published natively',
  );
  assert.equal(tree.has('docs/dev/INDEX.md'), false);
  assert.deepEqual(
    JSON.parse(tree.get('.claude-plugin/plugin.json').toString()),
    claudeAdapter.renderManifest(metadata),
  );
  const claudeDevflow = tree.get('skills/devflow/SKILL.md').toString();
  assert.match(claudeDevflow, /TaskCreate/);
  assert.match(claudeDevflow, /TaskUpdate/);
  assert.doesNotMatch(claudeDevflow, /update_plan|request_user_input/);
  const claudeTask = tree.get('skills/task/SKILL.md').toString();
  assert.match(claudeTask, /^---\nname: task\ndescription:/);
  assert.doesNotMatch(claudeTask, /x-nocode:/);
  assert.match(claudeTask, /\$ARGUMENTS/);
  assert.equal([...tree.keys()].some((relative) => relative.includes('using-nocode')), false);
  const claudeHooks = JSON.parse(tree.get('hooks/hooks.json').toString());
  assert.deepEqual(Object.keys(claudeHooks.hooks), ['SessionStart', 'PreToolUse', 'PostToolUse']);
  const claudeCommands = claudeHooks.hooks.SessionStart[0].hooks.map((hook) => hook.command);
  assert.ok(claudeCommands.some((command) => /runtime\/plugin-data-entry\.mjs/.test(command)
    && /session-open\.mjs/.test(command)));
  assert.ok(claudeCommands.some((command) => /inject-nocode\.sh" model-about(?: \d+)?$/.test(command)));
  assert.ok(claudeCommands.some((command) => /inject-nocode\.sh" project$/.test(command)));
  assert.ok(claudeCommands.some((command) => /personal-snapshot\.mjs/.test(command)));
  assert.doesNotMatch(JSON.stringify(claudeHooks), /model-nocode/);
  const claudeInjector = tree.get('hooks/inject-nocode.sh').toString();
  assert.match(claudeInjector, /runtime\/context-budget\.json/);
});

test('Codex adapter builds native skills and direct runtime overlays', () => {
  const metadata = JSON.parse(readFileSync(path.join(REPO_ROOT, 'plugin/metadata.json'), 'utf8'));
  const tree = buildExpectedTree({ root: REPO_ROOT, metadata, adapter: codexAdapter });
  const required = [
    '.codex-plugin/plugin.json',
    'skills/sow/scripts/script.py',
    'hooks/hooks.json',
    'model/agent-about.md',
    'rules/rule-git-worktree.md',
    'scripts/compile.rule.js',
    'skills/references/testing-guide.md',
    'skills/agents-launcher/agents/openai.yaml',
    'skills/codex-nocode-reload/SKILL.md',
    'skills/codex-nocode-reload/scripts/codex-nocode-reload.mjs',
    'skills/devflow/SKILL.md',
    'skills/task/SKILL.md',
    'runtime/context-budget.json',
    'runtime/plugin-data-entry.mjs',
  ];
  for (const relative of required) {
    assert.ok(tree.has(relative), `Codex artifact missing ${relative}`);
  }
  assert.equal(tree.has('model/agent-nocode.md'), false);
  assert.equal(tree.has('skills/sow/scripts/test_script.py'), false);
  assert.equal(tree.has('.mcp.json'), false);
  assert.equal(tree.has('scripts/open-design-launch.mjs'), false);
  assert.equal([...tree.keys()].some((relative) => relative.startsWith('vendor/codex/')), false);
  assert.equal(tree.has('scripts/package.platform.mjs'), false);
  assert.equal(tree.has('scripts/lib/platform-compiler.mjs'), false);
  assert.equal([...tree.keys()].some((relative) => relative.startsWith('shared/references/')), false);
  assert.equal(
    [...tree.keys()].some((relative) => relative.startsWith('agents/') || relative.startsWith('commands/')),
    false,
    'Codex agents and commands must be compiled into shared skills instead of copied twice',
  );

  const manifest = JSON.parse(tree.get('.codex-plugin/plugin.json').toString());
  assert.equal(manifest.name, path.basename(path.join(REPO_ROOT, 'plugins/codex/nocode')));
  assert.equal(manifest.version, metadata.version);
  assert.equal(manifest.skills, './skills/');
  assert.equal(manifest.interface.displayName, 'NoCode');
  assert.equal('hooks' in manifest, false, 'default hooks/hooks.json discovery is sufficient');
  assert.ok(Array.isArray(manifest.interface.capabilities));
  assert.ok(Array.isArray(manifest.interface.defaultPrompt));

  const devflow = tree.get('skills/devflow/SKILL.md').toString();
  assert.match(devflow, /update_plan/);
  assert.match(devflow, /request_user_input/);
  assert.doesNotMatch(devflow, /TaskCreate|AskUserQuestion/);
  assert.match(
    tree.get('skills/dev-build/SKILL.md').toString(),
    /\$\{PLUGIN_ROOT\}\/skills\/references/,
  );
  const launcher = tree.get('skills/agents-launcher/SKILL.md').toString();
  assert.doesNotMatch(launcher, /disable-model-invocation/);
  assert.match(
    tree.get('skills/agents-launcher/agents/openai.yaml').toString(),
    /interface:\n  display_name: "agents-launcher"\n  short_description: "Use when explicitly starting, stopping, restarting, or checking the local fx-da.+"\npolicy:\n  allow_implicit_invocation: false/,
  );
  const launcherServer = tree.get('skills/agents-launcher/references/server.md').toString();
  assert.match(launcherServer, /未提供密码时复用本机已有 Docker 登录态/);
  assert.doesNotMatch(launcherServer, /docker login[^\n]*\s-p(?:\s|=)/);
  for (const nested of ['decision', 'writing']) {
    assert.match(
      tree.get(`skills/dev-design/${nested}/SKILL.md`).toString(),
      /^---\nname: dev-design-(?:decision|writing)\ndescription:/,
    );
    assert.match(
      tree.get(`skills/dev-design/${nested}/agents/openai.yaml`).toString(),
      /allow_implicit_invocation: false/,
    );
  }
  const commandTask = tree.get('skills/task/SKILL.md').toString();
  assert.match(commandTask, /^---\nname: task\ndescription:/);
  assert.doesNotMatch(commandTask, /x-nocode:/);
  assert.doesNotMatch(commandTask, /\$ARGUMENTS/);
  assert.match(commandTask, /用户本次调用参数/);
  assert.equal([...tree.keys()].some((relative) => relative.includes('using-nocode')), false);
  assert.equal(tree.has('skills/agent-profiles/SKILL.md'), false);
  const codexHooks = JSON.parse(tree.get('hooks/hooks.json').toString());
  assert.deepEqual(Object.keys(codexHooks.hooks), ['SessionStart', 'PreToolUse', 'PostToolUse']);
  const codexCommands = codexHooks.hooks.SessionStart[0].hooks.map((hook) => hook.command);
  assert.ok(codexCommands.some((command) => /runtime\/plugin-data-entry\.mjs/.test(command)
    && /session-open\.mjs/.test(command)));
  assert.ok(codexCommands.some((command) => command === 'bash "${PLUGIN_ROOT}/hooks/inject-nocode.sh" model-about 1'
    || command === 'bash "${PLUGIN_ROOT}/hooks/inject-nocode.sh" model-about'));
  assert.ok(codexCommands.some((command) => command === 'bash "${PLUGIN_ROOT}/hooks/inject-nocode.sh" project'));
  assert.ok(codexCommands.some((command) => /personal-snapshot\.mjs/.test(command)));
  assert.doesNotMatch(JSON.stringify(codexHooks), /model-nocode/);
  const codexInjector = tree.get('hooks/inject-nocode.sh').toString();
  assert.match(codexInjector, /runtime\/context-budget\.json/);
  assert.match(codexInjector, /NOCODE_PLATFORM="\$\{NOCODE_PLATFORM:-codex\}"/);
  assert.doesNotMatch(JSON.stringify(codexHooks), /usage-tracker\.mjs/);
  assert.doesNotMatch(JSON.stringify(codexHooks), /\$\{CLAUDE_PLUGIN_ROOT\}/);
});

test('repo Codex marketplace points at the name-matched generated plugin root', () => {
  const marketplace = JSON.parse(
    readFileSync(path.join(REPO_ROOT, '.agents/plugins/marketplace.json'), 'utf8'),
  );
  assert.equal(marketplace.name, 'nocode-market');
  assert.equal(marketplace.interface.displayName, 'NoCode');
  assert.equal(marketplace.plugins.length, 1);
  assert.deepEqual(marketplace.plugins[0], {
    name: 'nocode',
    source: { source: 'local', path: './plugins/codex/nocode' },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
    category: 'Productivity',
  });
  const claudeMarketplace = JSON.parse(
    readFileSync(path.join(REPO_ROOT, '.claude-plugin/marketplace.json'), 'utf8'),
  );
  assert.match(claudeMarketplace.description, /Claude Code.*Codex|Codex.*Claude Code/);
  assert.equal(claudeMarketplace.plugins[0].source, './plugins/claude/nocode');
});

test('Pi adapter builds a package with prompts, skills, and an extension', () => {
  const metadata = JSON.parse(readFileSync(path.join(REPO_ROOT, 'plugin/metadata.json'), 'utf8'));
  const tree = buildExpectedTree({ root: REPO_ROOT, metadata, adapter: piAdapter });
  for (const relative of [
    'package.json',
    'extensions/index.ts',
    'prompts/task.md',
    'prompts/sow.md',
    'skills/devflow/SKILL.md',
    'model/agent-about.md',
    'runtime/plugin-data-entry.mjs',
    'runtime/context-budget.json',
    'hooks/pretooluse-rules.json',
    'scripts/sow/script.py',
  ]) {
    assert.ok(tree.has(relative), `Pi artifact missing ${relative}`);
  }
  assert.equal(tree.has('hooks/hooks.json'), false, 'Pi must not publish hooks.json');
  assert.equal(tree.has('skills/task/SKILL.md'), false, 'Pi entry commands are prompts, not skills');
  assert.equal(tree.has('skills/codex-nocode-reload/SKILL.md'), false);
  const manifest = JSON.parse(tree.get('package.json').toString());
  assert.equal(manifest.name, metadata.name);
  assert.equal(manifest.version, metadata.version);
  assert.deepEqual(manifest.pi, {
    extensions: ['./extensions/index.ts'],
    skills: ['./skills'],
    prompts: ['./prompts'],
  });
  const about = tree.get('model/agent-about.md').toString();
  assert.match(about, /\/skill:red-blue-deep/);
  assert.doesNotMatch(about, /AskUserQuestion|Skill\(nocode:|request_user_input/);
  const devflow = tree.get('skills/devflow/SKILL.md').toString();
  assert.match(devflow, /\/skill:<stage-skill>/);
  assert.doesNotMatch(devflow, /Skill\(nocode:|AskUserQuestion|update_plan/);
  const prompt = tree.get('prompts/task.md').toString();
  assert.match(prompt, /\$ARGUMENTS/);
  assert.doesNotMatch(prompt, /<!-- nocode:platform/);
});
