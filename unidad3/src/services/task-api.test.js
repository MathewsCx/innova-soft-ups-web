import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, createTaskApi } from "./task-api.js";

function response(status, payload) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() {
            return payload;
        }
    };
}

test("lista tareas y aplica el filtro de estado en la consulta", async () => {
    let requestedUrl;
    const api = createTaskApi("/api", async (url) => {
        requestedUrl = url;
        return response(200, { datos: [{ id: 8, titulo: "Prototipo" }] });
    });

    const tasks = await api.list({ estado: "en_progreso" });

    assert.equal(requestedUrl, "/api/tasks?estado=en_progreso");
    assert.deepEqual(tasks, [{ id: 8, titulo: "Prototipo" }]);
});

test("envía la versión ETag al actualizar y valida response.ok", async () => {
    let requestOptions;
    const api = createTaskApi("/api", async (_, options) => {
        requestOptions = options;
        return response(200, { datos: { id: 4, version: 3 } });
    });

    await api.update({
        id: 4,
        version: 2,
        titulo: "Revisar API",
        descripcion: "",
        estado: "en_progreso",
        prioridad: "alta"
    });

    assert.equal(requestOptions.headers.get("If-Match"), '"2"');
    assert.equal(requestOptions.method, "PUT");
    assert.deepEqual(JSON.parse(requestOptions.body), {
        titulo: "Revisar API",
        descripcion: "",
        estado: "en_progreso",
        prioridad: "alta"
    });

    const failingApi = createTaskApi("/api", async () =>
        response(409, { error: { message: "La tarea cambió." } })
    );
    await assert.rejects(failingApi.list(), (error) =>
        error instanceof ApiError
        && error.status === 409
        && error.message === "La tarea cambió."
    );
});

test("propaga la cancelación y comunica los errores de red", async () => {
    const controller = new AbortController();
    const api = createTaskApi("/api", async () => {
        const error = new Error("cancelado");
        error.name = "AbortError";
        throw error;
    });

    await assert.rejects(api.list({ signal: controller.signal }), { name: "AbortError" });

    const offlineApi = createTaskApi("/api", async () => {
        throw new TypeError("fetch failed");
    });
    await assert.rejects(offlineApi.list(), (error) =>
        error instanceof ApiError
        && error.status === 0
        && error.message.includes("conectar")
    );
});

test("acepta respuestas 204 sin intentar leer JSON", async () => {
    const api = createTaskApi("/api", async () => ({
        ok: true,
        status: 204,
        async json() {
            throw new Error("No debe consultarse el cuerpo.");
        }
    }));

    assert.equal(await api.remove(12), null);
});
