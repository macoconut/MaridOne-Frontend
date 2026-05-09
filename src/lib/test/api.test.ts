import { describe, expect, it } from 'vitest';
import { ApiError, resolveApiBaseUrl, toDisplayError } from '../api/api';

describe('toDisplayError', () => {
  it('formats ApiError with message', () => {
    const error = new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'bad',
      status: 400,
      timestamp: new Date().toISOString(),
    });
    const out = toDisplayError(error);
    expect(out.message).toBe('bad');
  });

  it('formats plain Error', () => {
    const out = toDisplayError(new Error('boom'));
    expect(out.message).toBe('boom');
  });

  it('handles unknown input', () => {
    const out = toDisplayError('nope');
    expect(out.message).toBe('nope')
  });
});

describe('resolveApiBaseUrl', () => {
  it('uses the configured API base URL when provided', () => {
    expect(resolveApiBaseUrl(' https://api.maridone.test/ ', null)).toBe('https://api.maridone.test');
  });

  it('maps local Vite sessions to the backend on port 8080', () => {
    expect(
      resolveApiBaseUrl('', {
        origin: 'http://192.168.1.25:5173',
        protocol: 'http:',
        hostname: '192.168.1.25',
        port: '5173',
      })
    ).toBe('http://192.168.1.25:8080');
  });

  it('uses the same origin outside the Vite dev ports', () => {
    expect(
      resolveApiBaseUrl('', {
        origin: 'https://app.maridone.test',
        protocol: 'https:',
        hostname: 'app.maridone.test',
        port: '',
      })
    ).toBe('https://app.maridone.test');
  });
});
