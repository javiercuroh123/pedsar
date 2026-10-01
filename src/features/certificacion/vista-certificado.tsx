import { GraduationCapIcon, QrCodeIcon } from "lucide-react";
import { formatearFecha } from "@/lib/formato";

export interface DatosCertificado {
  estudiante: string;
  curso: string;
  duracion_horas: number;
  fecha_emision: string;
  codigo_unico: string;
  instructor?: string | null;
}

/**
 * Representación visual del certificado (HU-11). Escala con el ancho del
 * contenedor (unidades cqw), así sirve como miniatura y como vista completa.
 */
export function VistaCertificado({ datos }: { datos: DatosCertificado }) {
  return (
    <div
      className="relative aspect-[1.414/1] w-full overflow-hidden rounded-xl border bg-white text-zinc-900 shadow-sm [container-type:inline-size]"
      role="img"
      aria-label={`Certificado de ${datos.estudiante} por el curso ${datos.curso}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_0%_0%,#cffafe,transparent_70%),radial-gradient(50%_50%_at_100%_100%,#ffe4e6,transparent_70%)]" />
      <div className="absolute inset-[3%] rounded-md border-[0.4cqw] border-brand-700/80" />
      <div className="absolute inset-[4.4%] rounded-sm border border-brand-700/30" />
      <div className="relative flex h-full flex-col items-center justify-between px-[11%] py-[8%] text-center">
        <div className="flex items-center gap-[1.2cqw]" style={{ fontSize: "2.2cqw" }}>
          <span
            className="grid place-items-center rounded-[0.9cqw] bg-linear-to-br from-brand-400 to-brand-700 text-white"
            style={{ width: "3.8cqw", height: "3.8cqw" }}
          >
            <GraduationCapIcon style={{ width: "2.3cqw", height: "2.3cqw" }} />
          </span>
          <b className="tracking-tight">PEDSAR</b>
        </div>
        <div>
          <p className="font-semibold text-brand-700 uppercase" style={{ fontSize: "1.9cqw", letterSpacing: ".3em" }}>
            Certificado de aprobación
          </p>
          <p className="text-zinc-500" style={{ fontSize: "1.7cqw", marginTop: "2.2cqw" }}>
            Otorgado a
          </p>
          <p className="font-bold tracking-tight" style={{ fontSize: "4.4cqw", lineHeight: 1.15, marginTop: ".8cqw" }}>
            {datos.estudiante}
          </p>
          <p className="mx-auto text-zinc-600" style={{ fontSize: "1.7cqw", maxWidth: "80%", marginTop: "1.6cqw" }}>
            por haber aprobado el curso <b className="text-zinc-900">{datos.curso}</b>, con una duración de {datos.duracion_horas} horas
            académicas. Ica, {formatearFecha(datos.fecha_emision)}.
          </p>
        </div>
        <div className="grid w-full grid-cols-3 items-end" style={{ fontSize: "1.4cqw", gap: "4cqw" }}>
          <div>
            <div className="border-t border-zinc-400" style={{ paddingTop: "1cqw" }}>
              Gerencia General
            </div>
            <div className="text-zinc-500">PEDSAR E.I.R.L.</div>
          </div>
          <div className="flex flex-col items-center">
            <div
              className="grid place-items-center rounded border border-zinc-200 bg-white text-zinc-900"
              style={{ width: "9cqw", height: "9cqw" }}
            >
              <QrCodeIcon style={{ width: "7cqw", height: "7cqw" }} strokeWidth={1.6} />
            </div>
            <div className="font-mono" style={{ marginTop: ".8cqw" }}>
              {datos.codigo_unico}
            </div>
          </div>
          <div>
            <div className="border-t border-zinc-400" style={{ paddingTop: "1cqw" }}>
              {datos.instructor || "Coordinación académica"}
            </div>
            <div className="text-zinc-500">{datos.instructor ? "Instructor(a)" : "PEDSAR"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
