import { AppError } from "../errors/app-error.js";

const taskStates = new Set(["pendiente", "en_progreso", "completado"]);
const taskPriorities = new Set(["baja", "media", "alta"]);
const taskFields = new Set(["titulo", "descripcion", "estado", "prioridad"]);
const allowedAttachmentTypes = new Map([
    [".pdf", { mimeType: "application/pdf", signature: Buffer.from("%PDF-") }],
    [".png", { mimeType: "image/png", signature: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) }],
    [".jpg", { mimeType: "image/jpeg", signature: Buffer.from([255, 216, 255]) }],
    [".jpeg", { mimeType: "image/jpeg", signature: Buffer.from([255, 216, 255]) }]
]);
const maximumAttachmentSize = 5 * 1024 * 1024;
const allowedAttachmentFields = new Set(["buffer", "originalName", "mimeType", "size"]);

function requireRecord(value, label) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new AppError(400, `${label} debe ser un objeto JSON.`);
    }

    return value;
}

function rejectUnknownFields(value, allowedFields, label) {
    const unknownField = Object.keys(value).find((field) => !allowedFields.has(field));

    if (unknownField) {
        throw new AppError(400, `Campo no permitido en ${label}: ${unknownField}.`);
    }
}

function validateTaskInput(input) {
    const body = requireRecord(input, "La tarea");
    rejectUnknownFields(body, taskFields, "la tarea");

    if (typeof body.titulo !== "string" || body.titulo.trim().length === 0) {
        throw new AppError(400, "El título es obligatorio.");
    }

    const titulo = body.titulo.trim();
    if (titulo.length > 120) {
        throw new AppError(400, "El título no puede superar los 120 caracteres.");
    }

    const descripcion = body.descripcion ?? "";
    if (typeof descripcion !== "string" || descripcion.length > 2000) {
        throw new AppError(400, "La descripción debe ser texto de hasta 2000 caracteres.");
    }

    const estado = body.estado ?? "pendiente";
    if (typeof estado !== "string" || !taskStates.has(estado)) {
        throw new AppError(400, "El estado debe ser pendiente, en_progreso o completado.");
    }

    const prioridad = body.prioridad ?? "media";
    if (typeof prioridad !== "string" || !taskPriorities.has(prioridad)) {
        throw new AppError(400, "La prioridad debe ser baja, media o alta.");
    }

    return { titulo, descripcion: descripcion.trim(), estado, prioridad };
}

function validateTaskId(value) {
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
        throw new AppError(400, "El identificador de tarea debe ser un entero positivo.");
    }

    const id = Number(value);
    if (!Number.isSafeInteger(id)) {
        throw new AppError(400, "El identificador de tarea está fuera de rango.");
    }

    return id;
}

function validateFilter(value, allowedValues, label) {
    if (value === undefined) {
        return null;
    }

    if (typeof value !== "string" || !allowedValues.has(value)) {
        throw new AppError(400, `El filtro ${label} no es válido.`);
    }

    return value;
}

function validateArchiveFilter(value) {
    if (value === undefined || value === "false") {
        return false;
    }
    if (value === "true") {
        return true;
    }

    throw new AppError(400, "El filtro archivadas debe ser true o false.");
}

function normalizeFilename(name) {
    const filename = typeof name === "string" ? name.split(/[\\/]/).pop() : "";
    const normalized = filename
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .replace(/[^\p{L}\p{N}._ -]/gu, "_")
        .trim()
        .slice(0, 160);

    if (!normalized || normalized === "." || normalized === "..") {
        throw new AppError(400, "El archivo debe tener un nombre válido.");
    }

    return normalized;
}

function validateAttachment(input) {
    const file = requireRecord(input, "El archivo");
    rejectUnknownFields(file, allowedAttachmentFields, "el archivo");

    if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
        throw new AppError(400, "Adjunta un archivo no vacío.");
    }
    if (file.buffer.length > maximumAttachmentSize || file.size !== file.buffer.length) {
        throw new AppError(400, "El tamaño del archivo no es válido o supera los 5 MB.");
    }

    const nombre = normalizeFilename(file.originalName);
    const extension = nombre.slice(nombre.lastIndexOf(".")).toLowerCase();
    const allowedType = allowedAttachmentTypes.get(extension);

    if (!allowedType || file.mimeType !== allowedType.mimeType) {
        throw new AppError(415, "Formato no permitido; usa PDF, PNG o JPEG.");
    }
    if (!file.buffer.subarray(0, allowedType.signature.length).equals(allowedType.signature)) {
        throw new AppError(415, "El contenido del archivo no coincide con su formato declarado.");
    }

    return {
        nombre,
        tipoMime: allowedType.mimeType,
        tamano: file.buffer.length,
        contenido: file.buffer
    };
}

function publish(io, event, data) {
    if (!io || typeof io.emit !== "function") {
        throw new Error("Socket.IO no está configurado en la aplicación.");
    }

    io.emit(event, data);
}

export function createTaskService(repository, io) {
    function findTask(id, { includeArchived = false } = {}) {
        const task = repository.findById(validateTaskId(id));

        if (!task) {
            throw new AppError(404, "La tarea no existe.");
        }
        if (task.archivada && !includeArchived) {
            throw new AppError(404, "La tarea no existe.");
        }

        return task;
    }

    function requireArchiveState(task, archived) {
        if (Boolean(task.archivada) !== archived) {
            throw new AppError(409, archived
                ? "La tarea ya está archivada."
                : "La tarea no está archivada.");
        }
    }

    return {
        list(query = {}) {
            const filters = requireRecord(query, "Los filtros");
            rejectUnknownFields(filters, new Set(["estado", "prioridad", "archivadas"]), "los filtros");

            return repository.list({
                archived: validateArchiveFilter(filters.archivadas),
                estado: validateFilter(filters.estado, taskStates, "estado"),
                prioridad: validateFilter(filters.prioridad, taskPriorities, "prioridad")
            });
        },
        get(id) {
            return findTask(id);
        },
        create(input) {
            const task = repository.create(validateTaskInput(input));
            publish(io, "tarea:creada", task);
            return task;
        },
        update(id, input, expectedVersion) {
            const currentTask = findTask(id);
            if (expectedVersion !== undefined
                && (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)) {
                throw new AppError(400, "If-Match debe contener una versión positiva.");
            }
            if (expectedVersion !== undefined && expectedVersion !== currentTask.version) {
                throw new AppError(409, "La tarea cambió; vuelve a consultarla antes de actualizarla.");
            }

            const updatedTask = repository.update(
                currentTask.id,
                expectedVersion ?? currentTask.version,
                validateTaskInput(input)
            );
            if (!updatedTask) {
                throw new AppError(409, "La tarea cambió; vuelve a consultarla antes de actualizarla.");
            }

            publish(io, "tarea:actualizada", updatedTask);
            return updatedTask;
        },
        archive(id) {
            const currentTask = findTask(id, { includeArchived: true });
            requireArchiveState(currentTask, false);

            const archivedTask = repository.archive(currentTask.id);
            if (!archivedTask) {
                throw new AppError(409, "No se pudo archivar la tarea porque cambió.");
            }

            publish(io, "tarea:archivada", archivedTask);
            return archivedTask;
        },
        restore(id) {
            const currentTask = findTask(id, { includeArchived: true });
            requireArchiveState(currentTask, true);

            const restoredTask = repository.restore(currentTask.id);
            if (!restoredTask) {
                throw new AppError(409, "No se pudo restaurar la tarea porque cambió.");
            }

            publish(io, "tarea:restaurada", restoredTask);
            return restoredTask;
        },
        delete(id) {
            const task = findTask(id, { includeArchived: true });
            if (!repository.delete(task.id)) {
                throw new AppError(409, "No se pudo eliminar la tarea porque cambió.");
            }

            publish(io, "tarea:eliminada", { id: task.id });
            return { id: task.id };
        },
        listAttachments(id) {
            const task = findTask(id);
            return repository.listAttachments(task.id);
        },
        getAttachment(id, attachmentId) {
            const task = findTask(id);
            const attachment = repository.findAttachment(task.id, attachmentId);
            if (!attachment) {
                throw new AppError(404, "El archivo adjunto no existe.");
            }

            return attachment;
        },
        createAttachment(id, file) {
            const task = findTask(id);
            const attachment = repository.createAttachment(task.id, validateAttachment(file));
            publish(io, "archivo:adjuntado", {
                id: attachment.id,
                tareaId: attachment.tareaId,
                nombre: attachment.nombre
            });
            return attachment;
        },
        deleteAttachment(id, attachmentId) {
            const task = findTask(id);
            const attachment = repository.findAttachment(task.id, attachmentId);
            if (!attachment) {
                throw new AppError(404, "El archivo adjunto no existe.");
            }
            if (!repository.deleteAttachment(task.id, attachmentId)) {
                throw new AppError(409, "No se pudo eliminar el archivo porque cambió.");
            }

            publish(io, "archivo:eliminado", {
                id: attachment.id,
                tareaId: task.id
            });
            return { id: attachment.id, tareaId: task.id };
        }
    };
}
