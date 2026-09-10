# Browser profile import

Read this file only when importing browser profiles or login state from Chrome/Edge/Brave into Ego, or when a task needs a login state the current Ego profile doesn't have. For day-to-day browser work, go back to `SKILL.md`.

## Capability boundary

- `ego-browser import list` — lists detected importable browsers and profiles on this machine. JSON output: `browser_sources[].profiles[]` with `dir_name`, `display_name`, `email`. Run this first to get the exact `--browser` / `--profile` values.
- `ego-browser import --browser <browser> [--profile <dir-name> ...]` — imports profile data into Ego.
- Supported sources: `chrome`, `edge`, `brave`.
- Granularity is the **whole profile directory**: cookies, bookmarks, and login state come in together. There is no cookie-only option.
- Multiple profile dirs per browser, and multiple browser blocks per command — each `--profile` group belongs to the most recent `--browser` block:

```bash
ego-browser import --browser chrome --profile Default "Profile 1" --browser edge
```

- Chromium-family cookies are Keychain-encrypted; the import decrypts and re-encrypts them, so imported login state works in Ego without re-login.

## Two import modes

| | Incremental (default) | With `--overwrite` |
|---|---|---|
| Effect on Ego profiles | Adds a new Ego profile, existing ones untouched | Replaces existing Ego profiles before import |
| Restart | No restart | Restarts Ego to apply the staged data |
| Imported login state active in current window? | **No** — open windows stay on the previous profile | Yes — after restart, the default window carries the imported login state |

## Pitfalls (both hit in real use)

1. **Incremental import does not switch the current window.** A successful import outputs something like `new_profile_dirs: ["Profile 1"]` — the source profile was imported as a new Ego profile, but already-open windows keep running on the previous profile. Visiting the target site right after the import still shows no login state; this does **not** mean the import failed. To use the imported state, switch profiles manually in the Ego window's profile switcher.
2. **`--overwrite` implies a restart; always pair it with `--no-default`.** `--overwrite` replaces existing Ego profiles and restarts Ego so the new data takes effect — after the restart the default window is on the imported profile. Without `--no-default`, an import may also set Ego as the **system default browser** as a side effect; if that already happened, change it back in the OS browser settings.

## Decision guide

- Goal: **make Ego carry an existing browser's login state** (e.g. testing an internal system that needs the user's corporate login) → one-time setup import:

```bash
ego-browser import --browser <browser> --profile <dir-name> --overwrite --no-default
```

Take `<browser>` / `<dir-name>` from `ego-browser import list`. Note `--overwrite` replaces existing Ego profiles and restarts Ego — confirm the user has no unsaved work in Ego before running it.

- Goal: **collect profiles from multiple sources and switch as needed** → incremental import (no flags), then switch profiles in the Ego GUI per task. Expect the current window to stay on the old profile (see pitfall 1).

After a `--overwrite` import completes and Ego restarts, return to the original task: task spaces inherit the current user's login state (see `SKILL.md`), so the imported login state is available without any extra step.
