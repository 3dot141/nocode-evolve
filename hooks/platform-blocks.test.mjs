import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPlatformBlocks } from '../scripts/lib/platform-blocks.mjs';

const SOURCE = `shared before
<!-- nocode:platform claude -->
use Agent
<!-- /nocode:platform -->
<!-- nocode:platform codex -->
use spawn_agent
<!-- /nocode:platform -->
<!-- nocode:platform pi -->
use /skill:dev-design
<!-- /nocode:platform -->
shared after
`;

test('renders shared Markdown plus only the selected platform block', () => {
  assert.equal(
    renderPlatformBlocks(SOURCE, { platform: 'claude', file: 'skills/example/SKILL.md' }),
    'shared before\nuse Agent\nshared after\n',
  );
  assert.equal(
    renderPlatformBlocks(SOURCE, { platform: 'codex', file: 'skills/example/SKILL.md' }),
    'shared before\nuse spawn_agent\nshared after\n',
  );
  assert.equal(
    renderPlatformBlocks(SOURCE, { platform: 'pi', file: 'skills/example/SKILL.md' }),
    'shared before\nuse /skill:dev-design\nshared after\n',
  );
  assert.equal(
    renderPlatformBlocks(SOURCE, { platform: 'deepseek', file: 'skills/example/SKILL.md' }),
    'shared before\nuse /skill:dev-design\nshared after\n',
  );
});

test('codebuddy and qoder fall back to the claude block content', () => {
  for (const platform of ['codebuddy', 'qoder']) {
    assert.equal(
      renderPlatformBlocks(SOURCE, { platform, file: 'skills/example/SKILL.md' }),
      'shared before\nuse Agent\nshared after\n',
      platform,
    );
  }
});

test('a dedicated block suppresses the claude fallback for that platform', () => {
  const source = `shared before
<!-- nocode:platform claude -->
use Agent
<!-- /nocode:platform -->
<!-- nocode:platform codebuddy -->
use Monitor
<!-- /nocode:platform -->
shared after
`;
  // 专属块存在时只渲染专属块——兜底块再叠加会输出两条互相矛盾的指令
  assert.equal(
    renderPlatformBlocks(source, { platform: 'codebuddy', file: 'skills/example/SKILL.md' }),
    'shared before\nuse Monitor\nshared after\n',
  );
  // 其它平台不受影响
  assert.equal(
    renderPlatformBlocks(source, { platform: 'claude', file: 'skills/example/SKILL.md' }),
    'shared before\nuse Agent\nshared after\n',
  );
  assert.equal(
    renderPlatformBlocks(source, { platform: 'qoder', file: 'skills/example/SKILL.md' }),
    'shared before\nuse Agent\nshared after\n',
  );
});

test('rejects an unknown target platform', () => {
  assert.throws(
    () => renderPlatformBlocks('shared\n', { platform: 'cursor', file: 'example.md' }),
    /example\.md: unknown target platform: cursor/,
  );
});

test('rejects unknown, nested, unclosed, and unexpected close markers with line numbers', () => {
  const invalid = [
    {
      source: 'first\n<!-- nocode:platform cursor -->\nlast',
      expected: /example\.md:2: invalid platform block/,
    },
    {
      source: '<!-- nocode:platform claude -->\n<!-- nocode:platform codex -->\n<!-- \u002Fnocode:platform -->',
      expected: /example\.md:2: nested platform block/,
    },
    {
      source: 'first\n<!-- nocode:platform claude -->\nlast',
      expected: /example\.md:2: unclosed claude platform block/,
    },
    {
      source: 'first\n<!-- \u002Fnocode:platform -->',
      expected: /example\.md:2: unexpected platform block close/,
    },
  ];

  for (const { source, expected } of invalid) {
    assert.throws(
      () => renderPlatformBlocks(source, { platform: 'claude', file: 'example.md' }),
      expected,
    );
  }
});
