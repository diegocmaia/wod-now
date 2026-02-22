import { afterEach, describe, expect, it, vi } from 'vitest';

const getDbModule = async () => import('../../src/lib/db.js');

const clearGlobalDb = () => {
  const globalForDb = globalThis as typeof globalThis & {
    db: unknown;
    dbPool: { end?: () => Promise<void> } | undefined;
    dbDataSource: unknown;
    parquetWorkouts: unknown;
    parquetWorkoutsPromise: unknown;
  };

  globalForDb.db = undefined;

  if (globalForDb.dbPool?.end) {
    void globalForDb.dbPool.end();
  }
  globalForDb.dbPool = undefined;
  globalForDb.dbDataSource = undefined;
  globalForDb.parquetWorkouts = undefined;
  globalForDb.parquetWorkoutsPromise = undefined;
};

afterEach(() => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  clearGlobalDb();
  vi.resetModules();
  mutableEnv.NODE_ENV = undefined;
});

describe('DB client singleton', () => {
  it('reuses a single client across reloads in development', async () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.NODE_ENV = 'development';

    const firstModule = await getDbModule();
    const firstDb = firstModule.db;

    vi.resetModules();

    const secondModule = await getDbModule();

    expect(secondModule.db).toBe(firstDb);
  });

  it('does not persist client globally in production', async () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.NODE_ENV = 'production';

    const firstModule = await getDbModule();
    const firstDb = firstModule.db;

    vi.resetModules();

    const secondModule = await getDbModule();

    expect(secondModule.db).not.toBe(firstDb);
  });
});
