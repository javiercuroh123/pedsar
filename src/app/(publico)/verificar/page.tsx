import type { Metadata } from "next";
import { BadgeCheckIcon, ShieldCheckIcon, ShieldXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verificarCertificado } from "@/features/certificacion/consultas";
import { VistaCertificado } from "@/features/certificacion/vista-certificado";
import { formatearFecha } from "@/lib/formato";

export const metadata: Metadata = { title: "Verificar certificado" };

// HU-11 · Verificación pública de certificados (Figura 15)
export default async function VerificarPage({ searchParams }: PageProps<"/verificar">) {
  const codigo = (await searchParams).codigo;
  const buscado = typeof codigo === "string" && codigo.trim() ? codigo.trim().toUpperCase() : null;
  const certificado = buscado ? await verificarCertificado(buscado) : null;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-linear-to-b from-brand-100/70 via-fuchsia-50/40 to-transparent dark:from-brand-900/40 dark:via-transparent" />
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-linear-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-600/30">
            <ShieldCheckIcon className="size-7" />
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">Verificación de certificados</h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Ingresa el código único impreso en el certificado para comprobar su autenticidad.
          </p>
        </div>

        <form className="mx-auto mt-8 flex max-w-xl flex-col gap-2 rounded-2xl border bg-card p-2 shadow-lg shadow-brand-900/5 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Código del certificado</span>
            <Input
              name="codigo"
              defaultValue={buscado ?? ""}
              placeholder="PED-2026-XXXXXXXX"
              required
              className="h-11 border-0 bg-transparent text-center font-mono tracking-wider uppercase shadow-none focus-visible:ring-0 sm:text-left dark:bg-transparent"
            />
          </label>
          <Button type="submit" className="h-11 px-6 text-base">
            Verificar
          </Button>
        </form>

        {buscado && (
          <div className="mt-10" aria-live="polite">
            {certificado ? (
              <div className="overflow-hidden rounded-3xl border bg-card shadow-xl shadow-brand-900/5">
                <div className="flex items-center gap-3 border-b border-emerald-200 bg-linear-to-r from-emerald-50 to-teal-50 px-6 py-4 text-emerald-800 dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-teal-500/5 dark:text-emerald-300">
                  <BadgeCheckIcon className="size-7 shrink-0" />
                  <div>
                    <p className="font-bold">Certificado válido</p>
                    <p className="text-sm opacity-80">Emitido por PEDSAR E.I.R.L. · RUC 20605615521</p>
                  </div>
                </div>
                <div className="grid gap-8 p-6 md:grid-cols-[minmax(0,1fr)_240px]">
                  <VistaCertificado datos={certificado} />
                  <dl className="space-y-4 text-sm">
                    {[
                      ["Egresado(a)", certificado.estudiante],
                      ["Curso", certificado.curso],
                      ["Duración", `${certificado.duracion_horas} horas`],
                      ["Fecha de emisión", formatearFecha(certificado.fecha_emision)],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="mt-0.5 font-semibold">{v}</dd>
                      </div>
                    ))}
                    <div>
                      <dt className="text-muted-foreground">Código</dt>
                      <dd className="mt-0.5 font-mono">{certificado.codigo_unico}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-xl items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
                <ShieldXIcon className="size-6 shrink-0" />
                <div>
                  <p className="font-semibold">No encontramos un certificado con el código {buscado}</p>
                  <p className="mt-1 text-sm opacity-80">
                    Revisa que esté escrito tal como aparece en el documento. Si el problema persiste, comunícate con PEDSAR.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
