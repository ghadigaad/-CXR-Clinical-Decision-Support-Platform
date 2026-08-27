/**
 * Environment loading and validation.
 *
 * The process refuses to start on invalid configuration rather than discovering it at
 * request time - a mis-set retention or auth flag in a clinical deployment should fail
 * loudly at boot.
 */
import 'dotenv/config';
import { z } from 'zod';

const booleanFromEnv = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  COOKIE_SECURE: booleanFromEnv.default('false'),

  AI_PROVIDER: z.enum(['real', 'mock']).default('real'),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  AI_EFFICIENTNET_URL: z.string().url().default('http://localhost:8001'),
  INTERNAL_API_TOKEN: z.string().default(''),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  AI_ENABLE_GRADCAM: booleanFromEnv.default('true'),

  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),

  STORE_ORIGINAL_IMAGES: booleanFromEnv.default('false'),
  IMAGE_STORAGE_DIR: z.string().default('./storage/images'),
  STORE_THUMBNAILS: booleanFromEnv.default('true'),
  THUMBNAIL_SIZE: z.coerce.number().int().min(64).max(1024).default(256),
  DISPLAY_IMAGE_SIZE: z.coerce.number().int().min(256).max(4096).default(1024),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  SUPABASE_URL: z.string().url('SUPABASE_URL must be the project URL from Settings → API'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20, 'SUPABASE_SERVICE_ROLE_KEY is required for email sign-in. Copy the service_role key from Settings → API. Never expose it to the browser.'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill in the values.`);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';

if (env.AI_PROVIDER === 'real' && !env.INTERNAL_API_TOKEN) {
  console.error(
    'AI_PROVIDER=real requires INTERNAL_API_TOKEN to match the value in ai-service/.env.',
  );
  process.exit(1);
}

if (isProduction) {
  if (env.AI_PROVIDER === 'mock') {
    console.error(
      'AI_PROVIDER=mock is a development-only stub and must never run in production. ' +
        'Set AI_PROVIDER=real and point AI_SERVICE_URL at the inference service.',
    );
    process.exit(1);
  }
  if (!env.COOKIE_SECURE) {
    console.warn(
      'COOKIE_SECURE=false in production: session cookies will be sent over plain HTTP.',
    );
  }
}
