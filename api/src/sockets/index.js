export function registerSocketHandlers(io) {
    io.on("connection", (socket) => {
        socket.emit("api:conectada", {
            status: "ok"
        });
    });
}
