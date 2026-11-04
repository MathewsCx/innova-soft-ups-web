function setTaskVersion(response, task) {
    response.set("ETag", `"${task.version}"`);
}

function parseExpectedVersion(header) {
    if (header === undefined || header === "*") {
        return undefined;
    }

    const match = /^(?:"([1-9]\d*)"|([1-9]\d*))$/.exec(header);
    if (!match) {
        return Number.NaN;
    }

    return Number(match[1] ?? match[2]);
}

function toAttachmentResponse(attachment) {
    return {
        id: attachment.id,
        tareaId: attachment.tareaId,
        nombre: attachment.nombre,
        tipoMime: attachment.tipoMime,
        tamano: attachment.tamano,
        fechaCreacion: attachment.fechaCreacion
    };
}

export function createTaskController(taskService) {
    return {
        list: (request, response) => {
            response.status(200).json({ datos: taskService.list(request.query) });
        },
        get: (request, response) => {
            const task = taskService.get(request.params.id);
            setTaskVersion(response, task);
            response.status(200).json({ datos: task });
        },
        create: (request, response) => {
            const task = taskService.create(request.body);
            setTaskVersion(response, task);
            response.status(201)
                .location(`/api/tasks/${task.id}`)
                .json({ datos: task });
        },
        update: (request, response) => {
            const expectedVersion = parseExpectedVersion(request.get("If-Match"));
            const task = taskService.update(request.params.id, request.body, expectedVersion);
            setTaskVersion(response, task);
            response.status(200).json({ datos: task });
        },
        archive: (request, response) => {
            const task = taskService.archive(request.params.id);
            setTaskVersion(response, task);
            response.status(200).json({ datos: task });
        },
        restore: (request, response) => {
            const task = taskService.restore(request.params.id);
            setTaskVersion(response, task);
            response.status(200).json({ datos: task });
        },
        delete: (request, response) => {
            taskService.delete(request.params.id);
            response.status(204).end();
        },
        listAttachments: (request, response) => {
            const attachments = taskService.listAttachments(request.params.id)
                .map(toAttachmentResponse);
            response.status(200).json({ datos: attachments });
        },
        getAttachment: (request, response) => {
            const attachment = taskService.getAttachment(
                request.params.id,
                request.params.attachmentId
            );
            const asciiFilename = attachment.nombre.replace(/[^\x20-\x7e]|["\\;]/g, "_");
            response
                .type(attachment.tipoMime)
                .set("Content-Length", String(attachment.tamano))
                .set(
                    "Content-Disposition",
                    `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(attachment.nombre)}`
                )
                .status(200)
                .send(attachment.contenido);
        },
        createAttachment: (request, response) => {
            const attachment = taskService.createAttachment(
                request.params.id,
                request.file && {
                    buffer: request.file.buffer,
                    originalName: request.file.originalname,
                    mimeType: request.file.mimetype,
                    size: request.file.size
                }
            );
            response.status(201)
                .location(`/api/tasks/${request.params.id}/attachments/${attachment.id}`)
                .json({ datos: toAttachmentResponse(attachment) });
        },
        deleteAttachment: (request, response) => {
            taskService.deleteAttachment(request.params.id, request.params.attachmentId);
            response.status(204).end();
        }
    };
}
