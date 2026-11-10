# Comparación del documento SENATI y el sistema PEDSAR

Fecha: 10 de noviembre de 2026.

Actualización posterior: las correcciones prioritarias y su verificación se documentan en [Correcciones críticas](correcciones-criticas-2026-11-10.md). Este informe conserva el diagnóstico y los resultados de la revisión inicial.

## Alcance y conclusión

Se contrastaron las 65 historias de usuario y los anexos de requisitos de `Sistema_Gestion_PM_SENATI_.pdf` con rutas, componentes, acciones de servidor, migraciones SQL, configuración y pruebas del repositorio. Las páginas indicadas abajo son las del contador del PDF; la numeración impresa es tres páginas menor desde el cuerpo del documento.

El sistema tiene una base funcional amplia: catálogo, cuentas, matrícula, integración programada con Culqi, pago manual, aula, evaluaciones, asistencia, mensajería, reseñas, certificados verificables y reportes. Sin embargo, no cumple todavía todo el alcance documentado, incluso dentro de las historias Must. También hay defectos de integridad y autorización que deben resolverse antes de operar con pagos y datos reales.

Esta es una revisión del código local y sus pruebas automatizadas, no una certificación del despliegue. No se hicieron cobros, envíos de correos, cambios de datos ni pruebas de intrusión en producción. Los hallazgos de SQL describen lo que permiten las migraciones; falta reproducirlos contra una base aislada con la configuración efectivamente desplegada. No se modificó el código funcional.

## Comprobaciones ejecutadas

| Comprobación | Resultado |
|---|---|
| `npm test -- --reporter=dot` | 285 pruebas aprobadas en 21 archivos. |
| `npm run test:cobertura -- --reporter=dot` | Aprobado. Sentencias 98,68%; ramas 87,95%; funciones 99,50%; líneas 99,64%. |
| `npm run typecheck` | Aprobado. |
| `npm run lint` | Falla: 3 errores por importaciones `require()` y 1 advertencia en `.superpowers/sdd/documento-docx/visitante/generar_docx.js`. |
| Pruebas de BD pgTAP | No ejecutadas: al intentar consultar la ayuda, la CLI de Supabase falla por falta de permiso para escribir su archivo de telemetría en el perfil del usuario. No se solicitó modificar ese perfil. |
| Compilación de producción, navegación E2E, carga y proveedores reales | No ejecutados en esta revisión. |

La cobertura corresponde a la selección de lógica TypeScript de `vitest.config.mts`: excluye las pantallas `.tsx`. Las pruebas unitarias simulan Supabase. Por ello, los porcentajes no demuestran cumplimiento del documento, funcionamiento de RLS real, concurrencia, accesibilidad ni capacidad para 500 usuarios simultáneos.

## Defectos y riesgos concretos

### 1. Enlaces de clases virtuales accesibles desde la API pública — Alta

La política `sesiones_lectura` autoriza leer sesiones siempre que su curso sea visible. Los cursos publicados son visibles sin iniciar sesión. La misma tabla contiene `enlace_virtual`, sin una restricción de columnas en las migraciones revisadas. Aunque la ficha pública seleccione solo el horario, una consulta directa a la API puede solicitar el enlace.

Evidencia: [política de sesiones](C:/Users/Javier/Documents/proyectos/pedsar/supabase/migrations/20260926000000_esquema_inicial.sql:427), tabla en la línea 164 y política de cursos en la 414.

Acción: separar los horarios públicos del enlace privado y permitir obtener este último únicamente a matriculados confirmados y personal autorizado. Verificar con una prueba como visitante. El acceso efectivo depende también de los grants y esquemas expuestos en la base desplegada. La [documentación oficial de RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) confirma que la autorización de filas debe aplicarse en la base y no solo en las consultas que construye la interfaz.

### 2. Desactivar una cuenta no bloquea todas sus operaciones en la base — Alta

`requireUsuario()` revisa `perfil.estado`, pero `rol_actual()` devuelve el rol sin comprobarlo. Las políticas basadas en `auth.uid()`, pertenencia o rol tampoco aplican un bloqueo general por cuenta inactiva. `alternarUsuario()` solo cambia el booleano del perfil. Un usuario con sesión puede saltarse la interfaz y seguir realizando operaciones que sus políticas permitan; en el caso de un administrador desactivado, `es_admin()` seguirá reconociendo su rol.

Evidencia: [helper de rol](C:/Users/Javier/Documents/proyectos/pedsar/supabase/migrations/20260926000000_esquema_inicial.sql:88), `src/lib/auth.ts`, `alternarUsuario` en `src/features/administracion/acciones.ts`.

Acción: verificar estado activo en la autorización de BD y gestionar la suspensión de acceso en Auth. Añadir pruebas con una sesión emitida antes de desactivar al usuario.

### 3. El cupo no está protegido ante inscripciones simultáneas — Alta

El trigger consulta el cupo y después permite insertar, sin bloquear una fila común del curso ni serializar la reserva. Dos transacciones pueden observar el último cupo libre y reservarlo ambas. Además, el trigger actúa solo al insertar: no protege una actualización que reactiva una matrícula.

Hay otro caso concreto: `confirmarPago()` solo vuelve a comprobar cupo cuando la inscripción ya está CANCELADA. Una reserva vencida aún PENDIENTE, antes de ejecutarse el cron, ya no cuenta en `cupo_disponible()` pero puede confirmarse sin esa comprobación.

Evidencia: [validación de cupo](C:/Users/Javier/Documents/proyectos/pedsar/supabase/migrations/20261001153046_vencimiento_reservas.sql:83), [confirmación](C:/Users/Javier/Documents/proyectos/pedsar/src/features/matricula/confirmar-pago.ts:96).

Acción: reservar y confirmar dentro de operaciones transaccionales que bloqueen por curso y validen el estado actual. Probar dos reservas concurrentes para el último cupo y un pago recibido después del vencimiento.

### 4. Reembolsos manuales marcados como devueltos antes de completar la devolución — Alta

Al aprobar una devolución de Yape/Plin directo u orden sin cargo `chr_`, se ejecuta `cerrar("APROBADO")`. Esa función ya marca el pago REEMBOLSADO y cancela la inscripción, aunque el mensaje dice que todavía debe devolverse el dinero. Después, la acción y el botón «Devuelto a mano» exigen que el pago siga APROBADO; por tanto, este flujo deja la solicitud APROBADA sin poder cerrarla como PROCESADA desde la interfaz.

Evidencia: [transición de estados](C:/Users/Javier/Documents/proyectos/pedsar/src/features/administracion/acciones.ts:318), llamada en la línea 352 y condición en la 362; `src/app/admin/inscripciones/page.tsx`.

Acción: distinguir aprobación, devolución pendiente y devolución realizada; registrar fecha, referencia y responsable de la devolución. Cambiar el estado económico solo cuando se confirme la entrega del dinero.

### 5. El tiempo de evaluación se puede reiniciar o eludir — Alta

El contador nace en `useState(tiempoMin * 60)`. Recargar la página reinicia el contador y borra las respuestas locales, sin consumir un intento. `enviarEvaluacion()` no lee el tiempo límite ni una fecha persistida de inicio, por lo que no puede rechazar una entrega fuera de plazo.

Evidencia: [contador](C:/Users/Javier/Documents/proyectos/pedsar/src/features/academico/rendir-evaluacion.tsx:40), [calificación del servidor](C:/Users/Javier/Documents/proyectos/pedsar/src/features/academico/acciones-estudiante.ts:64). HU-09, PDF 89.

Acción: crear un intento con inicio y vencimiento calculados en servidor, conservar respuestas y validar el vencimiento al recibirlas.

### 6. Se puede adulterar el progreso asociando datos de otro curso — Alta

`marcarCompletado()` recibe del formulario inscripción, contenido y curso, pero no verifica que los tres correspondan. La política de inserción solo comprueba que la inscripción sea del usuario; no exige matrícula confirmada ni que el contenido pertenezca al curso. `actualizarProgreso()` usa el `cursoId` recibido para el denominador y el número de contenidos completados de la inscripción para el numerador.

Ejemplo: usar una inscripción propia de un curso largo y enviar el ID de un curso con una sola lección puede producir un 100% incorrecto en `progreso`. La elegibilidad para reseñas consulta esa tabla. También se pueden asociar contenidos ajenos cuyos IDs existan. Esto no equivale por sí solo a obtener un certificado, porque su emisión evalúa otras condiciones.

Evidencia: [acción](C:/Users/Javier/Documents/proyectos/pedsar/src/features/academico/acciones-estudiante.ts:33), [política](C:/Users/Javier/Documents/proyectos/pedsar/supabase/migrations/20260926000000_esquema_inicial.sql:511), `privado.puede_resenar` en la migración de comunidad.

Acción: deducir el curso de la inscripción en servidor y comprobar pertenencia del contenido y matrícula confirmada también en BD. Recalcular progreso al agregar o eliminar materiales, no solamente cuando el estudiante marca una lección.

### 7. Inscripción y pago pueden quedar separados — Alta

Se inserta primero la inscripción y después el pago. El resultado de insertar el pago no recoge ni maneja `error`. Si falla, la reserva queda creada y el flujo continúa enviando confirmación y redirigiendo a pagos, aunque no exista un pago utilizable.

Evidencia: [creación del pago](C:/Users/Javier/Documents/proyectos/pedsar/src/features/matricula/acciones.ts:110).

Acción: realizar ambas inserciones en una transacción o implementar una compensación explícita y un mensaje de fallo. Probar el fallo de la segunda inserción.

### 8. Publicación programada sin ejecución — Media

El formulario promete «Publicar automáticamente el» y `guardarCurso()` guarda `publicar_en`, pero no hay tarea, trigger ni consulta que convierta el curso a PUBLICADO al llegar esa fecha. El único cron encontrado vence reservas. El catálogo filtra por `estado = PUBLICADO` sin usar `publicar_en`.

Evidencia: [guardado de fecha](C:/Users/Javier/Documents/proyectos/pedsar/src/features/administracion/acciones.ts:88), `src/features/administracion/dialogo-curso.tsx`, `src/features/catalogo/consultas.ts`. HU-57, PDF 105.

Acción: implementar publicación programada idempotente con registro de ejecución; evitar que una fecha futura y un estado PUBLICADO produzcan una publicación inmediata no deseada.

### 9. Destino del pago directo todavía es un ejemplo — Alta antes de abrir pagos

`EMPRESA.pagoDirecto.celular` contiene `956 000 000` con un TODO que pide reemplazarlo; ocurre lo mismo con teléfono y WhatsApp. El formulario y el correo de pago directo usan esta configuración.

Evidencia: [configuración de empresa](C:/Users/Javier/Documents/proyectos/pedsar/src/config/empresa.ts:6).

Acción: verificar con la empresa el número y titular reales, sustituirlos y probar las instrucciones que recibe el estudiante antes de habilitar el cobro directo.

### 10. Los reportes no usan el mismo criterio temporal para los ingresos — Media

El dashboard calcula ingresos por `fecha_pago`. `generarReporte()` filtra por fecha de inscripción y asigna el ingreso al mes de inscripción. Una inscripción de octubre pagada en noviembre cuenta en noviembre en el dashboard y en octubre en el reporte por cohortes. El comentario del reporte documenta ese criterio, pero no es equivalente a un reporte de cobros mensuales.

Evidencia: `src/app/admin/page.tsx`, [agregación del reporte](C:/Users/Javier/Documents/proyectos/pedsar/src/features/administracion/reportes.ts:108).

Acción: acordar con la empresa si se reportan cobros o ingresos por cohorte; ofrecer ambas vistas con nombres claros y pruebas para pagos en un mes diferente al de matrícula.

### 11. Los cupones tienen validación incompleta bajo concurrencia — Media

El máximo de usos se comprueba contando pagos antes de crear el nuevo pago, sin consumo transaccional. Dos solicitudes concurrentes pueden superar el máximo. El conteo incluye todos los estados de pago, por lo que reservas vencidas o pagos rechazados también consumen disponibilidad. Si el cupón deja de ser válido después de mostrar el descuento, `inscribirse()` lo convierte en `null` y continúa con el precio completo sin pedir una nueva confirmación del importe.

Evidencia: `buscarCupon` e `inscribirse` en `src/features/matricula/acciones.ts`.

Acción: definir qué estados consumen un uso, reservarlo atómicamente y avisar cuando el monto final cambia.

## Matriz de historias de usuario

«Base presente» significa que existe una implementación reconocible; no implica aceptación funcional en producción. «Parcial» indica criterios pendientes o defectos relevantes. «No encontrada» se refiere al código y esquema revisados, no a trabajo externo que pudiera existir.

| HU | Prioridad | Estado observado y diferencia principal |
|---|---|---|
| 01 Registro | Must | Base presente: validación de correo y contraseña; activación depende de configuración Auth. |
| 02 Login | Must | Parcial: login implementado, sin opción explícita «Recordar sesión». |
| 03 Usuarios y roles | Must | Parcial: invitaciones, roles y desactivación; falta edición administrativa completa del perfil y corregir el bloqueo en BD. |
| 04 Publicación de cursos | Must | Parcial: gestión administrativa; portada mediante URL, sin carga desde el formulario ni requisitos previos estructurados; instructor no tiene flujo de creación/publicación equivalente. |
| 05 Catálogo | Must | Base presente: filtros de categoría, nivel, modalidad, precio máximo y búsqueda. |
| 06 Detalle | Must | Parcial: ficha, módulos e instructor; faltan requisitos previos configurables. |
| 07 Inscripción | Must | Parcial: reservas y estados; no verifica requisitos previos; corregir atomicidad y cupo. |
| 08 Contenidos | Must | Parcial: crear y borrar módulos/materiales; no se encontró edición de contenidos existentes ni reordenamiento. |
| 09 Evaluaciones | Must | Parcial: preguntas, puntajes e intentos; tiempo sin protección del servidor. |
| 10 Progreso | Must | Parcial: panel y porcentajes presentes; corregir integridad y actualización al cambiar contenidos. |
| 11 Certificados | Must | Parcial: PDF, QR y verificación; emisión iniciada por administrador y firmas dibujadas como líneas/nombres, sin firma digital incorporada. |
| 12 Pagos | Must | Base presente con Culqi y comprobante interno PDF; integración real pendiente de verificar. El documento dice Culqi, Izipay **o** Niubiz: no exige implementar los tres. |
| 13 Recuperación | Must | Parcial: enlace y nueva contraseña presentes; configuración local `otp_expiry = 3600` frente a 24 horas exigidas. No se comprobó configuración remota. |
| 14 Cierre de sesión | Must | Parcial: `signOut()` y salida a login; el PDF pide redirección al inicio. La invalidación inmediata de tokens ya emitidos requiere una prueba específica. |
| 15 Perfil | Must | Parcial: nombre, teléfono, documento, foto y contraseña; no hay fecha de nacimiento. |
| 16 Sesiones | Must | Parcial: fecha, inicio, duración y enlace; modalidades usan SEMIPRESENCIAL, no ASÍNCRONA como exige esta HU. |
| 17 Cupos | Must | Parcial: configuración y cálculo presentes; falta protección concurrente. |
| 18 Categorías | Must | Parcial: crear/editar/borrar; sin imagen, subcategorías ni desactivación. |
| 19 Mensajería | Must | Base presente: conversaciones por curso, historial, no leídos y avisos; correo agrupado al primer mensaje sin leer en lugar de uno por cada mensaje. |
| 20 Dashboard | Must | Base presente: indicadores y reportes; acordar criterio temporal de ingresos. |
| 21 Correos | Must | Parcial: confirmaciones y avisos transaccionales; sin recordatorio de inicio ni aviso al crear evaluaciones. |
| 22 Foros | Must | No encontrada: faltan foro por curso, temas y respuestas. El chat privado no cubre esta HU. |
| 23 Comentarios | Must | No encontrada: faltan comentarios por lección, respuestas y marca de resuelto. |
| 24 Reseñas | Must | Base presente: estrellas, texto y promedio; depende de corregir la elegibilidad por progreso. |
| 25 Recomendaciones | Must | No encontrada: el dashboard muestra matrículas, no recomendaciones basadas en historial/categoría/instructor. |
| 26 Descargar materiales | Must | Parcial: acceso a archivos con URL firmada; sin registro específico de fecha de descarga. |
| 27 Reproductor | Should | Parcial: video HTML5 y enlaces embebidos; sin seguimiento de tiempo visto. |
| 28 Completar lección | Should | Parcial: marcado manual; sin completado automático al terminar video. |
| 29 Reintentos | Should | Base presente: límite, historial y mejor nota. |
| 30 Historial de pagos | Should | Base presente: listado y comprobante interno PDF. |
| 31 Facturación | Should | Parcial: recoge RUC/razón social; falta factura electrónica PDF/XML y envío correspondiente. El comprobante CP01 declara que no reemplaza un comprobante SUNAT. |
| 32 Cupones | Should | Parcial: porcentaje, vigencia y máximo; sin asignación a cursos/categorías, con riesgos de concurrencia. |
| 33 Búsqueda avanzada | Should | Parcial: búsqueda también por instructor; falta filtro de duración y límite mínimo del rango de precio. |
| 34 Instructores | Should | Parcial: rol, especialidad, foto y asignación a cursos; sin biografía ni certificaciones estructuradas. |
| 35 Gamificación | Should | No encontrada: puntos e insignias. |
| 36 Ranking | Should | No encontrada: ranking global, por curso y actualización semanal. |
| 37 Compartir logros | Should | Parcial: enlace para LinkedIn y verificación; faltan Facebook, WhatsApp e imágenes por red. |
| 38 Google Calendar | Should | No encontrada: conexión, creación y actualización de eventos. |
| 39 Offline | Should | No encontrada como módulo: descargar un archivo no incluye sincronización de progreso ni almacenamiento offline gestionado. |
| 40 PWA | Should | No encontrada: manifest/service worker, instalación y push. |
| 41 Recordatorios | Should | No encontrada: faltan tareas de 24 h/1 h y preferencias de canal; mostrar próximas sesiones no equivale a notificar. |
| 42 Reportes instructor | Should | Base presente: estudiantes, contacto, progreso, notas y asistencia en Excel/PDF. |
| 43 Chatbot | Should | No encontrada: respuestas FAQ y derivación humana. |
| 44 Exportar datos | Could | Parcial: descarga JSON directa; omite intentos, asistencia y otros datos académicos; no envía archivo por correo como exige la HU. |
| 45 Encuestas | Could | No encontrada: la reseña de un curso no es una encuesta personalizable por dimensiones. |
| 46 Verificar correo | Could | Parcial: flujo mediante enlace; no hay pantalla de código de seis dígitos ni reenvío. Confirmación desactivada en configuración local. |
| 47 Google OAuth | Could | No encontrada. |
| 48 Landing | Could | Parcial: hero, categorías, cursos y CTA; no se encontró sección de testimonios. |
| 49 Privacidad/términos | Could | Parcial: página y checkbox; no persiste fecha ni versión aceptada. |
| 50 Reembolsos | Could | Parcial: solicitud, decisión y devolución de cargos Culqi; corregir flujo manual y coherencia con política publicada. |
| 51 Campana | Could | Parcial: contador y marcar leídas; sin filtro por tipo en la página. |
| 52 Archivos | Could | Parcial: selector y límites en cliente de 20 MB PDF/500 MB video frente a 50 MB del documento; sin escáner de malware ni validación robusta del archivo en servidor. |
| 53 Roles temporales | Could | No encontrada: solo cambio permanente, sin fecha de fin ni reversión automática. |
| 54 Bandeja instructor | Could | Parcial: conversaciones de cursos y filtro por curso; faltan filtros de estudiante/estado. |
| 55 Plantillas de curso | Could | No encontrada. |
| 56 Duplicar curso | Could | Parcial: copia ficha y títulos/orden de módulos; no copia contenidos/evaluaciones/sesiones ni ofrece elegir contenidos. Solo administrador. |
| 57 Publicar después | Could | Parcial sin ejecución: fecha guardada, automatización ausente. |
| 58 Asistencia | Could | Parcial: presente/ausente/tardanza y porcentaje; sin justificación con motivo. |
| 59 Banco de preguntas | Could | No encontrada: preguntas ligadas a evaluación, sin banco, categorías ni importación Excel. |
| 60 Exportar certificados | Could | No encontrada como exportación masiva: hay emisión por lotes y PDF individual; faltan ZIP, Excel y filtros requeridos. |
| 61 Auditoría | Could | Parcial: eventos y búsqueda de últimos 300; sin CSV ni filtro de fecha; cierre de sesión no registra evento propio. |
| 62 Zoom | Could | No encontrada como integración: guardar una URL no crea reuniones por API ni importa asistencia. |
| 63 Notas personales | Could | No encontrada: notas y marcadores vinculados al minuto del video. |
| 64 Push | Could | No encontrada: permiso, suscripción, envío y preferencias. |
| 65 Bienvenida | Could | Base presente: dashboard por rol, cursos, evaluaciones y accesos; revisar todos los criterios con usuarios finales. |

## Requisitos generales y diferencias documentales

- **RF-04:** la inscripción no comprueba prerrequisitos; falta modelar cuáles son y cómo se acredita su cumplimiento.
- **RF-09:** comprobante interno y facturación electrónica no son lo mismo. La migración `20261002120000_pasarela_culqi.sql` declara expresamente que SUNAT está pendiente. Debe implementarse o identificarse como entrega posterior en el documento.
- **RF-11:** los avisos actuales no cubren los recordatorios automáticos.
- **RF-12:** exportación parcial presente; no se encontró flujo de eliminación/anonimización. La página dirige solicitudes al contacto, pero no se revisó un procedimiento externo de atención. Esto es una brecha funcional frente al texto, no una conclusión jurídica de incumplimiento.
- **RNF-01 y RNF-08:** hay diseño adaptable, alto contraste y tamaño de fuente. Falta evidencia de pruebas completas en Chrome/Firefox/Edge/Safari, móviles y teclado.
- **RNF-02:** no se encontró prueba de carga que demuestre menos de 3 segundos y 500 usuarios concurrentes. El catálogo realiza una consulta de cupo por curso, patrón que conviene medir y agrupar.
- **RNF-03:** 99,5% mensual requiere medición operativa. No se puede concluir disponibilidad a partir del código o de tener Sentry.
- **RNF-05:** existen registros de auditoría; el respaldo diario puede estar configurado en el proveedor, pero no fue verificado ni se encontró prueba de restauración. La política pública afirma respaldo diario: debe sustentarse.
- **RNF-06:** arquitectura modular y tipos presentes; portabilidad efectiva a otra nube no comprobada, incluyendo Auth/Storage y tareas de Supabase.
- **RNF-07:** hay API de Supabase y webhook; los tipos incluyen GraphQL, pero eso no demuestra integraciones con Zoom y Calendar, que no aparecen implementadas.
- **Tabla 8, PDF 60 (impresa 57):** menciona 20 requisitos funcionales y 12 no funcionales. El anexo 3, PDF 108–110, contiene RF-01 a RF-12 y RNF-01 a RNF-08: 12 y 8. Deben corregirse las cifras o completarse el anexo.
- **Priorización:** duplicar cursos es HU-56 Could, pero forma parte de RF-03 Alta; SUNAT está dentro de RF-09 aunque HU-12 solo exige comprobante PDF. Conviene definir una sola lista de aceptación del MVP.
- **Conclusiones del documento:** la reducción de tiempos, incremento de matrículas, disponibilidad continua y digitalización completa deben distinguir entre estimación y resultado medido. No hay evidencia en el repositorio que permita validar los beneficios operativos afirmados.
- **Certificados:** HU-11 exige generación automática y firma digital. Actualmente el administrador emite y el PDF dibuja líneas con nombres. El QR verifica el registro; no incorpora una firma digital al archivo. Acordar además qué significa «culminar»: hoy la aptitud usa notas y asistencia a sesiones ya dictadas, no un estado de cierre del curso, y el avance de contenidos es informativo.
- **Política de devolución:** la página de privacidad limita solicitudes a siete días antes del inicio; `solicitarReembolso()` no consulta la fecha de inicio. Alinear política, validación y excepciones administrativas.
- **README:** su lista final de pendientes menciona SUNAT y recordatorios, pero omite otras historias ausentes. Izipay y Niubiz son adaptadores que lanzan «integración pendiente», aunque la tabla inicial los presenta como intercambiables.
- **Capacitación:** el PDF promete manual PDF, video MP4 y formación por roles. No se localizaron esos entregables en el repositorio; podrían existir fuera y deben anexarse como evidencia.

## Orden de trabajo recomendado

1. **Integridad y operación:** corregir acceso a enlaces, cuentas desactivadas, cupos concurrentes, inscripción/pago, devoluciones y progreso; reemplazar datos de cobro de ejemplo.
2. **Cerrar el MVP comprometido:** validar evaluaciones en servidor; completar prerrequisitos, foros, comentarios, recomendaciones y avisos Must, o documentar formalmente su replanificación con la empresa y el asesor.
3. **Procesos del negocio:** cerrar facturación, certificados/firma, política de devoluciones, criterio de ingresos y evidencias de consentimiento. Priorizar lo que la empresa necesita realmente para operar.
4. **Aceptación:** repetir pruebas de BD, ejecutar un recorrido completo por rol y pruebas sandbox de pagos/webhooks, probar recuperación de fallos, carga, accesibilidad y restauración de respaldos.
5. **Documento y entrega:** actualizar la matriz HU/RF/RNF, separar implementado/pendiente/validado, corregir cifras y adjuntar manuales, capacitación y acta de aceptación.

No se asigna un porcentaje global de avance: contar una pantalla como una historia terminada ocultaría criterios pendientes y errores de negocio. Para la sustentación, cada historia debería tener evidencia de sus criterios de aceptación y una decisión explícita sobre lo pendiente.

