import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetApiAbuseProtectionStateForTests } from '../../src/lib/api-abuse-protection.js';

const { upsert } = vi.hoisted(() => ({
  upsert: vi.fn()
}));
const { clearRandomWorkoutCache } = vi.hoisted(() => ({
  clearRandomWorkoutCache: vi.fn()
}));

vi.mock('../../src/lib/db.js', () => ({
  db: {
    workout: {
      upsert
    }
  }
}));
vi.mock('../../src/lib/random-workout-cache.js', () => ({
  clearRandomWorkoutCache
}));

import { POST } from '../../src/app/api/admin/workouts/route.js';

describe('POST /api/admin/workouts', () => {
  const originalAdminKey = process.env.ADMIN_API_KEY;
  const originalFailureThreshold = process.env.API_ADMIN_AUTH_FAILURE_THRESHOLD;
  const originalLockoutBaseSeconds = process.env.API_ADMIN_LOCKOUT_BASE_SECONDS;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = 'secret-key';
  });

  afterEach(() => {
    if (originalAdminKey === undefined) {
      delete process.env.ADMIN_API_KEY;
    } else {
      process.env.ADMIN_API_KEY = originalAdminKey;
    }
    if (originalFailureThreshold === undefined) {
      delete process.env.API_ADMIN_AUTH_FAILURE_THRESHOLD;
    } else {
      process.env.API_ADMIN_AUTH_FAILURE_THRESHOLD = originalFailureThreshold;
    }
    if (originalLockoutBaseSeconds === undefined) {
      delete process.env.API_ADMIN_LOCKOUT_BASE_SECONDS;
    } else {
      process.env.API_ADMIN_LOCKOUT_BASE_SECONDS = originalLockoutBaseSeconds;
    }

    upsert.mockReset();
    clearRandomWorkoutCache.mockReset();
    resetApiAbuseProtectionStateForTests();
  });

  it('returns 401 when x-admin-key is missing', async () => {
    const response = await POST(
      new Request('https://example.com/api/admin/workouts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid admin API key'
      }
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('returns 401 when x-admin-key is invalid', async () => {
    const response = await POST(
      new Request('https://example.com/api/admin/workouts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-key': 'wrong-key'
        },
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid admin API key'
      }
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid payload with actionable validation details', async () => {
    const response = await POST(
      new Request('https://example.com/api/admin/workouts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-key': 'secret-key'
        },
        body: JSON.stringify({
          id: 'w1',
          title: 'Missing blocks',
          equipment: [],
          blocks: []
        })
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Workout payload validation failed',
        details: [
          {
            path: 'blocks',
            message: 'Workout must include at least one block'
          }
        ]
      }
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('upserts workout and returns publish state', async () => {
    upsert.mockResolvedValue({
      id: 'wod-001',
      isPublished: true
    });

    const response = await POST(
      new Request('https://example.com/api/admin/workouts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-key': 'secret-key'
        },
        body: JSON.stringify({
          id: 'wod-001',
          title: 'Fran',
          timeCapSeconds: 480,
          equipment: ['barbell', 'pull-up bar'],
          blocks: [
            {
              name: 'Main Piece',
              duration: 480,
              movements: [
                {
                  name: 'Thruster',
                  reps: 45,
                  load: '95/65 lb'
                }
              ]
            }
          ],
          notes: {
            scaling: 'Use lighter load'
          },
          isPublished: true
        })
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 'wod-001',
      isPublished: true
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { id: 'wod-001' },
      create: {
        id: 'wod-001',
        title: 'Fran',
        timeCapSeconds: 480,
        equipment: JSON.stringify(['barbell', 'pull-up bar']),
        data: JSON.stringify({
          blocks: [
            {
              name: 'Main Piece',
              duration: 480,
              movements: [
                {
                  name: 'Thruster',
                  reps: 45,
                  load: '95/65 lb'
                }
              ]
            }
          ],
          notes: {
            scaling: 'Use lighter load'
          }
        }),
        isPublished: true
      },
      update: {
        title: 'Fran',
        timeCapSeconds: 480,
        equipment: JSON.stringify(['barbell', 'pull-up bar']),
        data: JSON.stringify({
          blocks: [
            {
              name: 'Main Piece',
              duration: 480,
              movements: [
                {
                  name: 'Thruster',
                  reps: 45,
                  load: '95/65 lb'
                }
              ]
            }
          ],
          notes: {
            scaling: 'Use lighter load'
          }
        }),
        isPublished: true
      },
      select: {
        id: true,
        isPublished: true
      }
    });
    expect(clearRandomWorkoutCache).toHaveBeenCalledTimes(1);
  });

  it('locks admin route after repeated invalid keys and returns retry headers', async () => {
    process.env.API_ADMIN_AUTH_FAILURE_THRESHOLD = '2';
    process.env.API_ADMIN_LOCKOUT_BASE_SECONDS = '60';

    const first = await POST(
      new Request('https://example.com/api/admin/workouts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-key': 'bad-1'
        },
        body: JSON.stringify({})
      })
    );
    const second = await POST(
      new Request('https://example.com/api/admin/workouts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-key': 'bad-2'
        },
        body: JSON.stringify({})
      })
    );
    const third = await POST(
      new Request('https://example.com/api/admin/workouts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-key': 'secret-key'
        },
        body: JSON.stringify({})
      })
    );

    expect(first.status).toBe(401);
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).toBe('60');
    expect(await second.json()).toEqual({
      error: {
        code: 'ADMIN_LOCKED',
        message: 'Too many invalid admin authentication attempts. Please retry later.'
      }
    });
    expect(third.status).toBe(429);
    expect(upsert).not.toHaveBeenCalled();
  });
});
