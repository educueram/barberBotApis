const { getCalendarInstance } = require('./googleAuth');
const config = require('../config');
const moment = require('moment-timezone');

/**
 * Servicio para manejo de Google Calendar
 * Migrado desde Google Apps Script
 */

/**
 * Encontrar slots disponibles en un calendario
 * Equivalente a findAvailableSlots del código original
 */
async function findAvailableSlots(calendarId, date, durationMinutes, hours) {
  try {
    console.log(`📅 Buscando slots disponibles para ${calendarId} el ${date.toISOString().split('T')[0]}`);
    
    const calendar = await getCalendarInstance();
    
    // Configurar horarios del día
    const startOfDay = new Date(date);
    startOfDay.setHours(hours.start, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(hours.end, 0, 0, 0);
    
    const now = new Date();
    const minimumBookingTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hora de anticipación
    
    const isToday = (date.getFullYear() === now.getFullYear() && 
                     date.getMonth() === now.getMonth() && 
                     date.getDate() === now.getDate());

    console.log(`   - Horario de trabajo: ${hours.start}:00 - ${hours.end}:00`);
    console.log(`   - Duración del servicio: ${durationMinutes} minutos`);
    console.log(`   - Es hoy: ${isToday}`);

    // Obtener eventos existentes en el calendario
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = response.data.items || [];
    console.log(`   - Eventos encontrados: ${events.length}`);

    // Convertir eventos a slots ocupados
    const busySlots = events.map(event => ({
      start: new Date(event.start.dateTime || event.start.date),
      end: new Date(event.end.dateTime || event.end.date)
    })).sort((a, b) => a.start - b.start);

    // Generar slots disponibles
    const availableSlots = [];
    let currentTime = new Date(startOfDay.getTime());

    // Procesar gaps entre eventos
    busySlots.forEach(slot => {
      const gapEnd = new Date(slot.start.getTime());
      
      // Generar slots en el gap
      while (new Date(currentTime.getTime() + durationMinutes * 60000) <= gapEnd) {
        if (!isToday || currentTime >= minimumBookingTime) {
          const timeSlot = formatTime(currentTime);
          availableSlots.push(timeSlot);
        }
        currentTime.setTime(currentTime.getTime() + durationMinutes * 60000);
      }
      
      // Mover al final del evento ocupado
      currentTime = slot.end > currentTime ? new Date(slot.end.getTime()) : currentTime;
    });

    // Generar slots después del último evento hasta el final del día
    while (new Date(currentTime.getTime() + durationMinutes * 60000) <= endOfDay) {
      if (!isToday || currentTime >= minimumBookingTime) {
        const timeSlot = formatTime(currentTime);
        availableSlots.push(timeSlot);
      }
      currentTime.setTime(currentTime.getTime() + durationMinutes * 60000);
    }

    console.log(`   - Slots disponibles: ${availableSlots.length}`);
    console.log(`   - Primeros slots: ${availableSlots.slice(0, 3).join(', ')}`);

    return availableSlots;
  } catch (error) {
    console.error('❌ Error buscando slots disponibles:', error.message);
    throw error;
  }
}

/**
 * Verificar si hay conflictos en un horario específico
 */
async function checkTimeConflict(calendarId, startTime, endTime) {
  try {
    console.log(`🔍 Verificando conflictos para ${calendarId} de ${startTime.toISOString()} a ${endTime.toISOString()}`);
    
    const calendar = await getCalendarInstance();
    
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: true
    });

    const conflictingEvents = response.data.items || [];
    
    console.log(`   - Eventos conflictivos: ${conflictingEvents.length}`);
    
    return conflictingEvents;
  } catch (error) {
    console.error('❌ Error verificando conflictos:', error.message);
    throw error;
  }
}

/**
 * Crear un evento en Google Calendar
 */
async function createEvent(calendarId, eventData) {
  try {
    console.log(`📝 Creando evento en calendar ${calendarId}`);
    console.log('Datos del evento:', eventData);
    
    const calendar = await getCalendarInstance();
    
    const event = {
      summary: eventData.title,
      description: eventData.description,
      start: {
        dateTime: eventData.startTime.toISOString(),
        timeZone: config.timezone.default
      },
      end: {
        dateTime: eventData.endTime.toISOString(),
        timeZone: config.timezone.default
      }
    };

    const response = await calendar.events.insert({
      calendarId: calendarId,
      resource: event
    });

    console.log('✅ Evento creado exitosamente:', response.data.id);
    return response.data;
  } catch (error) {
    console.error('❌ Error creando evento:', error.message);
    throw error;
  }
}

/**
 * Buscar evento por nombre de cliente (alternativa cuando no hay código en el evento)
 */
async function findEventByClientName(calendarId, clientName, targetDate) {
  try {
    console.log(`🔍 Buscando evento por nombre: "${clientName}" en fecha: ${targetDate}`);
    
    const calendar = await getCalendarInstance();
    
    // Buscar solo en el día específico
    const startOfDay = new Date(targetDate + 'T00:00:00');
    const endOfDay = new Date(targetDate + 'T23:59:59');
    
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = response.data.items || [];
    console.log(`📅 Eventos encontrados en ${targetDate}: ${events.length}`);
    
    // Buscar por nombre en el título
    const targetEvent = events.find(event => {
      const title = event.summary || '';
      const normalizedTitle = title.toUpperCase();
      const normalizedClientName = clientName.toUpperCase();
      
      // Buscar nombre exacto o parcial en el título
      if (normalizedTitle.includes(normalizedClientName) || 
          normalizedClientName.includes(normalizedTitle.replace('CITA: ', '').split(' (')[0])) {
        console.log(`✅ Evento encontrado por nombre: "${title}"`);
        return true;
      }
      return false;
    });

    return targetEvent;
  } catch (error) {
    console.error('❌ Error buscando por nombre:', error.message);
    return null;
  }
}

/**
 * Cancelar evento por datos específicos (fecha, hora, calendario)
 * LÓGICA CORRECTA: Usar datos del Google Sheets para encontrar evento exacto
 */
async function cancelEventByDateAndTime(calendarId, targetDate, targetTime, clientName = null) {
  try {
    console.log(`🗑️ === CANCELACIÓN POR FECHA/HORA ===`);
    console.log(`📅 Calendario: ${calendarId}`);
    console.log(`📅 Fecha: ${targetDate}`);
    console.log(`⏰ Hora: ${targetTime}`);
    console.log(`👤 Cliente: ${clientName || 'No especificado'}`);
    
    const calendar = await getCalendarInstance();
    
    // Buscar solo en el día específico
    const startOfDay = new Date(targetDate + 'T00:00:00');
    const endOfDay = new Date(targetDate + 'T23:59:59');
    
    console.log(`🔍 Buscando eventos en ${targetDate}...`);
    
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = response.data.items || [];
    console.log(`📊 Eventos encontrados en ${targetDate}: ${events.length}`);
    
    if (events.length === 0) {
      console.log(`❌ No hay eventos en el día ${targetDate}`);
      return false;
    }

    // Mostrar todos los eventos del día para análisis
    console.log(`\n🔍 === EVENTOS DEL DÍA ${targetDate} ===`);
    events.forEach((event, index) => {
      const eventStart = new Date(event.start?.dateTime || event.start?.date);
      const eventHour = eventStart.getHours().toString().padStart(2, '0');
      const eventMinute = eventStart.getMinutes().toString().padStart(2, '0');
      const eventTimeStr = `${eventHour}:${eventMinute}`;
      
      console.log(`   ${index + 1}. "${event.summary}"`);
      console.log(`      ├─ Hora: ${eventTimeStr}`);
      console.log(`      ├─ ID: ${event.id.split('@')[0].substring(0, 8)}...`);
      console.log(`      └─ Fecha completa: ${event.start?.dateTime || event.start?.date}`);
    });

    // PASO 1: Buscar por hora exacta
    const targetHour = parseInt(targetTime.split(':')[0]);
    const targetMinute = parseInt(targetTime.split(':')[1] || '0');
    
    console.log(`\n🎯 === BUSCANDO EVENTO EN HORA ${targetTime} ===`);
    console.log(`   - Hora objetivo: ${targetHour}:${targetMinute.toString().padStart(2, '0')}`);
    
    let candidateEvents = events.filter(event => {
      const eventStart = new Date(event.start?.dateTime || event.start?.date);
      const eventHour = eventStart.getHours();
      const eventMinute = eventStart.getMinutes();
      
      // Coincidencia exacta de hora y minuto
      const hourMatch = eventHour === targetHour;
      const minuteMatch = Math.abs(eventMinute - targetMinute) <= 5; // Tolerancia de 5 minutos
      
      console.log(`      🔍 "${event.summary}" - ${eventHour}:${eventMinute.toString().padStart(2, '0')}`);
      console.log(`         ├─ Hora coincide: ${hourMatch} (${eventHour} vs ${targetHour})`);
      console.log(`         └─ Minuto coincide: ${minuteMatch} (${eventMinute} vs ${targetMinute})`);
      
      return hourMatch && minuteMatch;
    });
    
    console.log(`✅ Eventos candidatos por hora: ${candidateEvents.length}`);

    // PASO 2: Si hay múltiples candidatos, filtrar por nombre de cliente
    if (candidateEvents.length > 1 && clientName) {
      console.log(`\n🎯 === FILTRANDO POR NOMBRE DEL CLIENTE: ${clientName} ===`);
      
      const eventsByName = candidateEvents.filter(event => {
        const title = (event.summary || '').toUpperCase();
        const normalizedClientName = clientName.toUpperCase();
        const nameMatch = title.includes(normalizedClientName);
        
        console.log(`      🔍 "${event.summary}"`);
        console.log(`         └─ Contiene "${clientName}": ${nameMatch}`);
        
        return nameMatch;
      });
      
      if (eventsByName.length > 0) {
        candidateEvents = eventsByName;
        console.log(`✅ Eventos filtrados por nombre: ${candidateEvents.length}`);
      }
    }

    // PASO 3: Seleccionar el evento para eliminar
    if (candidateEvents.length === 1) {
      const targetEvent = candidateEvents[0];
      console.log(`\n✅ === EVENTO ENCONTRADO ===`);
      console.log(`📋 Título: ${targetEvent.summary}`);
      console.log(`📅 Fecha/Hora: ${targetEvent.start?.dateTime || targetEvent.start?.date}`);
      console.log(`🆔 ID: ${targetEvent.id}`);
      
      console.log(`\n🗑️ Procediendo a ELIMINAR evento...`);
      
      try {
        await calendar.events.delete({
          calendarId: calendarId,
          eventId: targetEvent.id
        });

        console.log(`✅ ¡EVENTO ELIMINADO EXITOSAMENTE!`);
        console.log(`📤 "${targetEvent.summary}" eliminado del calendario`);
        return true;
        
      } catch (deleteError) {
        console.error(`❌ ERROR eliminando evento:`, deleteError.message);
        return false;
      }
      
    } else if (candidateEvents.length === 0) {
      console.log(`\n❌ === NO SE ENCONTRÓ EVENTO ===`);
      console.log(`🔍 No hay eventos a las ${targetTime} el ${targetDate}`);
      
      // Mostrar horarios cercanos como sugerencia
      const nearbyEvents = events.filter(event => {
        const eventStart = new Date(event.start?.dateTime || event.start?.date);
        const eventHour = eventStart.getHours();
        return Math.abs(eventHour - targetHour) <= 2; // Eventos dentro de 2 horas
      });
      
      if (nearbyEvents.length > 0) {
        console.log(`\n💡 === EVENTOS CERCANOS EN HORARIO ===`);
        nearbyEvents.forEach(event => {
          const eventStart = new Date(event.start?.dateTime || event.start?.date);
          const eventTimeStr = `${eventStart.getHours().toString().padStart(2, '0')}:${eventStart.getMinutes().toString().padStart(2, '0')}`;
          console.log(`   - ${eventTimeStr}: "${event.summary}"`);
        });
      }
      
      return false;
      
    } else {
      console.log(`\n⚠️ === MÚLTIPLES EVENTOS ENCONTRADOS ===`);
      console.log(`🔍 ${candidateEvents.length} eventos coinciden con los criterios:`);
      
      candidateEvents.forEach((event, index) => {
        const eventStart = new Date(event.start?.dateTime || event.start?.date);
        const eventTimeStr = `${eventStart.getHours().toString().padStart(2, '0')}:${eventStart.getMinutes().toString().padStart(2, '0')}`;
        console.log(`   ${index + 1}. ${eventTimeStr}: "${event.summary}"`);
      });
      
      console.log(`❌ No se puede eliminar automáticamente - criterios ambiguos`);
      return false;
    }
    
  } catch (error) {
    console.error('💥 ERROR en cancelación por fecha/hora:', error.message);
    return false;
  }
}

/**
 * Cancela evento usando la lógica ORIGINAL de Google Apps Script
 * Busca evento por ID del evento (código de reserva)
 */
async function cancelEventByReservationCodeOriginal(calendarId, codigoReserva) {
  try {
    console.log(`🗑️ === CANCELACIÓN MÉTODO ORIGINAL ===`);
    console.log(`🔍 Código: ${codigoReserva}`);
    console.log(`📅 Calendar: ${calendarId}`);

    const calendar = await getCalendarInstance();
    
    // LÓGICA ORIGINAL: Buscar en rango de 30 días atrás y 90 días adelante
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);
    
    console.log(`📊 Buscando eventos desde ${startDate.toISOString().split('T')[0]} hasta ${endDate.toISOString().split('T')[0]}`);
    
    // Listar todos los eventos en el rango
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    const allEvents = response.data.items || [];
    console.log(`📋 Total eventos encontrados: ${allEvents.length}`);
    
    // LÓGICA ORIGINAL: Buscar evento por ID que comience con el código
    console.log(`\n🔍 === ANÁLISIS DE EVENTOS POR ID ===`);
    const targetEvent = allEvents.find(event => {
      const fullEventId = event.id;
      const eventId = fullEventId.split('@')[0].toUpperCase();
      const matches = eventId.startsWith(codigoReserva.toUpperCase());
      
      console.log(`📄 Evento: "${event.summary}"`);
      console.log(`   🆔 ID completo: ${fullEventId}`);
      console.log(`   🔢 ID corto: ${eventId}`);
      console.log(`   🎯 Coincide con ${codigoReserva}: ${matches ? '✅' : '❌'}`);
      
      return matches;
    });
    
    if (targetEvent) {
      console.log(`\n✅ EVENTO ENCONTRADO PARA ELIMINAR:`);
      console.log(`   📅 Título: ${targetEvent.summary}`);
      console.log(`   🆔 ID: ${targetEvent.id}`);
      console.log(`   📊 Fecha: ${targetEvent.start?.dateTime || targetEvent.start?.date}`);
      
      // Eliminar el evento
      await calendar.events.delete({
        calendarId: calendarId,
        eventId: targetEvent.id
      });
      
      console.log(`🗑️ Evento eliminado exitosamente del Google Calendar`);
      return {
        success: true,
        message: `✅ La cita con código de reserva ${codigoReserva.toUpperCase()} ha sido cancelada exitosamente.`
      };
      
    } else {
      console.log(`\n❌ NO SE ENCONTRÓ EVENTO CON CÓDIGO: ${codigoReserva}`);
      console.log(`\n📋 IDs de eventos disponibles:`);
      allEvents.forEach((event, index) => {
        const shortId = event.id.split('@')[0].substring(0, 6).toUpperCase();
        console.log(`   ${index + 1}. ${shortId} - "${event.summary}"`);
      });
      
      return {
        success: false,
        message: `🤷‍♀️ No se encontró ninguna cita con el código de reserva ${codigoReserva.toUpperCase()} en este calendario. Verifica que el código sea correcto.`
      };
    }
    
  } catch (error) {
    console.error(`❌ Error en cancelación por código: ${error.message}`);
    return {
      success: false,
      message: `🤷‍♀️ No se encontró ninguna cita con el código de reserva ${codigoReserva.toUpperCase()}. Verifica que el código sea correcto.`
    };
  }
}

/**
 * Función principal de cancelación usando la lógica correcta
 */
async function cancelEventUsingSheetData(calendarId, codigoReserva, clientData) {
  try {
    console.log(`🔧 === CANCELACIÓN CON LÓGICA CORRECTA ===`);
    console.log(`📋 Código de reserva: ${codigoReserva}`);
    
    if (!clientData) {
      console.log(`❌ No hay datos del cliente para proceder con la cancelación`);
      return false;
    }
    
    console.log(`📊 Datos obtenidos de Google Sheets:`);
    console.log(`   - Cliente: ${clientData.clientName}`);
    console.log(`   - Fecha: ${clientData.date}`);
    console.log(`   - Hora: ${clientData.time}`);
    console.log(`   - Estado actual: ${clientData.estado}`);
    
    if (clientData.estado === 'CANCELADA') {
      console.log(`⚠️ La cita ya está marcada como CANCELADA en Google Sheets`);
      console.log(`🔄 Pero continuaremos verificando si el evento aún existe en Google Calendar...`);
    }
    
    // Usar los datos del cliente para buscar el evento específico
    const success = await cancelEventByDateAndTime(
      calendarId,
      clientData.date,
      clientData.time,
      clientData.clientName
    );
    
    return success;
    
  } catch (error) {
    console.error('💥 Error en cancelación con datos del sheet:', error.message);
    return false;
  }
}

/**
 * Crear evento en Google Calendar (LÓGICA ORIGINAL)
 * Incluye validación de conflictos y generación de código
 */
async function createEventOriginal(calendarId, eventData) {
  try {
    console.log(`📝 === CREANDO EVENTO ORIGINAL ===`);
    console.log(`📅 Calendar: ${calendarId}`);
    console.log(`📊 Datos:`, eventData);

    const calendar = await getCalendarInstance();

    // PASO 1: Verificar conflictos (lógica original)
    const conflictingEventsResponse = await calendar.events.list({
      calendarId: calendarId,
      timeMin: eventData.startTime.toISOString(),
      timeMax: eventData.endTime.toISOString(),
      singleEvents: true
    });

    const conflictingEvents = conflictingEventsResponse.data.items || [];
    console.log(`🔍 Eventos conflictivos: ${conflictingEvents.length}`);

    if (conflictingEvents.length > 0) {
      console.log(`❌ CONFLICTO: Horario ya ocupado`);
      return {
        success: false,
        error: 'CONFLICTO',
        conflictingEvents: conflictingEvents.length,
        message: `❌ ¡Demasiado tarde! El horario ya fue reservado.`
      };
    }

    // PASO 2: Crear evento (lógica original)
    const event = {
      summary: eventData.title,
      description: eventData.description,
      start: {
        dateTime: eventData.startTime.toISOString(),
        timeZone: config.timezone.default
      },
      end: {
        dateTime: eventData.endTime.toISOString(),
        timeZone: config.timezone.default
      }
    };

    console.log(`📝 Creando evento: "${event.summary}"`);

    const response = await calendar.events.insert({
      calendarId: calendarId,
      resource: event
    });

    const newEvent = response.data;
    console.log(`✅ Evento creado con ID: ${newEvent.id}`);

    // PASO 3: Generar código de reserva (LÓGICA ORIGINAL)
    const codigoReserva = generateReservationCodeOriginal(newEvent.id);
    console.log(`🎟️ Código de reserva generado: ${codigoReserva}`);

    return {
      success: true,
      event: newEvent,
      codigoReserva: codigoReserva,
      message: '✅ Evento creado exitosamente'
    };

  } catch (error) {
    console.error(`❌ Error creando evento: ${error.message}`);
    return {
      success: false,
      error: error.message,
      message: '❌ Error creando evento en el calendario'
    };
  }
}

/**
 * Formatear tiempo en formato HH:MM
 */
function formatTime(date) {
  return moment(date).tz(config.timezone.default).format('HH:mm');
}

/**
 * Genera código de reserva basado en el Event ID (LÓGICA ORIGINAL)
 * Toma los primeros 6 caracteres del Event ID como el código original
 */
function generateReservationCodeOriginal(eventId) {
  try {
    // LÓGICA ORIGINAL: shortEventId.substring(0, 6).toUpperCase()
    const fullEventId = eventId;
    const shortEventId = fullEventId.split('@')[0];
    const codigoReserva = shortEventId.substring(0, 6).toUpperCase();
    
    console.log(`🎟️ === GENERACIÓN CÓDIGO ORIGINAL ===`);
    console.log(`   📄 Event ID completo: ${fullEventId}`);
    console.log(`   🔢 Event ID corto: ${shortEventId}`);
    console.log(`   🎯 Código generado: ${codigoReserva}`);
    
    return codigoReserva;
  } catch (error) {
    console.error('Error generando código de reserva:', error);
    return 'ERROR' + Date.now().toString().slice(-4);
  }
}

/**
 * Formatear tiempo a 12 horas (lógica original)
 */
function formatTimeTo12Hour(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return timeString;
  }
  
  const parts = timeString.split(':');
  if (parts.length < 2) {
    return timeString;
  }
  
  const hour24 = parseInt(parts[0]);
  const minutes = parts[1];
  
  if (isNaN(hour24)) {
    return timeString;
  }
  
  if (hour24 === 0) {
    return `12:${minutes} AM`;
  } else if (hour24 < 12) {
    return `${hour24}:${minutes} AM`;
  } else if (hour24 === 12) {
    return `12:${minutes} PM`;
  } else {
    return `${hour24 - 12}:${minutes} PM`;
  }
}

module.exports = {
  findAvailableSlots,
  checkTimeConflict,
  createEvent,
  cancelEventByDateAndTime,
  cancelEventUsingSheetData,
  findEventByClientName,
  formatTime,
  generateReservationCodeOriginal,
  cancelEventByReservationCodeOriginal,
  createEventOriginal,
  formatTimeTo12Hour
}; 