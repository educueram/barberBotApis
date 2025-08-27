# ValGop API - Sistema de Gestión de Citas

API migrada de Google Apps Script a Node.js para gestión de citas médicas con WhatsApp Bot integration.

## 🚀 Características

- **ConsultaDisponibilidad**: Consulta horarios disponibles con análisis de 3 días y estadísticas
- **AgendaCita**: Agenda nuevas citas con validaciones completas y generación de código de reserva
- **CancelaCita**: Cancela citas existentes por código de reserva  
- **ConsultaFechaActual**: Obtiene fecha y hora actual del sistema
- **Documentación Swagger**: Interfaz interactiva para probar los endpoints

## 📋 Requisitos Previos

- Node.js 16+ 
- npm o yarn
- Cuenta de Google Cloud Platform (para APIs)
- Google Sheet configurado con las hojas: CALENDARIOS, HORARIOS, SERVICIOS, CLIENTES

## ⚙️ Instalación

1. Clonar el repositorio:
```bash
git clone <repository-url>
cd ValGop
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

4. Iniciar el servidor:
```bash
# Desarrollo
npm run dev

# Producción  
npm start
```

## 🌐 Endpoints

### 1. Consulta Disponibilidad
```http
GET /api/consulta-disponibilidad?calendar=1&service=1&date=2025-08-26
```

**Parámetros:**
- `calendar`: Número identificador del calendario
- `service`: Número identificador del servicio  
- `date`: Fecha en formato YYYY-MM-DD

**Respuesta ejemplo:**
```json
{
  "respuesta": "🔥 ¡3 días con disponibilidad encontrada!...",
  "metadata": {
    "totalDays": 3,
    "totalSlots": 8,
    "averageOccupation": 65,
    "dateMapping": {...},
    "recommendations": {...}
  }
}
```

### 2. Agenda Cita
```http
POST /api/agenda-cita
Content-Type: application/json

{
  "action": "schedule",
  "date": "2025-08-27",
  "time": "14:00", 
  "calendar": "1",
  "service": "1",
  "serviceName": "Consulta de valoración",
  "clientName": "Juan Pérez",
  "clientPhone": "5551234567",
  "clientEmail": "juan.perez@ejemplo.com"
}
```

**Parámetros obligatorios:**
- `action`: Debe ser "schedule"
- `date`: Fecha de la cita en formato YYYY-MM-DD
- `time`: Hora de la cita en formato HH:MM (24h)
- `calendar`: Número identificador del calendario
- `service`: Número identificador del servicio
- `clientName`: Nombre del cliente
- `clientPhone`: Teléfono del cliente (mínimo 10 dígitos)
- `clientEmail`: Email del cliente (formato válido)

**Parámetros opcionales:**
- `serviceName`: Nombre descriptivo del servicio

**Validaciones implementadas:**
- ✅ Campos obligatorios completos
- ✅ Formato de email válido (regex)
- ✅ Teléfono mínimo 10 caracteres
- ✅ Tiempo mínimo 1 hora de anticipación
- ✅ Verificación de conflictos en calendario
- ✅ Validación de calendario y servicio existente

**Respuesta exitosa:**
```json
{
  "respuesta": "✅ ¡Cita confirmada! ✨\n\nDetalles de tu cita:\n📅 Fecha: 2025-08-27\n⏰ Hora: 2:00 PM\n👨‍⚕️ Especialista: Dr. Juan\n\n🎟️ TU CÓDIGO DE RESERVA ES: ABC123\n\n¡Gracias por confiar en nosotros! 🌟",
  "id_cita": "ABC123"
}
```

**Respuesta de error (validación):**
```json
{
  "respuesta": "⚠️ Error: Faltan o son inválidos los siguientes datos obligatorios:\n\n❌ clientEmail\n❌ clientPhone\n\nEl bot debe recopilar TODOS los datos antes de enviar la solicitud."
}
```

**Respuesta de error (conflicto):**
```json
{
  "respuesta": "❌ ¡Demasiado tarde! El horario de las 2:00 PM ya fue reservado."
}
```

### 3. Cancela Cita  
```http
POST /api/cancela-cita
Content-Type: application/json

{
  "action": "cancel",
  "calendar": "1", 
  "eventId": "ABC123"
}
```

**Respuesta ejemplo:**
```json
{
  "respuesta": "✅ La cita con código de reserva ABC123 ha sido cancelada exitosamente."
}
```

### 4. Consulta Fecha Actual
```http
GET /api/consulta-fecha-actual
```

**Respuesta ejemplo:**
```json
{
  "fechaHora": "martes, 26 de agosto de 2025, 17:25:48 GMT-5",
  "timestamp": 1756247148133,
  "isoString": "2025-08-26T22:25:48.133Z"
}
```

## 📚 Documentación Swagger

Accede a la documentación interactiva en:
```
http://localhost:3000/api-docs
```

## 🔧 Configuración

### Google Sheets Setup

El sistema requiere un Google Sheet con las siguientes hojas:

#### CALENDARIOS
| Número | Calendar ID | Especialista |
|--------|-------------|--------------|
| 1 | calendario1@gmail.com | Dr. García |
| 2 | calendario2@gmail.com | Dra. López |

#### SERVICIOS  
| Número | Duración (min) |
|--------|----------------|
| 1 | 30 |
| 2 | 45 |

#### HORARIOS
| Calendar | Día | Hora Inicio | Hora Fin |
|----------|-----|-------------|----------|
| 1 | 1 | 9 | 17 |
| 1 | 2 | 9 | 17 |

#### CLIENTES (se crea automáticamente)
| FECHA_REGISTRO | CODIGO_RESERVA | NOMBRE_CLIENTE | ... |
|----------------|----------------|----------------|-----|
| Auto | Auto | Auto | ... |

### Configuración de APIs de Google

1. Crear proyecto en Google Cloud Console
2. Habilitar APIs:
   - Google Sheets API
   - Google Calendar API
3. Crear credenciales de cuenta de servicio
4. Compartir Google Sheet con el email de la cuenta de servicio

## 🏗️ Migración desde Google Apps Script

Esta API mantiene la lógica de negocio original pero migrada a Node.js:

**Cambios principales:**
- ✅ SpreadsheetApp → Google Sheets API
- ✅ CalendarApp → Google Calendar API  
- ✅ MailApp → Nodemailer
- ✅ Logger → console.log
- ✅ ContentService → Express responses
- ✅ Utilities.formatDate → moment-timezone

**Funcionalidades preservadas:**
- ✅ Sistema de 3 días con estadísticas
- ✅ Validaciones de datos estrictas
- ✅ Emails de confirmación  
- ✅ Códigos de reserva únicos
- ✅ Formato de respuestas con emojis
- ✅ Manejo de conflictos de horarios

## 🔍 Testing

Probar los endpoints usando:

1. **Swagger UI**: `http://localhost:3000/api-docs`
2. **cURL**:
```bash
# Consultar disponibilidad
curl "http://localhost:3000/api/consulta-disponibilidad?calendar=1&service=1&date=2025-08-26"

# Cancelar cita
curl -X POST http://localhost:3000/api/cancela-cita \
  -H "Content-Type: application/json" \
  -d '{"action":"cancel","calendar":"1","eventId":"ABC123"}'

# Fecha actual  
curl "http://localhost:3000/api/consulta-fecha-actual"
```

## 📦 Estructura del Proyecto

```
ValGop/
├── index.js              # Aplicación principal
├── package.json          # Dependencias 
├── README.md            # Esta documentación
├── codigoValeGopar.js   # Código original (referencia)
└── .env                 # Variables de entorno (crear)
```

## 🚨 Notas Importantes

- **Simulación**: Actualmente usa datos mock. Para producción, implementar conexiones reales a Google APIs
- **Autenticación**: Configurar credenciales de Google Cloud Platform
- **Rate Limiting**: Considerar implementar limitación de requests
- **Logging**: Implementar sistema de logs estructurados
- **Error Handling**: Mejorar manejo de errores para casos específicos

## 📞 Soporte

Para soporte contactar: goparirisvaleria@gmail.com 