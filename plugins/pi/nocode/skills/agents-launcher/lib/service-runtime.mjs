import { waitHealthy } from './proc.mjs';
import { createGenerationSupervisor } from './supervisor.mjs';
import { propagationClosure } from './topology.mjs';

export class ServiceRuntime {
  constructor({
    plan,
    adapters,
    supervision,
    supervisorFactory,
    now = Date.now,
    waitHealthyFn = waitHealthy,
    readiness = { tries: 120, intervalMs: 1000 },
    log = () => {},
  } = {}) {
    this.plan = plan;
    this.adapters = adapters;
    this.supervision = supervision;
    this.supervisorFactory = supervisorFactory ?? createGenerationSupervisor;
    this.supervisor = null;
    this.waitHealthyFn = waitHealthyFn;
    this.readiness = readiness;
    this.log = log;
    this.handlesByService = new Map();
    this.auxiliaryHandles = new Set();
    this.pendingGenerationEvents = new Map();
    this.settledEventsByUpstream = new Map();
    this.cascadePromise = null;
    this.operationTail = Promise.resolve();
    this.closePromise = null;
    this.now = now;
    this.phase = 'idle';
  }

  context(serviceId) {
    return { serviceId, plan: this.plan, runtime: this };
  }

  attachHandleNudge(serviceId, handle) {
    const isPropagationSource = this.plan.propagationEdges.some(
      ({ upstream }) => upstream === serviceId,
    );
    if (!isPropagationSource || typeof handle?.once !== 'function') return;
    let nudged = false;
    const nudge = () => {
      if (nudged) return;
      nudged = true;
      Promise.resolve()
        .then(() => this.supervisor?.tick())
        .catch((error) => {
          this.log('state.nudge_failed', { serviceId, message: error.message });
        });
    };
    handle.once('exit', nudge);
    handle.once('close', nudge);
  }

  registerHandles(serviceId, handles = []) {
    const existing = this.handlesByService.get(serviceId) ?? new Set();
    for (const handle of handles) {
      if (existing.has(handle)) continue;
      existing.add(handle);
      this.attachHandleNudge(serviceId, handle);
    }
    this.handlesByService.set(serviceId, existing);
  }

  registerAuxiliaryHandle(handle) {
    if (handle) this.auxiliaryHandles.add(handle);
  }

  async launchOne(serviceId) {
    const adapter = this.adapters[serviceId];
    const result = await adapter.start(this.context(serviceId));
    this.registerHandles(serviceId, result?.handles ?? []);
  }

  async waitOne(serviceId) {
    const adapter = this.adapters[serviceId];
    if (adapter.lifecycle === 'oneshot') return;
    await this.waitHealthyFn(
      serviceId,
      async () => (await adapter.status(this.context(serviceId))).healthy,
      this.readiness,
    );
  }

  async startOne(serviceId) {
    await this.launchOne(serviceId);
    await this.waitOne(serviceId);
  }

  async stopOne(serviceId, { downDocker = false } = {}) {
    const handles = this.handlesByService.get(serviceId) ?? new Set();
    for (const handle of handles) {
      try {
        handle.kill('SIGTERM');
      } catch (error) {
        this.log('handle.stop_failed', { serviceId, message: error.message });
      }
    }
    this.handlesByService.delete(serviceId);
    await this.adapters[serviceId].stop({
      ...this.context(serviceId),
      downDocker,
    });
  }

  async stopServices(serviceIds, {
    downDocker = false,
    bestEffort = false,
  } = {}) {
    let firstError = null;
    for (const serviceId of serviceIds) {
      try {
        await this.stopOne(serviceId, { downDocker });
      } catch (error) {
        firstError ??= error;
        this.log('service.stop_failed', { serviceId, message: error.message });
        if (!bestEffort) throw error;
      }
    }
    return firstError;
  }

  async stopSelected({ includeDocker = false } = {}) {
    return this.stopServices(this.plan.stopOrder, {
      downDocker: includeDocker,
      bestEffort: false,
    });
  }

  runExclusive(operation) {
    const execution = this.operationTail.then(operation, operation);
    this.operationTail = execution.catch(() => {});
    return execution;
  }

  async startSelectedUnlocked() {
    this.phase = 'starting';
    const started = [];
    try {
      await this.stopSelected({ includeDocker: false });
      for (const serviceId of this.plan.startOrder) {
        await this.launchOne(serviceId);
        started.push(serviceId);
        await this.waitOne(serviceId);
      }
      if (this.phase !== 'closing') this.phase = 'running';
    } catch (error) {
      await this.stopServices([...started].reverse(), {
        downDocker: false,
        bestEffort: true,
      });
      if (this.phase !== 'closing') this.phase = 'idle';
      throw error;
    }
  }

  startSelected() {
    return this.runExclusive(() => this.startSelectedUnlocked());
  }

  async startSupervisor() {
    if (this.supervisor) return this.supervisor;
    const serviceIds = [...new Set(
      this.plan.propagationEdges.map(({ upstream }) => upstream),
    )];
    if (serviceIds.length === 0) return null;
    this.supervisor = this.supervisorFactory({
      serviceIds,
      adapters: this.adapters,
      supervision: this.supervision,
      onGenerationChanged: (event) => this.requestCascade(event),
      log: this.log,
    });
    await this.supervisor.seed();
    this.supervisor.start();
    return this.supervisor;
  }

  requestCascade(event) {
    if (this.phase === 'closing' || this.phase === 'closed') {
      return Promise.resolve();
    }
    const settled = this.settledEventsByUpstream.get(event.serviceId);
    const pending = this.pendingGenerationEvents.get(event.serviceId);
    const newestKnown = Math.max(
      settled?.generation ?? -1,
      pending?.generation ?? -1,
    );
    if (event.generation <= newestKnown) {
      return this.cascadePromise ?? Promise.resolve();
    }
    this.pendingGenerationEvents.set(event.serviceId, event);
    if (!this.cascadePromise) {
      this.startCascadeDrain();
    }
    return this.cascadePromise;
  }

  startCascadeDrain() {
    let promise;
    promise = this.drainCascades()
      .finally(() => {
        if (this.cascadePromise === promise) {
          this.cascadePromise = null;
        }
        if (this.pendingGenerationEvents.size > 0
            && this.phase !== 'closing'
            && this.phase !== 'closed') {
          return this.startCascadeDrain();
        }
        return undefined;
      });
    this.cascadePromise = promise;
    return promise;
  }

  async drainCascades() {
    while (this.pendingGenerationEvents.size > 0
        && this.phase !== 'closing'
        && this.phase !== 'closed') {
      const [upstream, event] = this.pendingGenerationEvents.entries().next().value;
      this.pendingGenerationEvents.delete(upstream);
      this.settledEventsByUpstream.set(upstream, {
        generation: event.generation,
        status: 'running',
      });
      await this.runExclusive(() => this.runCascade(event));
    }
  }

  async runCascade(event) {
    const startedAt = this.now();
    const targets = propagationClosure(event.serviceId, this.plan);
    const stopOrder = this.plan.stopOrder.filter((id) => targets.has(id));
    const startOrder = this.plan.startOrder.filter((id) => targets.has(id));
    if (targets.size === 0) {
      this.settledEventsByUpstream.set(event.serviceId, {
        generation: event.generation,
        status: 'completed',
      });
      return;
    }

    this.phase = 'cascading';
    this.log('cascade.started', {
      eventId: event.id,
      upstream: event.serviceId,
      generation: event.generation,
      targets: [...targets],
    });
    const restarted = [];
    let stage = 'upstream_check';
    let failedService = event.serviceId;
    try {
      const upstream = await this.adapters[event.serviceId].status(
        this.context(event.serviceId),
      );
      if (!upstream.healthy) {
        throw new Error(`upstream ${event.serviceId} is not healthy`);
      }
      stage = 'stop';
      for (const serviceId of stopOrder) {
        failedService = serviceId;
        await this.stopOne(serviceId);
      }
      stage = 'start';
      for (const serviceId of startOrder) {
        failedService = serviceId;
        await this.launchOne(serviceId);
        restarted.push(serviceId);
        await this.waitOne(serviceId);
      }

      stage = 'baseline';
      for (const serviceId of startOrder) {
        if (!this.supervisor?.getState(serviceId)) continue;
        failedService = serviceId;
        const observation = await this.adapters[serviceId].status(
          this.context(serviceId),
        );
        this.supervisor.acceptBaseline(serviceId, observation);
      }
      this.settledEventsByUpstream.set(event.serviceId, {
        generation: event.generation,
        status: 'completed',
      });
      this.log('cascade.completed', {
        eventId: event.id,
        targets: [...targets],
        durationMs: this.now() - startedAt,
      });
    } catch (error) {
      await this.stopServices([...restarted].reverse(), {
        downDocker: false,
        bestEffort: true,
      });
      this.settledEventsByUpstream.set(event.serviceId, {
        generation: event.generation,
        status: 'failed',
      });
      this.log('cascade.failed', {
        eventId: event.id,
        service: failedService,
        stage,
        error: error.message,
      });
    } finally {
      if (this.phase !== 'closing') this.phase = 'running';
    }
  }

  stopAuxiliaryHandles() {
    for (const handle of this.auxiliaryHandles) {
      try {
        handle.kill('SIGTERM');
      } catch (error) {
        this.log('auxiliary.stop_failed', { message: error.message });
      }
    }
    this.auxiliaryHandles.clear();
  }

  close({ downDocker = false } = {}) {
    if (this.closePromise) return this.closePromise;
    this.phase = 'closing';
    this.pendingGenerationEvents.clear();
    this.closePromise = this.runExclusive(async () => {
      try {
        await this.supervisor?.stop();
      } catch (error) {
        this.log('supervisor.stop_failed', { message: error.message });
      }
      await this.stopServices(this.plan.stopOrder, {
        downDocker,
        bestEffort: true,
      });
      this.stopAuxiliaryHandles();
      this.phase = 'closed';
    });
    return this.closePromise;
  }
}
