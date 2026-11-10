# Correcciones prioritarias de PEDSAR

Fecha: 10 de noviembre de 2026. Cambios implementados en el repositorio y verificados contra una base Supabase local aislada. Posteriormente, por solicitud del usuario, la migración se aplicó al proyecto remoto `pedsar`. No se hicieron cobros reales ni se publicó la aplicación.

## Cambios implementados

| Problema del análisis | Comportamiento corregido |
|---|---|
| Enlaces de clases expuestos | El catálogo consulta una función que devuelve únicamente horarios. El enlace de acceso requiere matrícula confirmada, instructor del curso o administrador. |
| Cuentas desactivadas con acceso directo a la BD | Las políticas restrictivas comprueban el estado actual del perfil, incluso con una sesión anterior. Se aplica también a Storage y al helper de rol. |
| Sobrerreserva y confirmación tardía | Un bloqueo por curso serializa las reservas. El trigger comprueba también las actualizaciones: un pago tardío no puede confirmar una matrícula si ya no queda lugar; se avisa para su devolución. |
| Matrícula sin pago | `registrar_matricula` crea ambos registros en una transacción y valida estudiante, curso, precio y cupón. Si falla el pago, tampoco queda la inscripción. |
| Cupón agotado o concurrencia | El cupón se bloquea y revalida al registrar la matrícula. Los pagos aprobados y reservas vigentes consumen usos; las reservas vencidas los liberan. Un cupón inválido no se convierte silenciosamente en precio completo. |
| Reembolso manual prematuro | Aprobar deja la entrega pendiente. Confirmar la entrega cierra solicitud, pago y matrícula en una transacción. Las solicitudes antiguas atascadas pueden cerrarse después de verificar la devolución real. |
| Progreso de cursos manipulable | RLS valida que la lección pertenezca al curso de la matrícula confirmada. Un trigger recalcula el progreso; la migración elimina asociaciones anteriores de otros cursos y corrige sus porcentajes. |
| Tiempo de evaluación reiniciable | El servidor fija el vencimiento al iniciar. Recargar conserva el plazo y las respuestas guardadas en esa pestaña. La BD califica y registra cada intento bajo bloqueo; repetir un envío devuelve la nota ya registrada. Una entrega posterior al plazo y su tolerancia de 5 segundos consume el intento con nota cero. |
| Datos de cobro de ejemplo | Yape/Plin directo queda deshabilitado por defecto y cuando faltan celular o titular. La pantalla tampoco muestra instrucciones ficticias de pago. |

La aprobación de un reembolso autoriza la devolución; no ejecuta una transferencia manual. La integración existente con Culqi conserva su flujo de devolución en la pasarela.

## Verificación realizada

- 287 pruebas unitarias aprobadas, en 21 archivos.
- Cobertura de la lógica medida: sentencias 98,43%; ramas 87,02%; funciones 99,25%; líneas 99,51%. No incluye pantallas `.tsx`.
- 129 comprobaciones pgTAP aprobadas, en 6 archivos, contra PostgreSQL real. Incluyen permisos, matrículas sin registros huérfanos, pagos tardíos, progreso, vencimiento de evaluaciones, cupones y reversión completa de un cierre de reembolso fallido.
- Dos casos con conexiones simultáneas: último cupo y último uso de cupón en cursos distintos. Ambos aprobados. Reproducibles con `node scripts/probar-concurrencia.mjs` después de iniciar Supabase local. El script crea y elimina exclusivamente sus datos ficticios.
- `npm run lint`, `npm run typecheck` y `npm run build`: aprobados. La compilación requirió acceso a las fuentes públicas de Google.
- Asesor de seguridad de Supabase local, nivel advertencia: sin incidencias.

No se realizaron pruebas de navegación completas, cobros reales ni una prueba de carga de 500 usuarios. Estas comprobaciones no sustituyen la validación del despliegue con la configuración real de la empresa.

## Aplicación al entorno real

La aplicación modificada requiere la migración `supabase/migrations/20261110155700_integridad_y_seguridad.sql`, ya aplicada al proyecto remoto `pedsar` (`fznhrrzonpgaxpqkahim`). El archivo local se sincronizó con la versión asignada por Supabase para evitar aplicarlo dos veces. Los pasos siguientes siguen siendo referencia para otros entornos; en este proyecto queda pendiente publicar la aplicación actualizada.

1. Preparar un respaldo y confirmar el proyecto Supabase de destino. Revisar los registros históricos de progreso que se corregirán: la migración elimina únicamente asociaciones de lecciones con matrículas de otro curso y recalcula los porcentajes.
2. Coordinar una ventana sin matrículas ni evaluaciones en curso. La nueva versión empieza a registrar el plazo en el servidor y elimina la inserción directa de matrículas por estudiantes, por lo que código y migración deben desplegarse juntos.
3. Aplicar las migraciones pendientes al proyecto correcto con `npm run db:push` y publicar esta versión de la aplicación.
4. Verificar catálogo público sin enlaces privados, matrícula con su pago, acceso al aula, evaluación al recargar y aprobación/confirmación separadas de reembolso manual.
5. Mantener `PAGO_MANUAL_HABILITADO=false`. Cuando la empresa confirme celular y titular, completar `EMPRESA.pagoDirecto` en `src/config/empresa.ts`, comprobarlos y habilitar la variable. Los medios de Culqi dependen de su configuración independiente.

## Pendientes del documento

### Resultado de la migración remota

- Aplicada correctamente a las 15:57 UTC (10:57 de Lima), versión `20261110155700`.
- Antes de aplicar: 2 matrículas, 2 pagos, ninguna evaluación, ningún progreso registrado y ninguna asociación inválida de contenidos.
- Después de aplicar: se conservaron las 2 matrículas y los 2 pagos; se calcularon 2 registros de progreso y se verificaron 25 políticas de cuenta activa.
- Verificación con el rol `anon`: 0 sesiones privadas visibles y 64 horarios públicos disponibles.
- Las funciones de matrícula, inicio/entrega de evaluación y cierre de reembolso solo permiten ejecución por `service_role`; `horarios_publicos` es pública y usa `SECURITY INVOKER`.
- La tabla de evaluaciones en curso tiene RLS y no permite lectura a `anon` ni `authenticated`. El aviso informativo de [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) es intencional: solo la utiliza el servidor.
- Se guardó una copia local de las definiciones anteriores y del progreso afectado en `supabase/.temp/respaldo-integridad-20261110.json` (excluida de Git; no es un respaldo completo del proyecto).
- El asesor remoto mantiene advertencias preexistentes sobre [funciones públicas SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [funciones disponibles para usuarios autenticados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) y [protección de contraseñas filtradas desactivada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No aparecieron nuevas advertencias de nivel WARN con esta migración.

La base remota ya está actualizada. La versión anterior de la aplicación usa operaciones de matrícula y evaluación que cambiaron; publicar el código actualizado es el siguiente paso necesario para completar la puesta en servicio.

### Alcance funcional restante

Esta entrega aborda los riesgos prioritarios del análisis, no implementa las 65 historias completas. Continúan pendientes, entre otros, la publicación programada efectiva, la unificación del criterio de fechas en reportes financieros y las historias clasificadas como parciales o ausentes en `docs/analisis-documento-sistema-2026-11-10.md`. La configuración y las pruebas de los proveedores reales requieren los datos de la empresa.
