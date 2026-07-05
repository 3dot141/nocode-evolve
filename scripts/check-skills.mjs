#!/usr/bin/env node
/**
 * check-skills.mjs — skills/ + commands/ 路由 / 断链 / frontmatter 静态检查
 *
 * 折叠前护栏 + commit 前 lint。上一批 24-skill 自动化压缩曾把 reviewing/dev-land 的
 * description 写成字面 schema 占位符 / YAML 语法泄漏且逃过验证门控——本检查器专门拦这类。
 *
 * 用法:
 *   node scripts/check-skills.mjs           # 跑检查, 有 error exit 1 (warn 不阻断)
 *   node scripts/check-skills.mjs --check    # 同上 (别名, 对齐 compile.rule.js --check)
 *
 * 检查项 (error = 确定性坏, 阻断; warn = 有合理例外, 只报不阻断):
 *   1. [error] frontmatter 健全: 能解析, skill 的 name==目录名, description 非空
 *   2. [error] description 污染: schema 关键词泄漏 / JSON 片段 / 过短 (防自动化压缩写坏)
 *   3. [error] 路由断链: Skill(nocode:X) 的 X 必须存在于 skills/ 或 commands/ (排除文档占位符 / 外部 skill)
 *   4. [error] reference 断链: 自身 references/Y.md 必须存在
 *   5. [warn]  self-loop 越界: SKILL.md / references 直接指路 rules/model/hooks 或别的 skill 的 references
 *
 * 已知盲区 (故意不覆盖, 避免误报):
 *   - 共享 references 引用 ({NOCODE_SKILL_REF}/x.md 与插件根 references/x.md) 的存在性不验证——
 *     这类引用常用变量/标注表达, 机器难可靠区分"自己的 references/"还是"共享的", 且现状均真实存在。
 *   - 无 nocode: 前缀的外部 skill (Skill(lark-doc) 等) 不验证——目标在别的插件, 本仓库无从判断。
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, ROOT } from './compile.rule.js';

const SKILLS_DIR = path.join(ROOT, 'skills');
const COMMANDS_DIR = path.join(ROOT, 'commands');

// Skill(nocode:X) 里 X 是文档示例而非真实路由目标, 跳过存在性检查
const PLACEHOLDER_TARGETS = new Set(['xxx', 'name', 'x', 'y', 'foo', 'bar']);

// description 污染信号: 正常 skill description 不会出现这些 (JSON Schema 关键词 / JSON 片段起手)
const CONTAMINATION = /\$schema|"type"\s*:|additionalProperties|propertyNames|"JSONSchema"|^\s*[{[]/;

// 合法 skill 名格式 (小写 + 连字符)
const SKILL_NAME = /^[a-z][a-z0-9-]+$/;

// self-loop 越界: 跨层直接指路插件内部实现 (CLAUDE.md 规则 6)
const CROSS_LAYER = /(?:rules\/rule-[\w-]+\.md|model\/agent-[\w-]+\.md|hooks\/[\w.-]+)/;

/** skills/ 下所有含 SKILL.md 的目录名 */
export function listSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, d.name, 'SKILL.md')))
    .map((d) => d.name)
    .sort();
}

/** commands/ 下所有 command 名 (去 .md, 排除 README/AGENTS 文档) */
export function listCommandTargets() {
  if (!fs.existsSync(COMMANDS_DIR)) return [];
  return fs
    .readdirSync(COMMANDS_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'README.md' && f !== 'AGENTS.md')
    .map((f) => f.slice(0, -3))
    .sort();
}

/** Skill(nocode:X) 的合法目标集: skill 与 command 共享 nocode: 命名空间 */
export function routeTargetSet() {
  return new Set([...listSkills(), ...listCommandTargets()]);
}

/** 提取正文里的 Skill(nocode:X) 真实路由目标 (剔除占位符 / 外部 skill) */
export function extractRoutes(body) {
  const out = [];
  for (const m of body.matchAll(/Skill\(\s*nocode:([^)]*?)\s*\)/g)) {
    const target = m[1].trim();
    if (!SKILL_NAME.test(target)) continue; // 含 <>/空格/中文/. 的占位符
    if (PLACEHOLDER_TARGETS.has(target)) continue;
    out.push(target);
  }
  return out;
}

/**
 * 提取自身 references 引用 (references/Y.md, 前面不是 skills/OTHER/ 完整路径).
 * 完整路径 skills/OTHER/references/*.md 归 self-loop warn, 不当自身断链.
 */
export function extractOwnRefs(body) {
  const out = [];
  for (const m of body.matchAll(/(\S*?)references\/([\w.-]+\.md)/g)) {
    const prefix = m[1];
    // 前缀以 skills/... 或任何路径分隔结尾 → 指向别的 skill 的完整路径, 不算自身 reference
    if (/[/\\]$/.test(prefix)) continue;
    out.push(m[2]);
  }
  return out;
}

/**
 * 检查单个 skill 的文本, 返回 {errors, warnings} — 纯函数, 不碰文件系统 (可单测).
 * ctx = { targets:Set<string>, hasRefDir:boolean, refExists:(ref)=>boolean }
 */
export function checkSkillText(name, raw, { targets, hasRefDir, refExists }) {
  const errors = [];
  const warnings = [];
  const rel = `skills/${name}/SKILL.md`;

  const fm = parseFrontmatter(raw);
  if (!fm) {
    errors.push(`${rel}: 缺 frontmatter (--- 包裹的 name/description)`);
    return { errors, warnings };
  }
  if (!fm.name) errors.push(`${rel}: frontmatter 缺 name`);
  else if (fm.name !== name) errors.push(`${rel}: name="${fm.name}" 与目录名 "${name}" 不一致`);

  if (!fm.description) {
    errors.push(`${rel}: frontmatter 缺 description`);
  } else {
    if (CONTAMINATION.test(fm.description))
      errors.push(`${rel}: description 疑似污染 (schema 关键词 / JSON 片段): "${fm.description.slice(0, 60)}…"`);
    if (fm.description.trim().length < 10)
      errors.push(`${rel}: description 过短 (${fm.description.trim().length} 字符), 疑似被清空/写坏`);
  }

  const body = raw.slice(raw.indexOf('---', 3) + 3); // frontmatter 之后的正文

  for (const target of extractRoutes(body)) {
    if (!targets.has(target))
      errors.push(`${rel}: 路由断链 Skill(nocode:${target}) → skills/${target}/ 与 commands/${target}.md 都不存在`);
  }

  for (const ref of extractOwnRefs(body)) {
    if (/^xxx/.test(ref)) continue; // 文档占位符示例 (references/xxx.md / xxx-review.md)
    if (!hasRefDir) continue; // 本 skill 无 references/ 目录 → 裸 references/ 引用指向共享或别的 skill, 非自身断链
    if (!refExists(ref)) errors.push(`${rel}: reference 断链 references/${ref} → 文件不存在`);
  }

  // self-loop 越界 (warn): 正文直接指路 rules/model/hooks
  const crossLine = body.split('\n').find((l) => CROSS_LAYER.test(l));
  if (crossLine)
    warnings.push(`${rel}: self-loop 越界, 正文直接指路插件内部实现: "${crossLine.trim().slice(0, 80)}…"`);

  return { errors, warnings };
}

/** IO 包装: 读盘 + 组装 ctx, 委托 checkSkillText */
function checkOneSkill(name) {
  const dir = path.join(SKILLS_DIR, name);
  const raw = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
  const refDir = path.join(dir, 'references');
  return checkSkillText(name, raw, {
    targets: routeTargetSet(),
    hasRefDir: fs.existsSync(refDir),
    refExists: (ref) => fs.existsSync(path.join(refDir, ref)),
  });
}

/** 检查 commands/*.md 的 description 污染 + 路由断链 (command 也路由到 skill) */
function checkCommands() {
  const errors = [];
  if (!fs.existsSync(COMMANDS_DIR)) return errors;
  const targets = routeTargetSet();
  for (const f of fs.readdirSync(COMMANDS_DIR)) {
    if (!f.endsWith('.md') || f === 'README.md' || f === 'AGENTS.md') continue;
    const raw = fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf8');
    const rel = `commands/${f}`;
    const fm = parseFrontmatter(raw);
    if (fm?.description && CONTAMINATION.test(fm.description))
      errors.push(`${rel}: description 疑似污染: "${fm.description.slice(0, 60)}…"`);
    const body = raw.slice(raw.indexOf('---', 3) + 3);
    for (const target of extractRoutes(body)) {
      if (!targets.has(target))
        errors.push(`${rel}: 路由断链 Skill(nocode:${target}) → skills/${target}/ 与 commands/${target}.md 都不存在`);
    }
  }
  return errors;
}

/** 全量检查, 返回 {errors, warnings} */
export function checkAll() {
  const errors = [];
  const warnings = [];
  for (const name of listSkills()) {
    const r = checkOneSkill(name);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }
  errors.push(...checkCommands());
  return { errors, warnings };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, warnings } = checkAll();
  for (const w of warnings) console.warn('  WARN  ' + w);
  for (const e of errors) console.error('  ERROR ' + e);
  const nSkills = listSkills().length;
  if (errors.length) {
    console.error(`\ncheck-skills: ${nSkills} skills, ${errors.length} error, ${warnings.length} warn — 有断链/污染, 修复后重跑`);
    process.exit(1);
  }
  console.log(`check-skills: ${nSkills} skills 全部通过 (${warnings.length} warn)`);
}
