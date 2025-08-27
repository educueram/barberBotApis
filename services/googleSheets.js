const { getSheetsInstance } = require('./googleAuth');
const config = require('../config');
const moment = require('moment-timezone');

/**
 * Servicio para manejo de Google Sheets
 * Migrado desde Google Apps Script
 */

/**
 * Obtener datos de todas las hojas necesarias
 * Equivalente a getSheetData() del código original
 */
async function getSheetData() {
  try {
    console.log('📊 Obteniendo datos de Google Sheets...');
    const sheets = await getSheetsInstance();
    
    const [calendarsData, hoursData, servicesData] = await Promise.all([
      getSheetValues(sheets, config.sheets.calendars),
      getSheetValues(sheets, config.sheets.hours),
      getSheetValues(sheets, config.sheets.services)
    ]);

    const sheetData = {
      calendars: calendarsData,
      hours: hoursData,
      services: servicesData
    };

    console.log('✅ Datos obtenidos correctamente:');
    console.log(`   - Calendarios: ${calendarsData.length - 1} registros`);
    console.log(`   - Horarios: ${hoursData.length - 1} registros`);
    console.log(`   - Servicios: ${servicesData.length - 1} registros`);

    return sheetData;
  } catch (error) {
    console.error('❌ Error obteniendo datos de sheets:', error.message);
    throw error;
  }
}

/**
 * Obtener valores de una hoja específica
 */
async function getSheetValues(sheets, sheetName) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.business.sheetId,
      range: sheetName
    });

    return response.data.values || [];
  } catch (error) {
    console.error(`❌ Error obteniendo datos de la hoja ${sheetName}:`, error.message);
    throw error;
  }
}

/**
 * Buscar datos en una matriz (equivalente a findData del código original)
 */
function findData(query, data, searchCol, returnCol) {
  for (let i = 1; i < data.length; i++) { 
    if (data[i][searchCol] && data[i][searchCol].toString().trim() == query) { 
      return data[i][returnCol]; 
    } 
  } 
  return null;
}

/**
 * Buscar horarios de trabajo (equivalente a findWorkingHours del código original)
 */
function findWorkingHours(calendarNumber, dayNumber, data) {
  const dayNames = { 1: "LUNES", 2: "MARTES", 3: "MIERCOLES", 4: "JUEVES", 5: "VIERNES", 6: "SABADO", 7: "DOMINGO" }; 
  const expectedDayName = dayNames[dayNumber]; 
  
  for (let i = 1; i < data.length; i++) { 
    const sheetCalendar = data[i][0] ? data[i][0].toString().trim() : '';
    if (sheetCalendar === calendarNumber) { 
      const sheetDayValue = data[i][1] ? data[i][1].toString().trim() : '';
      const normalizedSheetDay = sheetDayValue.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
      
      if (sheetDayValue === dayNumber.toString() || normalizedSheetDay === expectedDayName) { 
        return { 
          start: parseInt(data[i][2]), 
          end: parseInt(data[i][3]), 
          dayName: sheetDayValue 
        }; 
      } 
    } 
  } 
  return null;
}

/**
 * Guardar datos del cliente (LÓGICA ORIGINAL)
 * Migrado desde el código de Google Apps Script
 */
async function saveClientDataOriginal(clientData) {
  try {
    console.log('🔄 === INICIO saveClientData ORIGINAL ===');
    console.log('Datos recibidos:', JSON.stringify(clientData, null, 2));

    // PASO 1: Obtener/crear hoja CLIENTES
    console.log('📊 Obteniendo instancia de Google Sheets...');
    const sheets = await getSheetsInstance();
    console.log('✅ Google Sheets instancia obtenida');
    
    const sheetId = config.business.sheetId;
    console.log(`📋 Sheet ID: ${sheetId}`);

    // Asegurar que existe la hoja CLIENTES
    console.log('🔍 Verificando/creando hoja CLIENTES...');
    await ensureClientsSheet(sheets);
    console.log('✅ Hoja CLIENTES verificada/creada');

    // PASO 2: Preparar datos para insertar (LÓGICA ORIGINAL)
    const now = new Date();
    const timestamp = moment(now).tz(config.timezone.default).format('YYYY-MM-DD HH:mm:ss');

    const rowData = [
      timestamp,                           // FECHA_REGISTRO
      clientData.codigoReserva || '',      // CODIGO_RESERVA
      clientData.clientName || '',         // NOMBRE_CLIENTE  
      clientData.clientPhone || '',        // TELEFONO
      clientData.clientEmail || '',        // EMAIL
      clientData.profesionalName || '',    // ESPECIALISTA
      clientData.date || '',               // FECHA_CITA
      clientData.time || '',               // HORA_CITA
      clientData.serviceName || '',        // SERVICIO
      'CONFIRMADA'                         // ESTADO
    ];

    console.log('📝 Fila a insertar:', rowData);

    // PASO 3: Insertar datos
    console.log('💾 Insertando datos en Google Sheets...');
    console.log(`📋 Range: CLIENTES!A:J`);
    console.log(`🆔 SpreadsheetId: ${sheetId}`);
    
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'CLIENTES!A:J',
      valueInputOption: 'RAW',
      resource: {
        values: [rowData]
      }
    });

    console.log('✅ Respuesta de Google Sheets recibida');
    console.log('📊 Response details:', JSON.stringify(response.data, null, 2));
    console.log('✅ Datos guardados exitosamente');
    console.log(`📊 Cliente ${clientData.clientName} guardado con código ${clientData.codigoReserva}`);

    return true;

  } catch (error) {
    console.error('💥 ERROR CRÍTICO en saveClientData:', error.message);
    console.error('📚 Stack completo:', error.stack);
    
    // Diagnósticos específicos
    if (error.message.includes('permission')) {
      console.error('🔒 ERROR DE PERMISOS: La cuenta de servicio no tiene permisos para escribir en Google Sheets');
      console.error('💡 SOLUCIÓN: Compartir el Google Sheet con el email de la cuenta de servicio como Editor');
    } else if (error.message.includes('not found') || error.message.includes('404')) {
      console.error('📋 SHEET NO ENCONTRADO: El spreadsheetId puede ser incorrecto');
      console.error(`🆔 SpreadsheetId usado: ${config.business.sheetId}`);
    } else if (error.message.includes('API key')) {
      console.error('🔑 PROBLEMA DE API: Las credenciales de Google pueden estar mal configuradas');
    } else {
      console.error('❓ ERROR DESCONOCIDO - Detalles completos del error:');
      console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }
    
    return false;
  }
}

/**
 * Asegurar que la hoja CLIENTES existe
 */
async function ensureClientsSheet(sheets) {
  try {
    // Obtener información del spreadsheet
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: config.business.sheetId
    });

    // Verificar si la hoja CLIENTES existe
    const clientsSheetExists = spreadsheet.data.sheets.some(
      sheet => sheet.properties.title === config.sheets.clients
    );

    if (!clientsSheetExists) {
      console.log('📋 Creando hoja CLIENTES...');
      
      // Crear la hoja
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: config.business.sheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: config.sheets.clients
              }
            }
          }]
        }
      });

      // Agregar headers
      const headers = [
        'FECHA_REGISTRO',
        'CODIGO_RESERVA', 
        'NOMBRE_CLIENTE',
        'TELEFONO',
        'EMAIL',
        'ESPECIALISTA',
        'FECHA_CITA',
        'HORA_CITA',
        'SERVICIO',
        'ESTADO'
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: config.business.sheetId,
        range: `${config.sheets.clients}!A1`,
        valueInputOption: 'RAW',
        resource: {
          values: [headers]
        }
      });

      console.log('✅ Hoja CLIENTES creada con headers');
    }
  } catch (error) {
    console.error('❌ Error verificando/creando hoja CLIENTES:', error.message);
    throw error;
  }
}

/**
 * Actualizar estado de una cita en la hoja CLIENTES
 */
async function updateClientStatus(codigoReserva, newStatus) {
  try {
    console.log(`📝 Actualizando estado de cita ${codigoReserva} a ${newStatus}...`);
    
    const sheets = await getSheetsInstance();
    
    // Obtener todos los datos de la hoja CLIENTES
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.business.sheetId,
      range: config.sheets.clients
    });

    const data = response.data.values || [];
    
    // Buscar la fila con el código de reserva
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === codigoReserva.toUpperCase()) {
        // Actualizar estado (columna J = índice 9)
        await sheets.spreadsheets.values.update({
          spreadsheetId: config.business.sheetId,
          range: `${config.sheets.clients}!J${i + 1}`,
          valueInputOption: 'RAW',
          resource: {
            values: [[newStatus]]
          }
        });

        console.log(`✅ Estado actualizado: ${codigoReserva} -> ${newStatus}`);
        return true;
      }
    }

    console.log(`⚠️ No se encontró la cita con código: ${codigoReserva}`);
    return false;
  } catch (error) {
    console.error('❌ Error actualizando estado:', error.message);
    return false;
  }
}

/**
 * Obtener datos de un cliente por código de reserva
 */
async function getClientDataByReservationCode(codigoReserva) {
  try {
    console.log(`🔍 Buscando datos del cliente con código: ${codigoReserva}`);
    
    const sheets = await getSheetsInstance();
    
    // Obtener todos los datos de la hoja CLIENTES
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.business.sheetId,
      range: config.sheets.clients
    });

    const data = response.data.values || [];
    
    // Buscar la fila con el código de reserva
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] && data[i][1].toUpperCase() === codigoReserva.toUpperCase()) {
        const clientData = {
          fechaRegistro: data[i][0],
          codigoReserva: data[i][1],
          clientName: data[i][2],
          clientPhone: data[i][3], 
          clientEmail: data[i][4],
          profesionalName: data[i][5],
          date: data[i][6],
          time: data[i][7],
          serviceName: data[i][8],
          estado: data[i][9]
        };
        
        console.log(`✅ Datos del cliente encontrados:`, clientData);
        return clientData;
      }
    }

    console.log(`❌ No se encontraron datos para el código: ${codigoReserva}`);
    return null;
  } catch (error) {
    console.error('❌ Error obteniendo datos del cliente:', error.message);
    return null;
  }
}

module.exports = {
  getSheetData,
  getSheetValues,
  findData,
  findWorkingHours,
  saveClientDataOriginal,
  updateClientStatus,
  ensureClientsSheet,
  getClientDataByReservationCode
}; 