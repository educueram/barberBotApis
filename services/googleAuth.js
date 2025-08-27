const { google } = require('googleapis');
const config = require('../config');

/**
 * Servicio de autenticación con Google APIs
 * Migrado desde Google Apps Script
 */

let auth = null;

/**
 * Inicializar autenticación con Google
 */
function initializeAuth() {
  try {
    if (!config.google.privateKey || !config.google.clientEmail) {
      throw new Error('Faltan credenciales de Google. Verificar variables de entorno GOOGLE_PRIVATE_KEY y GOOGLE_CLIENT_EMAIL');
    }

    auth = new google.auth.GoogleAuth({
      credentials: {
        private_key: config.google.privateKey,
        client_email: config.google.clientEmail,
        project_id: config.google.projectId
      },
      scopes: config.google.scopes
    });

    console.log('✅ Google Auth inicializado correctamente');
    return auth;
  } catch (error) {
    console.error('❌ Error inicializando Google Auth:', error.message);
    throw error;
  }
}

/**
 * Obtener cliente autenticado
 */
async function getAuthenticatedClient() {
  try {
    if (!auth) {
      auth = initializeAuth();
    }
    
    const authClient = await auth.getClient();
    return authClient;
  } catch (error) {
    console.error('❌ Error obteniendo cliente autenticado:', error.message);
    throw error;
  }
}

/**
 * Obtener instancia de Google Sheets
 */
async function getSheetsInstance() {
  try {
    const authClient = await getAuthenticatedClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    return sheets;
  } catch (error) {
    console.error('❌ Error obteniendo instancia de Sheets:', error.message);
    throw error;
  }
}

/**
 * Obtener instancia de Google Calendar
 */
async function getCalendarInstance() {
  try {
    const authClient = await getAuthenticatedClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });
    return calendar;
  } catch (error) {
    console.error('❌ Error obteniendo instancia de Calendar:', error.message);
    throw error;
  }
}

module.exports = {
  initializeAuth,
  getAuthenticatedClient,
  getSheetsInstance,
  getCalendarInstance
}; 