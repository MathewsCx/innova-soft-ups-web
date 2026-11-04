import cors from "cors";
import express from "express";
import helmet from "helmet";
import { CLIENT_ORIGINS } from "./config/env.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { notFoundHandler } from "./middlewares/not-found.js";
import healthRouter from "./routes/health.routes.js";
import { createTaskRouter } from "./routes/task.routes.js";

export function createApp({ taskService, io }) {
    if (!taskService || !io || typeof io.emit !== "function") {
        throw new Error("Para iniciar la API se requieren el servicio de tareas y Socket.IO.");
    }

    const app = express();

    app.set("io", io);
    app.use(helmet());
    app.use(cors({
        origin(origin, callback) {
            if (origin === undefined || CLIENT_ORIGINS.includes(origin)) {
                callback(null, true);
                return;
            }

            callback(Object.assign(new Error("Origen no permitido por la política CORS."), {
                status: 403
            }));
        }
    }));
    app.use(express.json({ limit: "1mb" }));

    app.use("/api/health", healthRouter);
    app.use("/api/tasks", createTaskRouter(taskService));
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
