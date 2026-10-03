// Regenera src/types/database.ts con la CLI de Supabase.
// Escribe primero a un temporal y luego lo renombra: con una redirección «>» el
// archivo queda vacío mientras la CLI consulta la base, y el servidor de
// desarrollo (Turbopack) puede compilarlo así y reportar exports inexistentes.
//   node scripts/generar-tipos.mjs          → base local (supabase start)
//   node scripts/generar-tipos.mjs --nube   → proyecto vinculado (supabase link)
import { execSync } from "node:child_process";
import { renameSync, writeFileSync } from "node:fs";

const nube = process.argv.includes("--nube");
const destino = "src/types/database.ts";

const tipos = execSync(`supabase gen types typescript ${nube ? "--linked" : "--local"}`, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
if (!tipos.includes("export type Database")) throw new Error("La CLI no devolvió tipos válidos; no se modificó el archivo.");

writeFileSync(`${destino}.tmp`, tipos);
renameSync(`${destino}.tmp`, destino);
console.log(`Tipos actualizados en ${destino} (${nube ? "nube" : "local"}).`);
