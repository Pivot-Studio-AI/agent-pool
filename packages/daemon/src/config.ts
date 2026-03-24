import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const configSchema = z.object({
  repoPath: z.string().min(1, 'REPO_PATH is required'),
  poolSize: z.number().int().positive().default(5),
  serverUrl: z.string().url('SERVER_URL must be a valid URL'),
  apiKey: z.string().min(1, 'API_KEY is required'),
  pollIntervalMs: z.number().int().positive().default(3000),
  defaultModel: z.string().default('claude-sonnet-4-20250514'),
  defaultBranch: z.string().default('main'),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const raw = {
    repoPath: process.env.REPO_PATH,
    poolSize: process.env.POOL_SIZE ? parseInt(process.env.POOL_SIZE, 10) : undefined,
    serverUrl: process.env.SERVER_URL,
    apiKey: process.env.API_KEY,
    pollIntervalMs: process.env.POLL_INTERVAL_MS
      ? parseInt(process.env.POLL_INTERVAL_MS, 10)
      : undefined,
    defaultModel: process.env.DEFAULT_MODEL || undefined,
    defaultBranch: process.env.DEFAULT_BRANCH || undefined,
  };

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid daemon configuration:\n${errors}`);
  }

  return result.data;
}

export const config = loadConfig();
