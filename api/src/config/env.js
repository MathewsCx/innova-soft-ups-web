const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT debe ser un número entero entre 1 y 65535.");
}

const configuredOrigins = process.env.CLIENT_ORIGINS;
const clientOrigins = configuredOrigins === undefined
    ? [
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]
    : configuredOrigins.split(",").map((origin) => origin.trim()).filter(Boolean);

if (clientOrigins.length === 0) {
    throw new Error("CLIENT_ORIGINS debe incluir al menos un origen permitido.");
}

export const PORT = port;
export const HOST = process.env.HOST?.trim() || "127.0.0.1";
export const CLIENT_ORIGINS = clientOrigins;
