const sensitiveKeyPattern = /(?:token|secret|password|passwd|api[_-]?key|authorization|cookie|session)/i;
const assignmentPattern = /((?:token|secret|password|passwd|api[_-]?key|authorization|cookie|session)\s*[:=]\s*)([^&\s,;"']+)/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi;
const commonCredentialPattern = /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})\b/g;

export function redact(value) {
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = sensitiveKeyPattern.test(key) ? '[REDACTED]' : redact(nested);
    }
    return output;
  }
  return value;
}

export function redactString(value) {
  return value
    .replace(assignmentPattern, '$1[REDACTED]')
    .replace(bearerPattern, 'Bearer [REDACTED]')
    .replace(commonCredentialPattern, '[REDACTED]');
}

export function redactUrl(value) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (sensitiveKeyPattern.test(key)) {
        url.searchParams.set(key, '[REDACTED]');
      }
    }
    return redactString(url.toString());
  } catch {
    return redactString(String(value));
  }
}

export function truncateText(value, maxLength = 4000) {
  const redacted = redactString(String(value ?? '')).replace(/\s+/g, ' ').trim();
  if (redacted.length <= maxLength) {
    return redacted;
  }
  return `${redacted.slice(0, maxLength)}...`;
}
