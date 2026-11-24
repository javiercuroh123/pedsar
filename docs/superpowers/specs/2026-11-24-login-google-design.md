# HU-45 · Login y registro con Google — diseño corto

**Intención.** La HU-45 pide que un visitante pueda registrarse e iniciar sesión con su cuenta de Google, sin tener que recordar otra contraseña. Criterios: OAuth 2.0 con Google; si el correo no existe, la cuenta se crea; si coincide con una cuenta existente, se vincula a ella. Además se debe seguir cumpliendo la HU-47 (Ley N.º 29733): aceptación explícita con checkbox y registro de la fecha y la versión aceptadas.

**Fuera de alcance.** Otros proveedores (Facebook, Apple). Usar la foto de Google como avatar. Desvincular Google desde "Mi cuenta".

**Restricciones.** Supabase Auth con `@supabase/ssr` y PKCE. Antes de que funcione, el usuario tiene que crear el cliente OAuth en Google Cloud y cargarlo en el panel de Supabase. Esa parte no se puede automatizar.

## Enfoques considerados

- **A (elegido por el usuario):** en `/registro`, el botón de Google solo se activa después de marcar el checkbox. Si alguien entra con Google desde `/login` sin haber aceptado antes, pasa por una pantalla corta para aceptar los términos.
- **B (descartado):** el texto "Al continuar aceptas…", sin checkbox. Es más simple, pero incumple la HU-47.

## Diseño

1. **Server Action `iniciarConGoogle`** (`features/usuarios/acciones.ts`). Llama a `supabase.auth.signInWithOAuth({ provider: "google" })` con `redirectTo = SITE_URL/auth/google?next=…[&acepta=<versión>]` y redirige a la URL de Google.
2. **Botón "Continuar con Google"** con el logo de Google y un separador "o". En `/login` va debajo del formulario actual y respeta `next`. En `/registro` se desactiva mientras el checkbox de privacidad no esté marcado y envía `acepta=VERSION_POLITICA_PRIVACIDAD`.
3. **Ruta `GET /auth/google`.** Canjea el `code` por la sesión. Si el perfil no tiene la privacidad aceptada y llega `acepta` con la versión vigente, la registra (RLS ya permite que el usuario actualice su propio perfil, y el trigger impide sobrescribir una aceptación anterior). Si la cuenta está inactiva, cierra la sesión y manda a `/login?error=cuenta-inactiva`. Si sigue sin aceptación, redirige a `/auth/terminos?next=…`. Si no, registra `INICIO_SESION` y redirige a `next` o al inicio de su rol. Si el canje falla, manda a `/login?error=google`.
4. **Pantalla `/auth/terminos`.** Usa el mismo diseño de las páginas de auth: checkbox con el enlace a la política, botón "Aceptar y continuar" (una Server Action registra la versión y la fecha) y la opción "Cancelar", que cierra la sesión.
5. **Bloqueo hasta aceptar.** `requireUsuario` (en `lib/auth.ts`) redirige a `/auth/terminos` cuando el perfil no tiene la privacidad aceptada y la cuenta tiene una identidad de Google. *Decisión mía:* lo limito a cuentas con Google para no obligar a aceptar a los instructores y administradores invitados ni a las cuentas antiguas. Así nadie entra al panel sin aceptar, aunque cierre la pestaña de términos.
6. **Migración: nombres desde Google.** `crear_perfil_nuevo_usuario` ahora completa `nombres` con `given_name` (o `full_name`/`name`) y `apellidos` con `family_name` cuando no llegan `nombres`/`apellidos`.
7. **Configuración.** En `supabase/config.toml` se agrega `[auth.external.google]` con el ID y el secreto en variables de entorno, `skip_nonce_check = true` para pruebas locales y la URL de retorno en `additional_redirect_urls`. Se añaden las variables a `.env.example` y una guía `docs/configurar-google-oauth.md` (Google Cloud → Supabase en la nube → URLs de redirección en Supabase y en Vercel).
8. **Vinculación.** La hace Supabase automáticamente cuando el correo ya está verificado. *Caso límite:* si la cuenta con contraseña nunca confirmó su correo, Supabase no la vincula y Google se queda con el acceso. Lo documento en la guía.
9. **Pruebas.** Pruebas unitarias en Vitest (acción, ruta `/auth/google`, pantalla de términos, bloqueo en `requireUsuario`) y pgTAP para los nombres del trigger. Nada de esto se confirma en git: el usuario sube los cambios.

**Queda para quien implemente:** los textos exactos, el SVG del logo y si el botón de Google va antes o después del formulario (propuesta: después, con el separador "o").
