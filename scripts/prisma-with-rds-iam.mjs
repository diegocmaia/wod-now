import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { Signer } from '@aws-sdk/rds-signer';

const requiredPgVars = ['PGHOST', 'PGPORT', 'PGUSER'];

const stripWrappingQuotes = (value) => {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
};

const loadEnvFile = (filePath) => {
  try {
    const file = readFileSync(filePath, 'utf8');
    for (const rawLine of file.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const separator = line.indexOf('=');
      if (separator <= 0) continue;

      const key = line.slice(0, separator).trim();
      if (!key || process.env[key] !== undefined) continue;

      const rawValue = line.slice(separator + 1).trim();
      process.env[key] = stripWrappingQuotes(rawValue);
    }
  } catch {
    // Ignore missing env files.
  }
};

const runCommand = (command, args, env) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env
    });

    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });

const getMissingVars = (keys) => keys.filter((key) => !process.env[key]);

const buildConnectionUrl = (password) => {
  const user = encodeURIComponent(process.env.PGUSER);
  const pass = encodeURIComponent(password);
  const host = process.env.PGHOST;
  const port = process.env.PGPORT;
  const database = encodeURIComponent(process.env.PGDATABASE || 'postgres');
  const sslMode = process.env.PGSSLMODE || 'require';

  return `postgresql://${user}:${pass}@${host}:${port}/${database}?sslmode=${sslMode}&connect_timeout=15`;
};

const getPassword = async () => {
  if (process.env.PGPASSWORD) {
    return process.env.PGPASSWORD;
  }

  const missingForIam = getMissingVars(['AWS_REGION']);
  if (missingForIam.length > 0) {
    throw new Error(
      `Missing required env var(s) for IAM token auth: ${missingForIam.join(', ')}`
    );
  }

  const signer = new Signer({
    hostname: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    username: process.env.PGUSER,
    region: process.env.AWS_REGION
  });

  return signer.getAuthToken();
};

const main = async () => {
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));
  loadEnvFile(path.resolve(process.cwd(), '.env'));

  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    throw new Error('Usage: node scripts/prisma-with-rds-iam.mjs <command> [args...]');
  }

  const existingDatabaseUrl = process.env.DATABASE_URL;
  const existingDirectUrl = process.env.DIRECT_URL;
  if (existingDatabaseUrl && existingDirectUrl) {
    const exitCode = await runCommand(command, args, process.env);
    process.exit(exitCode);
  }

  const missingPg = getMissingVars(requiredPgVars);
  if (missingPg.length > 0) {
    throw new Error(
      `Missing required env var(s): ${missingPg.join(', ')}. Set DATABASE_URL/DIRECT_URL or PGHOST/PGPORT/PGUSER first.`
    );
  }

  const password = await getPassword();
  const connectionUrl = buildConnectionUrl(password);

  const env = {
    ...process.env,
    DATABASE_URL: connectionUrl,
    DIRECT_URL: connectionUrl
  };

  const exitCode = await runCommand(command, args, env);
  process.exit(exitCode);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[db-auth] ${message}`);
  process.exit(1);
});
