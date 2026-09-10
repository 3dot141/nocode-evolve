function topologyError(message) {
  return new Error(`[topology] ${message}`);
}

function dependencyEdges(config, selectedSet = null) {
  const edges = [];
  for (const [downstream, service] of Object.entries(config.services)) {
    if (selectedSet && !selectedSet.has(downstream)) continue;
    for (const [upstream, dependency] of Object.entries(service.depends_on)) {
      if (selectedSet && !selectedSet.has(upstream)) continue;
      edges.push({ upstream, downstream, dependency });
    }
  }
  return edges;
}

function stableTopologicalSort(nodeIds, edges, rankIds = nodeIds) {
  const rank = new Map(rankIds.map((id, index) => [id, index]));
  const outgoing = new Map(nodeIds.map((id) => [id, []]));
  const indegree = new Map(nodeIds.map((id) => [id, 0]));
  for (const { upstream, downstream } of edges) {
    outgoing.get(upstream).push(downstream);
    indegree.set(downstream, indegree.get(downstream) + 1);
  }
  const ready = nodeIds
    .filter((id) => indegree.get(id) === 0)
    .sort((a, b) => rank.get(a) - rank.get(b));
  const result = [];
  while (ready.length > 0) {
    const current = ready.shift();
    result.push(current);
    for (const downstream of outgoing.get(current)) {
      const next = indegree.get(downstream) - 1;
      indegree.set(downstream, next);
      if (next === 0) {
        ready.push(downstream);
        ready.sort((a, b) => rank.get(a) - rank.get(b));
      }
    }
  }
  if (result.length !== nodeIds.length) {
    throw topologyError('dependency cycle detected');
  }
  return result;
}

export function validateTopology(config, { identityAdapterNames = [] } = {}) {
  const serviceIds = Object.keys(config.services);
  const serviceSet = new Set(serviceIds);
  const identityAdapters = new Set(identityAdapterNames);

  for (const [workspaceId, workspaceServices] of Object.entries(config.workspaces)) {
    for (const serviceId of workspaceServices) {
      if (!serviceSet.has(serviceId)) {
        throw topologyError(`workspace "${workspaceId}" 引用未知 service "${serviceId}"`);
      }
    }
  }

  for (const [downstream, service] of Object.entries(config.services)) {
    for (const [upstream, dependency] of Object.entries(service.depends_on)) {
      if (!serviceSet.has(upstream)) {
        throw topologyError(`service "${downstream}" 引用未知 service "${upstream}"`);
      }
      if (upstream === downstream) {
        throw topologyError(`service "${downstream}" 不能依赖自身`);
      }
      const upstreamLifecycle = config.services[upstream].lifecycle;
      const expectedLifecycle = dependency.condition === 'service_healthy'
        ? 'service'
        : 'oneshot';
      if (upstreamLifecycle !== expectedLifecycle) {
        throw topologyError(
          `dependency ${upstream} -> ${downstream} condition ${dependency.condition} 与 lifecycle ${upstreamLifecycle} 不匹配`,
        );
      }
      if (dependency.propagate_restart
          && !identityAdapters.has(config.services[upstream].adapter)) {
        throw topologyError(`传播源 "${upstream}" 的 adapter 不支持 identity`);
      }
    }
  }

  stableTopologicalSort(serviceIds, dependencyEdges(config), serviceIds);
  return config;
}

export function topologyCatalog(config) {
  return Object.freeze({
    workspaceIds: Object.freeze(Object.keys(config.workspaces)),
    serviceIds: Object.freeze(Object.keys(config.services)),
  });
}

export function buildServicePlan(config, { workspace, disabled = [] } = {}) {
  const declared = config.workspaces[workspace];
  if (!declared) {
    throw topologyError(`未知 workspace "${workspace}"`);
  }
  const disabledSet = new Set(disabled);
  const selected = declared.filter((serviceId) => !disabledSet.has(serviceId));
  const selectedSet = new Set(selected);
  const retainedEdges = [];
  const omittedOptionalDependencies = [];

  for (const downstream of selected) {
    for (const [upstream, dependency] of Object.entries(config.services[downstream].depends_on)) {
      if (selectedSet.has(upstream)) {
        retainedEdges.push({ upstream, downstream, dependency });
      } else if (dependency.required) {
        throw topologyError(
          `service "${downstream}" 缺少 required dependency "${upstream}"`,
        );
      } else {
        omittedOptionalDependencies.push({ service: downstream, dependency: upstream });
      }
    }
  }

  const startOrder = stableTopologicalSort(selected, retainedEdges, declared);
  const propagationEdges = retainedEdges
    .filter(({ dependency }) => dependency.propagate_restart)
    .map(({ upstream, downstream }) => ({ upstream, downstream }));
  return Object.freeze({
    workspace,
    selected: Object.freeze([...selected]),
    omittedOptionalDependencies: Object.freeze(omittedOptionalDependencies),
    startOrder: Object.freeze(startOrder),
    stopOrder: Object.freeze([...startOrder].reverse()),
    propagationEdges: Object.freeze(propagationEdges),
  });
}

export function propagationClosure(upstream, plan) {
  const outgoing = new Map();
  for (const edge of plan.propagationEdges) {
    if (!outgoing.has(edge.upstream)) outgoing.set(edge.upstream, []);
    outgoing.get(edge.upstream).push(edge.downstream);
  }
  const reached = new Set();
  const pending = [...(outgoing.get(upstream) ?? [])];
  while (pending.length > 0) {
    const serviceId = pending.shift();
    if (reached.has(serviceId)) continue;
    reached.add(serviceId);
    pending.push(...(outgoing.get(serviceId) ?? []));
  }
  return new Set(plan.startOrder.filter((serviceId) => reached.has(serviceId)));
}
