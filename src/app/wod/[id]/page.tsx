import type { Metadata } from 'next';
import { cache } from 'react';

import { WorkoutPageAnalytics } from '../../../components/workout-page-analytics';
import { WorkoutRenderer } from '../../../components/workout-renderer';
import { parseWorkoutView } from '../../../lib/workout-view';
import { db } from '../../../lib/db.js';
import { toWorkoutResponse, workoutApiSelect } from '../../api/workouts/contracts.js';

type WorkoutPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const getPublishedWorkout = cache(async (id: string) => {
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

  const view = parseWorkoutView(response);
  if (!view) {
    return null;
  }

  return {
    response,
    view
  };
});

export async function generateMetadata({ params }: WorkoutPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const workout = await getPublishedWorkout(resolvedParams.id);

  if (!workout) {
    return {
      title: 'Workout Unavailable',
      description: `Workout ${resolvedParams.id} was not found or is not published.`,
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const canonicalPath = `/wod/${workout.response.id}`;
  const equipmentSummary =
    workout.response.equipment.length > 0
      ? `Equipment: ${workout.response.equipment.join(', ')}.`
      : 'No equipment required.';
  const description = `${workout.response.title}. ${equipmentSummary} Time cap: ${workout.response.timeCapSeconds} seconds.`;

  return {
    title: workout.response.title,
    description,
    alternates: {
      canonical: canonicalPath
    },
    openGraph: {
      type: 'article',
      url: canonicalPath,
      title: workout.response.title,
      description,
      images: [
        {
          url: '/opengraph-image',
          width: 1200,
          height: 630,
          alt: `${workout.response.title} preview image`
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: workout.response.title,
      description,
      images: ['/twitter-image']
    }
  };
}

export default async function WorkoutByIdPage({ params }: WorkoutPageProps) {
  const resolvedParams = await params;
  const workout = await getPublishedWorkout(resolvedParams.id);

  return (
    <main className="page">
      <WorkoutPageAnalytics found={Boolean(workout)} />
      <section className="controls">
        <h1>Shared WOD</h1>
        <p className="muted">Shareable workout page rendered on the server.</p>
        <p>
          <a href="/" className="link-back">Back to random WOD</a>
        </p>
      </section>

      <section className="result">
        {workout ? (
          <WorkoutRenderer workout={workout.view} />
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
