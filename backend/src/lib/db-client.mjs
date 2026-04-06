import { DsqlSigner } from '@aws-sdk/dsql-signer';
import { Hash } from '@smithy/hash-node';
import pg from 'pg';

const { Pool } = pg;

let pool;

function parseBoolean(value, defaultValue) {
  if (value == null) return defaultValue;
  return value.toLowerCase() === 'true';
}

function getPoolConfigFromUrl(databaseUrl) {
  return { connectionString: databaseUrl };
}

async function getPoolConfigFromDsql() {
  const hostname = process.env.DSQL_HOSTNAME;
  if (!hostname) {
    throw new Error('DSQL_HOSTNAME or DATABASE_URL is required');
  }

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

  const password = await signer.getDbConnectAuthToken();

  return {
    host: hostname,
    port,
    database,
    user,
    password,
    ssl: {
      rejectUnauthorized: sslRejectUnauthorized
    }
  };
}

export async function getDbPool() {
  if (pool) {
    return pool;
  }

  const databaseUrl = process.env.DATABASE_URL;
  const config = databaseUrl
    ? getPoolConfigFromUrl(databaseUrl)
    : await getPoolConfigFromDsql();

  pool = new Pool(config);
  return pool;
}
