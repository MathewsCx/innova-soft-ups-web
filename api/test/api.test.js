import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { Server } from "socket.io";
import { io as createSocketClient } from "socket.io-client";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/config/database.js";
import { createTaskRepository } from "../src/repositories/task.repository.js";
import { registerSocketHandlers } from "../src/sockets/index.js";
import { createTaskService } from "../src/services/task.service.js";

let server;
let socketServer;
let database;
let baseUrl;
let socketClient;

async function createTask(data = {}) {
    const response = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: "Preparar prototipo académico", ...data })
    });

    return { response, body: await response.json() };
}

async function uploadPdf(taskId, name = "guia.pdf") {
    const form = new FormData();
    form.append("archivo", new Blob(["%PDF-1.7\ncontenido de prueba"], {
        type: "application/pdf"
    }), name);

    return fetch(`${baseUrl}/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: form
    });
}

before(async () => {
    database = createDatabase(":memory:");
    const taskRepository = createTaskRepository(database);
    const httpServer = createServer();
    socketServer = new Server(httpServer, {
        cors: { origin: ["http://localhost:5500"] }
    });
    registerSocketHandlers(socketServer);

    const taskService = createTaskService(taskRepository, socketServer);
    httpServer.on("request", createApp({ taskService, io: socketServer }));
    server = httpServer;
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    socketClient = createSocketClient(baseUrl, {
        transports: ["websocket"],
        reconnection: false
    });
    await Promise.race([
        once(socketClient, "api:conectada"),
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Socket.IO no confirmó la conexión.")), 3000)
                .unref();
        })
    ]);
});

after(async () => {
    socketClient?.close();
    if (socketServer) {
        await new Promise((resolve) => socketServer.close(resolve));
    }
    database?.close();
});

test("expone salud, protección HTTP y respuestas JSON uniformes", async () => {
    const health = await fetch(`${baseUrl}/api/health`);
    const healthBody = await health.json();

    assert.equal(health.status, 200);
    assert.equal(healthBody.status, "ok");
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");

    const allowedOrigin = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: "http://localhost:8000" }
    });
    assert.equal(allowedOrigin.status, 200);
    assert.equal(
        allowedOrigin.headers.get("access-control-allow-origin"),
        "http://localhost:8000"
    );

    const missing = await fetch(`${baseUrl}/api/no-existe`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), {
        error: { message: "Ruta no encontrada: GET /api/no-existe" }
    });

    const invalidJson = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{"
    });
    assert.equal(invalidJson.status, 400);
    assert.match((await invalidJson.json()).error.message, /JSON válido/);

    const blockedOrigin = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: "https://sitio-no-autorizado.example" }
    });
    assert.equal(blockedOrigin.status, 403);
});

test("valida entradas y rechaza campos no permitidos", async () => {
    for (const body of [
        {},
        { titulo: "   " },
        { titulo: "Tarea", estado: "eliminado" },
        { titulo: "Tarea", prioridad: "urgente" },
        { titulo: "Tarea", inesperado: true }
    ]) {
        const response = await fetch(`${baseUrl}/api/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        assert.equal(response.status, 400, JSON.stringify(body));
        assert.ok((await response.json()).error.message);
    }

    const tooLong = await createTask({ titulo: "x".repeat(121) });
    assert.equal(tooLong.response.status, 400);

    const malformedFilter = await fetch(`${baseUrl}/api/tasks?archivadas=quizas`);
    assert.equal(malformedFilter.status, 400);
});

test("implementa CRUD, filtros, ETag y conflictos de actualización", async () => {
    const createdSocketEvent = once(socketClient, "tarea:creada");
    const created = await createTask({
        titulo: "  Probar parametrización: ' OR 1=1 -- ",
        descripcion: "Revisar el flujo del prototipo",
        prioridad: "alta"
    });

    assert.equal(created.response.status, 201);
    assert.match(created.response.headers.get("location"), /^\/api\/tasks\/\d+$/);
    assert.equal(created.body.datos.titulo, "Probar parametrización: ' OR 1=1 --");
    assert.equal(created.body.datos.estado, "pendiente");
    assert.equal(created.body.datos.prioridad, "alta");
    assert.equal(created.body.datos.version, 1);
    const [socketTask] = await createdSocketEvent;
    assert.equal(socketTask.id, created.body.datos.id);

    const id = created.body.datos.id;
    const fetchCreated = await fetch(`${baseUrl}/api/tasks/${id}`);
    assert.equal(fetchCreated.status, 200);
    assert.equal(fetchCreated.headers.get("etag"), '"1"');

    const invalidId = await fetch(`${baseUrl}/api/tasks/1abc`);
    assert.equal(invalidId.status, 400);

    const staleUpdate = await fetch(`${baseUrl}/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "If-Match": '"9"' },
        body: JSON.stringify({ titulo: "Cambio obsoleto" })
    });
    assert.equal(staleUpdate.status, 409);

    const weakUpdate = await fetch(`${baseUrl}/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "If-Match": 'W/"1"' },
        body: JSON.stringify({ titulo: "Validador débil" })
    });
    assert.equal(weakUpdate.status, 400);

    const updated = await fetch(`${baseUrl}/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "If-Match": '"1"' },
        body: JSON.stringify({
            titulo: "Prototipo actualizado",
            descripcion: "Avance revisado",
            estado: "en_progreso",
            prioridad: "media"
        })
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.headers.get("etag"), '"2"');
    assert.equal((await updated.json()).datos.estado, "en_progreso");

    const filtered = await fetch(`${baseUrl}/api/tasks?estado=en_progreso&prioridad=media`);
    const filteredBody = await filtered.json();
    assert.equal(filtered.status, 200);
    assert.equal(filteredBody.datos.length, 1);
    assert.equal(filteredBody.datos[0].id, id);

    const deleteResponse = await fetch(`${baseUrl}/api/tasks/${id}`, { method: "DELETE" });
    assert.equal(deleteResponse.status, 204);
    assert.equal(await deleteResponse.text(), "");

    const missingTask = await fetch(`${baseUrl}/api/tasks/${id}`);
    assert.equal(missingTask.status, 404);
});

test("archiva y restaura tareas sin perder su historial", async () => {
    const created = await createTask();
    const id = created.body.datos.id;

    const archived = await fetch(`${baseUrl}/api/tasks/${id}/archivar`, { method: "POST" });
    assert.equal(archived.status, 200);
    assert.equal((await archived.json()).datos.archivada, true);

    const activeList = await fetch(`${baseUrl}/api/tasks`);
    assert.equal((await activeList.json()).datos.some((task) => task.id === id), false);

    const archivedTask = await fetch(`${baseUrl}/api/tasks/${id}`);
    assert.equal(archivedTask.status, 404);

    const archiveList = await fetch(`${baseUrl}/api/tasks?archivadas=true`);
    assert.equal((await archiveList.json()).datos.some((task) => task.id === id), true);

    const duplicateArchive = await fetch(`${baseUrl}/api/tasks/${id}/archivar`, {
        method: "POST"
    });
    assert.equal(duplicateArchive.status, 409);

    const restored = await fetch(`${baseUrl}/api/tasks/${id}/restaurar`, {
        method: "POST"
    });
    assert.equal(restored.status, 200);
    assert.equal((await restored.json()).datos.archivada, false);

    const duplicateRestore = await fetch(`${baseUrl}/api/tasks/${id}/restaurar`, {
        method: "POST"
    });
    assert.equal(duplicateRestore.status, 409);
});

test("conserva los datos al cerrar y volver a abrir SQLite", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "innova-soft-ups-"));
    const filename = path.join(directory, "prueba.sqlite");

    try {
        const firstDatabase = createDatabase(filename);
        const firstRepository = createTaskRepository(firstDatabase);
        const created = firstRepository.create({
            titulo: "Persistencia entre ejecuciones",
            descripcion: "",
            estado: "pendiente",
            prioridad: "media"
        });
        firstDatabase.close();

        const reopenedDatabase = createDatabase(filename);
        const reopenedRepository = createTaskRepository(reopenedDatabase);
        const persisted = reopenedRepository.findById(created.id);

        assert.equal(persisted.titulo, created.titulo);
        assert.equal(persisted.id, created.id);
        reopenedDatabase.close();
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test("sube, descarga, enumera y elimina adjuntos de forma segura", async () => {
    const created = await createTask();
    const taskId = created.body.datos.id;
    const uploaded = await uploadPdf(taskId, "guia académica.pdf");
    const uploadedBody = await uploaded.json();

    assert.equal(uploaded.status, 201);
    assert.equal(uploadedBody.datos.nombre, "guia académica.pdf");
    assert.equal(uploadedBody.datos.tipoMime, "application/pdf");
    assert.equal(uploadedBody.datos.tamano, Buffer.byteLength("%PDF-1.7\ncontenido de prueba"));

    const attachmentId = uploadedBody.datos.id;
    const downloaded = await fetch(
        `${baseUrl}/api/tasks/${taskId}/attachments/${attachmentId}`
    );
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get("content-type"), "application/pdf");
    assert.match(downloaded.headers.get("content-disposition"), /filename\*=UTF-8''/);
    assert.equal(
        Buffer.from(await downloaded.arrayBuffer()).toString(),
        "%PDF-1.7\ncontenido de prueba"
    );

    const listed = await fetch(`${baseUrl}/api/tasks/${taskId}/attachments`);
    const attachmentList = (await listed.json()).datos;
    assert.equal(listed.status, 200);
    assert.equal(attachmentList.length, 1);
    assert.equal(Object.hasOwn(attachmentList[0], "contenido"), false);

    const invalidFile = new FormData();
    invalidFile.append("archivo", new Blob(["no es un PDF"], {
        type: "application/pdf"
    }), "engaño.pdf");
    const rejected = await fetch(`${baseUrl}/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: invalidFile
    });
    assert.equal(rejected.status, 415);

    const wrongMime = new FormData();
    wrongMime.append("archivo", new Blob(["%PDF-1.7"], {
        type: "text/plain"
    }), "documento.pdf");
    const wrongMimeResponse = await fetch(`${baseUrl}/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: wrongMime
    });
    assert.equal(wrongMimeResponse.status, 415);

    const removed = await fetch(
        `${baseUrl}/api/tasks/${taskId}/attachments/${attachmentId}`,
        { method: "DELETE" }
    );
    assert.equal(removed.status, 204);

    const missingAttachment = await fetch(
        `${baseUrl}/api/tasks/${taskId}/attachments/${attachmentId}`
    );
    assert.equal(missingAttachment.status, 404);

    const oversizedForm = new FormData();
    oversizedForm.append("archivo", new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], {
        type: "application/pdf"
    }), "grande.pdf");
    const oversized = await fetch(`${baseUrl}/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: oversizedForm
    });
    assert.equal(oversized.status, 413);

    const cascadingTask = await createTask();
    const cascadingUpload = await uploadPdf(cascadingTask.body.datos.id);
    const cascadingAttachmentId = (await cascadingUpload.json()).datos.id;
    const deleteTask = await fetch(`${baseUrl}/api/tasks/${cascadingTask.body.datos.id}`, {
        method: "DELETE"
    });
    assert.equal(deleteTask.status, 204);
    assert.equal(
        database.prepare("SELECT COUNT(*) AS cantidad FROM archivos WHERE id = ?")
            .get(cascadingAttachmentId).cantidad,
        0
    );
});
