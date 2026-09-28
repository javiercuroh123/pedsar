import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, KeyRoundIcon } from "lucide-react";
import { RecuperarForm } from "@/features/usuarios/formularios";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecuperarPage() {
  return (
    <>
      <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Volver
      </Link>
      <span className="mt-6 grid size-12 place-items-center rounded-2xl bg-linear-to-br from-orange-400 to-rose-500 text-white shadow-md">
        <KeyRoundIcon className="size-5" />
      </span>
      <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Restablece tu contraseña</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        Te enviaremos un enlace único para crear una nueva contraseña. El enlace vence en 24 horas.
      </p>
      <RecuperarForm />
    </>
  );
}
