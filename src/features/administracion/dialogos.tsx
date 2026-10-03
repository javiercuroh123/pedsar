"use client";

import { PencilIcon, PlusIcon, UserPlusIcon } from "lucide-react";
import { CampoForm, claseControl, DialogoFormulario } from "@/components/dialogo-formulario";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PLAZO_PAGO_HORAS } from "@/config/matricula";
import { crearCupon, guardarCategoria, invitarUsuario, observarPago } from "./acciones";

/** Validar comprobantes · devuelve el pago al estudiante con el motivo, sin cancelar la inscripción. */
export function DialogoObservarPago({ inscripcionId, codigo }: { inscripcionId: string; codigo: string }) {
  return (
    <DialogoFormulario
      disparador="Observar"
      varianteDisparador="outline"
      tamanoDisparador="sm"
      titulo={`Observar pago ${codigo}`}
      descripcion={`El estudiante verá el motivo y tendrá ${PLAZO_PAGO_HORAS} horas para registrar de nuevo el N.º de operación o la captura. La inscripción sigue pendiente.`}
      accion={observarPago}
      textoEnviar="Devolver al estudiante"
    >
      <input type="hidden" name="inscripcionId" value={inscripcionId} />
      <CampoForm etiqueta="¿Qué debe corregir?" htmlFor={`obs-${inscripcionId}`}>
        <Textarea
          id={`obs-${inscripcionId}`}
          name="motivo"
          rows={3}
          required
          minLength={5}
          maxLength={300}
          placeholder="Ej. No encontramos la operación en Yape; verifica el número o adjunta la captura."
        />
      </CampoForm>
    </DialogoFormulario>
  );
}

export function DialogoCategoria({ categoria }: { categoria?: { id: number; nombre: string; descripcion: string | null } }) {
  return (
    <DialogoFormulario
      disparador={categoria ? <PencilIcon /> : <><PlusIcon /> Nueva categoría</>}
      varianteDisparador={categoria ? "ghost" : "default"}
      tamanoDisparador={categoria ? "icon-sm" : "default"}
      titulo={categoria ? "Editar categoría" : "Nueva categoría"}
      accion={guardarCategoria}
    >
      <input type="hidden" name="id" value={categoria?.id ?? ""} />
      <CampoForm etiqueta="Nombre" htmlFor="cat-nombre">
        <Input id="cat-nombre" name="nombre" required defaultValue={categoria?.nombre} className="h-10" />
      </CampoForm>
      <CampoForm etiqueta="Descripción" htmlFor="cat-desc">
        <Textarea id="cat-desc" name="descripcion" rows={3} defaultValue={categoria?.descripcion ?? ""} />
      </CampoForm>
    </DialogoFormulario>
  );
}

export function DialogoCupon() {
  return (
    <DialogoFormulario disparador={<><PlusIcon /> Nuevo cupón</>} titulo="Nuevo cupón" descripcion="Código promocional aplicable en la inscripción en línea." accion={crearCupon} textoEnviar="Crear cupón">
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoForm etiqueta="Código" htmlFor="cu-codigo">
          <Input id="cu-codigo" name="codigo" required placeholder="PEDSAR15" className="h-10 font-mono uppercase" />
        </CampoForm>
        <CampoForm etiqueta="Descuento (%)" htmlFor="cu-pct">
          <Input id="cu-pct" name="porcentaje" type="number" min={1} max={100} defaultValue={10} className="h-10" />
        </CampoForm>
        <CampoForm etiqueta="Vigente hasta" htmlFor="cu-vig">
          <Input id="cu-vig" name="vigencia" type="date" required className="h-10" />
        </CampoForm>
        <CampoForm etiqueta="Límite de usos" htmlFor="cu-usos" ayuda="Vacío = ilimitado">
          <Input id="cu-usos" name="usos" type="number" min={1} className="h-10" />
        </CampoForm>
      </div>
    </DialogoFormulario>
  );
}

export function DialogoUsuario() {
  return (
    <DialogoFormulario
      disparador={<><UserPlusIcon /> Nuevo usuario</>}
      titulo="Nuevo usuario"
      descripcion="Le enviaremos un correo de invitación para que cree su contraseña."
      accion={invitarUsuario}
      textoEnviar="Enviar invitación"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoForm etiqueta="Nombres" htmlFor="u-nom">
          <Input id="u-nom" name="nombres" required className="h-10" />
        </CampoForm>
        <CampoForm etiqueta="Apellidos" htmlFor="u-ape">
          <Input id="u-ape" name="apellidos" required className="h-10" />
        </CampoForm>
        <CampoForm etiqueta="Correo electrónico" htmlFor="u-correo" className="sm:col-span-2">
          <Input id="u-correo" name="correo" type="email" required className="h-10" />
        </CampoForm>
        <CampoForm etiqueta="Rol" htmlFor="u-rol">
          <select id="u-rol" name="rol" defaultValue="instructor" className={claseControl}>
            <option value="estudiante">Estudiante</option>
            <option value="instructor">Instructor</option>
            <option value="administrador">Administrador</option>
          </select>
        </CampoForm>
        <CampoForm etiqueta="Especialidad" htmlFor="u-esp" ayuda="Solo instructores">
          <Input id="u-esp" name="especialidad" className="h-10" />
        </CampoForm>
      </div>
    </DialogoFormulario>
  );
}
