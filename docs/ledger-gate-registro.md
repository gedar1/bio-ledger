---
inclusion: manual
---

# Registrar un gate de cadena en bio-ledger

Esta guía complementa `biocore-jev-pre-routing.md`. Ese documento explica el flujo del motor. Esta describe, paso a paso, cómo registrar un gate nuevo para una pregunta del producto contable, y cómo comprobar que funciona.

## Qué es un gate

Un gate es una **cadena declarada en el perfil** (`chains` en `config/ledgerProfiles.ts`). Cuando Jev propone una secuencia de herramientas que coincide con una cadena, con similitud ≥ 0.7, y la cadena puede llenar sus datos desde el mensaje, el programa ejecuta los pasos sin llamar al modelo. Si no se cumple cualquiera de estas condiciones, la pregunta va al modelo.

Lo que decide es el registro en el perfil, no `domain-tools.json`. `domain-tools.json` solo define qué puede proponer Jev.

Si varias cadenas comparten la secuencia de herramientas, el gate toma la primera cuya guarda (`avoidTerms`) no aparece en el mensaje. Así una pregunta con filtro, como "aprobados", no se queda en la lista completa: la cadena sin filtro queda bloqueada y la de filtro la responde.

## Antes de escribir código: el checklist de la pregunta

Antes de tocar archivos, responde estas preguntas sobre la pregunta que quieres resolver sin modelo:

1. **¿La respuesta sale siempre de los mismos pasos?** Una lista, un total o un estado sí. Una explicación no.
2. **¿Existe una herramienta que haga el trabajo en un solo paso?** Si necesitas dos herramientas, Jev tiende a proponer la secuencia de dos pasos, y el gate no la reconoce a menos que declares exactamente esa secuencia.
3. **¿Qué datos necesita la herramienta y de dónde salen?** Si no hay datos, la cadena es más simple. Si hay datos, cada uno debe salir de un extractor.
4. **¿Hay un solo dato variable?** `requires` admite como máximo uno. Dos datos variables (por ejemplo periodo y estado) no caben en una cadena: esa pregunta va al modelo.
5. **¿La respuesta se puede dar con el texto de la herramienta?** Si sí, usa `respond: "tool"`. Si la respuesta necesita redactarse, no es candidata.

Si alguna respuesta es "no", la pregunta se queda en el modelo. Anótalo y sigue con la siguiente.

## Paso 1: la herramienta

Las células del producto están en `cells/ledgerCells.ts`. Sus registros se agregan al array `registrations` de `config/applicationComposition.ts`.

El handler solo valida la entrada, pide datos a la molécula o a los átomos, y devuelve el resultado. El formato del texto va en `atoms/ledgerText.ts` y las vistas en `atoms/ledgerViews.ts`.

1. Registra la herramienta en la célula correspondiente con `server.registerTool(nombre, { description, inputSchema }, handler)`.
2. Usa esquemas con tipos concretos: `z.enum`, `z.string()` y `z.number()`. **No uses `pattern`, `z.any()` ni `z.record(z.any())`**: el proveedor del modelo los rechaza. Valida el formato dentro del handler.
3. El handler devuelve `{ content: [{ type: "text", text }] }`. Da formato al texto con código: importes, fechas y totales en el código, no en el modelo.
4. Añade el nombre de la herramienta a `tools` de su célula en `config/domain-registry.json`.
5. Añade la descripción en `config/domain-tools.json`. **Jev elige por esa descripción**, y el LLM también la lee en cada turno. Sigue la regla de la sección siguiente.

### Cómo redactar la descripción

La descripción tiene que cubrir tres cosas, en pocas frases:

- **Qué devuelve**, con su forma: lista de gastos, total por mes, estado de cuenta de un periodo.
- **Cuándo usarla**, en términos de la petición (qué pide el usuario), no de una frase concreta.
- **Cuándo no**, nombrando la herramienta que sí corresponde.

Las referencias van en los dos sentidos. Si `A` dice "para totales usa `B`", `B` no puede decir lo contrario. Cada herramienta tiene un solo trabajo.

Ejemplo, las tres herramientas del cliente que se pueden confundir:

- `list_my_expenses`: lista los gastos de todo el historial, una línea por gasto. Filtra por estado si lo piden. No filtra por periodo ni da totales: para totales usa `get_my_statement` o `get_my_monthly_totals`.
- `get_my_statement`: total y estado de cuenta de un mes o trimestre concreto (AAAA-MM o AAAA-Tn). No sirve para un año completo ni para una lista de gastos.
- `get_my_monthly_totals`: total de cada mes del año en curso, en tabla. No devuelve gastos individuales: para la lista usa `list_my_expenses`.

No redactes la descripción para una frase concreta. Si una descripción solo funciona para "cuáles son mis gastos de este año", es probable que se pise con otra herramienta para la siguiente pregunta.

**Herramienta o cadena.** Una cadena es para una petición que se traduce a argumentos fijos, por ejemplo un periodo que el extractor obtiene del texto, y cuya respuesta siempre tiene el mismo formato. Una herramienta es para lo que necesita que el LLM elija o combine. Jev elige entre las mismas descripciones que el LLM, así que una cadena no corrige una descripción ambigua.

**Validación.** Antes de dar una descripción por buena, prueba una batería de 6 a 8 formulaciones por herramienta, incluidos los casos límite (año, mes, estado, categorías). Anota qué herramienta elige Jev y con qué confianza. Si ninguna herramienta encaja, Jev debe quedar por debajo de `REFLEX_SELECTION_THRESHOLD` (0,7) y la pregunta debe ir al LLM.

**Longitud.** Dos o tres frases. La descripción viaja en cada turno del LLM y cuesta tokens.

## Paso 2: los datos (solo si la cadena los necesita)

Si la cadena necesita un dato del mensaje, el dato lo extrae un **extractor del motor**.

Extractores actuales (`config/chainSchema.ts`, `EXTRACTOR_NAMES`):

- `url`: una URL del texto.
- `text`: el texto completo.
- `periodo`: un mes o trimestre (`atoms/periodExtraction.ts`).
- `estado`: aprobado, pendiente, rechazado o anulado, en nl, es y en (`atoms/estadoExtraction.ts`). Devuelve `null` si no hay estado o si hay más de uno.

Para agregar un extractor nuevo:

1. Escribe la lógica como función pura en `atoms/`, con pruebas en `tests/atoms/`.
2. Añade su nombre a `EXTRACTOR_NAMES` en `config/chainSchema.ts`.
3. Regístralo en `EXTRACTORS` de `atoms/chainSpec.ts`.

Reglas del extractor:

- Devuelve `null` cuando no hay dato **o cuando el dato es ambiguo**. Con `null`, la cadena pide el dato con su `ask`.
- No adivines. Si el mensaje trae dos valores posibles, devuelve `null`.
- Un error de escritura cercano a un valor válido debe tratarse como ambiguo. Así pasó con "abri" junto a "marzo".

## Paso 3: declarar la cadena en el perfil

En `config/ledgerProfiles.ts`, dentro de `chains` del perfil que corresponda (`ledgerClientProfile` o `ledgerAccountantProfile`):

```ts
{
  id: "estado-de-cuenta",                    // único dentro del perfil
  description: "Estado de cuenta del cliente para un mes o trimestre",
  requires: [                                 // como máximo un dato
    { name: "periodo", extractor: "periodo", ask: "¿De qué mes o trimestre quieres el estado de cuenta?" },
  ],
  setup: [],                                  // SQL de infraestructura; casi nunca se usa
  steps: [                                    // en orden; un paso por herramienta
    { cell: LEDGER_CLIENT_CELL, tool: "get_my_statement", args: { periodo: "$requires.periodo" } },
  ],
  respond: "tool",                            // la respuesta es el texto de la herramienta
  done: "Este es tu estado de cuenta.",       // respaldo si la herramienta no devuelve texto
}
```

Reglas de cada campo:

- **`id`**: minúsculas, números y guion. Sin repetir dentro del perfil.
- **`requires`**: `name` en minúsculas y guion bajo; `extractor` debe existir en `EXTRACTOR_NAMES`.
- **`steps[].cell`**: debe estar en `allowedCells` del perfil. Si no, el perfil no arranca.
- **`args`**: valores literales, o `$requires.<nombre>`, `$previous` o `$now`. El nombre después de `$requires.` debe coincidir con `requires[].name`.
- **`respond`**: `"tool"` usa el texto de la última herramienta. Si no hay texto, se usa `done`.
- **`avoidTerms`** (opcional): términos que anulan la cadena. Si el mensaje los menciona, la cadena no se ejecuta y la pregunta sigue con otra cadena o con el modelo. Úsalo en la cadena sin filtro, para que no responda la lista completa cuando la pregunta pide un estado.

### Errores que no se ven hasta que pruebas

- **Secuencia repetida.** Dos cadenas con la misma secuencia de herramientas colisionan. La cadena se busca por los **nombres de herramienta**, no por los argumentos. Si necesitas dos respuestas distintas con la misma herramienta, usa un extractor, no dos cadenas.
- **Secuencia de dos pasos.** Si Jev propone `herramienta A → herramienta B`, tu cadena de un paso no coincide. Revisa el log `executionChain` antes de culpar al extractor.
- **Dato requerido sin extractor.** `requires` con un extractor que no existe impide que el perfil arranque.
- **Pregunta con filtro que va al LLM.** Si Jev propone la herramienta con confianza por debajo de 0,7, ninguna cadena se ejecuta. Revisa la descripción de la herramienta en `domain-tools.json`: debe nombrar el filtro, como lo hicimos con "estado" en `list_my_expenses`. Mide la confianza con `LOG_LEVEL=debug` (línea `Jev primer paso`).

## Paso 4: validación automática

Al arrancar, `registerDomainProfile` valida cada perfil con zod. Si una cadena no cumple el esquema, el perfil no se registra y el error aparece en el arranque. Errores típicos: `id` con mayúsculas, `name` con guion, `requires` con más de un dato.

## Paso 5: pruebas

Mínimo, para cada gate nuevo:

1. **Extractor** (si lo hay): frases en español, neerlandés e inglés, casos ambiguos y casos sin dato. Ver `tests/atoms/periodExtraction.spec.ts`.
2. **Declaración de la cadena:** comprueba `id`, `requires`, `steps` y `respond` con `toEqual`. Ver el bloque "estado de cuenta del mes actual" en `tests/domain/ledger/ledgerTools.spec.ts`.
3. **La herramienta:** registra el tipo con un servidor simulado y llama al handler con datos reales de una base temporal. Comprueba el texto que recibirá el modelo. Ver `ledgerTools.spec.ts`.

Ejecuta todo desde la raíz:

```
pnpm exec vitest --run --config packages/core/vitest.config.ts
pnpm run build:ts
```

## Paso 6: comprobación en vivo

Reinicia el servidor con `pnpm start` después del build. Después pregunta en el chat y revisa el log:

| Línea del log                                                      | Qué confirma                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------------ |
| `Jev execution chain resolved` con `executionChain: [herramienta]` | Jev propuso la secuencia exacta de tu cadena (un solo paso). |
| `Difundiendo señal ... source: "jev-chain"` con `chain: "<id>"`    | El gate ejecutó tu cadena, no el modelo.                     |
| `Ejecutando herramienta MCP` con el nombre de la herramienta       | Se llamó la herramienta.                                     |
| Sin `tokens` nuevos en `platform_metrics`                          | No hubo llamada al modelo.                                   |

Si la pregunta pide el dato, la respuesta es el `ask`. Contesta con un valor válido, por ejemplo "marzo", "2026-03" o "segundo trimestre", y debe ejecutarse.

Si el log muestra `Jev execution chain resolved` con más de un nombre, o no muestra la línea, la pregunta fue al modelo. Eso no es un error del gate: es Jev que no propuso tu secuencia.

### Cómo medir el ahorro

Compara `platform_metrics` antes y después de la pregunta. Una pregunta que va al modelo deja eventos `tokens`. Una que pasa por el gate deja solo `task_completed`.

## Caso de referencia: `estado-de-cuenta`

1. **Checklist:** respuesta fija (sí), un paso (`get_my_statement` lo resuelve), un dato variable (periodo, sí), células permitidas (sí), respuesta de herramienta (sí).
2. **Herramienta:** ya existe. Su `description` en `domain-tools.json` dice que es para totales de un periodo.
3. **Dato:** el extractor `periodo` ya existe (`atoms/periodExtraction.ts`).
4. **Cadena:** registrada en `ledgerClientProfile`, con `requires: periodo` y `respond: "tool"`.
5. **Pruebas:** en `periodExtraction.spec.ts` y `ledgerTools.spec.ts`.
6. **Vivo:** "segundo trimestre" después de la aclaración dio `2026-T2` y se ejecutó sin modelo.

## Vista de datos (opcional)

Una herramienta puede devolver, además del texto, una vista para el panel junto al chat. Va en `structuredContent.view`:

- `type`: `"table"` (filas y columnas) o `"card"` (pares etiqueta-valor).
- `titleKey` y `params`: clave de traducción del título y sus valores. El front traduce; el backend no manda títulos en un idioma.
- Columnas e ítems con `key` y `format` (`text`, `cents` o `count`). Los importes van en céntimos, como número.

Para que una cadena declare el tipo que espera, agrega `view: "table"` o `view: "card"` en su definición. Si la herramienta produce otro tipo, la vista se descarta y el chat responde con el texto completo. Si la cadena no declara tipo, cualquier vista sirve.

El texto de la herramienta sigue existiendo para el modelo. Cuando la cadena produce una vista nueva, el chat responde con su `done`.

## Checklist final

- [ ] La pregunta cumple las cinco condiciones del checklist.
- [ ] La herramienta usa esquemas sin `pattern` ni `z.any()`, y su descripción en `domain-tools.json` es clara.
- [ ] La herramienta está en `domain-registry.json`.
- [ ] El prompt del agente (`ledger-agent-cliente.md` o `ledger-agent-contador.md`) menciona la herramienta entre comillas invertidas. La prueba `agentPrompts.spec.ts` lo verifica.
- [ ] Si hay dato, el extractor devuelve `null` en ambigüedad y tiene pruebas.
- [ ] Si la cadena es de filtro, la cadena sin filtro declara `avoidTerms` con esos términos, y la prueba `gastosPorEstado.spec.ts` (o equivalente) lo verifica.
- [ ] La cadena tiene `id` único, `requires` de máximo un dato y células en `allowedCells`.
- [ ] Hay pruebas del extractor, de la declaración y de la herramienta.
- [ ] El build y la suite pasan.
- [ ] En vivo: `executionChain` coincide, `source: jev-chain` aparece, y no hay tokens nuevos.
