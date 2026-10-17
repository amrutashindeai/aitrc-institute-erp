const path = require('node:path');
const dotenv = require('dotenv');
const { z } = require('zod');

// Load backend/.env regardless of the directory from which npm is invoked.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  API_PREFIX: z.string().regex(/^\/[a-zA-Z0-9/_-]+$/).default('/api/v1'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/institute_erp'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().max(104857600).default(10485760),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info')
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const config = Object.freeze({
  ...parsed.data,
  CORS_ORIGINS: parsed.data.CORS_ORIGIN.split(',').map((value) => value.trim()).filter(Boolean),
  UPLOAD_PATH: path.resolve(__dirname, '../../', parsed.data.UPLOAD_DIR)
});

module.exports = config;
