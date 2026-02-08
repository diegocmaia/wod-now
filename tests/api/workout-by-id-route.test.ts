import { afterEach, describe, expect, it, vi } from 'vitest';

const { findFirst } = vi.hoisted(() => ({
  findFirst: vi.fn()
}));

vi.mock('../../src/lib/db.js', () => ({
  db: {
    workout: {
      findFirst
    }
  }
}));

import { GET } from '../../src/app/api/workouts/[id]/route.js';

afterEach(() => {
  findFirst.mockReset();
});

describe('GET /api/workouts/[id]', () => {
  it('returns published workout by id', async () => {
    findFirst.mockResolvedValue({
      id: 'w1',
      title: 'Fran',
      timeCapSeconds: 480,
      equipment: JSON.stringify(['barbell', 'pull-up bar']),
      data: JSON.stringify({ rounds: [21, 15, 9] }),
      isPublished: true
    });

    const response = await GET(new Request('https://example.com/api/workouts/w1'), {
      params: Promise.resolve({ id: 'w1' })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 'w1',
      title: 'Fran',
      timeCapSeconds: 480,
      equipment: ['barbell', 'pull-up bar'],
      data: { rounds: [21, 15, 9] }
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'w1',
        isPublished: true
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

  it('returns 404 for missing or unpublished workout', async () => {
    findFirst.mockResolvedValue(null);

    const response = await GET(new Request('https://example.com/api/workouts/missing'), {
      params: Promise.resolve({ id: 'missing' })
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Workout not found'
      }
    });
  });
});
