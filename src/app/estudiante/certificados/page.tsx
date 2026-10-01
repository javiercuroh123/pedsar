import type { Metadata } from "next";
import Link from "next/link";
import { AwardIcon, BadgeCheckIcon, EyeIcon, LockIcon, Share2Icon } from "lucide-react";
import { BarraProgreso, EncabezadoPagina, EstadoVacio, Pildora } from "@/components/comunes";
import { BotonCopiar } from "@/components/boton-copiar";
import { buttonVariants } from "@/components/ui/button";
import { listarMisInscripciones } from "@/features/academico/consultas";
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
  const nombre = nombreCompleto(usuario);

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Mis certificados"
        descripcion="Se emiten al completar el 100 % del curso y aprobar las evaluaciones."
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
            const c = i.certificado!;
            const urlVerificar = `${publicEnv.NEXT_PUBLIC_SITE_URL}/verificar?codigo=${c.codigo_unico}`;
            const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(urlVerificar)}`;
            return (
              <div key={i.id} className="overflow-hidden rounded-2xl border bg-card shadow-xs">
                <div className="bg-linear-to-b from-card to-brand-50 p-5 dark:from-transparent dark:to-brand-500/10">
                  <VistaCertificado
                    datos={{
                      estudiante: nombre,
                      curso: i.curso.titulo,
                      duracion_horas: i.curso.duracion_horas,
                      fecha_emision: c.fecha_emision,
                      codigo_unico: c.codigo_unico,
                    }}
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{i.curso.titulo}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">Emitido el {formatearFecha(c.fecha_emision)}</p>
                    </div>
                    <Pildora color="verde">
                      <BadgeCheckIcon /> Válido
                    </Pildora>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/60 py-1 pr-1 pl-3">
                    <span className="font-mono text-sm">{c.codigo_unico}</span>
                    <BotonCopiar texto={c.codigo_unico} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/estudiante/certificados/${c.codigo_unico}`} className={buttonVariants({ size: "sm" })}>
                      <EyeIcon /> Ver y descargar
                    </Link>
                    <a href={linkedin} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <Share2Icon /> Compartir en LinkedIn
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
          {enCurso.map((i) => (
            <div key={i.id} className="flex flex-col justify-center rounded-2xl border border-dashed bg-card/60 p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-muted">
                <LockIcon className="size-4 text-muted-foreground" />
              </span>
              <p className="mt-4 font-semibold">{i.curso.titulo}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Disponible al completar el curso. Te faltan {Math.max(i.progreso.total - i.progreso.completadas, 0)} lecciones.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <BarraProgreso valor={i.progreso.porcentaje} className="h-1.5" />
                <span className="font-mono text-xs">{i.progreso.porcentaje} %</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
