import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('prisma/schema.prisma', 'utf8');

describe('Workout Prisma model', () => {
  it('includes all required fields', () => {
    expect(schema).toContain('model Workout');
    expect(schema).toContain('id             String  @id @default(cuid())');
    expect(schema).toContain('title          String');
    expect(schema).toContain('timeCapSeconds Int');
    expect(schema).toContain('equipment      String');
    expect(schema).toContain('data           String');
    expect(schema).toContain('isPublished    Boolean @default(false)');
  });
});
