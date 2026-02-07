import { Prisma } from '@prisma/client';

export const workoutApiSelect = Prisma.validator<Prisma.WorkoutSelect>()({
  id: true,
  title: true,
  timeCapSeconds: true,
  equipment: true,
  data: true,
  isPublished: true
});

export type WorkoutApiRecord = Prisma.WorkoutGetPayload<{
  select: typeof workoutApiSelect;
}>;
