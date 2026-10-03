# Comunidad: mensajería y reseñas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el estudiante pueda escribir al instructor de su curso (y el instructor responder desde una bandeja),
y que quien completó un curso lo califique con estrellas y una reseña visible en el catálogo.

**Architecture:**
- Tres tablas nuevas con RLS (`conversaciones`, `mensajes`, `resenas`) y funciones de BD para lo que no debe
  depender de la interfaz: elegibilidad para reseñar, marcado de lectura, promedio y reseñas públicas.
- Server Actions en `src/features/comunidad/` escriben con la sesión del usuario (RLS) y avisan por campana y
  correo.
- Las pantallas se agregan a los portales del estudiante, del instructor y del administrador, y al catálogo
  público.

**Tech Stack:** Next.js 16.3.6 (App Router, Server Actions), React 19, Supabase (PostgreSQL + RLS, pgTAP), zod 4,
Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-02-comunidad-design.md`

## Global Constraints

- **Next.js:** antes de escribir código de Next.js, leer la guía en `node_modules/next/dist/docs/` (ver `AGENTS.md`).
- **Idioma:** textos, nombres y comentarios en español, como el resto del repo.
- **Límites:** texto de un mensaje de 1 a 2000 caracteres después de `trim`; reseña de 1 a 5 estrellas y texto de
  hasta 500 caracteres.
- **Elegibilidad para reseñar:** inscripción CONFIRMADA y (`progreso.porcentaje >= 100` o certificado emitido).
- **Privacidad:** el administrador no lee los mensajes. Las reseñas públicas muestran solo el nombre y la inicial
  del apellido.
- **Avisos:**
  - Campana por cada mensaje.
  - Correo solo si el destinatario no tenía otros mensajes sin leer de esa conversación.
  - Enlaces: estudiante → `/estudiante/mensajes/{cursoId}`; instructor → `/instructor/mensajes/{conversacionId}`.
- **Refresco** de la conversación abierta cada 10 s.
- **Helpers de RLS existentes** (esquema `privado`): `es_instructor_de(uuid)`, `esta_inscrito_en(uuid)` (exige
  CONFIRMADA), `rol_actual()`. También `public.es_admin()`.
- **Tipos:** `src/types/database.ts` se parchea a mano en el formato de la nube (orden alfabético, como el resto del
  archivo). Ver la ruling de la Tarea 1 del plan de Culqi; se regenera con `db:types:nube` tras `db:push`.
- **Cobertura:** ≥ 70 % en Vitest. Supabase local se levanta con
  `npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime`.
- **Commits:** en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **El estudiante se reinscribe en el mismo curso.** Debe reutilizar su conversación (único por curso y
   estudiante), no fallar al crear otra (Tarea 2).
2. **Mensaje solo con espacios.** Se rechaza en el formulario y en la BD (Tareas 1 y 2).
3. **Segundo mensaje mientras el primero sigue sin leer.** Va a la campana pero no envía otro correo (Tarea 2).
4. **Editar una reseña oculta.** No debe volverla visible: el trigger conserva `oculta` (Tarea 1).
5. **Curso sin instructor asignado.** El estudiante no puede iniciar la conversación y recibe un mensaje claro
   (Tarea 2).

---

### Task 1: Migración `comunidad`, pruebas de BD y tipos

**Files:**
- Create: `supabase/migrations/20261002180000_comunidad.sql`, `supabase/tests/05_comunidad.test.sql`
- Modify: `src/types/database.ts` (tablas `conversaciones`, `mensajes` y `resenas`; funciones
  `calificacion_cursos`, `resenas_publicas` y `marcar_leidos`)

**Interfaces:**
- Produces:
  - Tablas y columnas según la sección 3 de la especificación.
  - `public.marcar_leidos(p_conversacion bigint) returns integer` (cantidad marcada).
  - `public.calificacion_cursos(p_ids uuid[]) returns table(curso_id uuid, promedio numeric, cantidad integer)`.
  - `public.resenas_publicas(p_curso uuid, p_limite integer default 6) returns table(estrellas smallint, texto text, autor text, fecha timestamptz)`.
  - `privado.puede_resenar(p_inscripcion uuid) returns boolean`.

- [ ] **Step 1: Escribir `05_comunidad.test.sql`**

  Mismo patrón que `04_comprobantes.test.sql`: el esquema `pruebas` con `pruebas.como(uuid)`.

  Datos:
  - Instructor Luis.
  - Estudiantes Ana (CONFIRMADA en Excel), Beto (CONFIRMADA en Excel) y Carla (PENDIENTE en Excel).
  - Un administrador.
  - Curso Excel con `instructor_id = Luis`.

  Aserciones:
  - **Conversación:**
    - Ana crea su conversación de Excel.
    - Carla no puede (`throws_ok '42501'`).
    - Ana no puede crear una a nombre de Beto.
  - **Mensajes:**
    - Ana inserta un mensaje.
    - Luis lo lee y responde.
    - Beto y el administrador ven 0 mensajes de esa conversación.
    - Un texto `'   '` → `throws_ok '23514'`.
  - **`ultimo_mensaje_en`:** después del último insert es ≥ la hora del mensaje.
  - **`marcar_leidos`:**
    - Llamado como Ana, marca solo el mensaje de Luis (devuelve 1) y deja el suyo sin leer.
    - Llamado por Beto sobre esa conversación devuelve 0.
  - **Reseñas:**
    - Ana sin progreso → `insert` en `resenas` falla (`42501`).
    - Con `progreso.porcentaje = 100` → pasa.
    - Una segunda reseña de la misma inscripción → `23505`.
    - Beto con certificado y sin progreso → pasa.
    - Ana actualiza su reseña con `oculta = true` → queda `false`.
    - El administrador oculta la de Beto.
    - `calificacion_cursos(array[excel])` → `cantidad = 1` y `promedio` = estrellas de Ana.
    - `resenas_publicas(excel)` devuelve `autor = 'Ana Q.'` y no incluye la de Beto.
    - Como `anon`, `select count(*) from resenas` = 0, pero `calificacion_cursos` funciona.

- [ ] **Step 2: Ejecutar y ver que falla**

  Run: `npm run db:reset && npm run test:db`
  Expected: FAIL en `05_comunidad.test.sql` (tablas inexistentes).

- [ ] **Step 3: Escribir la migración** según la sección 3 de la especificación.

  - Tablas con `enable row level security` y políticas con nombres `conversaciones_ver`, `conversaciones_crear`,
    `mensajes_ver`, `mensajes_enviar`, `resenas_ver`, `resenas_crear`, `resenas_editar_propia` y
    `resenas_moderar`.
  - **Trigger `privado.tocar_conversacion()`:** `after insert on mensajes` → actualiza `ultimo_mensaje_en`.
  - **Trigger `privado.proteger_resena()`:** `before update on resenas`.
    - Si no es administrador, conserva `oculta`, `curso_id`, `estudiante_id` e `inscripcion_id` de `old`.
    - Siempre fija `actualizada_en = now()`.
  - **Al insertar una reseña**, `curso_id` y `estudiante_id` se completan desde la inscripción
    (`before insert`, para no confiar en el cliente).
  - **Funciones `security definer` con `set search_path = ''`:**
    - `revoke execute … from public, anon` en `marcar_leidos` y `puede_resenar`.
    - `grant execute … to anon, authenticated` en `calificacion_cursos` y `resenas_publicas`.
  - `promedio` redondeado a 1 decimal.

- [ ] **Step 4: Verificar**

  Run: `npm run db:reset && npm run test:db`
  Expected: PASS en las 5 suites.

- [ ] **Step 5: Agregar los tipos a mano**

  - Bloques `Row`, `Insert`, `Update` y `Relationships` de las 3 tablas, y las 3 funciones en `Functions`, en orden
    alfabético.
  - Para comprobar, se puede comparar con `npm run db:types` (el formato local es distinto), sin guardar ese
    resultado.

  Run: `npm run typecheck`
  Expected: sin errores.

- [ ] **Step 6: Commit** — «Comunidad: conversaciones, mensajes y reseñas con RLS y verificación de elegibilidad».

---

### Task 2: Mensajería (acciones, consultas y correo)

**Files:**
- Create: `src/features/comunidad/mensajes.ts` (`"use server"`), `src/features/comunidad/consultas.ts`
- Modify: `src/lib/email/plantillas.ts` (agregar `correoMensajeNuevo`)
- Test: `tests/unidad/features/comunidad-mensajes.test.ts`

**Interfaces:**
- Consumes: tablas y `marcar_leidos` (Tarea 1); `notificarUsuario` y `programarCorreo`.
- Produces:
  ```ts
  // mensajes.ts
  export async function enviarMensaje(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario>; // campos: cursoId? | conversacionId?, texto
  export async function marcarLeidos(conversacionId: number): Promise<void>;
  // consultas.ts
  export interface ConversacionResumen { id: number | null; cursoId: string; curso: string; otro: string; ultimoMensaje: string | null; ultimoEn: string | null; noLeidos: number }
  export interface Mensaje { id: number; texto: string; enviadoEn: string; propio: boolean; leido: boolean }
  export async function listarConversacionesEstudiante(estudianteId: string): Promise<ConversacionResumen[]>;
  export async function listarBandejaInstructor(instructorId: string, cursoId?: string): Promise<ConversacionResumen[]>;
  export async function obtenerConversacion(filtro: { cursoId: string; estudianteId: string } | { id: number }, usuarioId: string): Promise<{ id: number | null; cursoId: string; curso: string; otro: string; mensajes: Mensaje[] } | null>;
  // plantillas.ts
  export function correoMensajeNuevo(p: { nombre: string; de: string; curso: string; extracto: string; url: string }): { asunto: string; html: string };
  ```

- [ ] **Step 1: Escribir las pruebas que fallan** (con el patrón `responder` / `conSesion`)

  `enviarMensaje`:
  1. **Primer mensaje del estudiante** (sin conversación):
     - Lee la inscripción CONFIRMADA y el curso con su `instructor_id`.
     - Inserta en `conversaciones` (`curso_id`, `estudiante_id`) y luego en `mensajes` (`conversacion_id`,
       `autor_id`, `texto` recortado).
     - Notifica al instructor con el enlace `/instructor/mensajes/{id}`.
     - Programa 1 correo con asunto que contiene «Nuevo mensaje».
     - Devuelve `{ ok: true }`.
  2. **Conversación existente** (el `select` de `conversaciones` devuelve `{ id: 5 }`): no inserta otra
     conversación. Cubre el caso del estudiante reinscrito.
  3. **El destinatario ya tenía mensajes sin leer** (el conteo devuelve 1): notifica, pero no programa el correo.
  4. **Instructor responde** con `conversacionId`:
     - Notifica al estudiante con `/estudiante/mensajes/{cursoId}`.
     - El instructor no puede crear conversaciones con `cursoId` → `{ ok: false }`.
  5. **Errores:**
     - Texto `"   "` o con 2001 caracteres → `{ ok: false }` sin consultas.
     - Estudiante sin inscripción confirmada → «Solo puedes escribir en cursos en los que estás matriculado».
     - Curso sin instructor → «Este curso aún no tiene instructor asignado».

  `marcarLeidos`:

  6. Llama a `rpc("marcar_leidos", { p_conversacion: 5 })` y revalida.

  `correoMensajeNuevo`:

  7. Escapa HTML y recorta el extracto a 140 caracteres con «…».

- [ ] **Step 2: Ejecutar y ver que fallan**

  Run: `npx vitest run tests/unidad/features/comunidad-mensajes.test.ts`

- [ ] **Step 3: Implementar**

  - Las escrituras usan `createClient()` (sesión y RLS). Las notificaciones, `notificarUsuario`.
  - `requireRol("estudiante", "instructor")`.
  - Las consultas calculan `noLeidos` contando los mensajes con `leido_en is null` cuyo autor no es el usuario.

- [ ] **Step 4: Verificar** — mismo comando; PASS.

- [ ] **Step 5: Commit** — «Mensajería estudiante–instructor: envío, lectura y avisos (HU-19)».

---

### Task 3: Reseñas (acciones y calificación en el catálogo)

**Files:**
- Create: `src/features/comunidad/resenas.ts` (`"use server"`)
- Modify: `src/features/catalogo/consultas.ts` (agregar `calificacion` a `CursoResumen` y al detalle; agregar
  `resenas` al detalle)
- Test: `tests/unidad/features/comunidad-resenas.test.ts`, `tests/unidad/features/reportes-y-catalogo.test.ts`

**Interfaces:**
- Consumes: `resenas`, `calificacion_cursos` y `resenas_publicas` (Tarea 1).
- Produces:
  ```ts
  export async function guardarResena(_: EstadoFormulario, formData: FormData): Promise<EstadoFormulario>; // inscripcionId, estrellas, texto?
  export async function alternarResena(formData: FormData): Promise<void>; // id, oculta ("true"|"false"), solo administrador
  // catalogo/consultas.ts
  export interface Calificacion { promedio: number; cantidad: number }
  // CursoResumen.calificacion: Calificacion | null; detalle: calificacion y resenas: { estrellas: number; texto: string | null; autor: string; fecha: string }[]
  ```

- [ ] **Step 1: Escribir las pruebas que fallan**
  1. **`guardarResena`:**
     - Hace `upsert` en `resenas` con `{ inscripcion_id, estrellas: 4, texto }` y `onConflict: "inscripcion_id"`.
     - Revalida `/cursos/{slug}`.
     - Audita `RESENA_GUARDADA`.
  2. **Elegibilidad:** si la BD responde `42501`, devuelve «Podrás calificar el curso cuando lo completes».
  3. **Validación:**
     - Estrellas 0 o 6 → error.
     - Texto de 501 caracteres → error.
     - Texto vacío → se guarda `null`.
  4. **`alternarResena`:**
     - Solo el administrador.
     - Hace `update({ oculta: true })` y audita `OCULTAR_RESENA` / `MOSTRAR_RESENA`.
  5. **`listarCursosPublicados`:**
     - Una sola llamada a `rpc:calificacion_cursos` con los IDs.
     - El curso con reseñas recibe `{ promedio: 4.5, cantidad: 2 }`; el que no tiene, `null`.

- [ ] **Step 2: Ejecutar y ver que fallan**

  Run: `npx vitest run tests/unidad/features/comunidad-resenas.test.ts tests/unidad/features/reportes-y-catalogo.test.ts`

- [ ] **Step 3: Implementar, ejecutar → PASS; Step 4: Commit** — «Reseñas de cursos con estrellas y promedio en el catálogo (HU-24)».

---

### Task 4: Pantallas de mensajería

**Files:**
- Create:
  - `src/app/estudiante/mensajes/page.tsx` y `src/app/estudiante/mensajes/[cursoId]/page.tsx`
  - `src/app/instructor/mensajes/page.tsx` y `src/app/instructor/mensajes/[conversacionId]/page.tsx`
  - `src/features/comunidad/conversacion.tsx` (`"use client"`)
- Modify:
  - `src/config/navegacion.ts`: ícono `mensajes`, ítem «Mensajes» para estudiante e instructor.
  - `src/components/layout/panel-nav.tsx`: `mensajes: MessagesSquareIcon`.
  - `src/app/estudiante/cursos/[id]/page.tsx`: botón «Escribir al instructor».

**Interfaces:**
- Consumes: Tarea 2.
- Produces: `Conversacion({ conversacionId, cursoId, mensajes, otro, curso, rol })`. Se refresca cada 10 s con
  `router.refresh()` y llama a `marcarLeidos` al montar y cuando llegan mensajes nuevos.

- [ ] **Step 1: Implementar las páginas y el componente**

  - **Bandeja:** usa `PanelTabla` o una lista de tarjetas con `Pildora` para los no leídos. El instructor filtra
    por curso con `?curso=`.
  - **Conversación:**
    - Burbujas propias a la derecha (`bg-primary text-primary-foreground`).
    - `aria-live="polite"` en la lista.
    - Formulario con `useActionState(enviarMensaje)`, `Textarea` con contador `n/2000` y Enter + Ctrl para enviar.
  - **Página del estudiante** con un `cursoId` sin inscripción confirmada → `notFound()`.
  - **Página del instructor** con una conversación ajena → `notFound()` (RLS devuelve `null`).

- [ ] **Step 2: Verificar**

  Run: `npm run lint && npm run typecheck && npm test`
  Expected: PASS.

  En el navegador, sin sesión, `/estudiante/mensajes` redirige a `/login`. Sin errores en consola.

- [ ] **Step 3: Commit** — «Pantallas de mensajes del estudiante y bandeja del instructor».

---

### Task 5: Pantallas de reseñas

**Files:**
- Create:
  - `src/features/comunidad/estrellas.tsx`: `Estrellas` (visual) y `SelectorEstrellas` (radios accesibles).
  - `src/features/comunidad/formulario-resena.tsx` (`"use client"`).
  - `src/app/admin/resenas/page.tsx`.
- Modify:
  - `src/app/estudiante/cursos/[id]/page.tsx`: tarjeta «Tu reseña» si es elegible. Se calcula con
    `porcentaje >= 100` o certificado; la BD es la garantía.
  - `src/app/(publico)/cursos/[slug]/page.tsx`: promedio y lista de reseñas.
  - `src/features/catalogo/curso-card.tsx`: promedio.
  - `src/app/admin/page.tsx`: «Cursos mejor evaluados», los 5 primeros con `cantidad >= 1`.
  - `src/config/navegacion.ts` y `panel-nav.tsx`: ícono `resenas: StarIcon` e ítem del administrador.

- [ ] **Step 1: Implementar.** Si la reseña propia está oculta, el aula muestra «Oculta por moderación» y permite editarla (spec §6).

- [ ] **Step 2: Verificar**

  Run: `npm run lint && npm run typecheck && npm test`

  En el navegador:
  - El detalle de un curso sin reseñas muestra «Aún no tiene reseñas» y la portada carga sin errores.
  - `/admin/resenas` sin sesión redirige a `/login`.

- [ ] **Step 3: Commit** — «Reseñas en el aula, el catálogo y la moderación del administrador».

---

### Task 6: Documentación y verificación final

- [ ] **Step 1:** README: secciones «Mensajería (HU-19)» y «Reseñas (HU-24)». Actualizar «Estado».

- [ ] **Step 2: Verificación completa**

  Run: `npm run lint && npm run typecheck && npm run test:cobertura && npm run build && npm run test:db`
  Expected: todo PASS y cobertura ≥ 70 %. Anotar las cifras.

- [ ] **Step 3:** Commit «Documentar la mensajería y las reseñas». `git push` y `db:push` solo con la confirmación
  del usuario, junto con los de Culqi.
