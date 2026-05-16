export function redactSecrets(value: unknown): string {
  const text = valueToText(value);

  return text
    .replace(/(--api-key)\s+\S+/gi, '$1 [REDACTED]')
    .replace(/Bearer\s+sk(?:-cp)?-[A-Za-z0-9_-]+/gi, 'Bearer [REDACTED]')
    .replace(/sk(?:-cp)?-[A-Za-z0-9_-]+/g, '[REDACTED]');
}

function valueToText(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
