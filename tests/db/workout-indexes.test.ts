import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

const executeSqlScript = async (prisma: PrismaClient, scriptPath: string) => {
  const sql = readFileSync(scriptPath, 'utf8');

  for (const statement of sql.split(';')) {
    const trimmed = statement.trim();
    if (!trimmed) continue;
    await prisma.$executeRawUnsafe(`${trimmed};`);
  }
};

const dbPath = join('/tmp', `wod-now-index-${randomUUID()}.db`);
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`
    }
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Workout indexes', () => {
  it('includes index migration for isPublished and id', () => {
    const migrationSql = readFileSync(
      'prisma/migrations/20260207133000_add_workout_indexes/migration.sql',
      'utf8'
    );

    expect(migrationSql).toContain('idx_workouts_is_published');
    expect(migrationSql).toContain('idx_workouts_id_lookup');
  });

  it('uses indexes in query plans for published and id filters', async () => {
    await executeSqlScript(
      prisma,
      'prisma/migrations/20260207131500_init_workout/migration.sql'
    );
    await executeSqlScript(
      prisma,
      'prisma/migrations/20260207133000_add_workout_indexes/migration.sql'
    );

    const publishedPlan = (await prisma.$queryRawUnsafe(
      'EXPLAIN QUERY PLAN SELECT * FROM "Workout" WHERE "isPublished" = 1'
    )) as Array<{ detail: string }>;

    const idPlan = (await prisma.$queryRawUnsafe(
      'EXPLAIN QUERY PLAN SELECT * FROM "Workout" WHERE "id" = ?1',
      'workout_1'
    )) as Array<{ detail: string }>;

    expect(publishedPlan.some((row) => row.detail.includes('idx_workouts_is_published'))).toBe(true);
    expect(idPlan.some((row) => row.detail.includes('INDEX'))).toBe(true);
  });
});
