---
name: open-design
description: "Use by default when the user asks to create, redesign, inspect, export, or manage a visual arti…"
---

# Open Design CLI

Operate Open Design exclusively through its packaged command-line interface. Use the bundled wrapper so macOS `/usr/bin/od` is never mistaken for Open Design.

## Scope

Handle the common lifecycle:

1. Locate the packaged CLI.
2. Connect to or start a headless daemon that serves the Web UI.
3. Discover available recipes when selection matters.
4. Create or select a project.
5. Start and monitor one run or a parallel multi-conversation batch.
6. Verify and retrieve the produced files.
7. Export only when the user requests a binary deliverable.

Do not switch to another integration surface. Do not open the desktop app unless the user explicitly asks for it.

## Step 1: Resolve the wrapper

Resolve the directory containing this `SKILL.md`, then set:

```bash
ODCLI="<this-skill-directory>/scripts/odcli.sh"
OD_URL="${OD_DAEMON_URL:-http://127.0.0.1:7456}"
```

Run a read-only probe:

```bash
"$ODCLI" daemon status --json --daemon-url "$OD_URL"
```

If the wrapper reports a missing packaged installation, tell the user which path was checked. Accept `OPEN_DESIGN_APP_PATH`, `OD_HELPER_BIN`, and `OD_DAEMON_CLI_PATH` overrides instead of inventing another executable.

## Step 2: Ensure the daemon is available

If the status probe succeeds, reuse that daemon. If it fails with a connection error, start the packaged daemon in a long-running shell and serve the Web UI by default:

```bash
"$ODCLI" daemon start --headless --serve-web --port 7456
```

Keep the returned shell/session handle and verify readiness with `daemon status`. Do not assume that starting the CLI completed before the status probe succeeds. Report the Web UI address, normally `http://127.0.0.1:7456`, after the probe passes.

Never stop a daemon that was already running. Leave a daemon started for the task running by default and report that fact; stop it only when the user asks:

```bash
"$ODCLI" daemon stop --daemon-url "$OD_URL"
```

## Step 3: Discover only what the request needs

Before choosing a Skill, design system, or plugin, inspect the live registry:

```bash
"$ODCLI" skills list --json --daemon-url "$OD_URL"
"$ODCLI" design-systems list --json --daemon-url "$OD_URL"
"$ODCLI" plugin list --json --daemon-url "$OD_URL"
"$ODCLI" tools directions --json --daemon-url "$OD_URL"
```

Do not guess an identifier. If a registry is empty, omit that option and continue with the user's brief.

## Step 4: Create or select a project

For a new project, request JSON and capture the returned identifiers:

```bash
PROJECT_JSON=$("$ODCLI" project create \
  --name "$PROJECT_NAME" \
  --mode design \
  --json \
  --daemon-url "$OD_URL")

PROJECT_ID=$(jq -r '.project.id' <<<"$PROJECT_JSON")
CONVERSATION_ID=$(jq -r '.conversationId' <<<"$PROJECT_JSON")
```

Add `--skill`, `--design-system`, `--plugin`, or `--inputs` only when the user chose a live identifier or discovery returned an unambiguous match.

For an existing project, resolve it read-only before mutation:

```bash
"$ODCLI" project list --json --daemon-url "$OD_URL"
"$ODCLI" project info "$PROJECT_ID" --json --daemon-url "$OD_URL"
```

If a name matches multiple projects, ask the user which project to use.

For a three-variant brief, create the project **once**. Treat the conversation returned by `project create` as variant A, then create B and C inside that same project:

```bash
CONVERSATION_A_ID="$CONVERSATION_ID"

CONVERSATION_B_JSON=$("$ODCLI" conversation new "$PROJECT_ID" \
  --title "card-b" \
  --mode design \
  --json \
  --daemon-url "$OD_URL")
CONVERSATION_B_ID=$(jq -r '.conversation.id' <<<"$CONVERSATION_B_JSON")

CONVERSATION_C_JSON=$("$ODCLI" conversation new "$PROJECT_ID" \
  --title "card-c" \
  --mode design \
  --json \
  --daemon-url "$OD_URL")
CONVERSATION_C_ID=$(jq -r '.conversation.id' <<<"$CONVERSATION_C_JSON")
```

Verify with `conversation list "$PROJECT_ID" --json` that all three IDs belong to the project. Do not create or duplicate three projects, and do not create three new conversations in addition to the project’s returned conversation.

## Step 5: Start and monitor the run

Use the project's returned conversation when available. Omit `--agent` and `--model` unless the user specified them; the daemon owns the configured defaults.

```bash
"$ODCLI" run start \
  --project "$PROJECT_ID" \
  --conversation "$CONVERSATION_ID" \
  --message "$PROMPT" \
  --follow \
  --json \
  --daemon-url "$OD_URL"
```

For an asynchronous run, retain its run ID and use:

```bash
"$ODCLI" run info "$RUN_ID" --json --daemon-url "$OD_URL"
"$ODCLI" run watch "$RUN_ID" --daemon-url "$OD_URL"
```

For a three-variant brief, choose three materially different IDs from the live `tools directions` result. Give A, B, and C the same immutable source snapshot and shared requirements, but a different direction plus an exclusive output root:

```text
card-a → variants/card-a/
card-b → variants/card-b/
card-c → variants/card-c/
```

Start all three runs without `--follow`, capture each `.runId`, and only then begin watching or waiting:

```bash
RUN_A_JSON=$("$ODCLI" run start \
  --project "$PROJECT_ID" \
  --conversation "$CONVERSATION_A_ID" \
  --message "$PROMPT_A" \
  --json \
  --daemon-url "$OD_URL")
RUN_A_ID=$(jq -r '.runId' <<<"$RUN_A_JSON")

RUN_B_JSON=$("$ODCLI" run start \
  --project "$PROJECT_ID" \
  --conversation "$CONVERSATION_B_ID" \
  --message "$PROMPT_B" \
  --json \
  --daemon-url "$OD_URL")
RUN_B_ID=$(jq -r '.runId' <<<"$RUN_B_JSON")

RUN_C_JSON=$("$ODCLI" run start \
  --project "$PROJECT_ID" \
  --conversation "$CONVERSATION_C_ID" \
  --message "$PROMPT_C" \
  --json \
  --daemon-url "$OD_URL")
RUN_C_ID=$(jq -r '.runId' <<<"$RUN_C_JSON")
```

This is asynchronous parallel dispatch: do not use `--follow`, `run watch`, or another blocking wait for A before B and C have returned run IDs. After all starts are accepted, monitor the three run IDs concurrently or poll each with `run info`. A failed variant may be continued or restarted only in its existing conversation; preserve the successful siblings and never recreate the project merely to retry one card.

Generation can take several minutes. Keep waiting while the run is active, provide concise progress updates at least once per minute, and do not replace the requested generation with a hand-written artifact. Cancel only when the user explicitly asks:

```bash
"$ODCLI" run cancel "$RUN_ID" --daemon-url "$OD_URL"
```

## Step 6: Verify the artifact

After a successful run, list the actual files and inspect the entry artifact:

```bash
"$ODCLI" files list "$PROJECT_ID" --json --daemon-url "$OD_URL"
"$ODCLI" files read "$PROJECT_ID" "$ENTRY_FILE" --daemon-url "$OD_URL"
```

Use `project info` for metadata and the resolved project directory. Use the run output, `run result-package`, and `files list` to identify the entry artifact; current packaged versions do not always include `entryFile` in `project info`. If several HTML/SVG candidates remain, inspect their manifests or ask the user instead of guessing. Do not claim completion based only on a terminal run status; confirm that the expected file exists and is readable.

For a three-variant batch, inspect `run result-package` for A, B, and C separately and confirm that every entry file is under its assigned output root. Shared-project runs must not overwrite one another’s files. One successful run does not stand in for the other two.

For a requested local edit, write through the CLI:

```bash
"$ODCLI" files write "$PROJECT_ID" "$RELATIVE_PATH" \
  --daemon-url "$OD_URL" < "$LOCAL_FILE"
```

## Step 7: Export only on request

Open Design artifacts are normally browser-viewable HTML/SVG. If the user asks for PDF, image, or PowerPoint, confirm the intended binary format when ambiguous, then export:

```bash
"$ODCLI" export "$ENTRY_FILE" \
  --project "$PROJECT_ID" \
  --format pdf \
  --out "$OUTPUT_PATH" \
  --daemon-url "$OD_URL"
```

Verify the output path exists and is non-empty before handing it off.

## Safety

- Treat `project delete`, `files delete`, version restoration, plugin install/uninstall, and database maintenance as explicit-authority actions.
- Resolve exact project and file identifiers with read-only commands before deletion.
- Never delete or overwrite a project merely to retry a failed run.
- Preserve raw JSON or error output when a command fails; report the exact failing command group and the daemon URL.

## Failure modes

| Problem | Likely cause | Action |
| --- | --- | --- |
| `/usr/bin/od` prints octal-dump usage | macOS system utility was invoked | Use `scripts/odcli.sh`; never call bare `od` |
| `cannot reach the Open Design daemon` | App and headless daemon are both stopped | Start `daemon start --headless --serve-web`, then probe status |
| Electron reports `Unable to find helper app` | `ELECTRON_RUN_AS_NODE=1` is absent | Use the wrapper, which exports the required environment |
| Wrapper cannot find the app | Packaged app is installed elsewhere | Set `OPEN_DESIGN_APP_PATH` or the two binary-path overrides |
| Skill/design-system list is empty | No recipe is installed in the selected data directory | Omit the selector or install content only with user approval |
| Run succeeds but no expected file is present | Generation did not persist the artifact requested | Inspect `run result-package`, `project info`, and `files list`; report the mismatch |
