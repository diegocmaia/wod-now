import { afterEach, describe, expect, it, vi } from 'vitest';

const getDbModule = async () => import('../../src/lib/db.js');

const clearGlobalPrisma = () => {
  const globalForPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  delete globalForPrisma.prisma;
};

afterEach(() => {
  clearGlobalPrisma();
  vi.resetModules();
  delete process.env.NODE_ENV;
});

describe('Prisma client singleton', () => {
  it('reuses a single client across reloads in development', async () => {
    process.env.NODE_ENV = 'development';

    const firstModule = await getDbModule();
    const firstDb = firstModule.db;

    vi.resetModules();

    const secondModule = await getDbModule();

    expect(secondModule.db).toBe(firstDb);
  });

  it('does not persist client globally in production', async () => {
    process.env.NODE_ENV = 'production';

    const firstModule = await getDbModule();
    const firstDb = firstModule.db;

    vi.resetModules();

    const secondModule = await getDbModule();

    expect(secondModule.db).not.toBe(firstDb);
  });
});
