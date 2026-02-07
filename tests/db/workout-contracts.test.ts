import { describe, expect, it } from 'vitest';

import { workoutApiSelect } from '../../src/app/api/workouts/contracts.js';

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
});
