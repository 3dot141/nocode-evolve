---
name: codex-nocode-reload
description: Use when the user asks to update, reinstall, reload, or inspect reload readiness for the nocode plugin in Codex. Codex only; never use for Claude or unrelated plugins.
---

# Codex nocode reload

Reload the Codex `nocode@nocode-market` plugin through one explicit, ordered operation:
remove the installed copy, install the current marketplace snapshot, submit a daemon restart, and end.

## Step 0: Plan

For a reload request, create these tasks:

1. Inspect the daemon, active proxy connections, and installed nocode version.
2. Explain the interruption and partial-failure risk, then obtain one immediate confirmation.
3. Run the reload helper and end.

For a read-only status request, perform only Step 1.

## Step 1: Inspect

Resolve the directory containing this `SKILL.md`, then set:

```bash
RELOAD_HELPER="<this-skill-directory>/scripts/codex-nocode-reload.mjs"
```

Run:

```bash
node "$RELOAD_HELPER" inspect
```

Report:

- installed nocode version and path;
- daemon status and PID;
- whether Remote Control is enabled;
- `connections.proxyCount`, including `unknown` when inspection is incomplete;
- structured `errors[]` without exposing raw settings, credentials, tokens, or command stderr.

Do not change daemon configuration, pairing, Remote Control, Claude, or another plugin.

## Step 2: Warn and confirm

Immediately before reloading, tell the user:

- the installed nocode plugin will be removed and reinstalled from `nocode-market`;
- if installation fails after removal, nocode remains uninstalled and the daemon is not restarted;
- restarting the daemon can interrupt the reported number of active proxy connections.

Ask one explicit yes/no question containing the actual `proxyCount`. Earlier requests do not satisfy
this confirmation.

## Step 3: Reload and end

After confirmation, run:

```bash
node "$RELOAD_HELPER" reload --confirmed
```

The helper performs exactly this order:

```text
codex plugin remove --json nocode@nocode-market
codex plugin add --json nocode@nocode-market
codex app-server daemon restart
```

The first two commands complete before the next command starts. Any failure stops the sequence. The
daemon restart is submitted as a detached argv-based process only after installation succeeds.

When the helper returns `status: "scheduled"`, reply only:

> Reload command submitted.

Then end. Do not wait, poll, reconnect, verify, inspect again, reopen Codex App, or discuss what happens
after submission. A later user request for status starts a new read-only inspection.

If the helper reports an error, state which phase failed without printing raw stderr. Never fall back
to raw cache deletion, `kill`, `pkill`, proxy termination, or Claude operations.

## Global exit

- Reload order was remove → add → detached daemon restart.
- One immediate confirmation covered uninstall risk and connection interruption.
- Failure stopped the remaining sequence.
- Successful submission ended without post-reload actions.
