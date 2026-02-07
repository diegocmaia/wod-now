import { describe, expect, it } from 'vitest';

import {
  parseWorkout,
  safeParseWorkout,
  workoutBlockSchema,
  workoutMovementSchema,
  workoutSchema
} from '../../src/lib/workout-schema.js';

const validWorkout = {
  id: 'wod-001',
  title: 'Fran',
  timeCapSeconds: 480,
  equipment: ['barbell', 'pull-up bar'],
  blocks: [
    {
      name: 'Main Piece',
      duration: 480,
      movements: [
        {
          name: 'Thruster',
          reps: 45,
          load: '95/65 lb'
        },
        {
          name: 'Pull-up',
          reps: 45
        }
      ]
    }
  ],
  notes: {
    scaling: 'Use lighter barbell load as needed'
  },
  isPublished: true
};

describe('workout movement schema', () => {
  it('accepts movement-level repScheme and structured loads', () => {
    const result = workoutMovementSchema.safeParse({
      name: 'Thruster',
      repScheme: [21, 15, 9],
      loads: {
        female: '65 lb',
        male: '95 lb'
      }
    });

    expect(result.success).toBe(true);
  });
});

describe('workout block schema', () => {
  it('accepts remaining duration blocks', () => {
    const result = workoutBlockSchema.safeParse({
      name: 'Cash Out',
      duration: 'remaining',
      movements: [
        {
          name: 'Burpee',
          reps: 50
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it('accepts block-level repScheme as fallback prescription', () => {
    const result = workoutBlockSchema.safeParse({
      name: 'For Time',
      repScheme: [21, 15, 9],
      movements: [{ name: 'Pull-up' }]
    });

    expect(result.success).toBe(true);
  });

  it('rejects movement without prescription when no repScheme exists at block level', () => {
    const result = workoutBlockSchema.safeParse({
      name: 'For Time',
      movements: [{ name: 'Pull-up' }]
    });

    expect(result.success).toBe(false);
  });
});

describe('workout schema', () => {
  it('parses a valid workout payload', () => {
    expect(parseWorkout(validWorkout)).toEqual(validWorkout);
  });

  it('supports optional fields: timeCapSeconds and notes.scaling', () => {
    const withoutOptionalFields = {
      id: 'wod-002',
      title: 'Untimed Skill Work',
      equipment: [],
      blocks: [
        {
          name: 'EMOM',
          movements: [
            {
              name: 'Strict Pull-up',
              reps: 3
            }
          ]
        }
      ],
      notes: {
        scaling: 'Use banded pull-ups'
      }
    };

    const parsed = parseWorkout(withoutOptionalFields);

    expect(parsed.timeCapSeconds).toBeUndefined();
    expect(parsed.notes?.scaling).toBe('Use banded pull-ups');
    expect(parsed.isPublished).toBe(false);
  });

  it('requires timeCapSeconds when any block duration is remaining', () => {
    const result = safeParseWorkout({
      id: 'wod-003',
      title: 'For Time',
      equipment: ['dumbbell'],
      blocks: [
        {
          name: 'Main Piece',
          duration: 'remaining',
          movements: [
            {
              name: 'DB Snatch',
              reps: 30
            }
          ]
        }
      ],
      isPublished: false
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['timeCapSeconds'],
            message:
              'timeCapSeconds is required when any block uses duration="remaining"'
          })
        ])
      );
    }
  });

  it('rejects invalid top-level payloads', () => {
    const result = safeParseWorkout({
      id: '',
      title: 'Broken Payload',
      blocks: []
    });

    expect(result.success).toBe(false);
  });

  it('is strict about unknown fields', () => {
    const result = workoutSchema.safeParse({
      ...validWorkout,
      unexpected: true
    });

    expect(result.success).toBe(false);
  });
});
