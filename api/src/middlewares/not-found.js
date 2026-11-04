export function notFoundHandler(request, response) {
    response.status(404).json({
        error: {
            message: `Ruta no encontrada: ${request.method} ${request.originalUrl}`
        }
    });
}
