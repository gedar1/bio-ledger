# Diseño: Ledger para contadores (MVP)

Estado: **borrador para revisión**. No se implementa nada hasta aprobar este documento.

Producto: aplicación para que un contador gestione a sus clientes y sus gastos, con estado de cuenta, para clientes en Países Bajos. Base técnica: `bio-template` (motor, tenants, sesión por cookie, Jev, células y cadenas declaradas en el perfil).

Fuente de decisiones: `ledger-ocr` (Next.js, Prisma, Postgres). Se toma lo que aplica. Lo que cambia respecto a esa versión se indica en cada sección.

## 1. Alcance del MVP

**Dentro:**
- Gestión de clientes por el contador: invitar, activar, ver estado.
- Gastos manuales del cliente: alta y listado.
- Revisión del contador: aprobar o rechazar un gasto. El rechazo exige una nota. La decisión queda bloqueada.
- Estado de cuenta: gastos aprobados de un cliente en un periodo.
- Interfaz en tres idiomas (nl, es, en).

**Fuera del MVP:**
- Lectura de recibos con visión (OCR). Se define el proveedor después.
- Clasificación automática con Jev. Se evalúa después, con casos etiquetados.
- Exportación CSV. Pertenece al flujo de reportes, después del estado de cuenta.
- PWA y modo sin conexión.
- Correo real. Mientras tanto, la invitación se muestra en pantalla.

**Por qué la revisión entra al MVP:** el estado de cuenta muestra solo gastos aprobados. Sin revisión, el estado de cuenta no tiene datos confiables.

## 2. Roles y tenancy

| Rol | Quién | Puede |
|---|---|---|
| Contador | Dueño del estudio | Ver sus clientes, revisar gastos, ver estados de cuenta |
| Cliente | Empresa del contador | Registrar sus gastos, ver sus gastos y su estado de cuenta |

**Mapeo a `bio-template`:**
- Cada cliente es un **tenant** con su propia base SQLite. El aislamiento entre clientes lo da el motor.
- Hoy `bio-template` no tiene dueño de tenant: no sabe qué contador es dueño de qué cliente. Ese campo (`ownerId`) está pendiente en `DECISIONS-AND-CONFIG.md`, sección 3.4. **Es un requisito previo** para que un contador vea solo sus clientes.
- El despliegue es `DEPLOYMENT_MODE=studio`.

## 3. Modelo de datos

Se pasa de Prisma/Postgres a **moléculas SQLite**, una por entidad, siguiendo `biocore-create-molecule.md`.

| Entidad | Ubicación | Campos clave |
|---|---|---|
| Cliente | Registro de plataforma (tenant) | nombre, estado (`INVITED`, `ACTIVE`), ownerId |
| Categoría | Base del tenant | nombre, tasa BTW (0, 9 o 21), deducible |
| Gasto | Base del tenant | fecha, importe (EUR), concepto, categoría, estado, nota de rechazo, revisadoPor, revisadoEn |

**Estados de un gasto:** `PENDIENTE` → `APROBADO` | `RECHAZADO`. La decisión es final: un gasto decidido no vuelve a cambiar.

**Categorías por defecto** (de `ledger-ocr`, con tasas neerlandesas): Material de oficina, Transporte, Representación, Seguros. Las tasas BTW son 0%, 9% y 21%. El valor deducible se define por categoría. *Confirmar con el contador.*

## 4. Invitación y activación

En `ledger-ocr`, el contador invita a un cliente con un enlace de 48 horas, de un solo uso, con el token guardado como SHA-256.

**Propuesta para `bio-template`:** el mismo enlace de 48 horas y un solo uso. Al activarlo, el cliente recibe su clave de acceso. `bio-template` ya devuelve la API key una sola vez al crear un tenant, así que el mecanismo de la clave encaja. *Decidir:* si el cliente entra con esa clave o si se le pide crear contraseña.

## 5. Estado de cuenta

**Pendiente de definición con el contador.** Propuesta inicial, para confirmar:
- Periodo: mes o trimestre, elegido por el contador.
- Incluye: solo gastos `APROBADO`.
- Muestra: saldo de gastos, total por categoría, total de BTW por tasa, total deducible.
- Moneda: EUR.
- ¿Hay saldo inicial? ¿Hay ingresos o solo gastos? *Confirmar.*

## 6. Interfaz e idiomas

- Librería: `react-i18next`, sobre el dashboard de React + Vite de `bio-template`.
- Catálogos: se reutilizan `messages/es.json`, `nl.json` y `en.json` de `ledger-ocr`, con las mismas claves.
- Idioma por defecto: **nl**. *Confirmar.*
- Idioma por usuario, guardado en su perfil o cookie.

**Gap a resolver:** el dashboard de `bio-template` solo conoce el perfil `domain`. Las secciones del ledger necesitan un registro de secciones por perfil. Se resuelve como primer cambio técnico del proyecto.

## 7. Reglas que no se negocian

- **Nada se aprueba automáticamente.** La lectura automática (futura) solo propone.
- **Aislamiento por cliente.** Ninguna consulta cruza tenants. Se prueba con dos clientes.
- **Errores limpios.** Una integración sin clave devuelve un error controlado, no un fallo del servidor.
- **Sin secretos en el repositorio.** `.env` no se versiona.

## 8. Lo que se toma de `ledger-ocr`

| Qué | Cómo |
|---|---|
| Textos en es, nl, en | Se copian los catálogos JSON |
| Flujos de pantalla | Se recrean en React, como guion |
| Tasas BTW y categorías por defecto | Se trasladan como datos de seed |
| Reglas de revisión (nota obligatoria, bloqueo) | Se reimplementan en la molécula de gastos |
| Prisma, Next.js, next-auth, Serwist | No se toman |
| Lectura con OpenAI, Cloudinary | Fuera del MVP |

Después de tomar lo necesario, `ledger-ocr` se borra con confirmación explícita, según lo acordado.

## 9. Preguntas abiertas

1. ¿El contador entra como usuario de la plataforma o como dueño de un estudio dentro de la plataforma?
2. ¿El cliente entra con la clave de acceso o con contraseña?
3. ¿Qué periodo usa el estado de cuenta, y qué incluye exactamente?
4. ¿Las categorías y su deducibilidad las define el contador o vienen fijas?
5. ¿Idioma por defecto: nl?
6. ¿Hay más de un contador por estudio?

## 10. Próximos pasos

1. Revisión de este documento con el contador.
2. Resolver `ownerId` en `bio-template` como primer cambio del proyecto.
3. Registro de secciones por perfil en el dashboard.
4. Moléculas de clientes y gastos con pruebas de aislamiento.
5. Pantallas: clientes, revisión, estado de cuenta.
