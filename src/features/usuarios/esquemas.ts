import { z } from "zod";

export const loginSchema = z.object({
  correo: z.email("Correo no válido"),
  contrasena: z.string().min(1, "Ingresa tu contraseña"),
});

export const registroSchema = z
  .object({
    nombres: z.string().trim().min(2, "Ingresa tus nombres"),
    apellidos: z.string().trim().min(2, "Ingresa tus apellidos"),
    correo: z.email("Correo no válido"),
    contrasena: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Incluye una mayúscula")
      .regex(/[0-9]/, "Incluye un número"),
    confirmar: z.string(),
    aceptaPrivacidad: z.literal("on", { error: "Debes aceptar la política de privacidad (Ley N° 29733)" }),
  })
  .refine((d) => d.contrasena === d.confirmar, { path: ["confirmar"], message: "Las contraseñas no coinciden" });

export const recuperarSchema = z.object({ correo: z.email("Correo no válido") });

export const nuevaContrasenaSchema = z
  .object({ contrasena: registroSchema.shape.contrasena, confirmar: z.string() })
  .refine((d) => d.contrasena === d.confirmar, { path: ["confirmar"], message: "Las contraseñas no coinciden" });

/** Estado que devuelven las Server Actions de formularios (para useActionState). */
export interface EstadoFormulario {
  ok?: boolean;
  mensaje?: string;
  errores?: Record<string, string[] | undefined>;
}
