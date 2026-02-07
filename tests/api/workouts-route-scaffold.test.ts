import { describe, expect, it, vi } from 'vitest';

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
  it('uses db singleton and returns count payload', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 3 });
    expect(count).toHaveBeenCalledWith({});
  });
});
