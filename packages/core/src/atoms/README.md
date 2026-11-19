# Atoms

Funciones puras sin estado ni efectos secundarios. Es la capa más baja de BioCore.

## Qué va aquí y qué no

Una regla decide la ubicación de cada archivo nuevo:

- **Motor (va en `atoms/`)**: el archivo sabe de cadenas, Jev, herramientas, células, formato de LLM o utilidades generales. No conoce gastos, BTW ni estado de cuenta.
- **Dominio contable (en `atoms/` por ahora, pendiente de mover a `domain/ledger/`)**: el archivo sabe de gastos, categorías, BTW, deducible o estado de cuenta. Se marca en la tabla con **[dominio]**.

Aunque un átomo sea de dominio, sigue cumpliendo las reglas de pureza. La ubicación sirve para saber qué puede llevarse al template sin arrastrar código del producto.

## Archivos

| Archivo                  | Funciones y tipos principales                                                   | Descripción                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `cellRouter.ts`          | `preCellRoute`, `CellRouteResult`, `RouterHistoryEntry`                         | Elige el tipo de célula para un mensaje antes del modelo.                                                          |
| `chainExtraction.ts`     | `extractUrl`, `CHAIN_MIN_SIMILARITY`, `PENDING_DISCARDED_WARNING`               | Extrae la URL de un mensaje y define el umbral de similitud de las cadenas.                                        |
| `chainResponse.ts`       | `extractToolText`                                                               | Obtiene el texto de la respuesta de una herramienta para `respond: "tool"`.                                        |
| `chainSpec.ts`           | `EXTRACTORS`, `chainSequence`, `sequenceKey`, `resolveArgs`                     | Extractores de datos de las cadenas y resolución de argumentos `$requires`, `$previous` y `$now`.                  |
| `chatProfiles.ts`        | `sessionKey`, `LEDGER_CLIENT_PROFILE`, `LEDGER_ACCOUNTANT_PROFILE`              | Clave de sesión por tenant y perfil. Las constantes de perfil contable son **[dominio]**.                          |
| `executionGuardrail.ts`  | `checkExecutionSafety`, `isGuardedTool`, `getToolRiskLevel`                     | Intercepta herramientas de alto riesgo antes de ejecutarlas y verifica que coincidan con lo que pidió el usuario (usa Jev).                                                        |
| `expenseRules.ts`        | `BtwRate`, `ExpenseState`, `canDecide`, `canAnnul`, `validateRejectionNote`     | Estados, tasas de BTW y reglas de quién puede cambiar un gasto. **[dominio]**                                      |
| `modelSelection.ts`      | `chooseModel`                                                                   | Selección de modelo LLM. Exportado, sin uso en el chat.                                                            |
| `paths.ts`               | `resolveDataPath`, `getProjectRoot`, `getModuleDir`                             | Rutas relativas a la raíz del proyecto.                                                                            |
| `periodExtraction.ts`    | `extractPeriodo`                                                                | Extrae un mes o trimestre de un texto. Lo usa el extractor `periodo` de las cadenas, así que se queda en el motor. |
| `redundantMutation.ts`   | `filterRedundantMutationTool`, `MUTATION_TOOL`                                  | Quita la herramienta de mutación cuando todas las células permitidas ya están mutadas.                             |
| `reflexSelector.ts`      | `jevEvaluateAll`, `ReflexSelection`, `REFLEX_SELECTION_THRESHOLD`               | Consulta a Jev y aplica el umbral de confianza de 0,7.                                                             |
| `registry.ts`            | `resolveTools`, `resolveAllTools`, `CellTypeDefinition`                         | Resuelve las herramientas declaradas por tipo de célula.                                                           |
| `schema.ts`              | `cleanSchemaForLLM`, `deduplicateTools`                                         | Limpieza de esquemas JSON para el LLM.                                                                             |
| `sequence.ts`            | `normalizeSequence`                                                             | Convierte una secuencia de pasos en un texto canónico, para identificarla y deduplicarla.                                                                           |
| `sqlSafety.ts`           | `checkReadOnlySql`, `isSqlIdentifier`                                           | Verifica que una consulta SQL sea de solo lectura.                                                                 |
| `startupGuard.ts`        | `openApiProblem`                                                                | Valida la configuración al arrancar en modo studio.                                                                |
| `statement.ts`           | `parsePeriod`, `splitBtw`, `buildStatement`, `categoryTotals`, `largestExpense` | Estado de cuenta, desglose por categoría y gasto más caro. **[dominio]**                                           |
| `toolFormat.ts`          | `formatToolsForAnthropic`, `formatToolsForOpenAI`, `formatToolsForGemini`       | Formato de herramientas por proveedor de LLM.                                                                      |
| `toolResultFormatter.ts` | `summarizeToolResult`                                                           | Convierte respuestas crudas de herramientas (HTML, JSON largo) en texto legible para el chat o el dashboard.                                                          |
| `index.ts`               | barrel export                                                                   | Reexporta los átomos desde un solo punto.                                                                          |

## Reglas

- Sin `this`, sin clases y sin estado mutable.
- Sin imports de otras capas de BioCore. Solo se permiten tipos y otros átomos.
- Sin efectos secundarios: nada de logs, I/O, red ni base de datos.
- Fáciles de probar: entrada → salida. Las pruebas van en `tests/atoms/`.
- Si un átomo nuevo es de dominio contable, márcalo como **[dominio]** en esta tabla.

## Pendiente

- Mover `statement.ts` y `expenseRules.ts` a `domain/ledger/`, cuando decidamos llevar el motor al template.
- Separar de `chatProfiles.ts` las constantes contables, si se confirma la separación.
- Agrupar por tema (`atoms/chain/`) solo si la carpeta sigue creciendo.
