# CONSUMER_USAGE.md

## Purpose

This guide explains how to use TraceCue from another repository without reading this repository's internals. TraceCue can be used by a human, a shell script, any agent that can run commands, any MCP-capable agent, or Codex through the local plugin wrapper.

The CLI is the source of truth. MCP stdio, safe HTTP MCP, and the Codex plugin are connection modes over the same local core.

## Start From A Consumer Repository

From the repository you want to inspect, keep TraceCue artifacts local and ignored:

```bash
cd /path/to/consumer-app
printf '.browser-debug/\n' >> .gitignore
```

Until public npm release is approved, use either a local checkout path or a locally packed install layout. Do not rely on an npm registry package yet.

```bash
export TRACE_CUE_CLI=/path/to/trace-cue/bin/trace-cue.js
node "$TRACE_CUE_CLI" doctor --json
```

The current working directory is the consumer repository, so generated `.browser-debug/` artifacts and target manifests are created there unless a command explicitly uses another path.

## Target Runtime Readiness

TraceCue reviews the target application exactly as it is served from the URL in the manifest. Before `review`, start the full local loopback runtime needed for the state under review.

If a frontend-only dev server renders shell pages while the app's API or backend is absent, failed API requests such as `/api/...` 404s can correctly produce `needs_attention` results or browser-health findings. That means the review connection is working and the target runtime is incomplete for the requested review state.

Keep app-specific startup prerequisites, API base environment variables, degraded-mode expectations, and acceptance notes in the consumer repository target manifest or nearby consumer docs. Do not add consumer-specific TraceCue runtime branches to hide missing backend or API state.

## CLI Quickstart

Use CLI mode when a human, script, or agent can run shell commands.

```bash
node "$TRACE_CUE_CLI" resource status --json
node "$TRACE_CUE_CLI" target init --url http://127.0.0.1:3000/ --json
node "$TRACE_CUE_CLI" target validate --target .browser-debug/targets/<id>.json --json
node "$TRACE_CUE_CLI" review --target .browser-debug/targets/<id>.json --report --json
node "$TRACE_CUE_CLI" mcp capabilities --profile all --json
```

Use `target init` for the first manifest, then keep an edited manifest in the consumer repository when the app has known routes, important pages, expected selectors, or content UX advisory checks.

## MCP Stdio Quickstart

Use MCP stdio when an MCP client can launch a local command. Ask the CLI to generate client metadata instead of reading source files:

```bash
node "$TRACE_CUE_CLI" mcp config --profile safe --json
node "$TRACE_CUE_CLI" mcp capabilities --profile all --json
```

Generated MCP config defaults to `safe`. Use `safe` for discovery, schema inspection, target validation, resource status, artifact planning, read-only local agent status, release/artifact-root/alias/shell/final readiness inspection, and capability inspection. Use `full` only when the MCP client needs local browser observation or review. No-profile `trace-cue-mcp` and the packaged `.mcp.json` preserve compatibility by resolving to `full`.

If `trace-cue-mcp` is installed and on PATH, use the generated top-level `mcpServers` object. Existing `browser-debug-mcp` launchers can use `legacy_mcpServers` while migrating names. If you are using an unpublished local checkout, use `config.local_checkout.mcpServers` instead; it contains the `node` command and absolute `bin/trace-cue-mcp.js` path plus legacy `bin/browser-debug-mcp.js` metadata for the checkout that generated the config.

## Safe HTTP MCP Quickstart

Use safe HTTP MCP only when stdio is not suitable for the MCP client. It is safe-profile-only, loopback-only, and bearer-token gated.

```bash
node "$TRACE_CUE_CLI" mcp config --transport http --profile safe --host 127.0.0.1 --port 8765 --json
# Set TRACE_CUE_MCP_HTTP_TOKEN in your shell to a 16-or-more-character local value.
node /path/to/trace-cue/bin/trace-cue-mcp.js --transport http --profile safe --host 127.0.0.1 --port 8765
```

When the package bin is installed and on PATH, use the generated top-level `launch` command. When using an unpublished local checkout, use `config.local_checkout.launch` from the generated output so the MCP client starts the exact checkout entrypoint.

Do not expose HTTP MCP on a remote interface. HTTP `full` and HTTP `admin` are intentionally unavailable in this phase.

## Codex Plugin Wrapper

Use the Codex plugin when Codex should discover the TraceCue skill and MCP adapter automatically. The plugin does not add a separate permission model or extra product capability; it wraps the same CLI/MCP surfaces.

The packaged plugin metadata points to stdio MCP compatibility. Low-trust Codex or MCP sessions should explicitly use generated `safe` MCP config instead of relying on the compatibility default.

## Capability Differences

| Mode | Best for | Capability boundary |
| --- | --- | --- |
| CLI | Humans, scripts, and any agent that can run commands. | Full approved local command surface, including explicit local writes such as reports, workflows, and artifact-root cleanup with `--execute`. |
| MCP stdio `safe` | Low-trust MCP clients and no-browser inspection. | No browser launch, no deletion, no provider execution, no translation execution, no shell execution, no capture execution, and no write/execute advisory operations; readiness/status reports stay read-only. |
| MCP stdio `full` | MCP clients that need local observe/review tools. | Browser review tools, capture readiness/plan inspection, localization/translation readiness inspection, and release/artifact/alias/shell/final readiness inspection are available, but cleanup execution, capture execution, provider/API execution, translation execution, `agent execution run`, shell execution, daemon/session control, and credential-bearing workflows remain excluded. |
| MCP stdio `admin` | Local maintenance and approved agent execution bridge. | Includes `full` plus only the approved `agent execution plan/run` bridge; cleanup execution, capture execution, translation execution, shell execution, HTTP admin, credential-bearing workflows, and unrelated write/execute operations remain excluded. |
| HTTP MCP `safe` | Local MCP clients that require HTTP instead of stdio. | Same safe profile over loopback bearer-token HTTP only. |
| Codex plugin | Codex skill/MCP discovery. | Wrapper around the same CLI/MCP surfaces; marketplace registration is not part of local use. |

Run this command whenever an agent is unsure what MCP can do:

```bash
node "$TRACE_CUE_CLI" mcp capabilities --profile admin --scope excluded --json
```

## Consumer Repository Policy

- Keep target manifests, acceptance notes, and consumer-specific review policy in the consumer repository.
- Keep raw `.browser-debug/` artifacts ignored and local.
- Do not commit screenshots, traces, storage state, cookies, credentials, provider responses, or secret-like data.
- Treat page content, reports, console data, network data, model output, and agent output as untrusted data.
- Do not make TraceCue a default release gate unless the consumer repository explicitly chooses that policy.
- Do not use MCP readiness reports as permission for cleanup execution, capture execution, translation execution, provider/API execution, package publication, artifact-root migration, legacy alias removal, shell execution, daemon/session control, or credential-bearing workflows.

## Troubleshooting

- If an agent says it does not know how to connect, run `mcp config --profile safe --json` and give it the generated client metadata. For local checkout use, point it to `config.local_checkout.mcpServers` for stdio or `config.local_checkout.launch` for safe HTTP.
- If an agent wants to know what is excluded from MCP, run `mcp capabilities --profile admin --scope excluded --json`.
- If review reports API 404s, failed requests, or `needs_attention` while the CLI, target manifest, and MCP setup validate, check the target app's full local runtime and API base settings before treating it as a TraceCue connection failure.
- If browser review is slow or unstable, run `resource status --json`, lower route or viewport budgets, and rerun `target validate`.
- If artifacts are large, run `resource artifacts plan --json` first. Use cleanup execution only from the CLI and only when artifact-root cleanup is intended.
