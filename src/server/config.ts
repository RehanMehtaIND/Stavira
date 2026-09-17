export function mode() {
  const value =
    process.env.STAVIRA_MODE ?? (process.env.NODE_ENV === 'production' ? 'aws' : 'local');
  if (value !== 'local' && value !== 'aws') throw new Error('Invalid STAVIRA_MODE');
  if (value === 'local' && process.env.NODE_ENV === 'production')
    throw new Error('Local adapters are disabled in production.');
  return value;
}
export function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing server configuration: ${key}`);
  return value;
}
