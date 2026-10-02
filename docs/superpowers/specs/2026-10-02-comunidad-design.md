# Comunidad: mensajería estudiante–instructor y reseñas de cursos — diseño

- **Fecha:** 2026-10-02
- **HU:** HU-19 (comunicación entre usuarios), HU-24 (calificación y reseña), HU-20 (cursos mejor evaluados), parte
  de HU-54 (bandeja del instructor)
- **Estado:** diseño aprobado en conversación

## 1. Objetivo y criterios de éxito

El objetivo específico 3 del proyecto promete «comunicación directa entre instructores y alumnos» y el panel debe
mostrar los «cursos mejor evaluados»; ninguna de las dos cosas existe hoy. Se considera terminado cuando:

1. Un estudiante con inscripción confirmada escribe al instructor del curso y el instructor responde desde su
   bandeja. Ambos ven todo el historial.
2. El destinatario recibe un aviso en la campana por cada mensaje, y un correo solo con el primer mensaje no leído
   de la conversación.
3. Un estudiante que completó el curso (100 % de avance o certificado emitido) lo califica de 1 a 5 estrellas con
   una reseña opcional de hasta 500 caracteres, y puede editarla.
4. El detalle del curso y el catálogo muestran el promedio y la cantidad de reseñas. El panel del administrador
   muestra los cursos mejor evaluados, y el administrador puede ocultar reseñas.
5. La BD impone las reglas (RLS y verificación de elegibilidad), con pruebas pgTAP y unitarias; la cobertura se
   mantiene en 70 % o más.

Fuera de alcance: foros (HU-22), comentarios en lecciones (HU-23), adjuntos, chat en tiempo real y mensajes del
administrador.

## 2. Decisiones

| Tema | Decisión |
|---|---|
| Alcance del chat | Privado estudiante–instructor, una conversación por curso y estudiante. El administrador no lee los chats (Ley N.º 29733). |
| Quién inicia | Solo un estudiante con inscripción CONFIRMADA en el curso. El instructor responde. |
| Actualización | La conversación abierta se refresca cada 10 s (`router.refresh()`). No es tiempo real. |
| Correo | Solo si el destinatario no tenía otros mensajes sin leer de esa conversación. |
| Elegibilidad para reseñar | Inscripción CONFIRMADA y (`progreso.porcentaje >= 100` o certificado emitido), verificada por la BD. |
| Lectura pública de reseñas | Mediante función, con el nombre abreviado del autor («Ana Q.»). La tabla no es legible por visitantes. |
| Moderación | El administrador oculta o muestra reseñas; las ocultas no cuentan en el promedio. |

## 3. Datos (migración `comunidad`)

### `conversaciones`

| Columna | Tipo y reglas |
|---|---|
| `id` | `bigint identity pk` |
| `curso_id` | `uuid` → `cursos` |
| `estudiante_id` | `uuid` → `perfiles` |
| `creada_en` | `timestamptz` |
| `ultimo_mensaje_en` | `timestamptz` |
|  | `unique (curso_id, estudiante_id)`: se conserva al reinscribirse |

RLS:
- `select`: el estudiante dueño o el instructor del curso (`privado.es_instructor_de`).
- `insert`: el estudiante dueño, si `privado.esta_inscrito_en(curso_id)`, el helper existente que exige inscripción
  CONFIRMADA. Se comprueba al implementar.
- Sin `update` ni `delete` para usuarios. `ultimo_mensaje_en` lo mantiene un trigger.

### `mensajes`

| Columna | Tipo y reglas |
|---|---|
| `id` | `bigint identity pk` |
| `conversacion_id` | → `conversaciones on delete cascade` |
| `autor_id` | → `perfiles` |
| `texto` | `text`, 1 a 2000 caracteres después de `trim` (check) |
| `enviado_en` | `timestamptz` |
| `leido_en` | `timestamptz null` |

RLS:
- `select`: participantes de la conversación.
- `insert`: `autor_id = auth.uid()` y participante. Si es el estudiante, con inscripción CONFIRMADA.
- `update`: nadie directamente. El marcado de lectura lo hace la función `public.marcar_leidos(p_conversacion
  bigint)` (`security definer`), que solo marca los mensajes del otro participante y solo si quien la llama
  participa.

Trigger: al insertar un mensaje se actualiza `conversaciones.ultimo_mensaje_en`.

### `resenas`

| Columna | Tipo y reglas |
|---|---|
| `id` | `bigint identity pk` |
| `inscripcion_id` | `uuid unique` → `inscripciones` |
| `curso_id` | `uuid` |
| `estudiante_id` | `uuid` |
| `estrellas` | `smallint`, check 1–5 |
| `texto` | `text null`, check de longitud ≤ 500 |
| `oculta` | `boolean default false` |
| `creada_en` | `timestamptz` |
| `actualizada_en` | `timestamptz` |

RLS:
- `select`: el estudiante dueño y el administrador.
- `insert` y `update`: el estudiante dueño, si `privado.puede_resenar(inscripcion_id)` y `oculta` no cambia. Un
  trigger impide que el estudiante modifique `oculta`, `curso_id` o `estudiante_id`.
- `update`: el administrador, solo `oculta`.

Funciones:
- `privado.puede_resenar(p_inscripcion uuid) returns boolean`: inscripción del usuario actual, CONFIRMADA, y
  (`progreso.porcentaje >= 100` o existe certificado).
- `public.calificacion_cursos(p_ids uuid[])`: devuelve `curso_id`, `promedio numeric(2,1)` y `cantidad int` de las
  reseñas no ocultas. Es `security definer`, ejecutable por `anon` y `authenticated`.
- `public.resenas_publicas(p_curso uuid, p_limite int default 6)`: devuelve `estrellas`, `texto`, `autor` (nombre
  y la inicial del apellido) y `fecha` de las reseñas no ocultas, de la más reciente a la más antigua.

## 4. Código

**`src/features/comunidad/mensajes.ts`** (`"use server"`)
- `enviarMensaje(_, formData)`, con `cursoId` o `conversacionId` y `texto`:
  - Valida con zod.
  - Si es el estudiante, obtiene o crea la conversación; si es el instructor, solo puede responder en una
    existente.
  - Inserta con el cliente con sesión (RLS).
  - Notifica al destinatario por la campana y programa el correo solo si no tenía otros mensajes sin leer.
  - Revalida la ruta.
- `marcarLeidos(conversacionId)` llama a la función `marcar_leidos`.

**`src/features/comunidad/consultas.ts`**
- `listarConversacionesEstudiante()`: una por curso confirmado, exista o no la conversación, con contador de no
  leídos.
- `listarBandejaInstructor(cursoId?)`: conversaciones del instructor con estudiante, curso, último mensaje y no
  leídos.
- `obtenerConversacion(...)`: mensajes ordenados por fecha.

**`src/features/comunidad/resenas.ts`** (`"use server"`)
- `guardarResena(_, formData)`: upsert por `inscripcion_id`. Si la BD rechaza por elegibilidad, muestra «Podrás
  calificar el curso cuando lo completes».
- `alternarResena(formData)` (administrador): oculta o muestra la reseña.

**Correo:** `correoMensajeNuevo({ nombre, de, curso, extracto, url })` en `lib/email/plantillas.ts`.

**Catálogo:** `listarCursosPublicados` y `obtenerCursoPorSlug` agregan `calificacion: { promedio, cantidad } |
null`, con una sola llamada a `calificacion_cursos`.

## 5. Pantallas

**Estudiante**
- Menú «Mensajes» (`/estudiante/mensajes`) con la lista de cursos confirmados y sus no leídos.
- Conversación en `/estudiante/mensajes/[cursoId]`.
- En el aula, el botón «Escribir al instructor» y la tarjeta «Tu reseña» (formulario de estrellas y texto) cuando
  es elegible.

**Instructor**
- Menú «Mensajes» (`/instructor/mensajes`): bandeja con filtro por curso y contador de no leídos.
- Conversación en `/instructor/mensajes/[conversacionId]`.

**Componentes**
- `Conversacion` (cliente): historial con burbujas propias y ajenas, formulario de envío con contador 0/2000,
  refresco cada 10 s y `marcarLeidos` al montar.
- `Estrellas`: visualización y selector accesible (radios).

**Público**
- Detalle del curso: promedio con estrellas, «(N reseñas)» y las últimas reseñas.
- Tarjeta del catálogo: promedio y cantidad, si hay reseñas.

**Administrador**
- Página «Reseñas» (`/admin/resenas`) con curso, estudiante, estrellas, texto y la acción ocultar o mostrar.
- Panel: «Cursos mejor evaluados» (los 5 primeros por promedio, con al menos 1 reseña).

La navegación agrega los íconos `mensajes` y `resenas` en `config/navegacion.ts`.

## 6. Errores y casos límite

- Estudiante sin inscripción confirmada que intenta escribir: «Solo puedes escribir en cursos en los que estás
  matriculado». La RLS lo bloquea igual.
- Instructor que intenta escribir en una conversación de un curso que no dicta: RLS → «No encontramos esa
  conversación».
- Texto vacío o con más de 2000 caracteres: error del formulario.
- Reseña de un curso no completado: la BD la rechaza y el formulario lo explica.
- Reseña oculta: el estudiante sigue viéndola con la marca «Oculta por moderación» y puede editarla. Sigue sin
  contar.
- Curso sin instructor asignado: el estudiante no puede iniciar la conversación («Este curso aún no tiene
  instructor asignado»).

## 7. Pruebas

**pgTAP (`supabase/tests/05_comunidad.test.sql`)**
- Participantes:
  - Leen y escriben.
  - Un tercero y el administrador no leen el chat.
  - Un estudiante no inscrito no crea conversación.
- `marcar_leidos` solo marca los mensajes del otro.
- `ultimo_mensaje_en` se actualiza.
- Reseñas:
  - Rechazada sin completar el curso; aceptada con 100 % de avance o con certificado.
  - Una por inscripción.
  - El estudiante no puede cambiar `oculta`.
  - Las ocultas no cuentan en `calificacion_cursos`.
  - `resenas_publicas` abrevia el nombre.

**Vitest**
- `enviarMensaje`:
  - Crea la conversación.
  - Notifica.
  - Envía el correo solo con el primer mensaje no leído.
  - Valida el texto.
  - El instructor no crea conversaciones.
- `marcarLeidos`.
- `guardarResena`: upsert, mensaje de elegibilidad y validación.
- `alternarResena` (solo el administrador).
- Las consultas mapean el promedio en el catálogo.
