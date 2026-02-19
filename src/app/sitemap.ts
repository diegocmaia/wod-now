import type { MetadataRoute } from 'next';

import { db } from '../lib/db.js';
import { getSiteUrl } from '../lib/seo.js';

export const revalidate = 3600;
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const baseEntries: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      changeFrequency: 'daily',
      priority: 1
    }
  ];

  const workouts = await db.workout.findMany({
    where: { isPublished: true },
    select: { id: true }
  });

  const workoutEntries: MetadataRoute.Sitemap = workouts.map((workout) => ({
    url: `${siteUrl}/wod/${workout.id}`,
    changeFrequency: 'daily',
    priority: 0.8
  }));

  return [...baseEntries, ...workoutEntries];
}
