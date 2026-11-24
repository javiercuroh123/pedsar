# Login con Google (HU-45): plan de implementación

> **Para agentes:** se ejecuta de forma nativa en esta sesión (superpowers:executing-plans). El usuario aprobó el diseño y pidió implementarlo. **No se confirma nada en git**, porque el usuario sube los cambios.

**Objetivo:** permitir el registro y el inicio de sesión con Google y seguir cumpliendo la HU-47 (aceptación explícita de la privacidad).

**Arquitectura:** una Server Action inicia OAuth con PKCE y redirige a Google. Al volver, la ruta `GET /auth/google` canjea el código, registra la aceptación si llegó desde `/registro` y, si falta la aceptación, manda a `/auth/terminos`. `requireUsuario` bloquea el acceso a las cuentas de Google sin aceptación.

**Tecnología:** Next.js 16 (App Router), `@supabase/ssr`, Vitest y pgTAP.

**Diseño:** `docs/superpowers/specs/2026-11-24-login-google-design.md`

## Restricciones globales

- Versión de la política: `VERSION_POLITICA_PRIVACIDAD` (`src/config/empresa.ts`, hoy `"2026-10"`).
- Solo se aceptan redirecciones internas (`/` y no `//`).
- El ID y el secreto de Google van en variables de entorno, nunca en git.

## Puntos a revisar con cuidado

1. `next=//evil.com` en `/auth/google` → debe ir al inicio del rol, nunca fuera del sitio.
2. `acepta` con una versión vieja o inventada → no registra la aceptación y manda a términos.
3. Cuenta desactivada que entra con Google → cierra la sesión y va a `/login?error=cuenta-inactiva`.
4. Cancelar en Google (`?error=access_denied`, sin `code`) → `/login?error=google`.
5. Cuenta de correo y contraseña antigua sin aceptación → `requireUsuario` NO la manda a términos.

---

### Tarea 1: nombres desde Google (migración y pgTAP) y configuración

**Archivos:** crear `supabase/migrations/20261124120000_login_google.sql` y `supabase/tests/08_login_google.test.sql`. Modificar `supabase/config.toml`, `.env.example` y `src/types/supabase.ts` (si cambia).

- `privado.crear_perfil_nuevo_usuario()`: nombres = `nombres` → `given_name` → `full_name` → `name` → `''`. Apellidos = `apellidos` → `family_name` → `''`. El resto queda igual que en `20261110170000`.
- pgTAP: insertar en `auth.users` con `{"given_name":"Rosa","family_name":"Huamán","full_name":"Rosa Huamán"}` → perfil Rosa / Huamán. Con solo `{"full_name":"Pedro Soto"}` → nombres "Pedro Soto" y apellidos "". Con `nombres`/`apellidos` → se respetan.
- `config.toml`: `[auth.external.google]` con `enabled = true`, `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"`, `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"` y `skip_nonce_check = true`. En `additional_redirect_urls` se agregan `http://localhost:3000/**` y `http://127.0.0.1:3000/**`.
- Verificar: `npm run test:db` pasa.

### Tarea 2: Server Action, ruta `/auth/google` y `requireUsuario`

**Archivos:** modificar `src/features/usuarios/acciones.ts` y `src/lib/auth.ts`. Crear `src/app/auth/google/route.ts`. Modificar `src/types/dominio.ts`, `tests/apoyo/supabase-falso.ts`, `tests/unidad/app/rutas.test.ts`, `tests/unidad/lib/servidor.test.ts` y `tests/unidad/features/usuarios-y-avisos.test.ts`.

**Interfaces que produce:**
- `iniciarConGoogle(formData: FormData): Promise<never>` lee `next` y `acepta` (`"on"`) y llama a `signInWithOAuth({ provider: "google", options: { redirectTo: SITE/auth/google?next=…&acepta=<VERSION> } })`. Si falla → `redirect("/login?error=google")`.
- `aceptarTerminos(formData: FormData): Promise<never>` requiere sesión y `aceptaPrivacidad=on`. Actualiza `perfiles` con `privacidad_version` y `privacidad_aceptada_en`, y redirige a `next` o al inicio del rol.
- `cancelarTerminos(): Promise<never>` hace `signOut` y redirige a `/login`.
- `Perfil.pendienteTerminos?: boolean`. `getUsuarioActual` lo marca como `true` cuando `privacidad_aceptada_en` es null y `claims.app_metadata.providers` incluye `"google"`. `requireUsuario` → `redirect("/auth/terminos")`.
- `GET /auth/google`: los casos 1 a 4 de la sección anterior, más el camino feliz (registra `INICIO_SESION` y redirige a `next` o al inicio del rol).

Pruebas: cada caso de los puntos a revisar con su `location` esperado, `signInWithOAuth` llamado con el `redirectTo` exacto, y la actualización del perfil con la versión vigente.

### Tarea 3: interfaz

**Archivos:** crear `src/features/usuarios/boton-google.tsx` y `src/app/(auth)/auth/terminos/page.tsx`. Modificar `src/features/usuarios/formularios.tsx`, `src/app/(auth)/login/page.tsx` y `src/app/(auth)/registro/page.tsx`.

- `BotonGoogle({ next?: string; acepta?: boolean; deshabilitado?: boolean })` es un `<form action={iniciarConGoogle}>` con el separador "o", el logo SVG oficial de 4 colores y el texto "Continuar con Google".
- En `RegistroForm`, el checkbox de privacidad pasa a controlado y el botón de Google queda desactivado (con un aviso) hasta marcarlo.
- En `/login`, el mensaje `error=google` dice "No se pudo iniciar sesión con Google. Inténtalo de nuevo.".
- `/auth/terminos`: si no hay usuario → `/login`. Si ya aceptó → inicio del rol. Si no, muestra el checkbox, "Aceptar y continuar" y "Cancelar".

### Tarea 4: documentación y verificación

- `docs/configurar-google-oauth.md`: Google Cloud (pantalla de consentimiento y cliente web con la URI `https://<ref>.supabase.co/auth/v1/callback` y la local `http://127.0.0.1:54321/auth/v1/callback`), panel de Supabase (proveedor Google y URLs de redirección), Vercel y el caso límite de la vinculación.
- Ejecutar `npm run test`, `npm run lint`, `npm run typecheck` y `npm run test:db`. Revisar `/login`, `/registro` y `/auth/terminos` en el navegador.
