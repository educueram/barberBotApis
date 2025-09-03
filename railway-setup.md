# 🚀 Configuración de Railway para ValGop API

## Variables de Entorno Requeridas

### 🔧 Variables de Sistema
```bash
NODE_ENV=production
PORT=3000
TIMEZONE=America/Mexico_City
```

### 🕐 Variables de Horarios de Trabajo (NUEVAS - IMPORTANTES)
```bash
# Forzar horarios fijos (recomendado para producción)
FORCE_FIXED_SCHEDULE=true

# Horarios de trabajo
WORKING_START_HOUR=9        # 9 AM
WORKING_END_HOUR=19         # 7 PM
LUNCH_START_HOUR=14         # 2 PM
LUNCH_END_HOUR=15          # 3 PM
SLOT_INTERVAL_MINUTES=60   # 1 hora por slot
```

### 🗂️ Variables de Google APIs
```bash
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n[tu-clave-privada]\n-----END PRIVATE KEY-----"
GOOGLE_CLIENT_EMAIL="tu-cuenta-de-servicio@proyecto.iam.gserviceaccount.com"
GOOGLE_PROJECT_ID="tu-proyecto-id"
GOOGLE_SHEET_ID="1zQpN_1MAQVx6DrYwbL8zK49Wv5xu4eDlGqTjKl9d-JU"
```

### 📧 Variables de Email (SMTP)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=goparirisvaleria@gmail.com
SMTP_PASS=tu-app-password-de-16-caracteres
```

### 🏢 Variables del Negocio
```bash
BUSINESS_EMAIL=goparirisvaleria@gmail.com
BUSINESS_NAME="Clinica ValGop"
BUSINESS_PHONE="+52 5555555555"
BUSINESS_ADDRESS="CDMX, México"
```

## 🔧 Configuración Paso a Paso

1. **Ve a tu proyecto en Railway**
2. **Clickea en Variables**
3. **Agrega todas las variables de arriba**
4. **Redeploya el proyecto**

## ⚠️ Variables Críticas para Horarios

Las siguientes variables son **ESENCIALES** para que los horarios funcionen correctamente:

- `FORCE_FIXED_SCHEDULE=true` - Fuerza el uso de horarios fijos
- `WORKING_START_HOUR=9` - Hora de inicio (9 AM)
- `WORKING_END_HOUR=19` - Hora de fin (7 PM)  
- `LUNCH_START_HOUR=14` - Inicio de comida (2 PM)
- `LUNCH_END_HOUR=15` - Fin de comida (3 PM)
- `TIMEZONE=America/Mexico_City` - Zona horaria correcta

## 🧪 Validación

Después de agregar las variables:

1. Ve a: `https://tu-app.railway.app/api/consulta-disponibilidad?calendar=1&service=1&date=2025-09-04`
2. Verifica que los horarios sean: **9:00, 10:00, 11:00, 12:00, 13:00, 15:00, 16:00, 17:00, 18:00**
3. NO debe aparecer: horarios antes de 9:00, después de 19:00, o entre 14:00-15:00

## 🚨 Problemas Comunes

### Si ves horarios incorrectos (03:00, 04:00, etc.):
- ✅ Agrega `FORCE_FIXED_SCHEDULE=true`
- ✅ Agrega `TIMEZONE=America/Mexico_City`
- ✅ Redeploya

### Si no se excluye horario de comida:
- ✅ Agrega `LUNCH_START_HOUR=14` y `LUNCH_END_HOUR=15`
- ✅ Redeploya

### Si los intervalos son de 30 min:
- ✅ Agrega `SLOT_INTERVAL_MINUTES=60`
- ✅ Redeploya 