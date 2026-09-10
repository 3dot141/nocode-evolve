#!/bin/sh
set -eu

app_path="${OPEN_DESIGN_APP_PATH:-/Applications/Open Design.app}"
helper_bin="${OD_HELPER_BIN:-$app_path/Contents/Frameworks/Open Design Helper.app/Contents/MacOS/Open Design Helper}"
daemon_cli="${OD_DAEMON_CLI_PATH:-$app_path/Contents/Resources/app/prebundled/daemon/daemon-cli.mjs}"

if [ ! -x "$helper_bin" ]; then
  printf '%s\n' "Open Design helper is not executable: $helper_bin" >&2
  printf '%s\n' "Set OPEN_DESIGN_APP_PATH or OD_HELPER_BIN to the packaged installation." >&2
  exit 127
fi

if [ ! -f "$daemon_cli" ]; then
  printf '%s\n' "Open Design daemon CLI was not found: $daemon_cli" >&2
  printf '%s\n' "Set OPEN_DESIGN_APP_PATH or OD_DAEMON_CLI_PATH to the packaged installation." >&2
  exit 127
fi

: "${HOME:?HOME must be set}"

export ELECTRON_RUN_AS_NODE=1
export OD_DATA_DIR="${OD_DATA_DIR:-$HOME/Library/Application Support/Open Design/namespaces/release-stable/data}"
export OD_SIDECAR_IPC_PATH="${OD_SIDECAR_IPC_PATH:-/tmp/open-design/ipc/release-stable/daemon.sock}"

exec "$helper_bin" "$daemon_cli" "$@"
