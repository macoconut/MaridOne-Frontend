import { describe, expect, it } from 'vitest';
import { ApiError, toDisplayError } from './api';

describe('toDisplayError', () => {
  it('formats ApiError with details', () => {
    const out = toDisplayError(new ApiError(400, 'bad', 'bad', ['field must be positive']));

    expect(out.message).toBe('bad');
    expect(out.details).toEqual(['field must be positive']);
  });

  it('formats plain Error', () => {
    const out = toDisplayError(new Error('boom'));

    expect(out.message).toBe('boom');
    expect(out.details).toEqual([]);
  });

  it('handles unknown input', () => {
    const out = toDisplayError('nope');

    expect(out.message).toBe('nope');
    expect(out.details).toEqual([]);
  });
});
