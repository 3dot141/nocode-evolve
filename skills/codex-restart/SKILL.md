---
name: codex-restart
description: Use when the user asks to bootstrap or inspect the managed Codex app-server daemon, enable or pair Remote Control, or fully restart Codex after a plugin or CLI update. Codex only; never use for Claude restart or Claude configuration.
---

# Codex Restart

Manage the Codex daemon and Remote Control through supported CLI commands. Treat a full restart as a disconnecting operation: inspect first, ask immediately before restart, and never touch Claude.

## Step 0: Create the workflow plan

For a state-changing request, call `update_plan` and create these tasks at once:

1. Inspect daemon, installation, Remote Control, and plugin state.
2. Configure bootstrap or Remote Control only when required.
3. Prepare the requested restart and obtain explicit confirmation.
4. Restart Codex through the supported lifecycle command.
5. Verify from the reconnected or new Codex session.

Each task must retain its gate below. For a read-only explanation or status question, perform only Step 1 and report; do not create an action plan.

## Step 1: Inspect without changing state

**Enter Gate:**

- [ ] The target is Codex, not Claude.
- [ ] No restart or configuration command has run.

Run:

```bash
codex --version
codex doctor --json
codex app-server daemon version
codex plugin list
```

Interpret the results:

- `app_server.status.details.mode == "persistent"` means durable daemon bootstrap is installed.
- `daemon version` succeeding with `"status":"running"` means the managed app-server is alive.
- `Connection refused` means the socket is not serving; it does not by itself prove bootstrap was never installed.
- Read `app_server.status.details.settings` or `${CODEX_HOME:-$HOME/.codex}/app-server-daemon/settings.json` to inspect `remoteControlEnabled`. Do not expose credential files or tokens.
- Record the expected plugin version and active path before restart.

**Exit Gate:**

- [ ] Bootstrap state is classified as persistent, absent, or unresolved.
- [ ] Daemon running state and Remote Control setting are recorded separately.
- [ ] Expected plugin version/path is recorded when plugin reload is the reason for restart.

## Step 2: Configure only the missing capability

**Enter Gate:**

- [ ] Step 1 Exit Gate passed.
- [ ] The user requested setup, or inspection proved a requested capability is missing.

Use this decision tree:

```text
Managed daemon mode is persistent?
  ├─ no  → first-time setup:
  │        codex app-server daemon bootstrap --remote-control
  └─ yes → Remote Control enabled?
           ├─ no  → codex app-server daemon enable-remote-control
           └─ yes → no configuration change
```

Pairing is separate from enabling Remote Control. Create a short-lived pairing code only when the user requests a new pairing:

```bash
codex remote-control pair
```

Do not expose app-server directly on a public interface. For SSH hosts, use normal authenticated SSH configuration rather than a public app-server listener.

**Exit Gate:**

- [ ] Durable bootstrap exists if requested.
- [ ] `remoteControlEnabled` is true if requested.
- [ ] Pairing was performed only when requested.

## Step 3: Prepare and confirm the restart

**Enter Gate:**

- [ ] Step 1 passed, and Step 2 passed or was unnecessary.
- [ ] The exact restart scope is known.

Explain that restarting the managed daemon disconnects remote sessions, and fully quitting Codex App ends the current App session. Tell the user to save or finish active work.

Immediately before any disconnecting action, ask one explicit question:

> Codex work is saved. Shall I restart the managed app-server daemon and fully restart Codex App now? This will disconnect the current session; Claude will not be touched.

Do not interpret an earlier general request as confirmation at this gate. Wait for an explicit yes.

**Exit Gate:**

- [ ] The user explicitly confirmed after seeing the disconnect warning.

## Step 4: Restart Codex

**Enter Gate:**

- [ ] Step 3 Exit Gate passed.

For daemon-only or headless use:

```bash
codex app-server daemon restart
```

For a complete plugin reload on macOS:

1. Fully quit Codex App with `Command-Q`.
2. From a separate local terminal, run:

   ```bash
   codex app-server daemon restart
   open -a Codex
   ```

3. Open a new Codex session after the App relaunches.

If the current agent is running inside the App or through this daemon, give the external-terminal instructions rather than claiming it can quit its own host and continue. Do not use raw `kill` or `pkill`, and do not stop or restart Claude.

**Exit Gate:**

- [ ] The supported daemon restart command was used.
- [ ] Codex App was fully relaunched when plugin registry, Skills, or Hooks needed reloading.
- [ ] Claude was untouched.

## Step 5: Verify after reconnection

**Enter Gate:**

- [ ] Step 4 completed and a Codex session is connected again.

Run:

```bash
codex app-server daemon version
codex doctor --json
codex plugin list
```

Verify:

- daemon status is running and CLI/app-server versions are expected;
- Remote Control remains enabled when required;
- the plugin reports the expected version and path;
- the new session exposes the expected Skills and Hooks;
- current errors no longer reference a known old plugin cache version.

Search only an exact old version/path supplied by the update context. Do not broadly scan private session history.

**Exit Gate:**

- [ ] Daemon, Remote Control, and plugin checks pass.
- [ ] Any failure is reported with the exact failing check; do not claim a complete restart without post-reconnect evidence.

## Global Exit Gate

- [ ] Bootstrap and Remote Control were changed only when needed.
- [ ] The user confirmed immediately before restart.
- [ ] The managed daemon and Codex App were restarted to the requested scope.
- [ ] Claude was not changed.
- [ ] Post-reconnect verification passed or remaining failures were reported.
