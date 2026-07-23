---
name: codex-restart
description: "Use when the user asks to inspect, bootstrap, configure, pair, or restart the managed Codex app…"
---

# Codex Restart

Inspect first, explain the actual impact, and require immediate confirmation before a disconnecting action.
The managed daemon is the persistent service, Remote Control is one of its settings, and each
`app-server proxy` is an active connection rather than a separate service.

## Step 0: Create the workflow plan

For a state-changing request, call `update_plan` and create these tasks at once:

1. Inspect daemon, Remote Control, active connections, Codex App, and plugin state.
2. Configure bootstrap, Remote Control, or pairing only when requested and missing.
3. Explain the exact restart scope and obtain immediate confirmation.
4. Submit the supported restart command and end.

For a read-only status or explanation request, perform only Step 1 and report. Do not create a
state-changing plan.

## Step 1: Inspect without changing state

**Enter Gate:**

- [ ] The target is Codex, not Claude.
- [ ] No restart or configuration command has run.

Resolve the directory containing this `SKILL.md`, then set:

```bash
RESTART_HELPER="<this-skill-directory>/scripts/codex-restart.mjs"
```

Run:

```bash
node "$RESTART_HELPER" inspect
```

Interpret the JSON without flattening distinct concepts:

- `daemon.mode` classifies durable bootstrap; `persistent` means it is installed.
- `daemon.status` and `daemon.pid` describe the managed app-server process.
- `remoteControl.enabled` is a daemon setting, not another daemon.
- `connections.proxyCount` counts active proxy connections that a restart can disconnect.
- `app.status` is best effort; `unknown` is not the same as stopped.
- `plugin` reports the installed nocode version and path when present.
- `errors[]` means the corresponding field is incomplete; never turn unknown into a confident false.

The helper outputs only an allowlisted status schema. Do not print settings files, credentials, tokens,
or unrelated doctor output.

**Exit Gate:**

- [ ] Bootstrap and daemon state are classified separately.
- [ ] Remote Control and proxy count are reported separately.
- [ ] Unknown fields and errors are stated without guessing.

## Step 2: Configure only the requested missing capability

**Enter Gate:**

- [ ] Step 1 passed.
- [ ] The user requested setup, or inspection proved a requested capability is missing.

Use this decision tree:

```text
Managed daemon mode is persistent?
  ├─ no  → codex app-server daemon bootstrap --remote-control
  └─ yes → Remote Control enabled?
           ├─ no  → codex app-server daemon enable-remote-control
           └─ yes → no configuration change
```

Pairing is separate from enabling Remote Control. Create a short-lived pairing code only when the
user asks for one:

```bash
codex remote-control pair
```

Do not expose app-server on a public interface. Never read or repeat authentication material.

**Exit Gate:**

- [ ] Durable bootstrap exists if requested.
- [ ] Remote Control is enabled if requested.
- [ ] Pairing ran only when requested.

## Step 3: Explain scope and confirm immediately

**Enter Gate:**

- [ ] Step 1 passed, and Step 2 passed or was unnecessary.
- [ ] The requested scope is daemon-only or full Codex App reload.

### Daemon-only

Use the inspected values to explain:

- the managed daemon will restart;
- the reported number of active proxy connections can disconnect;
- Remote Control clients can lose their current connection;
- Codex App will not be quit or reopened;
- this does not claim a complete plugin, Skill, or Hook reload.

Tell the user to save active work. Immediately before submission, ask one explicit yes/no question
that includes the actual `proxyCount`. An earlier general request to restart is not confirmation.

### Full Codex App reload

Explain that complete plugin registry, Skill, or Hook reload requires saving work, fully quitting Codex
App, restarting the daemon from an independent Terminal, reopening the App, and starting a new Session.
Do not route this scope through the daemon-only success message.

**Exit Gate:**

- [ ] The user explicitly confirmed after seeing the scope and current impact.

## Step 4: Submit daemon restart and end

**Enter Gate:**

- [ ] Step 3 confirmed daemon-only restart.

Run:

```bash
node "$RESTART_HELPER" restart --confirmed
```

The helper submits only:

```text
codex app-server daemon restart
```

through an argv array with no shell, waits only until the detached child is spawned, then returns a
`status: "scheduled"` receipt. The receipt means the command was submitted; it does not mean the daemon
has already restarted successfully.

When the receipt is scheduled, reply only with:

> Restart command submitted.

Then end. Do not wait, poll, reconnect, verify, inspect again, or discuss whether the current connection
will be interrupted. A later user request for status starts a new Step 1 inspection.

If submission fails before spawn, report that the restart command was not submitted. Do not claim
scheduled and do not fall back to `kill`, `pkill`, or direct proxy termination.

**Exit Gate:**

- [ ] The official daemon restart command was submitted, or pre-spawn failure was reported.
- [ ] No post-submission action ran.

## Full App reload instructions

For a confirmed full reload on macOS, the user performs this outside the current Codex App session:

1. Save work and fully quit Codex App with `Command-Q`.
2. In an independent local Terminal, run:

   ```bash
   codex app-server daemon restart
   open -a Codex
   ```

3. Start a new Codex Session after the App opens.

Do not claim the current agent can quit its own host and continue. Never stop or restart Claude.

## Global Exit Gate

- [ ] Bootstrap, Remote Control, and pairing changed only when requested.
- [ ] Disconnecting actions had an immediate explicit confirmation.
- [ ] Daemon-only and full App reload claims stayed distinct.
- [ ] No credential, raw kill, direct proxy termination, or Claude operation occurred.
