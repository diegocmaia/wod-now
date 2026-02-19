import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { attachDatabasePool, query } = vi.hoisted(() => ({
  attachDatabasePool: vi.fn(),
  query: vi.fn()
}));

vi.mock('@vercel/functions', () => ({
  attachDatabasePool
}));

vi.mock('@vercel/functions/oidc', () => ({
  awsCredentialsProvider: vi.fn()
}));

vi.mock('@aws-sdk/rds-signer', () => ({
  Signer: class {
    async getAuthToken(): Promise<string> {
      return 'token';
    }
  }
}));

vi.mock('pg', () => ({
  Pool: class {
    query = query;
  }
}));

const clearGlobalDbState = () => {
  const globalForDb = globalThis as typeof globalThis & {
    db: unknown;
    dbPool: unknown;
  };

  globalForDb.db = undefined;
  globalForDb.dbPool = undefined;
};

const loadDb = async () => import('../../src/lib/db.js');

beforeEach(() => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  mutableEnv.DATABASE_URL = 'postgres://local/test';
  mutableEnv.NODE_ENV = 'test';
});

afterEach(() => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  query.mockReset();
  attachDatabasePool.mockReset();
  clearGlobalDbState();
  delete mutableEnv.DATABASE_URL;
  delete mutableEnv.NODE_ENV;
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('Workout random query strategy', () => {
  it('uses count plus offset lookup instead of ORDER BY random()', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ count: 3 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'w2'
          }
        ]
      });

    vi.spyOn(Math, 'random').mockReturnValue(0.66);

    const { db } = await loadDb();
    const workout = await db.workout.findRandom({
      where: {
        isPublished: true
      },
      select: {
        id: true
      }
    });

    expect(workout).toEqual({ id: 'w2' });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain('SELECT COUNT(*)::int AS count');
    expect(query.mock.calls[0]?.[1]).toEqual([true]);
    expect(query.mock.calls[1]?.[0]).toContain('ORDER BY "id" OFFSET $2 LIMIT 1');
    expect(query.mock.calls[1]?.[0]).not.toContain('ORDER BY random()');
    expect(query.mock.calls[1]?.[1]).toEqual([true, 1]);
  });

  it('returns null without lookup query when count is zero', async () => {
    query.mockResolvedValueOnce({ rows: [{ count: 0 }] });

    const { db } = await loadDb();
    const workout = await db.workout.findRandom({
      where: {
        isPublished: true
      },
      select: {
        id: true
      }
    });

    expect(workout).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
