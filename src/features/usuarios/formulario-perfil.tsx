"use client";

import { Trash2Icon, UploadIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { AvatarIniciales } from "@/components/comunes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { actualizarPerfil } from "./acciones-perfil";
import type { EstadoFormulario } from "./esquemas";

interface Props {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  documento: string | null;
  especialidad: string | null;
  avatar: string | null;
  esStaff: boolean;
}

/** Datos personales y foto (bucket público "avatares", carpeta propia del usuario). */
export function FormularioPerfil(p: Props) {
  const [avatar, setAvatar] = useState(p.avatar ?? "");
  const [subiendo, setSubiendo] = useState(false);
  const [, accion, pendiente] = useActionState(async (previo: EstadoFormulario, datos: FormData) => {
    const r = await actualizarPerfil(previo, datos);
    (r.ok ? toast.success : toast.error)(r.mensaje ?? "");
    return r;
  }, {});

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

  return (
    <form action={accion} className="rounded-2xl border bg-card p-6 shadow-xs">
      <input type="hidden" name="avatarUrl" value={avatar} />
      <div className="flex flex-wrap items-center gap-4">
        <AvatarIniciales nombre={nombre} src={avatar || null} className="size-16 text-lg ring-4 ring-brand-100 dark:ring-brand-500/20" />
        <div className="flex gap-2">
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <UploadIcon className="size-3.5" /> {subiendo ? "Subiendo…" : "Cambiar foto"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={subiendo} onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
          </label>
          {avatar && (
            <Button type="button" variant="ghost" onClick={() => setAvatar("")}>
              <Trash2Icon /> Quitar
            </Button>
          )}
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="p-nombres">Nombres</Label>
          <Input id="p-nombres" name="nombres" required defaultValue={p.nombres} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-apellidos">Apellidos</Label>
          <Input id="p-apellidos" name="apellidos" required defaultValue={p.apellidos} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-correo">Correo electrónico</Label>
          <Input id="p-correo" value={p.correo} disabled className="h-10" />
          <p className="text-xs text-muted-foreground">Verificado · no editable</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-tel">Celular</Label>
          <Input id="p-tel" name="telefono" inputMode="tel" defaultValue={p.telefono ?? ""} className="h-10 font-mono" />
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
      </div>
      <div className="mt-6 flex justify-end border-t pt-4">
        <Button type="submit" disabled={pendiente || subiendo} className="h-9 px-4">
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
