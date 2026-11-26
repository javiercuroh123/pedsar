"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { CampoForm, claseControl, DialogoFormulario } from "@/components/dialogo-formulario";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { actualizarEncuesta, agregarPregunta, crearEncuesta } from "./acciones";
import { ASPECTOS, ETIQUETA_ASPECTO } from "./resultados";

/** HU-43 · Título y descripción de una encuesta (al crearla o editarla). */
function CamposEncuesta({ titulo, descripcion }: { titulo?: string; descripcion?: string | null }) {
  return (
    <>
      <CampoForm etiqueta="Título" htmlFor="e-titulo">
        <Input id="e-titulo" name="titulo" required minLength={3} maxLength={120} defaultValue={titulo} placeholder="Encuesta de satisfacción del curso" className="h-10" />
      </CampoForm>
      <CampoForm etiqueta="Descripción" htmlFor="e-desc" ayuda="El estudiante la ve al abrir la encuesta (opcional, hasta 500 caracteres)">
        <Textarea id="e-desc" name="descripcion" rows={2} maxLength={500} defaultValue={descripcion ?? ""} placeholder="Nos ayuda a mejorar los cursos y la plataforma." />
      </CampoForm>
    </>
  );
}

export function DialogoNuevaEncuesta() {
  return (
    <DialogoFormulario
      disparador={<><PlusIcon /> Nueva encuesta</>}
      titulo="Nueva encuesta"
      descripcion="Se crea inactiva. Luego agregas sus preguntas y la activas para que se envíe al terminar cada curso."
      accion={crearEncuesta}
      textoEnviar="Crear y agregar preguntas"
    >
      <CamposEncuesta />
    </DialogoFormulario>
  );
}

export function DialogoEditarEncuesta({ id, titulo, descripcion }: { id: number; titulo: string; descripcion: string | null }) {
  return (
    <DialogoFormulario disparador={<><PencilIcon /> Editar</>} titulo="Editar encuesta" accion={actualizarEncuesta} varianteDisparador="outline">
      <input type="hidden" name="id" value={id} />
      <CamposEncuesta titulo={titulo} descripcion={descripcion} />
    </DialogoFormulario>
  );
}

/** Agrega una pregunta: de escala (1 a 5, ligada a un aspecto) o abierta. */
export function DialogoPregunta({ encuestaId }: { encuestaId: number }) {
  const [tipo, setTipo] = useState<"ESCALA" | "TEXTO">("ESCALA");
  return (
    <DialogoFormulario disparador={<><PlusIcon /> Agregar pregunta</>} titulo="Agregar pregunta" accion={agregarPregunta} varianteDisparador="outline">
      <input type="hidden" name="encuestaId" value={encuestaId} />
      <CampoForm etiqueta="Pregunta o afirmación" htmlFor="p-enunciado" ayuda={tipo === "ESCALA" ? "Escríbela como afirmación: el estudiante indica cuánto está de acuerdo, del 1 al 5." : undefined}>
        <Input id="p-enunciado" name="enunciado" required minLength={3} maxLength={200} placeholder={tipo === "ESCALA" ? "El instructor resolvió mis dudas." : "¿Qué podríamos mejorar?"} className="h-10" />
      </CampoForm>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoForm etiqueta="Tipo" htmlFor="p-tipo">
          <select id="p-tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as "ESCALA" | "TEXTO")} className={claseControl}>
            <option value="ESCALA">Escala del 1 al 5</option>
            <option value="TEXTO">Respuesta abierta</option>
          </select>
        </CampoForm>
        {tipo === "ESCALA" && (
          <CampoForm etiqueta="Aspecto que mide" htmlFor="p-aspecto">
            <select id="p-aspecto" name="aspecto" required defaultValue="CONTENIDO" className={claseControl}>
              {ASPECTOS.map((a) => (
                <option key={a} value={a}>
                  {ETIQUETA_ASPECTO[a]}
                </option>
              ))}
            </select>
          </CampoForm>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="obligatoria" defaultChecked={tipo === "ESCALA"} key={tipo} className="size-4 accent-primary" />
        Obligatoria
      </label>
    </DialogoFormulario>
  );
}
