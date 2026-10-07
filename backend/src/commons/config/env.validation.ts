import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_POOL_SIZE: Joi.number().integer().min(1).max(50).default(10),
  DB_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(500).default(5000),
  DB_QUERY_TIMEOUT_MS: Joi.number().integer().min(500).default(10000),
  DB_STATEMENT_TIMEOUT_MS: Joi.number().integer().min(500).default(12000),
  DB_IDLE_TX_TIMEOUT_MS: Joi.number().integer().min(500).default(15000),
  // Rol de aplicación NO owner (RLS realmente activo). Opcional: si se define,
  // el runtime se conecta con él; las migraciones siempre usan DB_USER.
  DB_APP_USER: Joi.string().allow('').optional(),
  DB_APP_PASSWORD: Joi.string().min(8).allow('').optional(),
  // Forzado por el comando de migraciones de prod para conectar como owner.
  DB_MIGRATE_AS_OWNER: Joi.boolean().default(false),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().required(),
  REDIS_PASSWORD: Joi.string().min(8).required(),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: Joi.number().default(7),
  WEBAUTHN_RP_ID: Joi.string().required(),
  WEBAUTHN_RP_NAME: Joi.string().required(),
  WEBAUTHN_ORIGIN: Joi.string().required(),
  // Escape de emergencia: habilita CORS en NestJS aunque Kong ya lo maneje (debugging directo al :3000).
  ENABLE_NESTJS_CORS: Joi.boolean().default(false),
  // Seeds de datos de demostración: apagados por defecto (evita usuarios con
  // contraseña conocida en prod); se habilitan explícitamente en dev.
  SEED_DEMO_DATA: Joi.boolean().default(false),
  // Contraseña de los usuarios demo que crean los seeds (solo dev).
  SEED_DEMO_PASSWORD: Joi.string().min(8).default('Password123!'),

  // Algoritmo de estudio de crédito (Saman). Sin URL funciona en modo simulado.
  SAMAN_API_URL: Joi.string().uri().allow('').default(''),
  SAMAN_API_KEY: Joi.string().allow('').default(''),
  // Proxy de salida con lista blanca (docker-compose: http://egress-proxy:3128). Vacío = conexión directa.
  SAMAN_HTTPS_PROXY: Joi.string().uri().allow('').default(''),
  SAMAN_EMPRESA: Joi.string().allow('').default(''),
  SAMAN_EXTERNAS: Joi.boolean().default(false),
  SAMAN_TASK_MAX_AGE_HOURS: Joi.number().integer().min(1).default(24),
  SAMAN_SIMULATED_DELAY_MS: Joi.number().integer().min(0).default(20000),
  SAMAN_SIMULATED_RESULT: Joi.string().valid('approved', 'rejected', 'failed', '').default('approved'),
  // Cada cuánto el backend resuelve en segundo plano los borradores pendientes (0 = desactivado).
  CREDIT_STUDY_POLL_INTERVAL_MS: Joi.number().integer().min(0).default(30000),
});
