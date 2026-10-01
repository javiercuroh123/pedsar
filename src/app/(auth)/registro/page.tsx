import type { Metadata } from "next";
import Link from "next/link";
import { RegistroForm } from "@/features/usuarios/formularios";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegistroPage() {
  return (
    <>
      <h1 className="text-[1.875rem] leading-tight font-semibold tracking-tight">Crea tu cuenta</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">Regístrate para inscribirte en cursos y seguir tu progreso.</p>
      <RegistroForm />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </>
  );
}
