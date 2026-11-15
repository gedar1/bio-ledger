# Colección de Postman de bio-ledger

Pruebas en vivo del contador, del cliente y del cierre de endpoints.

## Uso

1. Importa `bio-ledger.postman_collection.json` en Postman.
2. Copia `bio-ledger.environment.example.json` como `bio-ledger.local.json` y completa:
   - `accountantUser` y `accountantPassword`: la cuenta del contador.
   - `apiSecret`: el valor de `API_SECRET` de tu `.env`.
   - `tenantId` y `clientPassword`: el cliente de prueba. Si no existe, la carpeta 1 lo crea y deja una contraseña temporal en `tempPassword`.
3. Importa el entorno `bio-ledger.local.json` y selecciónalo.
4. Ejecuta las carpetas en orden: 1, 2 y 3.

Los tokens y los IDs se guardan solos en el entorno durante la ejecución.

## Advertencias

- El archivo `*.local.json` contiene contraseñas y tokens. Está en `.gitignore`. No lo subas.
- Las pruebas crean datos en la base del cliente de prueba. Usa un `tenantId` de prueba, no un cliente real.
- Si cambia una ruta de la API, actualiza la colección.
- Los campos numéricos (`id`, `categoria_id`) van sin comillas en el cuerpo JSON. Postman los reemplaza por el número antes de enviar la petición.
