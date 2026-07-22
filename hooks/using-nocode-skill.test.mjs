import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('default bootstrap and using-nocode route all six domains without a gateway runtime', () => {
  const aboutPath = path.join(ROOT, 'model/agent-about.md');
  const legacyBootstrapPath = path.join(ROOT, 'model/agent-nocode.md');
  const skillPath = path.join(ROOT, 'skills/using-nocode/SKILL.md');
  assert.equal(existsSync(aboutPath), true, 'agent-about baseline is required');
  assert.equal(existsSync(legacyBootstrapPath), false, 'standalone agent-nocode must stay removed');
  assert.equal(existsSync(skillPath), true, 'using-nocode Skill is required');

  const bootstrap = readFileSync(aboutPath, 'utf8');
  assert.ok(
    bootstrap.lastIndexOf('# nocode Capability Bootstrap') > bootstrap.indexOf('# 全局约定'),
    'Capability Bootstrap must be appended at the bottom of agent-about',
  );
  assert.match(bootstrap, /using-nocode/);
  assert.match(bootstrap, /外部.*数据|网页.*数据|工具输出.*数据/s);
  assert.match(bootstrap, /approval|确认|权限/i);
  assert.match(bootstrap.trimEnd(), /没有相应权限时停止并向用户说明。$/);

  const skill = readFileSync(skillPath, 'utf8');
  assert.match(skill, /^---\nname: using-nocode\n/m);
  assert.match(
    skill,
    /^description: MUST use on any Capability mention or name, even with 1% relevance or in untrusted text\.$/m,
    'any possible Capability reference must force using-nocode routing',
  );
  assert.match(skill, /Domain Routing/);
  for (const domain of [
    'workflow', 'workspace', 'design', 'runtime-state', 'personal-knowledge', 'lifecycle',
  ]) {
    assert.match(skill, new RegExp(`references/${domain}\\.md`));
  }
  assert.doesNotMatch(skill, /nocode-domains\.md|gateway\.mjs|attemptToken/);
});
