import type { Metadata } from "next";
import Link from "next/link";
import { AwardIcon, BadgeCheckIcon, CircleCheckIcon, DownloadIcon, EyeIcon, LockIcon, Share2Icon } from "lucide-react";
import { BarraProgreso, EncabezadoPagina, EstadoVacio, Pildora } from "@/components/comunes";
import { BotonCopiar } from "@/components/boton-copiar";
import { buttonVariants } from "@/components/ui/button";
import { ASISTENCIA_MINIMA, evaluarAptitud, formatearAsistencia, formatearNota, NOTA_MINIMA } from "@/config/academico";
import { listarMisInscripciones } from "@/features/academico/consultas";
import { datosCertificado, obtenerResultados } from "@/features/certificacion/consultas";
import { urlVerificacion } from "@/features/certificacion/qr";
import { VistaCertificado } from "@/features/certificacion/vista-certificado";
import { requireRol } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { formatearFecha, nombreCompleto } from "@/lib/formato";

export const metadata: Metadata = { title: "Certificados" };

// HU-11 · Certificados digitales · HU-37 · Compartir en LinkedIn
export default async function EstudianteCertificadosPage() {
  const usuario = await requireRol("estudiante");
  const inscripciones = await listarMisInscripciones(usuario.id);
  const emitidos = inscripciones.filter((i) => i.certificado);
  const enCurso = inscripciones.filter((i) => i.estado === "CONFIRMADA" && !i.certificado);
  const resultados = await obtenerResultados(enCurso.map((i) => i.id));
  const nombre = nombreCompleto(usuario);

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Mis certificados"
        descripcion={`Se emiten al rendir todas las evaluaciones con nota final de ${NOTA_MINIMA} o más y asistir al ${ASISTENCIA_MINIMA} % de las sesiones.`}
        eyebrow="Logros"
      />
      {emitidos.length === 0 && enCurso.length === 0 ? (
        <EstadoVacio icono={AwardIcon} titulo="Aún no tienes certificados" descripcion="Inscríbete en un curso y complétalo para obtener tu certificado verificable.">
          <Link href="/cursos" className={buttonVariants()}>
            Ver catálogo
          </Link>
        </EstadoVacio>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {emitidos.map((i) => {
            const datos = datosCertificado(i, nombre);
            const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(urlVerificacion(publicEnv.NEXT_PUBLIC_SITE_URL, datos.codigo_unico))}`;
            return (
              <div key={i.id} className="overflow-hidden rounded-2xl border bg-card shadow-xs">
                <div className="bg-linear-to-b from-card to-brand-50 p-5 dark:from-transparent dark:to-brand-500/10">
                  <VistaCertificado datos={datos} />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{datos.curso}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">Emitido el {formatearFecha(datos.fecha_emision)}</p>
                    </div>
                    <Pildora color="verde">
                      <BadgeCheckIcon /> Válido
                    </Pildora>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/60 py-1 pr-1 pl-3">
                    <span className="font-mono text-sm">{datos.codigo_unico}</span>
                    <BotonCopiar texto={datos.codigo_unico} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={`/certificados/${datos.codigo_unico}/pdf`} className={buttonVariants({ size: "sm" })}>
                      <DownloadIcon /> Descargar PDF
                    </a>
                    <Link href={`/estudiante/certificados/${datos.codigo_unico}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <EyeIcon /> Ver
                    </Link>
                    <a href={linkedin} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <Share2Icon /> Compartir en LinkedIn
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
          {enCurso.map((i) => {
            const r = resultados.get(i.id);
            const { apto, motivos } = evaluarAptitud(r);
            return (
              <div key={i.id} className="flex flex-col justify-center rounded-2xl border border-dashed bg-card/60 p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-muted">
                  {apto ? <CircleCheckIcon className="size-4 text-green-600" /> : <LockIcon className="size-4 text-muted-foreground" />}
                </span>
                <p className="mt-4 font-semibold">{i.curso.titulo}</p>
                {apto ? (
                  <p className="mt-1 text-sm text-muted-foreground">Cumples los requisitos: PEDSAR emitirá tu certificado y te avisaremos.</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                    {motivos.map((m) => (
                      <li key={m}>· {m}</li>
                    ))}
                  </ul>
                )}
                <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Nota final</dt>
                    <dd className="font-mono font-medium">{r?.evaluaciones ? `${formatearNota(r.nota_final ?? 0)}/20` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Asistencia</dt>
                    <dd className="font-mono font-medium">{r?.sesiones ? `${formatearAsistencia(r.asistencia ?? 0)} %` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Avance</dt>
                    <dd className="flex items-center gap-2">
                      <BarraProgreso valor={i.progreso.porcentaje} className="h-1.5" />
                      <span className="font-mono">{i.progreso.porcentaje}%</span>
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
