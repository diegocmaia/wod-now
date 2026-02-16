import { attachDatabasePool } from '@vercel/functions';
import { awsCredentialsProvider } from '@vercel/functions/oidc';
import { Signer } from '@aws-sdk/rds-signer';
import { Pool } from 'pg';

export type WorkoutRecord = {
  id: string;
  title: string;
  timeCapSeconds: number;
  equipment: string;
  data: string;
  isPublished: boolean;
};

type WorkoutSelect = Partial<Record<keyof WorkoutRecord, boolean>>;

type WorkoutWhereInput = {
  id?: string | { notIn: string[] };
  isPublished?: boolean;
  timeCapSeconds?: { lte: number };
};

type WorkoutFindManyArgs = {
  where?: WorkoutWhereInput;
  select?: WorkoutSelect;
};

type WorkoutFindFirstArgs = {
  where?: WorkoutWhereInput;
  select?: WorkoutSelect;
};

type WorkoutCountArgs = {
  where?: WorkoutWhereInput;
};

type WorkoutUpsertArgs = {
  where: { id: string };
  create: WorkoutRecord;
  update: Partial<WorkoutRecord>;
  select?: WorkoutSelect;
};

type DbClient = {
  workout: {
    findMany: (args: WorkoutFindManyArgs) => Promise<WorkoutRecord[]>;
    findFirst: (args: WorkoutFindFirstArgs) => Promise<WorkoutRecord | null>;
    count: (args: WorkoutCountArgs) => Promise<number>;
    upsert: (args: WorkoutUpsertArgs) => Promise<WorkoutRecord>;
  };
};

type GlobalWithDb = typeof globalThis & {
  db?: DbClient;
  dbPool?: Pool;
};

const globalForDb = globalThis as GlobalWithDb;

const workoutColumns: ReadonlyArray<keyof WorkoutRecord> = [
  'id',
  'title',
  'timeCapSeconds',
  'equipment',
  'data',
  'isPublished'
];

const requiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const resolveSelect = (select?: WorkoutSelect): ReadonlyArray<keyof WorkoutRecord> => {
  if (!select) {
    return workoutColumns;
  }

  const selected = workoutColumns.filter((column) => select[column]);
  if (selected.length === 0) {
    return ['id'];
  }

  return selected;
};

const columnSql = (columns: ReadonlyArray<keyof WorkoutRecord>): string =>
  columns.map((column) => `"${column}"`).join(', ');

const buildWhereSql = (
  where: WorkoutWhereInput | undefined,
  startAt = 1
): { clause: string; values: unknown[] } => {
  if (!where) {
    return { clause: '', values: [] };
  }

  const clauses: string[] = [];
  const values: unknown[] = [];
  let index = startAt;

  if (typeof where.id === 'string') {
    clauses.push(`"id" = $${index}`);
    values.push(where.id);
    index += 1;
  } else if (where.id?.notIn && where.id.notIn.length > 0) {
    clauses.push(`NOT ("id" = ANY($${index}::text[]))`);
    values.push(where.id.notIn);
    index += 1;
  }

  if (where.isPublished !== undefined) {
    clauses.push(`"isPublished" = $${index}`);
    values.push(where.isPublished);
    index += 1;
  }

  if (where.timeCapSeconds?.lte !== undefined) {
    clauses.push(`"timeCapSeconds" <= $${index}`);
    values.push(where.timeCapSeconds.lte);
    index += 1;
  }

  if (clauses.length === 0) {
    return { clause: '', values };
  }

  return {
    clause: `WHERE ${clauses.join(' AND ')}`,
    values
  };
};

const createIamPasswordResolver = () => {
  const region = requiredEnv('AWS_REGION');
  const signer = new Signer({
    hostname: requiredEnv('PGHOST'),
    port: Number(requiredEnv('PGPORT')),
    username: requiredEnv('PGUSER'),
    region,
    ...(process.env.AWS_ROLE_ARN
      ? {
          credentials: awsCredentialsProvider({
            roleArn: process.env.AWS_ROLE_ARN,
            clientConfig: { region }
          })
        }
      : {})
  });

  let cachedToken: { value: string; expiresAtMs: number } | null = null;

  return async (): Promise<string> => {
    const now = Date.now();
    if (cachedToken && now < cachedToken.expiresAtMs) {
      return cachedToken.value;
    }

    const value = await signer.getAuthToken();
    cachedToken = {
      value,
      expiresAtMs: now + 14 * 60 * 1000
    };

    return value;
  };
};

const createPool = (): Pool => {
  const connectionString = process.env.DATABASE_URL;
  const sslMode = process.env.PGSSLMODE ?? 'require';
  const ssl =
    sslMode === 'disable'
      ? false
      : {
          rejectUnauthorized: false
        };

  const pool = connectionString
    ? new Pool({ connectionString, ssl })
    : new Pool({
        host: requiredEnv('PGHOST'),
        port: Number(requiredEnv('PGPORT')),
        user: requiredEnv('PGUSER'),
        database: requiredEnv('PGDATABASE'),
        password: process.env.PGPASSWORD ?? createIamPasswordResolver(),
        ssl,
        max: Number(process.env.PGPOOL_MAX ?? 20)
      });

  attachDatabasePool(pool);
  return pool;
};

const getPool = (): Pool => {
  if (process.env.NODE_ENV !== 'production') {
    if (!globalForDb.dbPool) {
      globalForDb.dbPool = createPool();
    }
    return globalForDb.dbPool;
  }

  return createPool();
};

const createDbClient = (): DbClient => ({
  workout: {
    findMany: async ({ where, select }: WorkoutFindManyArgs): Promise<WorkoutRecord[]> => {
      const columns = resolveSelect(select);
      const whereQuery = buildWhereSql(where);
      const sql = `SELECT ${columnSql(columns)} FROM "Workout" ${whereQuery.clause}`;
      const result = await getPool().query(sql, whereQuery.values);
      return result.rows as WorkoutRecord[];
    },
    findFirst: async ({ where, select }: WorkoutFindFirstArgs): Promise<WorkoutRecord | null> => {
      const columns = resolveSelect(select);
      const whereQuery = buildWhereSql(where);
      const sql = `SELECT ${columnSql(columns)} FROM "Workout" ${whereQuery.clause} LIMIT 1`;
      const result = await getPool().query(sql, whereQuery.values);
      return (result.rows[0] as WorkoutRecord | undefined) ?? null;
    },
    count: async ({ where }: WorkoutCountArgs): Promise<number> => {
      const whereQuery = buildWhereSql(where);
      const sql = `SELECT COUNT(*)::int AS count FROM "Workout" ${whereQuery.clause}`;
      const result = await getPool().query<{ count: number }>(sql, whereQuery.values);
      return result.rows[0]?.count ?? 0;
    },
    upsert: async ({ where, create, update, select }: WorkoutUpsertArgs): Promise<WorkoutRecord> => {
      const columns = resolveSelect(select);
      const sql = `
        INSERT INTO "Workout" ("id", "title", "timeCapSeconds", "equipment", "data", "isPublished")
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT ("id") DO UPDATE SET
          "title" = $7,
          "timeCapSeconds" = $8,
          "equipment" = $9,
          "data" = $10,
          "isPublished" = $11
        RETURNING ${columnSql(columns)}
      `;

      const values = [
        where.id,
        create.title,
        create.timeCapSeconds,
        create.equipment,
        create.data,
        create.isPublished,
        update.title ?? create.title,
        update.timeCapSeconds ?? create.timeCapSeconds,
        update.equipment ?? create.equipment,
        update.data ?? create.data,
        update.isPublished ?? create.isPublished
      ];

      const result = await getPool().query(sql, values);
      return result.rows[0] as WorkoutRecord;
    }
  }
});

const singletonDb = globalForDb.db ?? createDbClient();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = singletonDb;
}

export const db = singletonDb;
