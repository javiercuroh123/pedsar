// Prueba real con dos conexiones PostgreSQL. Solo para Supabase local de PEDSAR.
// node scripts/probar-concurrencia.mjs [supabase_db_pedsar]
// Crea datos ficticios con UUID aleatorios y los elimina al terminar.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const container = process.argv[2] ?? "supabase_db_pedsar";
if (!/^supabase_db_pedsar(?:-[a-z0-9-]+)?$/.test(container)) throw new Error("Solo se admiten contenedores locales de PEDSAR");
const usuarios = Array.from({ length: 4 }, () => randomUUID());
const cursos = Array.from({ length: 3 }, () => randomUUID());
const cupon = `TEST${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
const lista = (ids) => ids.map((id) => `'${id}'`).join(",");

function ejecutar(sql, alBloquear) {
  const proceso = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-At", "-v", "ON_ERROR_STOP=1"], { windowsHide: true });
  let salida = "", errores = "", avisado = false;
  const fin = new Promise((resolve, reject) => {
    proceso.once("error", reject);
    proceso.stdout.on("data", (chunk) => {
      salida += chunk;
      if (!avisado && salida.includes("RESERVADO")) { avisado = true; alBloquear?.(); }
    });
    proceso.stderr.on("data", (chunk) => { errores += chunk; });
    proceso.once("close", (code) => resolve({ code, salida, errores }));
  });
  proceso.stdin.end(`set statement_timeout='15s';\n${sql}`);
  return fin;
}

async function ok(sql) {
  const r = await ejecutar(sql);
  assert.equal(r.code, 0, r.errores);
  return r.salida;
}

const matricular = (u, c, codigo = "", monto = 100) => `select inscripcion_id from public.registrar_matricula('${u}','${c}','YAPE','${codigo}',${monto},'{}');`;

async function competir(primera, segunda, mensaje) {
  let segundaPromesa;
  const primeraPromesa = ejecutar(`begin; ${primera} select 'RESERVADO'; select pg_sleep(3); commit;`, () => {
    segundaPromesa = ejecutar(segunda);
  });
  const r1 = await primeraPromesa;
  assert.equal(r1.code, 0, r1.errores);
  assert.ok(segundaPromesa, "La segunda conexión debe arrancar antes del commit de la primera");
  const r2 = await segundaPromesa;
  assert.notEqual(r2.code, 0, "La segunda reserva debió rechazarse");
  assert.match(r2.errores, mensaje);
}

try {
  await ok(`begin;
    insert into auth.users(id,email) values ${usuarios.map((id) => `('${id}','${id}@concurrencia.test')`).join(",")};
    insert into public.cursos(id,slug,titulo,precio,cupo_maximo,estado) values ${cursos.map((id, i) => `('${id}','test-${id}','Concurrencia',100,${i === 0 ? 1 : 10},'PUBLICADO')`).join(",")};
    insert into public.cupones(codigo,porcentaje_descuento,fecha_vigencia,usos_maximos) values('${cupon}',10,current_date+1,1);
    commit;`);
  await competir(matricular(usuarios[0], cursos[0]), matricular(usuarios[1], cursos[0]), /no tiene cupos/);
  assert.match(await ok(`select count(*) from public.inscripciones where curso_id='${cursos[0]}';`), /\b1\b/);
  console.log("PASS: dos reservas simultáneas, una sola matrícula para el último cupo.");

  // Cursos distintos: el bloqueo del cupón debe proteger también este caso.
  await competir(matricular(usuarios[2], cursos[1], cupon, 90), matricular(usuarios[3], cursos[2], cupon, 90), /agotó sus usos/);
  assert.match(await ok(`select count(*) from public.pagos p join public.cupones c on c.id=p.cupon_id where c.codigo='${cupon}';`), /\b1\b/);
  console.log("PASS: dos cursos simultáneos, un solo uso del último cupón.");
} finally {
  await ok(`begin;
    delete from public.inscripciones where curso_id in (${lista(cursos)});
    delete from public.cursos where id in (${lista(cursos)});
    delete from public.cupones where codigo='${cupon}';
    delete from auth.users where id in (${lista(usuarios)});
    commit;`);
}
