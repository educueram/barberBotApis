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
    if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
      console.log('⚠️ SMTP no configurado - emails deshabilitados');
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
  emailServiceReady,
  initializeEmailService 
}; 