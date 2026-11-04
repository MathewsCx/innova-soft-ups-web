export function errorHandler(error, _request, response, next) {
    if (response.headersSent) {
        next(error);
        return;
    }

    let statusCode = Number.isInteger(error.status)
        && error.status >= 400
        && error.status <= 599
        ? error.status
        : 500;
    let message = statusCode >= 500
        ? "Error interno del servidor."
        : error.message;

    if (error.type === "entity.parse.failed") {
        statusCode = 400;
        message = "El cuerpo de la solicitud no contiene JSON válido.";
    } else if (error.code === "LIMIT_FILE_SIZE") {
        statusCode = 413;
        message = "El archivo supera el límite permitido de 5 MB.";
    } else if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
        statusCode = 400;
        message = "Adjunta un solo archivo en el campo archivo.";
    } else if (error.code === "SQLITE_BUSY" || error.code === "SQLITE_LOCKED") {
        statusCode = 409;
        message = "La base de datos está ocupada; vuelve a intentar la operación.";
    }

    if (statusCode >= 500) {
        console.error(error);
    }

    response.status(statusCode).json({
        error: {
            message
        }
    });
}
