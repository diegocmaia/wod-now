import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetApiAbuseProtectionStateForTests } from '../../src/lib/api-abuse-protection.js';

const { count } = vi.hoisted(() => ({
  count: vi.fn().mockResolvedValue(3)
}));

vi.mock('../../src/lib/db.js', () => ({
  db: {
    workout: {
      count
    }
  }
}));

import { GET } from '../../src/app/api/workouts/route.js';

describe('GET /api/workouts scaffold', () => {
  const originalPublicLimit = process.env.API_PUBLIC_RATE_LIMIT_PER_MINUTE;

  afterEach(() => {
    if (originalPublicLimit === undefined) {
      delete process.env.API_PUBLIC_RATE_LIMIT_PER_MINUTE;
    } else {
      process.env.API_PUBLIC_RATE_LIMIT_PER_MINUTE = originalPublicLimit;
    }

    resetApiAbuseProtectionStateForTests();
    count.mockClear();
  });

  it('uses db singleton and returns count payload', async () => {
    const response = await GET(new Request('https://example.com/api/workouts'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 3 });
    expect(count).toHaveBeenCalledWith({});
  });

  it('returns 429 with retry-after when limit is exceeded', async () => {
    process.env.API_PUBLIC_RATE_LIMIT_PER_MINUTE = '1';

    const first = await GET(new Request('https://example.com/api/workouts'));
    const second = await GET(new Request('https://example.com/api/workouts'));

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).toBeTruthy();
    expect(await second.json()).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please retry later.'
      }
    });
  });
});
