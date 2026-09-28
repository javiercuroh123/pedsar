import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes";
import { NuevaContrasenaForm } from "@/features/usuarios/formularios";

export const metadata: Metadata = { title: "Nueva contraseña" };

// HU-13 · Restablecimiento de contraseña (destino del enlace de recuperación)
export default function NuevaContrasenaPage() {
  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Cuenta" titulo="Nueva contraseña" descripcion="Crea una contraseña segura para tu cuenta." />
      <div className="max-w-xl rounded-2xl border bg-card p-6 shadow-xs">
        <NuevaContrasenaForm />
      </div>
    </div>
  );
}
