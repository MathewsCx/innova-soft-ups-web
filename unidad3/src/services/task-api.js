export class ApiError extends Error {
    constructor(message, status = 0, options = {}) {
        super(message, options);
        this.name = "ApiError";
        this.status = status;
    }
}

export function createTaskApi(baseUrl = "/api", fetchImpl = fetch) {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

    async function request(path, { method = "GET", body, signal, headers = {} } = {}) {
        const requestHeaders = new Headers(headers);
        const options = { method, headers: requestHeaders, signal };

        if (body !== undefined) {
            requestHeaders.set("Content-Type", "application/json");
            options.body = JSON.stringify(body);
        }

        let response;
        try {
            response = await fetchImpl(`${normalizedBaseUrl}${path}`, options);
        } catch (error) {
            if (error.name === "AbortError") {
                throw error;
            }
            throw new ApiError("No se pudo conectar con el servicio. Comprueba la conexión e inténtalo de nuevo.", 0, { cause: error });
        }

        let payload = null;
        if (response.status !== 204) {
            try {
                payload = await response.json();
            } catch (error) {
                throw new ApiError("El servicio devolvió una respuesta JSON no válida.", response.status, { cause: error });
            }
        }

        if (!response.ok) {
            throw new ApiError(
                payload?.error?.message || `La solicitud falló (HTTP ${response.status}).`,
                response.status
            );
        }

        return payload?.datos ?? null;
    }

    return {
        async list({ estado, signal } = {}) {
            const query = new URLSearchParams();
            if (estado) {
                query.set("estado", estado);
            }
            const suffix = query.toString();
            const tasks = await request(`/tasks${suffix ? `?${suffix}` : ""}`, { signal });
            if (!Array.isArray(tasks)) {
                throw new ApiError("El servicio devolvió una lista de tareas no válida.");
            }
            return tasks;
        },
        create(task) {
            return request("/tasks", { method: "POST", body: task });
        },
        update(task) {
            return request(`/tasks/${task.id}`, {
                method: "PUT",
                headers: { "If-Match": `"${task.version}"` },
                body: {
                    titulo: task.titulo,
                    descripcion: task.descripcion,
                    estado: task.estado,
                    prioridad: task.prioridad
                }
            });
        },
        archive(id) {
            return request(`/tasks/${id}/archivar`, { method: "POST" });
        },
        remove(id) {
            return request(`/tasks/${id}`, { method: "DELETE" });
        }
    };
}
