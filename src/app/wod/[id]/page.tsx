import { WorkoutRenderer } from '../../../components/workout-renderer';
import { parseWorkoutView } from '../../../lib/workout-view';
import { db } from '../../../lib/db.js';
import { toWorkoutResponse, workoutApiSelect } from '../../api/workouts/contracts.js';

type WorkoutPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const getPublishedWorkout = async (id: string) => {
  const workout = await db.workout.findFirst({
    where: {
      id,
      isPublished: true
    },
    select: workoutApiSelect
  });

  if (!workout) {
    return null;
  }

  const response = toWorkoutResponse(workout);
  if (!response) {
    return null;
  }

  return parseWorkoutView(response);
};

export default async function WorkoutByIdPage({ params }: WorkoutPageProps) {
  const resolvedParams = await params;
  const workout = await getPublishedWorkout(resolvedParams.id);

  return (
    <main className="page">
      <section className="controls">
        <h1>Shared WOD</h1>
        <p className="muted">Shareable workout page rendered on the server.</p>
        <p>
          <a href="/" className="link-back">Back to random WOD</a>
        </p>
      </section>

      <section className="result">
        {workout ? (
          <WorkoutRenderer workout={workout} />
        ) : (
          <article className="workout-card">
            <h2>Workout unavailable</h2>
            <p className="muted">
              Workout
              {' '}
              <code>{resolvedParams.id}</code>
              {' '}
              was not found or is not published.
            </p>
          </article>
        )}
      </section>
    </main>
  );
}
