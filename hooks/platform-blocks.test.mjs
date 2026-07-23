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
