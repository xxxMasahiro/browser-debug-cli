import { SCHEMA_VERSION } from './constants.js';

export function observedAt(now = new Date()) {
  const value = typeof now === 'function' ? now() : now;
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

export function createEnvelope({
  command,
  status,
  data = {},
  warnings = [],
  errors = [],
  artifacts = [],
  now
}) {
  return {
    schema_version: SCHEMA_VERSION,
    command,
    status,
    observed_at: observedAt(now),
    data,
    warnings,
    errors,
    artifacts
  };
}

export function createErrorEnvelope({ command, code, message, details = {}, now }) {
  return createEnvelope({
    command,
    status: 'error',
    data: {},
    warnings: [],
    errors: [{ code, message, details }],
    artifacts: [],
    now
  });
}

export function stringifyEnvelope(envelope) {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}
