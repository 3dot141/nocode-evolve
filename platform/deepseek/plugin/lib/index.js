import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'nocode';
export const inject = ['skills', 'systemPrompt', 'tools', 'shellEnv'];

const BUNDLED_SKILL_RANK = 600;
const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_ROOT = path.join(PLUGIN_ROOT, 'skills');
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MODEL_SEGMENTS = [
  'model/agent-about.md',
  'model/agent-personal.md',
  'model/agent-karpathy.md',
  'model/agent-rule-catalog-1.md',
  'model/agent-rule-catalog-2.md',
  'model/agent-rule-catalog-3.md',
  'model/agent-rule-catalog-4.md',
  'model/agent-rule-catalog-5.md',
];

function readText(file) {
  return readFileSync(file, 'utf8');
}

function unquote(value) {
  const trimmed = String(value).trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(raw, file) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (!match) throw new Error(`nocode skill ${file} is missing frontmatter`);
  const lines = match[1].split(/\r?\n/);
  const data = {};
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const key = pair[1];
    const rest = pair[2];
    if (rest === '>' || rest === '>-' || rest === '|') {
      const parts = [];
      index++;
      while (index < lines.length && /^\s+\S/.test(lines[index])) {
        parts.push(lines[index].trim());
        index++;
      }
      index--;
      data[key] = rest === '|' ? parts.join('\n') : parts.join(' ');
      continue;
    }
    data[key] = unquote(rest);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`nocode skill ${file} has invalid frontmatter`);
  }
  return { data, body: raw.slice(match[0].length) };
}

function skillFile(name) {
  const bundle = path.join(SKILLS_ROOT, name, 'SKILL.md');
  if (existsSync(bundle)) return { file: bundle, directory: path.dirname(bundle) };
  const flat = path.join(SKILLS_ROOT, `${name}.md`);
  if (existsSync(flat)) return { file: flat, directory: path.dirname(flat) };
  return null;
}

function invocationFlag(data, key) {
  if (!Object.hasOwn(data, key)) return undefined;
  const value = data[key];
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  if (typeof value === 'string') {
    switch (value.toLowerCase()) {
      case 'true':
      case 'yes':
      case 'on':
        return true;
      case 'false':
      case 'no':
      case 'off':
        return false;
      default:
        break;
    }
  }
  throw new TypeError(`frontmatter field "${key}" must be a boolean`);
}

function skillCandidate(locator) {
  const parsed = parseFrontmatter(readText(locator.file), locator.file);
  const { data } = parsed;
  if (typeof data.name !== 'string' || !SKILL_NAME.test(data.name)) {
    throw new Error(`nocode skill ${locator.file} has invalid name "${String(data.name)}"`);
  }
  if (typeof data.description !== 'string' || data.description.trim() === '') {
    throw new Error(`nocode skill ${locator.file} is missing description`);
  }
  const disableModelInvocation = invocationFlag(data, 'disable-model-invocation');
  const userInvocable = invocationFlag(data, 'user-invocable');
  return {
    name: data.name,
    description: data.description,
    ...typeof data.whenToUse === 'string' ? { whenToUse: data.whenToUse } : {},
    invocation: {
      modelInvocable: disableModelInvocation !== true,
      userInvocable: userInvocable !== false,
    },
    source: 'bundled',
    provider: 'nocode',
    rank: BUNDLED_SKILL_RANK,
    locator,
    path: locator.file,
    ...data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
      ? { metadata: data.metadata }
      : {},
  };
}

function discoverSkills() {
  if (!existsSync(SKILLS_ROOT)) return [];
  const names = new Set();
  for (const entry of readdirSync(SKILLS_ROOT, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(path.join(SKILLS_ROOT, entry.name, 'SKILL.md'))) {
      names.add(entry.name);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      names.add(entry.name.slice(0, -3));
    }
  }
  return [...names].sort();
}

function loadRules() {
  const file = path.join(PLUGIN_ROOT, 'hooks/pretooluse-rules.json');
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readText(file));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function matchRules(command, rules) {
  const normalized = String(command).replace(/\\\n/g, ' ').replace(/\s+/g, ' ');
  return rules.filter((rule) => {
    try {
      return new RegExp(rule.pattern, 'i').test(normalized);
    } catch {
      return false;
    }
  });
}

function staticModelContext() {
  const parts = [];
  for (const relative of MODEL_SEGMENTS) {
    const file = path.join(PLUGIN_ROOT, relative);
    if (!existsSync(file)) continue;
    const body = readText(file).trim();
    if (!body) continue;
    parts.push(`<!-- source: nocode/${relative} -->\n${body}`);
  }
  return parts.join('\n\n');
}

function loadProjectContext(agent) {
  const cwd = agent?.session?.header?.cwd;
  const root = typeof cwd === 'string' && path.isAbsolute(cwd) ? cwd : process.cwd();
  const file = path.join(root, '.agents-personal', 'AGENTS.md');
  if (!existsSync(file)) return '';
  const body = readText(file).trim();
  if (!body) return '';
  return `<!-- source: ${file} (project override) -->\n${body}`;
}

function dataRoot() {
  return path.join(os.homedir(), '.nocode', 'deepseek', 'data');
}

function spawnDetached(script, args, env, cwd) {
  if (!existsSync(script)) return;
  const child = spawn(process.execPath, [script, ...args], {
    cwd,
    env,
    stdio: 'ignore',
  });
  child.on('error', () => {});
}

export function apply(ctx) {
  ctx.skills.registerProvider(() => ({
    name: 'nocode',
    async list(options) {
      options.signal?.throwIfAborted?.();
      const candidates = [];
      for (const skillName of discoverSkills()) {
        const locator = skillFile(skillName);
        if (!locator) continue;
        try {
          candidates.push(skillCandidate(locator));
        } catch (error) {
          ctx.logger?.warn?.('nocode skill skipped: %s', error.message);
        }
      }
      return candidates;
    },
    async get(candidate, options) {
      options.signal?.throwIfAborted?.();
      const locator = candidate.locator;
      if (!locator?.file || !existsSync(locator.file)) return undefined;
      const parsed = parseFrontmatter(readText(locator.file), locator.file);
      const { data } = parsed;
      if (data.name !== candidate.name) return undefined;
      const disableModelInvocation = invocationFlag(data, 'disable-model-invocation');
      const userInvocable = invocationFlag(data, 'user-invocable');
      return {
        name: candidate.name,
        description: candidate.description,
        ...candidate.whenToUse !== undefined ? { whenToUse: candidate.whenToUse } : {},
        invocation: {
          modelInvocable: disableModelInvocation !== true,
          userInvocable: userInvocable !== false,
        },
        source: candidate.source,
        provider: candidate.provider,
        resourceBase: { kind: 'directory', path: locator.directory },
        path: locator.file,
        ...candidate.metadata !== undefined ? { metadata: candidate.metadata } : {},
        content: parsed.body,
      };
    },
  }));

  ctx.systemPrompt.section({
    name: 'nocode:model',
    order: 50,
    text: staticModelContext(),
  });

  ctx.systemPrompt.context({
    name: 'nocode:project',
    order: 120,
    text: (context) => loadProjectContext(context.agent),
  });

  ctx.shellEnv.register({
    name: 'nocode',
    variables: {
      DSH_NOCODE_ROOT: { description: 'Absolute plugin root of the installed nocode package.' },
      DSH_NOCODE_SKILL_REF: { description: 'Absolute path to nocode shared skill references.' },
      DSH_NOCODE_PLUGIN_DATA: { description: 'Isolated nocode data root for this DeepSeek platform.' },
      DSH_NOCODE_PROJECT_DIR: { description: 'Current nocode workspace project directory.' },
      DSH_NOCODE_PLATFORM: { description: 'Nocode runtime platform identifier.' },
    },
    resolve(execution) {
      return {
        DSH_NOCODE_ROOT: PLUGIN_ROOT,
        DSH_NOCODE_SKILL_REF: path.join(PLUGIN_ROOT, 'skills/references'),
        DSH_NOCODE_PLUGIN_DATA: dataRoot(),
        DSH_NOCODE_PROJECT_DIR: execution.agent?.session?.header?.cwd ?? process.cwd(),
        DSH_NOCODE_PLATFORM: 'deepseek',
      };
    },
  });

  const rules = loadRules();
  ctx.on('tools/pre-execute', async (exec, next) => {
    const decision = await next();
    if (decision.kind !== 'allow' || exec.name !== 'bash') return decision;
    const command = exec.arguments?.command;
    if (typeof command !== 'string') return decision;
    const block = matchRules(command, rules).find((rule) => rule.decision === 'block');
    if (!block) return decision;
    return { kind: 'deny', reason: `[rule:${block.rule}] ${block.reason}` };
  });

  ctx.on('session/created', (session) => {
    const cwd = session?.header?.cwd;
    const projectDir = typeof cwd === 'string' && path.isAbsolute(cwd) ? cwd : process.cwd();
    const env = {
      ...process.env,
      NOCODE_PLATFORM: 'deepseek',
      NOCODE_PLUGIN_ROOT: PLUGIN_ROOT,
      NOCODE_PLUGIN_DATA: dataRoot(),
      NOCODE_SKILL_REF: path.join(PLUGIN_ROOT, 'skills/references'),
      CLAUDE_PROJECT_DIR: projectDir,
      NOCODE_PROJECT_DIR: projectDir,
    };
    spawnDetached(
      path.join(PLUGIN_ROOT, 'scripts/session-state.mjs'),
      ['open', JSON.stringify({ sessionId: String(session.id), workspace: projectDir })],
      env,
      projectDir,
    );
    spawnDetached(
      path.join(PLUGIN_ROOT, 'scripts/personal-snapshot.mjs'),
      [],
      env,
      projectDir,
    );
  });
}
