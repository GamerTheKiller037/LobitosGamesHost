// server/routes/auth.js
// Rutas: /api/auth/register, /login, /refresh, /logout,
//        /mfa/verify, /reset/request, /reset/confirm, /sessions

const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Session = require("../models/Session");

const ACCESS_SECRET = process.env.JWT_SECRET || "lobitos_jwt_secret_2026";
const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "lobitos_refresh_secret_2026";
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || "";

// ── Helper: generar tokens ────────────────────────────────────────────────────
function signAccess(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
}
function signRefresh(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
}

// ── Helper: verificar reCAPTCHA ───────────────────────────────────────────────
async function verifyRecaptcha(token) {
  if (!RECAPTCHA_SECRET || !token) return true; // omitir en dev si no hay secret
  const res = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${token}`,
    { method: "POST" },
  );
  const json = await res.json();
  return json.success;
}

// ── Helper: info dispositivo ──────────────────────────────────────────────────
function getDeviceInfo(req) {
  const ua = req.headers["user-agent"] || "";
  return /mobile/i.test(ua) ? "Móvil" : "Escritorio";
}

// ══════════════════════════════════════════════════════════════
// POST /api/auth/register
// ══════════════════════════════════════════════════════════════
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

    // Verificar reCAPTCHA
    if (!(await verifyRecaptcha(recaptchaToken))) {
      return res.status(400).json({ error: "Verificación reCAPTCHA fallida." });
    }

    // Validaciones
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
      if (exists.username === username)
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

    res.status(201).json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    console.error("[Register]", err);
    res.status(500).json({ error: "Error al registrar usuario." });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/auth/login
// ══════════════════════════════════════════════════════════════
router.post("/login", async (req, res) => {
  try {
    const { emailOrUsername, password, recaptchaToken } = req.body;

    if (!(await verifyRecaptcha(recaptchaToken)))
      return res.status(400).json({ error: "Verificación reCAPTCHA fallida." });

    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });
    if (!user)
      return res.status(401).json({ error: "Credenciales incorrectas." });

    if (!user.activo)
      return res.status(403).json({ error: "Cuenta desactivada." });

    // Verificar bloqueo
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const rem = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return res
        .status(429)
        .json({ error: `Cuenta bloqueada. Intenta en ${rem} min.` });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      user.failedAttempts = (user.failedAttempts || 0) + 1;
      if (user.failedAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.failedAttempts = 0;
      }
      await user.save();
      return res.status(401).json({ error: "Credenciales incorrectas." });
    }

    user.failedAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    // Si tiene MFA activo
    if (user.mfaEnabled) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      // En producción: enviar por email real con nodemailer
      console.log(`[MFA] OTP para ${user.email}: ${otp}`);
      // Guardar OTP en base de datos (simplificado: en memoria/redis en producción)
      return res.json({
        success: true,
        requiresMfa: true,
        userId: user._id,
        mfaOtp: otp /* SOLO DEMO */,
      });
    }

    // Crear sesión
    const session = await Session.create({
      userId: user._id,
      ipAddress: req.ip,
      userAgent: (req.headers["user-agent"] || "").slice(0, 120),
      deviceInfo: getDeviceInfo(req),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const payload = {
      id: user._id,
      username: user.username,
      role: user.role,
      sessionId: session._id,
    };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh({ id: user._id, sessionId: session._id });

    res.json({
      success: true,
      user: { ...user.toSafeObject(), sessionId: session._id },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("[Login]", err);
    res.status(500).json({ error: "Error al iniciar sesión." });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/auth/refresh
// ══════════════════════════════════════════════════════════════
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(401).json({ error: "No hay refresh token." });
  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "Usuario no encontrado." });
    const newAccess = signAccess({
      id: user._id,
      username: user.username,
      role: user.role,
      sessionId: decoded.sessionId,
    });
    res.json({ accessToken: newAccess });
  } catch {
    res.status(401).json({ error: "Refresh token inválido o expirado." });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/auth/logout
// ══════════════════════════════════════════════════════════════
router.post("/logout", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (sessionId)
      await Session.findByIdAndUpdate(sessionId, { isActive: false });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Error al cerrar sesión." });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/auth/sessions/:userId
// ══════════════════════════════════════════════════════════════
router.get("/sessions/:userId", async (req, res) => {
  try {
    const sessions = await Session.find({
      userId: req.params.userId,
      isActive: true,
    });
    res.json({ sessions });
  } catch {
    res.status(500).json({ error: "Error al obtener sesiones." });
  }
});

// ══════════════════════════════════════════════════════════════
// DELETE /api/auth/sessions/:sessionId  — revocar sesión específica
// ══════════════════════════════════════════════════════════════
router.delete("/sessions/:sessionId", async (req, res) => {
  try {
    await Session.findByIdAndUpdate(req.params.sessionId, { isActive: false });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Error al revocar sesión." });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/auth/reset/request   — solicitar reset por email
// ══════════════════════════════════════════════════════════════
router.post("/reset/request", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "Email no registrado." });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    // En producción guardar en colección PasswordReset y enviar email
    console.log(`[RESET] Token para ${email}: ${token}`);
    // Aquí iría: await sendResetEmail(email, token);

    res.json({
      success: true,
      message: "Token generado (ver consola para demo).",
      token /* SOLO DEMO */,
    });
  } catch {
    res.status(500).json({ error: "Error al solicitar reset." });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/auth/reset/confirm
// ══════════════════════════════════════════════════════════════
router.post("/reset/confirm", async (req, res) => {
  try {
    const { token, newPassword, email } = req.body;
    // En producción validar token contra la BD. En demo aceptamos directo.
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: "Contraseña actualizada." });
  } catch {
    res.status(500).json({ error: "Error al restablecer contraseña." });
  }
});

module.exports = router;
