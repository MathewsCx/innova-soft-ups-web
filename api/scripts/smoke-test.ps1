$ErrorActionPreference = "Stop"

$baseUrl = if ($env:API_BASE_URL) {
    $env:API_BASE_URL.TrimEnd("/")
} else {
    "http://127.0.0.1:3000"
}

$taskId = $null
$taskDeleted = $false
$failure = $null

function Write-Check {
    param(
        [string]$Method,
        [string]$Path,
        [int]$Status,
        [string]$Detail
    )

    Write-Host ("[{0}] {1} {2} - {3}" -f $Status, $Method, $Path, $Detail) `
        -ForegroundColor Green
}

function Invoke-JsonRequest {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body,
        [hashtable]$Headers
    )

    $parameters = @{
        Method      = $Method
        Uri         = "$baseUrl$Path"
        UseBasicParsing = $true
    }

    if ($null -ne $Body) {
        $parameters.ContentType = "application/json; charset=utf-8"
        $parameters.Body = ConvertTo-Json -InputObject $Body -Depth 5 -Compress
    }

    if ($null -ne $Headers) {
        $parameters.Headers = $Headers
    }

    Invoke-WebRequest @parameters
}

try {
    $healthResponse = Invoke-JsonRequest -Method "GET" -Path "/api/health"
    $health = $healthResponse.Content | ConvertFrom-Json
    if ($healthResponse.StatusCode -ne 200 -or $health.status -ne "ok") {
        throw "El endpoint de salud no devolvió el estado esperado."
    }
    Write-Check "GET" "/api/health" $healthResponse.StatusCode "Servicio activo"

    $createResponse = Invoke-JsonRequest -Method "POST" -Path "/api/tasks" -Body @{
        titulo = "Verificacion temporal de API"
        descripcion = "Registro temporal creado y eliminado por la prueba funcional."
        estado = "pendiente"
        prioridad = "alta"
    }
    $created = $createResponse.Content | ConvertFrom-Json
    if ($createResponse.StatusCode -ne 201 -or -not $created.datos.id) {
        throw "La API no creó la tarea temporal correctamente."
    }

    $taskId = [int]$created.datos.id
    Write-Check "POST" "/api/tasks" $createResponse.StatusCode `
        "Tarea temporal creada (id=$taskId)"
    Write-Host ($created.datos | ConvertTo-Json -Depth 5)

    $taskPath = "/api/tasks/$taskId"
    $readResponse = Invoke-JsonRequest -Method "GET" -Path $taskPath
    $readTask = $readResponse.Content | ConvertFrom-Json
    if ($readResponse.StatusCode -ne 200 -or $readTask.datos.id -ne $taskId) {
        throw "No se pudo consultar la tarea recién creada."
    }
    Write-Check "GET" $taskPath $readResponse.StatusCode "Tarea persistida en SQLite"

    $updateResponse = Invoke-JsonRequest -Method "PUT" -Path $taskPath `
        -Headers @{ "If-Match" = "`"$($readTask.datos.version)`"" } `
        -Body @{
            titulo = "Verificacion temporal actualizada"
            descripcion = "Actualizacion comprobada en la base SQLite local."
            estado = "en_progreso"
            prioridad = "media"
        }
    $updated = $updateResponse.Content | ConvertFrom-Json
    if ($updateResponse.StatusCode -ne 200 -or $updated.datos.estado -ne "en_progreso") {
        throw "La actualización de la tarea no produjo el resultado esperado."
    }
    Write-Check "PUT" $taskPath $updateResponse.StatusCode `
        "Tarea actualizada (version=$($updated.datos.version), estado=$($updated.datos.estado))"

    $archivePath = "$taskPath/archivar"
    $archiveResponse = Invoke-JsonRequest -Method "POST" -Path $archivePath
    $archived = $archiveResponse.Content | ConvertFrom-Json
    if ($archiveResponse.StatusCode -ne 200 -or -not $archived.datos.archivada) {
        throw "No se pudo archivar la tarea."
    }
    Write-Check "POST" $archivePath $archiveResponse.StatusCode "Tarea archivada"

    $archiveListResponse = Invoke-JsonRequest -Method "GET" `
        -Path "/api/tasks?archivadas=true"
    $archiveList = $archiveListResponse.Content | ConvertFrom-Json
    $archivedTaskExists = @($archiveList.datos | Where-Object { $_.id -eq $taskId }).Count -gt 0
    if ($archiveListResponse.StatusCode -ne 200 -or -not $archivedTaskExists) {
        throw "La lista de tareas archivadas no contiene la tarea esperada."
    }
    Write-Check "GET" "/api/tasks?archivadas=true" $archiveListResponse.StatusCode `
        "Tarea archivada encontrada"

    $restorePath = "$taskPath/restaurar"
    $restoreResponse = Invoke-JsonRequest -Method "POST" -Path $restorePath
    $restored = $restoreResponse.Content | ConvertFrom-Json
    if ($restoreResponse.StatusCode -ne 200 -or $restored.datos.archivada) {
        throw "No se pudo restaurar la tarea."
    }
    Write-Check "POST" $restorePath $restoreResponse.StatusCode "Tarea restaurada"

    $deleteResponse = Invoke-JsonRequest -Method "DELETE" -Path $taskPath
    if ($deleteResponse.StatusCode -ne 204) {
        throw "La API no eliminó la tarea temporal."
    }
    $taskDeleted = $true
    Write-Check "DELETE" $taskPath $deleteResponse.StatusCode "Tarea temporal eliminada"

    try {
        $missingResponse = Invoke-JsonRequest -Method "GET" -Path $taskPath
        throw "Se esperaba 404 tras eliminar la tarea; se recibió $($missingResponse.StatusCode)."
    } catch {
        $response = $_.Exception.Response
        if ($null -eq $response -or [int]$response.StatusCode -ne 404) {
            throw
        }
        Write-Check "GET" $taskPath 404 "Confirmado: el registro ya no existe"
    }
} catch {
    $failure = $_
} finally {
    if ($null -ne $taskId -and -not $taskDeleted) {
        try {
            $cleanupResponse = Invoke-JsonRequest -Method "DELETE" -Path "/api/tasks/$taskId"
            if ($cleanupResponse.StatusCode -ne 204) {
                throw "La limpieza del registro temporal no devolvió 204."
            }
            Write-Host "Limpieza: tarea temporal eliminada tras finalizar la prueba." `
                -ForegroundColor Yellow
        } catch {
            $cleanupStatus = $_.Exception.Response.StatusCode
            if ($null -eq $cleanupStatus -or [int]$cleanupStatus -ne 404) {
                $failure = $_
            }
        }
    }
}

if ($null -ne $failure) {
    Write-Error ("Prueba funcional fallida: {0}" -f $failure.Exception.Message)
    exit 1
}

Write-Host "Resultado: todas las operaciones HTTP contra la API local finalizaron correctamente." `
    -ForegroundColor Cyan
