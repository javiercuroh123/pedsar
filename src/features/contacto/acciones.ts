"use server";

import { z } from "zod";
import { EMPRESA } from "@/config/empresa";
import { enviarCorreo } from "@/lib/email";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";

const contactoSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresa tu nombre").max(120),
  correo: z.email("Correo no válido"),
  telefono: z.string().trim().max(20).optional(),
  asunto: z.enum(["informes", "empresas", "soporte", "reclamo"]),
  mensaje: z.string().trim().min(10, "Cuéntanos un poco más (mínimo 10 caracteres)").max(2000),
});

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// HU-48 · Formulario de contacto (HU-43 libro de reclamaciones)
export async function enviarContacto(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const datos = contactoSchema.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { errores: z.flattenError(datos.error).fieldErrors as EstadoFormulario["errores"] };

  const d = datos.data;
  try {
    await enviarCorreo({
      para: EMPRESA.correo,
      asunto: `[Web · ${d.asunto}] ${d.nombre}`,
      html: `<p><b>${escapar(d.nombre)}</b> &lt;${escapar(d.correo)}&gt; ${d.telefono ? `· ${escapar(d.telefono)}` : ""}</p><p>${escapar(d.mensaje).replace(/\n/g, "<br>")}</p>`,
    });
  } catch {
    return { mensaje: "No pudimos enviar tu mensaje. Inténtalo de nuevo o escríbenos por WhatsApp." };
  }
  return { ok: true, mensaje: "¡Gracias! Recibimos tu mensaje y te responderemos en menos de 24 horas hábiles." };
}
