import type { Metadata } from "next";
import { BadgeCheckIcon, QrCodeIcon, SearchIcon, ShieldCheckIcon, ShieldXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { esCertificadoDeAprobacion, formatearNota } from "@/config/academico";
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
    <div>
      <section className="fondo-marca relative overflow-hidden text-white">
        <div className="fondo-puntos pointer-events-none absolute inset-0 text-white/[0.06]" />
        <div className="relative mx-auto max-w-4xl px-4 pt-16 pb-24 text-center sm:px-6 lg:px-8">
          <span className="animar-escala mx-auto grid size-14 place-items-center rounded-2xl bg-white/10 text-brand-300 ring-1 ring-white/15">
            <ShieldCheckIcon className="size-7" />
          </span>
          <h1 className="animar-entrada mt-5 text-4xl font-bold tracking-tight [--i:1] sm:text-[2.5rem]">Verificar certificado</h1>
          <p className="animar-entrada mx-auto mt-3 max-w-lg text-lg text-zinc-300 [--i:2]">
            Ingresa el código único impreso en el certificado para comprobar su autenticidad.
          </p>
          <form className="animar-entrada mx-auto mt-8 flex max-w-xl flex-col gap-2 rounded-xl bg-card p-1.5 text-foreground shadow-2xl [--i:3] sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Código del certificado</span>
              <QrCodeIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="codigo"
                defaultValue={buscado ?? ""}
                placeholder="PED-2026-XXXXXXXX"
                required
                className="h-11 border-0 bg-transparent pl-10 font-mono text-base tracking-wider uppercase shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
            </label>
            <Button type="submit" size="lg">
              <SearchIcon />
              Verificar
            </Button>
          </form>
          <p className="animar-entrada mt-3 text-xs text-zinc-400 [--i:4]">El código está en la parte inferior del certificado, junto al QR.</p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
        {buscado && (
          <div className="animar-escala relative -mt-12" aria-live="polite">
            {certificado ? (
              <div className="overflow-hidden rounded-2xl border bg-card shadow-(--sombra-lg)">
                <div className="flex items-center gap-3 border-b border-green-100 bg-green-50 px-6 py-4 text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300">
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
                      // Figura 15: la nota final se publica solo en los certificados de aprobación.
                      ["Resultado", esCertificadoDeAprobacion(certificado.nota_final) ? `Aprobado · nota final ${formatearNota(certificado.nota_final!)}/20` : "Participación"],
                      ...(certificado.instructor ? [["Instructor(a)", certificado.instructor]] : []),
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
              <div className="mx-auto flex max-w-xl items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-5 text-red-700 shadow-(--sombra-lg) dark:border-red-500/25 dark:bg-red-950 dark:text-red-300">
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
