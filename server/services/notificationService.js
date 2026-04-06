// server/services/notificationService.js
// Servicio real de correo (Nodemailer) y SMS (Twilio)
// Requiere en .env:
//   MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER

const nodemailer = require("nodemailer");

// ── Twilio (opcional — solo si está configurado) ──────────────────────────────
let twilioClient = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require("twilio");
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
    console.log("✅ Twilio inicializado");
  } else {
    console.log("ℹ️  Twilio no configurado — SMS serán simulados en consola");
  }
} catch (e) {
  console.warn("⚠️  twilio no instalado — ejecuta: npm install twilio");
}

// ── Transporte de correo ──────────────────────────────────────────────────────
function createMailTransporter() {
  const host = process.env.MAIL_HOST;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;

  if (!host || !user || !pass) {
    // Sin credenciales: usar Ethereal (captura emails sin enviarlos, útil para pruebas)
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.MAIL_PORT || "587"),
    secure: process.env.MAIL_PORT === "465",
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

// ── Enviar email de recuperación de contraseña ────────────────────────────────
async function sendPasswordResetEmail(toEmail, resetToken, userName) {
  const transporter = createMailTransporter();

  const resetLink = `${
    process.env.CLIENT_ORIGIN || "http://localhost:5500"
  }/#reset?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: sans-serif; background:#0d0d1a; color:#e0e0e0; padding:40px;">
      <div style="max-width:500px; margin:0 auto; background:#1a0533; border-radius:12px; padding:32px; border:1px solid #6809e5;">
        <h2 style="color:#6809e5; margin-bottom:8px;">LobitosGames</h2>
        <h3 style="margin-bottom:16px;">Recuperación de contraseña</h3>
        <p>Hola <strong>${userName || "usuario"}</strong>,</p>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
        <p>Tu token de recuperación es:</p>
        <div style="background:#0d0d1a; border:1px solid #6809e5; border-radius:8px; padding:16px; text-align:center; font-size:24px; font-weight:bold; letter-spacing:4px; color:#9f59fc; margin:20px 0;">
          ${resetToken}
        </div>
        <p>O puedes hacer clic en el siguiente enlace:</p>
        <a href="${resetLink}" style="display:inline-block; background:#6809e5; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; margin:12px 0;">
          Restablecer contraseña
        </a>
        <p style="color:#888; font-size:13px; margin-top:24px;">
          Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.
        </p>
      </div>
    </body>
    </html>`;

  if (!transporter) {
    // Modo demo: usar Ethereal para capturar el email sin enviarlo
    try {
      const testAccount = await nodemailer.createTestAccount();
      const testTransporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      const info = await testTransporter.sendMail({
        from: `"LobitosGames" <${testAccount.user}>`,
        to: toEmail,
        subject: "Recuperación de contraseña — LobitosGames",
        html,
      });
      console.log(
        `📧 [Demo] Email capturado en Ethereal. Ver en: ${nodemailer.getTestMessageUrl(info)}`,
      );
      console.log(`🔑 Token de recuperación para ${toEmail}: ${resetToken}`);
      return {
        success: true,
        demo: true,
        previewUrl: nodemailer.getTestMessageUrl(info),
      };
    } catch (e) {
      console.log(`🔑 Token de recuperación para ${toEmail}: ${resetToken}`);
      return { success: true, demo: true };
    }
  }

  try {
    await transporter.sendMail({
      from: `"LobitosGames" <${process.env.MAIL_FROM || process.env.MAIL_USER}>`,
      to: toEmail,
      subject: "Recuperación de contraseña — LobitosGames",
      html,
    });
    console.log(`📧 Email de recuperación enviado a ${toEmail}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error enviando email:", error.message);
    // Fallback: mostrar token en consola para no bloquear el flujo
    console.log(`🔑 (fallback) Token para ${toEmail}: ${resetToken}`);
    return { success: false, error: error.message };
  }
}

// ── Enviar email de código MFA ────────────────────────────────────────────────
async function sendMfaCodeEmail(toEmail, code, userName) {
  const transporter = createMailTransporter();

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; background:#0d0d1a; color:#e0e0e0; padding:40px;">
      <div style="max-width:500px; margin:0 auto; background:#1a0533; border-radius:12px; padding:32px; border:1px solid #6809e5;">
        <h2 style="color:#6809e5;">LobitosGames — Verificación en dos pasos</h2>
        <p>Hola <strong>${userName || "usuario"}</strong>,</p>
        <p>Tu código de verificación es:</p>
        <div style="background:#0d0d1a; border:1px solid #6809e5; border-radius:8px; padding:20px; text-align:center; font-size:36px; font-weight:bold; letter-spacing:8px; color:#9f59fc; margin:20px 0;">
          ${code}
        </div>
        <p style="color:#888; font-size:13px;">Este código expira en 10 minutos.</p>
      </div>
    </body>
    </html>`;

  if (!transporter) {
    // Demo: Ethereal
    try {
      const testAccount = await nodemailer.createTestAccount();
      const testTransporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      const info = await testTransporter.sendMail({
        from: `"LobitosGames" <${testAccount.user}>`,
        to: toEmail,
        subject: "Código de verificación MFA — LobitosGames",
        html,
      });
      console.log(
        `📧 [Demo] Código MFA en Ethereal: ${nodemailer.getTestMessageUrl(info)}`,
      );
      console.log(`🔑 Código MFA para ${toEmail}: ${code}`);
      return { success: true, demo: true };
    } catch {
      console.log(`🔑 Código MFA para ${toEmail}: ${code}`);
      return { success: true, demo: true };
    }
  }

  try {
    await transporter.sendMail({
      from: `"LobitosGames" <${process.env.MAIL_FROM || process.env.MAIL_USER}>`,
      to: toEmail,
      subject: "Código de verificación MFA — LobitosGames",
      html,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Error enviando código MFA:", error.message);
    console.log(`🔑 (fallback) Código MFA para ${toEmail}: ${code}`);
    return { success: false };
  }
}

// ── Enviar SMS con OTP ────────────────────────────────────────────────────────
async function sendSmsOtp(phoneNumber, code, userName) {
  if (!twilioClient) {
    // Demo: mostrar en consola
    console.log(`📱 [Demo SMS] Código OTP para ${phoneNumber}: ${code}`);
    return { success: true, demo: true };
  }

  try {
    await twilioClient.messages.create({
      body: `Tu código de verificación de LobitosGames es: ${code}. Expira en 10 minutos.`,
      from: process.env.TWILIO_FROM_NUMBER,
      to: phoneNumber,
    });
    console.log(`📱 SMS enviado a ${phoneNumber}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error enviando SMS:", error.message);
    console.log(`📱 (fallback) Código para ${phoneNumber}: ${code}`);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendMfaCodeEmail,
  sendSmsOtp,
};
