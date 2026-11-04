import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { CLIENT_ORIGINS, HOST, PORT } from "./config/env.js";
import { createDatabase } from "./config/database.js";
import { createTaskRepository } from "./repositories/task.repository.js";
import { createTaskService } from "./services/task.service.js";
import { registerSocketHandlers } from "./sockets/index.js";

const database = createDatabase();
const repository = createTaskRepository(database);
const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: CLIENT_ORIGINS
    }
});

registerSocketHandlers(io);
const taskService = createTaskService(repository, io);
const app = createApp({ taskService, io });
httpServer.on("request", app);

httpServer.listen(PORT, HOST, () => {
    console.info(`InnovaSoft UPS API escuchando en ${HOST}:${PORT}.`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
        io.close(() => {
            database.close();
            process.exitCode = 0;
        });
    });
}
