// server/routes/auth.js
// Integrado con notificationService — envía emails reales con Nodemailer
// y SMS reales con Twilio (o simula en consola si no están configurados)

const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Session = require("../models/Session");
const {
  sendPasswordResetEmail,
  sendMfaCodeEmail,
  sendSmsOtp,
} = require("../services/notificationService");

const ACCESS_SECRET = process.env.JWT_SECRET || "lobitos_jwt_secret_2026";
const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "lobitos_refresh_secret_2026";
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || "";

function signAccess(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
}
function signRefresh(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
}

async function verifyRecaptcha(token) {
  if (!RECAPTCHA_SECRET || !token) return true;
  const res = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${token}`,
    { method: "POST" },
  );
  const json = await res.json();
  return json.success;
}

function getDeviceInfo(req) {
  const ua = req.headers["user-agent"] || "";
  return /mobile/i.test(ua) ? "Móvil" : "Escritorio";
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      username,
      email,
      password,
      secretQuestion,
      secretAnswer,
      recaptchaToken,
    } = req.body;

    if (!(await verifyRecaptcha(recaptchaToken)))
      return res.status(400).json({ error: "Verificación reCAPTCHA fallida." });
    if (!nombre || !apellido || !username || !email || !password)
      return res
        .status(400)
        .json({ error: "Todos los campos son requeridos." });
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(password))
      return res
        .status(400)
        .json({ error: "La contraseña no cumple los requisitos." });

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) {
      if (exists.email === email)
        return res.status(400).json({ error: "El correo ya está registrado." });
      return res
        .status(400)
        .json({ error: "El nombre de usuario ya está en uso." });
    }

    const user = new User({
      nombre,
      apellido,
      username,
      email,
      password,
      secretQuestion: secretQuestion || null,
      secretAnswer: secretAnswer
        ? await bcrypt.hash(secretAnswer.toLowerCase(), 10)
        : null,
    });
    await user.save();
    res
      .status(201)
      .json({ success: true, message: "Usuario registrado exitosamente." });
  } catch (err) {
    console.error("[Register]", err);
    res.status(500).json({ error: "Error al registrar usuario." });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { emailOrUsername, password, recaptchaToken } = req.body;

    if (!(await verifyRecaptcha(recaptchaToken)))
      return res.status(400).json({ error: "Verificación reCAPTCHA fallida." });

    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
      activo: true,
    });

    if (!user)
      return res.status(401).json({ error: "Credenciales inválidas." });

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return res
        .status(423)
        .json({ error: `Cuenta bloqueada. Intenta en ${mins} minutos.` });
    }

    if (!(await user.comparePassword(password))) {
      user.failedAttempts = (user.failedAttempts || 0) + 1;
      if (user.failedAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.failedAttempts = 0;
      }
      await user.save();
      return res.status(401).json({ error: "Credenciales inválidas." });
    }

    user.failedAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    // Si tiene MFA activo, enviar código por email y requerir verificación
    if (user.mfaEnabled) {
      const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.mfaSecret = mfaCode;
      user.mfaExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      // Enviar código real por email
      await sendMfaCodeEmail(user.email, mfaCode, user.nombre);

      return res.json({ requiresMfa: true, userId: user._id });
    }

    const session = new Session({
      userId: user._id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || "",
      deviceInfo: getDeviceInfo(req),
      isActive: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await session.save();

    const payload = { id: user._id, role: user.role, sessionId: session._id };
    res.json({
      success: true,
      accessToken: signAccess(payload),
      refreshToken: signRefresh(payload),
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error("[Login]", err);
    res.status(500).json({ error: "Error interno." });
  }
});

// ── POST /api/auth/mfa/verify ─────────────────────────────────────────────────
router.post("/mfa/verify", async (req, res) => {
  try {
    const { userId, code } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado." });

    if (!user.mfaSecret || !user.mfaExpiry || user.mfaExpiry < new Date())
      return res
        .status(400)
        .json({ error: "Código expirado. Inicia sesión de nuevo." });

    if (user.mfaSecret !== code)
      return res.status(400).json({ error: "Código incorrecto." });

    user.mfaSecret = null;
    user.mfaExpiry = null;
    await user.save();

    const session = new Session({
      userId: user._id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || "",
      deviceInfo: getDeviceInfo(req),
      isActive: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await session.save();

    const payload = { id: user._id, role: user.role, sessionId: session._id };
    res.json({
      success: true,
      accessToken: signAccess(payload),
      refreshToken: signRefresh(payload),
      user: user.toSafeObject(),
    });
  } catch (err) {
    res.status(500).json({ error: "Error." });
  }
});

// ── POST /api/auth/reset/request (por email) ──────────────────────────────────
router.post("/reset/request", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Siempre responder igual para no revelar si el email existe
    const genericMsg =
      "Si el correo está registrado recibirás las instrucciones.";

    if (!user) return res.json({ success: true, message: genericMsg });

    const token = crypto
      .randomBytes(32)
      .toString("hex")
      .slice(0, 8)
      .toUpperCase();
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await user.save();

    const result = await sendPasswordResetEmail(email, token, user.nombre);

    if (result.demo && result.previewUrl) {
      console.log(`📧 Preview del email: ${result.previewUrl}`);
    }

    res.json({ success: true, message: genericMsg });
  } catch (err) {
    console.error("[Reset Request]", err);
    res.status(500).json({ error: "Error." });
  }
});

// ── POST /api/auth/reset/confirm ──────────────────────────────────────────────
router.post("/reset/confirm", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });
    if (!user)
      return res.status(400).json({ error: "Token inválido o expirado." });

    user.password = newPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({
      success: true,
      message: "Contraseña actualizada correctamente.",
    });
  } catch (err) {
    res.status(500).json({ error: "Error." });
  }
});

// ── POST /api/auth/reset/sms ──────────────────────────────────────────────────
router.post("/reset/sms", async (req, res) => {
  try {
    const { phone } = req.body;
    // En producción buscarías el usuario por su número de teléfono
    // Por ahora generamos el código y lo enviamos al número proporcionado
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const result = await sendSmsOtp(phone, code, "usuario");

    // Guardar el código temporalmente (en producción en la DB asociado al usuario)
    // Para demo lo guardamos en memoria temporal
    global._smsOtpStore = global._smsOtpStore || {};
    global._smsOtpStore[phone] = {
      code,
      expiry: new Date(Date.now() + 10 * 60 * 1000),
    };

    if (result.demo) {
      res.json({
        success: true,
        message: "Código enviado (demo: revisa la consola del servidor).",
        demo: true,
      });
    } else {
      res.json({ success: true, message: "Código enviado por SMS." });
    }
  } catch (err) {
    console.error("[SMS Reset]", err);
    res.status(500).json({ error: "Error enviando SMS." });
  }
});

// ── POST /api/auth/reset/sms/verify ──────────────────────────────────────────
router.post("/reset/sms/verify", async (req, res) => {
  try {
    const { phone, code, newPassword } = req.body;
    const stored = global._smsOtpStore?.[phone];

    if (!stored || stored.expiry < new Date() || stored.code !== code)
      return res.status(400).json({ error: "Código inválido o expirado." });

    delete global._smsOtpStore[phone];
    res.json({
      success: true,
      message: "Código verificado. Puedes cambiar tu contraseña.",
    });
  } catch (err) {
    res.status(500).json({ error: "Error." });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post("/logout", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(auth.split(" ")[1], ACCESS_SECRET);
        await Session.findByIdAndUpdate(decoded.sessionId, { isActive: false });
      } catch {
        /* token expirado, igual cerrar sesión */
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error." });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(401).json({ error: "Token requerido." });

    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    const session = await Session.findById(decoded.sessionId);
    if (!session || !session.isActive)
      return res.status(401).json({ error: "Sesión inválida." });

    const user = await User.findById(decoded.id);
    if (!user || !user.activo)
      return res.status(401).json({ error: "Usuario inactivo." });

    const payload = { id: user._id, role: user.role, sessionId: session._id };
    res.json({ accessToken: signAccess(payload) });
  } catch {
    res.status(401).json({ error: "Token inválido o expirado." });
  }
});

// ── GET /api/auth/sessions ────────────────────────────────────────────────────
router.get("/sessions", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: "No autenticado." });
    const decoded = jwt.verify(auth.split(" ")[1], ACCESS_SECRET);
    const sessions = await Session.find({ userId: decoded.id, isActive: true });
    res.json({ sessions });
  } catch {
    res.status(401).json({ error: "Token inválido." });
  }
});

module.exports = router;
