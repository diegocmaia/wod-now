import { Pool } from 'pg';

const parsePositiveInt = (rawValue, fallback) => {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return value;
};

const rows = parsePositiveInt(process.env.BENCHMARK_ROWS, 200000);
const iterations = parsePositiveInt(process.env.BENCHMARK_ITERATIONS, 250);
const timeCapMax = parsePositiveInt(process.env.BENCHMARK_TIMECAP_MAX, 900);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for benchmark script');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const measureMs = async (fn) => {
  const start = process.hrtime.bigint();
  await fn();
  const durationNs = process.hrtime.bigint() - start;
  return Number(durationNs) / 1_000_000;
};

const percentile = (values, target) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(target * sorted.length) - 1);
  return sorted[index];
};

const run = async () => {
  const client = await pool.connect();

  try {
    console.log(`Preparing temporary dataset (${rows} rows)...`);

    await client.query('DROP TABLE IF EXISTS "WorkoutBench"');
    await client.query(`
      CREATE TEMP TABLE "WorkoutBench" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "timeCapSeconds" INTEGER NOT NULL,
        "equipment" TEXT NOT NULL,
        "data" TEXT NOT NULL,
        "isPublished" BOOLEAN NOT NULL
      )
    `);

    await client.query(
      `
        INSERT INTO "WorkoutBench" ("id", "title", "timeCapSeconds", "equipment", "data", "isPublished")
        SELECT
          'bench-' || g::text,
          'Workout ' || g::text,
          60 + floor(random() * 1740)::int,
          CASE
            WHEN g % 4 = 0 THEN '["barbell","pull-up bar"]'
            WHEN g % 4 = 1 THEN '["dumbbells","kettlebell"]'
            WHEN g % 4 = 2 THEN '["none"]'
            ELSE '["bike","rower"]'
          END,
          json_build_object('seed', g)::text,
          true
        FROM generate_series(1, $1) AS g
      `,
      [rows]
    );

    await client.query(
      'CREATE INDEX "idx_workout_bench_is_published_id" ON "WorkoutBench"("isPublished", "id")'
    );
    await client.query(
      'CREATE INDEX "idx_workout_bench_is_published_timecap_id" ON "WorkoutBench"("isPublished", "timeCapSeconds", "id")'
    );
    await client.query('ANALYZE "WorkoutBench"');

    const legacyLatencies = [];
    const optimizedLatencies = [];

    const legacyQuery = async () => {
      await client.query(
        `
          SELECT "id"
          FROM "WorkoutBench"
          WHERE "isPublished" = true
            AND "timeCapSeconds" <= $1
          ORDER BY random()
          LIMIT 1
        `,
        [timeCapMax]
      );
    };

    const optimizedQuery = async () => {
      const countResult = await client.query(
        `
          SELECT COUNT(*)::int AS count
          FROM "WorkoutBench"
          WHERE "isPublished" = true
            AND "timeCapSeconds" <= $1
        `,
        [timeCapMax]
      );

      const count = countResult.rows[0]?.count ?? 0;
      if (count === 0) {
        return;
      }

      const randomOffset = Math.floor(Math.random() * count);
      await client.query(
        `
          SELECT "id"
          FROM "WorkoutBench"
          WHERE "isPublished" = true
            AND "timeCapSeconds" <= $1
          ORDER BY "id"
          OFFSET $2
          LIMIT 1
        `,
        [timeCapMax, randomOffset]
      );
    };

    for (let i = 0; i < iterations; i += 1) {
      legacyLatencies.push(await measureMs(legacyQuery));
      optimizedLatencies.push(await measureMs(optimizedQuery));
    }

    const explainLegacy = await client.query(
      `
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT "id"
        FROM "WorkoutBench"
        WHERE "isPublished" = true
          AND "timeCapSeconds" <= $1
        ORDER BY random()
        LIMIT 1
      `,
      [timeCapMax]
    );

    const explainCount = await client.query(
      `
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT COUNT(*)::int AS count
        FROM "WorkoutBench"
        WHERE "isPublished" = true
          AND "timeCapSeconds" <= $1
      `,
      [timeCapMax]
    );

    const fixedOffset = Math.floor(rows * 0.5);
    const explainSelect = await client.query(
      `
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT "id"
        FROM "WorkoutBench"
        WHERE "isPublished" = true
          AND "timeCapSeconds" <= $1
        ORDER BY "id"
        OFFSET $2
        LIMIT 1
      `,
      [timeCapMax, fixedOffset]
    );

    console.log('\nLatency summary (ms)');
    console.log(`legacy p50=${percentile(legacyLatencies, 0.5).toFixed(2)} p95=${percentile(legacyLatencies, 0.95).toFixed(2)} p99=${percentile(legacyLatencies, 0.99).toFixed(2)}`);
    console.log(`optimized p50=${percentile(optimizedLatencies, 0.5).toFixed(2)} p95=${percentile(optimizedLatencies, 0.95).toFixed(2)} p99=${percentile(optimizedLatencies, 0.99).toFixed(2)}`);

    console.log('\nQuery plan: legacy ORDER BY random()');
    console.log(explainLegacy.rows.map((row) => row['QUERY PLAN']).join('\n'));

    console.log('\nQuery plan: optimized COUNT(*)');
    console.log(explainCount.rows.map((row) => row['QUERY PLAN']).join('\n'));

    console.log('\nQuery plan: optimized ORDER BY id + OFFSET');
    console.log(explainSelect.rows.map((row) => row['QUERY PLAN']).join('\n'));
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
