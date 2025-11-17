import { defineConfig } from 'drizzle-kit';
import { env } from './src/share/configs/environments/server-constants';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/share/schema/drizzles/index.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB,
    ssl:
      (env.POSTGRES_TLS_ENABLED ?? false) === true
        ? ({
            rejectUnauthorized: true,
            servername: env.POSTGRES_TLS_SERVERNAME,
          } as any)
        : (false as any),
  },
  verbose: true,
  strict: false,
});
