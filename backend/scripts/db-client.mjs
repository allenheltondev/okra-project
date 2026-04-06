import { DsqlSigner } from '@aws-sdk/dsql-signer';
import { Hash } from '@smithy/hash-node';
import pg from 'pg';

const { Client } = pg;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseBoolean(value, defaultValue) {
  if (value == null) return defaultValue;
  return value.toLowerCase() === 'true';
}

export async function createDbClient({ admin = false } = {}) {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return new Client({ connectionString: databaseUrl });
  }

  const hostname = requireEnv('DSQL_HOSTNAME');
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';
  const database = process.env.DSQL_DATABASE ?? 'postgres';
  const port = Number(process.env.DSQL_PORT ?? 5432);
  const user = process.env.DSQL_DB_USER ?? 'admin';
  const sslRejectUnauthorized = parseBoolean(process.env.DSQL_SSL_REJECT_UNAUTHORIZED, true);

  const signer = new DsqlSigner({
    hostname,
    region,
    sha256: Hash.bind(null, 'sha256')
  });

  const password = admin
    ? await signer.getDbConnectAdminAuthToken()
    : await signer.getDbConnectAuthToken();

  return new Client({
    host: hostname,
    port,
    database,
    user,
    password,
    ssl: {
      rejectUnauthorized: sslRejectUnauthorized
    }
  });
}
