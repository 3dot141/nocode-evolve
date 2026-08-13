import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_SEGMENTS = [
  "model/agent-about.md",
  "model/agent-personal.md",
  "model/agent-karpathy.md",
  "model/agent-rule-catalog-1.md",
  "model/agent-rule-catalog-2.md",
  "model/agent-rule-catalog-3.md",
  "model/agent-rule-catalog-4.md",
  "model/agent-rule-catalog-5.md",
];

type PretoolRule = {
  rule: string;
  pattern: string;
  decision: string;
  reason: string;
};

function readText(file: string): string {
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf8");
}

function rewritePluginPaths(content: string): string {
  return content
    .replaceAll("${CLAUDE_PLUGIN_ROOT}", PLUGIN_ROOT)
    .replaceAll("{CLAUDE_PLUGIN_ROOT}", PLUGIN_ROOT)
    .replaceAll("${PLUGIN_ROOT}", PLUGIN_ROOT)
    .replaceAll("{PLUGIN_ROOT}", PLUGIN_ROOT)
    .replaceAll("${QODER_PLUGIN_ROOT}", PLUGIN_ROOT)
    .replaceAll("{QODER_PLUGIN_ROOT}", PLUGIN_ROOT)
    .replaceAll("${NOCODE_PLUGIN_ROOT}", PLUGIN_ROOT)
    .replaceAll("{NOCODE_PLUGIN_ROOT}", PLUGIN_ROOT)
    .replaceAll("${NOCODE_SKILL_REF}", `${PLUGIN_ROOT}/skills/references`)
    .replaceAll("{NOCODE_SKILL_REF}", `${PLUGIN_ROOT}/skills/references`);
}

function loadStaticContext(): string {
  const parts: string[] = [];
  for (const relative of MODEL_SEGMENTS) {
    const body = rewritePluginPaths(readText(path.join(PLUGIN_ROOT, relative))).trim();
    if (!body) continue;
    parts.push(`<!-- source: nocode/${relative} -->\n${body}`);
  }
  return parts.join("\n\n");
}

function loadProjectContext(cwd: string): string {
  const file = path.join(cwd, ".agents-personal", "AGENTS.md");
  const body = readText(file).trim();
  if (!body) return "";
  return `<!-- source: ${file} (project override) -->\n${body}`;
}

function loadRules(): PretoolRule[] {
  const file = path.join(PLUGIN_ROOT, "hooks/pretooluse-rules.json");
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readText(file));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function matchRules(command: string, rules: PretoolRule[]): PretoolRule[] {
  const normalized = String(command).replace(/\\\n/g, " ").replace(/\s+/g, " ");
  return rules.filter((rule) => {
    try {
      return new RegExp(rule.pattern, "i").test(normalized);
    } catch {
      return false;
    }
  });
}

function runDetached(script: string, env: NodeJS.ProcessEnv, cwd: string): void {
  const child = spawn(process.execPath, [script], {
    cwd,
    env,
    stdio: "ignore",
  });
  child.on("error", () => undefined);
}

function resolveSessionId(ctx: { sessionManager: { getSessionId?: () => string | undefined; getSessionFile?: () => string | undefined } }): string {
  const fromManager = ctx.sessionManager.getSessionId?.();
  if (fromManager) return String(fromManager);
  const sessionFile = ctx.sessionManager.getSessionFile?.();
  if (sessionFile) return path.basename(sessionFile, path.extname(sessionFile));
  return `pi-${Date.now()}`;
}

export default function (pi: ExtensionAPI) {
  const staticContext = loadStaticContext();
  const rules = loadRules();

  pi.on("session_start", async (_event, ctx) => {
    const dataRoot = path.join(
      process.env.HOME || process.env.USERPROFILE || "",
      ".nocode",
      "pi",
      "data",
    );
    const env = {
      ...process.env,
      NOCODE_PLATFORM: "pi",
      NOCODE_PLUGIN_ROOT: PLUGIN_ROOT,
      NOCODE_PLUGIN_DATA: dataRoot,
      CLAUDE_PROJECT_DIR: ctx.cwd,
      NOCODE_PROJECT_DIR: ctx.cwd,
    };

    try {
      const { openSession } = await import(path.join(PLUGIN_ROOT, "scripts/session-state.mjs"));
      openSession({
        sessionId: resolveSessionId(ctx),
        workspace: ctx.cwd,
      }, { dataRoot });
    } catch {
      // Isolation is best-effort and must not block the session.
    }

    runDetached(path.join(PLUGIN_ROOT, "scripts/personal-snapshot.mjs"), env, ctx.cwd);
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const injected = [staticContext, loadProjectContext(ctx.cwd)].filter(Boolean).join("\n\n");
    if (!injected) return;
    return {
      systemPrompt: `${event.systemPrompt}\n\n# NoCode\n\n${injected}`,
    };
  });

  pi.on("tool_call", async (event) => {
    if (!isToolCallEventType("bash", event)) return;
    const block = matchRules(event.input.command || "", rules).find((hit) => hit.decision === "block");
    if (!block) return;
    return {
      block: true,
      reason: `[rule:${block.rule}] ${block.reason}`,
    };
  });
}
