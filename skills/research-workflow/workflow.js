export const meta = {
  name: 'research-workflow',
  description: 'Generic research workflow — multi-angle search with iterative refinement, claim extraction, adversarial verification, synthesis. Preset types (web/code/mixed/custom) bundle tool chains; configurable via type + systemPrompt.',
  phases: [
    { title: 'Scope', detail: 'Decompose question into search angles (skip if pre-set)' },
    { title: 'Search', detail: 'Per-angle iterative search (search → evaluate → refine, up to N rounds)' },
    { title: 'Extract', detail: 'Deep only: fetch sources, extract falsifiable claims' },
    { title: 'Verify', detail: 'Deep only: 3-vote adversarial verification per claim' },
    { title: 'Synthesize', detail: 'Merge dupes, rank by confidence, cite sources' },
  ],
}

// ─── Args ───
// {
//   question: string                       — required, the research question
//   type: 'web'|'code'|'mixed'|'custom'    — preset; bundles tool chain + iterate default
//   depth: 'shallow' | 'deep'              — default 'deep'
//   iterate: number                        — max search rounds per angle; default per-type
//   systemPrompt: string                   — appended after the type's tool chain (required for 'custom')
//   angles: [{label, query, rationale?}]   — optional, skip Scope if provided
// }

// ─── Type presets: tool chains + defaults ───
const TOOL_CHAINS = {
  web: `搜索用 WebSearch 或 Exa。
抓取网页用 WebFetch；WebFetch 失败（403/timeout）时降级到 ScraplingServer：
  mcp__ScraplingServer__fetch（常规）
  mcp__ScraplingServer__stealthy_fetch（反爬严的站）
遇到开源库用 deepwiki 查文档。
引用格式: [SOURCE: url]。`,

  code: `搜索用 semble-search agent（Agent subagent_type: "nocode-evolve:semble-search"）。
semble-search 不可用时降级：Bash grep -r 或 rg → Explore agent。
引用格式: [Read path:line]。`,

  mixed: `代码搜索用 semble-search agent，网络搜索用 WebSearch 或 Exa。
抓取网页用 WebFetch，失败时降级到 ScraplingServer。
遇到开源库用 deepwiki 查文档。
按问题性质自选工具——代码相关走 semble-search，外部方案走 WebSearch。
引用格式: 代码 [Read path:line]，网络 [SOURCE: url]。`,

  custom: '',
}

const TYPE_DEFAULTS = {
  web:    { iterate: 1 },
  code:   { iterate: 3 },
  mixed:  { iterate: 2 },
  custom: { iterate: 1 },
}

const raw = typeof args === 'string' ? { question: args } : (args || {})
const QUESTION = raw.question || ''
if (!QUESTION) {
  return { error: 'No research question. Pass args: { question, type?, depth?, iterate?, systemPrompt?, angles? }' }
}

const TYPE = TOOL_CHAINS[raw.type] !== undefined ? raw.type : 'mixed'
const DEPTH = raw.depth || 'deep'
const IS_DEEP = DEPTH === 'deep'
const PRE_ANGLES = Array.isArray(raw.angles) && raw.angles.length > 0 ? raw.angles : null

// Max search rounds per angle: explicit arg > type default > 1
const MAX_ROUNDS = Math.max(1, Number.isInteger(raw.iterate) ? raw.iterate : TYPE_DEFAULTS[TYPE].iterate)

// systemPrompt = type's tool chain + caller's domain context
const TOOL_CHAIN = TOOL_CHAINS[TYPE]
const USER_PROMPT = raw.systemPrompt || ''
const SYSTEM_PROMPT = [TOOL_CHAIN, USER_PROMPT].filter(Boolean).join('\n\n') ||
  '通用研究模式。网络搜索用 WebSearch，代码搜索用 semble-search agent。按问题领域自选工具。'

const VOTES_PER_CLAIM = 3
const REFUTATIONS_REQUIRED = 2
const MAX_SOURCES = IS_DEEP ? 15 : 8
const MAX_VERIFY_CLAIMS = 25
const ANGLE_COUNT_SHALLOW = '2-3'
const ANGLE_COUNT_DEEP = '4-6'
const CONVERGE_HIGH_RELEVANCE = 3

// ─── Schemas ───
const SCOPE_SCHEMA = {
  type: 'object', required: ['question', 'angles'],
  properties: {
    question: { type: 'string' },
    angles: {
      type: 'array', minItems: 2, maxItems: 6, items: {
        type: 'object', required: ['label', 'query'],
        properties: {
          label: { type: 'string' },
          query: { type: 'string' },
          rationale: { type: 'string' },
        },
      },
    },
  },
}

const SEARCH_SCHEMA = {
  type: 'object', required: ['results'],
  properties: {
    results: {
      type: 'array', maxItems: 8, items: {
        type: 'object', required: ['ref', 'title', 'relevance'],
        properties: {
          ref: { type: 'string', description: 'URL for web, file:line for code, or other locator' },
          title: { type: 'string' },
          snippet: { type: 'string' },
          relevance: { enum: ['high', 'medium', 'low'] },
          sourceType: { type: 'string', description: 'web-page, code-file, doc, forum, etc.' },
        },
      },
    },
  },
}

const EVALUATE_SCHEMA = {
  type: 'object', required: ['highRelevance', 'gaps', 'refinedQueries'],
  properties: {
    highRelevance: { type: 'integer', description: '高相关结果数（relevance=high）' },
    gaps: { type: 'string', description: '还缺什么上下文 / 哪个方向没覆盖到' },
    refinedQueries: {
      type: 'array', items: { type: 'string' }, maxItems: 3,
      description: '调整后的查询：补上从已有结果里发现的新术语、排掉确认无关的方向、针对 gaps 开新查询',
    },
  },
}

const EXTRACT_SCHEMA = {
  type: 'object', required: ['claims', 'sourceQuality'],
  properties: {
    sourceQuality: { enum: ['primary', 'secondary', 'code-core', 'code-test', 'code-config', 'blog', 'forum', 'unreliable'] },
    claims: {
      type: 'array', maxItems: 5, items: {
        type: 'object', required: ['claim', 'evidence', 'importance'],
        properties: {
          claim: { type: 'string', description: 'A falsifiable statement' },
          evidence: { type: 'string', description: 'Direct quote or code snippet supporting the claim' },
          importance: { enum: ['central', 'supporting', 'tangential'] },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object', required: ['refuted', 'evidence', 'confidence'],
  properties: {
    refuted: { type: 'boolean' },
    evidence: { type: 'string' },
    confidence: { enum: ['high', 'medium', 'low'] },
    counterRef: { type: 'string', description: 'URL or file:line of counter-evidence' },
  },
}

const REPORT_SCHEMA = {
  type: 'object', required: ['summary', 'findings', 'caveats'],
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array', items: {
        type: 'object', required: ['claim', 'confidence', 'sources', 'evidence'],
        properties: {
          claim: { type: 'string' },
          confidence: { enum: ['high', 'medium', 'low'] },
          sources: { type: 'array', items: { type: 'string' } },
          evidence: { type: 'string' },
          vote: { type: 'string' },
        },
      },
    },
    caveats: { type: 'string' },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
}

// ─── Prompt builders ───
const scopePrompt = () =>
  '## Context\n' + SYSTEM_PROMPT + '\n\n' +
  '## Task: Decompose Research Question\n\n' +
  'Question: "' + QUESTION + '"\n\n' +
  'Generate ' + (IS_DEEP ? ANGLE_COUNT_DEEP : ANGLE_COUNT_SHALLOW) + ' distinct search angles that together cover the question.\n' +
  'Each angle should use a different search strategy or tool.\n' +
  'The context above tells you which tools are available and what domain you\'re in — pick angles that make sense for that domain.\n' +
  'Make queries specific enough to surface high-signal results. Avoid redundancy.\n\nStructured output only.'

const searchPrompt = (angle, queries, round) =>
  '## Context\n' + SYSTEM_PROMPT + '\n\n' +
  '## Task: Search' + (round > 0 ? ' (refined round ' + (round + 1) + ')' : '') + '\n\n' +
  'Research question: "' + QUESTION + '"\n' +
  'Your angle: **' + angle.label + '**' + (angle.rationale ? ' — ' + angle.rationale : '') + '\n' +
  'Search ' + (queries.length > 1 ? 'queries' : 'query') + ': ' + queries.map(q => '`' + q + '`').join(', ') + '\n\n' +
  'Use the tools described in the context to search. Return the top 4-6 most relevant results.\n' +
  'For each result, provide a ref (URL for web, file:line for code), title, snippet, and relevance rating.\n' +
  'Skip obvious spam or irrelevant results.\n\nStructured output only.'

const evaluatePrompt = (angle, results) =>
  '## Context\n' + SYSTEM_PROMPT + '\n\n' +
  '## Task: Evaluate Search Coverage\n\n' +
  'Research question: "' + QUESTION + '"\n' +
  'Angle: **' + angle.label + '**\n\n' +
  'Results so far (' + results.length + '):\n' +
  results.map((r, i) => (i + 1) + '. [' + r.relevance + '] ' + r.title + ' (' + r.ref + ')').join('\n') + '\n\n' +
  'Assess coverage for THIS angle:\n' +
  '1. Count results that directly hit the target (relevance=high).\n' +
  '2. What context is still missing? Which sub-direction has no good hit yet?\n' +
  '3. Propose up to 3 refined queries: add domain terms you just learned from the high-relevance results ' +
  '(the codebase/domain may name things differently than the original query), drop confirmed-irrelevant directions, ' +
  'open new queries for the gaps. If coverage is already good, return the same queries.\n\nStructured output only.'

const extractPrompt = (source, angleLabel) =>
  '## Context\n' + SYSTEM_PROMPT + '\n\n' +
  '## Task: Extract Claims\n\n' +
  'Research question: "' + QUESTION + '"\n\n' +
  'Source: ' + source.ref + '\nTitle: ' + source.title + '\nFound via: ' + angleLabel + '\n\n' +
  'Fetch/read this source and extract 2-5 FALSIFIABLE claims that bear on the research question.\n' +
  'Each claim must be a concrete, checkable statement with direct evidence (quote or code snippet).\n' +
  'Assess source quality: primary research? secondary reporting? core code? test code? config? blog? forum? unreliable?\n' +
  'If the source is inaccessible or irrelevant, return claims: [] and sourceQuality: "unreliable".\n\nStructured output only.'

const verifyPrompt = (claim, v) =>
  '## Context\n' + SYSTEM_PROMPT + '\n\n' +
  '## Task: Adversarial Claim Verification (voter ' + (v + 1) + '/' + VOTES_PER_CLAIM + ')\n\n' +
  'Be SKEPTICAL. Try to REFUTE this claim. >=' + REFUTATIONS_REQUIRED + '/' + VOTES_PER_CLAIM + ' refutations kill it.\n\n' +
  'Research question: "' + QUESTION + '"\n\n' +
  'Claim: "' + claim.claim + '"\n' +
  'Source: ' + claim.sourceRef + ' (' + claim.sourceQuality + ')\n' +
  'Evidence: "' + claim.evidence + '"\n\n' +
  'Checklist:\n' +
  '1. Is the claim actually supported by the evidence, or is it overreach?\n' +
  '2. Search for contradicting evidence using the tools in Context.\n' +
  '3. Is the source quality sufficient for the claim\'s strength?\n' +
  '4. Is the claim outdated or context-dependent?\n' +
  '5. Is this marketing, speculation, or cherry-picked?\n\n' +
  'refuted=true if: unsupported, contradicted, low-quality source for strong claim, outdated, or fluff.\n' +
  'refuted=false ONLY if: well-supported, current, and source quality matches claim strength.\n' +
  'Default to refuted=true if uncertain.\n\nStructured output only.'

// ─── Iterative search: search → evaluate → refine, up to MAX_ROUNDS per angle ───
const iterativeSearch = async (angle) => {
  const all = []
  const seenRefs = new Set()
  let queries = [angle.query]

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const found = await agent(searchPrompt(angle, queries, round), {
      label: 'search:' + angle.label + (MAX_ROUNDS > 1 ? ':r' + (round + 1) : ''),
      phase: 'Search', schema: SEARCH_SCHEMA,
    })
    if (!found) break

    // Accumulate, de-duping within this angle by ref
    for (const r of found.results) {
      if (seenRefs.has(r.ref)) continue
      seenRefs.add(r.ref)
      all.push(r)
    }

    // No more rounds, or last round → stop without evaluating
    if (MAX_ROUNDS <= 1 || round === MAX_ROUNDS - 1) break

    // Evaluate coverage; converge or refine
    const evaluation = await agent(evaluatePrompt(angle, all), {
      label: 'eval:' + angle.label + ':r' + (round + 1),
      phase: 'Search', schema: EVALUATE_SCHEMA,
    })
    if (!evaluation) break

    if (evaluation.highRelevance >= CONVERGE_HIGH_RELEVANCE) {
      log(angle.label + ': converged at round ' + (round + 1) + ' (' + evaluation.highRelevance + ' high-relevance)')
      break
    }

    const refined = (evaluation.refinedQueries || []).filter(Boolean)
    if (refined.length === 0) break
    queries = refined
    log(angle.label + ': r' + (round + 1) + ' → refining: ' + queries.join(' / '))
  }

  return { angle: angle.label, results: all }
}

// ─── Phase 0: Scope ───
phase('Scope')

let angles
if (PRE_ANGLES) {
  angles = PRE_ANGLES
  log('Using ' + angles.length + ' pre-set angles: ' + angles.map(a => a.label).join(', '))
} else {
  const scope = await agent(scopePrompt(), { label: 'scope', schema: SCOPE_SCHEMA })
  if (!scope) {
    return { error: 'Scope agent returned no result.' }
  }
  angles = scope.angles
  log('Decomposed into ' + angles.length + ' angles: ' + angles.map(a => a.label).join(', '))
}

log('type=' + TYPE + ' depth=' + DEPTH + ' iterate=' + MAX_ROUNDS)

// ─── Shallow path: Search → Synthesize (no extract, no verify) ───
if (!IS_DEEP) {
  phase('Search')
  const searchResults = await parallel(
    angles.map(angle => () =>
      iterativeSearch(angle).then(r => {
        log(angle.label + ': ' + r.results.length + ' results')
        return r
      })
    )
  )

  const allResults = searchResults.filter(Boolean)
  const totalCount = allResults.reduce((sum, r) => sum + r.results.length, 0)
  log('Shallow search done: ' + totalCount + ' results from ' + allResults.length + ' angles')

  if (totalCount === 0) {
    return {
      question: QUESTION, depth: DEPTH, type: TYPE,
      summary: 'No results found across ' + angles.length + ' angles.',
      findings: [], sources: [],
    }
  }

  phase('Synthesize')
  const resultBlock = allResults.map(r =>
    '### ' + r.angle + '\n' +
    r.results.map((s, i) => (i + 1) + '. **' + s.title + '** [' + s.ref + ']\n   ' + (s.snippet || '')).join('\n')
  ).join('\n\n')

  const report = await agent(
    '## Context\n' + SYSTEM_PROMPT + '\n\n' +
    '## Task: Synthesize Research Results\n\n' +
    'Question: "' + QUESTION + '"\n' +
    totalCount + ' results from ' + allResults.length + ' search angles (shallow mode, no verification).\n\n' +
    '## Results\n' + resultBlock + '\n\n' +
    'Instructions:\n' +
    '1. Group related results into coherent findings.\n' +
    '2. Write a 2-4 sentence summary answering the research question.\n' +
    '3. Note caveats: shallow mode means results are NOT adversarially verified.\n' +
    '4. List 2-3 open questions.\n\nStructured output only.',
    { label: 'synthesize', schema: REPORT_SCHEMA }
  )

  return {
    question: QUESTION, depth: DEPTH, type: TYPE,
    ...(report || { summary: 'Synthesis skipped.', findings: [], caveats: 'Shallow mode, unverified.' }),
    sources: allResults.flatMap(r => r.results.map(s => ({ ref: s.ref, title: s.title, angle: r.angle }))),
    stats: { angles: angles.length, results: totalCount, iterate: MAX_ROUNDS, verified: false },
  }
}

// ─── Deep path: Search → Extract → Verify → Synthesize ───

// Dedup state
const normRef = r => {
  try {
    const u = new URL(r)
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '')).toLowerCase()
  } catch {
    return r.toLowerCase().replace(/:\d+$/, '')
  }
}
const seen = new Map()
const dupes = []
const budgetDropped = []
const relRank = { high: 0, medium: 1, low: 2 }
let fetchSlots = MAX_SOURCES

// Pipeline: iterative-search → dedup → extract (no barrier between angles)
const searchResults = await pipeline(
  angles,

  // Stage 1: Iterative search
  angle => iterativeSearch(angle).then(r => {
    log(angle.label + ': ' + r.results.length + ' results')
    return r
  }),

  // Stage 2: Dedup + Extract
  (searchResult) => {
    const sorted = [...searchResult.results].sort((a, b) => relRank[a.relevance] - relRank[b.relevance])
    const novel = sorted.filter(r => {
      const key = normRef(r.ref)
      if (seen.has(key)) {
        dupes.push({ ...r, angle: searchResult.angle, dupOf: seen.get(key) })
        return false
      }
      if (fetchSlots <= 0 && relRank[r.relevance] >= 1) {
        budgetDropped.push({ ...r, angle: searchResult.angle })
        return false
      }
      seen.set(key, { angle: searchResult.angle, title: r.title })
      fetchSlots--
      return true
    })
    if (novel.length < searchResult.results.length) {
      log(searchResult.angle + ': ' + novel.length + ' novel (' + (searchResult.results.length - novel.length) + ' filtered)')
    }
    return parallel(
      novel.map(source => () => {
        const shortRef = source.ref.length > 40 ? source.ref.slice(0, 37) + '...' : source.ref
        return agent(extractPrompt(source, searchResult.angle), {
          label: 'extract:' + shortRef,
          phase: 'Extract',
          schema: EXTRACT_SCHEMA,
        }).then(ext => {
          if (!ext) return null
          return {
            ref: source.ref, title: source.title, angle: searchResult.angle,
            sourceQuality: ext.sourceQuality,
            claims: ext.claims.map(c => ({ ...c, sourceRef: source.ref, sourceQuality: ext.sourceQuality })),
          }
        }).catch(e => {
          log('extract failed: ' + source.ref + ' — ' + (e.message || e))
          return { ref: source.ref, title: source.title, angle: searchResult.angle, sourceQuality: 'unreliable', claims: [] }
        })
      })
    )
  }
)

const allSources = searchResults.flat().filter(Boolean)
const allClaims = allSources.flatMap(s => s.claims)
const impRank = { central: 0, supporting: 1, tangential: 2 }
const qualRank = { primary: 0, secondary: 1, 'code-core': 0, 'code-test': 2, 'code-config': 2, blog: 3, forum: 3, unreliable: 4 }

const rankedClaims = [...allClaims]
  .sort((a, b) => (impRank[a.importance] - impRank[b.importance]) || (qualRank[a.sourceQuality] - qualRank[b.sourceQuality]))
  .slice(0, MAX_VERIFY_CLAIMS)

log('Extracted ' + allClaims.length + ' claims from ' + allSources.length + ' sources → verifying top ' + rankedClaims.length)

if (rankedClaims.length === 0) {
  return {
    question: QUESTION, depth: DEPTH, type: TYPE,
    summary: 'No claims extracted. ' + allSources.length + ' sources fetched, all empty/failed.',
    findings: [], sources: allSources.map(s => ({ ref: s.ref, quality: s.sourceQuality })),
    stats: { angles: angles.length, sources: allSources.length, claims: 0, iterate: MAX_ROUNDS, dupes: dupes.length },
  }
}

// ─── Verify: 3-vote adversarial ───
phase('Verify')
const voted = (await parallel(
  rankedClaims.map(claim => () =>
    parallel(
      Array.from({ length: VOTES_PER_CLAIM }, (_, v) => () =>
        agent(verifyPrompt(claim, v), {
          label: 'v' + v + ':' + claim.claim.slice(0, 35),
          phase: 'Verify',
          schema: VERDICT_SCHEMA,
        })
      )
    ).then(verdicts => {
      const valid = verdicts.filter(Boolean)
      const refuted = valid.filter(v => v.refuted).length
      const abstained = VOTES_PER_CLAIM - valid.length
      const survives = valid.length >= REFUTATIONS_REQUIRED && refuted < REFUTATIONS_REQUIRED
      log('"' + claim.claim.slice(0, 50) + '": ' + (valid.length - refuted) + '-' + refuted + (abstained > 0 ? ' (' + abstained + ' abstain)' : '') + ' ' + (survives ? '✓' : '✗'))
      return { ...claim, verdicts: valid, refutedVotes: refuted, survives }
    })
  )
)).filter(Boolean)

const confirmed = voted.filter(c => c.survives)
const killed = voted.filter(c => !c.survives)
log('Verify done: ' + confirmed.length + ' confirmed, ' + killed.length + ' killed')

if (confirmed.length === 0) {
  return {
    question: QUESTION, depth: DEPTH, type: TYPE,
    summary: 'All ' + voted.length + ' claims refuted. Sources may be low-quality or claims overstated.',
    findings: [],
    refuted: killed.map(c => ({ claim: c.claim, vote: (c.verdicts.length - c.refutedVotes) + '-' + c.refutedVotes, source: c.sourceRef })),
    sources: allSources.map(s => ({ ref: s.ref, quality: s.sourceQuality })),
    stats: { angles: angles.length, sources: allSources.length, claims: allClaims.length, iterate: MAX_ROUNDS, verified: voted.length, confirmed: 0, killed: killed.length },
  }
}

// ─── Synthesize ───
phase('Synthesize')
const confRank = { high: 0, medium: 1, low: 2 }
const block = confirmed.map((c, i) => {
  const best = c.verdicts.filter(v => !v.refuted).sort((a, b) => confRank[a.confidence] - confRank[b.confidence])[0]
  return '### [' + i + '] ' + c.claim + '\n' +
    'Vote: ' + (c.verdicts.length - c.refutedVotes) + '-' + c.refutedVotes + ' · Source: ' + c.sourceRef + ' (' + c.sourceQuality + ')\n' +
    'Evidence: "' + c.evidence + '"\n' +
    (best ? 'Verifier (' + best.confidence + '): ' + best.evidence + '\n' : '')
}).join('\n')

const killedBlock = killed.length > 0
  ? '\n## Refuted claims (transparency)\n' +
    killed.map(c => '- "' + c.claim + '" (' + c.sourceRef + ', vote ' + (c.verdicts.length - c.refutedVotes) + '-' + c.refutedVotes + ')').join('\n')
  : ''

const report = await agent(
  '## Context\n' + SYSTEM_PROMPT + '\n\n' +
  '## Task: Synthesize Research Report\n\n' +
  'Question: "' + QUESTION + '"\n\n' +
  confirmed.length + ' claims survived ' + VOTES_PER_CLAIM + '-vote adversarial verification.\n\n' +
  '## Confirmed claims\n' + block + '\n' + killedBlock + '\n\n' +
  'Instructions:\n' +
  '1. Merge claims that say the same thing — combine sources.\n' +
  '2. Group into coherent findings. Each should address the research question.\n' +
  '3. Confidence: high (multiple primary sources, unanimous), medium (secondary or split), low (single source or blog).\n' +
  '4. Write a 3-5 sentence summary answering the research question.\n' +
  '5. Note caveats and 2-4 open questions.\n\nStructured output only.',
  { label: 'synthesize', schema: REPORT_SCHEMA }
)

if (!report) {
  return {
    question: QUESTION, depth: DEPTH, type: TYPE,
    summary: 'Synthesis skipped — returning ' + confirmed.length + ' verified claims unmerged.',
    confirmed: confirmed.map(c => ({ claim: c.claim, source: c.sourceRef, evidence: c.evidence, vote: (c.verdicts.length - c.refutedVotes) + '-' + c.refutedVotes })),
    refuted: killed.map(c => ({ claim: c.claim, source: c.sourceRef, vote: (c.verdicts.length - c.refutedVotes) + '-' + c.refutedVotes })),
    sources: allSources.map(s => ({ ref: s.ref, quality: s.sourceQuality })),
    stats: { angles: angles.length, sources: allSources.length, claims: allClaims.length, iterate: MAX_ROUNDS, verified: voted.length, confirmed: confirmed.length, killed: killed.length },
  }
}

return {
  question: QUESTION, depth: DEPTH, type: TYPE,
  ...report,
  refuted: killed.map(c => ({ claim: c.claim, vote: (c.verdicts.length - c.refutedVotes) + '-' + c.refutedVotes, source: c.sourceRef })),
  sources: allSources.map(s => ({ ref: s.ref, quality: s.sourceQuality, angle: s.angle, claimCount: s.claims.length })),
  stats: {
    angles: angles.length,
    iterate: MAX_ROUNDS,
    sourcesFetched: allSources.length,
    claimsExtracted: allClaims.length,
    claimsVerified: voted.length,
    confirmed: confirmed.length,
    killed: killed.length,
    afterSynthesis: report.findings.length,
    urlDupes: dupes.length,
    budgetDropped: budgetDropped.length,
  },
}
