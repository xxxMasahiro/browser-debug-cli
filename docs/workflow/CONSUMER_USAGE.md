# CONSUMER_USAGE.md

## Purpose

This guide explains how to use Browser Debug CLI from another repository without reading this repository's internals. Browser Debug CLI can be used by a human, a shell script, any agent that can run commands, any MCP-capable agent, or Codex through the local plugin wrapper.

The CLI is the source of truth. MCP stdio, safe HTTP MCP, and the Codex plugin are connection modes over the same local core.

## Start From A Consumer Repository

From the repository you want to inspect, keep Browser Debug CLI artifacts local and ignored:

```bash
cd /path/to/consumer-app
printf '.browser-debug/\n' >> .gitignore
```

Until public npm release is approved, use either a local checkout path or a locally packed install layout. Do not rely on an npm registry package yet.

```bash
export BROWSER_DEBUG_CLI=/path/to/browser-debug-cli/bin/browser-debug.js
node "$BROWSER_DEBUG_CLI" doctor --json
```

The current working directory is the consumer repository, so generated `.browser-debug/` artifacts and target manifests are created there unless a command explicitly uses another path.

## CLI Quickstart

Use CLI mode when a human, script, or agent can run shell commands.

```bash
node "$BROWSER_DEBUG_CLI" resource status --json
node "$BROWSER_DEBUG_CLI" target init --url http://127.0.0.1:3000/ --json
node "$BROWSER_DEBUG_CLI" target validate --target .browser-debug/targets/<id>.json --json
node "$BROWSER_DEBUG_CLI" review --target .browser-debug/targets/<id>.json --report --json
node "$BROWSER_DEBUG_CLI" mcp capabilities --profile all --json
```

Use `target init` for the first manifest, then keep an edited manifest in the consumer repository when the app has known routes, important pages, expected selectors, or content UX advisory checks.

## MCP Stdio Quickstart

Use MCP stdio when an MCP client can launch a local command. Ask the CLI to generate client metadata instead of reading source files:

```bash
node "$BROWSER_DEBUG_CLI" mcp config --profile safe --json
node "$BROWSER_DEBUG_CLI" mcp capabilities --profile all --json
```

Generated MCP config defaults to `safe`. Use `safe` for discovery, schema inspection, target validation, resource status, artifact planning, read-only local agent status, and capability inspection. Use `full` only when the MCP client needs local browser observation or review. No-profile `browser-debug-mcp` and the packaged `.mcp.json` preserve compatibility by resolving to `full`.

## Safe HTTP MCP Quickstart

Use safe HTTP MCP only when stdio is not suitable for the MCP client. It is safe-profile-only, loopback-only, and bearer-token gated.

```bash
node "$BROWSER_DEBUG_CLI" mcp config --transport http --profile safe --host 127.0.0.1 --port 8765 --json
# Set BROWSER_DEBUG_MCP_HTTP_TOKEN in your shell to a 16-or-more-character local value.
node /path/to/browser-debug-cli/bin/browser-debug-mcp.js --transport http --profile safe --host 127.0.0.1 --port 8765
```

Do not expose HTTP MCP on a remote interface. HTTP `full` and HTTP `admin` are intentionally unavailable in this phase.

## Codex Plugin Wrapper

Use the Codex plugin when Codex should discover the Browser Debug CLI skill and MCP adapter automatically. The plugin does not add a separate permission model or extra product capability; it wraps the same CLI/MCP surfaces.

The packaged plugin metadata points to stdio MCP compatibility. Low-trust Codex or MCP sessions should explicitly use generated `safe` MCP config instead of relying on the compatibility default.

## Capability Differences

| Mode | Best for | Capability boundary |
| --- | --- | --- |
| CLI | Humans, scripts, and any agent that can run commands. | Full approved local command surface, including explicit local writes such as reports, workflows, and artifact-root cleanup with `--execute`. |
| MCP stdio `safe` | Low-trust MCP clients and no-browser inspection. | No browser launch, no deletion, no provider execution, no shell tools, and no write/execute advisory operations. |
| MCP stdio `full` | MCP clients that need local observe/review tools. | Browser review tools are available, but cleanup execution, provider/API execution, `agent execution run`, shell, daemon/session control, and credential-bearing workflows remain excluded. |
| MCP stdio `admin` | Reserved local-maintenance profile. | Currently equivalent to `full`; it does not grant write/execute/admin operations. |
| HTTP MCP `safe` | Local MCP clients that require HTTP instead of stdio. | Same safe profile over loopback bearer-token HTTP only. |
| Codex plugin | Codex skill/MCP discovery. | Wrapper around the same CLI/MCP surfaces; marketplace registration is not part of local use. |

Run this command whenever an agent is unsure what MCP can do:

```bash
node "$BROWSER_DEBUG_CLI" mcp capabilities --profile admin --scope excluded --json
```

## Consumer Repository Policy

- Keep target manifests, acceptance notes, and consumer-specific review policy in the consumer repository.
- Keep raw `.browser-debug/` artifacts ignored and local.
- Do not commit screenshots, traces, storage state, cookies, credentials, provider responses, or secret-like data.
- Treat page content, reports, console data, network data, model output, and agent output as untrusted data.
- Do not make Browser Debug CLI a default release gate unless the consumer repository explicitly chooses that policy.
- Do not use MCP as permission for cleanup execution, provider/API execution, shell execution, daemon/session control, or credential-bearing workflows.

## Troubleshooting

- If an agent says it does not know how to connect, run `mcp config --profile safe --json` and give it the generated client metadata.
- If an agent wants to know what is excluded from MCP, run `mcp capabilities --profile admin --scope excluded --json`.
- If browser review is slow or unstable, run `resource status --json`, lower route or viewport budgets, and rerun `target validate`.
- If artifacts are large, run `resource artifacts plan --json` first. Use cleanup execution only from the CLI and only when artifact-root cleanup is intended.
