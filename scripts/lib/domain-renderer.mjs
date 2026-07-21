/**
 * Compile-time helpers for the lightweight capability bootstrap.
 *
 * Capability() remains a semantic marker in business Skills.  It is never
 * rewritten into a private skill or a runtime command: using-nocode reads the
 * domain reference and the platform's normal approval boundary owns effects.
 */
export class DomainRouteError extends Error {
  constructor(code, message, { capability = 'unknown' } = {}) {
    super(`${code}: ${message}`);
    this.name = 'DomainRouteError';
    this.code = code;
    this.capability = capability;
  }
}

function fail(code, message, options) { throw new DomainRouteError(code, message, options); }

function schemaSummary(schema) {
  if (typeof schema === 'string') return schema;
  if (!schema || typeof schema !== 'object') return 'unspecified';
  const required = Array.isArray(schema.required) && schema.required.length ? `; required: ${schema.required.join(', ')}` : '';
  const properties = Object.keys(schema.properties || {});
  return `${schema.type || 'object'}${properties.length ? `; fields: ${properties.join(', ')}` : ''}${required}`;
}

function contract(registry, reference) {
  if (reference && typeof reference === 'object') return reference;
  for (const item of registry.contracts.values()) if (item.file === reference || item.id === reference || item.$id === reference) return item;
  return reference;
}

function providerLabel(route) {
  const primary = route.primary || (route.primaryFromInput
    ? `${route.primaryFromInput} (${(route.allowedProviders || []).join(', ')})`
    : (route.allowedProviders || []).join(', '));
  const fallback = route.fallback ? `; manual fallback: ${route.fallback}` : '';
  return `${primary || 'platform-native tool'}${fallback}`;
}

/** Render exactly one reader-facing reference for each declared domain. */
export function renderDomainReferences({ registry, resolution, platform }) {
  if (resolution.platform !== platform) fail('REFERENCE_PLATFORM_MISMATCH', 'resolution platform mismatch');
  const files = new Map();
  for (const domain of [...registry.domains.keys()].sort()) {
    const entries = [...registry.capabilities.values()]
      .filter((capability) => capability.domain === domain && capability.internal !== true
        && resolution.domains[domain]?.[capability.id])
      .sort((a, b) => a.id.localeCompare(b.id));
    const lines = [
      `# ${domain} capability reference`,
      '',
      `This reference maps ${domain} semantic capabilities to ${platform}'s native providers. Use the native tool named below; request the platform's normal approval before effects. If the primary provider is unavailable, explain the situation and offer the listed fallback—do not retry automatically.`,
    ];
    const providerIds = new Set();
    for (const capability of entries) {
      const route = resolution.domains[domain][capability.id];
      for (const provider of [route.primary, route.fallback, ...(route.allowedProviders || [])].filter(Boolean)) {
        providerIds.add(provider);
      }
    }
    if (providerIds.size) lines.push('', '## Provider guidance');
    for (const providerId of [...providerIds].sort()) {
      const provider = registry.providers.get(providerId);
      lines.push('', `### ${providerId}`, '', provider?.guidance || `Use the ${providerId} provider through the current platform's native interface.`);
    }
    if (entries.length) lines.push('', '## Capabilities');
    for (const capability of entries) {
      const route = resolution.domains[domain][capability.id];
      lines.push('', `## ${capability.id}`, '', `- Provider: ${providerLabel(route)}`, `- Input: ${schemaSummary(contract(registry, capability.inputSchema))}`, `- Output: ${schemaSummary(contract(registry, capability.outputSchema))}`);
      if (route.fallback) lines.push(`- Fallback: ${route.fallback} (ask before using it)`);
    }
    files.set(`skills/using-nocode/references/${domain}.md`, Buffer.from(`${lines.join('\n')}\n`));
  }
  return files;
}
