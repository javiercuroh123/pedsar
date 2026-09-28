"use client";

import { FilePlus2Icon, FileUpIcon, FilmIcon, FolderPlusIcon, LinkIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CampoForm, claseControl, DialogoFormulario } from "@/components/dialogo-formulario";
import { Input } from "@/components/ui/input";
import type { EstadoFormulario } from "@/features/usuarios/esquemas";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { crearContenido, crearModulo, crearSesion } from "./acciones-instructor";

export function DialogoModulo({ cursoId }: { cursoId: string }) {
  return (
    <DialogoFormulario
      disparador={
        <>
          <FolderPlusIcon /> Agregar módulo
        </>
      }
      varianteDisparador="outline"
      titulo="Nuevo módulo"
      descripcion="Los módulos agrupan los materiales del curso."
      accion={crearModulo}
      textoEnviar="Agregar"
    >
      <input type="hidden" name="cursoId" value={cursoId} />
      <CampoForm etiqueta="Título del módulo" htmlFor="titulo-modulo">
        <Input id="titulo-modulo" name="titulo" required placeholder="Ej. Módulo 4 · Funciones y módulos" className="h-10" />
      </CampoForm>
    </DialogoFormulario>
  );
}

const TIPOS = [
  { v: "PDF", t: "PDF", icono: FileUpIcon, acepta: "application/pdf", limite: 20 },
  { v: "VIDEO", t: "Video", icono: FilmIcon, acepta: "video/mp4,video/webm", limite: 500 },
  { v: "ENLACE", t: "Enlace", icono: LinkIcon, acepta: "", limite: 0 },
] as const;

/**
 * Subida de contenidos (HU-52). El archivo va directo del navegador al bucket
 * privado "contenidos" de Supabase Storage (RLS: solo instructores y admin) y
 * luego se registra con la Server Action; así no hay límite de tamaño del servidor.
 */
export function DialogoContenido({ cursoId, modulos }: { cursoId: string; modulos: { id: number; titulo: string }[] }) {
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]["v"]>("PDF");
  const [archivo, setArchivo] = useState<File | null>(null);
  const conf = TIPOS.find((t) => t.v === tipo)!;

  const accion = async (previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> => {
    if (tipo !== "ENLACE") {
      const url = String(datos.get("url") ?? "");
      if (!archivo && !url) return { ok: false, mensaje: "Adjunta un archivo o pega un enlace de YouTube / Vimeo" };
      if (archivo) {
        if (archivo.size > conf.limite * 1024 * 1024) return { ok: false, mensaje: `El archivo supera ${conf.limite} MB` };
        const ruta = `${cursoId}/${Date.now()}-${archivo.name.normalize("NFD").replace(/[^\w.-]+/g, "_")}`;
        const { error } = await createClient().storage.from("contenidos").upload(ruta, archivo, { contentType: archivo.type });
        if (error) return { ok: false, mensaje: `No se pudo subir el archivo: ${error.message}` };
        datos.set("url", ruta);
      }
    }
    datos.set("tipo", tipo);
    const r = await crearContenido(previo, datos);
    if (r.ok) setArchivo(null);
    return r;
  };

  return (
    <DialogoFormulario
      disparador={
        <>
          <FilePlus2Icon /> Subir contenido
        </>
      }
      titulo="Subir contenido"
      descripcion="PDF, video o enlace externo. Los estudiantes inscritos lo verán en el aula virtual."
      accion={accion}
      textoEnviar="Publicar"
    >
      <div className="flex rounded-lg bg-muted p-1" role="radiogroup" aria-label="Tipo de contenido">
        {TIPOS.map((t) => (
          <button
            key={t.v}
            type="button"
            role="radio"
            aria-checked={tipo === t.v}
            onClick={() => {
              setTipo(t.v);
              setArchivo(null);
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition",
              tipo === t.v ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            <t.icono className="size-4" /> {t.t}
          </button>
        ))}
      </div>
      <CampoForm etiqueta="Título" htmlFor="titulo-contenido">
        <Input id="titulo-contenido" name="titulo" required placeholder="Ej. Ejercicios resueltos" className="h-10" />
      </CampoForm>
      <CampoForm etiqueta="Módulo" htmlFor="modulo">
        <select id="modulo" name="moduloId" className={claseControl} required>
          {modulos.map((m, i) => (
            <option key={m.id} value={m.id}>
              {i + 1}. {m.titulo}
            </option>
          ))}
        </select>
      </CampoForm>
      {tipo === "ENLACE" ? (
        <CampoForm etiqueta="URL" htmlFor="url">
          <Input id="url" name="url" type="url" required placeholder="https://" className="h-10" />
        </CampoForm>
      ) : (
        <>
          <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-500/5">
            <conf.icono className="size-7 text-primary" />
            <span className="mt-2 text-sm font-medium">{archivo ? archivo.name : "Haz clic para elegir el archivo"}</span>
            <span className="text-xs text-muted-foreground">
              {tipo === "PDF" ? "PDF" : "MP4 / WebM"} · máximo {conf.limite} MB
            </span>
            <input
              type="file"
              accept={conf.acepta}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > conf.limite * 1024 * 1024) toast.error(`El archivo supera ${conf.limite} MB`);
                setArchivo(f);
              }}
            />
          </label>
          {tipo === "VIDEO" && (
            <CampoForm etiqueta="…o pega un enlace de YouTube / Vimeo" htmlFor="url-video">
              <Input id="url-video" name="url" type="url" placeholder="https://youtu.be/…" className="h-10" />
            </CampoForm>
          )}
        </>
      )}
    </DialogoFormulario>
  );
}

export function DialogoSesion({ cursos, cursoId }: { cursos: { id: string; titulo: string }[]; cursoId?: string }) {
  const [modalidad, setModalidad] = useState("VIRTUAL");
  return (
    <DialogoFormulario
      disparador={
        <>
          <PlusIcon /> Nueva sesión
        </>
      }
      titulo="Nueva sesión"
      descripcion="Se mostrará en el horario del curso y en el portal de los estudiantes."
      accion={crearSesion}
      textoEnviar="Programar sesión"
    >
      <CampoForm etiqueta="Curso" htmlFor="s-curso">
        <select id="s-curso" name="cursoId" defaultValue={cursoId} className={claseControl}>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
        </select>
      </CampoForm>
      <div className="grid grid-cols-3 gap-3">
        <CampoForm etiqueta="Fecha" htmlFor="s-fecha">
          <Input id="s-fecha" name="fecha" type="date" required className="h-10" />
        </CampoForm>
        <CampoForm etiqueta="Inicio" htmlFor="s-hora">
          <Input id="s-hora" name="horaInicio" type="time" required defaultValue="19:00" className="h-10" />
        </CampoForm>
        <CampoForm etiqueta="Duración" htmlFor="s-dur">
          <select id="s-dur" name="duracion" defaultValue="120" className={claseControl}>
            {[60, 90, 120, 150, 180, 240].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </CampoForm>
      </div>
      <CampoForm etiqueta="Modalidad" htmlFor="s-mod">
        <select id="s-mod" name="modalidad" value={modalidad} onChange={(e) => setModalidad(e.target.value)} className={claseControl}>
          <option value="VIRTUAL">Virtual</option>
          <option value="PRESENCIAL">Presencial</option>
          <option value="SEMIPRESENCIAL">Semipresencial</option>
        </select>
      </CampoForm>
      {modalidad !== "PRESENCIAL" && (
        <CampoForm etiqueta="Enlace de videoconferencia" htmlFor="s-enlace" ayuda="Zoom, Google Meet o Teams.">
          <Input id="s-enlace" name="enlace" type="url" placeholder="https://zoom.us/j/…" className="h-10" />
        </CampoForm>
      )}
    </DialogoFormulario>
  );
}
