# API REST de InnovaSoft UPS

Backend académico para organizar tareas de proyectos de software. Es independiente del sitio estático de la Unidad 1.

## Requisitos y ejecución

- Node.js 20 o posterior y npm.
- PowerShell abierto en la carpeta `api`.

```powershell
npm install
npm test
npm start
```

El servidor escucha en `http://localhost:3000` y, de forma predeterminada, solo acepta conexiones locales (`HOST=127.0.0.1`). Para desarrollo con reinicio automático, usa `npm run dev`.

La base SQLite se inicializa automáticamente en `database/database.sqlite`. La ruta se puede cambiar con `DATABASE_PATH`. El esquema SQL está en `database/schema.sql`. `.env.example` documenta las variables configurables; si cambias el origen de la interfaz, establece `CLIENT_ORIGINS` como una lista de orígenes separados por comas. Las llamadas sin encabezado `Origin`, por ejemplo desde PowerShell o Postman, también están permitidas.

## Arquitectura

- `src/routes`: endpoints y carga acotada de archivos.
- `src/controllers`: HTTP, estados, encabezados y representación de datos.
- `src/services`: reglas, validaciones, conflictos y publicación de eventos.
- `src/repositories`: SQL parametrizado con `better-sqlite3`.
- `src/config`: configuración validada y creación del esquema SQLite.
- `src/middlewares`: respuestas 404 y errores uniformes.
- `src/sockets`: conexión Socket.IO.
- `database/schema.sql`: tablas de tareas y adjuntos, restricciones e índices.
- `test/api.test.js`: pruebas HTTP, persistencia, archivos, CORS y Socket.IO.
- `postman/Unidad2.postman_collection.json`: colección importable.

## Formato de respuesta

Las respuestas correctas de lectura y escritura usan JSON:

```json
{
  "datos": {
    "id": 1,
    "titulo": "Preparar prototipo académico",
    "descripcion": "Organizar la entrega",
    "estado": "pendiente",
    "prioridad": "media",
    "version": 1,
    "archivada": false
  }
}
```

Las listas se envuelven en `datos`, que contiene una matriz. Las respuestas de error usan un formato único:

```json
{
  "error": {
    "message": "El título es obligatorio."
  }
}
```

## Endpoints de tareas

| Método y ruta | Función | Respuesta principal |
|---|---|---|
| `GET /api/health` | Comprueba que el servicio está activo. | `200` |
| `GET /api/tasks` | Lista las tareas no archivadas. | `200` |
| `GET /api/tasks?estado=en_progreso&prioridad=alta` | Filtra por estado y prioridad. | `200` |
| `GET /api/tasks?archivadas=true` | Lista las tareas archivadas. | `200` |
| `GET /api/tasks/:id` | Consulta una tarea y devuelve su ETag de versión. | `200`, `400` o `404` |
| `POST /api/tasks` | Crea una tarea. | `201` |
| `PUT /api/tasks/:id` | Reemplaza una tarea; acepta `If-Match: "1"` para evitar sobrescribir cambios concurrentes. | `200`, `400`, `404` o `409` |
| `POST /api/tasks/:id/archivar` | Archiva una tarea sin borrarla. | `200`, `404` o `409` |
| `POST /api/tasks/:id/restaurar` | Restaura una tarea archivada. | `200`, `404` o `409` |
| `DELETE /api/tasks/:id` | Elimina permanentemente la tarea y sus adjuntos. | `204` o `404` |

Ejemplo de creación:

```http
POST /api/tasks
Content-Type: application/json
```

```json
{
  "titulo": "Diseñar el prototipo",
  "descripcion": "Preparar la vista inicial",
  "estado": "pendiente",
  "prioridad": "alta"
}
```

Los estados válidos son `pendiente`, `en_progreso` y `completado`; las prioridades válidas son `baja`, `media` y `alta`. El título es obligatorio, se recortan espacios exteriores y se limita a 120 caracteres; la descripción acepta hasta 2000 caracteres. Campos no reconocidos se rechazan.

## Archivos adjuntos

Se permiten archivos PDF, PNG y JPEG de hasta 5 MB. Se comprueban tanto la extensión y el MIME como la firma binaria. El contenido se guarda como BLOB en SQLite: no se interpretan rutas ni nombres aportados como ubicaciones del sistema de archivos.

| Método y ruta | Función | Respuesta principal |
|---|---|---|
| `POST /api/tasks/:id/attachments` | Sube un archivo en el campo multipart `archivo`. | `201`, `400`, `404`, `413` o `415` |
| `GET /api/tasks/:id/attachments` | Lista los metadatos de los adjuntos. | `200` |
| `GET /api/tasks/:id/attachments/:attachmentId` | Descarga el contenido del adjunto. | `200` o `404` |
| `DELETE /api/tasks/:id/attachments/:attachmentId` | Elimina un adjunto. | `204` o `404` |

## Tiempo real

Socket.IO acepta los orígenes definidos por `CLIENT_ORIGINS`. Al conectarse, el servidor emite `api:conectada`. Tras confirmar cada operación de base de datos, emite `tarea:creada`, `tarea:actualizada`, `tarea:archivada`, `tarea:restaurada`, `tarea:eliminada`, `archivo:adjuntado` o `archivo:eliminado`. Cada evento contiene la tarea actualizada o los metadatos mínimos del archivo; nunca transmite el contenido binario.

## Pruebas y colección

`npm test` levanta un servidor HTTP y Socket.IO con una base SQLite temporal en memoria. Comprueba los códigos HTTP, respuestas de error, validación, operaciones CRUD, filtros, ETag y conflictos, archivado, subida y descarga de archivos, rechazo de formatos falsos, límite de tamaño, CORS y eventos en tiempo real.

Para reproducir solicitudes manualmente, importa `postman/Unidad2.postman_collection.json` en Postman. Las pruebas automatizadas no requieren credenciales ni una base de datos persistente. Al ejecutar el servidor normal, la base real permanece en `database/database.sqlite`, excluida del repositorio.
