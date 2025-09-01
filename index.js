const express = require('express');
const cors = require('cors');
const moment = require('moment-timezone');

// Configurar moment en español
moment.locale('es');
const swaggerUi = require('swagger-ui-express');

// Importar configuración y servicios
const config = require('./config');
const { initializeAuth, getCalendarInstance } = require('./services/googleAuth');
const { getSheetData, findData, findWorkingHours, updateClientStatus, getClientDataByReservationCode, saveClientDataOriginal, ensureClientsSheet } = require('./services/googleSheets');
const { findAvailableSlots, cancelEventByReservationCodeOriginal, createEventOriginal, formatTimeTo12Hour } = require('./services/googleCalendar');
const { sendAppointmentConfirmation, emailServiceReady } = require('./services/emailService');

const app = express();
const PORT = config.server.port;

// Middlewares
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-app.railway.app', /railway\.app$/] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =================================================================
// 🔧 INICIALIZACIÓN DE GOOGLE APIS
// =================================================================

// Inicializar autenticación al arrancar la aplicación
try {
  initializeAuth();
  console.log('🔧 Google APIs inicializadas correctamente');
} catch (error) {
  console.error('❌ Error inicializando Google APIs:', error.message);
  console.log('⚠️ La aplicación continuará con datos simulados para desarrollo');
}

// =================================================================
// 🛠️ FUNCIONES AUXILIARES MIGRADAS
// =================================================================

function createJsonResponse(data) {
  return data;
}

function formatTime(date) {
  return moment(date).tz(config.timezone.default).format('HH:mm');
}



function formatDateToSpanishPremium(date) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(today.getDate() + 2);
  
  const normalizeDate = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const targetNormalized = normalizeDate(date);
  const todayNormalized = normalizeDate(today);
  const tomorrowNormalized = normalizeDate(tomorrow);
  const yesterdayNormalized = normalizeDate(yesterday);
  const dayAfterTomorrowNormalized = normalizeDate(dayAfterTomorrow);
  
  if (targetNormalized.getTime() === todayNormalized.getTime()) {
    return "HOY";
  } else if (targetNormalized.getTime() === tomorrowNormalized.getTime()) {
    return "MAÑANA";
  } else if (targetNormalized.getTime() === yesterdayNormalized.getTime()) {
    return "HOY MISMO";
  } else if (targetNormalized.getTime() === dayAfterTomorrowNormalized.getTime()) {
    return "PASADO MAÑANA";
  } else {
    const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
    const dayNumber = date.getDate();
    const monthName = date.toLocaleDateString('es-ES', { month: 'long' });
    return `${dayName} ${dayNumber} de ${monthName}`;
  }
}

function getLetterEmoji(index) {
  const letterEmojis = [
    'Ⓐ', 'Ⓑ', 'Ⓒ', 'Ⓓ', 'Ⓔ', 'Ⓕ', 'Ⓖ', 'Ⓗ', 'Ⓘ', 'Ⓙ',
    'Ⓚ', 'Ⓛ', 'Ⓜ', 'Ⓝ', 'Ⓞ', 'Ⓟ', 'Ⓠ', 'Ⓡ', 'Ⓢ', 'Ⓣ',
    'Ⓤ', 'Ⓥ', 'Ⓦ', 'Ⓧ', 'Ⓨ', 'Ⓩ'
  ];
  
  return letterEmojis[index] || `${index + 1}️⃣`;
}

function getOccupationEmoji(percentage) {
  if (percentage >= 80) return '🔴';
  if (percentage >= 60) return '🟡';
  if (percentage >= 40) return '🟢';
  return '✅';
}

function getUrgencyText(percentage) {
  if (percentage >= 80) return '¡AGENDA YA!';
  if (percentage >= 60) return '¡Reserva pronto!';
  if (percentage >= 40) return '';
  return '¡Gran disponibilidad!';
}

// =================================================================
// 📡 DATOS DE RESPALDO PARA DESARROLLO
// =================================================================

// Datos mock solo para desarrollo cuando no hay credenciales configuradas
const developmentMockData = {
  calendars: [
    ['Número', 'Calendar ID', 'Especialista'],
    ['1', 'calendario1@gmail.com', 'Dr. García'],
    ['2', 'calendario2@gmail.com', 'Dra. López']
  ],
  services: [
    ['Número', 'Duración (min)'],
    ['1', '30'],
    ['2', '45']
  ],
  hours: [
    ['Calendar', 'Día', 'Hora Inicio', 'Hora Fin'],
    ['1', '1', '9', '17'],
    ['1', '2', '9', '17'],
    ['2', '1', '10', '18']
  ]
};

// Función auxiliar para desarrollo sin credenciales
function mockFindAvailableSlots(calendarId, date, durationMinutes, hours) {
  console.log('⚠️ Usando datos simulados - configurar credenciales de Google para producción');
  const availableSlots = [];
  const startHour = hours.start;
  const endHour = hours.end;
  
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      availableSlots.push(timeSlot);
    }
  }
  
  return availableSlots.slice(0, 6);
}

// =================================================================
// 🌐 ENDPOINTS DE LA API
// =================================================================

/**
 * ENDPOINT: Health Check para Railway
 */
app.get('/health', (req, res) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    services: {
      googleAuth: config.google.clientEmail ? 'configured' : 'missing',
      googleSheets: config.business.sheetId ? 'configured' : 'missing'
    },
    version: '1.0.0'
  };
  
  res.status(200).json(healthData);
});

/**
 * ENDPOINT: Root - Información de la API
 */
app.get('/', (req, res) => {
  const serverUrl = getServerUrl();
  res.json({
    message: '🚀 ValGop API - Sistema de Gestión de Citas',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    documentation: `${serverUrl}/api-docs`,
    endpoints: {
      consulta_disponibilidad: `GET ${serverUrl}/api/consulta-disponibilidad`,
      agenda_cita: `POST ${serverUrl}/api/agenda-cita`,
      cancela_cita: `POST ${serverUrl}/api/cancela-cita`,
      consulta_fecha: `GET ${serverUrl}/api/consulta-fecha-actual`
    },
    status: 'operational'
  });
});

/**
 * ENDPOINT 1: ConsultaDisponibilidad (GET)
 * Consulta horarios disponibles con 3 días + estadísticas
 */
app.get('/api/consulta-disponibilidad', async (req, res) => {
  try {
    console.log('🔍 === CONSULTA DISPONIBILIDAD ===');
    const { calendar: calendarNumber, service: serviceNumber, date: targetDateStr } = req.query;

    console.log('Parámetros recibidos:', { calendarNumber, serviceNumber, targetDateStr });

    if (!calendarNumber || !serviceNumber || !targetDateStr) {
      return res.json(createJsonResponse({ 
        respuesta: '⚠️ Error: Faltan parámetros. Se requiere "calendar", "service" y "date".' 
      }));
    }
    
    const targetDate = new Date(targetDateStr + 'T00:00:00');
    if (isNaN(targetDate.getTime())) {
      return res.json(createJsonResponse({ 
        respuesta: '⚠️ Error: Formato de fecha inválido. Por favor, usa el formato YYYY-MM-DD.' 
      }));
    }

    // Obtener datos reales de Google Sheets
    let sheetData;
    try {
      sheetData = await getSheetData();
    } catch (error) {
      console.log('⚠️ Error obteniendo datos reales, usando mock data:', error.message);
      sheetData = developmentMockData;
    }

    const calendarId = findData(calendarNumber, sheetData.calendars, 0, 1);
    if (!calendarId) { 
      console.log(`❌ Calendario no encontrado: ${calendarNumber}`);
      return res.json(createJsonResponse({ 
        respuesta: '🚫 Error: El calendario solicitado no fue encontrado.' 
      })); 
    }

    const serviceDuration = findData(serviceNumber, sheetData.services, 0, 1);
    if (!serviceDuration) { 
      console.log(`❌ Servicio no encontrado: ${serviceNumber}`);
      return res.json(createJsonResponse({ 
        respuesta: '🚫 Error: El servicio solicitado no fue encontrado.' 
      })); 
    }

    console.log(`✅ Calendar ID: ${calendarId}, Service Duration: ${serviceDuration} min`);
    
    // 🆕 CALCULAR 3 DÍAS: ANTERIOR, SOLICITADO, SIGUIENTE
    const previousDate = new Date(targetDate);
    previousDate.setDate(targetDate.getDate() - 1);
    
    const nextDate = new Date(targetDate);
    nextDate.setDate(targetDate.getDate() + 1);
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const daysWithSlots = [];
    
    const datesToCheck = [
      { date: previousDate, label: 'anterior', emoji: '⚡', priority: 1 },
      { date: targetDate, label: 'solicitado', emoji: '📅', priority: 2 },
      { date: nextDate, label: 'siguiente', emoji: '📅', priority: 3 }
    ];
    
    for (const dayInfo of datesToCheck) {
      const dateStr = dayInfo.date.toISOString().split('T')[0];
      
      if (dateStr >= todayStr) {
        const jsDay = dayInfo.date.getDay();
        const sheetDayNumber = (jsDay === 0) ? 7 : jsDay;
        const workingHours = findWorkingHours(calendarNumber, sheetDayNumber, sheetData.hours);

        if (workingHours) {
          console.log(`📅 Procesando día ${dayInfo.label}: ${dateStr}`);
          console.log(`   - Horario de trabajo: ${workingHours.start}:00 - ${workingHours.end}:00`);
          
          const totalSlots = Math.floor((workingHours.end - workingHours.start) * 60 / parseInt(serviceDuration));
          
          let availableSlots;
          try {
            // Intentar usar Google Calendar API real
            availableSlots = await findAvailableSlots(calendarId, dayInfo.date, parseInt(serviceDuration), workingHours);
          } catch (error) {
            console.log(`⚠️ Error consultando calendar real, usando mock: ${error.message}`);
            // Fallback a datos simulados si falla la API real
            availableSlots = mockFindAvailableSlots(calendarId, dayInfo.date, parseInt(serviceDuration), workingHours);
          }
          
          const occupiedSlots = totalSlots - availableSlots.length;
          const occupationPercentage = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;
          
          console.log(`   - Total slots: ${totalSlots}, Disponibles: ${availableSlots.length}, Ocupación: ${occupationPercentage}%`);
          
          if (availableSlots.length > 0) {
            daysWithSlots.push({
              date: dayInfo.date,
              dateStr: dateStr,
              slots: availableSlots,
              label: dayInfo.label,
              emoji: dayInfo.emoji,
              priority: dayInfo.priority,
              stats: {
                totalSlots: totalSlots,
                availableSlots: availableSlots.length,
                occupiedSlots: occupiedSlots,
                occupationPercentage: occupationPercentage
              }
            });
          }
        }
      }
    }
    
    if (daysWithSlots.length === 0) {
      return res.json(createJsonResponse({ 
        respuesta: `😔 No hay horarios disponibles en los 3 días alrededor de ${formatDateToSpanishPremium(targetDate)}.\n\n🔍 Te sugerimos elegir otra fecha con mejor disponibilidad.` 
      }));
    }
    
    daysWithSlots.sort((a, b) => a.priority - b.priority);
    
    let responseText = `🔥 ¡${daysWithSlots.length} ${daysWithSlots.length === 1 ? 'día' : 'días'} con disponibilidad encontrada!\n\n`;
    
    const totalSlotsAvailable = daysWithSlots.reduce((sum, day) => sum + day.stats.availableSlots, 0);
    const avgOccupation = Math.round(daysWithSlots.reduce((sum, day) => sum + day.stats.occupationPercentage, 0) / daysWithSlots.length);
    
    responseText += `📊 *Resumen:* ${totalSlotsAvailable} horarios disponibles • ${avgOccupation}% ocupación promedio\n\n`;
    
    let letterIndex = 0;
    let dateMapping = {};
    
    for (const dayData of daysWithSlots) {
      const dayName = formatDateToSpanishPremium(dayData.date);
      const occupationEmoji = getOccupationEmoji(dayData.stats.occupationPercentage);
      const urgencyText = getUrgencyText(dayData.stats.occupationPercentage);
      
      responseText += `${dayData.emoji} *${dayName.toUpperCase()}* (${dayData.dateStr})\n`;
      responseText += `${occupationEmoji} ${dayData.stats.availableSlots}/${dayData.stats.totalSlots} disponibles • ${dayData.stats.occupationPercentage}% ocupado ${urgencyText}\n\n`;
      
      const formattedSlots = dayData.slots.map((slot) => {
        const letterEmoji = getLetterEmoji(letterIndex);
        const time12h = formatTimeTo12Hour(slot);
        
        dateMapping[String.fromCharCode(65 + letterIndex)] = {
          date: dayData.dateStr,
          time: slot,
          dayName: dayName
        };
        
        letterIndex++;
        return `${letterEmoji} ${time12h}`;
      }).join('\n');
      
      responseText += formattedSlots + '\n\n';
    }
    
    const hasEarlierDay = daysWithSlots.some(day => day.label === 'anterior');
    const hasHighDemandDay = daysWithSlots.some(day => day.stats.occupationPercentage >= 70);
    const hasLowDemandDay = daysWithSlots.some(day => day.stats.occupationPercentage <= 30);
    
    if (hasEarlierDay) {
      responseText += `⚡ *¡Oportunidad!* Hay espacios anteriores disponibles - ¡agenda antes! 💰\n`;
    }
    
    if (hasHighDemandDay) {
      responseText += `🔥 *¡Urgente!* Algunos días tienen alta demanda - ¡reserva rápido!\n`;
    }
    
    if (hasLowDemandDay) {
      responseText += `✨ *¡Perfecto!* Algunos días tienen excelente disponibilidad\n`;
    }
    
    responseText += `\n💡 Escribe la letra del horario que prefieras (A, B, C...) ✨`;
    
    return res.json(createJsonResponse({ 
      respuesta: responseText,
      metadata: {
        totalDays: daysWithSlots.length,
        totalSlots: totalSlotsAvailable,
        averageOccupation: avgOccupation,
        dateMapping: dateMapping,
        recommendations: {
          hasEarlierDay: hasEarlierDay,
          hasHighDemandDay: hasHighDemandDay,
          hasLowDemandDay: hasLowDemandDay
        }
      }
    }));

  } catch (error) {
    console.log(error.stack);
    return res.json(createJsonResponse({ 
      respuesta: '🤖 Ha ocurrido un error inesperado al consultar la disponibilidad.' 
    }));
  }
});

/**
 * ENDPOINT: Cancelar cita (LÓGICA ORIGINAL)
 */
app.post('/api/cancela-cita', async (req, res) => {
  try {
    console.log('🗑️ === INICIO CANCELACIÓN ORIGINAL ===');
    console.log('Body recibido:', JSON.stringify(req.body, null, 2));
    
    const { action, calendar: calendarNumber, eventId: codigoReserva } = req.body;

    // Validar parámetros
    if (!action || action !== 'cancel') {
      return res.json({ respuesta: '⚠️ Error: Se requiere action: "cancel"' });
    }

    if (!calendarNumber || !codigoReserva) {
      return res.json({ respuesta: '⚠️ Error de cancelación: Faltan datos (calendar, eventId).' });
    }

    console.log(`📊 Parámetros: calendar=${calendarNumber}, código=${codigoReserva}`);

    // Obtener datos de configuración
    let sheetData;
    try {
      sheetData = await getSheetData();
      console.log('✅ Configuración obtenida correctamente');
    } catch (error) {
      console.error('❌ Error obteniendo configuración:', error.message);
      return res.json({ respuesta: `❌ Error obteniendo configuración: ${error.message}` });
    }

    // Obtener calendar ID
    const calendarId = findData(calendarNumber, sheetData.calendars, 0, 1);
    if (!calendarId) {
      console.log(`❌ Calendario ${calendarNumber} no encontrado`);
      return res.json({ respuesta: '🚫 Error: El calendario solicitado no fue encontrado.' });
    }

    console.log(`📅 Calendar ID: ${calendarId}`);

    // USAR LÓGICA ORIGINAL: Cancelar por código de evento
    const cancelResult = await cancelEventByReservationCodeOriginal(calendarId, codigoReserva);
    
    if (cancelResult.success) {
      // Actualizar estado en Google Sheets
      try {
        await updateClientStatus(codigoReserva, 'CANCELADA');
        console.log(`✅ Estado actualizado en Google Sheets: ${codigoReserva} -> CANCELADA`);
      } catch (updateError) {
        console.error('❌ Error actualizando Google Sheets:', updateError.message);
        // No fallar la cancelación por este error
      }
      
      console.log('🎉 Cancelación exitosa');
      return res.json({ respuesta: cancelResult.message });
      
    } else {
      console.log('❌ Cancelación fallida');
      return res.json({ respuesta: cancelResult.message });
    }

  } catch (error) {
    console.error('💥 Error en cancelación:', error.message);
    return res.json({ respuesta: '🤖 Ha ocurrido un error inesperado al cancelar la cita.' });
  }
});

/**
 * ENDPOINT DE DEBUG: Verificar datos de una cita específica
 */
app.get('/api/debug-cita/:codigo', async (req, res) => {
  try {
    const codigoReserva = req.params.codigo;
    console.log(`🔍 === DEBUG DE CITA: ${codigoReserva} ===`);
    
    // PASO 1: Verificar datos en Google Sheets
    let clientData = null;
    try {
      clientData = await getClientDataByReservationCode(codigoReserva);
    } catch (error) {
      console.log(`❌ Error obteniendo datos del cliente: ${error.message}`);
    }
    
    let response = `🔍 DEBUG: ${codigoReserva}\n\n`;
    
    if (!clientData) {
      response += `❌ PASO 1: No se encontró el código ${codigoReserva} en Google Sheets\n`;
      response += `   - Verifica que el código exista en la hoja CLIENTES\n`;
      response += `   - Verifica los permisos de la cuenta de servicio\n`;
      return res.json({ respuesta: response });
    }
    
    response += `✅ PASO 1: Código encontrado en Google Sheets\n`;
    response += `   - Cliente: ${clientData.clientName}\n`;
    response += `   - Fecha: ${clientData.date}\n`;
    response += `   - Hora: ${clientData.time}\n`;
    response += `   - Estado: ${clientData.estado}\n\n`;
    
    // PASO 2: Obtener datos del calendario
    let sheetData;
    try {
      sheetData = await getSheetData();
    } catch (error) {
      response += `❌ PASO 2: Error obteniendo configuración: ${error.message}\n`;
      return res.json({ respuesta: response });
    }
    
    const calendarId = findData('1', sheetData.calendars, 0, 1);
    response += `✅ PASO 2: Calendar ID obtenido: ${calendarId}\n\n`;
    
    // PASO 3: Verificar eventos en la fecha específica
    try {
      const calendar = await getCalendarInstance();
      const startOfDay = new Date(clientData.date + 'T00:00:00');
      const endOfDay = new Date(clientData.date + 'T23:59:59');
      
      const eventsResponse = await calendar.events.list({
        calendarId: calendarId,
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });
      
      const events = eventsResponse.data.items || [];
      
      response += `✅ PASO 3: Eventos en ${clientData.date}: ${events.length}\n\n`;
      
      if (events.length > 0) {
        response += `📅 EVENTOS ENCONTRADOS:\n`;
        events.forEach((event, index) => {
          const eventStart = new Date(event.start?.dateTime || event.start?.date);
          const eventTimeStr = `${eventStart.getHours().toString().padStart(2, '0')}:${eventStart.getMinutes().toString().padStart(2, '0')}`;
          response += `   ${index + 1}. ${eventTimeStr}: "${event.summary}"\n`;
        });
        
        // PASO 4: Verificar evento específico en la hora
        const targetHour = parseInt(clientData.time.split(':')[0]);
        const candidateEvents = events.filter(event => {
          const eventStart = new Date(event.start?.dateTime || event.start?.date);
          return eventStart.getHours() === targetHour;
        });
        
        response += `\n🎯 EVENTOS A LAS ${clientData.time}:\n`;
        if (candidateEvents.length > 0) {
          candidateEvents.forEach((event, index) => {
            response += `   ${index + 1}. "${event.summary}"\n`;
          });
          response += `\n✅ RESULTADO: Se puede eliminar el evento\n`;
        } else {
          response += `   ❌ No hay eventos a las ${clientData.time}\n`;
          response += `\n❌ RESULTADO: No se encontró evento para eliminar\n`;
        }
      } else {
        response += `❌ PASO 3: No hay eventos en la fecha ${clientData.date}\n`;
        response += `   - El calendario podría estar vacío\n`;
        response += `   - Verifica el Calendar ID\n`;
        response += `   - Verifica los permisos de la cuenta de servicio\n`;
      }
      
    } catch (error) {
      response += `❌ PASO 3: Error consultando Google Calendar: ${error.message}\n`;
    }
    
    return res.json({ respuesta: response });
    
  } catch (error) {
    console.error('Error en debug:', error.message);
    return res.json({ respuesta: `❌ Error general en debug: ${error.message}` });
  }
});

/**
 * ENDPOINT: Ver todos los eventos de una fecha específica
 */
app.get('/api/eventos/:fecha', async (req, res) => {
  try {
    const fecha = req.params.fecha; // formato: YYYY-MM-DD
    console.log(`📅 Consultando eventos del ${fecha}`);
    
    // Obtener calendar ID
    let sheetData;
    try {
      sheetData = await getSheetData();
    } catch (error) {
      return res.json({ respuesta: `❌ Error obteniendo configuración: ${error.message}` });
    }
    
    const calendarId = findData('1', sheetData.calendars, 0, 1);
    console.log(`📅 Calendar ID: ${calendarId}`);
    
    // Consultar eventos
    const calendar = await getCalendarInstance();
    const startOfDay = new Date(fecha + 'T00:00:00');
    const endOfDay = new Date(fecha + 'T23:59:59');
    
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    const events = response.data.items || [];
    
    let resultado = `📅 EVENTOS DEL ${fecha}\n`;
    resultado += `📊 Calendar: ${calendarId.substring(0, 30)}...\n`;
    resultado += `🔢 Total eventos: ${events.length}\n\n`;
    
    if (events.length > 0) {
      resultado += `📋 LISTA DE EVENTOS:\n`;
      events.forEach((event, index) => {
        const eventStart = new Date(event.start?.dateTime || event.start?.date);
        const hora = eventStart.getHours().toString().padStart(2, '0');
        const minuto = eventStart.getMinutes().toString().padStart(2, '0');
        const horaStr = `${hora}:${minuto}`;
        
        resultado += `\n${index + 1}. ${horaStr} - "${event.summary}"\n`;
        resultado += `   ID: ${event.id.substring(0, 20)}...\n`;
        resultado += `   Creador: ${event.creator?.email || 'Desconocido'}\n`;
        if (event.description) {
          resultado += `   Desc: ${event.description.substring(0, 50)}...\n`;
        }
      });
      
      // Buscar específicamente eventos a las 18:00
      const eventosA18 = events.filter(event => {
        const eventStart = new Date(event.start?.dateTime || event.start?.date);
        return eventStart.getHours() === 18;
      });
      
      resultado += `\n🎯 EVENTOS A LAS 18:00: ${eventosA18.length}\n`;
      eventosA18.forEach(event => {
        resultado += `   - "${event.summary}"\n`;
      });
      
    } else {
      resultado += `❌ NO HAY EVENTOS en esta fecha\n`;
      resultado += `\nPosibles causas:\n`;
      resultado += `- El Calendar ID no es correcto\n`;
      resultado += `- Los permisos no permiten ver eventos\n`;
      resultado += `- No hay eventos creados en esta fecha\n`;
    }
    
    // Formatear respuesta con datos estructurados también
    const eventosFormateados = events.map(event => ({
      id: event.id,
      summary: event.summary,
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      creator: event.creator?.email
    }));
    
    return res.json({ 
      respuesta: resultado,
      eventos: eventosFormateados,
      total: events.length,
      fecha: fecha,
      calendarId: calendarId
    });
    
  } catch (error) {
    console.error('Error consultando eventos:', error.message);
    return res.json({ respuesta: `❌ Error: ${error.message}` });
  }
});

/**
 * ENDPOINT 3: ConsultaFechaActual (GET)
 * Obtiene la fecha y hora actual del sistema
 */
app.get('/api/consulta-fecha-actual', (req, res) => {
  try {
    console.log('🕒 === CONSULTA FECHA ACTUAL ===');
    const now = moment().tz(config.timezone.default);
    
    const response = {
      fechaHora: now.format('dddd, DD [de] MMMM [de] YYYY, HH:mm:ss [GMT]Z'),
      timestamp: now.valueOf(),
      isoString: now.toISOString()
    };
    
    console.log('✅ Fecha actual:', response.fechaHora);
    return res.json(response);
    
  } catch (error) {
    console.error('❌ Error obteniendo fecha actual:', error.toString());
    return res.json(createJsonResponse({ 
      respuesta: '🤖 Error al obtener la fecha actual.' 
    }));
  }
});

/**
 * ENDPOINT: Agendar cita (LÓGICA ORIGINAL)
 * Migrado desde handleSchedule del código de Google Apps Script
 */
app.post('/api/agenda-cita', async (req, res) => {
  try {
    console.log('📝 === INICIO AGENDAMIENTO ORIGINAL ===');
    console.log('Body recibido:', JSON.stringify(req.body, null, 2));
    console.log('Timestamp:', new Date().toISOString());

    const { 
      action, 
      calendar: calendarNumber, 
      service: serviceNumber, 
      serviceName: serviceNameFromBot, 
      date, 
      time, 
      clientName, 
      clientEmail, 
      clientPhone 
    } = req.body;

    // PASO 1: VALIDACIONES ULTRA-ESTRICTAS (lógica original)
    console.log('=== VALIDACIÓN DE CAMPOS INDIVIDUALES ===');
    console.log(`action: "${action}" (válido: ${action === 'schedule' ? '✅' : '❌'})`);
    console.log(`calendarNumber: "${calendarNumber}" (válido: ${calendarNumber ? '✅' : '❌'})`);
    console.log(`serviceNumber: "${serviceNumber}" (válido: ${serviceNumber ? '✅' : '❌'})`);
    console.log(`date: "${date}" (válido: ${date ? '✅' : '❌'})`);
    console.log(`time: "${time}" (válido: ${time ? '✅' : '❌'})`);
    console.log(`clientName: "${clientName}" (válido: ${clientName ? '✅' : '❌'})`);
    console.log(`clientEmail: "${clientEmail}" (válido: ${clientEmail && clientEmail !== 'Sin Email' ? '✅' : '❌'})`);
    console.log(`clientPhone: "${clientPhone}" (válido: ${clientPhone && clientPhone !== 'Sin Teléfono' ? '✅' : '❌'})`);

    // Validar action
    if (!action || action !== 'schedule') {
      return res.json({ respuesta: '⚠️ Error: Se requiere action: "schedule"' });
    }

    // Validar campos críticos
    const missingFields = [];
    const invalidFields = [];

    if (!calendarNumber || calendarNumber === '') missingFields.push('calendar');
    if (!serviceNumber || serviceNumber === '') missingFields.push('service');
    if (!date || date === '') missingFields.push('date');
    if (!time || time === '') missingFields.push('time');
    if (!clientName || clientName === '') missingFields.push('clientName');

    // Validación de email (lógica original)
    if (!clientEmail || clientEmail === '' || clientEmail === 'Sin Email') {
      missingFields.push('clientEmail');
      console.log('❌ EMAIL FALTANTE: El bot no envió el email del cliente');
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(clientEmail)) {
        invalidFields.push('clientEmail (formato inválido: ' + clientEmail + ')');
        console.log('❌ EMAIL INVÁLIDO: No cumple con el formato esperado');
      } else {
        console.log('✅ EMAIL VÁLIDO:', clientEmail);
      }
    }

    // Validación de teléfono (lógica original)
    if (!clientPhone || clientPhone === '' || clientPhone === 'Sin Teléfono') {
      missingFields.push('clientPhone');
      console.log('❌ TELÉFONO FALTANTE: El bot no envió el teléfono del cliente');
    } else if (clientPhone.length < 10) {
      invalidFields.push('clientPhone (muy corto: ' + clientPhone + ')');
      console.log('❌ TELÉFONO INVÁLIDO: Muy corto para ser válido');
    } else {
      console.log('✅ TELÉFONO VÁLIDO:', clientPhone);
    }

    // Si hay errores de validación
    if (missingFields.length > 0 || invalidFields.length > 0) {
      console.log('❌ VALIDACIÓN FALLIDA - DETALLES:');
      console.log('   Campos faltantes:', missingFields.join(', '));
      console.log('   Campos inválidos:', invalidFields.join(', '));

      let errorMessage = '⚠️ Error: Faltan o son inválidos los siguientes datos obligatorios:\n\n';
      errorMessage += '❌ ' + missingFields.concat(invalidFields.map(f => f.split(' ')[0])).join('\n❌ ');
      errorMessage += '\n\nEl bot debe recopilar TODOS los datos antes de enviar la solicitud.';

      return res.json({ respuesta: errorMessage });
    }

    console.log('✅ VALIDACIÓN EXITOSA - Todos los campos críticos presentes');

    // PASO 2: VALIDACIÓN DE TIEMPO (lógica original con zona horaria corregida)
    const now = moment().tz(config.timezone.default);
    const startTime = moment.tz(`${date} ${time}`, 'YYYY-MM-DD HH:mm', config.timezone.default);
    const minimumBookingTime = moment(now).add(1, 'hour');

    console.log('=== VALIDACIÓN DE TIEMPO (ZONA HORARIA MÉXICO) ===');
    console.log('now:', now.format('YYYY-MM-DD HH:mm:ss z'));
    console.log('startTime:', startTime.format('YYYY-MM-DD HH:mm:ss z'));
    console.log('minimumBookingTime:', minimumBookingTime.format('YYYY-MM-DD HH:mm:ss z'));

    if (!startTime.isValid()) {
      console.log('❌ ERROR: Formato de fecha/hora inválido');
      return res.json({ respuesta: '⚠️ Error: El formato de fecha o hora es inválido.' });
    }

    const isToday = startTime.isSame(now, 'day');
    console.log('isToday:', isToday);
    console.log('startTime < minimumBookingTime:', startTime.isBefore(minimumBookingTime));
    
    if (isToday && startTime.isBefore(minimumBookingTime)) {
      const time12h = formatTimeTo12Hour(time);
      console.log('❌ ERROR: Cita demasiado pronto (menos de 1 hora)');
      return res.json({ 
        respuesta: `🤚 Debes agendar con al menos una hora de anticipación. No puedes reservar para las ${time12h} de hoy.` 
      });
    }

    // PASO 3: OBTENER CONFIGURACIÓN (lógica original)
    let sheetData;
    try {
      sheetData = await getSheetData();
      console.log('✅ Configuración obtenida correctamente');
    } catch (error) {
      console.error('❌ Error obteniendo configuración:', error.message);
      return res.json({ respuesta: `❌ Error obteniendo configuración: ${error.message}` });
    }

    console.log('=== BÚSQUEDA EN SHEETS ===');
    const calendarId = findData(calendarNumber, sheetData.calendars, 0, 1);
    console.log('calendarId encontrado:', calendarId);
    if (!calendarId) {
      console.log(`❌ ERROR: Calendario no encontrado para número: ${calendarNumber}`);
      return res.json({ respuesta: '🚫 Error: El calendario solicitado no fue encontrado.' });
    }

    const profesionalName = findData(calendarNumber, sheetData.calendars, 0, 2);
    const serviceDuration = findData(serviceNumber, sheetData.services, 0, 1);

    // Obtener nombre del servicio (lógica original)
    let serviceName = serviceNameFromBot;
    if (!serviceName) {
      const serviceMap = {
        1: 'Consulta de valoración',
        2: 'Cita de seguimiento'
      };
      serviceName = serviceMap[serviceNumber] || 'Servicio Desconocido';
      console.log('⚠️ Bot no envió serviceName, usando mapeo backup:', serviceName);
    } else {
      console.log('✅ Bot envió serviceName:', serviceName);
    }

    console.log('profesionalName:', profesionalName);
    console.log('serviceDuration:', serviceDuration);
    console.log('serviceName final:', serviceName);

    if (!serviceDuration) {
      console.log(`❌ ERROR: Servicio no encontrado para número: ${serviceNumber}`);
      return res.json({ respuesta: '🚫 Error: El servicio solicitado no fue encontrado.' });
    }

    // PASO 4: CREAR EVENTO (lógica original con zona horaria corregida)
    const endTime = moment(startTime).add(parseInt(serviceDuration), 'minutes');
    
    console.log('=== DATOS DEL EVENTO ===');
    console.log('startTime final:', startTime.format('YYYY-MM-DD HH:mm:ss z'));
    console.log('endTime final:', endTime.format('YYYY-MM-DD HH:mm:ss z'));
    console.log('serviceDuration:', serviceDuration, 'minutos');
    
    const eventTitle = `Cita: ${clientName} (${profesionalName || 'Especialista'})`;
    const eventDescription = `Cliente: ${clientName}
Email: ${clientEmail}
Teléfono: ${clientPhone}
Servicio: ${serviceName}
Duración: ${serviceDuration} min.
Agendado por: Agente de WhatsApp`;

    const eventData = {
      title: eventTitle,
      description: eventDescription,
      startTime: startTime.toDate(), // Convertir moment a Date
      endTime: endTime.toDate()       // Convertir moment a Date
    };

    console.log('=== CREACIÓN DE EVENTO ===');
    console.log('eventTitle:', eventTitle);
    
    const createResult = await createEventOriginal(calendarId, eventData);

    if (!createResult.success) {
      if (createResult.error === 'CONFLICTO') {
        // TODO: Implementar sugerencia de horarios alternativos
        return res.json({ 
          respuesta: `❌ ¡Demasiado tarde! El horario de las ${formatTimeTo12Hour(time)} ya fue reservado.` 
        });
      } else {
        return res.json({ respuesta: '❌ Error creando la cita. Inténtalo de nuevo.' });
      }
    }

    const codigoReserva = createResult.codigoReserva;
    console.log('✅ Evento creado exitosamente con código:', codigoReserva);

    // PASO 5: GUARDAR DATOS DEL CLIENTE (lógica original)
    console.log('🔥 INICIANDO GUARDADO DE DATOS DEL CLIENTE');
    
    const clientData = {
      codigoReserva: codigoReserva || 'ERROR',
      clientName: clientName || 'Cliente Sin Nombre',
      clientPhone: clientPhone || 'Sin Teléfono',
      clientEmail: clientEmail || 'Sin Email',
      profesionalName: profesionalName || 'Sin Especialista',
      date: date || 'Sin Fecha',
      time: time || 'Sin Hora',
      serviceName: serviceName || 'Sin Servicio'
    };

    const saveResult = await saveClientDataOriginal(clientData);
    if (saveResult) {
      console.log('🎉 ÉXITO: Datos guardados correctamente en hoja CLIENTES');
    } else {
      console.log('💥 FALLO: No se pudieron guardar los datos del cliente');
    }

    // PASO 6: ENVÍO DE EMAIL DE CONFIRMACIÓN
    console.log('📧 === ENVÍO DE EMAIL DE CONFIRMACIÓN ===');
    try {
      if (emailServiceReady && clientEmail && clientEmail !== 'Sin Email') {
        const emailData = {
          clientName,
          clientEmail,
          date,
          time,
          serviceName,
          profesionalName: profesionalName || 'Especialista',
          codigoReserva
        };
        
        const emailResult = await sendAppointmentConfirmation(emailData);
        if (emailResult.success) {
          console.log('✅ Email de confirmación enviado exitosamente');
        } else {
          console.log('⚠️ Email no enviado:', emailResult.reason || emailResult.error);
        }
      } else {
        console.log('⚠️ Email saltado - SMTP no configurado o email inválido');
      }
    } catch (emailError) {
      console.error('❌ Error enviando email (no crítico):', emailError.message);
    }

    // PASO 7: RESPUESTA FINAL (lógica original)
    const time12h = formatTimeTo12Hour(time);
    console.log('=== RESPUESTA FINAL ===');
    console.log('time12h:', time12h);

    const finalResponse = {
      respuesta: `✅ ¡Cita confirmada! ✨\n\nDetalles de tu cita:\n📅 Fecha: ${date}\n⏰ Hora: ${time12h}\n👨‍⚕️ Especialista: ${profesionalName || 'el especialista'}\n\n🎟️ TU CÓDIGO DE RESERVA ES: ${codigoReserva}\n\n¡Gracias por confiar en nosotros! 🌟`,
      id_cita: codigoReserva
    };

    console.log('Respuesta final:', JSON.stringify(finalResponse, null, 2));
    console.log('🔥 FIN AGENDAMIENTO ORIGINAL');

    return res.json(finalResponse);

  } catch (error) {
    console.error('💥 Error en agendamiento:', error.message);
    return res.json({ respuesta: '🤖 Ha ocurrido un error inesperado al agendar la cita.' });
  }
});

/**
 * ENDPOINT: Debug Agendamiento
 * Para diagnosticar problemas paso a paso
 */
app.post('/api/debug-agenda', async (req, res) => {
  const debug = [];
  
  try {
    debug.push('🔍 INICIANDO DEBUG DE AGENDAMIENTO');
    debug.push(`⏰ Timestamp: ${new Date().toISOString()}`);
    
    const { 
      action = "schedule", 
      calendar = "1", 
      service = "1",
      date = "2025-12-01", 
      time = "15:00",
      clientName = "Debug Test",
      clientEmail = "debug@test.com",
      clientPhone = "1234567890"
    } = req.body;
    
    debug.push(`📥 Body recibido: ${JSON.stringify(req.body, null, 2)}`);
    
    // PASO 1: Validaciones básicas
    debug.push('\n📋 PASO 1: VALIDACIONES BÁSICAS');
    if (!action || action !== 'schedule') {
      debug.push('❌ Action inválida');
      return res.json({ debug: debug.join('\n') });
    }
    debug.push('✅ Action válida: schedule');
    debug.push(`✅ Datos básicos: calendar=${calendar}, service=${service}, date=${date}, time=${time}`);
    
    // PASO 2: Configuración de Google Sheets
    debug.push('\n📊 PASO 2: GOOGLE SHEETS');
    let sheetData;
    try {
      sheetData = await getSheetData();
      debug.push('✅ Google Sheets conectado correctamente');
      debug.push(`📊 Calendarios encontrados: ${sheetData.calendars ? sheetData.calendars.length : 0}`);
      debug.push(`📊 Servicios encontrados: ${sheetData.services ? sheetData.services.length : 0}`);
    } catch (error) {
      debug.push(`❌ Error en Google Sheets: ${error.message}`);
      return res.json({ debug: debug.join('\n') });
    }
    
    // PASO 3: Buscar Calendar ID
    debug.push('\n📅 PASO 3: CALENDAR ID');
    const calendarId = findData(calendar, sheetData.calendars, 0, 1);
    if (!calendarId) {
      debug.push(`❌ Calendar ID no encontrado para: ${calendar}`);
      return res.json({ debug: debug.join('\n') });
    }
    debug.push(`✅ Calendar ID encontrado: ${calendarId.substring(0, 30)}...`);
    
    // PASO 4: Datos del servicio
    debug.push('\n⚕️ PASO 4: SERVICIO');
    const serviceDuration = findData(service, sheetData.services, 0, 1);
    if (!serviceDuration) {
      debug.push(`❌ Servicio no encontrado para: ${service}`);
      return res.json({ debug: debug.join('\n') });
    }
    debug.push(`✅ Duración del servicio: ${serviceDuration} minutos`);
    
    // PASO 5: Preparar evento
    debug.push('\n📝 PASO 5: PREPARAR EVENTO');
    const startTime = new Date(`${date}T${time}:00`);
    const endTime = new Date(startTime.getTime() + parseInt(serviceDuration) * 60000);
    
    debug.push(`✅ Hora inicio: ${startTime.toISOString()}`);
    debug.push(`✅ Hora fin: ${endTime.toISOString()}`);
    
    const eventData = {
      title: `Debug: ${clientName}`,
      description: `Email: ${clientEmail}\nTeléfono: ${clientPhone}`,
      startTime: startTime,
      endTime: endTime
    };
    
    // PASO 6: Intentar crear evento
    debug.push('\n📅 PASO 6: CREAR EVENTO EN GOOGLE CALENDAR');
    try {
      debug.push('🔄 Llamando a createEventOriginal...');
      const createResult = await createEventOriginal(calendarId, eventData);
      
      if (createResult.success) {
        debug.push('✅ Evento creado exitosamente!');
        debug.push(`🎟️ Código generado: ${createResult.codigoReserva}`);
        debug.push('\n🎉 DEBUG COMPLETO - TODO FUNCIONA CORRECTAMENTE');
        return res.json({ 
          debug: debug.join('\n'),
          success: true,
          codigo: createResult.codigoReserva 
        });
      } else {
        debug.push(`❌ Error creando evento: ${createResult.error}`);
        debug.push(`📝 Mensaje: ${createResult.message}`);
        return res.json({ debug: debug.join('\n') });
      }
      
    } catch (createError) {
      debug.push(`💥 Excepción creando evento: ${createError.message}`);
      debug.push(`📚 Stack: ${createError.stack}`);
      return res.json({ debug: debug.join('\n') });
    }
    
  } catch (error) {
    debug.push(`💥 ERROR CRÍTICO: ${error.message}`);
    debug.push(`📚 Stack: ${error.stack}`);
    return res.json({ debug: debug.join('\n') });
  }
});

/**
 * ENDPOINT: Diagnóstico específico de Google Sheets
 */
app.post('/api/debug-sheets', async (req, res) => {
  const debug = [];
  
  try {
    debug.push('🔍 === DIAGNÓSTICO GOOGLE SHEETS ===');
    debug.push(`⏰ Timestamp: ${new Date().toISOString()}`);
    
    // PASO 1: Verificar configuración
    debug.push('\n📋 PASO 1: VERIFICAR CONFIGURACIÓN');
    debug.push(`🆔 GOOGLE_CLIENT_EMAIL: ${config.google.clientEmail ? '✅ Configurado' : '❌ Falta'}`);
    debug.push(`🔑 GOOGLE_PRIVATE_KEY: ${config.google.privateKey ? '✅ Configurado' : '❌ Falta'}`);
    debug.push(`📊 GOOGLE_PROJECT_ID: ${config.google.projectId ? '✅ Configurado' : '❌ Falta'}`);
    debug.push(`📋 SHEET_ID: ${config.business.sheetId}`);
    
    if (!config.google.clientEmail || !config.google.privateKey || !config.google.projectId) {
      debug.push('\n❌ CONFIGURACIÓN INCOMPLETA - Falta información en .env');
      return res.json({ debug: debug.join('\n') });
    }
    
    // PASO 2: Probar conexión a Google Sheets
    debug.push('\n📊 PASO 2: CONEXIÓN GOOGLE SHEETS');
    let sheets;
    try {
      const { getSheetsInstance } = require('./services/googleAuth');
      sheets = await getSheetsInstance();
      debug.push('✅ Conexión a Google Sheets exitosa');
    } catch (error) {
      debug.push(`❌ Error conectando a Google Sheets: ${error.message}`);
      return res.json({ debug: debug.join('\n') });
    }
    
    // PASO 3: Probar acceso al spreadsheet específico
    debug.push('\n📋 PASO 3: ACCESO AL SPREADSHEET');
    try {
      const sheetResponse = await sheets.spreadsheets.get({
        spreadsheetId: config.business.sheetId
      });
      debug.push(`✅ Spreadsheet encontrado: "${sheetResponse.data.properties.title}"`);
      debug.push(`📊 Hojas disponibles: ${sheetResponse.data.sheets.map(s => s.properties.title).join(', ')}`);
    } catch (error) {
      debug.push(`❌ Error accediendo al spreadsheet: ${error.message}`);
      if (error.message.includes('permission')) {
        debug.push('💡 SOLUCIÓN: La cuenta de servicio necesita permisos de Editor en el Google Sheet');
      } else if (error.message.includes('not found')) {
        debug.push('💡 SOLUCIÓN: Verificar que el SHEET_ID sea correcto');
      }
      return res.json({ debug: debug.join('\n') });
    }
    
    // PASO 4: Verificar/crear hoja CLIENTES
    debug.push('\n👥 PASO 4: HOJA CLIENTES');
    try {
      await ensureClientsSheet(sheets);
      debug.push('✅ Hoja CLIENTES verificada/creada');
    } catch (error) {
      debug.push(`❌ Error con hoja CLIENTES: ${error.message}`);
      return res.json({ debug: debug.join('\n') });
    }
    
    // PASO 5: Probar escritura real
    debug.push('\n✏️ PASO 5: PRUEBA DE ESCRITURA');
    try {
      const testData = [
        new Date().toISOString(),
        'TEST123',
        'Usuario Test',
        '5551234567', 
        'test@example.com',
        'Dr. Test',
        '2025-12-01',
        '15:00',
        'Consulta Test',
        'CONFIRMADA'
      ];
      
      const writeResponse = await sheets.spreadsheets.values.append({
        spreadsheetId: config.business.sheetId,
        range: 'CLIENTES!A:J',
        valueInputOption: 'RAW',
        resource: {
          values: [testData]
        }
      });
      
      debug.push('✅ Escritura exitosa!');
      debug.push(`📊 Fila agregada: ${writeResponse.data.updates.updatedRows} fila(s)`);
      debug.push(`📋 Rango actualizado: ${writeResponse.data.updates.updatedRange}`);
      
      debug.push('\n🎉 ¡GOOGLE SHEETS FUNCIONA COMPLETAMENTE!');
      debug.push('💡 Si no ves datos en tu sheet, verifica que estés viendo la hoja correcta');
      
      return res.json({ 
        debug: debug.join('\n'),
        success: true,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${config.business.sheetId}`
      });
      
    } catch (error) {
      debug.push(`❌ Error en escritura: ${error.message}`);
      
      if (error.message.includes('permission')) {
        debug.push('\n💡 PROBLEMA DE PERMISOS:');
        debug.push(`   1. Ve a: https://docs.google.com/spreadsheets/d/${config.business.sheetId}`);
        debug.push(`   2. Compartir → Agregar → ${config.google.clientEmail}`);
        debug.push(`   3. Permisos: Editor (NO solo visualizador)`);
      }
      
      return res.json({ debug: debug.join('\n') });
    }
    
  } catch (error) {
    debug.push(`💥 ERROR CRÍTICO: ${error.message}`);
    return res.json({ debug: debug.join('\n') });
  }
});

// =================================================================
// 📚 DOCUMENTACIÓN SWAGGER
// =================================================================

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'ValGop API - Sistema de Gestión de Citas',
    description: 'API migrada de Google Apps Script para gestión de citas médicas',
    version: '1.0.0',
    contact: {
      email: 'goparirisvaleria@gmail.com'
    }
  },
  servers: [
    {
      url: 'https://agendavaleriagopar-production.up.railway.app',
      description: 'Servidor de producción (Railway)'
    },
    {
      url: `http://localhost:${PORT}`,
      description: 'Servidor de desarrollo local'
    }
  ],
  paths: {
    '/api/consulta-disponibilidad': {
      get: {
        summary: 'Consulta disponibilidad de horarios',
        description: 'Consulta horarios disponibles con análisis de 3 días y estadísticas',
        parameters: [
          {
            name: 'calendar',
            in: 'query',
            required: true,
            description: 'Número identificador del calendario',
            schema: { type: 'integer', example: 1 }
          },
          {
            name: 'service',
            in: 'query',
            required: true,
            description: 'Número identificador del servicio',
            schema: { type: 'integer', example: 1 }
          },
          {
            name: 'date',
            in: 'query',
            required: true,
            description: 'Fecha en formato YYYY-MM-DD',
            schema: { type: 'string', example: '2025-08-26' }
          }
        ],
        responses: {
          '200': {
            description: 'Respuesta exitosa con horarios disponibles',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    respuesta: { type: 'string' },
                    metadata: {
                      type: 'object',
                      properties: {
                        totalDays: { type: 'integer' },
                        totalSlots: { type: 'integer' },
                        averageOccupation: { type: 'integer' },
                        dateMapping: { type: 'object' },
                        recommendations: { type: 'object' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/agenda-cita': {
      post: {
        summary: 'Agenda una nueva cita',
        description: 'Agenda una nueva cita médica con validaciones completas y generación automática de código de reserva',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action', 'date', 'time', 'calendar', 'service', 'clientName', 'clientPhone', 'clientEmail'],
                properties: {
                  action: { 
                    type: 'string', 
                    example: 'schedule',
                    description: 'Acción a realizar (debe ser "schedule")'
                  },
                  date: { 
                    type: 'string', 
                    example: '2025-08-27',
                    description: 'Fecha de la cita en formato YYYY-MM-DD'
                  },
                  time: { 
                    type: 'string', 
                    example: '14:00',
                    description: 'Hora de la cita en formato HH:MM (24h)'
                  },
                  calendar: { 
                    type: 'string', 
                    example: '1',
                    description: 'Número identificador del calendario'
                  },
                  service: { 
                    type: 'string', 
                    example: '1',
                    description: 'Número identificador del servicio'
                  },
                  serviceName: { 
                    type: 'string', 
                    example: 'Consulta de valoración',
                    description: 'Nombre descriptivo del servicio (opcional)'
                  },
                  clientName: { 
                    type: 'string', 
                    example: 'Juan Pérez',
                    description: 'Nombre completo del cliente'
                  },
                  clientPhone: { 
                    type: 'string', 
                    example: '5551234567',
                    description: 'Teléfono del cliente (mínimo 10 dígitos)'
                  },
                  clientEmail: { 
                    type: 'string', 
                    example: 'juan.perez@ejemplo.com',
                    description: 'Email del cliente (formato válido)'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Respuesta del agendamiento',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      title: 'Cita Confirmada',
                      type: 'object',
                      properties: {
                        respuesta: { 
                          type: 'string',
                          example: '✅ ¡Cita confirmada! ✨\n\nDetalles de tu cita:\n📅 Fecha: 2025-08-27\n⏰ Hora: 2:00 PM\n👨‍⚕️ Especialista: Dr. Juan\n\n🎟️ TU CÓDIGO DE RESERVA ES: ABC123\n\n¡Gracias por confiar en nosotros! 🌟'
                        },
                        id_cita: { 
                          type: 'string',
                          example: 'ABC123',
                          description: 'Código de reserva generado'
                        }
                      }
                    },
                    {
                      title: 'Error de Validación',
                      type: 'object', 
                      properties: {
                        respuesta: { 
                          type: 'string',
                          example: '⚠️ Error: Faltan o son inválidos los siguientes datos obligatorios:\n\n❌ clientEmail\n❌ clientPhone\n\nEl bot debe recopilar TODOS los datos antes de enviar la solicitud.'
                        }
                      }
                    },
                    {
                      title: 'Conflicto de Horario',
                      type: 'object',
                      properties: {
                        respuesta: { 
                          type: 'string',
                          example: '❌ ¡Demasiado tarde! El horario de las 2:00 PM ya fue reservado.'
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/cancela-cita': {
      post: {
        summary: 'Cancela una cita existente',
        description: 'Cancela una cita usando el código de reserva',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action', 'calendar', 'eventId'],
                properties: {
                  action: { type: 'string', example: 'cancel' },
                  calendar: { type: 'string', example: '1' },
                  eventId: { type: 'string', example: 'ABC123' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Respuesta de cancelación',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    respuesta: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/consulta-fecha-actual': {
      get: {
        summary: 'Obtiene la fecha y hora actual',
        description: 'Devuelve la fecha y hora actual del sistema en zona horaria configurada',
        responses: {
          '200': {
            description: 'Fecha y hora actual',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    fechaHora: { type: 'string', example: 'martes, 26 de agosto de 2025, 17:25:48 GMT-5' },
                    timestamp: { type: 'integer', example: 1756247148133 },
                    isoString: { type: 'string', example: '2025-08-26T22:25:48.133Z' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/eventos/{fecha}': {
      get: {
        summary: 'Lista eventos de una fecha específica',
        description: 'Muestra todos los eventos del calendario para una fecha específica (útil para debug)',
        parameters: [
          {
            name: 'fecha',
            in: 'path',
            required: true,
            description: 'Fecha a consultar en formato YYYY-MM-DD',
            schema: { type: 'string', example: '2025-08-26' }
          }
        ],
        responses: {
          '200': {
            description: 'Lista de eventos encontrados',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    respuesta: { 
                      type: 'string',
                      example: '📅 EVENTOS DEL 2025-08-26\n📊 Calendar: 8cd456ed37480f3eb747c5bc0eb4c9...\n🔢 Total eventos: 2\n\n📋 LISTA DE EVENTOS:\n\n1. 14:00 - "Cita: Juan Pérez"\n   ID: abc123...\n   Creador: servicio@ejemplo.com\n\n🎯 EVENTOS A LAS 18:00: 0'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/debug-agenda': {
      post: {
        summary: 'Debug del proceso de agendamiento',
        description: 'Endpoint de diagnóstico para identificar problemas paso a paso en el proceso de agendamiento',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  date: { 
                    type: 'string', 
                    example: '2025-12-01',
                    description: 'Fecha de prueba (opcional, por defecto: 2025-12-01)'
                  },
                  time: { 
                    type: 'string', 
                    example: '15:00',
                    description: 'Hora de prueba (opcional, por defecto: 15:00)'
                  },
                  calendar: { 
                    type: 'string', 
                    example: '1',
                    description: 'Calendario de prueba (opcional, por defecto: 1)'
                  },
                  service: { 
                    type: 'string', 
                    example: '1',
                    description: 'Servicio de prueba (opcional, por defecto: 1)'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Respuesta de debug detallada',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      title: 'Debug Exitoso',
                      type: 'object',
                      properties: {
                        debug: { 
                          type: 'string',
                          description: 'Log detallado de cada paso del proceso'
                        },
                        success: { 
                          type: 'boolean',
                          example: true 
                        },
                        codigo: { 
                          type: 'string',
                          example: 'ABC123',
                          description: 'Código de prueba generado'
                        }
                      }
                    },
                    {
                      title: 'Debug con Error',
                      type: 'object',
                      properties: {
                        debug: { 
                          type: 'string',
                          description: 'Log detallado mostrando dónde falló el proceso'
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/debug-sheets': {
      post: {
        summary: 'Diagnóstico específico de Google Sheets',
        description: 'Endpoint para verificar la conexión y configuración de Google Sheets',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  // No se requieren parámetros para el diagnóstico básico
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Respuesta de diagnóstico de Google Sheets',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      title: 'Google Sheets Funcionando',
                      type: 'object',
                      properties: {
                        debug: { 
                          type: 'string',
                          description: 'Log detallado de la conexión y verificación'
                        },
                        success: { 
                          type: 'boolean',
                          example: true 
                        },
                        sheetUrl: { 
                          type: 'string',
                          example: 'https://docs.google.com/spreadsheets/d/1234567890abcdef1234567890abcdef1234567890'
                        }
                      }
                    },
                    {
                      title: 'Google Sheets con Problemas',
                      type: 'object',
                      properties: {
                        debug: { 
                          type: 'string',
                          description: 'Log detallado mostrando dónde falló la conexión'
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    }
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// =================================================================
// 🚀 INICIO DEL SERVIDOR
// =================================================================

// =================================================================
// 🔧 UTILIDADES PARA RAILWAY
// =================================================================

// Detectar URL de Railway automáticamente
const getServerUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.RAILWAY_STATIC_URL) {
      return `https://${process.env.RAILWAY_STATIC_URL}`;
    } else if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    } else {
      return 'https://your-app.railway.app';
    }
  }
  return `http://localhost:${PORT}`;
};

app.listen(PORT, () => {
  const serverUrl = getServerUrl();
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log(`🚀 ValGop API ejecutándose en puerto ${PORT}`);
  console.log(`🌍 Entorno: ${isProduction ? 'PRODUCCIÓN (Railway)' : 'DESARROLLO'}`);
  console.log(`📚 Documentación disponible en: ${serverUrl}/api-docs`);
  console.log(`🌐 Endpoints disponibles:`);
  console.log(`   GET  ${serverUrl}/api/consulta-disponibilidad`);
  console.log(`   POST ${serverUrl}/api/agenda-cita`);
  console.log(`   POST ${serverUrl}/api/cancela-cita`);
  console.log(`   GET  ${serverUrl}/api/consulta-fecha-actual`);
  console.log(`   GET  ${serverUrl}/api/eventos/:fecha`);
  console.log(`   POST ${serverUrl}/api/debug-agenda`);
  console.log(`   POST ${serverUrl}/api/debug-sheets`);
  console.log(`\n🔧 Configuración:`);
  console.log(`   - Timezone: ${config.timezone.default}`);
  console.log(`   - Google Sheet ID: ${config.business.sheetId}`);
  console.log(`   - Google Auth: ${config.google.clientEmail ? '✅ Configurado' : '❌ Pendiente'}`);
  
  if (isProduction) {
    console.log(`\n⚠️  IMPORTANTE: Si ves "Failed to fetch" en Swagger:`);
    console.log(`   1. Verifica que NODE_ENV=production esté configurado en Railway`);
    console.log(`   2. Configura las variables de entorno de Google APIs`);
    console.log(`   3. Revisa los logs de Railway para más detalles`);
  }
}); 