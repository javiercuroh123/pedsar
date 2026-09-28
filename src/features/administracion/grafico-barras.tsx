/**
 * Gráfico de barras de una sola serie (sin JavaScript). Un solo tono: la
 * serie la nombra el título, así que no lleva leyenda. Cada barra muestra su
 * valor al pasar el cursor o enfocarla, y el último periodo va etiquetado.
 */
export function GraficoBarras({ datos, etiqueta }: { datos: { clave: string; etiqueta: string; valor: number }[]; etiqueta: string }) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  // Escala "redonda" para la rejilla (3 líneas).
  const paso = Math.max(1, Math.ceil(max / 3 / 5) * 5);
  const tope = paso * 3;

  return (
    <figure className="relative mt-6" aria-label={etiqueta}>
      <div className="relative h-60">
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between" aria-hidden>
          {[3, 2, 1, 0].map((n) => (
            <div key={n} className="relative border-t border-dashed border-border first:border-transparent last:border-solid">
              <span className="absolute -top-2 left-0 bg-card pr-1 font-mono text-[10px] text-muted-foreground">{n * paso}</span>
            </div>
          ))}
        </div>
        <ol className="relative flex h-full items-stretch gap-[2px] pl-7">
          {datos.map((d, i) => {
            const ultimo = i === datos.length - 1;
            return (
              <li key={d.clave} className="group flex flex-1 flex-col items-center gap-2">
                <div className="relative w-full flex-1" tabIndex={0} aria-label={`${d.etiqueta}: ${d.valor}`}>
                  <div
                    className={`absolute inset-x-0 bottom-0 mx-auto max-w-9 rounded-t-[4px] transition-colors ${
                      ultimo ? "bg-brand-600 dark:bg-brand-400" : "bg-brand-300 group-hover:bg-brand-500 dark:bg-brand-500/50 dark:group-hover:bg-brand-400"
                    }`}
                    style={{ height: `${(d.valor / tope) * 100}%` }}
                  >
                    <span
                      className={`absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap text-background ${
                        ultimo ? "" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                      }`}
                    >
                      {d.valor}
                    </span>
                  </div>
                </div>
                <span className="h-4 text-[11px] text-muted-foreground capitalize">{d.etiqueta}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Ver datos en tabla</summary>
        <table className="mt-2 w-full max-w-sm">
          <tbody>
            {datos.map((d) => (
              <tr key={d.clave} className="border-b last:border-0">
                <td className="py-1 capitalize">{d.etiqueta}</td>
                <td className="py-1 text-right font-mono text-foreground">{d.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
