const nodemailer = require('nodemailer');
const config = require('../config');
const moment = require('moment-timezone');
const { formatTimeTo12Hour } = require('./googleCalendar');

// Configurar moment en español
moment.locale('es');

/**
 * Servicio de envío de emails
 * Para confirmaciones de citas
 */

// Configurar transporter de nodemailer
let transporter = null;

function initializeEmailService() {
  try {
    console.log('🔧 === INICIALIZANDO SERVICIO DE EMAIL ===');
    console.log('SMTP_HOST:', config.smtp.host);
    console.log('SMTP_PORT:', config.smtp.port);
    console.log('SMTP_USER:', config.smtp.user ? '✅ Configurado' : '❌ Vacío');
    console.log('SMTP_USER_VALUE:', config.smtp.user); // Mostrar el valor exacto
    console.log('SMTP_PASS:', config.smtp.pass ? '✅ Configurado' : '❌ Vacío');
    console.log('SMTP_PASS_LENGTH:', config.smtp.pass ? config.smtp.pass.length + ' caracteres' : '0');
    console.log('SMTP_PASS_PREVIEW:', config.smtp.pass ? config.smtp.pass.substring(0, 4) + '****' + config.smtp.pass.substring(config.smtp.pass.length - 4) : 'VACÍO');

    // Validación más estricta
    if (!config.smtp.host || !config.smtp.user || !config.smtp.pass || 
        config.smtp.user.trim() === '' || config.smtp.pass.trim() === '') {
      console.log('⚠️ SMTP no configurado completamente - emails deshabilitados');
      console.log('💡 Para habilitar emails, configura:');
      console.log('   SMTP_USER=goparirisvaleria@gmail.com');
      console.log('   SMTP_PASS=tu-app-password-de-16-caracteres');
      return false;
    }

    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465, // true para puerto 465, false para otros
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
      }
    });

    console.log('✅ Servicio de email inicializado correctamente');
    console.log('📧 Emails se enviarán desde:', config.smtp.user);

    // Test de conexión SMTP
    console.log('🔍 === PROBANDO CONEXIÓN SMTP ===');
    transporter.verify((error, success) => {
      if (error) {
        console.error('❌ ERROR DE CONEXIÓN SMTP:', error.message);
        if (error.message.includes('Username and Password not accepted')) {
          console.error('🚨 PROBLEMA: App Password de Gmail inválido');
          console.error('💡 SOLUCIÓN: Regenera el App Password en Gmail');
          console.error('   1. Ve a https://myaccount.google.com');
          console.error('   2. Seguridad → Contraseñas de aplicaciones');
          console.error('   3. ELIMINA la anterior y crea una NUEVA');
          console.error('   4. Usa los 16 caracteres SIN ESPACIOS');
        }
      } else {
        console.log('✅ CONEXIÓN SMTP EXITOSA - Ready to send emails');
      }
    });

    return true;
  } catch (error) {
    console.error('❌ Error inicializando servicio de email:', error.message);
    return false;
  }
}

/**
 * Enviar email de confirmación de cita
 */
async function sendAppointmentConfirmation(appointmentData) {
  try {
    if (!transporter) {
      console.log('📧 Email no configurado - saltando envío');
      return { success: false, reason: 'SMTP no configurado' };
    }

    // Verificar que tenemos credenciales válidas
    if (!config.smtp.pass || config.smtp.pass.trim() === '') {
      console.log('⚠️ SMTP_PASS vacío - necesitas configurar App Password de Gmail');
      return { success: false, reason: 'SMTP_PASS no configurado' };
    }

    const { 
      clientName, 
      clientEmail, 
      date, 
      time, 
      serviceName, 
      profesionalName, 
      codigoReserva 
    } = appointmentData;

    // Formatear fecha en español
    const fechaFormateada = moment.tz(date, config.timezone.default).format('dddd, D [de] MMMM [de] YYYY');
    const horaFormateada = formatTimeTo12Hour(time);

    const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #28a745; margin: 0;">✅ Cita Confirmada</h1>
          <p style="color: #6c757d; margin: 5px 0;">Tu cita ha sido agendada exitosamente</p>
        </div>

        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #2e7d32; margin-top: 0;">📅 Detalles de tu Cita</h2>
          <p><strong>👤 Cliente:</strong> ${clientName}</p>
          <p><strong>📅 Fecha:</strong> ${fechaFormateada}</p>
          <p><strong>⏰ Hora:</strong> ${horaFormateada}</p>
          <p><strong>👨‍⚕️ Especialista:</strong> ${profesionalName}</p>
          <p><strong>🩺 Servicio:</strong> ${serviceName}</p>
          <p><strong>🎟️ Código de Reserva:</strong> <span style="font-size: 18px; font-weight: bold; color: #d32f2f;">${codigoReserva}</span></p>
        </div>

        <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #ef6c00; margin-top: 0;">⚠️ Importante</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Llega 10 minutos antes de tu cita</li>
            <li>Guarda tu código de reserva: <strong>${codigoReserva}</strong></li>
            <li>Si necesitas cancelar, contacta con al menos 2 horas de anticipación</li>
          </ul>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #6c757d; margin: 0;">
            <strong>${config.business.name}</strong><br>
            📞 ${config.business.phone}<br>
            📧 ${config.business.email}<br>
            📍 ${config.business.address}
          </p>
        </div>

      </div>
    </div>
    `;

    const mailOptions = {
      from: `"${config.business.name}" <${config.smtp.user}>`,
      to: clientEmail,
      subject: `✅ Cita Confirmada - ${fechaFormateada} a las ${horaFormateada} - Código: ${codigoReserva}`,
      html: emailContent
    };

    console.log('📧 === ENVIANDO EMAIL DE CONFIRMACIÓN ===');
    console.log('Para:', clientEmail);
    console.log('Asunto:', mailOptions.subject);

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email enviado exitosamente:', result.messageId);

    return { 
      success: true, 
      messageId: result.messageId,
      to: clientEmail 
    };

  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    
    // Errores específicos de Gmail
    if (error.message.includes('Username and Password not accepted')) {
      console.error('🔐 PROBLEMA DE CREDENCIALES:');
      console.error('   1. Verifica que SMTP_USER sea: goparirisvaleria@gmail.com');
      console.error('   2. SMTP_PASS debe ser un App Password de Gmail (16 caracteres)');
      console.error('   3. Ve a https://myaccount.google.com → Seguridad → Contraseñas de aplicaciones');
      console.error('   4. Genera una nueva contraseña de aplicación para "Mail"');
    }
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Enviar email de notificación de nueva cita al negocio
 */
async function sendNewAppointmentNotification(appointmentData) {
  try {
    if (!transporter) {
      console.log('📧 Email no configurado - saltando envío de notificación');
      return { success: false, reason: 'SMTP no configurado' };
    }

    // Verificar que tenemos credenciales válidas
    if (!config.smtp.pass || config.smtp.pass.trim() === '') {
      console.log('⚠️ SMTP_PASS vacío - necesitas configurar App Password de Gmail');
      return { success: false, reason: 'SMTP_PASS no configurado' };
    }

    const { 
      clientName, 
      clientEmail, 
      clientPhone,
      date, 
      time, 
      serviceName, 
      profesionalName, 
      codigoReserva 
    } = appointmentData;

    // Formatear fecha en español
    const fechaFormateada = moment.tz(date, config.timezone.default).format('dddd, D [de] MMMM [de] YYYY');
    const horaFormateada = formatTimeTo12Hour(time);

    // Email de notificación para el negocio (similar al de la imagen)
    const notificationContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #3498db, #2980b9); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          📅
        </div>
        <h1 style="margin: 0; font-size: 28px;">Nueva Cita Agendada</h1>
        <p style="margin: 10px 0 0; font-size: 16px;">Sistema de Agendamiento WhatsApp</p>
      </div>

      <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        
        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #1976d2; margin-top: 0; font-size: 20px;">Nueva Reserva Confirmada 🎉</h2>
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="color: #1976d2; margin-bottom: 15px; display: flex; align-items: center;">
            👤 Información del Cliente
          </h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; font-weight: bold; color: #666;">📝 Nombre:</td>
              <td style="padding: 8px 0;">${clientName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px 0; font-weight: bold; color: #666;">📧 Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${clientEmail}" style="color: #1976d2;">${clientEmail}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #666;">📱 Teléfono:</td>
              <td style="padding: 8px 0;"><a href="tel:${clientPhone}" style="color: #1976d2;">${clientPhone}</a></td>
            </tr>
          </table>
        </div>

        <div style="background-color: #f3e5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #7b1fa2; margin-top: 0; display: flex; align-items: center;">
            📅 Detalles de la Cita
          </h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e1bee7;">
              <td style="padding: 8px 0; font-weight: bold; color: #7b1fa2;">📅 Fecha:</td>
              <td style="padding: 8px 0; font-size: 18px; font-weight: bold;">${fechaFormateada}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
          <p style="margin: 0; color: #666; font-size: 14px;">
            Cita agendada automáticamente vía WhatsApp<br>
            Código de reserva: <strong>${codigoReserva}</strong>
          </p>
        </div>

      </div>
    </div>
    `;

    const mailOptions = {
      from: `"${config.business.name}" <${config.smtp.user}>`,
      to: config.business.email, // Enviar al email del negocio
      subject: `Nueva Cita Agendada - ${clientName} - ${fechaFormateada} ${horaFormateada}`,
      html: notificationContent
    };

    console.log('📧 === ENVIANDO NOTIFICACIÓN DE NUEVA CITA ===');
    console.log('Para negocio:', config.business.email);
    console.log('Cliente:', clientName);
    console.log('Asunto:', mailOptions.subject);

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Notificación enviada exitosamente:', result.messageId);

    return { 
      success: true, 
      messageId: result.messageId,
      to: config.business.email 
    };

  } catch (error) {
    console.error('❌ Error enviando notificación:', error.message);
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}


// Inicializar servicio al cargar el módulo
const emailServiceReady = initializeEmailService();

module.exports = { 
  sendAppointmentConfirmation, 
  sendNewAppointmentNotification,
  emailServiceReady,
  initializeEmailService 
}; 