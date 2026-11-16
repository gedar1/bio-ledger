# Diseño: Ledger para contadores (MVP)

Estado: **actualizado con lo implementado.** Los puntos marcados como _por validar_ esperan confirmación del contador.

Producto: aplicación para que un contador gestione a sus clientes y sus gastos, con estado de cuenta, para clientes en Países Bajos.

Base técnica: el motor de `bio-template`, que se copió a `bio-ledger`. **`bio-template` no se modifica.** Todo cambio va en `bio-ledger`.

## 1. Alcance del MVP

**Dentro:**

- Gestión de clientes por el contador: alta con contraseña temporal, restablecimiento, ver sus datos.
- Gastos: el cliente los registra, el contador los revisa, corrige, aprueba, rechaza o anula.
- Estado de cuenta mensual y trimestral, para el cliente y para el contador.
- Chat del producto, dentro del MVP.
- Interfaz en tres idiomas (nl, es, en). Pendiente de implementar.

**Fuera del MVP:**

- Lectura de recibos con visión (OCR). Se define el proveedor después. El gasto ya guarda la referencia al archivo.
- Clasificación automática con Jev.
- Exportación CSV.
- Invitación por enlace de 48 horas y correo real. Por ahora el alta entrega una contraseña temporal en persona.
- PWA y modo sin conexión.
- Panel de plataforma para administrar varios estudios.

## 2. Roles

| Rol                   | Quién                                            | Puede                                                                                                                                                         | No puede                                                               |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Contador (ACCOUNTANT) | Dueño único del estudio                          | Dar de alta y restablecer clientes, crear gastos de sus clientes, corregir, aprobar, rechazar y anular gastos, confirmar deducibilidad, ver estados de cuenta | Ver clientes de otra cuenta                                            |
| Cliente (CLIENT)      | Empresa del contador                             | Registrar sus gastos, editarlos mientras estén pendientes, ver sus gastos y su estado de cuenta, usar el chat                                                 | Aprobar, rechazar o anular gastos; ver otros clientes                  |
| Operador              | Clave `API_SECRET` del despliegue, no un usuario | Solo lectura para diagnóstico: `logs`, `logs/stream`, `platform/metrics`, `platform/alerts`, `circuit-breaker`, `scheduler/activity`                          | Crear o modificar clientes, ejecutar plantillas, tocar datos contables |

**Decisiones de roles:**

- Un estudio tiene un solo contador. No hay rol STAFF.
- No hay rol de plataforma. El operador es solo lectura y su clave es `API_SECRET`.
- El modo es `studio`. Con `studio` el servidor **no arranca sin `API_SECRET`**, salvo que se defina `ALLOW_OPEN_API=true` para desarrollo local.
- El contador puede registrar gastos de sus clientes, por ejemplo facturas que el cliente entrega en papel. Como hay un solo contador, no hay doble revisión: puede aprobar un gasto que él mismo creó. El campo `creado_por` deja ese rastro.

**Cierre de endpoints.** Se rechazan para todos, incluida la clave de operador y también sin `API_SECRET`: escritura de plataforma (`platform/tenants/*`, `platform/auth/login`), `template/execute`, tareas automáticas de escritura (`scheduler/*`, `monitor/add`) y el motor genérico fuera del producto (`settings`, `tenants`, `tools`, `mutations`, `reflex`, `perf`, `websocket`, `tenant-profile`, `templates`, `registry`, `role`, `history`). Responden 404.

## 3. Tenancy y aislamiento

- Cada cliente es un **tenant** con su propia base SQLite en `data/tenants/<tenant>.db`. Sus categorías y gastos viven ahí. Ninguna consulta cruza tenants.
- Cada tenant tiene un `owner_id`, la cuenta del contador. El contador solo accede a tenants cuyo `owner_id` es su cuenta.
- El token del contador lleva `account_id`. El dueño no se toma del cuerpo de la petición.
- Un token de cliente tiene `tenant_id` y solo accede a su propio tenant.
- Un token con contraseña temporal solo sirve para cambiarla. El resto de endpoints responde 403 con un mensaje propio.

## 4. Modelo de datos

**Cliente** (registro de plataforma): `tenant_id` (también es el usuario de acceso), nombre, estado, `owner_id`, `api_key_role` (`operator`), hash de contraseña y marca de cambio obligatorio.

**Categoría** (base del tenant): nombre, deducible (`null` hasta que el contador lo confirme).

**Gasto** (base del tenant):

| Campo                                   | Notas                                                                |
| --------------------------------------- | -------------------------------------------------------------------- |
| fecha                                   | `AAAA-MM-DD`                                                         |
| importe_cents                           | Entero en céntimos, con BTW incluido, como aparece en el recibo      |
| tasa_btw                                | 0, 9 o 21. Va en cada gasto, no en la categoría                      |
| concepto, categoría                     |                                                                      |
| estado                                  | `PENDIENTE`, `APROBADO`, `RECHAZADO` o `ANULADO`                     |
| con_soporte                             | Si hay factura o recibo que lo respalde. Por defecto `false`         |
| nota_rechazo                            | Obligatoria al rechazar                                              |
| nota_anulacion, anulado_por, anulado_en | Obligatorios al anular                                               |
| creado_por                              | `CLIENT` o `ACCOUNTANT`                                              |
| revisado_por, revisado_en               |                                                                      |
| referencia_archivo                      | Ruta o identificador de la foto o imagen. El OCR queda fuera del MVP |

**Reglas de estado:**

- `PENDIENTE` → `APROBADO` o `RECHAZADO`. El rechazo exige nota de al menos 3 caracteres. Una decisión es final.
- `APROBADO` → `ANULADO`. Solo el contador, con nota. Un gasto anulado no suma en el estado de cuenta, pero sigue visible con su motivo. Si hace falta, se registra un gasto nuevo con el dato corregido.
- El cliente edita sus gastos solo mientras están `PENDIENTE`. El contador puede corregir tasa, importe, categoría y soporte mientras estén `PENDIENTE`.

**Categorías por defecto:** Material de oficina, Transporte, Representación y Seguros. La deducibilidad la decide el contador, no el programa. _Por validar con el contador._

## 5. Alta, contraseñas y restablecimiento

- **Alta:** el contador crea al cliente con `tenant_id` y nombre. El sistema genera una contraseña temporal de 12 caracteres y la devuelve una sola vez. El cliente debe cambiarla al entrar.
- **Cambio:** el cliente fija su propia contraseña de al menos 12 caracteres. Mientras la marca de cambio obligatorio esté activa, su token solo sirve para cambiarla.
- **Restablecimiento:** el contador genera otra temporal para su cliente. Otro contador recibe 404.
- **Almacenamiento:** scrypt con sal aleatoria. Nunca en claro.
- **Límite de intentos** en el login del cliente y del contador.
- **Sin correo:** no hay recuperación automática. Si el cliente olvida la contraseña, el contador la restablece.

**Pendiente:** la invitación por enlace de 48 horas, de un solo uso, queda para cuando haya correo. Hoy se entrega la temporal en persona.

## 6. Estado de cuenta

- **Periodos:** mensual (`AAAA-MM`) y trimestral (`AAAA-Tn`).
- **Totales:** solo gastos `APROBADO`. Por categoría y por tasa de BTW. El BTW se separa del total con IVA incluido: `total × tasa / (100 + tasa)`.
- **Deducible:** aprobados, con soporte y de categoría deducible.
- **Sin soporte:** aprobados sin soporte, se muestran aparte y no son deducibles.
- **Anulados:** cantidad e importe, sin sumar en los totales.
- **Pendientes:** cantidad e importe que aún no se han revisado. Así el cliente no toma el total como definitivo.
- **Saldo inicial:** `0` por defecto. _Por validar con el contador._
- **Moneda:** EUR.
- **Vistas:** el cliente ve su estado de cuenta en cualquier momento. No ve la columna de deducible. El contador la ve completa.

## 7. Interfaz e idiomas

- Librería: `react-i18next` sobre el dashboard de React + Vite. **Pendiente.** Hoy el producto funciona por API.
- Catálogos de `ledger-ocr` (`messages/es.json`, `nl.json`, `en.json`), con las mismas claves.
- Idioma por defecto: **nl**. El contador lo cambia por cliente, porque la mayoría de los clientes hablan español o son latinos. _Por validar con el contador._
- Idioma guardado en el registro del cliente.

**Gap a resolver:** el dashboard de la plantilla solo conoce el perfil `domain`. Las pantallas del ledger necesitan un registro de secciones por perfil.

## 8. Reglas que no se negocian

- **Nada se aprueba automáticamente.** La lectura automática (futura) solo propone.
- **Aislamiento por cliente.** Ninguna consulta cruza tenants. Hay pruebas con dos clientes.
- **Un token no abre lo que no le toca.** El contador solo accede a sus clientes. El cliente solo a lo suyo. El operador solo lee diagnóstico.
- **Errores limpios.** Un estado no permitido responde 409 o 422, no un fallo del servidor.
- **Sin secretos en el repositorio.** `.env` y las copias locales de Postman no se versionan.
- **Arranque seguro.** Con `studio` no arranca sin `API_SECRET`.

## 9. Lo que se toma de `ledger-ocr`

| Qué                                            | Cómo                                       |
| ---------------------------------------------- | ------------------------------------------ |
| Textos en es, nl, en                           | Se copian los catálogos JSON. Pendiente    |
| Flujos de pantalla                             | Se recrean en React, como guion. Pendiente |
| Categorías por defecto                         | Se trasladan como datos de seed            |
| Reglas de revisión (nota obligatoria, bloqueo) | Implementadas en la molécula de gastos     |
| Prisma, Next.js, next-auth, Serwist            | No se toman                                |
| Lectura con OpenAI, Cloudinary                 | Fuera del MVP                              |

Antes de borrar `ledger-ocr` hay que confirmarlo explícitamente.

## 10. Preguntas abiertas

Por validar con el contador:

1. Deducibilidad de cada categoría por defecto.
2. Saldo inicial por periodo. Hoy empieza en 0.
3. Idioma por defecto (nl) y si se cambia por cliente.

## 11. Estado de implementación

| Tema                                           | Estado                                                  |
| ---------------------------------------------- | ------------------------------------------------------- |
| Cuenta de contador y login                     | Implementado                                            |
| Alta de cliente con contraseña temporal        | Implementado                                            |
| Login, cambio y restablecimiento de contraseña | Implementado                                            |
| Gastos: alta, edición, decisión, anulación     | Implementado                                            |
| Estado de cuenta                               | Implementado                                            |
| Cierre de endpoints y arranque seguro          | Implementado                                            |
| Colección de Postman                           | Implementado                                            |
| Chat del producto                              | Implementado. Requiere clave válida del proveedor de IA |
| Interfaz (react-i18next y pantallas)           | Pendiente                                               |
| Invitación por enlace y correo                 | Fuera del MVP                                           |
| Cierre ordenado de bases al apagar             | Pendiente                                               |
| Corrección de la clave del proveedor de IA     | Pendiente                                               |
