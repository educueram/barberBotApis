# 🚀 SOLUCIÓN: Error "Failed to fetch" en Railway

## 🎯 Problema
Al desplegar en Railway aparece el error:
```
Failed to fetch. 
Possible Reasons:
- CORS
- Network Failure  
- URL scheme must be "http" or "https" for CORS request
```

## ✅ SOLUCIÓN APLICADA

### 1. **Configuración de Swagger Automática**
- ✅ Detecta automáticamente la URL de Railway
- ✅ Funciona en desarrollo local y producción

### 2. **CORS Mejorado**  
- ✅ Configuración específica para Railway
- ✅ Permite dominios `*.railway.app`

### 3. **Health Checks**
- ✅ `GET /health` - Verificar estado del servidor
- ✅ `GET /` - Información de la API

## 🔧 PASOS OBLIGATORIOS EN RAILWAY

### **PASO 1: Variables de Entorno**
En tu proyecto de Railway, Tab "Variables", agrega:

```env
NODE_ENV=production
GOOGLE_CLIENT_EMAIL=tu-cuenta@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nTU_CLAVE...\n-----END PRIVATE KEY-----
GOOGLE_PROJECT_ID=tu-proyecto-id
GOOGLE_SHEET_ID=1zQpN_1MAQVx6DrYwbL8zK49Wv5xu4eDlGqTjKl9d-JU
```

⚠️ **CRÍTICO**: `GOOGLE_PRIVATE_KEY` debe tener `\n` para saltos de línea

### **PASO 2: Redesplegar**
Después de configurar las variables:
1. Ir a "Deployments" 
2. Click "Deploy" o hacer un nuevo commit

### **PASO 3: Verificar**
Una vez desplegado, probar:
- ✅ `https://tu-app.railway.app/health`
- ✅ `https://tu-app.railway.app/api-docs`
- ✅ `https://tu-app.railway.app/api/consulta-fecha-actual`

## 🐛 Si Persiste el Error

### **Opción 1: URL Manual**
Si Railway no detecta la URL automáticamente:

1. Ve a Railway → Settings → Domains
2. Copia tu URL (ejemplo: `my-app.railway.app`)
3. Actualiza esta línea en `index.js`:

```javascript
// Línea ~1113 aprox
url: process.env.NODE_ENV === 'production' 
  ? `https://MY-APP.railway.app`  // ← CAMBIAR AQUÍ
  : `http://localhost:${PORT}`,
```

### **Opción 2: CORS Específico**
Actualiza CORS con tu dominio exacto:

```javascript
// Línea ~17 aprox  
origin: process.env.NODE_ENV === 'production' 
  ? ['https://MY-APP.railway.app']  // ← CAMBIAR AQUÍ
  : ['http://localhost:3000'],
```

## 📱 Resultado Final

Una vez configurado correctamente:
- ✅ Swagger UI funcional en Railway
- ✅ Todos los endpoints operativos  
- ✅ Google APIs configuradas
- ✅ CORS resuelto

## 🆘 Ayuda Adicional

Si necesitas ayuda:
1. Comparte la URL de tu Railway
2. Comparte los logs de Railway (Tab "Logs")  
3. Confirma que las variables de entorno están configuradas 