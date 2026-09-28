import type { Metadata } from "next";
import Link from "next/link";
import { AwardIcon, BookOpenIcon, CircleAlertIcon, ClockIcon, GraduationCapIcon } from "lucide-react";
import { BarraProgreso, EncabezadoPagina, EstadoBadge, EstadoVacio, PestanasEnlace, Pildora } from "@/components/comunes";
import { buttonVariants } from "@/components/ui/button";
import { listarMisInscripciones, type InscripcionEstudiante } from "@/features/academico/consultas";
import { SiglaCurso } from "@/features/catalogo/portada-curso";
import { requireRol } from "@/lib/auth";
import { ETIQUETA_METODO, ETIQUETA_MODALIDAD, formatearFecha, formatearSoles } from "@/lib/formato";

export const metadata: Metadata = { title: "Mis cursos" };

const PESTANAS = ["curso", "pendientes", "finalizados"] as const;

function TarjetaInscripcion({ i }: { i: InscripcionEstudiante }) {
  return (
    <div className="flex flex-col rounded-2xl border bg-card p-5 shadow-xs">
      <div className="flex items-start gap-4">
        <SiglaCurso titulo={i.curso.titulo} categoria={i.curso.categoria?.slug} className="size-12" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="leading-snug font-semibold">{i.curso.titulo}</p>
            {i.certificado ? (
              <Pildora color="turquesa">
                <AwardIcon /> Finalizado
              </Pildora>
            ) : (
              <EstadoBadge estado={i.estado} />
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {ETIQUETA_MODALIDAD[i.curso.modalidad]} · {i.curso.duracion_horas} h · Inscrito el {formatearFecha(i.fecha_inscripcion)}
          </p>
        </div>
      </div>
      {i.certificado ? (
        <div className="mt-auto pt-4">
          <p className="text-sm text-muted-foreground">
            Certificado <span className="font-mono text-foreground">{i.certificado.codigo_unico}</span>
          </p>
          <Link href="/estudiante/certificados" className={buttonVariants({ size: "sm", className: "mt-3" })}>
            <AwardIcon /> Ver certificado
          </Link>
        </div>
      ) : i.estado === "CONFIRMADA" ? (
        <div className="mt-auto pt-4">
          <div className="flex items-center gap-3">
            <BarraProgreso valor={i.progreso.porcentaje} className="h-1.5" />
            <span className="font-mono text-xs">{i.progreso.porcentaje} %</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {i.progreso.completadas} de {i.progreso.total} lecciones
          </p>
          <Link href={`/estudiante/cursos/${i.curso.id}`} className={buttonVariants({ size: "sm", className: "mt-3" })}>
            Ir al aula
          </Link>
        </div>
      ) : (
        <div className="mt-auto pt-4">
          <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <ClockIcon className="size-4 shrink-0" />
            {i.pago ? `${ETIQUETA_METODO[i.pago.metodo]} · ${formatearSoles(i.pago.monto)} · pago pendiente de validación` : "Pago pendiente"}
          </p>
          <Link href="/estudiante/pagos" className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3" })}>
            Ver pago
          </Link>
        </div>
      )}
    </div>
  );
}

// HU-10 · Mis cursos · HU-28 · Progreso
export default async function EstudianteCursosPage({ searchParams }: PageProps<"/estudiante/cursos">) {
  const usuario = await requireRol("estudiante");
  const { tab, error } = await searchParams;
  const activa = PESTANAS.includes(tab as (typeof PESTANAS)[number]) ? (tab as (typeof PESTANAS)[number]) : "curso";
  const inscripciones = await listarMisInscripciones(usuario.id);

  const grupos = {
    curso: inscripciones.filter((i) => i.estado === "CONFIRMADA" && !i.certificado),
    pendientes: inscripciones.filter((i) => i.estado === "PENDIENTE"),
    finalizados: inscripciones.filter((i) => i.certificado),
  };
  const lista = grupos[activa];

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo="Mis cursos" descripcion="Estado de tus inscripciones, avance y certificados." eyebrow="Aprendizaje">
        <Link href="/cursos" className={buttonVariants({ variant: "outline" })}>
          Explorar cursos
        </Link>
      </EncabezadoPagina>

      {typeof error === "string" && (
        <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" role="alert">
          <CircleAlertIcon className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <PestanasEnlace
        activa={activa}
        items={[
          { valor: "curso", etiqueta: <>En curso <Pildora color="indigo">{grupos.curso.length}</Pildora></>, href: "/estudiante/cursos" },
          { valor: "pendientes", etiqueta: <>Pendientes de pago <Pildora color="ambar">{grupos.pendientes.length}</Pildora></>, href: "/estudiante/cursos?tab=pendientes" },
          { valor: "finalizados", etiqueta: <>Finalizados <Pildora color="turquesa">{grupos.finalizados.length}</Pildora></>, href: "/estudiante/cursos?tab=finalizados" },
        ]}
      />

      {lista.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {lista.map((i) => (
            <TarjetaInscripcion key={i.id} i={i} />
          ))}
        </div>
      ) : (
        <EstadoVacio
          icono={activa === "finalizados" ? GraduationCapIcon : BookOpenIcon}
          titulo={activa === "curso" ? "No tienes cursos en curso" : activa === "pendientes" ? "No tienes pagos pendientes" : "Aún no finalizas cursos"}
          descripcion={activa === "curso" ? "Cuando se confirme tu inscripción, el curso aparecerá aquí." : undefined}
        >
          {activa === "curso" && (
            <Link href="/cursos" className={buttonVariants()}>
              Ver catálogo
            </Link>
          )}
        </EstadoVacio>
      )}
    </div>
  );
}
