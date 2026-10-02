# PEDSAR · Sistema de gestión de cursos y capacitaciones

Sistema web para **PEDSAR E.I.R.L.**: catálogo público, inscripción y pago en línea,
portales de estudiante e instructor, panel de administración y certificados digitales
con código de verificación pública.

## Stack (Tabla 6 del proyecto)

| Área | Tecnología |
|---|---|
| Lenguaje | TypeScript |
| Framework | Next.js 16 (App Router) + React 19 |
| Estilos / UI | TailwindCSS 4 + shadcn/ui |
| Base de datos y servicios | Supabase: PostgreSQL, Auth (roles), Storage |
| Pagos | Culqi · Izipay · Niubiz (Yape y Plin) — intercambiables |
| Correos | Resend |
| Analítica | Google Analytics 4 (+ Meta Pixel) |
| Hosting / monitoreo | Vercel + Sentry |

## Requisitos

- Node.js 20.9+ (probado con 24)
- Docker Desktop (para Supabase local) — o un proyecto en supabase.com

## Puesta en marcha

```bash
npm install
cp .env.example .env.local
npm run db:start          # levanta Supabase local y muestra las claves
```

Copia `Publishable key` y `Secret key` que imprime `db:start` a `.env.local`, luego:

```bash
npm run db:reset          # aplica migraciones + datos de ejemplo
npm run db:types          # genera src/types/database.ts tipado
npm run dev               # http://localhost:3000
```

- Studio (BD visual): http://127.0.0.1:54323
- Correos locales (verificación, recuperación): http://127.0.0.1:54324
- Para convertir una cuenta en administrador:
  `update perfiles set rol = 'administrador' where correo = 'tu@correo.com';`

## Estructura

```
supabase/
  migrations/…_esquema_inicial.sql   Diagrama de clases → tablas, enums, triggers, RLS y buckets
  seed.sql                           Categorías, cursos y cupón de ejemplo
src/
  proxy.ts                           Refresca la sesión y protege /admin, /instructor, /estudiante, /cuenta
  app/
    (publico)/                       Inicio, catálogo, detalle, inscripción, verificar, nosotros, contacto
    (auth)/                          Login, registro, recuperar contraseña
    auth/confirm/                    Enlaces de verificación de Supabase Auth
    estudiante/  instructor/  admin/ Portales por rol (cada layout valida el rol)
    cuenta/                          Perfil, notificaciones, nueva contraseña (todos los roles)
    api/pagos/webhook/[proveedor]/   Confirmación de pagos desde la pasarela
    api/salud/                       Health check para monitoreo
  features/                          Lógica por paquete del diagrama de clases
    usuarios/  catalogo/  matricula/  certificacion/
  lib/
    supabase/  (client, server, proxy, admin)
    pagos/     Interfaz PasarelaPago + Culqi / Izipay / Niubiz
    email/     Resend + plantillas
    auth.ts    getUsuarioActual, requireUsuario, requireRol
    auditoria.ts  certificados.ts  formato.ts  env.ts
  config/navegacion.ts               Menús por rol y rutas protegidas
  components/ui/                     shadcn/ui
```

## Seguridad

- **RLS activo en todas las tablas**: cada rol solo ve lo suyo; el admin ve todo.
- Un usuario no puede cambiarse el rol ni el estado (trigger `proteger_campos_perfil`).
- El cupo se valida en la base de datos (trigger), no solo en la interfaz.
- Las respuestas correctas de las evaluaciones no son legibles por estudiantes.
- `SUPABASE_SECRET_KEY` ignora RLS: úsala solo en `lib/supabase/admin.ts` (servidor).
- Las funciones auxiliares de RLS (`rol_actual`, `es_instructor_de`, …) viven en el esquema
  `privado`, que la API no expone. Solo son públicas a propósito `cupo_disponible`,
  `verificar_certificado` e `instructores_publicos`.

## Estado

Todas las pantallas del prototipo están implementadas y conectadas a Supabase:

- **Sitio público:** inicio, catálogo con filtros instantáneos, detalle de curso, inscripción
  en 3 pasos con cupones, verificación de certificados, nosotros, contacto y privacidad.
- **Estudiante:** panel, mis cursos, aula virtual (video/PDF/enlace y progreso), evaluaciones
  con temporizador y calificación en el servidor, pagos/reembolsos y certificados en PDF con QR de verificación.
- **Instructor:** panel, contenidos (subida directa a Storage), sesiones, asistencia,
  constructor de evaluaciones y notas con reporte del curso en Excel y PDF (HU-42).
- **Administrador:** dashboard, cursos, categorías, inscripciones y pagos, reembolsos, cupones,
  certificados (emisión masiva), usuarios y roles, reportes de usuarios, inscripciones e ingresos en Excel y PDF (RF-10) y auditoría.
- **Cuenta:** perfil con foto, contraseña, exportación de datos (JSON) y notificaciones.
- Modo claro/oscuro, alto contraste y tamaño de fuente ajustable (RNF-08).

**Pagos en línea (HU-12, RF-09):** con Culqi. Al inscribirse se crea la inscripción PENDIENTE,
que reserva el cupo 48 horas (`PLAZO_PAGO_HORAS`), y el estudiante paga en «Pagos» con Culqi
Checkout Custom:

- **Tarjeta o Yape:** el checkout entrega un token y el servidor crea el cargo
  (`src/features/matricula/pago-en-linea.ts`). Si el banco pide 3DS, el navegador ejecuta Culqi3DS
  y el servidor reintenta. Un rechazo no cancela la inscripción: se puede reintentar.
- **Plin, otras billeteras, banca móvil o agentes:** el servidor crea una orden que vence junto con
  la reserva. Culqi avisa por webhook (`/api/pagos/webhook/culqi?clave=…`) y el servidor **consulta
  la orden en la API** y compara el monto antes de confirmar. Nunca confía en el contenido del aviso.
- Todas las vías confirman con `confirmarPago()` (`src/features/matricula/confirmar-pago.ts`),
  que es idempotente.
- Un segundo cobro sobre un pago ya aprobado se avisa al administrador para reembolsarlo, y un
  aviso repetido nunca revive un pago reembolsado.
- Si el aviso no llega, el pago se concilia consultando la API: al volver a abrir el pago, o con
  «Verificar en Culqi» en «Inscripciones y pagos».
- Los reembolsos aprobados de cargos de Culqi se devuelven en la pasarela por el monto pagado.
  Si Culqi falla, el administrador puede reintentar o marcarlo como devuelto a mano.
- Si Culqi no responde, el estudiante puede cambiar al pago directo por Yape o Plin sin perder la
  reserva.
- Un cupón del 100 % confirma la matrícula sin cobro.
- Sin `NEXT_PUBLIC_CULQI_PUBLIC_KEY`, `CULQI_SECRET_KEY` y `CULQI_WEBHOOK_SECRET`, el pago en línea
  aparece como «Próximamente».

**Pago directo (contingencia de la Tabla 12):** Yape o Plin al celular de `src/config/empresa.ts`.
El estudiante registra el N.º de operación y la captura (bucket privado `vouchers`), y el
administrador confirma, observa o rechaza en «Inscripciones y pagos». Se apaga con
`PAGO_MANUAL_HABILITADO=false`.

**Vencimiento:** si no se paga a tiempo, la inscripción deja de contar en el cupo y una tarea de
pg_cron (cada 15 min) la cancela, marca el pago como VENCIDO y avisa al estudiante. Una inscripción
cancelada no impide volver a inscribirse.

**Comprobante de pago (HU-30):** al aprobarse un pago, por cualquier vía, un trigger de la BD
emite el comprobante interno `CP01-000001`:

- Congela el cliente (o el RUC y la razón social si pidió factura), el curso, los importes con el
  cupón, el medio y la referencia de Culqi.
- El PDF se genera al vuelo en `/comprobantes/[id]/pdf` y lo enlazan «Pagos» y el correo de
  confirmación.
- Lleva la nota de que **no reemplaza la boleta o factura electrónica SUNAT**, que está pendiente
  (HU-31).

**Prueba real de Culqi:**

1. En CulqiPanel (entorno de integración), copia `pk_test_…` y `sk_test_…` a `.env.local` y a
   Vercel (Preview).
2. Define `CULQI_WEBHOOK_SECRET`.
3. En Eventos → Webhooks, registra `order.status.changed` y `charge.creation.succeeded` hacia
   `https://<staging>/api/pagos/webhook/culqi?clave=<CULQI_WEBHOOK_SECRET>`.
4. Prueba estos medios:
   - Visa `4111 1111 1111 1111` (09/30, CVV 123): aprobada.
   - Visa con 3DS `4456 5300 0000 1096` (07/30, CVV 111).
   - Yape `900 000 001` con cualquier código de 6 dígitos.
   - Una billetera por orden.

**Certificados (HU-11):** se emiten a quien rinde todas las evaluaciones con nota final ≥ 13/20 y
asiste al 75 % de las sesiones dictadas (`src/config/academico.ts`; la función
`resultado_academico` de la BD calcula nota, asistencia y avance). Quien no cumple solo se emite
como excepción, con un motivo que queda en la auditoría. Al emitir se congelan nombre, curso,
horas, instructor y nota. El PDF (A4, con QR a `/verificar`) se genera al vuelo en
`/certificados/[codigo]/pdf` con pdf-lib y uqr; la verificación pública muestra la nota solo en
los certificados de aprobación.

**Reportes (RF-10, HU-42):** el administrador exporta usuarios, inscripciones e ingresos por
curso, método de pago y mes; el instructor, el reporte de su curso (estudiantes con contacto,
calificaciones y asistencia por sesión), ambos en Excel (`write-excel-file`, `src/lib/excel.ts`)
y PDF (`pdf-lib`, `src/lib/pdf/reporte.ts`).

**Correos (HU-21):** al inscribirse (cómo pagar y plazo), al observar, confirmar (con el comprobante) o
rechazar un pago y al emitir un certificado. Se envían con Resend después de responder
(`after`), sin demorar la acción; sin `RESEND_API_KEY` solo se muestran en la consola del
servidor. Para producción hay que verificar el dominio de `EMAIL_FROM` en Resend.

Pendiente: emisión de boletas y facturas electrónicas SUNAT (HU-31) y recordatorios programados
de sesiones y evaluaciones.
Varias funciones (pagos, evaluaciones, notificaciones, auditoría) requieren `SUPABASE_SECRET_KEY`.

## Pruebas (Definición de Terminado)

```bash
npm test                  # pruebas unitarias (Vitest)
npm run test:cobertura    # con informe de cobertura en coverage/ (mínimo exigido: 70 %)
npm run test:db           # pruebas de la BD con pgTAP (requiere `npm run db:start`)
```

- **Unitarias** (`tests/unidad`): reglas de aprobación y plazos, acciones de servidor
  (inscripción, pago manual, validación de pagos, emisión de certificados, evaluaciones,
  asistencia…), consultas, rutas (webhook, PDF, exportaciones), PDF y Excel generados
  (se abren y se leen sus textos y celdas) y correos. Supabase se simula con
  `tests/apoyo/supabase-falso.ts`, que registra cada consulta para comprobar qué se leyó o
  escribió. La cobertura se mide sobre la lógica (`src/lib`, `src/config`, `src/features/**/*.ts`,
  rutas y proxy); el umbral de 70 % está en `vitest.config.mts` y hace fallar la ejecución.
- **Base de datos** (`supabase/tests`): RLS por rol (visitante, estudiante, instructor,
  administrador), cupo y reservas de 48 h, vencimiento por pg_cron, reinscripción, N.º de
  operación único, `resultado_academico` y verificación pública de certificados. Cada archivo
  corre en una transacción que se revierte.
- **CI** (`.github/workflows/calidad.yml`): en cada push y pull request ejecuta lint, tipos,
  pruebas con cobertura, `next build` y las pruebas de la BD contra un Supabase local.

## Despliegue (Vercel)

El repositorio está enlazado a Vercel: cada push a una rama crea un despliegue de
**staging** (preview) y `main` es **producción**. Las funciones corren en `iad1`, la misma
zona que la BD de Supabase (us-east-1).

1. Variables en Vercel → Project → Settings → Environment Variables (ver `.env.example`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
   (marcarla como *Sensitive*), `RESEND_API_KEY`, `EMAIL_FROM` y `NEXT_PUBLIC_SENTRY_DSN`.
   `NEXT_PUBLIC_SITE_URL` solo hace falta con un dominio propio: si no está, se usa el dominio
   de producción o el de la rama.
2. Supabase → Authentication → URL Configuration: Site URL = dominio de producción y, en
   Redirect URLs, `https://<dominio>/**` y el patrón de los previews de Vercel.
3. Verificación: `GET /api/salud` responde `{"estado":"ok"}` si la app llega a la BD.

## Scripts

| Script | Uso |
|---|---|
| `dev` / `build` / `start` | Desarrollo / compilación / producción |
| `lint` / `typecheck` | Calidad de código |
| `test` / `test:cobertura` | Pruebas unitarias / con cobertura |
| `test:db` | Pruebas de la base de datos (pgTAP, Supabase local) |
| `db:start` / `db:stop` | Supabase local |
| `db:reset` | Recrear la BD con migraciones + seed |
| `db:migration <nombre>` | Nueva migración |
| `db:types` | Regenerar tipos de la BD local |
| `db:types:nube` | Regenerar tipos desde el proyecto vinculado en la nube |
| `db:push` | Aplicar migraciones al proyecto en la nube |
