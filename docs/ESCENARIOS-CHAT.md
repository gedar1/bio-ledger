# Escenarios del chat: qué resuelve cada perfil

Lista de preguntas reales que el cliente y el contador pueden hacer, con lo que hay hoy y lo que falta. Sirve para decidir qué implementar después.

## Cómo llenarlo

- **Hoy:** `gate` si una cadena la resuelve sin modelo, `LLM` si va al modelo, `no` si no hay herramienta. Mi lectura del código está prellenada. Confírmala en vivo.
- **Verificado:** pon la confianza de Jev y la cadena del log (`LOG_LEVEL=debug`), o `pendiente` si no lo has probado.
- **Lo que falta:** lo que habría que agregar para resolverlo sin modelo.
- **Tipo de cambio:** `cadena` (solo perfil), `herramienta`, `extractor`, `vista`, `capacidad nueva` o `fuera de alcance`.

Los tipos de cambio van de menor a mayor esfuerzo. Empieza por los de `cadena`.

## Contador

| ID  | Pregunta de ejemplo                                                                 | Hoy              | Verificado | Lo que falta                                                    | Tipo de cambio          | Notas                                                                               |
| --- | ----------------------------------------------------------------------------------- | ---------------- | ---------- | --------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| C1  | ¿Qué gastos tiene el cliente Juan?                                                  | no               | pendiente  | Extractor de cliente y búsqueda por nombre en la plataforma     | extractor + herramienta | Hoy el contador trabaja sobre el cliente seleccionado en la pantalla, no por nombre |
| C2  | ¿Qué gastos tengo pendientes de revisión? Variantes: "de aprobación", "por aprobar" | gate con cliente | pendiente  | Validar las tres formulaciones en vivo                          | —                       | Cadena `pendientes-de-cliente`. Sin cliente, pide el nombre o ID. Absorbe C3        |
| C3  | ¿Qué gastos están pendientes de aprobación?                                         | (ver C2)         | —          | —                                                               | —                       | Se fusionó en C2: mismo estado y misma cadena                                       |
| C4  | ¿Qué gastos pendientes hay en noviembre?                                            | LLM              | pendiente  | `list_pending_expenses` no recibe periodo                       | herramienta + cadena    | Ver el ejemplo de práctica en el listado de herramientas                            |
| C5  | Dame el estado de cuenta de marzo del cliente                                       | LLM              | pendiente  | Cadena con `periodo` que llame a `get_client_statement`         | cadena                  | La herramienta ya existe                                                            |
| C6  | Dile al cliente que suba sus recibos                                                | no               | —          | Acción de escritura: enviar un mensaje                          | fuera de alcance        | Requiere confirmación explícita antes de enviar                                     |
| C7  | Muéstrame un gráfico de los gastos del cliente                                      | no               | —          | Tipo de vista `chart` con series, y render en el front          | vista                   | Ver los escenarios de vista en el contrato actual                                   |
| C8  | ¿Cuál es el gasto más caro del cliente?                                             | no               | —          | Herramienta del contador equivalente a `get_my_largest_expense` | herramienta + cadena    | Hoy solo existe para el cliente                                                     |

## Cliente

| ID  | Pregunta de ejemplo                                         | Hoy  | Verificado | Lo que falta                                               | Tipo de cambio                | Notas                                                          |
| --- | ----------------------------------------------------------- | ---- | ---------- | ---------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------- |
| L1  | ¿Cuáles son mis gastos?                                     | gate | pendiente  | —                                                          | —                             | Cadena `mis-gastos`                                            |
| L2  | ¿Cuáles son mis gastos aprobados?                           | gate | pendiente  | —                                                          | —                             | Cadena `gastos-por-estado`, con la descripción de Jev ajustada |
| L3  | ¿Cuánto llevo gastado este mes?                             | gate | pendiente  | —                                                          | —                             | Cadena `estado-de-cuenta-mes`                                  |
| L4  | ¿Cuánto gasté en marzo?                                     | gate | pendiente  | —                                                          | —                             | Cadena `estado-de-cuenta`                                      |
| L5  | ¿En qué categoría gasté más este mes?                       | gate | pendiente  | —                                                          | —                             | Cadena `gasto-por-categoria-periodo`                           |
| L6  | ¿Cuál fue mi gasto más caro en noviembre?                   | gate | pendiente  | —                                                          | —                             | Cadena `gasto-mas-caro`                                        |
| L7  | ¿Qué categorías tengo?                                      | gate | pendiente  | —                                                          | —                             | Cadena `mis-categorias`                                        |
| L8  | ¿Cuántos gastos tengo rechazados?                           | LLM  | pendiente  | Herramienta o cadena que cuente, no que liste              | herramienta o texto           | Hoy `gastos-por-estado` devuelve la lista                      |
| L9  | ¿Cuáles son mis gastos de la categoría Transporte?          | LLM  | pendiente  | Dos datos: categoría y, opcionalmente, estado              | herramienta + extractor       | Una cadena admite un solo dato                                 |
| L10 | ¿Cuáles fueron mis gastos aprobados en el primer trimestre? | LLM  | pendiente  | Dos datos: estado y periodo                                | herramienta o límite de datos | Ver el límite de `requires` en la guía                         |
| L11 | Compara mis gastos de octubre con los de noviembre          | no   | —          | Dos periodos y una comparación                             | herramienta + vista           | Puede resolverse con dos llamadas, o con una herramienta nueva |
| L12 | Muéstrame un gráfico de mis gastos por mes                  | no   | —          | Tipo de vista `chart` y una herramienta que agrupe por mes | vista + herramienta           | Mismo tipo de vista que C7                                     |

## Notas para decidir

- Los escenarios de tipo `cadena` son los más baratos. Empieza por C2 y C5, y por L4 y L6 si quieres ver cómo se declara un periodo.
- Los de tipo `extractor` o `herramienta` requieren pruebas de Jev y de la herramienta, además de la cadena.
- Los de tipo `vista` cambian el contrato de vistas, así que conviene resolverlos juntos (C7 y L12).
- C6 y las acciones que escriben datos no entran en el chat sin una decisión explícita.
