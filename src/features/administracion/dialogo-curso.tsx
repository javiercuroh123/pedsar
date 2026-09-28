"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { CampoForm, claseControl, DialogoFormulario } from "@/components/dialogo-formulario";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ETIQUETA_MODALIDAD, ETIQUETA_NIVEL } from "@/lib/formato";
import type { EstadoCurso, Modalidad, Nivel } from "@/types/dominio";
import { guardarCurso } from "./acciones";

export interface CursoEditable {
  id: string;
  titulo: string;
  descripcion: string | null;
  categoria_id: number | null;
  instructor_id: string | null;
  nivel: Nivel;
  modalidad: Modalidad;
  precio: number;
  cupo_maximo: number;
  duracion_horas: number;
  estado: EstadoCurso;
  destacado: boolean;
  publicar_en: string | null;
  imagen_url: string | null;
}

/** Crear o editar un curso (HU-04 · HU-57 publicación programada). */
export function DialogoCurso({
  curso,
  categorias,
  instructores,
}: {
  curso?: CursoEditable;
  categorias: { id: number; nombre: string }[];
  instructores: { id: string; nombre: string }[];
}) {
  // datetime-local en hora de Lima.
  const publicarEn = curso?.publicar_en
    ? new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" }).format(new Date(curso.publicar_en)).replace(" ", "T")
    : "";
  return (
    <DialogoFormulario
      disparador={curso ? <PencilIcon /> : <><PlusIcon /> Nuevo curso</>}
      varianteDisparador={curso ? "ghost" : "default"}
      tamanoDisparador={curso ? "icon-sm" : "default"}
      titulo={curso ? "Editar curso" : "Nuevo curso"}
      descripcion="Los cursos publicados aparecen en el catálogo público."
      accion={guardarCurso}
      textoEnviar="Guardar curso"
      className="sm:max-w-2xl"
    >
      <input type="hidden" name="id" value={curso?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoForm etiqueta="Título del curso" htmlFor="c-titulo" className="sm:col-span-2">
          <Input id="c-titulo" name="titulo" required defaultValue={curso?.titulo} placeholder="Ej. Python desde cero" className="h-10" />
        </CampoForm>
        <CampoForm etiqueta="Descripción" htmlFor="c-desc" className="sm:col-span-2">
          <Textarea id="c-desc" name="descripcion" rows={3} defaultValue={curso?.descripcion ?? ""} placeholder="Qué aprenderá el estudiante y para quién es el curso" />
        </CampoForm>
        <CampoForm etiqueta="Categoría" htmlFor="c-cat">
          <select id="c-cat" name="categoriaId" defaultValue={curso?.categoria_id ?? ""} className={claseControl}>
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </CampoForm>
        <CampoForm etiqueta="Instructor a cargo" htmlFor="c-ins">
          <select id="c-ins" name="instructorId" defaultValue={curso?.instructor_id ?? ""} className={claseControl}>
            <option value="">Sin asignar</option>
            {instructores.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre}
              </option>
            ))}
          </select>
        </CampoForm>
        <CampoForm etiqueta="Nivel" htmlFor="c-nivel">
          <select id="c-nivel" name="nivel" defaultValue={curso?.nivel ?? "BASICO"} className={claseControl}>
            {Object.entries(ETIQUETA_NIVEL).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </CampoForm>
        <CampoForm etiqueta="Modalidad" htmlFor="c-mod">
          <select id="c-mod" name="modalidad" defaultValue={curso?.modalidad ?? "VIRTUAL"} className={claseControl}>
            {Object.entries(ETIQUETA_MODALIDAD).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </CampoForm>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <CampoForm etiqueta="Duración (h)" htmlFor="c-h">
            <Input id="c-h" name="horas" type="number" min={0} defaultValue={curso?.duracion_horas ?? 24} className="h-10" />
          </CampoForm>
          <CampoForm etiqueta="Precio (S/)" htmlFor="c-p">
            <Input id="c-p" name="precio" type="number" min={0} step="0.01" defaultValue={curso?.precio ?? 150} className="h-10" />
          </CampoForm>
          <CampoForm etiqueta="Cupo máximo" htmlFor="c-q">
            <Input id="c-q" name="cupo" type="number" min={1} defaultValue={curso?.cupo_maximo ?? 30} className="h-10" />
          </CampoForm>
        </div>
        <CampoForm etiqueta="Imagen de portada (URL)" htmlFor="c-img" className="sm:col-span-2" ayuda="Opcional. Sin imagen se usa una portada de color por categoría.">
          <Input id="c-img" name="imagen" type="url" defaultValue={curso?.imagen_url ?? ""} placeholder="https://…" className="h-10" />
        </CampoForm>
        <CampoForm etiqueta="Estado" htmlFor="c-estado">
          <select id="c-estado" name="estado" defaultValue={curso?.estado ?? "BORRADOR"} className={claseControl}>
            <option value="BORRADOR">Borrador</option>
            <option value="PUBLICADO">Publicado</option>
            <option value="DESPUBLICADO">Despublicado</option>
          </select>
        </CampoForm>
        <CampoForm etiqueta="Publicar automáticamente el" htmlFor="c-prog" ayuda="Opcional (publicación programada).">
          <Input id="c-prog" name="publicarEn" type="datetime-local" defaultValue={publicarEn} className="h-10" />
        </CampoForm>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="destacado" defaultChecked={curso?.destacado} className="size-4" />
          Destacar en la página de inicio
        </label>
      </div>
    </DialogoFormulario>
  );
}
