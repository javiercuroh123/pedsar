"use client";

import { CheckCircle2Icon, CircleAlertIcon, CircleIcon, EyeIcon, EyeOffIcon, MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  actualizarContrasena,
  iniciarSesion,
  registrarse,
  solicitarRecuperacion,
} from "./acciones";
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
        "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
        estado.ok
          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
      )}
    >
      {estado.ok ? <MailCheckIcon className="mt-0.5 size-4 shrink-0" /> : <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />}
      {estado.mensaje}
    </p>
  );
}

const botonPrincipal = "h-10 w-full bg-linear-to-r from-brand-600 to-violet-600 text-sm shadow-md shadow-brand-600/25 hover:opacity-90";

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
          <li key={r.t} className={cn("flex items-center gap-1", ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
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
  if (estado.ok) {
    return (
      <div className="rounded-2xl bg-emerald-50 p-6 text-center text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" role="status">
        <MailCheckIcon className="mx-auto size-10" />
        <p className="mt-3 font-semibold">¡Cuenta creada!</p>
        <p className="mt-1 text-sm">{estado.mensaje}</p>
      </div>
    );
  }
  return (
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
        {pendiente ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
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

export function NuevaContrasenaForm() {
  const [estado, accion, pendiente] = useActionState(actualizarContrasena, {});
  const [clave, setClave] = useState("");
  return (
    <form action={accion} className="max-w-md space-y-4">
      <Campo
        nombre="contrasena"
        etiqueta="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        estado={estado}
        required
        value={clave}
        onChange={(e) => setClave(e.target.value)}
      />
      <ReglasContrasena valor={clave} />
      <Campo nombre="confirmar" etiqueta="Confirmar contraseña" type="password" autoComplete="new-password" estado={estado} required />
      <Mensaje estado={estado} />
      <Button type="submit" disabled={pendiente} className="h-10 px-5">
        {pendiente ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
