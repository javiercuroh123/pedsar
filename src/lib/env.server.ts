import "server-only";
import { z } from "zod";

/** Variables secretas: solo se pueden importar desde código de servidor. */
const serverEnvSchema = z.object({
  // Opcional al arrancar para que la app no se caiga; createAdminClient() exige que exista.
  SUPABASE_SECRET_KEY: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(["culqi", "izipay", "niubiz"]).default("culqi"),
  CULQI_SECRET_KEY: z.string().optional(),
  CULQI_WEBHOOK_SECRET: z.string().optional(),
  IZIPAY_MERCHANT_CODE: z.string().optional(),
  IZIPAY_API_KEY: z.string().optional(),
  NIUBIZ_MERCHANT_ID: z.string().optional(),
  NIUBIZ_USER: z.string().optional(),
  NIUBIZ_PASSWORD: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("PEDSAR <no-reply@pedsar.pe>"),
});

export const serverEnv = serverEnvSchema.parse(process.env);
