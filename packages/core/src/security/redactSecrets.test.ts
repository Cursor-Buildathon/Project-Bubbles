import { describe, expect, it } from 'vitest';
import { redactSecrets } from './redactSecrets.js';

describe('redactSecrets', () => {
  it('redacts MiniMax keys, bearer tokens, and CLI auth arguments', () => {
    const raw = [
      'MiniMax failed with key sk-cp-1234567890abcdef',
      'Authorization: Bearer sk-abcdefghijklmnopqrstuvwxyz',
      'mmx auth login --api-key sk-cp-dangerous-secret'
    ].join('\n');

    const redacted = redactSecrets(raw);

    expect(redacted).not.toContain('sk-cp-1234567890abcdef');
    expect(redacted).not.toContain('sk-abcdefghijklmnopqrstuvwxyz');
    expect(redacted).not.toContain('sk-cp-dangerous-secret');
    expect(redacted).toContain('[REDACTED]');
    expect(redacted).toContain('--api-key [REDACTED]');
  });

  it('redacts secrets inside unknown thrown values', () => {
    expect(redactSecrets(new Error('bad token sk-cp-abcdef123456'))).toBe('bad token [REDACTED]');
    expect(redactSecrets({ message: 'Bearer sk-testsecret12345' })).toBe('{"message":"Bearer [REDACTED]"}');
  });
});
