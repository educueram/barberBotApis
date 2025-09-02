# 📧 SOLUCIÓN: Emails no llegan a goparirisvaleria@gmail.com

## 🎯 **PROBLEMA IDENTIFICADO:**
El sistema intenta enviar emails pero Gmail rechaza las credenciales:
```
❌ Error enviando email: Invalid login: 535-5.7.8 Username and Password not accepted
```

## ✅ **CAUSA:**
Las variables de entorno SMTP no están configuradas o son incorrectas.

## 🔧 **SOLUCIÓN:**

### **PASO 1: Configurar App Password en Gmail**

1. **Ir a Google Account**: https://myaccount.google.com
2. **Seguridad** → **Verificación en 2 pasos** (debe estar activada)
3. **Contraseñas de aplicaciones** → **Generar nueva**
4. **Seleccionar**: "Correo" o "Otra (nombre personalizado)"
5. **Copiar** la contraseña de 16 caracteres (ej: `abcd efgh ijkl mnop`)

### **PASO 2: Configurar Variables en Railway**

Ve a tu proyecto en Railway → Tab "Variables" → Agregar:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=goparirisvaleria@gmail.com
SMTP_PASS=abcdefghijklmnop
```

⚠️ **IMPORTANTE**: 
- `SMTP_PASS` debe ser la contraseña de 16 caracteres SIN ESPACIOS
- NO uses la contraseña normal de Gmail
- La contraseña de aplicación es diferente y más segura

### **PASO 3: Verificar Configuración Local (.env)**

Si pruebas localmente, crear/editar `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=goparirisvaleria@gmail.com
SMTP_PASS=abcdefghijklmnop
```

### **PASO 4: Reiniciar Servidor**

- **Local**: Reinicia `npm start`
- **Railway**: Se redespliega automáticamente al cambiar variables

## 🧪 **VERIFICACIÓN:**

Al agendar una cita, los logs mostrarán:

**✅ ÉXITO:**
```
✅ Email enviado exitosamente: <message-id>
```

**❌ FALLO:**
```
⚠️ SMTP_PASS vacío - necesitas configurar App Password de Gmail
```

## 📧 **EMAIL INCLUYE:**

- ✅ Detalles completos de la cita
- ✅ Código de reserva destacado  
- ✅ Información de contacto de la clínica
- ✅ Instrucciones importantes
- ✅ HTML profesional y responsive

## 🚨 **ERRORES COMUNES:**

### Error: "Username and Password not accepted"
**Causa**: Contraseña incorrecta o usando contraseña normal
**Solución**: Generar nueva App Password

### Error: "SMTP_PASS no configurado"
**Causa**: Variable vacía o no definida
**Solución**: Configurar variable con App Password

### Error: "Gmail is not available"
**Causa**: Verificación en 2 pasos no activada
**Solución**: Activar 2FA en cuenta de Gmail

## 🎯 **RESULTADO FINAL:**
Una vez configurado correctamente:
- ✅ Emails automáticos funcionando
- ✅ Confirmaciones profesionales enviadas
- ✅ Cliente recibe código de reserva por email
- ✅ Información completa de la cita incluida 