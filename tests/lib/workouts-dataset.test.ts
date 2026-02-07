import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { safeParseWorkout } from '../../src/lib/workout-schema.js';

type WorkoutDataset = unknown[];

const loadDataset = (): WorkoutDataset => {
  const raw = readFileSync('prisma/seed/workouts.json', 'utf8');
  return JSON.parse(raw) as WorkoutDataset;
};

describe('curated workouts seed dataset', () => {
  it('contains at least 50 schema-valid workouts with unique ids', () => {
    const dataset = loadDataset();

    expect(Array.isArray(dataset)).toBe(true);
    expect(dataset.length).toBeGreaterThanOrEqual(50);

    const ids = new Set<string>();
    for (const [index, workout] of dataset.entries()) {
      const parsed = safeParseWorkout(workout);
      expect(parsed.success, `invalid workout at index ${index}`).toBe(true);
      if (!parsed.success) {
        continue;
      }

      expect(parsed.data.timeCapSeconds, `missing timeCapSeconds for ${parsed.data.id}`).toBeDefined();
      expect(parsed.data.equipment, `missing equipment for ${parsed.data.id}`).toBeDefined();
      expect(ids.has(parsed.data.id), `duplicate id ${parsed.data.id}`).toBe(false);
      ids.add(parsed.data.id);
    }
  });
});
