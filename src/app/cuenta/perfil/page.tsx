import type { Metadata } from "next";
import { DownloadIcon, ShieldAlertIcon } from "lucide-react";
import { EncabezadoPagina, PestanasEnlace } from "@/components/comunes";
import { buttonVariants } from "@/components/ui/button";
import { EMPRESA } from "@/config/empresa";
import { FormularioPerfil } from "@/features/usuarios/formulario-perfil";
import { NuevaContrasenaForm } from "@/features/usuarios/formularios";
import { requireUsuario } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mi perfil" };

const PESTANAS = [
  { valor: "datos", etiqueta: "Datos personales", href: "/cuenta/perfil" },
  { valor: "seguridad", etiqueta: "Seguridad", href: "/cuenta/perfil?tab=seguridad" },
  { valor: "privacidad", etiqueta: "Privacidad y datos", href: "/cuenta/perfil?tab=privacidad" },
];

// HU-15 · Perfil · HU-13 · Contraseña · HU-44 · Datos personales (Ley N.º 29733)
export default async function CuentaPerfilPage({ searchParams }: PageProps<"/cuenta/perfil">) {
  const usuario = await requireUsuario();
  const { tab } = await searchParams;
  const activa = PESTANAS.some((p) => p.valor === tab) ? (tab as string) : "datos";
  const supabase = await createClient();
  const { data: extra } = await supabase.from("perfiles").select("telefono, documento").eq("id", usuario.id).single();

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Cuenta" titulo="Mi perfil" descripcion="Datos personales, seguridad y privacidad de tu cuenta." />
      <PestanasEnlace items={PESTANAS} activa={activa} />
      <div className="max-w-3xl">
        {activa === "datos" && (
          <FormularioPerfil
            id={usuario.id}
            nombres={usuario.nombres}
            apellidos={usuario.apellidos}
            correo={usuario.correo}
            telefono={extra?.telefono ?? null}
            documento={extra?.documento ?? null}
            especialidad={usuario.especialidad}
            avatar={usuario.avatar_url}
            esStaff={usuario.rol !== "estudiante"}
          />
        )}
        {activa === "seguridad" && (
          <div className="rounded-2xl border bg-card p-6 shadow-xs">
            <h2 className="font-semibold">Cambiar contraseña</h2>
            <p className="mb-5 text-sm text-muted-foreground">Mínimo 8 caracteres, con una mayúscula y un número.</p>
            <NuevaContrasenaForm />
          </div>
        )}
        {activa === "privacidad" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Exportar mis datos</h2>
                <p className="mt-1 text-sm text-muted-foreground">Descarga una copia de tus datos personales, inscripciones y pagos (Ley N.º 29733).</p>
              </div>
              <a href="/cuenta/exportar" className={buttonVariants({ variant: "outline" })}>
                <DownloadIcon /> Descargar JSON
              </a>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6 dark:border-rose-500/30 dark:bg-rose-500/5">
              <h2 className="flex items-center gap-2 font-semibold text-rose-700 dark:text-rose-400">
                <ShieldAlertIcon className="size-4" /> Eliminar cuenta
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Se eliminarán tus datos personales de forma permanente. Los comprobantes emitidos se conservan según la normativa tributaria.
              </p>
              <a
                href={`mailto:${EMPRESA.correo}?subject=${encodeURIComponent("Solicitud de eliminación de cuenta")}&body=${encodeURIComponent(`Solicito eliminar mi cuenta (${usuario.correo}).`)}`}
                className={buttonVariants({ variant: "destructive", className: "mt-4" })}
              >
                Solicitar eliminación
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
