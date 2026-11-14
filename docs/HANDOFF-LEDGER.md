# Traspaso: ledger para contadores

Documento para retomar el trabajo en otra sesión o workspace. Resume lo decidido, el estado actual y lo que falta. Léelo antes de tocar código.

## Qué es el proyecto

Aplicación para que un contador gestione a sus clientes, sus gastos y sus estados de cuenta. Cliente final en Países Bajos. MVP con interfaz en nl, es y en.

Base técnica: `bio-template` (motor de automatización multi-tenant). Es la **fuente de verdad** del motor: lo que venga de `ledger-ocr` o de otro proyecto entra aquí como código nuevo, con pruebas.

## Repositorios y ramas

| Repositorio       | Ruta local                                         | Estado                                                                                                                                           |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bio-template`    | `project-agent/bio-template`                       | `main` en `v1.0.0`. Motor base. Ramas `feature` → `develop` → `pre-prod` → `main`.                                                               |
| `bio-ledger`      | `project-agent/bio-ledger`                         | Clon de `bio-template`. Rama `feature/ledger-diseno` con el documento de diseño. **Push bloqueado** hasta crear el repositorio propio en GitHub. |
| `ledger-ocr`      | `project-agent/ledger-ocr`                         | Proyecto Next.js de referencia. 48 cambios sin commitear. **No se borra** hasta confirmar que lo útil está migrado.                              |
| `bio-auto-ledger` | `project-agent/repo-auto-bio-core/bio-auto-ledger` | Fork antiguo de `bio-template` con dominio de ledger y dashboard sin commitear. Referencia de textos y de la capa de dominio.                    |

Para subir `bio-ledger`: crear el repositorio en GitHub, luego `git remote set-url --push origin <url-nueva>` y `git push -u origin feature/ledger-diseno`. Los PR siguen el flujo `feature → develop → pre-prod → main`.

## Decisiones tomadas (de `ledger-ocr` y de la sesión)

- **Roles:** contador (ACCOUNTANT) y cliente (CLIENT).
- **Cada cliente es un tenant** con su propia base SQLite. Modo `DEPLOYMENT_MODE=studio`.
- **Invitación:** enlace de 48 horas, un solo uso, token guardado como SHA-256.
- **Gastos:** EUR. Estados `PENDIENTE` → `APROBADO` | `RECHAZADO`. Rechazo exige nota. La decisión queda bloqueada.
- **Tasas BTW:** 0%, 9% y 21%. Categorías por defecto: Material de oficina, Transporte, Representación, Seguros.
- **Estado de cuenta:** solo gastos `APROBADO`. Definición exacta pendiente con el contador.
- **i18n:** `react-i18next` sobre el dashboard React + Vite de `bio-template`. Catálogos `messages/{nl,es,en}.json` de `ledger-ocr`. Idioma por defecto propuesto: nl.
- **Fuera del MVP:** OCR con visión, clasificación con Jev, exportación CSV, PWA, correo real.
- **Revisión entra al MVP** porque el estado de cuenta depende de gastos aprobados.
- **Persistencia:** moléculas SQLite por tenant. Prisma, Postgres, Next.js, next-auth y Serwist no se toman.

## Documento de dominio base

`docs/LEDGER_OCR_DOMAIN.md` (sin commitear en `bio-ledger`) es el punto de partida del dominio. Viene de `ledger-ocr` y describe la plataforma de gestión de comprobantes con OCR y revisión asistida. Antes de usarlo como base, hay que resolver estas diferencias con `DISENO-LEDGER.md` y este traspaso:

- **OCR y revisión asistida por IA.** El documento de dominio los incluye como parte del producto. Este traspaso los deja fuera del MVP.
- **Actores.** El dominio define Cliente, Contador y Administrador. El traspaso define ACCOUNTANT y CLIENT. Falta decidir si el Administrador es un rol aparte o es el contador como dueño del estudio (pregunta 1 de abajo).
- **Unidad de datos.** El dominio habla de comprobantes (`ReceiptMolecule`). El traspaso habla de gastos con estados `PENDIENTE`, `APROBADO` y `RECHAZADO`.
- **Fecha de verificación.** El dominio indica "MVP Verificado, 2024-10-19", pero no lo confirmé. Tomarlo como referencia histórica.

## Documento de diseño

`docs/DISENO-LEDGER.md` en `bio-ledger`, rama `feature/ledger-diseno`. Estado: **borrador para revisión**. No se implementa nada hasta aprobarlo.

## Bloqueos antes de implementar

1. **`ownerId` en el motor (copia en `bio-ledger`).** El motor no sabe qué contador es dueño de qué cliente. Está pendiente en `DECISIONS-AND-CONFIG.md`, sección 3.4. Es requisito para que un contador vea solo sus clientes.
2. **Registro de secciones del dashboard por perfil.** Hoy solo existe el perfil `domain`. Las pantallas del ledger necesitan registrarse por perfil.
3. **Respuestas del contador** a las preguntas abiertas (ver abajo).

## Preguntas abiertas para el contador

1. ¿El contador entra como usuario de la plataforma o como dueño de un estudio dentro de ella?
2. ¿El cliente entra con la clave de acceso o con contraseña?
3. ¿Qué periodo usa el estado de cuenta, y qué incluye exactamente (saldo inicial, ingresos, totales por categoría y por tasa BTW)?
4. ¿Las categorías y su deducibilidad las define el contador o vienen fijas?
5. ¿Idioma por defecto: nl?
6. ¿Hay más de un contador por estudio?

## Próximos pasos

1. Revisión del documento de diseño con el contador, con las preguntas de arriba.
2. Resolver `ownerId` en `bio-ledger` como primer cambio técnico, en su propio PR. `bio-template` no se modifica en este proyecto. Ver `DECISIONS-AND-CONFIG.md`, sección 3.4.
3. Registro de secciones por perfil en el dashboard.
4. Moléculas de clientes y gastos con pruebas de aislamiento entre tenants.
5. Pantallas en este orden: clientes, revisión, estado de cuenta.

## Reglas de trabajo acordadas

- Explicar antes de editar. Diseño antes de código, sobre todo en cambios de varios archivos.
- Paso a paso, sin reprocesos ni eliminar lo que sirve.
- Las eliminaciones y los push a ramas compartidas se confirman antes.
- `bio-template` manda: cualquier pieza tomada de otro proyecto se reescribe aquí y se prueba.
- Antes de borrar `ledger-ocr` o `bio-auto-ledger`, copia de respaldo o rama en origen, y confirmación explícita.
- Validaciones antes de cada entrega: `tsc` en core y dashboard, `validate-template`, tests de core, y prueba en vivo con base temporal.
- Ramas: `feature/*` → PR a `develop` → PR a `pre-prod` → PR a `main`. Tag en `main` por cada despliegue (`vMAYOR.MENOR.PARCHE`).

## Steering y guías relevantes en `bio-template`

- `.kiro/steering/vertical-playbook.md`: proceso para construir una vertical. Úsalo como guía de este proyecto.
- `biocore-create-cell.md`, `biocore-create-molecule.md`, `biocore-create-profile.md`, `biocore-create-atom.md`: cómo agregar piezas al motor.
- `biocore-boundaries.md`: límites entre capas y estándares de código.
- `biocore-jev-pre-routing.md` y `biocore-execution-flow.md`: cómo se ejecuta un mensaje.

## Estado técnico del motor (`bio-template` v1.0.0)

- Cadenas declaradas en `domain-profile.ts`, sin LLM para flujos fijos.
- `db_query` solo lectura, validada con `atoms/sqlSafety.ts`.
- Sesión del tenant por cookie `httpOnly`. Rol mínimo por endpoint en `requestAccess.ts`.
- Respaldo entre proveedores LLM y circuit breakers visibles en el dashboard.
- Tests de core: 45 de 45 pasan en `bio-ledger` (pnpm, `vitest --run --config packages/core/vitest.config.ts`). `DECISIONS-AND-CONFIG.md`, sección 7, dice 88. Ese número no coincide con esta copia, así que no usarlo como referencia.
- Flake conocido: `ExampleMolecule.spec.ts` puede fallar con "Hook timed out in 10000ms" en `afterEach` y reportar 44 de 45. Ver la memoria `examplemolecule-spec-afterEach-timeout-flake`.
- Pendientes conocidos del motor: `ownerId`, registro de secciones por perfil, y `ReflexMolecule.runMigration()`.
  - `ReflexMolecule.runMigration()` (que hacía `DROP TABLE` de `reflex_dependencies` y `reflexes_atomic` en cada arranque) quedó retirado en `bio-ledger`. No había bases de datos locales que revisar. Las instalaciones que ya tengan esas tablas las conservan sin uso. Pendiente: `packages/core/scripts/validate-tools.ts` todavía consulta `reflexes_atomic` y `reflex_dependencies`, así que hay que revisarlo.
  - Pendiente, fuera de este cambio: `platformSchema.ts` ejecuta `DROP TABLE platform_tenants` en algún caso. Revisar la condición antes de desplegar con datos reales.

## Pendientes fuera de este proyecto

- Sonar S9382 en `GmailMolecule.ts`: envío secuencial intencional, sin cambios por ahora.
- `GmailMolecule` usa `console` y `new Error` genérico: pendiente alinearlo con los estándares.
