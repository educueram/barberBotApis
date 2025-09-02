Write-Host "DIAGNOSTICO COMPLETO DE EMAIL SMTP" -ForegroundColor Green
Write-Host "======================================================="

# Esperar que el servidor se inicie
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "PASO 1: Verificando que el servidor este ejecutandose..." -ForegroundColor Yellow

try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method GET -TimeoutSec 10
    Write-Host "Servidor ejecutandose correctamente" -ForegroundColor Green
    Write-Host "   Entorno: $($health.environment)"
    Write-Host "   Google Auth: $($health.services.googleAuth)"
} catch {
    Write-Host "ERROR: Servidor no responde" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)"
    exit 1
}

Write-Host ""
Write-Host "PASO 2: Probando envio de email..." -ForegroundColor Yellow

$emailTest = @{
    email = "goparirisvaleria@gmail.com"
} | ConvertTo-Json

try {
    Write-Host "   Enviando email de prueba a: goparirisvaleria@gmail.com"
    
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/test-email" -Method POST -Body $emailTest -ContentType "application/json" -TimeoutSec 30
    
    Write-Host ""
    Write-Host "RESULTADO DEL TEST:" -ForegroundColor Cyan
    
    if ($response.success) {
        Write-Host "EMAIL ENVIADO EXITOSAMENTE!" -ForegroundColor Green
        Write-Host "   Mensaje: $($response.message)"
        Write-Host "   Message ID: $($response.details.messageId)"
        Write-Host ""
        Write-Host "El email deberia llegar a goparirisvaleria@gmail.com!" -ForegroundColor Green
        Write-Host "   - Revisa la bandeja de entrada"
        Write-Host "   - Revisa la carpeta de SPAM/No deseado"
        Write-Host "   - El email puede tardar unos minutos en llegar"
    } else {
        Write-Host "ERROR ENVIANDO EMAIL" -ForegroundColor Red
        Write-Host "   Mensaje: $($response.message)"
        Write-Host "   Error: $($response.error)"
        
        if ($response.error -like "*Username and Password not accepted*") {
            Write-Host ""
            Write-Host "PROBLEMA IDENTIFICADO: App Password invalido" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "SOLUCION PASO A PASO:" -ForegroundColor Cyan
            Write-Host "1. Ve a: https://myaccount.google.com"
            Write-Host "2. Click en Seguridad (lado izquierdo)"
            Write-Host "3. Busca Contraseñas de aplicaciones"
            Write-Host "4. ELIMINA la contraseña anterior si existe"
            Write-Host "5. Crea una NUEVA contraseña para Correo"
            Write-Host "6. COPIA los 16 caracteres SIN espacios"
            Write-Host "7. En Railway: Variables -> SMTP_PASS -> Pega la nueva contraseña"
            Write-Host "8. Espera que Railway se redespliegue"
            Write-Host ""
            Write-Host "IMPORTANTE: Cada vez que generas un App Password, el anterior deja de funcionar"
        }
    }
    
} catch {
    Write-Host "ERROR EJECUTANDO TEST:" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)"
}

Write-Host ""
Write-Host "======================================================="
Write-Host "RESUMEN:" -ForegroundColor Cyan
Write-Host "- Si ves EMAIL ENVIADO EXITOSAMENTE -> Revisa tu email"
Write-Host "- Si ves error de credenciales -> Regenera App Password en Gmail"
Write-Host "- Si persiste -> Verifica que la cuenta tenga 2FA activado"
Write-Host "=======================================================" 