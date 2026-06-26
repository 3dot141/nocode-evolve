export const meta = {
  name: 'research-engine',
  description: 'Generic research engine — multi-angle search, claim extraction, adversarial verification, synthesis. Configurable via systemPrompt for any domain (web, code, mixed).',
  phases: [
    { title: 'Scope', detail: 'Decompose question into search angles (skip if pre-set)' },
    { title: 'Search', detail: 'Parallel search per angle, using tools guided by systemPrompt' },
    { title: 'Extract', detail: 'Deep only: fetch sources, extract falsifiable claims' },
    { title: 'Verify', detail: 'Deep only: 3-vote adversarial verification per claim' },
    { title: 'Synthesize', detail: 'Merge dupes, rank by confidence, cite sources' },
  ],
}

// ─── Args ───
// {
//   question: string           — required, the research question
//   depth: 'shallow' | 'deep'  — default 'deep'
//   systemPrompt: string       — domain context + tool preferences
//   angles: [{label, query, rationale?}]  — optional, skip Scope if provided
// }

const raw = typeof args === 'string' ? { question: args } : (args || {})
const QUESTION = raw.question || ''
if (!QUESTION) {
  return { error: 'No research question. Pass args: { question, depth?, systemPrompt?, angles? }' }
}

const DEPTH = raw.depth || 'deep'
const IS_DEEP = DEPTH === 'deep'
const SYSTEM_PROMPT = raw.systemPrompt || '通用研究模式。网络搜索用 WebSearch，代码搜索用 semble-search agent。按问题领域自选工具。'
const PRE_ANGLES = Array.isArray(raw.angles) && raw.angles.length > 0 ? raw.angles : null

const VOTES_PER_CLAIM = 3
const REFUTATIONS_REQUIRED = 2
const MAX_SOURCES = IS_DEEP ? 15 : 8
const MAX_VERIFY_CLAIMS = 25
const ANGLE_COUNT_SHALLOW = '2-3'
const ANGLE_COUNT_DEEP = '4-6'

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
  'The systemPrompt above tells you which tools are available and what domain you\'re in — pick angles that make sense for that domain.\n' +
  'Make queries specific enough to surface high-signal results. Avoid redundancy.\n\nStructured output only.'

const searchPrompt = (angle) =>
  '## Context\n' + SYSTEM_PROMPT + '\n\n' +
  '## Task: Search\n\n' +
  'Research question: "' + QUESTION + '"\n' +
  'Your angle: **' + angle.label + '**' + (angle.rationale ? ' — ' + angle.rationale : '') + '\n' +
  'Search query: `' + angle.query + '`\n\n' +
  'Use the tools described in the context to search. Return the top 4-6 most relevant results.\n' +
  'For each result, provide a ref (URL for web, file:line for code), title, snippet, and relevance rating.\n' +
  'Skip obvious spam or irrelevant results.\n\nStructured output only.'

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

// ─── Shallow path: Search → Synthesize (no extract, no verify) ───
if (!IS_DEEP) {
  phase('Search')
  const searchResults = await parallel(
    angles.map(angle => () =>
      agent(searchPrompt(angle), {
        label: 'search:' + angle.label, phase: 'Search', schema: SEARCH_SCHEMA,
      }).then(r => {
        if (!r) return null
        log(angle.label + ': ' + r.results.length + ' results')
        return { angle: angle.label, results: r.results }
      })
    )
  )

  const allResults = searchResults.filter(Boolean)
  const totalCount = allResults.reduce((sum, r) => sum + r.results.length, 0)
  log('Shallow search done: ' + totalCount + ' results from ' + allResults.length + ' angles')

  if (totalCount === 0) {
    return {
      question: QUESTION, depth: DEPTH,
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
    question: QUESTION, depth: DEPTH,
    ...(report || { summary: 'Synthesis skipped.', findings: [], caveats: 'Shallow mode, unverified.' }),
    sources: allResults.flatMap(r => r.results.map(s => ({ ref: s.ref, title: s.title, angle: r.angle }))),
    stats: { angles: angles.length, results: totalCount, verified: false },
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

// Pipeline: search → dedup → extract (no barrier between angles)
const searchResults = await pipeline(
  angles,

  // Stage 1: Search
  angle => agent(searchPrompt(angle), {
    label: 'search:' + angle.label, phase: 'Search', schema: SEARCH_SCHEMA,
  }).then(r => {
    if (!r) return null
    log(angle.label + ': ' + r.results.length + ' results')
    return { angle: angle.label, results: r.results }
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
    question: QUESTION, depth: DEPTH,
    summary: 'No claims extracted. ' + allSources.length + ' sources fetched, all empty/failed.',
    findings: [], sources: allSources.map(s => ({ ref: s.ref, quality: s.sourceQuality })),
    stats: { angles: angles.length, sources: allSources.length, claims: 0, dupes: dupes.length },
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
    question: QUESTION, depth: DEPTH,
    summary: 'All ' + voted.length + ' claims refuted. Sources may be low-quality or claims overstated.',
    findings: [],
    refuted: killed.map(c => ({ claim: c.claim, vote: (c.verdicts.length - c.refutedVotes) + '-' + c.refutedVotes, source: c.sourceRef })),
    sources: allSources.map(s => ({ ref: s.ref, quality: s.sourceQuality })),
    stats: { angles: angles.length, sources: allSources.length, claims: allClaims.length, verified: voted.length, confirmed: 0, killed: killed.length },
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
    question: QUESTION, depth: DEPTH,
    summary: 'Synthesis skipped — returning ' + confirmed.length + ' verified claims unmerged.',
    confirmed: confirmed.map(c => ({ claim: c.claim, source: c.sourceRef, evidence: c.evidence, vote: (c.verdicts.length - c.refutedVotes) + '-' + c.refutedVotes })),
    refuted: killed.map(c => ({ claim: c.claim, source: c.sourceRef, vote: (c.verdicts.length - c.refutedVotes) + '-' + c.refutedVotes })),
    sources: allSources.map(s => ({ ref: s.ref, quality: s.sourceQuality })),
    stats: { angles: angles.length, sources: allSources.length, claims: allClaims.length, verified: voted.length, confirmed: confirmed.length, killed: killed.length },
  }
}

return {
  question: QUESTION, depth: DEPTH,
  ...report,
  refuted: killed.map(c => ({ claim: c.claim, vote: (c.verdicts.length - c.refutedVotes) + '-' + c.refutedVotes, source: c.sourceRef })),
  sources: allSources.map(s => ({ ref: s.ref, quality: s.sourceQuality, angle: s.angle, claimCount: s.claims.length })),
  stats: {
    angles: angles.length,
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
