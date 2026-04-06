import { DsqlSigner } from '@aws-sdk/dsql-signer';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { Hash } from '@smithy/hash-node';
import pg from 'pg';

const { Client } = pg;

function parseBoolean(value, defaultValue) {
  if (value == null) return defaultValue;
  return value.toLowerCase() === 'true';
}

async function resolveHostnameFromStack() {
  const stackName = process.env.AWS_STACK_NAME ?? process.env.STACK_NAME;
  if (!stackName) {
    return undefined;
  }

  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';
  const cfn = new CloudFormationClient({ region });
  const response = await cfn.send(new DescribeStacksCommand({ StackName: stackName }));
  const outputs = response.Stacks?.[0]?.Outputs ?? [];

  const hostname = outputs.find((o) => o.OutputKey === 'DsqlHostnameInUse')?.OutputValue;
  if (!hostname) {
    throw new Error(
      `Could not resolve DsqlHostnameInUse from stack ${stackName}. Set DSQL_HOSTNAME or update stack parameter DsqlHostname.`
    );
  }

  return hostname;
}

async function resolveHostname() {
  if (process.env.DSQL_HOSTNAME) {
    return process.env.DSQL_HOSTNAME;
  }

  return resolveHostnameFromStack();
}

export async function createDbClient({ admin = false } = {}) {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return new Client({ connectionString: databaseUrl });
  }

  const hostname = await resolveHostname();
  if (!hostname) {
    throw new Error(
      'No DB connection source found. Set DATABASE_URL, DSQL_HOSTNAME, or AWS_STACK_NAME/STACK_NAME with DsqlHostnameInUse output.'
    );
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
