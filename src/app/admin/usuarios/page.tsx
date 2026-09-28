import type { Metadata } from "next";
import Form from "next/form";
import { SearchIcon, UsersIcon } from "lucide-react";
import { AvatarIniciales, EncabezadoPagina, EstadoVacio, PanelTabla, PestanasEnlace, Pildora, tabla, type ColorPildora } from "@/components/comunes";
import { Input } from "@/components/ui/input";
import { InterruptorUsuario, SelectorRol } from "@/features/administracion/controles-usuario";
import { DialogoUsuario } from "@/features/administracion/dialogos";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatearFecha, nombreCompleto } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Usuarios y roles" };

const PESTANAS = [
  { v: "todos", t: "Todos" },
  { v: "estudiante", t: "Estudiantes" },
  { v: "instructor", t: "Instructores" },
  { v: "administrador", t: "Administradores" },
];

const PERMISOS: [string, string, string, string][] = [
  ["Catálogo y cursos", "Gestionar", "Sus cursos", "Consultar"],
  ["Contenidos y sesiones", "Gestionar", "Gestionar", "Consultar"],
  ["Evaluaciones y notas", "Consultar", "Gestionar", "Rendir"],
  ["Inscripciones y pagos", "Gestionar", "—", "Propios"],
  ["Certificados", "Emitir", "Consultar", "Descargar"],
  ["Usuarios y roles", "Gestionar", "—", "—"],
  ["Reportes y auditoría", "Gestionar", "Sus cursos", "—"],
];
const COLOR_PERMISO = (x: string): ColorPildora => (x === "Gestionar" || x === "Emitir" ? "indigo" : x === "—" ? "gris" : "turquesa");

// HU-03 · HU-34 · HU-53 · Usuarios, roles y permisos
export default async function AdminUsuariosPage({ searchParams }: PageProps<"/admin/usuarios">) {
  const actual = await requireRol("administrador");
  const { rol, q } = await searchParams;
  const pestana = PESTANAS.some((p) => p.v === rol) ? (rol as string) : "todos";
  // Se quitan los caracteres con significado en los filtros de PostgREST.
  const texto = typeof q === "string" ? q.replace(/[,()*%]/g, " ").trim() : "";
  const supabase = await createClient();

  const [{ data }, { data: todos }] = await Promise.all([
    (() => {
      let c = supabase.from("perfiles").select("id, nombres, apellidos, correo, rol, estado, fecha_registro, avatar_url, especialidad").order("fecha_registro", { ascending: false }).limit(300);
      if (pestana !== "todos") c = c.eq("rol", pestana);
      if (texto) c = c.or(`nombres.ilike.%${texto}%,apellidos.ilike.%${texto}%,correo.ilike.%${texto}%`);
      return c;
    })(),
    supabase.from("perfiles").select("rol"),
  ]);
  const usuarios = (data ?? []) as {
    id: string;
    nombres: string;
    apellidos: string;
    correo: string;
    rol: string;
    estado: boolean;
    fecha_registro: string;
    avatar_url: string | null;
    especialidad: string | null;
  }[];
  const cuenta = (r: string) => (todos ?? []).filter((u: { rol: string }) => r === "todos" || u.rol === r).length;

  return (
    <div className="space-y-6">
      <EncabezadoPagina eyebrow="Sistema" titulo="Usuarios y roles" descripcion="Invita, edita, desactiva usuarios y asigna roles con permisos diferenciados.">
        <DialogoUsuario />
      </EncabezadoPagina>

      <PestanasEnlace
        activa={pestana}
        items={PESTANAS.map((p) => ({
          valor: p.v,
          etiqueta: (
            <>
              {p.t} <span className="font-mono text-xs text-muted-foreground">{cuenta(p.v)}</span>
            </>
          ),
          href: p.v === "todos" ? "/admin/usuarios" : `/admin/usuarios?rol=${p.v}`,
        }))}
      />

      <Form action="/admin/usuarios" className="relative max-w-md">
        {pestana !== "todos" && <input type="hidden" name="rol" value={pestana} />}
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" type="search" defaultValue={texto} placeholder="Buscar por nombre o correo" className="h-9 bg-card pl-9" aria-label="Buscar usuario" />
      </Form>

      {usuarios.length ? (
        <PanelTabla>
          <table className={cn(tabla.table, "min-w-225")}>
            <thead className={tabla.thead}>
              <tr>
                <th className={tabla.th}>Usuario</th>
                <th className={tabla.th}>Rol</th>
                <th className={tabla.th}>Estado</th>
                <th className={tabla.th}>Registro</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const nombre = nombreCompleto(u) || u.correo;
                const yo = u.id === actual.id;
                return (
                  <tr key={u.id} className={tabla.tr}>
                    <td className={tabla.td}>
                      <div className="flex items-center gap-3">
                        <AvatarIniciales nombre={nombre} src={u.avatar_url} />
                        <div className="min-w-0">
                          <p className="font-medium">
                            {nombre} {yo && <Pildora color="indigo">Tú</Pildora>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {u.correo}
                            {u.especialidad ? ` · ${u.especialidad}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={tabla.td}>
                      <SelectorRol id={u.id} rol={u.rol} nombre={nombre} deshabilitado={yo} />
                    </td>
                    <td className={tabla.td}>
                      <InterruptorUsuario id={u.id} activo={u.estado} deshabilitado={yo} />
                    </td>
                    <td className={cn(tabla.td, "text-muted-foreground")}>{formatearFecha(u.fecha_registro)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PanelTabla>
      ) : (
        <EstadoVacio icono={UsersIcon} titulo="No hay usuarios con este filtro" />
      )}

      <PanelTabla titulo="Matriz de permisos por rol">
        <table className={cn(tabla.table, "min-w-160")}>
          <thead className={tabla.thead}>
            <tr>
              <th className={tabla.th}>Módulo</th>
              <th className={cn(tabla.th, "text-center")}>Administrador</th>
              <th className={cn(tabla.th, "text-center")}>Instructor</th>
              <th className={cn(tabla.th, "text-center")}>Estudiante</th>
            </tr>
          </thead>
          <tbody>
            {PERMISOS.map(([modulo, ...valores]) => (
              <tr key={modulo} className={tabla.tr}>
                <td className={cn(tabla.td, "font-medium")}>{modulo}</td>
                {valores.map((v, i) => (
                  <td key={i} className={cn(tabla.td, "text-center")}>
                    <Pildora color={COLOR_PERMISO(v)}>{v}</Pildora>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </PanelTabla>
    </div>
  );
}
