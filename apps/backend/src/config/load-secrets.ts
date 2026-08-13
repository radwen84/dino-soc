import * as fs from 'fs';

function readSecret(path?: string): string | undefined {
  if (!path) return undefined;

  try {
    return fs.readFileSync(path, 'utf8').trim();
  } catch {
    return undefined;
  }
}

function loadSecretVariable(name: string, defaultPath: string): void {
  if (!process.env[name]) {
    const value = readSecret(process.env[`${name}_FILE`] || defaultPath);
    if (value) process.env[name] = value;
  }
}

/** Load Docker secrets before ConfigModule validates the environment. */
export function loadRuntimeSecrets(): void {
  loadSecretVariable('JWT_SECRET', '/run/secrets/jwt_secret');
  loadSecretVariable('JWT_REFRESH_SECRET', '/run/secrets/jwt_refresh_secret');
  loadSecretVariable('REDIS_PASSWORD', '/run/secrets/redis_password');
  loadSecretVariable('WAZUH_API_PASSWORD', '/run/secrets/wazuh_api_password');
  loadSecretVariable('OPENSEARCH_ADMIN_PASSWORD', '/run/secrets/opensearch_admin_password');

  if (!process.env.DATABASE_URL) {
    const password = readSecret(process.env.DB_PASSWORD_FILE || '/run/secrets/db_password');
    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const name = process.env.DB_NAME;
    const port = process.env.DB_PORT || '5432';
    if (password && host && user && name) {
      process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}?schema=public`;
    }
  }
}
