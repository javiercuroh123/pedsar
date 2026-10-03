import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlertIcon } from "lucide-react";
import { LoginForm } from "@/features/usuarios/formularios";

export const metadata: Metadata = { title: "Iniciar sesión" };

const ERRORES: Record<string, string> = {
  "cuenta-inactiva": "Tu cuenta está desactivada. Contacta con el administrador.",
  "enlace-invalido": "El enlace no es válido o ya venció. Solicita uno nuevo.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const mensajeError = typeof error === "string" ? ERRORES[error] : undefined;
  return (
    <>
      <h1 className="text-[1.875rem] leading-tight font-semibold tracking-tight">Bienvenido de nuevo</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">Accede a tus cursos, pagos y certificados.</p>
      {mensajeError && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
          {mensajeError}
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-primary hover:underline">
          Regístrate gratis
        </Link>
      </p>
    </>
  );
}
