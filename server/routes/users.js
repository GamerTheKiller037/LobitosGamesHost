// server/routes/users.js
// FIX: eliminado el bloque duplicado que redefinía el modelo User al final
// Ahora importa User desde models/User.js correctamente

const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Session = require("../models/Session");

const ACCESS_SECRET = process.env.JWT_SECRET || "lobitos_jwt_secret_2026";

// ── Middleware de autenticación ───────────────────────────────────────────────
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer "))
    return res.status(401).json({ error: "No autenticado." });
  try {
    req.user = jwt.verify(auth.split(" ")[1], ACCESS_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado." });
  }
}

// ── Middleware de roles ───────────────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role))
      return res.status(403).json({ error: "Acceso denegado." });
    next();
  };
}

// GET /api/users/me
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
    res.json({ user: user.toSafeObject() });
  } catch {
    res.status(500).json({ error: "Error." });
  }
});

// PUT /api/users/change-password
router.put("/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
    if (!(await user.comparePassword(currentPassword)))
      return res.status(400).json({ error: "Contraseña actual incorrecta." });
    user.password = newPassword;
    await user.save();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Error." });
  }
});

// PUT /api/users/toggle-mfa
router.put("/toggle-mfa", authenticate, async (req, res) => {
  try {
    const { enable } = req.body;
    await User.findByIdAndUpdate(req.user.id, { mfaEnabled: enable });
    res.json({ success: true, mfaEnabled: enable });
  } catch {
    res.status(500).json({ error: "Error." });
  }
});

// PUT /api/users/preferences
router.put("/preferences", authenticate, async (req, res) => {
  try {
    const { tema, idioma } = req.body;
    await User.findByIdAndUpdate(req.user.id, { tema, idioma });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Error." });
  }
});

// GET /api/users  (solo admin)
router.get("/", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const users = await User.find({}, "-password -secretAnswer -mfaSecret");
    res.json({ users });
  } catch {
    res.status(500).json({ error: "Error." });
  }
});

// PUT /api/users/:id/role  (solo admin)
router.put(
  "/:id/role",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { role } = req.body;
      if (!["admin", "editor", "usuario"].includes(role))
        return res.status(400).json({ error: "Rol inválido." });
      await User.findByIdAndUpdate(req.params.id, { role });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Error." });
    }
  },
);

// DELETE /api/users/:id  (solo admin)
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { activo: false });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Error." });
  }
});

// GET /api/users/sessions  (sesiones del usuario actual)
router.get("/sessions", authenticate, async (req, res) => {
  try {
    const sessions = await Session.find({
      userId: req.user.id,
      isActive: true,
    });
    res.json({ sessions });
  } catch {
    res.status(500).json({ error: "Error." });
  }
});

// DELETE /api/users/sessions/:sessionId  (revocar sesion especifica)
router.delete("/sessions/:sessionId", authenticate, async (req, res) => {
  try {
    await Session.findByIdAndUpdate(req.params.sessionId, { isActive: false });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Error." });
  }
});

module.exports = router;
