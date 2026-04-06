import pg from 'pg';

const { Client } = pg;

export async function createDbClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return new Client({ connectionString: databaseUrl });
}
