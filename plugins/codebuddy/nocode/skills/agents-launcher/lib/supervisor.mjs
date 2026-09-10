export function createGenerationState() {
  return {
    phase: 'unobserved',
    stableIdentity: null,
    candidateIdentity: null,
    candidateSuccesses: 0,
    consecutiveFailures: 0,
    generation: 0,
  };
}

function recordCandidate(state, identity) {
  if (state.candidateIdentity === identity) {
    state.candidateSuccesses += 1;
  } else {
    state.candidateIdentity = identity;
    state.candidateSuccesses = 1;
  }
}

function clearCandidate(state) {
  state.candidateIdentity = null;
  state.candidateSuccesses = 0;
}

export function observeGeneration(state, observation, {
  serviceId,
  stableSuccesses,
  failureThreshold,
}) {
  const next = { ...state };

  if (!observation.healthy) {
    next.consecutiveFailures += 1;
    clearCandidate(next);
    if (next.stableIdentity !== null
        && next.consecutiveFailures >= failureThreshold) {
      next.phase = 'degraded';
    }
    return { state: next, event: null, warning: null };
  }

  if (observation.identity === null || observation.identity === undefined
      || String(observation.identity).length === 0) {
    next.consecutiveFailures = 0;
    clearCandidate(next);
    return { state: next, event: null, warning: 'identity_missing' };
  }

  const identity = String(observation.identity);
  next.consecutiveFailures = 0;

  if (next.stableIdentity === null) {
    recordCandidate(next, identity);
    if (next.candidateSuccesses >= stableSuccesses) {
      next.stableIdentity = identity;
      next.phase = 'healthy';
      clearCandidate(next);
    }
    return { state: next, event: null, warning: null };
  }

  if (identity === next.stableIdentity) {
    if (next.phase === 'degraded') {
      recordCandidate(next, identity);
      if (next.candidateSuccesses >= stableSuccesses) {
        next.phase = 'healthy';
        clearCandidate(next);
      }
    } else {
      next.phase = 'healthy';
      clearCandidate(next);
    }
    return { state: next, event: null, warning: null };
  }

  recordCandidate(next, identity);
  if (next.candidateSuccesses < stableSuccesses) {
    return { state: next, event: null, warning: null };
  }

  const previousIdentity = next.stableIdentity;
  next.stableIdentity = identity;
  next.phase = 'healthy';
  next.generation += 1;
  clearCandidate(next);
  return {
    state: next,
    warning: null,
    event: {
      id: `${serviceId}:g${next.generation}`,
      serviceId,
      generation: next.generation,
      previousIdentity,
      identity,
    },
  };
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createGenerationSupervisor({
  serviceIds,
  adapters,
  supervision,
  onGenerationChanged = () => {},
  log = () => {},
  sleep = defaultSleep,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  const states = new Map(
    serviceIds.map((serviceId) => [serviceId, createGenerationState()]),
  );
  const policy = {
    stableSuccesses: supervision.stable_successes,
    failureThreshold: supervision.failure_threshold,
  };
  let timer = null;
  let tickPromise = null;

  async function tickService(serviceId) {
    let observation;
    try {
      observation = await adapters[serviceId].status({ serviceId });
    } catch (error) {
      log('state.probe_failed', { serviceId, message: error.message });
      observation = { healthy: false, identity: null };
    }
    const before = states.get(serviceId);
    const transition = observeGeneration(before, observation, {
      ...policy,
      serviceId,
    });
    states.set(serviceId, transition.state);
    if (transition.warning) {
      log('state.warning', { serviceId, warning: transition.warning });
    }
    if (before.phase !== transition.state.phase
        || before.stableIdentity !== transition.state.stableIdentity) {
      log('service.state_changed', {
        serviceId,
        previousState: before.phase,
        newState: transition.state.phase,
        identity: transition.state.stableIdentity,
        generation: transition.state.generation,
      });
    }
    if (transition.event) {
      Promise.resolve()
        .then(() => onGenerationChanged(transition.event))
        .catch((error) => {
          log('cascade.callback_failed', {
            serviceId,
            generation: transition.event.generation,
            message: error.message,
          });
        });
    }
  }

  function tick() {
    if (tickPromise) return tickPromise;
    tickPromise = Promise.all(serviceIds.map(tickService))
      .finally(() => { tickPromise = null; });
    return tickPromise;
  }

  async function seed({
    maxAttempts = supervision.stable_successes * 3,
  } = {}) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await tick();
      const complete = serviceIds.every(
        (serviceId) => states.get(serviceId).stableIdentity !== null,
      );
      if (complete) return;
      if (attempt < maxAttempts) await sleep(supervision.interval_ms);
    }
    throw new Error('[supervisor] baseline 建立超时');
  }

  function start() {
    if (timer !== null || serviceIds.length === 0) return;
    timer = setIntervalFn(() => { void tick(); }, supervision.interval_ms);
  }

  async function stop() {
    if (timer !== null) {
      clearIntervalFn(timer);
      timer = null;
    }
    if (tickPromise) await tickPromise;
  }

  function acceptBaseline(serviceId, observation) {
    if (!states.has(serviceId) || !observation.healthy || !observation.identity) return;
    const current = states.get(serviceId);
    states.set(serviceId, {
      ...current,
      phase: 'healthy',
      stableIdentity: String(observation.identity),
      candidateIdentity: null,
      candidateSuccesses: 0,
      consecutiveFailures: 0,
    });
  }

  return Object.freeze({
    tick,
    seed,
    start,
    stop,
    acceptBaseline,
    getState(serviceId) {
      const state = states.get(serviceId);
      return state ? { ...state } : null;
    },
  });
}
