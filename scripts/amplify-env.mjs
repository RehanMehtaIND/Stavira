import { writeFileSync } from 'node:fs';
const keys = [
  'STAVIRA_MODE',
  'AWS_REGION',
  'COGNITO_USER_POOL_ID',
  'COGNITO_CLIENT_ID',
  'STAVIRA_API_URL',
  'APP_ORIGIN',
];
if (process.env.STAVIRA_MODE !== 'aws') throw new Error('Amplify deployment must use AWS mode');
const values = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
// Amplify reserves AWS_* names; the pool ID identifies the backend region.
values.AWS_REGION = values.COGNITO_USER_POOL_ID?.split('_')[0];
for (const key of keys) if (!values[key]) throw new Error(`Missing ${key}`);
writeFileSync(
  '.env.production',
  keys.map((key) => `${key}=${JSON.stringify(values[key])}`).join('\n') + '\n',
  { mode: 0o600 },
);
