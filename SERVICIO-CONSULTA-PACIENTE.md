# Servicio Web: Consulta Datos Paciente

## Descripción
El servicio `consultaDatosPaciente` permite consultar información de pacientes desde Google Sheets utilizando el número telefónico como criterio de búsqueda.

## Endpoint
```
GET /api/consulta-datos-paciente
```

## Parámetros

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `telefono` | string | Sí | Número telefónico del paciente a buscar |

## Formato de Respuesta

### Respuesta Exitosa
```json
{
  "success": true,
  "message": "✅ Se encontró 1 registro para el teléfono 5551234567",
  "data": [
    {
      "nombreCompleto": "Juan Pérez García",
      "correoElectronico": "juan.perez@gmail.com",
      "telefono": "5551234567",
      "fechaUltimaRegistro": "2025-12-01 10:30:00"
    }
  ],
  "totalRegistros": 1
}
```

### Sin Resultados
```json
{
  "success": false,
  "message": "❌ No se encontraron registros para el número de teléfono: 5551234567",
  "data": []
}
```

### Error de Validación
```json
{
  "success": false,
  "message": "⚠️ Error: Se requiere el parámetro \"telefono\" para realizar la búsqueda.",
  "data": []
}
```

## Ejemplos de Uso

### 1. Consulta Básica
```bash
curl -X GET "http://localhost:3000/api/consulta-datos-paciente?telefono=5551234567"
```

### 2. Consulta con Formato Internacional
```bash
curl -X GET "http://localhost:3000/api/consulta-datos-paciente?telefono=%2B52-555-123-4567"
```

### 3. Consulta con Espacios y Guiones
```bash
curl -X GET "http://localhost:3000/api/consulta-datos-paciente?telefono=555-123-4567"
```

## Características Implementadas

### ✅ Búsqueda Inteligente
- **Normalización automática**: Quita espacios, guiones, paréntesis y puntos del número
- **Búsqueda flexible**: Permite coincidencias parciales si un número contiene al otro
- **Validación**: Mínimo 8 dígitos para considerar un número válido

### ✅ Deduplicación Inteligente
Cuando hay múltiples registros con el mismo número telefónico:
1. **Prioriza registros con nombre completo** (al menos 2 palabras)
2. **Selecciona el más reciente** por fecha de registro
3. **Agrupa por número normalizado** para evitar duplicados por formato

### ✅ Datos de Respuesta
- **nombreCompleto**: Nombre completo del paciente
- **correoElectronico**: Email del paciente  
- **telefono**: Número telefónico original
- **fechaUltimaRegistro**: Fecha del último registro

### ✅ Validaciones y Manejo de Errores
- Validación de parámetros requeridos
- Validación de formato de teléfono
- Manejo de errores de conexión a Google Sheets
- Filtrado de registros sin datos relevantes
- Respuestas estructuradas y descriptivas

## Casos de Uso

### Caso 1: Paciente Nuevo
Si no se encuentra el número en la base de datos, el sistema devuelve:
```json
{
  "success": false,
  "message": "❌ No se encontraron registros para el número de teléfono: 5551234567",
  "data": []
}
```

### Caso 2: Múltiples Registros del Mismo Paciente
Si hay varios registros con el mismo teléfono, el sistema:
1. Selecciona el que tenga nombre más completo
2. En caso de empate, toma el más reciente
3. Devuelve solo un registro por número telefónico

### Caso 3: Registros Incompletos
Si encuentra registros pero no tienen nombre ni email:
```json
{
  "success": false,
  "message": "⚠️ Se encontraron registros para el teléfono 5551234567, pero no contienen nombre completo ni correo electrónico.",
  "data": []
}
```

## Configuración Requerida

### Variables de Entorno
Asegúrate de tener configuradas las siguientes variables:
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_PROJECT_ID`
- `SHEET_ID`

### Permisos en Google Sheets
La cuenta de servicio debe tener permisos de **Lector** en el Google Sheet que contiene los datos de clientes.

## Estructura de la Hoja CLIENTES

El servicio busca en la hoja con nombre `CLIENTES` que debe tener las siguientes columnas:

| Columna | Índice | Descripción |
|---------|---------|-------------|
| FECHA_REGISTRO | 0 | Fecha de registro del cliente |
| CODIGO_RESERVA | 1 | Código único de la cita |
| NOMBRE_CLIENTE | 2 | Nombre completo del paciente |
| TELEFONO | 3 | Número telefónico |
| EMAIL | 4 | Correo electrónico |
| ESPECIALISTA | 5 | Nombre del especialista |
| FECHA_CITA | 6 | Fecha de la cita |
| HORA_CITA | 7 | Hora de la cita |
| SERVICIO | 8 | Tipo de servicio |
| ESTADO | 9 | Estado de la cita |

## Notas Importantes

1. **No hardcodea información**: Todos los datos se obtienen dinámicamente desde Google Sheets
2. **Búsqueda optimizada**: Usa normalización para mejorar las coincidencias
3. **Respuesta limpia**: Solo devuelve nombre completo y correo electrónico como solicitado
4. **Manejo robusto de errores**: Proporciona mensajes descriptivos para facilitar el debugging
5. **Documentación Swagger**: Disponible en `/api-docs` para pruebas interactivas

## Testing

### Probar desde Swagger UI
1. Ve a `http://localhost:3000/api-docs`
2. Busca el endpoint "Consultar datos de paciente por número telefónico"
3. Haz clic en "Try it out"
4. Ingresa un número de teléfono
5. Ejecuta la consulta

### Probar desde Postman
```
GET http://localhost:3000/api/consulta-datos-paciente?telefono=5551234567
```

¡El servicio está listo para usar! 🚀 