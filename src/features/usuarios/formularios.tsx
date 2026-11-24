"use client";

import { CheckCircle2Icon, CircleAlertIcon, CircleIcon, EyeIcon, EyeOffIcon, MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  aceptarTerminos,
  actualizarContrasena,
  cerrarSesion,
  iniciarSesion,
  registrarse,
  solicitarRecuperacion,
} from "./acciones";
import { BotonGoogle } from "./boton-google";
import type { EstadoFormulario } from "./esquemas";

function Campo({
  nombre,
  etiqueta,
  estado,
  extra,
  ...props
}: { nombre: string; etiqueta: string; estado: EstadoFormulario; extra?: React.ReactNode } & React.ComponentProps<"input">) {
  const [visible, setVisible] = useState(false);
  const error = estado.errores?.[nombre]?.[0];
  const esClave = props.type === "password";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={nombre}>{etiqueta}</Label>
        {extra}
      </div>
      <div className="relative">
        <Input
          id={nombre}
          name={nombre}
          aria-invalid={!!error}
          aria-describedby={error ? `${nombre}-error` : undefined}
          {...props}
          type={esClave && visible ? "text" : props.type}
          className={cn("h-10", esClave && "pr-10")}
        />
        {esClave && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${nombre}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function Mensaje({ estado }: { estado: EstadoFormulario }) {
  if (!estado.mensaje) return null;
  return (
    <p
      role="status"
      className={cn(
        "animar-escala flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm",
        estado.ok
          ? "bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300"
          : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
      )}
    >
      {estado.ok ? <MailCheckIcon className="mt-0.5 size-4 shrink-0" /> : <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />}
      {estado.mensaje}
    </p>
  );
}

const botonPrincipal = "h-11 w-full text-[0.95rem]";

export function LoginForm({ next }: { next?: string }) {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, {});
  return (
    <form action={accion} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Campo nombre="correo" etiqueta="Correo electrónico" type="email" autoComplete="email" placeholder="tu@correo.com" estado={estado} required />
      <Campo
        nombre="contrasena"
        etiqueta="Contraseña"
        type="password"
        autoComplete="current-password"
        estado={estado}
        required
        extra={
          <Link href="/recuperar" className="text-xs font-medium text-primary hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        }
      />
      <Label className="items-center gap-2 font-normal text-muted-foreground">
        <input type="checkbox" name="recordar" defaultChecked className="size-4" />
        <span>Recordar sesión en este dispositivo</span>
      </Label>
      <Mensaje estado={estado} />
      <Button type="submit" className={botonPrincipal} disabled={pendiente}>
        {pendiente ? "Ingresando…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}

const REGLAS = [
  { t: "Mínimo 8 caracteres", ok: (v: string) => v.length >= 8 },
  { t: "Una letra mayúscula", ok: (v: string) => /[A-Z]/.test(v) },
  { t: "Un número", ok: (v: string) => /[0-9]/.test(v) },
];

function ReglasContrasena({ valor }: { valor: string }) {
  return (
    <ul className="grid grid-cols-3 gap-2 text-xs" aria-label="Requisitos de la contraseña">
      {REGLAS.map((r) => {
        const ok = r.ok(valor);
        return (
          <li key={r.t} className={cn("flex items-center gap-1", ok ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
            {ok ? <CheckCircle2Icon className="size-3.5 shrink-0" /> : <CircleIcon className="size-3.5 shrink-0" />}
            {r.t}
          </li>
        );
      })}
    </ul>
  );
}

export function RegistroForm() {
  const [estado, accion, pendiente] = useActionState(registrarse, {});
  const [clave, setClave] = useState("");
  const [acepta, setAcepta] = useState(false);
  if (estado.ok) {
    return (
      <div className="rounded-2xl bg-green-50 p-6 text-center text-green-800 dark:bg-green-500/10 dark:text-green-300" role="status">
        <MailCheckIcon className="mx-auto size-10" />
        <p className="mt-3 font-semibold">¡Cuenta creada!</p>
        <p className="mt-1 text-sm">{estado.mensaje}</p>
      </div>
    );
  }
  return (
    <>
      <form action={accion} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo nombre="nombres" etiqueta="Nombres" autoComplete="given-name" estado={estado} required />
          <Campo nombre="apellidos" etiqueta="Apellidos" autoComplete="family-name" estado={estado} required />
        </div>
        <Campo nombre="correo" etiqueta="Correo electrónico" type="email" autoComplete="email" placeholder="tu@correo.com" estado={estado} required />
        <Campo
          nombre="contrasena"
          etiqueta="Contraseña"
          type="password"
          autoComplete="new-password"
          estado={estado}
          required
          value={clave}
          onChange={(e) => setClave(e.target.value)}
        />
        <ReglasContrasena valor={clave} />
        <Campo nombre="confirmar" etiqueta="Confirmar contraseña" type="password" autoComplete="new-password" estado={estado} required />
        <Label className="items-start gap-2 font-normal text-muted-foreground">
          <input type="checkbox" name="aceptaPrivacidad" className="mt-0.5 size-4" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
          <span>
            Acepto la{" "}
            <Link href="/privacidad" className="font-medium text-primary hover:underline">
              política de privacidad
            </Link>{" "}
            y el tratamiento de mis datos personales (Ley N° 29733).
          </span>
        </Label>
        {estado.errores?.aceptaPrivacidad && <p className="text-xs text-destructive">{estado.errores.aceptaPrivacidad[0]}</p>}
        <Mensaje estado={estado} />
        <Button type="submit" className={botonPrincipal} disabled={pendiente}>
          {pendiente ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>
      <BotonGoogle acepta={acepta} deshabilitado={!acepta} aviso="Marca la casilla de la política de privacidad para continuar con Google." />
    </>
  );
}

/** HU-45 · Aceptación pendiente de la política para quien entró con Google. */
export function TerminosForm({ next }: { next?: string }) {
  const [estado, accion, pendiente] = useActionState(aceptarTerminos, {});
  return (
    <div className="space-y-3">
      <form action={accion} className="space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <Label className="items-start gap-2 font-normal text-muted-foreground">
          <input type="checkbox" name="aceptaPrivacidad" className="mt-0.5 size-4" />
          <span>
            Acepto la{" "}
            <Link href="/privacidad" className="font-medium text-primary hover:underline">
              política de privacidad
            </Link>{" "}
            y el tratamiento de mis datos personales (Ley N° 29733).
          </span>
        </Label>
        {estado.errores?.aceptaPrivacidad && <p className="text-xs text-destructive">{estado.errores.aceptaPrivacidad[0]}</p>}
        <Mensaje estado={estado} />
        <Button type="submit" className={botonPrincipal} disabled={pendiente}>
          {pendiente ? "Guardando…" : "Aceptar y continuar"}
        </Button>
      </form>
      <form action={cerrarSesion}>
        <Button type="submit" variant="ghost" className="h-10 w-full text-muted-foreground">
          Cancelar y cerrar sesión
        </Button>
      </form>
    </div>
  );
}

export function RecuperarForm() {
  const [estado, accion, pendiente] = useActionState(solicitarRecuperacion, {});
  return (
    <form action={accion} className="space-y-4">
      <Campo nombre="correo" etiqueta="Correo electrónico" type="email" autoComplete="email" placeholder="tu@correo.com" estado={estado} required />
      <Mensaje estado={estado} />
      <Button type="submit" className={botonPrincipal} disabled={pendiente}>
        {pendiente ? "Enviando…" : "Enviar enlace"}
      </Button>
    </form>
  );
}

/**
 * Nueva contraseña (recuperación y perfil). En el perfil se usa plegable: `alCancelar`
 * muestra el botón «Cancelar» y `alGuardar` se llama cuando el cambio se guardó.
 */
export function NuevaContrasenaForm({ alCancelar, alGuardar }: { alCancelar?: () => void; alGuardar?: () => void } = {}) {
  const [estado, accion, pendiente] = useActionState(actualizarContrasena, {});
  const [clave, setClave] = useState("");
  useEffect(() => {
    if (estado.ok) alGuardar?.();
  }, [estado, alGuardar]);
  return (
    <form
      action={accion}
      onKeyDown={(e) => alCancelar && e.key === "Escape" && !pendiente && alCancelar()}
      className="max-w-md space-y-4"
    >
      <Campo
        nombre="contrasena"
        etiqueta="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        estado={estado}
        required
        autoFocus={Boolean(alCancelar)}
        value={clave}
        onChange={(e) => setClave(e.target.value)}
      />
      <ReglasContrasena valor={clave} />
      <Campo nombre="confirmar" etiqueta="Confirmar contraseña" type="password" autoComplete="new-password" estado={estado} required />
      {/* En el perfil, el éxito lo avisa quien pliega el formulario (toast). */}
      {(!alGuardar || !estado.ok) && <Mensaje estado={estado} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pendiente} className="h-10 px-5">
          {pendiente ? "Guardando…" : "Guardar contraseña"}
        </Button>
        {alCancelar && (
          <Button type="button" variant="ghost" onClick={alCancelar} disabled={pendiente} className="h-10 px-4">
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
