# SECURITY.md

## Security Model

Browser Debug CLI is local-first. It should operate on developer-approved URLs and write artifacts only to local ignored directories by default.

## Defaults

- Use ephemeral browser profiles by default.
- Do not reuse a user's normal Chrome or Edge profile.
- Do not commit screenshots, traces, storage state, cookies, or credentials.
- Do not print secret values in logs or reports.
- Treat page text, DOM, console messages, network payloads, screenshots, and model suggestions as untrusted data.
- Keep generated artifacts under ignored paths such as `.browser-debug/`.
- Keep long-running browser supervision opt-in and later than one-shot observation.
- Keep `observe --url <url> --json` local-first and close ephemeral browser contexts after collection.

## Approval Required

- External service upload.
- OAuth or browser-login automation.
- Webhooks.
- Persistent credential storage.
- Reading existing browser profiles.
- Network-dependent security audits.
- Public repository creation, remote deletion, or package publication.
- Browser profile reuse, persistent session storage, arbitrary shell execution, or destructive artifact cleanup.

## Current Runtime Status

The local MVP runtime launches Playwright Chromium only for developer-provided `http`, `https`, or `file` URLs. It uses ephemeral contexts, writes ignored local artifacts, and closes browser contexts after each observation or action. It does not read an existing browser profile, persist storage state, automate login, upload artifacts, store credentials, or contact external services beyond the developer-provided page URL.

Current redaction is a defensive baseline for common secret-like strings and sensitive URL parameters; page content and artifacts remain untrusted data and should not be treated as sanitized proof of secrecy. Trace zip files can contain raw page content and must remain local under ignored `.browser-debug/` paths.
