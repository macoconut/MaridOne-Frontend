import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/api';
import { verifyEmailToken } from '../accountSecurity';

describe('verifyEmailToken', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts the token to the public verification endpoint', async () => {
    fetchMock.mockResolvedValue(new Response('Email successfully verified', { status: 200 }));

    await expect(verifyEmailToken(' sample-token ')).resolves.toBe('Email successfully verified');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/auth/verify-email');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('sample-token');
    expect(init.credentials).toBeUndefined();
    expect(new Headers(init.headers).get('Content-Type')).toBe('text/plain');
  });

  it('throws ApiError when verification fails', async () => {
    fetchMock.mockResolvedValue(new Response('Invalid or expired verification link', { status: 401 }));

    await expect(verifyEmailToken('bad-token')).rejects.toBeInstanceOf(ApiError);
  });
});
