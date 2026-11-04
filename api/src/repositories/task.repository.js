import { randomUUID } from "node:crypto";

const taskColumns = `
    id,
    titulo,
    descripcion,
    estado,
    prioridad,
    fecha_creacion AS fechaCreacion,
    fecha_actualizacion AS fechaActualizacion,
    version,
    archivada,
    fecha_archivo AS fechaArchivo
`;

const attachmentColumns = `
    id,
    tarea_id AS tareaId,
    nombre,
    tipo_mime AS tipoMime,
    tamano,
    fecha_creacion AS fechaCreacion
`;

function mapTask(row) {
    return row && { ...row, archivada: Boolean(row.archivada) };
}

export function createTaskRepository(database) {
    const statements = {
        listTasks: database.prepare(`
            SELECT ${taskColumns}
            FROM tareas
            WHERE archivada = @archived
                AND (@estado IS NULL OR estado = @estado)
                AND (@prioridad IS NULL OR prioridad = @prioridad)
            ORDER BY fecha_creacion DESC, id DESC
        `),
        findTask: database.prepare(`
            SELECT ${taskColumns}
            FROM tareas
            WHERE id = ?
        `),
        insertTask: database.prepare(`
            INSERT INTO tareas (titulo, descripcion, estado, prioridad)
            VALUES (@titulo, @descripcion, @estado, @prioridad)
        `),
        updateTask: database.prepare(`
            UPDATE tareas
            SET titulo = @titulo,
                descripcion = @descripcion,
                estado = @estado,
                prioridad = @prioridad,
                fecha_actualizacion = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                version = version + 1
            WHERE id = @id AND version = @version AND archivada = 0
        `),
        archiveTask: database.prepare(`
            UPDATE tareas
            SET archivada = 1,
                fecha_archivo = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                fecha_actualizacion = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                version = version + 1
            WHERE id = ? AND archivada = 0
        `),
        restoreTask: database.prepare(`
            UPDATE tareas
            SET archivada = 0,
                fecha_archivo = NULL,
                fecha_actualizacion = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                version = version + 1
            WHERE id = ? AND archivada = 1
        `),
        deleteTask: database.prepare("DELETE FROM tareas WHERE id = ?"),
        listAttachments: database.prepare(`
            SELECT ${attachmentColumns}
            FROM archivos
            WHERE tarea_id = ?
            ORDER BY fecha_creacion DESC, id
        `),
        findAttachment: database.prepare(`
            SELECT ${attachmentColumns}, contenido
            FROM archivos
            WHERE id = ? AND tarea_id = ?
        `),
        insertAttachment: database.prepare(`
            INSERT INTO archivos (id, tarea_id, nombre, tipo_mime, tamano, contenido)
            VALUES (@id, @tareaId, @nombre, @tipoMime, @tamano, @contenido)
        `),
        deleteAttachment: database.prepare(`
            DELETE FROM archivos
            WHERE id = ? AND tarea_id = ?
        `)
    };

    return {
        list({ archived, estado = null, prioridad = null }) {
            return statements.listTasks.all({ archived: Number(archived), estado, prioridad })
                .map(mapTask);
        },
        findById(id) {
            return mapTask(statements.findTask.get(id));
        },
        create(task) {
            const result = statements.insertTask.run(task);
            return mapTask(statements.findTask.get(Number(result.lastInsertRowid)));
        },
        update(id, version, task) {
            const result = statements.updateTask.run({ id, version, ...task });
            return result.changes === 1 ? mapTask(statements.findTask.get(id)) : null;
        },
        archive(id) {
            const result = statements.archiveTask.run(id);
            return result.changes === 1 ? mapTask(statements.findTask.get(id)) : null;
        },
        restore(id) {
            const result = statements.restoreTask.run(id);
            return result.changes === 1 ? mapTask(statements.findTask.get(id)) : null;
        },
        delete(id) {
            return statements.deleteTask.run(id).changes === 1;
        },
        listAttachments(taskId) {
            return statements.listAttachments.all(taskId);
        },
        findAttachment(taskId, attachmentId) {
            return statements.findAttachment.get(attachmentId, taskId);
        },
        createAttachment(taskId, file) {
            const attachment = {
                id: randomUUID(),
                tareaId: taskId,
                ...file
            };
            statements.insertAttachment.run(attachment);
            return statements.findAttachment.get(attachment.id, taskId);
        },
        deleteAttachment(taskId, attachmentId) {
            return statements.deleteAttachment.run(attachmentId, taskId).changes === 1;
        }
    };
}
