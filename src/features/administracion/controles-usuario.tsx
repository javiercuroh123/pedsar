"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { alternarUsuario, cambiarRol } from "./acciones";

const ROLES = [
  { v: "estudiante", t: "Estudiante" },
  { v: "instructor", t: "Instructor" },
  { v: "administrador", t: "Administrador" },
];

export function SelectorRol({ id, rol, nombre, deshabilitado }: { id: string; rol: string; nombre: string; deshabilitado?: boolean }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <select
      aria-label={`Rol de ${nombre}`}
      defaultValue={rol}
      disabled={pendiente || deshabilitado}
      onChange={(e) => {
        const datos = new FormData();
        datos.set("id", id);
        datos.set("rol", e.target.value);
        iniciar(async () => {
          await cambiarRol(datos);
          toast.success(`Rol actualizado a ${ROLES.find((r) => r.v === e.target.value)?.t}`);
        });
      }}
      className="h-8 w-40 rounded-lg border border-input bg-card px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      {ROLES.map((r) => (
        <option key={r.v} value={r.v}>
          {r.t}
        </option>
      ))}
    </select>
  );
}

export function InterruptorUsuario({ id, activo, deshabilitado }: { id: string; activo: boolean; deshabilitado?: boolean }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={activo ? "Desactivar usuario" : "Activar usuario"}
        disabled={pendiente || deshabilitado}
        onClick={() => {
          const datos = new FormData();
          datos.set("id", id);
          datos.set("estado", String(!activo));
          iniciar(async () => {
            await alternarUsuario(datos);
            toast.success(activo ? "Usuario desactivado" : "Usuario activado");
          });
        }}
        className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50", activo ? "bg-emerald-500" : "bg-input")}
      >
        <span className={cn("absolute left-0.5 size-4 rounded-full bg-white shadow transition-transform", activo && "translate-x-4")} />
      </button>
      <span className={cn("text-xs", !activo && "text-muted-foreground")}>{activo ? "Activo" : "Inactivo"}</span>
    </div>
  );
}
