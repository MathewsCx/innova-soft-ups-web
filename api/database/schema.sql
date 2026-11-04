CREATE TABLE IF NOT EXISTS tareas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL CHECK (length(titulo) BETWEEN 1 AND 120),
    descripcion TEXT NOT NULL DEFAULT '' CHECK (length(descripcion) <= 2000),
    estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'en_progreso', 'completado')),
    prioridad TEXT NOT NULL DEFAULT 'media'
        CHECK (prioridad IN ('baja', 'media', 'alta')),
    fecha_creacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    fecha_actualizacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    archivada INTEGER NOT NULL DEFAULT 0 CHECK (archivada IN (0, 1)),
    fecha_archivo TEXT
);

CREATE INDEX IF NOT EXISTS idx_tareas_archivada_fecha
    ON tareas (archivada, fecha_creacion DESC);

CREATE TABLE IF NOT EXISTS archivos (
    id TEXT PRIMARY KEY,
    tarea_id INTEGER NOT NULL REFERENCES tareas (id) ON DELETE CASCADE,
    nombre TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 160),
    tipo_mime TEXT NOT NULL CHECK (tipo_mime IN ('application/pdf', 'image/png', 'image/jpeg')),
    tamano INTEGER NOT NULL CHECK (tamano BETWEEN 1 AND 5242880),
    contenido BLOB NOT NULL,
    fecha_creacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_archivos_tarea_fecha
    ON archivos (tarea_id, fecha_creacion DESC);
