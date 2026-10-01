import { encode } from "uqr";
import { describe, expect, it } from "vitest";
import type { InscripcionEstudiante } from "@/features/academico/consultas";
import { datosCertificado, obtenerResultados, verificarCertificado } from "@/features/certificacion/consultas";
import { generarPdfCertificado, type DatosPdfCertificado } from "@/features/certificacion/pdf-certificado";
import { trazadoQr, urlVerificacion } from "@/features/certificacion/qr";
import { leerPdf } from "../../apoyo/archivos";
import { entorno, responder } from "../../apoyo/entorno";

describe("QR de verificación", () => {
  it("dibuja un cuadrado por cada módulo oscuro, sin margen", () => {
    const url = urlVerificacion("https://pedsar.test", "PED-2026-ABCDEFGH");
    expect(url).toBe("https://pedsar.test/verificar?codigo=PED-2026-ABCDEFGH");
    const qr = encode(url, { ecc: "M", border: 0 });
    const { modulos, d } = trazadoQr(url);
    expect(modulos).toBe(qr.size);
    const oscuros = qr.data.flat().filter(Boolean).length;
    expect(d.match(/h1v1h-1z/g)).toHaveLength(oscuros);
    // Las tres marcas de posición empiezan en las esquinas.
    expect(d.startsWith("M0 0h1v1h-1z")).toBe(true);
    expect(d).toContain(`M${modulos - 1} 0h1v1h-1z`);
  });
});

describe("consultas de certificados", () => {
  it("la verificación pública convierte la nota y oculta un instructor vacío", async () => {
    responder({
      "rpc:verificar_certificado": {
        data: [{ codigo_unico: "PED-2026-ABCDEFGH", estudiante: "Ana Quispe", curso: "Excel", duracion_horas: 24, fecha_emision: "2026-09-30", nota_final: "15.50", instructor: "" }],
      },
    });
    await expect(verificarCertificado("ped-2026-abcdefgh")).resolves.toMatchObject({ nota_final: 15.5, instructor: null });
    expect(entorno.servidor.de("rpc:verificar_certificado")[0].valores).toEqual({ p_codigo: "ped-2026-abcdefgh" });
  });

  it("un código inexistente devuelve null y un error de la BD se propaga", async () => {
    responder({ "rpc:verificar_certificado": [{ data: [] }, { error: { message: "timeout" } }] });
    await expect(verificarCertificado("PED-0000-XXXXXXXX")).resolves.toBeNull();
    await expect(verificarCertificado("PED-0000-XXXXXXXX")).rejects.toThrow("Verificación: timeout");
  });

  it("obtiene el resultado académico por inscripción con números reales", async () => {
    await expect(obtenerResultados([])).resolves.toEqual(new Map());
    expect(entorno.servidor.consultas).toHaveLength(0);

    responder({
      "rpc:resultado_academico": {
        data: [{ inscripcion_id: "i1", evaluaciones: 2, rendidas: 2, nota_final: "14.25", sesiones: 0, presentes: 0, asistencia: null, contenidos: 4, completados: 4, progreso: "100.0" }],
      },
    });
    const r = await obtenerResultados(["i1"]);
    expect(r.get("i1")).toMatchObject({ nota_final: 14.25, asistencia: null, progreso: 100 });

    responder({ "rpc:resultado_academico": { error: { message: "permiso denegado" } } });
    await expect(obtenerResultados(["i1"])).rejects.toThrow("Resultado académico: permiso denegado");
  });

  it("usa los datos congelados al emitir y, si faltan, los actuales", () => {
    const base = { curso: { titulo: "Excel 2026", duracion_horas: 30 } } as InscripcionEstudiante;
    const congelado = datosCertificado(
      { ...base, certificado: { codigo_unico: "PED-1", fecha_emision: "2026-09-30", estudiante_nombre: "Ana Q.", curso_titulo: "Excel", duracion_horas: 24, instructor_nombre: "Luis", nota_final: "16.00" as unknown as number } },
      "Ana Quispe Rojas",
    );
    expect(congelado).toMatchObject({ estudiante: "Ana Q.", curso: "Excel", duracion_horas: 24, instructor: "Luis", nota_final: 16 });
    const antiguo = datosCertificado(
      { ...base, certificado: { codigo_unico: "PED-2", fecha_emision: "2026-01-10", estudiante_nombre: null, curso_titulo: null, duracion_horas: null, instructor_nombre: null, nota_final: null } },
      "Ana Quispe Rojas",
    );
    expect(antiguo).toMatchObject({ estudiante: "Ana Quispe Rojas", curso: "Excel 2026", duracion_horas: 30, nota_final: null });
  });
});

describe("PDF del certificado (HU-11)", () => {
  const datos = (extra: Partial<DatosPdfCertificado> = {}): DatosPdfCertificado => ({
    estudiante: "Ana Lucía Quispe Rojas",
    curso: "Seguridad y salud en el trabajo",
    duracion_horas: 24,
    fecha_emision: "2026-09-30",
    codigo_unico: "PED-2026-ABCDEFGH",
    instructor: "Luis Ramos",
    nota_final: 15.5,
    urlVerificacion: "https://pedsar.test/verificar?codigo=PED-2026-ABCDEFGH",
    ...extra,
  });

  it("con nota aprobatoria es de aprobación y muestra la nota", async () => {
    const { texto, tamanos, doc } = await leerPdf(await generarPdfCertificado(datos()));
    expect(tamanos).toEqual([{ width: 841.89, height: 595.28 }]);
    expect(texto).toContain("CERTIFICADO DE APROBACIÓN");
    expect(texto).toContain("Ana Lucía Quispe Rojas");
    expect(texto).toContain("con una duración de 24 horas académicas y una nota final de 15.5 sobre 20.");
    expect(texto).toContain("Ica, 30 de setiembre de 2026."); // es-PE
    expect(texto).toContain("Luis Ramos");
    expect(texto).toContain("PED-2026-ABCDEFGH");
    expect(texto).toContain("https://pedsar.test/verificar con el código PED-2026-ABCDEFGH");
    expect(doc.getTitle()).toBe("Certificado PED-2026-ABCDEFGH · Seguridad y salud en el trabajo");
  });

  it("sin nota aprobatoria es de participación y no publica la nota", async () => {
    for (const nota_final of [12.96, null]) {
      const { texto } = await leerPdf(await generarPdfCertificado(datos({ nota_final, instructor: null })));
      expect(texto).toContain("CERTIFICADO DE PARTICIPACIÓN");
      expect(texto).toContain("por haber participado en el curso");
      expect(texto).not.toContain("nota final");
      expect(texto).toContain("Coordinación académica");
    }
  });

  it("acorta un título de curso muy largo a dos líneas", async () => {
    const curso = "Diplomado de especialización en gestión de proyectos de infraestructura vial con metodologías ágiles y BIM para supervisores de obra";
    const { paginas } = await leerPdf(await generarPdfCertificado(datos({ curso })));
    const lineas = paginas[0].split("\n");
    const titulo = lineas.slice(lineas.indexOf("por haber aprobado el curso") + 1, lineas.findIndex((l) => l.startsWith("con una duración")));
    expect(titulo).toHaveLength(2);
    expect(curso.startsWith(titulo[0])).toBe(true);
    expect(titulo[1].endsWith("…")).toBe(true);
  });
});
