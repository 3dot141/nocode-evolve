export const PORTS = { agents: 8070, server: 8081, web: 10001 };

export function buildWriteTargets({ agentsDir, ports = PORTS }) {
  return {
    webEnv: {
      AGENTS_LOCAL_SERVER: `http://127.0.0.1:${ports.agents}`,
      USER_CLIENT: 'localDebugger',
      AGENTS_LOCAL_SRC: agentsDir,
      DEV_SERVER_PORT: String(ports.web),
    },
    serverEnv: { SERVER_PORT: String(ports.server) },
  };
}
