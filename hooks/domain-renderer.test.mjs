import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDomainReferences } from '../scripts/lib/domain-renderer.mjs';
import { loadDomainRegistry } from '../scripts/lib/domain-registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('renders one platform reference per domain without runtime internals', () => {
  const registry = loadDomainRegistry(ROOT);
  for (const platform of ['claude', 'codex']) {
    const files = renderDomainReferences({ registry, resolution: registry.resolvePlatform(platform), platform });
    assert.deepEqual([...files.keys()], [
      'skills/using-nocode/references/design.md',
      'skills/using-nocode/references/lifecycle.md',
      'skills/using-nocode/references/personal-knowledge.md',
      'skills/using-nocode/references/runtime-state.md',
      'skills/using-nocode/references/workflow.md',
      'skills/using-nocode/references/workspace.md',
    ]);
    const design = files.get('skills/using-nocode/references/design.md').toString();
    assert.match(design, /design\.artifact\.generate/);
    assert.match(design, /Provider: open-design/);
    assert.match(design, /manual fallback: local-html/);
    assert.doesNotMatch(design, /gateway|attemptToken|scripts\/route|wrapper argv|private skill/i);
    const runtimeState = files.get('skills/using-nocode/references/runtime-state.md').toString();
    assert.doesNotMatch(runtimeState, /state\.execution\.(?:create|recover|update)|state\.handoff\./);
  }
});
