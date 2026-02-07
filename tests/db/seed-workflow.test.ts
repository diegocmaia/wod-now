import { readFileSync } from 'node:fs';

import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  seedWorkouts,
  toPersistedWorkout,
  validateDataset
} from '../../prisma/seed.js';

describe('seed workflow', () => {
  it('validates curated dataset payload', () => {
    const raw = readFileSync('prisma/seed/workouts.json', 'utf8');
    const workouts = validateDataset(JSON.parse(raw));

    expect(workouts.length).toBeGreaterThanOrEqual(50);
  });

  it('rejects duplicate workout ids', () => {
    expect(() =>
      validateDataset([
        {
          id: 'dup-1',
          title: 'One',
          timeCapSeconds: 300,
          equipment: ['barbell'],
          blocks: [{ name: 'Main', duration: 300, movements: [{ name: 'Thruster', reps: 30 }] }],
          isPublished: false
        },
        {
          id: 'dup-1',
          title: 'Two',
          timeCapSeconds: 300,
          equipment: ['barbell'],
          blocks: [{ name: 'Main', duration: 300, movements: [{ name: 'Thruster', reps: 30 }] }],
          isPublished: false
        }
      ])
    ).toThrow('Duplicate workout id "dup-1"');
  });

  it('maps validated workouts to published persisted shape', () => {
    const persisted = toPersistedWorkout({
      id: 'w1',
      title: 'Fran',
      timeCapSeconds: 480,
      equipment: ['barbell', 'pull-up bar'],
      blocks: [{ name: 'Main', duration: 480, movements: [{ name: 'Thruster', reps: 45 }] }],
      notes: { scaling: 'Use lighter load' },
      isPublished: false
    });

    expect(persisted.isPublished).toBe(true);
    expect(JSON.parse(persisted.equipment)).toEqual(['barbell', 'pull-up bar']);
    expect(JSON.parse(persisted.data)).toEqual({
      blocks: [{ name: 'Main', duration: 480, movements: [{ name: 'Thruster', reps: 45 }] }],
      notes: { scaling: 'Use lighter load' }
    });
  });

  it('upserts by id, logs progress, and throws when any record fails', async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ id: 'ok-1' })
      .mockRejectedValueOnce(new Error('db unavailable'));

    const prisma = {
      workout: { upsert }
    } as unknown as PrismaClient;

    const logger = {
      info: vi.fn(),
      error: vi.fn()
    };

    const workouts = validateDataset([
      {
        id: 'ok-1',
        title: 'Ok 1',
        timeCapSeconds: 300,
        equipment: ['barbell'],
        blocks: [{ name: 'Main', duration: 300, movements: [{ name: 'Thruster', reps: 30 }] }],
        isPublished: false
      },
      {
        id: 'bad-1',
        title: 'Bad 1',
        timeCapSeconds: 300,
        equipment: ['barbell'],
        blocks: [{ name: 'Main', duration: 300, movements: [{ name: 'Thruster', reps: 30 }] }],
        isPublished: false
      }
    ]);

    await expect(seedWorkouts(prisma, workouts, logger)).rejects.toThrow(
      'Seed finished with 1 failure(s)'
    );

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'ok-1' },
        update: expect.objectContaining({ isPublished: true })
      })
    );
    expect(upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'bad-1' },
        update: expect.objectContaining({ isPublished: true })
      })
    );

    expect(logger.info).toHaveBeenCalledWith('[seed] starting upsert for 2 workout(s)');
    expect(logger.error).toHaveBeenCalledWith(
      '[seed] failed workout id=bad-1 error=db unavailable'
    );
    expect(logger.info).toHaveBeenCalledWith('[seed] complete success=1 failure=1');
  });
});
