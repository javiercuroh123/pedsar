"use client";

import { BadgeCheckIcon, PencilIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CampoCelular } from "@/components/campo-celular";
import { AvatarIniciales } from "@/components/comunes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatearFecha } from "@/lib/formato";
import { createClient } from "@/lib/supabase/client";
import { formatearCelular } from "@/lib/telefono";
import { actualizarPerfil } from "./acciones-perfil";
import type { EstadoFormulario } from "./esquemas";

interface Props {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  fechaNacimiento?: string | null;
  documento: string | null;
  especialidad: string | null;
  /** HU-34 · Presentación pública (solo personal: instructor o administrador). */
  biografia?: string | null;
  avatar: string | null;
  esStaff: boolean;
  /** «Administrador», «Instructor» o «Estudiante». */
  etiquetaRol?: string;
}

/** Un dato en modo lectura; vacío se muestra como «Sin registrar». */
function Dato({ etiqueta, valor, mono, extra }: { etiqueta: string; valor?: string | null; mono?: boolean; extra?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{etiqueta}</dt>
      <dd className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-sm">
        {valor ? (
          <span className={mono ? "font-mono tracking-wide" : "truncate"}>{valor}</span>
        ) : (
          <span className="text-muted-foreground italic">Sin registrar</span>
        )}
        {extra}
      </dd>
    </div>
  );
}

/**
 * HU-15 · Datos personales y foto. Se muestran en modo lectura; el botón «Editar»
 * habilita los campos con «Cancelar» (descarta) y «Guardar cambios». La foto va al
 * bucket público "avatares", en la carpeta propia del usuario.
 */
export function FormularioPerfil(p: Props) {
  const [editando, setEditando] = useState(false);
  const [avatar, setAvatar] = useState(p.avatar ?? "");
  const [subiendo, setSubiendo] = useState(false);
  const [largoBio, setLargoBio] = useState((p.biografia ?? "").length);
  const botonEditar = useRef<HTMLButtonElement>(null);
  const volverAlBoton = useRef(false);

  const [, accion, pendiente] = useActionState(async (previo: EstadoFormulario, datos: FormData) => {
    const r = await actualizarPerfil(previo, datos);
    (r.ok ? toast.success : toast.error)(r.mensaje ?? "");
    if (r.ok) cerrar();
    return r;
  }, {});

  // Al salir de la edición, el foco vuelve al botón «Editar» (teclado y lectores de pantalla).
  useEffect(() => {
    if (!editando && volverAlBoton.current) {
      volverAlBoton.current = false;
      botonEditar.current?.focus();
    }
  }, [editando]);

  const abrir = () => {
    setAvatar(p.avatar ?? "");
    setLargoBio((p.biografia ?? "").length);
    setEditando(true);
  };
  function cerrar() {
    volverAlBoton.current = true;
    setEditando(false);
  }
  const cancelar = () => {
    setAvatar(p.avatar ?? "");
    cerrar();
  };

  const subir = async (archivo: File) => {
    if (archivo.size > 2 * 1024 * 1024) return toast.error("La imagen supera 2 MB");
    setSubiendo(true);
    const supabase = createClient();
    const ruta = `${p.id}/avatar-${Date.now()}.${archivo.name.split(".").pop() ?? "jpg"}`;
    const { error } = await supabase.storage.from("avatares").upload(ruta, archivo, { upsert: true, contentType: archivo.type });
    setSubiendo(false);
    if (error) return toast.error(`No se pudo subir: ${error.message}`);
    setAvatar(supabase.storage.from("avatares").getPublicUrl(ruta).data.publicUrl);
    toast.info("Foto lista. Guarda los cambios para aplicarla.");
  };

  const nombre = `${p.nombres} ${p.apellidos}`.trim() || p.correo;

  const cabecera = (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <AvatarIniciales
          nombre={nombre}
          src={(editando ? avatar : p.avatar) || null}
          className="size-16 text-lg ring-4 ring-brand-100 dark:ring-brand-500/20"
        />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{nombre}</p>
          {editando ? (
            <div className="mt-1.5 flex flex-wrap gap-2">
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
                <UploadIcon className="size-3.5" /> {subiendo ? "Subiendo…" : "Cambiar foto"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={subiendo}
                  onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])}
                />
              </label>
              {avatar && (
                <Button type="button" variant="ghost" onClick={() => setAvatar("")}>
                  <Trash2Icon /> Quitar
                </Button>
              )}
            </div>
          ) : (
            p.etiquetaRol && <p className="text-sm text-muted-foreground">{p.etiquetaRol}</p>
          )}
        </div>
      </div>
      {editando ? (
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30">
          Editando
        </span>
      ) : (
        <Button ref={botonEditar} type="button" variant="outline" onClick={abrir} className="h-9 px-3.5">
          <PencilIcon /> Editar
        </Button>
      )}
    </div>
  );

  if (!editando) {
    return (
      <section aria-label="Datos personales" className="rounded-2xl border bg-card p-6 shadow-xs">
        {cabecera}
        <dl className="mt-6 grid gap-x-6 gap-y-5 border-t pt-6 sm:grid-cols-2">
          <Dato etiqueta="Nombres" valor={p.nombres} />
          <Dato etiqueta="Apellidos" valor={p.apellidos} />
          <Dato
            etiqueta="Correo electrónico"
            valor={p.correo}
            extra={
              <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                <BadgeCheckIcon className="size-3.5" /> Verificado
              </span>
            }
          />
          <Dato etiqueta="Celular" valor={p.telefono ? `+51 ${formatearCelular(p.telefono)}` : null} mono />
          <Dato etiqueta="Fecha de nacimiento" valor={p.fechaNacimiento ? formatearFecha(p.fechaNacimiento) : null} />
          <Dato etiqueta="DNI / CE" valor={p.documento} mono />
          {p.esStaff && <Dato etiqueta="Especialidad" valor={p.especialidad} />}
          {p.esStaff && (
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Biografía</dt>
              <dd className="mt-1 text-sm">
                {p.biografia ? (
                  <p className="leading-relaxed break-words whitespace-pre-line">{p.biografia}</p>
                ) : (
                  <span className="text-muted-foreground italic">Sin registrar · se muestra en el detalle de tus cursos</span>
                )}
              </dd>
            </div>
          )}
        </dl>
      </section>
    );
  }

  return (
    <form
      action={accion}
      aria-label="Editar datos personales"
      onKeyDown={(e) => e.key === "Escape" && !pendiente && cancelar()}
      className="rounded-2xl border bg-card p-6 shadow-xs ring-2 ring-brand-100 dark:ring-brand-500/20"
    >
      <input type="hidden" name="avatarUrl" value={avatar} />
      {cabecera}
      <div className="mt-6 grid gap-4 border-t pt-6 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="p-nombres">Nombres</Label>
          <Input id="p-nombres" name="nombres" required autoFocus defaultValue={p.nombres} autoComplete="given-name" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-apellidos">Apellidos</Label>
          <Input id="p-apellidos" name="apellidos" required defaultValue={p.apellidos} autoComplete="family-name" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-correo">Correo electrónico</Label>
          <Input id="p-correo" value={p.correo} disabled className="h-10" />
          <p className="text-xs text-muted-foreground">Verificado · no editable</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-tel">Celular</Label>
          <CampoCelular id="p-tel" name="telefono" defaultValue={p.telefono} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-nac">Fecha de nacimiento</Label>
          <Input id="p-nac" name="fechaNacimiento" type="date" defaultValue={p.fechaNacimiento ?? ""} autoComplete="bday" className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-doc">DNI / CE</Label>
          <Input id="p-doc" name="documento" defaultValue={p.documento ?? ""} className="h-10 font-mono" />
        </div>
        {p.esStaff && (
          <div className="space-y-1.5">
            <Label htmlFor="p-esp">Especialidad</Label>
            <Input id="p-esp" name="especialidad" defaultValue={p.especialidad ?? ""} className="h-10" />
          </div>
        )}
        {p.esStaff && (
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="p-bio">Biografía</Label>
              <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
                {largoBio}/600
              </span>
            </div>
            <Textarea
              id="p-bio"
              name="biografia"
              rows={4}
              maxLength={600}
              defaultValue={p.biografia ?? ""}
              onChange={(e) => setLargoBio(e.target.value.length)}
              aria-describedby="p-bio-ayuda"
              placeholder="Tu formación, experiencia y lo que enseñas"
            />
            <p id="p-bio-ayuda" className="text-xs text-muted-foreground">
              Se muestra a los visitantes en el detalle de tus cursos.
            </p>
          </div>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={cancelar} disabled={pendiente} className="h-9 px-4">
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente || subiendo} className="h-9 px-4">
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
