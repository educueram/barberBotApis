Write-Host "Probando email..." -ForegroundColor Green

$body = '{"email":"goparirisvaleria@gmail.com"}'

try {
    Write-Host "Enviando request..."
    
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/test-email" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 15
    
    Write-Host "RESPUESTA:"
    Write-Host "Success: $($response.success)"
    Write-Host "Message: $($response.message)"
    
    if ($response.error) {
        Write-Host "Error: $($response.error)" -ForegroundColor Red
    }
    
    if ($response.details) {
        Write-Host "Details: $($response.details)"
    }
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Test completado." 