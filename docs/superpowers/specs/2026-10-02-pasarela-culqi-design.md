# Pasarela de pagos Culqi y comprobante de pago — diseño

- **Fecha:** 2026-10-02
- **HU / RF:** HU-12 (pagos en línea), HU-30 (historial y comprobantes en PDF), HU-50 (reembolso por la pasarela), RF-09
- **Estado:** aprobado en conversación; pendiente de revisión escrita

## 1. Objetivo y criterios de éxito

El documento del proyecto (Tabla 6, Tabla 10, sección 4.5) describe un pago en línea con tarjeta, Yape y Plin
que se verifica sin intervención manual. Hoy el sistema solo acepta Yape / Plin directo validado por el
administrador. Este trabajo integra **Culqi** para que eso sea cierto.

Se considera terminado cuando:

1. En staging, un estudiante paga con una tarjeta de prueba o con el Yape de prueba y su inscripción pasa a
   CONFIRMADA sin intervención del administrador.
2. Un pago con billetera (Plin u otra) se confirma por webhook, verificando la orden contra la API de Culqi.
3. Todo pago aprobado (Culqi o manual) tiene un comprobante interno en PDF descargable desde «Pagos».
4. Aprobar un reembolso de un cargo de Culqi ejecuta la devolución en Culqi.
5. Las pruebas unitarias y de BD pasan con cobertura ≥ 70 % (Definición de Terminado).

Restricción: aún no hay cuenta de Culqi. Todo se implementa y prueba con Culqi simulado; la prueba real se hace
cuando el usuario configure las llaves de integración (sección 9).

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Medios por Culqi | Tarjeta y Yape (token → cargo, síncrono) y billeteras / banca móvil / agente (orden → webhook). |
| Momento del pago | Inscribir primero (reserva de 48 h, cupo validado por trigger) y pagar después. |
| Pago manual | Se conserva como contingencia (Tabla 12). Se apaga con `PAGO_MANUAL_HABILITADO=false`. |
| Comprobante | Interno en PDF, serie `CP01`, con la nota «no reemplaza la boleta o factura electrónica SUNAT». SUNAT queda como trabajo futuro (HU-31). Sin QR. |
| Rechazo de tarjeta | No cancela la inscripción: se puede reintentar mientras la reserva esté vigente. |
| Webhook | No se confía en el contenido: se exige una clave secreta en la URL y se consulta la orden o el cargo en la API. |

Fuera de alcance: facturación electrónica SUNAT, cifrado RSA del checkout (`xculqirsaid`), cuotas sin intereses
(Cuotéalo), pagos recurrentes, Izipay y Niubiz (siguen como adaptadores sin implementar).

## 3. Flujo

```
Estudiante                    Next.js (servidor)                         Culqi
    │ inscribirse (CULQI)  ──►  inscripción PENDIENTE + pago PENDIENTE
    │ ◄── redirect /estudiante/pagos?pagar=<código>
    │ «Pagar en línea»     ──►  prepararPagoEnLinea(pagoId)
    │                             valida reserva vigente ─────────────►  POST /v2/orders (vence = reserva)
    │ ◄── { llavePublica, monto, ordenId, correo, nombres }
    │ Checkout Custom (js.culqi.com/checkout-js)
    ├─ tarjeta / Yape → token ──► cobrarConToken(pagoId, token, huella) ─►  POST /v2/charges
    │                             200 venta_exitosa → confirmarPago()
    │                             201 → { requiere3DS }
    │  Culqi3DS.initAuthentication(token) → parameters3DS
    │                      ──►  cobrarConToken(..., autenticacion3DS) ──►  POST /v2/charges
    │                             rechazo → pago sigue PENDIENTE + observacion
    └─ billetera / agente → paga la orden en su app
                                POST /api/pagos/webhook/culqi?clave=… ◄──  order.status.changed
                                verifica clave → GET /v2/orders/{id} ───►
                                estado «paid» y monto correcto → confirmarPago()
    │ consulta el estado cada 5 s mientras espera la billetera
```

`confirmarPago(pagoId, datos)` es el único punto de confirmación (lo usan el cargo, el webhook y la validación
manual del administrador `resolverPago`). Es idempotente:

1. Si el pago ya está APROBADO, no hace nada.
2. Actualiza el pago: `estado = APROBADO`, `fecha_pago`, `referencia_pasarela`, `medio`, `respuesta_pasarela`.
   El trigger de la BD emite el comprobante (sección 4).
3. Pone la inscripción en CONFIRMADA y `vence_en = null`.
   - Si la inscripción ya estaba CANCELADA (reserva vencida) y aún hay cupo, la reactiva.
   - Si no hay cupo, o si el estudiante ya tiene otra inscripción activa en ese curso, deja el pago APROBADO,
     no confirma la inscripción y notifica a los administradores para reembolsar.
4. Notifica al estudiante (campana) y programa el correo de confirmación con el enlace al comprobante.
5. Registra la actividad `PAGO_APROBADO` en la auditoría.

## 4. Datos (migración `pasarela_culqi`)

**`pagos`**

- `metodo = 'CULQI'` identifica los pagos en línea; `YAPE` / `PLIN` quedan solo para el pago manual.
- Columnas nuevas:
  - `medio text` con check en (`TARJETA`, `YAPE`, `BILLETERA`, `BANCA_MOVIL`, `AGENTE`), null en pagos manuales.
  - `orden_pasarela text`, el `ord_…` de Culqi.
  - `datos_facturacion jsonb`: `{ tipo: 'BOLETA'|'FACTURA', ruc?, razon_social? }`, tomado del formulario de
    inscripción (hoy solo queda en la auditoría).
- Índices únicos parciales en `referencia_pasarela` y `orden_pasarela` (where not null).
- El motivo de un rechazo de tarjeta se guarda en `observacion`, que el estudiante ya ve.

**`comprobantes`**

- Columnas nuevas, congeladas al emitir:
  - `cliente_nombre`, `cliente_documento`, `ruc`, `razon_social`.
  - `concepto` (título del curso).
  - `subtotal`, `descuento`, `total`.
  - `metodo`, `medio`, `referencia_pasarela`.
- `serie = 'CP01'` y `numero` = `lpad(nextval('comprobante_numero_seq'), 6, '0')`.
- `tipo` guarda lo que el cliente pidió (boleta o factura); `enviado_sunat` sigue en `false`; `pdf_url` no se usa.

**Trigger `privado.emitir_comprobante()`**

- `after update of estado on pagos`, cuando el estado pasa a APROBADO.
- Inserta el comprobante con `on conflict (pago_id) do nothing`.
- Corre como `security definer` en el esquema `privado`, siguiendo el patrón de las funciones de RLS.
- La migración emite también los comprobantes de los pagos que ya están APROBADO.

La política `comprobantes_ver` existente se revisa para que el estudiante vea solo los suyos y el administrador
todos.

## 5. Código

**Adaptador (`src/lib/pagos`)**

`PasarelaPago` pasa a:

- `crearOrden({ pagoId, montoSoles, descripcion, cliente, venceEn })` → `{ id }`.
- `cobrar({ pagoId, montoSoles, descripcion, correo, token, huellaDispositivo?, autenticacion3DS? })`
  → `{ estado: 'APROBADO' | 'RECHAZADO' | 'REQUIERE_3DS', referencia, medio, mensaje, respuesta }`.
- `consultar({ tipo: 'orden' | 'cargo', id })`
  → `{ estado: 'PAGADO' | 'PENDIENTE' | 'RECHAZADO' | 'EXPIRADO', pagoId, montoCentimos, medio, referencia, respuesta }`.
  El `pagoId` se lee de la `metadata` que se envía al crear la orden o el cargo.
- `reembolsar(referencia, montoSoles, motivo)`, sin cambios.
- `leerWebhook(cuerpo)` → `{ tipo, id } | null`. Solo extrae qué consultar; no decide el estado.

Reglas comunes:

- Todas las llamadas a Culqi tienen un límite de 15 s (`AbortSignal.timeout`).
- Los campos exactos de órdenes y cargos (`expiration_date`, `client_details`, `antifraud_details`,
  `authentication_3DS`, estados de la orden) se comprueban con apidocs.culqi.com al implementar.
- Izipay y Niubiz implementan la interfaz lanzando «no implementado».

**Acciones de servidor (`src/features/matricula/pago-en-linea.ts`)**

- `prepararPagoEnLinea(pagoId)`:
  - Lo usa el estudiante dueño del pago.
  - Valida que el pago esté PENDIENTE con `metodo = CULQI` y que la reserva esté vigente.
  - Reutiliza la orden si ya existe y está pendiente; si no, la crea.
  - Devuelve los datos del checkout.
- `cobrarConToken(pagoId, token, huella?, autenticacion3DS?)`:
  - Hace las mismas validaciones y luego cobra.
  - Si se aprueba, llama a `confirmarPago`.
  - Si se rechaza, guarda el motivo.
  - Devuelve el resultado al navegador.
- `estadoDelPago(pagoId)`: lo consulta el navegador mientras espera la billetera.

**`confirmarPago` (`src/features/matricula/confirmar-pago.ts`)**

Usa el cliente admin. `resolverPago` del administrador se refactoriza para llamarla.

**Webhook (`/api/pagos/webhook/[proveedor]`)**

1. Compara `?clave=` con `CULQI_WEBHOOK_SECRET` usando `timingSafeEqual`; si no coincide, responde 401.
2. `leerWebhook` extrae qué consultar; si el evento no interesa, responde 200.
3. `consultar` pide el estado a la API de Culqi; si falla, responde 500 para que Culqi reintente.
4. Si el estado es PAGADO y el monto coincide con `pagos.monto`, llama a `confirmarPago`.
5. Responde 200.

Se elimina la cancelación de la inscripción ante `charge.failed`.

**Reembolsos**

`resolverReembolso` (admin), al aprobar un reembolso cuyo pago tiene `metodo = CULQI` y un cargo:

1. Llama a `reembolsar`.
2. Si sale bien: reembolso PROCESADO, pago REEMBOLSADO, inscripción CANCELADA.
3. Si falla: el reembolso queda APROBADO y se muestra el error al administrador.

Los pagos manuales siguen marcándose a mano.

**Configuración**

- `.env.example` y `env.server.ts`: se agrega `PAGO_MANUAL_HABILITADO` (por defecto `true`).
- `pasarelaActiva()` es verdadera si existen `NEXT_PUBLIC_CULQI_PUBLIC_KEY` y `CULQI_SECRET_KEY`.
  Sin llaves, la opción en línea aparece como «Próximamente».

## 6. Pantallas

**Inscripción (`formulario-inscripcion.tsx`)**

- Opciones de pago:
  - «En línea: tarjeta, Yape, Plin y otras billeteras (Culqi)», elegida por defecto.
  - «Yape / Plin directo (validación manual)».
- Al confirmar, redirige a `/estudiante/pagos?pagar=<código>`.

**Pagos del estudiante**

- Componente cliente `PagoEnLinea` para cada pago CULQI pendiente:
  - Muestra el resumen y el botón «Pagar en línea», que se abre solo si llega `?pagar`.
  - Carga los scripts de Culqi con `next/script` solo en esta pantalla.
- Estados: preparando → checkout → procesando → verificación del banco (3DS) → esperando billetera → aprobado
  (enlace al comprobante) / rechazado (motivo y reintento).
- Los pagos aprobados muestran «Comprobante CP01-000123» con enlace al PDF.

**Comprobante PDF (`/comprobantes/[id]/pdf`)**

- Se genera con pdf-lib y `src/lib/pdf/comun.ts`.
- Lo lee el usuario con su sesión: RLS garantiza que solo lo abran el dueño y el administrador.
- Contenido:
  - Datos de PEDSAR (`config/empresa.ts`) y del cliente.
  - Concepto, subtotal, descuento y total.
  - Método y medio de pago, y la referencia de Culqi.
  - Fecha de emisión y número.
  - La nota de que no es un comprobante SUNAT.

**Administrador**

- «Inscripciones y pagos»: medio («Culqi · Tarjeta»), referencia y enlace al comprobante.
- Reportes RF-10: los ingresos se agrupan por método y medio.

**Sitio público**

Los textos que mencionan el pago con tarjeta se muestran solo si `pasarelaActiva()`.

## 7. Errores

| Situación | Comportamiento |
|---|---|
| Culqi no responde (15 s) | «No pudimos conectar con la pasarela». Si el pago manual está habilitado, se ofrece. |
| Tarjeta rechazada | Mensaje de Culqi (`user_message`); el pago sigue PENDIENTE y se puede reintentar. |
| Reserva vencida al pagar | Se bloquea antes de cobrar. La orden vence a la misma hora que la reserva. |
| Webhook con clave incorrecta | 401. |
| Webhook de algo que no está pagado o con otro monto | 200 y no se confirma nada; queda en la auditoría. |
| Webhook o cargo repetido | Sin efecto (índices únicos y `confirmarPago` idempotente). |
| Pago aprobado sin cupo (carrera muy rara) | Pago APROBADO, inscripción sin confirmar y aviso al administrador para reembolsar. |

## 8. Pruebas

**Unitarias (Vitest, `fetch` de Culqi simulado)**

- Adaptador:
  - Crear orden y cargo aprobado.
  - Rechazo.
  - Respuesta 201 (3DS).
  - Consulta de orden pagada, pendiente y expirada.
  - Reembolso.
  - Límite de tiempo.
- Acciones:
  - Preparar el pago (reutiliza la orden, reserva vencida, pago ajeno).
  - Cobrar con token (aprobado, rechazado, 3DS).
- `confirmarPago`: idempotencia, reactivación y caso sin cupo.
- Webhook: clave, verificación, aviso falso, monto distinto e idempotencia.
- `resolverReembolso` con Culqi.
- Texto del PDF del comprobante.

**BD (pgTAP)**

- El trigger emite un solo comprobante por pago.
- La numeración es correlativa.
- Los datos quedan congelados.
- RLS de comprobantes por rol.
- Índices únicos de referencia y orden.

Cobertura ≥ 70 % (umbral de `vitest.config.mts`).

## 9. Prueba real (cuando haya llaves)

1. CulqiPanel → entorno de integración → copiar `pk_test_…` y `sk_test_…` a `.env.local` y a Vercel (Preview).
2. CulqiPanel → Eventos → Webhooks → `order.status.changed` y `charge.creation.succeeded` hacia
   `https://<staging>/api/pagos/webhook/culqi?clave=<CULQI_WEBHOOK_SECRET>`.
3. Casos de prueba:
   - Visa `4111 1111 1111 1111` (09/30, 123): aprobado.
   - Visa 3DS `4456 5300 0000 1096` (07/30, 111): pide el reto.
   - Yape `900 000 001` con cualquier código de 6 dígitos.
   - Una billetera mediante orden: se confirma por webhook.
