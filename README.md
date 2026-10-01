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
  con temporizador y calificación en el servidor, pagos/reembolsos y certificados imprimibles.
- **Instructor:** panel, contenidos (subida directa a Storage), sesiones, asistencia,
  constructor de evaluaciones y notas.
- **Administrador:** dashboard, cursos, categorías, inscripciones y pagos, reembolsos, cupones,
  certificados (emisión masiva), usuarios y roles, reportes (exportación CSV para Excel) y auditoría.
- **Cuenta:** perfil con foto, contraseña, exportación de datos (JSON) y notificaciones.
- Modo claro/oscuro, alto contraste y tamaño de fuente ajustable (RNF-08).

**Pagos:** mientras se activa la pasarela, el cobro es directo por Yape o Plin (contingencia
de la Tabla 12). El estudiante registra el N.º de operación y la captura en «Pagos» (bucket
privado `vouchers`) y el administrador valida en «Inscripciones y pagos»: confirma, observa
(devuelve para corregir) o rechaza. El celular de cobro se configura en `src/config/empresa.ts`.

Pendiente: cobro con tarjeta mediante el checkout de la pasarela, emisión de comprobantes SUNAT
y reembolso automático en la pasarela.
Varias funciones (pagos, evaluaciones, notificaciones, auditoría) requieren `SUPABASE_SECRET_KEY`.

## Scripts

| Script | Uso |
|---|---|
| `dev` / `build` / `start` | Desarrollo / compilación / producción |
| `lint` / `typecheck` | Calidad de código |
| `db:start` / `db:stop` | Supabase local |
| `db:reset` | Recrear la BD con migraciones + seed |
| `db:migration <nombre>` | Nueva migración |
| `db:types` | Regenerar tipos de la BD local |
| `db:types:nube` | Regenerar tipos desde el proyecto vinculado en la nube |
| `db:push` | Aplicar migraciones al proyecto en la nube |
