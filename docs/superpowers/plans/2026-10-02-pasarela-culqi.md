# Pasarela Culqi y comprobante de pago — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El estudiante paga su inscripción en línea con Culqi (tarjeta, Yape, billeteras), la matrícula se
confirma sin intervención del administrador y todo pago aprobado tiene un comprobante interno en PDF.

**Architecture:** «Inscribir primero, pagar después».
- `inscribirse` sigue creando la inscripción y el pago PENDIENTE.
- La pantalla «Pagos» abre Culqi Checkout Custom con una orden creada en el servidor:
  - Los tokens de tarjeta o Yape se cobran en el servidor (con reintento 3DS).
  - Las órdenes pagadas con billetera llegan por webhook y se verifican consultando la API.
- Todas las vías terminan en `confirmarPago()`. Un trigger de la BD emite el comprobante.

**Tech Stack:** Next.js 16.3.6 (App Router, Server Actions), React 19, Supabase (PostgreSQL + RLS, pgTAP), zod 4,
pdf-lib, Vitest 5, Culqi API v2 + Checkout Custom + Culqi3DS.

**Spec:** `docs/superpowers/specs/2026-10-02-pasarela-culqi-design.md`

## Global Constraints

- **Next.js:** antes de escribir código de Next.js, leer la guía correspondiente en `node_modules/next/dist/docs/`.
  Esta versión tiene cambios incompatibles con lo conocido (ver `AGENTS.md`).
- **Idioma:** textos de interfaz, nombres de funciones y comentarios en español, como el resto del repo. Se
  conservan los nombres de la API de Culqi.
- **Culqi:**
  - API `https://api.culqi.com/v2` y montos en **céntimos**, `currency_code: "PEN"`.
  - Checkout `https://js.culqi.com/checkout-js`, 3DS `https://3ds.culqi.com`.
  - Toda llamada a Culqi lleva `signal: AbortSignal.timeout(15_000)`.
  - Los nombres exactos de los campos de órdenes y cargos se confirman en https://apidocs.culqi.com antes de
    implementar el adaptador.
- **Reglas de pago:**
  - Pago en línea: `metodo = 'CULQI'` y `medio ∈ {TARJETA, YAPE, BILLETERA, BANCA_MOVIL, AGENTE}`.
  - Pago manual: `metodo ∈ {YAPE, PLIN}` y `medio = null`.
  - Un rechazo de tarjeta **no** cancela la inscripción.
- **Comprobante:**
  - Serie `CP01`; número de 6 dígitos con ceros a la izquierda.
  - Nota obligatoria en el PDF: «Documento interno de PEDSAR; no reemplaza la boleta o factura electrónica SUNAT.»
- **Variables de entorno:** `PAGO_MANUAL_HABILITADO` (servidor, por defecto `true`). La pasarela se considera
  activa si existen `NEXT_PUBLIC_CULQI_PUBLIC_KEY` y `CULQI_SECRET_KEY`.
- **Webhook:** `POST /api/pagos/webhook/culqi?clave=<CULQI_WEBHOOK_SECRET>`, comparado con `timingSafeEqual`.
- **Cobertura:** ≥ 70 % (umbral en `vitest.config.mts`); no debe bajar.
- **Supabase local** (con Docker Desktop iniciado):
  `npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,postgres-meta`.
- **Commits:** en la rama `fase-0-pago-manual`, con mensaje en español y la línea
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **La reserva vence mientras el checkout está abierto.** El cobro con token debe rechazarse antes de llamar a
   Culqi (prueba en la Tarea 4).
2. **Doble clic en «Pagar en línea».** Se reutiliza la orden pendiente existente; no se crea otra (Tarea 4).
3. **El webhook del cargo llega antes de que `cobrarConToken` termine.** Ambos llaman a `confirmarPago`; el
   segundo devuelve `YA_APROBADO` sin enviar otro correo (Tarea 3).
4. **Pago con cupón.** La orden y la comparación del webhook usan `pagos.monto` con descuento, no `cursos.precio`
   (pruebas con S/ 144.00 = 180 − 20 %, Tareas 4 y 5).
5. **Plin después de un rechazo de tarjeta.** Al confirmar, `observacion` vuelve a `null` para que el estudiante no
   siga viendo el motivo del rechazo (Tarea 3).

---

### Task 1: Migración `pasarela_culqi` y pruebas de BD

**Files:**
- Create: `supabase/migrations/20261002120000_pasarela_culqi.sql`
- Create: `supabase/tests/04_comprobantes.test.sql`
- Modify: `src/types/database.ts` (regenerado), `src/types/dominio.ts`

**Interfaces:**
- Produces:
  - Columnas `pagos.medio text`, `pagos.orden_pasarela text` y `pagos.datos_facturacion jsonb`.
  - En `comprobantes`, las columnas `cliente_nombre`, `cliente_documento`, `ruc`, `razon_social`, `concepto`,
    `subtotal numeric(10,2)`, `descuento numeric(10,2)`, `total numeric(10,2)`, `metodo metodo_pago`, `medio`
    y `referencia_pasarela`.
  - En TypeScript, `export type MedioPago = "TARJETA" | "YAPE" | "BILLETERA" | "BANCA_MOVIL" | "AGENTE"` en
    `src/types/dominio.ts`.

- [ ] **Step 1: Escribir `supabase/tests/04_comprobantes.test.sql` (pgTAP)**

  Mismo estilo que `02_matricula_y_pagos.test.sql`: `begin`, `plan(n)`, datos propios y `rollback`. Datos:
  - Un estudiante con `nombres = 'Ana'`, `apellidos = 'Quispe'` y `documento = '71234567'`.
  - Un curso `'Excel'` con precio 180.
  - Una inscripción.
  - Un pago de 144 con `metodo 'CULQI'`, `medio 'TARJETA'`, `referencia_pasarela 'chr_test_1'` y
    `datos_facturacion '{"tipo":"FACTURA","ruc":"20123456789","razon_social":"ACME SAC"}'`.

  Aserciones:
  - Pasar el pago a `APROBADO` crea **un** comprobante con:
    - `serie = 'CP01'` y `numero` de 6 dígitos (`~ '^\d{6}$'`).
    - `tipo = 'FACTURA'` y `ruc = '20123456789'`.
    - `cliente_nombre = 'Ana Quispe'` y `concepto = 'Excel'`.
    - `subtotal = 180`, `descuento = 36` y `total = 144`.
    - `medio = 'TARJETA'` y `referencia_pasarela = 'chr_test_1'`.
  - Volver a poner el pago en `APROBADO` (update que no cambia el estado, y un PENDIENTE→APROBADO de otro pago)
    deja un solo comprobante por pago, y el segundo número es el siguiente del primero.
  - Un pago `RECHAZADO` no genera comprobante.
  - `insert` de dos pagos con la misma `referencia_pasarela` → `throws_ok '23505'`; ídem `orden_pasarela`.
  - Un `medio` fuera de la lista → `throws_ok '23514'`.
  - RLS:
    - Con `set local role authenticated` y `request.jwt.claims` del estudiante dueño, ve 1 comprobante.
    - Otro estudiante ve 0.
    - Patrón de claims: el de `01_seguridad_rls.test.sql`.

- [ ] **Step 2: Ejecutar y ver que falla**

  Run: `npm run db:reset && npm run test:db`
  Expected: FAIL en `04_comprobantes.test.sql` (columnas inexistentes).

- [ ] **Step 3: Escribir la migración**

  Encabezado con el mismo formato que las migraciones existentes y las referencias HU-12, HU-30 y RF-09.
  1. `alter table public.pagos`:
     - `add column medio text check (medio in ('TARJETA','YAPE','BILLETERA','BANCA_MOVIL','AGENTE'))`.
     - `add column orden_pasarela text`.
     - `add column datos_facturacion jsonb not null default '{"tipo":"BOLETA"}'`.
  2. Índices únicos parciales:
     - `pagos_referencia_unica on pagos (referencia_pasarela) where referencia_pasarela is not null`.
     - `pagos_orden_unica on pagos (orden_pasarela) where orden_pasarela is not null`.
  3. `create sequence public.comprobante_numero_seq`.
  4. Comprobantes:
     - `alter table public.comprobantes add column …` con las columnas de *Produces*.
     - `metodo public.metodo_pago`, `medio text` y el resto según *Produces*.
  5. Función `privado.emitir_comprobante()`:
     - `returns trigger language plpgsql security definer set search_path = ''`.
     - Inserta desde `new` unido a `inscripciones`, `perfiles` y `cursos`.
     - `cliente_nombre = trim(nombres || ' ' || apellidos)`.
     - `tipo = coalesce((datos_facturacion->>'tipo')::tipo_comprobante, 'BOLETA')`.
     - `descuento = greatest(cursos.precio - new.monto, 0)`.
     - `numero = lpad(nextval('public.comprobante_numero_seq')::text, 6, '0')`.
     - `on conflict (pago_id) do nothing`.
  6. Trigger:
     ```sql
     create trigger pagos_emitir_comprobante after update of estado on public.pagos
       for each row when (new.estado = 'APROBADO' and old.estado is distinct from 'APROBADO')
       execute function privado.emitir_comprobante();
     ```
  7. Permisos: `revoke execute … from public, anon, authenticated`.
  8. Relleno de los pagos `APROBADO` sin comprobante, en orden de `fecha_pago` y con la misma lógica de
     inserción. Se recomienda sacarla a una función `privado.insertar_comprobante(p_pago uuid)` que usen el
     trigger y el relleno.
  9. `comment on column` para `medio`, `orden_pasarela`, `datos_facturacion` y `comprobantes.serie`; este último
     debe decir que es una serie interna, no SUNAT.

- [ ] **Step 4: Verificar**

  Run: `npm run db:reset && npm run test:db`
  Expected: todas las pruebas PASS, incluidas las 3 suites existentes.

- [ ] **Step 5: Regenerar tipos y agregar `MedioPago`**

  Run: `npm run db:types && npm run typecheck`
  Expected: sin errores; `database.ts` incluye `medio`, `orden_pasarela` y las columnas nuevas de `comprobantes`.
  Agregar `MedioPago` a `src/types/dominio.ts`.

- [ ] **Step 6: Commit**

  `git add supabase/ src/types/ && git commit` — «Pagos en línea: columnas de la pasarela y comprobante interno por trigger».

---

### Task 2: Adaptador de Culqi

**Files:**
- Modify: `src/lib/pagos/tipos.ts`, `src/lib/pagos/culqi.ts`, `src/lib/pagos/izipay.ts`,
  `src/lib/pagos/niubiz.ts`, `src/lib/pagos/index.ts`, `src/lib/env.server.ts`, `.env.example`
- Test: `tests/unidad/lib/pagos.test.ts` (reescribir los bloques de Culqi)

**Interfaces:**
- Consumes: `MedioPago` (Tarea 1).
- Produces, en `src/lib/pagos/tipos.ts` y reexportado desde `@/lib/pagos`:
  ```ts
  export interface ClientePasarela { nombres: string; apellidos: string; correo: string; telefono: string | null }
  export interface SolicitudOrden { pagoId: string; montoSoles: number; descripcion: string; numeroOrden: string; cliente: ClientePasarela; venceEn: Date }
  export interface Autenticacion3DS { eci: string; xid: string; cavv: string; protocolVersion: string; directoryServerTransactionId: string }
  export interface SolicitudCobro { pagoId: string; montoSoles: number; descripcion: string; correo: string; token: string; huellaDispositivo?: string; autenticacion3DS?: Autenticacion3DS }
  export interface ResultadoCobro { estado: "APROBADO" | "RECHAZADO" | "REQUIERE_3DS"; referencia: string | null; medio: MedioPago | null; mensaje: string; respuesta: Json }
  export interface AvisoPasarela { tipo: "orden" | "cargo"; id: string }
  export interface ConsultaPasarela { estado: "PAGADO" | "PENDIENTE" | "RECHAZADO" | "EXPIRADO"; pagoId: string | null; montoCentimos: number; medio: MedioPago | null; referencia: string; respuesta: Json }
  export interface ResultadoReembolso { aprobado: boolean; referencia: string | null; mensaje: string; respuesta: Json }
  export class ErrorPasarela extends Error {} // red, límite de 15 s o HTTP 5xx; message = "No pudimos conectar con la pasarela de pagos"
  export interface PasarelaPago {
    nombre: "culqi" | "izipay" | "niubiz";
    crearOrden(s: SolicitudOrden): Promise<{ id: string }>;
    cobrar(s: SolicitudCobro): Promise<ResultadoCobro>;
    consultar(aviso: AvisoPasarela): Promise<ConsultaPasarela>;
    reembolsar(referencia: string, montoSoles: number, motivo: string): Promise<ResultadoReembolso>;
    leerWebhook(cuerpo: string): AvisoPasarela | null;
  }
  ```
- Produces, en `src/lib/pagos/index.ts`:
  - `pasarelaActiva(): boolean`
  - `pagoManualHabilitado(): boolean`
  - `getPasarela` y `esPasarelaValida` existentes.

- [ ] **Step 1: Escribir las pruebas que fallan**

  Reutilizar el helper `conClave` existente, con un `fetch` simulado que devuelve `{ ok, status, json }`.
  1. **`crearOrden`** hace `POST https://api.culqi.com/v2/orders` con:
     - `amount: 14400` y `currency_code: "PEN"`.
     - `order_number` igual a `numeroOrden`.
     - `expiration_date` = `Math.floor(venceEn.getTime() / 1000)`.
     - `client_details` con nombre, apellido y correo.
     - `metadata.pago_id`.

     Debe devolver `{ id: "ord_test_1" }`.
  2. **`cobrar`**:
     - `outcome.type === "venta_exitosa"` → `{ estado: "APROBADO", referencia: "chr_test_1", medio: "TARJETA" }`.
     - El cuerpo lleva `source_id` igual al token, y `antifraud_details.device_finger_print_id` cuando hay
       huella.
  3. **`cobrar` con token `ype_test_x`** → `medio: "YAPE"`.
  4. **`cobrar` con `action_code: "REVIEW"`** → `estado: "REQUIERE_3DS"`, `referencia: null`. Al reintentar con
     `autenticacion3DS`, el cuerpo incluye `authentication_3DS` con los 5 campos.
  5. **`cobrar` con error de tarjeta** (HTTP 402, `user_message: "Fondos insuficientes"`) →
     `{ estado: "RECHAZADO", mensaje: "Fondos insuficientes" }`.
  6. **`consultar`**:
     - `{ tipo: "orden" }` hace `GET /v2/orders/ord_1`. `state: "paid"` → `PAGADO` con `pagoId` desde
       `metadata.pago_id`, `montoCentimos` desde `amount` y `medio: "BILLETERA"`.
     - `"pending"` → `PENDIENTE`.
     - `"expired"` o `"deleted"` → `EXPIRADO`.
  7. **`consultar` con `{ tipo: "cargo" }`** hace `GET /v2/charges/chr_1`. `venta_exitosa` → `PAGADO`; si no →
     `RECHAZADO`.
  8. **`leerWebhook`** (con `data` como objeto y como texto JSON):
     - `order.status.changed` → `{ tipo: "orden", id }`.
     - `charge.creation.succeeded` → `{ tipo: "cargo", id }`.
     - Otros eventos o sin `id` → `null`.
  9. **Errores de conexión:** un `fetch` que rechaza (`AbortError`) o que responde 500 hace que todos los métodos
     lancen `ErrorPasarela`.
  10. **Sin `CULQI_SECRET_KEY`:** `crearOrden` lanza `"CULQI_SECRET_KEY no configurada"`.
  11. **`pasarelaActiva()`:**
      - `false` sin llaves.
      - `true` con `CULQI_SECRET_KEY` y `NEXT_PUBLIC_CULQI_PUBLIC_KEY` (`vi.stubEnv` + `vi.resetModules`).
  12. **`pagoManualHabilitado()`:** `true` por defecto y `false` con `PAGO_MANUAL_HABILITADO=false`.
  13. **Izipay y Niubiz:** todos sus métodos lanzan errores con «pendiente»; `leerWebhook` → `null`.

- [ ] **Step 2: Ejecutar y ver que fallan**

  Run: `npx vitest run tests/unidad/lib/pagos.test.ts`
  Expected: FAIL (métodos inexistentes).

- [ ] **Step 3: Implementar**

  - Confirmar los campos en apidocs.culqi.com, en las secciones Órdenes y Cargos:
    - `confirm` en la creación de la orden, para que el Checkout Custom la acepte.
    - Los valores de `state` de la orden.
    - Dónde viene `action_code`.
  - Medio de un cargo: `YAPE` si el ID del token o del `source` empieza con `ype_`; `TARJETA` en otro caso.
    Confirmar el prefijo en la documentación.
  - La orden pagada usa `BILLETERA`, salvo que la respuesta indique el canal (`BANCA_MOVIL` / `AGENTE`).
  - En `env.server.ts`: `PAGO_MANUAL_HABILITADO: z.stringbool().default(true)`.
  - `.env.example`:
    - Agregar `PAGO_MANUAL_HABILITADO=true`.
    - Comentar que la URL del webhook es `…/api/pagos/webhook/culqi?clave=$CULQI_WEBHOOK_SECRET`.

- [ ] **Step 4: Verificar**

  Run: `npx vitest run tests/unidad/lib/pagos.test.ts && npm run typecheck`
  Expected: PASS. `typecheck` fallará en los consumidores de la interfaz vieja (webhook, `inscribirse`), que se
  corrigen en las Tareas 4 y 5. Si se ejecutan tareas por separado, adaptar esos llamados de forma mínima aquí
  para que compile.

- [ ] **Step 5: Commit** — «Adaptador de Culqi: órdenes, cargos con 3DS, consulta y webhook sin confianza».

---

### Task 3: `confirmarPago` y validación manual del administrador

**Files:**
- Create: `src/features/matricula/confirmar-pago.ts` (con `import "server-only"`)
- Modify: `src/features/administracion/acciones.ts` (`resolverPago`), `src/lib/email/plantillas.ts`
  (`correoConfirmacionMatricula`)
- Test: `tests/unidad/features/confirmar-pago.test.ts`, `tests/unidad/features/administracion.test.ts`

**Interfaces:**
- Consumes: `MedioPago` (Tarea 1).
- Produces:
  ```ts
  export type ResultadoConfirmacion = "CONFIRMADO" | "YA_APROBADO" | "SIN_CUPO" | "NO_ENCONTRADO";
  export async function confirmarPago(pagoId: string, datos: { referencia?: string | null; medio?: MedioPago | null; respuesta?: Json; actor: string | null }): Promise<ResultadoConfirmacion>;
  ```
- `correoConfirmacionMatricula` recibe además `comprobante?: { numero: string; url: string }`. Si viene, agrega
  la fila «Comprobante» con el enlace.

- [ ] **Step 1: Escribir las pruebas que fallan** (cliente admin simulado; `responder({}, {...})`)
  1. **Pago PENDIENTE con inscripción PENDIENTE:**
     - Actualiza el pago con `estado: "APROBADO"`, `fecha_pago`, `referencia_pasarela: "chr_1"`,
       `medio: "TARJETA"` y `observacion: null`.
     - Pone la inscripción en `{ estado: "CONFIRMADA", vence_en: null }`.
     - Inserta una notificación.
     - Registra `PAGO_APROBADO`.
     - Programa 1 correo que, tras `ejecutarTareas()`, contiene `/comprobantes/` y `CP01-000001`. El comprobante
       se lee después del update.
     - Devuelve `"CONFIRMADO"`.
  2. **Pago ya `APROBADO`:** devuelve `"YA_APROBADO"`, no hace updates y `entorno.tareas` queda vacío.
  3. **Inscripción CANCELADA con cupo** (`rpc:cupo_disponible` → 3) y sin otra inscripción activa: la reactiva y
     devuelve `"CONFIRMADO"`.
  4. **Inscripción CANCELADA sin cupo** (`cupo_disponible` → 0), o con otra activa del mismo estudiante y curso:
     - El pago queda APROBADO y la inscripción no cambia.
     - Se notifica a los administradores con un mensaje que contiene «reembolsar».
     - Devuelve `"SIN_CUPO"`.
  5. **Pago inexistente:** `"NO_ENCONTRADO"`.
  6. **`resolverPago` con decisión `aprobar`:** delega en `confirmarPago`, con efectos iguales al caso 1 y
     `actor` = admin. Rechazar mantiene el comportamiento actual (actualizar las pruebas existentes de
     `administracion.test.ts` a la nueva secuencia de consultas).

- [ ] **Step 2: Ejecutar y ver que fallan**

  Run: `npx vitest run tests/unidad/features/confirmar-pago.test.ts tests/unidad/features/administracion.test.ts`

- [ ] **Step 3: Implementar `confirmarPago`**

  Usa `createAdminClient()`. Orden:
  1. Leer el pago con su inscripción, el estudiante y el curso.
  2. Salir si ya está APROBADO.
  3. Actualizar el pago.
  4. Decidir sobre la inscripción.
  5. Leer el comprobante (`comprobantes.select("id, serie, numero").eq("pago_id")`).
  6. Notificar al estudiante con `notificarUsuario`.
  7. `programarCorreo`.
  8. `registrarActividad`.
  9. `revalidatePath("/estudiante", "layout")` y `revalidatePath("/admin", "layout")`.

  `resolverPago` busca el pago por `inscripcion_id` y llama a `confirmarPago(pago.id, { actor: usuario.id })`.

- [ ] **Step 4: Verificar** — los mismos comandos; PASS.

- [ ] **Step 5: Commit** — «Un solo punto de confirmación de pagos, con enlace al comprobante».

---

### Task 4: Inscripción con pago en línea y acciones del checkout

**Files:**
- Create: `src/features/matricula/pago-en-linea.ts` (`"use server"`)
- Modify: `src/features/matricula/acciones.ts` (`inscripcionSchema`, `inscribirse`), `src/lib/email/plantillas.ts`
- Test: `tests/unidad/features/pago-en-linea.test.ts`, `tests/unidad/features/matricula.test.ts`

**Interfaces:**
- Consumes:
  - `getPasarela`, `pasarelaActiva` y `pagoManualHabilitado`, más `ErrorPasarela` y `Autenticacion3DS`
    (Tarea 2).
  - `confirmarPago` (Tarea 3).
- Produces:
  ```ts
  export interface DatosCheckout { llavePublica: string; montoCentimos: number; ordenId: string; correo: string; nombres: string; apellidos: string; titulo: string }
  export async function prepararPagoEnLinea(pagoId: string): Promise<{ ok: true; checkout: DatosCheckout } | { ok: false; mensaje: string }>;
  export interface ResultadoPagoEnLinea { estado: "APROBADO" | "RECHAZADO" | "REQUIERE_3DS" | "ERROR"; mensaje: string }
  export async function cobrarConToken(e: { pagoId: string; token: string; huella?: string; autenticacion3DS?: Autenticacion3DS }): Promise<ResultadoPagoEnLinea>;
  export async function estadoDelPago(pagoId: string): Promise<{ estado: EstadoPago; comprobanteId: number | null }>;
  // plantillas.ts
  export function correoInscripcionPorPagar(p: { nombre: string; curso: string; codigo: string; monto: string; venceEn: string; url: string }): { asunto: string; html: string };
  ```

- [ ] **Step 1: Escribir las pruebas que fallan**

  Simulación: `vi.mock("@/lib/pagos")` con una pasarela falsa (`crearOrden`, `cobrar` y `consultar` como
  `vi.fn`), y `vi.mock("@/features/matricula/confirmar-pago")`.

  `inscribirse`:
  1. Con `metodo: "CULQI"`:
     - Inserta el pago con `metodo: "CULQI"` y `datos_facturacion: { tipo: "FACTURA", ruc, razon_social }`.
     - Redirige a `/estudiante/pagos?pagar=<código>`.
     - Programa el correo `correoInscripcionPorPagar`, con asunto que contiene «Completa el pago».
  2. `metodo: "CULQI"` con `pasarelaActiva() = false`: redirige con `?error=` y el mensaje «El pago en línea aún
     no está disponible».
  3. `metodo: "YAPE"` con `pagoManualHabilitado() = false`: redirige con el error «El pago directo por Yape o
     Plin no está disponible».

  `prepararPagoEnLinea`:

  4. Pago CULQI PENDIENTE con reserva vigente y monto `144.00`:
     - Llama a `crearOrden` con `montoSoles: 144` y `venceEn = inscripciones.vence_en`.
     - Guarda `orden_pasarela`.
     - Devuelve `checkout.montoCentimos === 14400`.
  5. Si el pago ya tiene `orden_pasarela` y `consultar` dice `PENDIENTE`, la reutiliza sin llamar a
     `crearOrden`. Si dice `EXPIRADO`, crea una nueva.
  6. Devuelve `{ ok: false }` en cada uno de estos casos:
     - El pago no es del estudiante (RLS devuelve `null`).
     - El método no es CULQI.
     - El pago ya no está pendiente.
     - La reserva está vencida.
     - `pasarelaActiva() = false`.
  7. Si `crearOrden` lanza `ErrorPasarela`: `{ ok: false, mensaje: "No pudimos conectar con la pasarela de pagos" }`.

  `cobrarConToken`:

  8. `cobrar` → APROBADO: llama a `confirmarPago(pagoId, { referencia: "chr_1", medio: "TARJETA", respuesta, actor: estudiante })`
     y devuelve `{ estado: "APROBADO" }`.
  9. `cobrar` → REQUIERE_3DS: devuelve `{ estado: "REQUIERE_3DS" }` sin confirmar. Con `autenticacion3DS`, la
     pasa a `cobrar`.
  10. `cobrar` → RECHAZADO «Fondos insuficientes»:
      - Actualiza `pagos.observacion` con «Fondos insuficientes».
      - No toca la inscripción.
      - Devuelve `{ estado: "RECHAZADO" }`.
  11. Reserva vencida: devuelve `{ estado: "ERROR" }` sin llamar a `cobrar`.

  `estadoDelPago`:

  12. Devuelve el estado del pago propio y el `id` del comprobante si existe.

- [ ] **Step 2: Ejecutar y ver que fallan**

  Run: `npx vitest run tests/unidad/features/pago-en-linea.test.ts tests/unidad/features/matricula.test.ts`

- [ ] **Step 3: Implementar**

  - `inscripcionSchema.metodo`: `z.enum(["CULQI", "YAPE", "PLIN"])`.
  - Validar la disponibilidad después del parseo. Los mensajes de error van por `?error=`, como los demás.
  - `numeroOrden` = `${inscripcion.codigo}-${Date.now().toString(36)}`.
  - Todas las acciones exigen `requireRol("estudiante")` y leen el pago con el cliente con sesión (RLS).
    Escriben con el cliente admin.
  - Se elimina el `TODO` de `inscribirse`.

- [ ] **Step 4: Verificar** — los mismos comandos; PASS.

- [ ] **Step 5: Commit** — «Inscripción con pago en línea: orden de Culqi, cobro con token y 3DS».

---

### Task 5: Webhook verificado

**Files:**
- Modify: `src/app/api/pagos/webhook/[proveedor]/route.ts`
- Test: `tests/unidad/app/rutas.test.ts` (reescribir el bloque «webhook de pagos»)

**Interfaces:**
- Consumes:
  - `getPasarela(...).leerWebhook` y `getPasarela(...).consultar` (Tarea 2).
  - `confirmarPago` (Tarea 3).
  - `serverEnv.CULQI_WEBHOOK_SECRET`.

- [ ] **Step 1: Escribir las pruebas que fallan** (pasarela simulada como en la Tarea 4)
  1. Proveedor desconocido → 404.
  2. Sin `?clave=` o con una clave incorrecta → 401, sin consultas a la BD.
     - Con `CULQI_WEBHOOK_SECRET` vacío → 401 siempre. No se aceptan webhooks sin secreto.
  3. Evento irrelevante (`leerWebhook` → `null`) → 200 `{ recibido: true }`.
  4. `consultar` → `PAGADO` con `montoCentimos: 14400` y `pagos.monto = 144`:
     - Llama a `confirmarPago(pagoId, { referencia, medio, respuesta, actor: null })`.
     - Responde 200.
  5. `PAGADO` con un monto distinto (`14000`):
     - No confirma.
     - Registra `PAGO_MONTO_DISTINTO`.
     - Responde 200.
  6. `PENDIENTE` o `EXPIRADO` → 200 sin confirmar.
  7. `consultar` lanza `ErrorPasarela` → 500.
  8. El pago no existe → 200 sin confirmar.
  9. Ya no se cancela la inscripción ante un cargo fallido: eliminar la prueba antigua de `charge.failed`.

- [ ] **Step 2: Ejecutar y ver que fallan**

  Run: `npx vitest run tests/unidad/app/rutas.test.ts`

- [ ] **Step 3: Implementar la ruta según la sección 5 de la especificación**

  - Buscar el pago por `consulta.pagoId`.
  - Si no hay `pagoId`, buscarlo por `orden_pasarela` o `referencia_pasarela`.
  - Comparar `Math.round(monto * 100)` con `montoCentimos`.

- [ ] **Step 4: Verificar** — el mismo comando; PASS.

- [ ] **Step 5: Commit** — «Webhook de Culqi con clave secreta y verificación contra la API».

---

### Task 6: Reembolso por la pasarela

**Files:**
- Modify: `src/features/administracion/acciones.ts` (`resolverReembolso`)
- Test: `tests/unidad/features/administracion.test.ts`

**Interfaces:**
- Consumes: `getPasarela("culqi").reembolsar` (Tarea 2) y `notificarAdministradores`.

- [ ] **Step 1: Escribir las pruebas que fallan**
  1. Aprobar el reembolso de un pago `CULQI` con `referencia_pasarela: "chr_1"` y monto 144, con `reembolsar`
     → `aprobado: true`:
     - Llama a `reembolsar("chr_1", 144, <motivo>)`.
     - Reembolso `PROCESADO`, pago `REEMBOLSADO` e inscripción `CANCELADA`.
  2. Si `reembolsar` → `aprobado: false` o lanza:
     - El reembolso queda `APROBADO` y el pago no cambia.
     - Se notifica a los administradores con un mensaje que contiene «no se pudo procesar».
     - Se registra `REEMBOLSO_FALLIDO`.
  3. Un pago manual (`YAPE`) se comporta como hoy: no llama a la pasarela y marca REEMBOLSADO.

- [ ] **Step 2: Ejecutar y ver que fallan**

  Run: `npx vitest run tests/unidad/features/administracion.test.ts`

- [ ] **Step 3: Implementar**

  - Ampliar el `select` con `metodo`, `monto`, `referencia_pasarela` y el `motivo` del reembolso.
  - Quitar el `TODO`.

- [ ] **Step 4: Verificar** — PASS.

- [ ] **Step 5: Commit** — «Reembolsos de pagos con tarjeta o Yape ejecutados en Culqi».

---

### Task 7: PDF del comprobante

**Files:**
- Create: `src/features/matricula/pdf-comprobante.ts`, `src/app/comprobantes/[id]/pdf/route.ts`
- Test: `tests/unidad/lib/pdf.test.ts` (generador), `tests/unidad/app/rutas.test.ts` (ruta)

**Interfaces:**
- Consumes: las columnas de `comprobantes` (Tarea 1); `COLOR`, `aWinAnsi`, `partir` y `dibujarIsotipo` de
  `src/lib/pdf/comun.ts`; `EMPRESA`.
- Produces:
  ```ts
  export interface DatosPdfComprobante { serie: string; numero: string; fechaEmision: string; tipoSolicitado: "BOLETA" | "FACTURA"; cliente: { nombre: string; documento: string | null; ruc: string | null; razonSocial: string | null }; concepto: string; subtotal: number; descuento: number; total: number; pago: string /* etiquetaPago(...) */; referencia: string | null }
  export async function generarPdfComprobante(d: DatosPdfComprobante): Promise<Uint8Array>;
  ```
  Ruta: `GET /comprobantes/[id]/pdf`. Responde `attachment; filename="comprobante-CP01-000123.pdf"` y
  `Cache-Control: private, no-store`.

- [ ] **Step 1: Escribir las pruebas que fallan**
  - **Generador:** con `leerPdf` de `tests/apoyo/archivos.ts`, el texto contiene:
    - `CP01-000123`, el RUC de PEDSAR (`20605615521`) y el nombre del cliente.
    - `ACME SAC` cuando viene `razonSocial`.
    - `S/ 180.00`, `S/ 36.00` y `S/ 144.00`, más `Culqi · Tarjeta` y `chr_test_1`.
    - La nota «no reemplaza la boleta o factura electrónica SUNAT».
  - **Ruta:**
    - Sin sesión: lanza `Redireccion("/login")`.
    - Comprobante inexistente o ajeno (RLS → `null`): 404.
    - Comprobante propio: 200, `Content-Type: application/pdf` y el nombre de archivo esperado.

- [ ] **Step 2: Ejecutar y ver que fallan**

  Run: `npx vitest run tests/unidad/lib/pdf.test.ts tests/unidad/app/rutas.test.ts`

- [ ] **Step 3: Implementar**

  - Hoja A4 vertical.
  - Cabecera con el isotipo y los datos de `EMPRESA`.
  - Bloque del cliente: el RUC y la razón social si es factura; si no, el nombre y el documento.
  - Tabla de concepto e importes.
  - Pago y referencia.
  - Pie con la nota interna.
  - La ruta sigue el patrón de `certificados/[codigo]/pdf/route.ts` (`requireUsuario` y cliente con sesión).

- [ ] **Step 4: Verificar** — PASS.

- [ ] **Step 5: Commit** — «Comprobante de pago interno en PDF (HU-12, HU-30)».

---

### Task 8: Pantallas

**Files:**
- Create:
  - `src/features/matricula/pago-en-linea-cliente.tsx` (`"use client"`)
  - `src/types/culqi.d.ts` (globales `CulqiCheckout` y `Culqi3DS`)
- Modify:
  - `src/features/matricula/formulario-inscripcion.tsx` y su página `src/app/(publico)/cursos/[slug]/inscripcion/page.tsx`
  - `src/app/estudiante/pagos/page.tsx`
  - `src/features/academico/consultas.ts` (`pago.medio`, `pago.comprobante.id`)
  - `src/lib/formato.ts`
  - `src/app/admin/inscripciones/page.tsx`
  - `src/features/administracion/reportes.ts`, `src/features/administracion/exportar-reporte.ts`,
    `src/app/admin/reportes/page.tsx`, `src/app/admin/page.tsx`
  - `src/app/(publico)/page.tsx`, `src/app/(auth)/layout.tsx`
- Test: `tests/unidad/lib/formato.test.ts`, `tests/unidad/features/reportes-y-catalogo.test.ts`

**Interfaces:**
- Consumes: `prepararPagoEnLinea`, `cobrarConToken` y `estadoDelPago` (Tarea 4); la ruta del PDF (Tarea 7);
  `pasarelaActiva` y `pagoManualHabilitado` (Tarea 2).
- Produces, en `src/lib/formato.ts`:
  - `ETIQUETA_MEDIO: Record<MedioPago, string>` con:
    - `TARJETA: "Tarjeta"`
    - `YAPE: "Yape"`
    - `BILLETERA: "Billetera (Plin u otra)"`
    - `BANCA_MOVIL: "Banca móvil"`
    - `AGENTE: "Agente o bodega"`
  - `etiquetaPago(metodo: MetodoPago, medio: MedioPago | null): string`:
    - `"Culqi · Tarjeta"` para CULQI con medio.
    - `"Pago en línea (Culqi)"` para CULQI sin medio.
    - `ETIQUETA_METODO[metodo]` en los demás casos.
  - `ETIQUETA_METODO.CULQI` pasa a `"Pago en línea (Culqi)"`.
- `reportes.ts`: `porMetodo` y `porCurso[].porMetodo` se indexan por la etiqueta de `etiquetaPago`
  (`Record<string, number>`). Los consumidores imprimen la clave directamente.

- [ ] **Step 1: Escribir las pruebas que fallan**
  - `formato.test.ts`:
    - `etiquetaPago("CULQI", "TARJETA") === "Culqi · Tarjeta"`.
    - `etiquetaPago("CULQI", null) === "Pago en línea (Culqi)"`.
    - `etiquetaPago("YAPE", null) === "Yape"`.
  - `reportes-y-catalogo.test.ts`: los ingresos de un pago CULQI/YAPE (medio Yape) y de uno YAPE manual se
    agrupan en `"Culqi · Yape"` y `"Yape"` por separado. Adaptar las pruebas existentes a las claves nuevas.

- [ ] **Step 2: Ejecutar y ver que fallan**

  Run: `npx vitest run tests/unidad/lib/formato.test.ts tests/unidad/features/reportes-y-catalogo.test.ts`

- [ ] **Step 3: Implementar etiquetas y reportes; ejecutar de nuevo → PASS**

- [ ] **Step 4: Implementar las pantallas**

  - **Formulario de inscripción:**
    - Recibe las props `pasarelaActiva: boolean` y `pagoManual: boolean`, que la página calcula en el servidor.
    - Opciones de pago:
      - «En línea: tarjeta, Yape, Plin y otras billeteras», con valor `CULQI` y elegida por defecto si está
        activa. Si no lo está, se muestra deshabilitada con «Próximamente».
      - «Yape / Plin directo (validación manual)», con un sub-selector Yape o Plin que conserva el texto de
        instrucciones actual. Solo aparece si `pagoManual`.
  - **`PagoEnLinea` (cliente):**
    - Props: `{ pagoId, curso, monto, venceEn, abrirAlCargar }`.
    - Carga los dos scripts con `next/script` (`strategy="afterInteractive"`).
    - Estados: `inactivo | preparando | checkout | procesando | 3ds | esperando | aprobado | rechazado | error`.
    - Configura `new CulqiCheckout(llave, { settings: { title: "PEDSAR", currency: "PEN", amount, order },
      client: { email, firstName, lastName }, options: { lang: "auto", installments: false, modal: true,
      paymentMethods: { tarjeta: true, yape: true, billetera: true, bancaMovil: true, agente: true,
      cuotealo: false } } })`.
    - Al recibir el token llama a `cobrarConToken`. Con `REQUIERE_3DS`:
      - Configura `Culqi3DS.settings`: `totalAmount` es el monto en céntimos y `returnUrl` la URL actual.
      - Llama a `Culqi3DS.initAuthentication(token)`.
      - Escucha `message` con `event.origin === window.location.origin` para obtener `parameters3DS`.
      - Llama otra vez a `cobrarConToken`.
    - Al recibir `Culqi.order`, consulta `estadoDelPago` cada 5 s hasta APROBADO, hasta que venza la reserva o
      hasta 10 minutos.
    - Con APROBADO muestra un `toast`, el enlace «Descargar comprobante» y `router.refresh()`.
    - Debe tener `aria-live="polite"` en el estado.
  - **Página Pagos:**
    - Lista `PagoEnLinea` para los pagos CULQI PENDIENTE con reserva vigente.
    - `abrirAlCargar` si `?pagar` coincide con el código.
    - La columna «Comprobante» enlaza `/comprobantes/{id}/pdf`.
    - La columna «Método» usa `etiquetaPago`.
    - El aviso de inscripción recién creada cambia el texto según el método.
  - **Administrador:** «Inscripciones y pagos» muestra `etiquetaPago`, la referencia (`chr_…` / `ord_…`) y el
    enlace al comprobante; el panel usa `etiquetaPago`.
  - **Sitio público:** inicio y `(auth)/layout.tsx` muestran «Yape, Plin o tarjeta» solo si
    `pasarelaActiva()`; el `TODO` se elimina.

- [ ] **Step 5: Verificar**

  Run: `npm run lint && npm run typecheck && npm test`
  Expected: PASS.

  Después, con `preview_start` del servidor de desarrollo:
  - `/cursos/<slug>/inscripcion` sin sesión redirige a `/login`.
  - En el inicio, el texto de pagos no menciona la tarjeta sin llaves.
  - Sin errores en la consola.

  Las pantallas con sesión las revisa el usuario: Auth está en la nube.

- [ ] **Step 6: Commit** — «Pantallas del pago en línea y comprobantes enlazados».

---

### Task 9: Documentación y verificación final

**Files:**
- Modify: `README.md` (secciones «Pagos» y «Estado»: Culqi, comprobante, webhook, variables, pasos de la prueba
  real de la sección 9 de la especificación)

- [ ] **Step 1: Actualizar el README**

  Quitar «Pendiente: cobro con tarjeta…» y dejar como pendientes solo SUNAT y los recordatorios.

- [ ] **Step 2: Verificación completa**

  Run: `npm run lint && npm run typecheck && npm run test:cobertura && npm run build && npm run test:db`
  Expected: todo PASS y cobertura de líneas y ramas ≥ 70 %. Anotar las cifras para el documento del proyecto.

- [ ] **Step 3: Commit y push**

  Commit «Documentar el pago en línea con Culqi»; luego `git push`. Vercel genera el staging.

- [ ] **Step 4: Aplicar la migración en la nube (con confirmación del usuario)**

  Pedir confirmación antes de `npm run db:push`, porque staging usa la BD de la nube. Luego `npm run
  db:types:nube` y comprobar que no hay diferencias con el `database.ts` local.
