/**
 * Gráfico de dona sin JavaScript: cada segmento se traza con una animación al cargar.
 * Los colores usan los tokens de gráficos (--chart-*), que cambian con el tema.
 */
export function GraficoDona({
  datos,
  total,
  etiqueta,
}: {
  datos: { clave: string; etiqueta: string; valor: number; color: string }[];
  total: number;
  etiqueta: string;
}) {
  const r = 70;
  const circunferencia = 2 * Math.PI * r;
  const separacion = datos.filter((d) => d.valor > 0).length > 1 ? 3 : 0;
  const largos = datos.map((d) => (total ? (d.valor / total) * circunferencia : 0));
  const inicios = largos.map((_, i) => largos.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <figure className="flex flex-col items-center gap-6" aria-label={etiqueta}>
      <div className="relative size-44">
        <svg viewBox="0 0 180 180" className="size-full -rotate-90" aria-hidden>
          <circle cx="90" cy="90" r={r} fill="none" strokeWidth="22" className="stroke-muted" />
          {datos.map((d, i) => {
            const largo = largos[i];
            const offset = -inicios[i];
            if (!largo) return null;
            return (
              <circle
                key={d.clave}
                cx="90"
                cy="90"
                r={r}
                fill="none"
                strokeWidth="22"
                stroke={d.color}
                strokeDasharray={`${Math.max(largo - separacion, 0)} ${circunferencia}`}
                strokeDashoffset={offset}
                className="animar-trazo"
                style={{ "--c": circunferencia, "--i": i } as React.CSSProperties}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{total}</span>
          <span className="text-xs text-muted-foreground">cursos</span>
        </div>
      </div>
      <ul className="w-full space-y-2.5 text-sm">
        {datos.map((d) => (
          <li key={d.clave} className="flex items-center gap-2.5">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} />
            <span className="flex-1">{d.etiqueta}</span>
            <span className="font-medium tabular-nums">
              {d.valor} · {total ? Math.round((d.valor / total) * 100) : 0} %
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
