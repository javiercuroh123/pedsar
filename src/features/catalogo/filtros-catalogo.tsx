"use client";

import { ChevronDownIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ETIQUETA_MODALIDAD, ETIQUETA_NIVEL } from "@/lib/formato";

export const PRECIO_TOPE = 1000;

export interface ValoresFiltro {
  q: string;
  categorias: string[];
  niveles: string[];
  modalidades: string[];
  precioMax: number;
  orden: string;
}

function Casilla({ nombre, valor, etiqueta, marcada, conteo }: { nombre: string; valor: string; etiqueta: string; marcada: boolean; conteo?: number }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-muted">
      <input type="checkbox" name={nombre} value={valor} defaultChecked={marcada} className="size-4 rounded" />
      <span className="flex-1">{etiqueta}</span>
      {conteo !== undefined && <span className="font-mono text-xs text-muted-foreground">{conteo}</span>}
    </label>
  );
}

/**
 * Filtros del catálogo (HU-05 / HU-33). Es un formulario GET: cada cambio navega
 * a /cursos?… en el cliente, y la página se vuelve a renderizar en el servidor.
 */
export function FiltrosCatalogo({
  valores,
  categorias,
  conteoCategorias,
  children,
}: {
  valores: ValoresFiltro;
  categorias: { slug: string; nombre: string }[];
  conteoCategorias: Record<string, number>;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [precio, setPrecio] = useState(valores.precioMax);

  // Si la URL cambia desde fuera (chips, "Limpiar filtros", atrás/adelante), refleja los valores
  // en el formulario sin volver a montarlo, para no perder el foco mientras se escribe.
  const firma = JSON.stringify(valores);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const v: ValoresFiltro = JSON.parse(firma);
    const marcados: Record<string, string[]> = { categoria: v.categorias, nivel: v.niveles, modalidad: v.modalidades };
    form.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach((i) => {
      i.checked = marcados[i.name]?.includes(i.value) ?? false;
    });
    const q = form.elements.namedItem("q") as HTMLInputElement | null;
    if (q && document.activeElement !== q) q.value = v.q;
    const orden = form.elements.namedItem("orden") as HTMLSelectElement | null;
    if (orden) orden.value = v.orden;
    setPrecio(v.precioMax);
  }, [firma]);

  const enviar = (retraso = 0) => {
    clearTimeout(espera.current);
    espera.current = setTimeout(() => formRef.current?.requestSubmit(), retraso);
  };

  const onChange = (e: React.FormEvent<HTMLFormElement>) => {
    const t = e.target as HTMLInputElement;
    if (t.name === "q") enviar(450);
    else if (t.type === "range") enviar(300);
    else enviar();
  };

  const bloques = [
    {
      titulo: "Categoría",
      contenido: categorias.map((c) => (
        <Casilla
          key={c.slug}
          nombre="categoria"
          valor={c.slug}
          etiqueta={c.nombre}
          marcada={valores.categorias.includes(c.slug)}
          conteo={conteoCategorias[c.slug] ?? 0}
        />
      )),
    },
    {
      titulo: "Nivel",
      contenido: Object.entries(ETIQUETA_NIVEL).map(([v, t]) => (
        <Casilla key={v} nombre="nivel" valor={v} etiqueta={t} marcada={valores.niveles.includes(v)} />
      )),
    },
    {
      titulo: "Modalidad",
      contenido: Object.entries(ETIQUETA_MODALIDAD).map(([v, t]) => (
        <Casilla key={v} nombre="modalidad" valor={v} etiqueta={t} marcada={valores.modalidades.includes(v)} />
      )),
    },
  ];

  return (
    <Form ref={formRef} action="/cursos" replace scroll={false} onChange={onChange} className="mt-8 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="animar-entrada lg:sticky lg:top-24 lg:self-start [--i:2]">
        <details className="group rounded-2xl border bg-card p-4 shadow-xs lg:open:block" open>
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold lg:pointer-events-none">
            <span className="flex items-center gap-2">
              <SlidersHorizontalIcon className="size-4 text-primary" />
              Filtros
            </span>
            <ChevronDownIcon className="size-4 transition group-open:rotate-180 lg:hidden" />
          </summary>
          <div className="mt-4 space-y-5">
            {bloques.map((b) => (
              <fieldset key={b.titulo}>
                <legend className="mb-1.5 px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{b.titulo}</legend>
                <div className="space-y-0.5">{b.contenido}</div>
              </fieldset>
            ))}
            <fieldset className="px-2">
              <legend className="flex w-full justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Precio máximo
                <span className="font-mono font-semibold text-primary normal-case">S/ {precio}</span>
              </legend>
              <input
                type="range"
                name="precio"
                min={50}
                max={PRECIO_TOPE}
                step={10}
                value={precio}
                onChange={(e) => setPrecio(Number(e.target.value))}
                className="mt-3 w-full"
                aria-label="Precio máximo"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>S/ 50</span>
                <span>S/ {PRECIO_TOPE}</span>
              </div>
            </fieldset>
            <Link href="/cursos" className={buttonVariants({ variant: "outline", className: "w-full" })}>
              Limpiar filtros
            </Link>
          </div>
        </details>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Buscar por nombre o instructor</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" type="search" defaultValue={valores.q} placeholder="Buscar por nombre o instructor" className="h-10 bg-card pl-9" />
          </label>
          <select
            name="orden"
            defaultValue={valores.orden}
            aria-label="Ordenar"
            className="h-10 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-56"
          >
            <option value="relevancia">Destacados primero</option>
            <option value="inicio">Próximo inicio</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
          </select>
          <noscript>
            <button type="submit" className={buttonVariants()}>
              Filtrar
            </button>
          </noscript>
        </div>
        {children}
      </div>
    </Form>
  );
}
