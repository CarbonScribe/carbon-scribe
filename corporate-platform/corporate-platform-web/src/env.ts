import { z } from 'zod';

// Lenient URL check: accept any string starting with http:// or https://,
// allowing empty strings to pass for optional URL fields.
const httpUrl = z
  .string()
  .refine(
    (v) => v === '' || v.startsWith('http://') || v.startsWith('https://'),
    { message: 'Must be a valid URL (http:// or https://)' },
  );

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: httpUrl.default('http://localhost:4000'),
  NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL: httpUrl.default(
    'https://stellar.expert/explorer/testnet/tx',
  ),

  NEXT_PUBLIC_TOKEN_REFRESH_BUFFER: z.coerce.number().int().positive().default(60),
  NEXT_PUBLIC_MAX_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(3),
  NEXT_PUBLIC_RETRY_INITIAL_DELAY_MS: z.coerce.number().int().positive().default(1000),
  NEXT_PUBLIC_RETRY_MAX_DELAY_MS: z.coerce.number().int().positive().default(30000),
  NEXT_PUBLIC_RETRY_BACKOFF_MULTIPLIER: z.coerce.number().positive().default(2),
  NEXT_PUBLIC_DEGRADED_THRESHOLD: z.coerce.number().int().positive().default(3),
  NEXT_PUBLIC_DEGRADED_RECOVERY_THRESHOLD: z.coerce.number().int().positive().default(2),
  NEXT_PUBLIC_CONNECTIVITY_CHECK_INTERVAL: z.coerce.number().int().positive().default(30000),
  NEXT_PUBLIC_MAX_QUEUE_SIZE: z.coerce.number().int().positive().default(100),
  NEXT_PUBLIC_QUEUE_MAX_RETRIES: z.coerce.number().int().positive().default(3),

  NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT: z.string().url().or(z.literal('')).default(''),
  NEXT_PUBLIC_ERROR_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(50),
  NEXT_PUBLIC_ERROR_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  NEXT_PUBLIC_ERROR_DEV_MIN_SEVERITY: z
    .enum(['error', 'warning', 'info'])
    .default('warning'),

  NEXT_PUBLIC_SESSION_EXPIRY_WARNING_MINUTES: z.coerce.number().int().positive().default(5),
  NEXT_PUBLIC_SESSION_GRACE_SECONDS: z.coerce.number().int().positive().default(30),

  NEXT_PUBLIC_ENVIRONMENT: z
    .enum(['development', 'staging', 'production'])
    .default('development'),
});

export type Env = z.infer<typeof envSchema>;

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('\n❌ Invalid environment variables:\n');
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    console.error(`  • ${path}: ${issue.message}`);
  }
  console.error('\nPlease fix the above errors and try again.\n');
  process.exit(1);
}

export const env = result.data;
