import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Zod schema for environment validation
const envSchema = z.object({
  // Database
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  
  // Redis (for queues and cache)
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // JWT
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // Server
  PORT: z.string().default('5000').transform(val => parseInt(val, 10)).pipe(z.number().int().positive()),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // External APIs (optional)
  OPENAI_API_KEY: z.string()
    .refine(val => !val || (val !== 'your_openai_api_key_here' && val.startsWith('sk-')), {
      message: 'OPENAI_API_KEY must be a valid OpenAI API key starting with sk-'
    })
    .optional(),
  
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  // Client - can be a single URL or comma-separated URLs
  CLIENT_URL: z.string().default('http://localhost:5173'),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse({
      MONGODB_URI: process.env.MONGODB_URI,
      REDIS_URL: process.env.REDIS_URL,
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
      PORT: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      CLIENT_URL: process.env.CLIENT_URL,
    });
  } catch (error) {
    console.error('❌ Environment validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error(error);
    }
    process.exit(1);
  }
};

// Type for the validated environment
type EnvConfig = z.infer<typeof envSchema>;

// Parse environment variables once
const env = parseEnv();

/**
 * Get all environment configuration
 * @returns Validated environment configuration object
 */
export const getEnv = (): EnvConfig => {
  return env;
};

// Log configuration status (only in development)
if (env.NODE_ENV === 'development') {
  console.log('🔧 Environment Configuration:');
  console.log(`  - Database: ${env.MONGODB_URI ? '✅ Configured' : '❌ Missing'}`);
  console.log(`  - Redis: ${env.REDIS_URL ? '✅ Configured' : '❌ Missing'}`);
  console.log(`  - JWT: ${env.JWT_SECRET ? '✅ Configured' : '❌ Missing'}`);
  console.log(`  - OpenAI: ${env.OPENAI_API_KEY ? '✅ Configured' : '⚠️  Not configured'}`);
  console.log(`  - Stripe: ${env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET ? '✅ Configured' : '⚠️  Not configured'}`);
  console.log(`  - Port: ${env.PORT}`);
  console.log(`  - Client URL: ${env.CLIENT_URL}`);
}

export default getEnv;