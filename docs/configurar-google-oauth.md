# Configurar el login con Google (HU-45)

El código ya está listo: los botones "Continuar con Google" en `/login` y `/registro`, la ruta de retorno `/auth/google` y la pantalla `/auth/terminos`. Para que funcione falta crear las credenciales en Google y activarlas en Supabase. Mientras no se haga, el botón lleva a una página de Supabase con el error `Unsupported provider: provider is not enabled`.

## 1. Google Cloud: crear el cliente OAuth

1. Entra a <https://console.cloud.google.com/> con la cuenta de Google de la empresa y crea un proyecto (por ejemplo, "PEDSAR").
2. **APIs y servicios → Pantalla de consentimiento de OAuth** (en la consola nueva, **Google Auth Platform → Branding**):
   - Tipo de usuario: **Externo**.
   - Nombre de la app: `PEDSAR`, correo de asistencia, logo (opcional) y el dominio de la web.
   - Enlaces a la política de privacidad (`https://<dominio>/privacidad`) y a los términos.
   - Alcances (scopes): `openid`, `.../auth/userinfo.email` y `.../auth/userinfo.profile`. No pidas otros.
   - Mientras la app esté en modo **Prueba**, solo pueden entrar los correos que agregues como usuarios de prueba. Para abrirla al público, pulsa **Publicar app**. Con esos tres alcances básicos, Google no pide una verificación larga.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - **Orígenes de JavaScript autorizados:** `https://<dominio-de-producción>` (y `http://localhost:3000` para pruebas).
   - **URI de redireccionamiento autorizados** (es la URL de Supabase, no la de la web):
     - Nube: `https://fznhrrzonpgaxpqkahim.supabase.co/auth/v1/callback`
     - Local: `http://127.0.0.1:54321/auth/v1/callback`
4. Copia el **ID de cliente** y el **Secreto del cliente**. El secreto no se guarda en git.

## 2. Supabase en la nube

1. **Authentication → Sign In / Providers → Google**: activa el proveedor y pega el ID de cliente y el secreto. Guarda.
2. **Authentication → URL Configuration**:
   - **Site URL:** el dominio de producción.
   - **Redirect URLs:** agrega `https://<dominio-de-producción>/**`. Si pruebas desde las vistas previas de Vercel, agrega también `https://*-<equipo>.vercel.app/**`. Sin esto, Supabase rechaza la vuelta a `/auth/google`.
3. Aplica la migración `supabase/migrations/20261124120000_login_google.sql` (llena nombres y apellidos con los datos de Google). Recuerda que **el push a main no aplica migraciones**: hazlo con `npm run db:push` o desde el panel.

En Vercel no hace falta ninguna variable nueva. El ID y el secreto viven en Supabase.

## 3. Pruebas en local (opcional)

1. En `supabase/config.toml`, sección `[auth.external.google]`, cambia `enabled = false` por `enabled = true`.
2. Define `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` y `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` en el entorno o en `supabase/.env`. No van en `.env.local`: las lee el CLI de Supabase, no Next.js.
3. Reinicia: `npm run db:stop` y luego `npm run db:start`.

## Cómo funciona

| Situación | Qué pasa |
|---|---|
| Visitante nuevo desde `/registro` | Marca la casilla de privacidad, pulsa el botón de Google, elige su cuenta y se crea la cuenta de estudiante con su nombre y la versión y fecha de la política aceptada. Entra a su panel. |
| Visitante nuevo desde `/login` | Se crea la cuenta y pasa por `/auth/terminos`. Hasta que acepte, cualquier panel lo devuelve ahí. "Cancelar" cierra la sesión. |
| Ya tenía cuenta con correo y contraseña (mismo correo) | Supabase vincula Google a esa cuenta. Conserva su rol, sus cursos y sus pagos, y puede seguir usando su contraseña. |
| Cuenta desactivada | No entra: se cierra la sesión y ve "Tu cuenta está desactivada". |
| Cancela en Google | Vuelve a `/login` con un aviso. |

**Caso límite de la vinculación:** Supabase solo vincula cuentas con el **correo ya verificado**. Si alguien se registró con contraseña y nunca abrió el correo de confirmación, al entrar con Google Supabase deja la cuenta en manos de Google: quien demuestra ser dueño del correo es Google, y esa contraseña sin verificar deja de servir. Es el comportamiento seguro y no requiere acción.

Cada inicio de sesión con Google queda en el registro de actividad como `INICIO_SESION` con `{"proveedor": "google"}`.
