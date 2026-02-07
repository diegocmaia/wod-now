import { describe, expect, it } from 'vitest';

import {
  toWorkoutResponse,
  workoutApiSelect
} from '../../src/app/api/workouts/contracts.js';

describe('Workout API contracts', () => {
  it('select shape exposes required API fields', () => {
    expect(workoutApiSelect).toEqual({
      id: true,
      title: true,
      timeCapSeconds: true,
      equipment: true,
      data: true,
      isPublished: true
    });
  });

  it('maps persisted JSON strings to typed API response payload', () => {
    const mapped = toWorkoutResponse({
      id: 'w1',
      title: 'Fran',
      timeCapSeconds: 480,
      equipment: JSON.stringify(['barbell', 'pull-up bar']),
      data: JSON.stringify({ rounds: 21 }),
      isPublished: true
    });

    expect(mapped).toEqual({
      id: 'w1',
      title: 'Fran',
      timeCapSeconds: 480,
      equipment: ['barbell', 'pull-up bar'],
      data: { rounds: 21 }
    });
  });
});
