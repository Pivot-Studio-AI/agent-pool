import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from project root (../../.env relative to packages/server/)
dotenvConfig({ path: resolve(__dirname, '../../.env') });
// Also try monorepo root
dotenvConfig({ path: resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().default(3000),
  API_KEY: z.string().min(1, 'API_KEY is required'),
  DASHBOARD_URL: z.string().default('http://localhost:5173'),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().length(64).optional(),
  JWT_SECRET: z.string().min(32).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  databaseUrl: parsed.data.DATABASE_URL,
  port: parsed.data.PORT,
  apiKey: parsed.data.API_KEY,
  dashboardUrl: parsed.data.DASHBOARD_URL,
  githubClientId: parsed.data.GITHUB_CLIENT_ID,
  githubClientSecret: parsed.data.GITHUB_CLIENT_SECRET,
  encryptionKey: parsed.data.ENCRYPTION_KEY,
  jwtSecret: parsed.data.JWT_SECRET,
} as const;

export const MAX_SLOTS = 50;

export type Config = typeof config;
