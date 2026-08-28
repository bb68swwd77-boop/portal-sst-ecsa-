import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatorio"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET debe tener al menos 16 caracteres"),
  CORS_ORIGIN: z.string().min(1),
  COOKIE_SECURE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  SESSION_TTL_HOURS: z.coerce.number().default(8),
  DEMO_MODE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuración de entorno inválida:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
