// Genera las maquetas HTML (una pantalla por archivo) y la galería index.html.
// Uso: node diseno/maquetas/fuente/generar.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { documento, j } from "./lib.mjs";
import publico from "./publico.mjs";
import estudiante from "./estudiante.mjs";
import instructor from "./instructor.mjs";
import admin from "./admin.mjs";
import cuenta from "./cuenta.mjs";
import movil from "./movil.mjs";

const SALIDA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pantallas = [...publico, ...estudiante, ...instructor, ...admin, ...cuenta, ...movil];

for (const p of pantallas) {
  const carpeta = p.movil ? "movil" : "desktop";
  fs.mkdirSync(path.join(SALIDA, carpeta), { recursive: true });
  fs.writeFileSync(path.join(SALIDA, carpeta, `${p.archivo}.html`), documento(p.titulo, j(p.render()), { movil: p.movil }));
}

// Galería con miniaturas en vivo de cada pantalla
const grupos = [...new Set(pantallas.map((p) => p.grupo))];
const tarjeta = (p) => {
  const [w, h, esc] = p.movil ? [390, 844, 0.42] : [1440, 960, 0.2];
  const ruta = `${p.movil ? "movil" : "desktop"}/${p.archivo}.html`;
  return `<a class="mini" href="${ruta}" target="_blank" style="width:${Math.round(w * esc) + 2}px"><div class="marco" style="width:${Math.round(w * esc)}px;height:${Math.round(h * esc)}px"><iframe src="${ruta}" loading="lazy" tabindex="-1" style="width:${w}px;height:${h}px;transform:scale(${esc})"></iframe></div><div class="pie"><span>${p.titulo}</span><code>${ruta}</code></div></a>`;
};
const indice = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PEDSAR · Maquetas UX/UI</title><link rel="stylesheet" href="pedsar.css">
<style>
body{background:var(--fondo-pagina)} .g{max-width:1400px;margin:0 auto;padding:48px 32px 80px;display:flex;flex-direction:column;gap:40px}
.lista{display:flex;flex-wrap:wrap;gap:20px} .mini{display:flex;flex-direction:column;background:#fff;border:1px solid var(--borde-default);border-radius:14px;overflow:hidden;box-shadow:var(--sombra-sm)}
.mini:hover{box-shadow:var(--sombra-lg);border-color:var(--cian-300)} .marco{overflow:hidden;position:relative;background:var(--fondo-sutil)} .marco iframe{border:0;transform-origin:0 0;pointer-events:none;position:absolute;top:0;left:0}
.mini .pie{padding:10px 12px;display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--borde-default)} .mini .pie span{font-size:14px;font-weight:500} .mini .pie code{font-size:11px;color:var(--texto-terciario)}
</style></head><body><div class="g">
<div class="col" style="gap:8px"><span class="t-o c-cian">Rediseño UX/UI · Paleta Grafito y cian · Inter</span><h1 class="t-h1">PEDSAR · Maquetas de pantallas</h1>
<p class="t-bl c-sec" style="max-width:860px">${pantallas.length} pantallas que completan el archivo de Figma. Cada archivo es una pantalla (1440 px en desktop, 390 px en móvil) lista para importar con html.to.design.</p></div>
${grupos.map((g) => { const ps = pantallas.filter((p) => p.grupo === g); return `<section class="col" style="gap:16px"><div class="row" style="gap:10px"><h2 class="t-h3">${g}</h2><span class="badge b-cian">${ps.length}</span></div><div class="lista">${ps.map(tarjeta).join("")}</div></section>`; }).join("")}
</div></body></html>
`;
fs.writeFileSync(path.join(SALIDA, "index.html"), indice);
console.log(`${pantallas.length} pantallas generadas en ${SALIDA}`);
