import { afterEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({
  findMany: vi.fn()
}));

vi.mock('../../src/lib/db.js', () => ({
  db: {
    workout: {
      findMany
    }
  }
}));

import { GET } from '../../src/app/api/workouts/random/route.js';

afterEach(() => {
  vi.restoreAllMocks();
  findMany.mockReset();
});

describe('GET /api/workouts/random', () => {
  it('returns 404 when no candidate workout exists', async () => {
    findMany.mockResolvedValue([]);

    const response = await GET(new Request('https://example.com/api/workouts/random'));

    expect(response.status).toBe(404);
  });

  it('applies timeCapMax and exclude filters to db query', async () => {
    findMany.mockResolvedValue([
      {
        id: 'w2',
        title: 'Helen',
        timeCapSeconds: 540,
        equipment: JSON.stringify(['barbell']),
        data: JSON.stringify({ reps: 1 }),
        isPublished: true
      }
    ]);

    const response = await GET(
      new Request('https://example.com/api/workouts/random?timeCapMax=600&exclude=w1,w3')
    );

    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith({
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

  it('applies equipment subset filtering and random selection', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

    findMany.mockResolvedValue([
      {
        id: 'w1',
        title: 'No Pull-Up Bar',
        timeCapSeconds: 500,
        equipment: JSON.stringify(['barbell']),
        data: JSON.stringify({}),
        isPublished: true
      },
      {
        id: 'w2',
        title: 'Fran',
        timeCapSeconds: 480,
        equipment: JSON.stringify(['barbell', 'pull-up bar']),
        data: JSON.stringify({ rounds: [21, 15, 9] }),
        isPublished: true
      },
      {
        id: 'w3',
        title: 'DT',
        timeCapSeconds: 720,
        equipment: JSON.stringify(['barbell', 'pull-up bar']),
        data: JSON.stringify({ rounds: [12, 9, 6] }),
        isPublished: true
      }
    ]);

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
  });

  it('returns 400 for invalid timeCapMax', async () => {
    const response = await GET(
      new Request('https://example.com/api/workouts/random?timeCapMax=abc')
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'timeCapMax must be a positive integer'
    });
  });
});
