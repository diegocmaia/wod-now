import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetApiAbuseProtectionStateForTests } from '../../src/lib/api-abuse-protection.js';

const { findRandom } = vi.hoisted(() => ({
  findRandom: vi.fn()
}));

vi.mock('../../src/lib/db.js', () => ({
  db: {
    workout: {
      findRandom
    }
  }
}));

import { GET } from '../../src/app/api/workouts/random/route.js';
import { clearRandomWorkoutCache } from '../../src/lib/random-workout-cache.js';

afterEach(() => {
  vi.restoreAllMocks();
  findRandom.mockReset();
  clearRandomWorkoutCache();
  resetApiAbuseProtectionStateForTests();
});

describe('GET /api/workouts/random', () => {
  it('returns 404 when no candidate workout exists', async () => {
    findRandom.mockResolvedValue(null);

    const response = await GET(new Request('https://example.com/api/workouts/random'));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'No workout matched the provided filters'
      }
    });
  });

  it('applies timeCapMax and exclude filters to db query', async () => {
    findRandom.mockResolvedValue({
      id: 'w2',
      title: 'Helen',
      timeCapSeconds: 540,
      equipment: JSON.stringify(['barbell']),
      data: JSON.stringify({ reps: 1 }),
      isPublished: true
    });

    const response = await GET(
      new Request('https://example.com/api/workouts/random?timeCapMax=600&exclude=w1,w3')
    );

    expect(response.status).toBe(200);
    expect(findRandom).toHaveBeenCalledWith({
      where: {
        isPublished: true,
        timeCapSeconds: { lte: 600 },
        id: { notIn: ['w1', 'w3'] }
      },
      select: {
        id: true,
        title: true,
        timeCapSeconds: true,
        equipment: true,
        data: true,
        isPublished: true
      }
    });
  });

  it('pushes equipment filtering to db random query', async () => {
    findRandom.mockResolvedValue({
      id: 'w3',
      title: 'DT',
      timeCapSeconds: 720,
      equipment: JSON.stringify(['barbell', 'pull-up bar']),
      data: JSON.stringify({ rounds: [12, 9, 6] }),
      isPublished: true
    });

    const response = await GET(
      new Request('https://example.com/api/workouts/random?equipment=barbell,pull-up%20bar')
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 'w3',
      title: 'DT',
      timeCapSeconds: 720,
      equipment: ['barbell', 'pull-up bar'],
      data: { rounds: [12, 9, 6] }
    });
    expect(findRandom).toHaveBeenCalledWith({
      where: {
        isPublished: true,
        equipmentAll: ['barbell', 'pull-up bar']
      },
      select: {
        id: true,
        title: true,
        timeCapSeconds: true,
        equipment: true,
        data: true,
        isPublished: true
      }
    });
  });

  it('normalizes equipment aliases before db filtering', async () => {
    findRandom.mockResolvedValue({
      id: 'w-db',
      title: 'DB Chipper',
      timeCapSeconds: 600,
      equipment: JSON.stringify(['dumbbell']),
      data: JSON.stringify({ rounds: [1] }),
      isPublished: true
    });

    const response = await GET(
      new Request('https://example.com/api/workouts/random?equipment=dumbbells')
    );

    expect(response.status).toBe(200);
    expect(findRandom).toHaveBeenCalledWith({
      where: {
        isPublished: true,
        equipmentAll: ['dumbbell']
      },
      select: {
        id: true,
        title: true,
        timeCapSeconds: true,
        equipment: true,
        data: true,
        isPublished: true
      }
    });
  });

  it('returns cached value without additional db query for equivalent filter keys', async () => {
    findRandom.mockResolvedValue({
      id: 'w-cache',
      title: 'Cache Hit',
      timeCapSeconds: 300,
      equipment: JSON.stringify(['barbell']),
      data: JSON.stringify({ rounds: [5] }),
      isPublished: true
    });

    const first = await GET(
      new Request('https://example.com/api/workouts/random?equipment=barbell,pull-up%20bar')
    );
    const second = await GET(
      new Request('https://example.com/api/workouts/random?equipment=pull-up%20bar,barbell')
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(findRandom).toHaveBeenCalledTimes(1);
  });

  it('returns cached value for canonical and alias equipment filters', async () => {
    findRandom.mockResolvedValue({
      id: 'w-cache-db',
      title: 'DB Cache',
      timeCapSeconds: 300,
      equipment: JSON.stringify(['dumbbell']),
      data: JSON.stringify({ rounds: [5] }),
      isPublished: true
    });

    const first = await GET(
      new Request('https://example.com/api/workouts/random?equipment=dumbbells')
    );
    const second = await GET(
      new Request('https://example.com/api/workouts/random?equipment=dumbbell')
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(findRandom).toHaveBeenCalledTimes(1);
  });

  it('skips memory cache when exclude filters are present', async () => {
    findRandom.mockResolvedValue({
      id: 'w-skip-cache',
      title: 'Skip Cache',
      timeCapSeconds: 300,
      equipment: JSON.stringify(['barbell']),
      data: JSON.stringify({ rounds: [5] }),
      isPublished: true
    });

    const first = await GET(
      new Request('https://example.com/api/workouts/random?exclude=w2,w1')
    );
    const second = await GET(
      new Request('https://example.com/api/workouts/random?exclude=w2,w1')
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(findRandom).toHaveBeenCalledTimes(2);
    expect(first.headers.get('cache-control')).toBe('private, no-store');
  });

  it('returns 400 for invalid timeCapMax', async () => {
    const response = await GET(
      new Request('https://example.com/api/workouts/random?timeCapMax=abc')
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'timeCapMax must be a positive integer'
      }
    });
  });

  it('blocks known suspicious user agents', async () => {
    const response = await GET(
      new Request('https://example.com/api/workouts/random', {
        headers: {
          'user-agent': 'sqlmap/1.0'
        }
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: 'BOT_BLOCKED',
        message: 'Request blocked by abuse protections'
      }
    });
    expect(findRandom).not.toHaveBeenCalled();
  });
});
