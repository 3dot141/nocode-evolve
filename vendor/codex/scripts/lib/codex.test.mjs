import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadBrokerSession, saveBrokerSession } from "./broker-lifecycle.mjs";
import { getCodexAuthStatus } from "./codex.mjs";

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-auth-test-"));
  const cwd = path.join(root, "workspace");
  const bin = path.join(root, "bin");
  const pluginData = path.join(root, "plugin-data");
  fs.mkdirSync(cwd, { recursive: true });
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(pluginData, { recursive: true });
  return {
    root,
    cwd,
    bin,
    pluginData,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true })
  };
}

function writeFakeCodex(binDir) {
  const codexPath = path.join(binDir, "codex");
  fs.writeFileSync(
    codexPath,
    `#!/usr/bin/env node
import readline from "node:readline";

const args = process.argv.slice(2);
if (args.join(" ") === "--version") {
  console.log("codex-cli fake");
  process.exit(0);
}
if (args.join(" ") === "app-server --help") {
  console.log("fake app-server help");
  process.exit(0);
}
if (args.join(" ") !== "app-server") {
  console.error("unexpected fake codex args: " + args.join(" "));
  process.exit(2);
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ id: message.id, result: {} }));
    return;
  }
  if (message.method === "account/read") {
    console.log(JSON.stringify({
      id: message.id,
      result: {
        account: { type: "chatgpt", email: "codex@example.test" },
        requiresOpenaiAuth: true
      }
    }));
    return;
  }
  if (message.method === "config/read") {
    console.log(JSON.stringify({
      id: message.id,
      result: {
        config: {
          model_provider: "openai",
          model_providers: { openai: { name: "OpenAI" } }
        }
      }
    }));
    return;
  }
  console.log(JSON.stringify({ id: message.id, result: {} }));
});
rl.on("close", () => process.exit(0));
`,
    "utf8"
  );
  fs.chmodSync(codexPath, 0o755);
}

test("getCodexAuthStatus falls back to direct app-server when saved broker socket is stale", async () => {
  const fixture = makeFixture();
  const previousPath = process.env.PATH;
  const previousPluginData = process.env.CLAUDE_PLUGIN_DATA;

  try {
    writeFakeCodex(fixture.bin);
    process.env.PATH = `${fixture.bin}${path.delimiter}${previousPath ?? ""}`;
    process.env.CLAUDE_PLUGIN_DATA = fixture.pluginData;

    const staleSessionDir = path.join(fixture.root, "stale-session");
    saveBrokerSession(fixture.cwd, {
      endpoint: `unix:${path.join(staleSessionDir, "broker.sock")}`,
      pidFile: path.join(staleSessionDir, "broker.pid"),
      logFile: path.join(staleSessionDir, "broker.log"),
      sessionDir: staleSessionDir,
      pid: 12345
    });

    const status = await getCodexAuthStatus(fixture.cwd, {
      env: { ...process.env }
    });

    assert.equal(status.loggedIn, true);
    assert.equal(status.source, "app-server");
    assert.equal(status.authMethod, "chatgpt");
    assert.equal(loadBrokerSession(fixture.cwd), null);
  } finally {
    if (previousPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = previousPath;
    }
    if (previousPluginData === undefined) {
      delete process.env.CLAUDE_PLUGIN_DATA;
    } else {
      process.env.CLAUDE_PLUGIN_DATA = previousPluginData;
    }
    fixture.cleanup();
  }
});
