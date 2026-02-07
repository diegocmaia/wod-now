import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1, 'Must not be empty');

export const workoutMovementSchema = z
  .object({
    name: nonEmptyString,
    reps: z.number().int().positive().optional(),
    calories: z.number().int().positive().optional(),
    distanceMeters: z.number().int().positive().optional(),
    load: nonEmptyString.optional(),
    notes: nonEmptyString.optional()
  })
  .strict()
  .refine(
    (movement) =>
      movement.reps !== undefined ||
      movement.calories !== undefined ||
      movement.distanceMeters !== undefined ||
      movement.load !== undefined,
    {
      message:
        'Movement must define at least one of reps, calories, distanceMeters, or load',
      path: ['reps']
    }
  );

export const workoutBlockSchema = z
  .object({
    name: nonEmptyString,
    duration: z.union([z.number().int().positive(), z.literal('remaining')]).optional(),
    movements: z.array(workoutMovementSchema).min(1, 'Block must include at least one movement'),
    notes: nonEmptyString.optional()
  })
  .strict();

export const workoutSchema = z
  .object({
    id: nonEmptyString,
    title: nonEmptyString,
    timeCapSeconds: z.number().int().positive().optional(),
    equipment: z.array(nonEmptyString).default([]),
    blocks: z.array(workoutBlockSchema).min(1, 'Workout must include at least one block'),
    notes: z
      .object({
        coach: nonEmptyString.optional(),
        scaling: nonEmptyString.optional()
      })
      .strict()
      .optional(),
    isPublished: z.boolean().default(false)
  })
  .strict()
  .superRefine((workout, ctx) => {
    const hasRemainingBlock = workout.blocks.some(
      (block) => block.duration === 'remaining'
    );

    if (hasRemainingBlock && workout.timeCapSeconds === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['timeCapSeconds'],
        message:
          'timeCapSeconds is required when any block uses duration=\"remaining\"'
      });
    }
  });

export type WorkoutInput = z.input<typeof workoutSchema>;
export type Workout = z.output<typeof workoutSchema>;

export const parseWorkout = (payload: unknown): Workout => {
  return workoutSchema.parse(payload);
};

export const safeParseWorkout = (payload: unknown) => {
  return workoutSchema.safeParse(payload);
};
