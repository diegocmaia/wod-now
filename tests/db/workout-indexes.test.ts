import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Workout indexes', () => {
  it('includes index migration for isPublished and id', () => {
    const migrationSql = readFileSync(
      'prisma/migrations/20260207133000_add_workout_indexes/migration.sql',
      'utf8'
    );

    expect(migrationSql).toContain('idx_workouts_is_published');
    expect(migrationSql).toContain('idx_workouts_id_lookup');
  });

  it('defines Postgres-compatible table and index SQL', () => {
    const initSql = readFileSync(
      'prisma/migrations/20260207131500_init_workout/migration.sql',
      'utf8'
    );
    const indexSql = readFileSync(
      'prisma/migrations/20260207133000_add_workout_indexes/migration.sql',
      'utf8'
    );

    expect(initSql).toContain('CREATE TABLE "Workout"');
    expect(initSql).toContain('"id" TEXT NOT NULL PRIMARY KEY');
    expect(initSql).toContain('"isPublished" BOOLEAN NOT NULL DEFAULT false');
    expect(indexSql).toContain(
      'CREATE INDEX "idx_workouts_is_published" ON "Workout"("isPublished")'
    );
    expect(indexSql).toContain('CREATE INDEX "idx_workouts_id_lookup" ON "Workout"("id")');
  });
});
