import "server-only";
import { Resend } from "resend";
import { serverEnv } from "@/lib/env.server";

const resend = serverEnv.RESEND_API_KEY ? new Resend(serverEnv.RESEND_API_KEY) : null;

interface Correo {
  para: string;
  asunto: string;
  html: string;
}

/** Envía un correo transaccional. En desarrollo sin API key solo lo registra en consola. */
export async function enviarCorreo({ para, asunto, html }: Correo) {
  if (!resend) {
    console.info(`[correo simulado] → ${para}: ${asunto}`);
    return { ok: true, simulado: true };
  }
  const { error } = await resend.emails.send({ from: serverEnv.EMAIL_FROM, to: para, subject: asunto, html });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { ok: true, simulado: false };
}
