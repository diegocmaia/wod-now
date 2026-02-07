import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1, 'Must not be empty');

const movementLoadsSchema = z
  .object({
    female: nonEmptyString.optional(),
    male: nonEmptyString.optional()
  })
  .strict()
  .refine((loads) => loads.female !== undefined || loads.male !== undefined, {
    message: 'loads must define at least one of female or male',
    path: ['female']
  });

export const workoutMovementSchema = z
  .object({
    name: nonEmptyString,
    reps: z.number().int().positive().optional(),
    repScheme: z.array(z.number().int().positive()).min(1).optional(),
    calories: z.number().int().positive().optional(),
    distanceMeters: z.number().int().positive().optional(),
    load: nonEmptyString.optional(),
    loads: movementLoadsSchema.optional(),
    notes: nonEmptyString.optional()
  })
  .strict();

export const workoutBlockSchema = z
  .object({
    name: nonEmptyString,
    duration: z.union([z.number().int().positive(), z.literal('remaining')]).optional(),
    repScheme: z.array(z.number().int().positive()).min(1).optional(),
    movements: z.array(workoutMovementSchema).min(1, 'Block must include at least one movement'),
    notes: nonEmptyString.optional()
  })
  .strict()
  .superRefine((block, ctx) => {
    const hasRepScheme = block.repScheme !== undefined;

    block.movements.forEach((movement, index) => {
      const hasMovementPrescription =
        movement.reps !== undefined ||
        movement.repScheme !== undefined ||
        movement.calories !== undefined ||
        movement.distanceMeters !== undefined ||
        movement.load !== undefined ||
        movement.loads !== undefined;

      if (!hasRepScheme && !hasMovementPrescription) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['movements', index, 'reps'],
          message:
            'Movement must define at least one of reps, repScheme, calories, distanceMeters, load, loads, or block repScheme'
        });
      }
    });
  });

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
