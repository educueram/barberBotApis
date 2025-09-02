# 🚀 Configuración de Railway para ValGop API

## 📋 Variables de Entorno Requeridas

Configura estas variables en tu proyecto de Railway:

### 🔧 Configuración Básica
```env
NODE_ENV=production
PORT=3000
```

### 📊 Google APIs (OBLIGATORIAS)
```env
GOOGLE_CLIENT_EMAIL=tu-cuenta-servicio@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nTU_CLAVE_PRIVADA_AQUI\n-----END PRIVATE KEY-----
GOOGLE_PROJECT_ID=tu-proyecto-123456
GOOGLE_SHEET_ID=1zQpN_1MAQVx6DrYwbL8zK49Wv5xu4eDlGqTjKl9d-JU
```

### ⚠️ **IMPORTANTE - Google Private Key**
La clave privada debe incluir `\n` para los saltos de línea:
```
-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----
```

### 🌍 Configuración del Negocio (Opcional)
```env
BUSINESS_EMAIL=goparirisvaleria@gmail.com
BUSINESS_NAME=Clinica ValGop
BUSINESS_PHONE=+52 5555555555
BUSINESS_ADDRESS=CDMX, México
TIMEZONE=America/Mexico_City
```

### 📧 Email SMTP (Para confirmaciones automáticas)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=goparirisvaleria@gmail.com
SMTP_PASS=tu-app-password-de-16-caracteres
```

⚠️ **IMPORTANTE - Gmail App Password**:
1. Ve a [myaccount.google.com](https://myaccount.google.com)
2. Seguridad → Verificación en 2 pasos (debe estar activada)
3. Contraseñas de aplicaciones → Generar nueva
4. Usa esa contraseña de 16 caracteres como `SMTP_PASS`

**📧 Email automático incluye:**
- ✅ Confirmación HTML con todos los detalles
- ✅ Código de reserva destacado
- ✅ Información de contacto del negocio
- ✅ Instrucciones importantes para el cliente

## 🔧 Pasos de Configuración

### 1. **Deploy en Railway**
```bash
# Conecta tu repositorio a Railway
# Railway detectará automáticamente que es Node.js
```

### 2. **Configurar Variables de Entorno**
- Ve a tu proyecto en Railway
- Tab "Variables"
- Agrega TODAS las variables listadas arriba
- **IMPORTANTE**: `GOOGLE_PRIVATE_KEY` con `\n` para saltos de línea

### 3. **Configurar Dominio Personalizado (Opcional)**
- Tab "Settings" → "Domains"
- Agrega tu dominio personalizado
- Actualiza la configuración de CORS en `index.js` si usas dominio personalizado

### 4. **Verificar Despliegue**
Después del deploy, verifica:
- ✅ `https://tu-app.railway.app/api/consulta-fecha-actual`
- ✅ `https://tu-app.railway.app/api-docs` (Swagger UI)

## 🐛 Solución de Errores Comunes

### Error: "Failed to fetch" en Swagger
**Causa**: CORS o URL incorrecta
**Solución**: 
1. Verifica que `NODE_ENV=production` esté configurado
2. Reemplaza `your-app.railway.app` con tu URL real en el código

### Error: "Google APIs permission denied"
**Causa**: Credenciales incorrectas o permisos faltantes
**Solución**:
1. Verifica las variables `GOOGLE_*` en Railway
2. Asegúrate de que la cuenta de servicio tenga permisos en el Google Sheet

### Error: "Sheet not found"
**Causa**: `GOOGLE_SHEET_ID` incorrecto
**Solución**: Verifica el ID del Google Sheet

### Error: "Username and Password not accepted" (Email)
**Causa**: SMTP credentials inválidos para Gmail
**Solución**:
1. Ve a https://myaccount.google.com → Seguridad
2. Activa Verificación en 2 pasos
3. Genera App Password para "Mail"
4. Configura `SMTP_PASS` con la contraseña de 16 caracteres

## 📱 Endpoints Disponibles en Producción

Una vez desplegado:
- `GET /api/consulta-disponibilidad`
- `POST /api/agenda-cita`
- `POST /api/cancela-cita`
- `GET /api/consulta-fecha-actual`
- `GET /api-docs` (Documentación Swagger)

## 🔍 Debug en Producción

Para debugear problemas:
- `POST /api/debug-agenda`
- `POST /api/debug-sheets`

Revisa los logs en Railway Dashboard → "Logs" 