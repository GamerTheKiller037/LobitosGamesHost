// js/models/userModel.js
// UserModel — sin cuentas de prueba hardcodeadas, compatible con backend MongoDB.
// En modo "demo" (sin servidor) usa localStorage. Cuando el backend esté activo,
// todas las llamadas van a /api/auth/*.

const PLACEHOLDER_USER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect width='100%25' height='100%25' fill='%231a0533'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='18' fill='%236809e5'%3EUser%3C/text%3E%3C/svg%3E";

// ── Modo backend ──────────────────────────────────────────────────────────────
// Cambiar a true cuando el servidor Node.js esté activo.
const USE_BACKEND = false;
const API_BASE = "http://localhost:5000/api";

// ── Hash simple (solo para demo/localStorage) ─────────────────────────────────
function hashPassword(pwd) {
  let h = 0;
  for (let i = 0; i < pwd.length; i++) {
    const c = pwd.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & h;
  }
  return "$sim$" + Math.abs(h).toString(36);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── JWT simulado ──────────────────────────────────────────────────────────────
const JWTUtil = {
  SECRET: "lobitos_jwt_secret_2026",
  REFRESH_SECRET: "lobitos_refresh_secret_2026",

  sign(payload, secret, expiresInMs) {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const exp = Date.now() + expiresInMs;
    const body = btoa(JSON.stringify({ ...payload, exp, iat: Date.now() }));
    const sig = btoa(secret + body).slice(0, 20);
    return `${header}.${body}.${sig}`;
  },

  verify(token, secret) {
    try {
      const [, body, sig] = token.split(".");
      if (btoa(secret + body).slice(0, 20) !== sig)
        throw new Error("Firma inválida");
      const payload = JSON.parse(atob(body));
      if (Date.now() > payload.exp) throw new Error("Token expirado");
      return { valid: true, payload };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  },

  generateAccessToken(user) {
    return this.sign(
      {
        id: user.id || user._id,
        username: user.username,
        role: user.role,
        sessionId: user.sessionId,
      },
      this.SECRET,
      15 * 60 * 1000,
    );
  },
  generateRefreshToken(user) {
    return this.sign(
      { id: user.id || user._id, type: "refresh" },
      this.REFRESH_SECRET,
      7 * 24 * 60 * 60 * 1000,
    );
  },
};

// ── UserModel ─────────────────────────────────────────────────────────────────
class UserModel {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.accessToken = null;
    this.pendingMfaUser = null;
    this._loadFromStorage();
  }

  _loadFromStorage() {
    const raw = localStorage.getItem("lg_current_user");
    const tok = localStorage.getItem("lg_access_token");
    if (!raw || !tok) return;
    const check = JWTUtil.verify(tok, JWTUtil.SECRET);
    if (!check.valid) {
      this.logout();
      return;
    }
    this.currentUser = JSON.parse(raw);
    this.accessToken = tok;
    this.isAuthenticated = true;
  }

  _getUsers() {
    return JSON.parse(localStorage.getItem("lg_users") || "[]");
  }
  _saveUsers(u) {
    localStorage.setItem("lg_users", JSON.stringify(u));
  }

  _sanitize(user) {
    const { password, secretAnswer, mfaSecret, ...safe } = user;
    return safe;
  }

  // ── Registro ────────────────────────────────────────────────────────────────

  async register(data) {
    if (USE_BACKEND) {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.error };
      return { success: true, user: json.user };
    }

    const users = this._getUsers();
    if (users.find((u) => u.email === data.email))
      return { success: false, error: "El correo ya está registrado" };
    if (users.find((u) => u.username === data.username))
      return { success: false, error: "El nombre de usuario ya está en uso" };

    const newUser = {
      id: generateId(),
      username: data.username,
      email: data.email,
      password: hashPassword(data.password),
      nombre: data.nombre,
      apellido: data.apellido,
      role: "usuario",
      mfaEnabled: false,
      mfaSecret: null,
      avatar: PLACEHOLDER_USER,
      secretQuestion: data.secretQuestion || null,
      secretAnswer: data.secretAnswer ? hashPassword(data.secretAnswer) : null,
      failedAttempts: 0,
      lockedUntil: null,
      tema: "dark",
      idioma: "es",
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    this._saveUsers(users);
    return { success: true, user: this._sanitize(newUser) };
  }

  // ── Login ────────────────────────────────────────────────────────────────────

  login(emailOrUsername, password) {
    if (USE_BACKEND) {
      // En modo backend el login es async; aquí hacemos la llamada
      return this._loginBackend(emailOrUsername, password);
    }

    const users = this._getUsers();
    const user = users.find(
      (u) => u.email === emailOrUsername || u.username === emailOrUsername,
    );
    if (!user) return { success: false, error: "Credenciales incorrectas" };

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const rem = Math.ceil((new Date(user.lockedUntil) - Date.now()) / 60000);
      return {
        success: false,
        error: `Cuenta bloqueada. Intenta en ${rem} min.`,
      };
    }

    if (user.password !== hashPassword(password)) {
      user.failedAttempts = (user.failedAttempts || 0) + 1;
      if (user.failedAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        user.failedAttempts = 0;
        this._logSecurity(user.id, "brute_force", "Cuenta bloqueada 15 min");
      }
      this._saveUsers(users.map((u) => (u.id === user.id ? user : u)));
      return { success: false, error: "Credenciales incorrectas" };
    }

    user.failedAttempts = 0;
    user.lockedUntil = null;
    this._saveUsers(users.map((u) => (u.id === user.id ? user : u)));

    if (user.mfaEnabled) {
      this.pendingMfaUser = user;
      const otp = this._generateMfaCode(user.id);
      console.log(`[MFA] Código OTP para ${user.email}: ${otp}`);
      return { success: true, requiresMfa: true };
    }
    return this._completeLogin(user);
  }

  async _loginBackend(emailOrUsername, password) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrUsername, password }),
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.error };
      // Guardar tokens del servidor
      this.currentUser = json.user;
      this.accessToken = json.accessToken;
      this.isAuthenticated = true;
      localStorage.setItem("lg_current_user", JSON.stringify(json.user));
      localStorage.setItem("lg_access_token", json.accessToken);
      localStorage.setItem("lg_refresh_token", json.refreshToken);
      return { success: true, user: json.user };
    } catch (err) {
      return { success: false, error: "Error de conexión al servidor." };
    }
  }

  // ── MFA ──────────────────────────────────────────────────────────────────────

  verifyMfa(code) {
    if (!this.pendingMfaUser)
      return { success: false, error: "No hay sesión MFA pendiente" };
    const codes = JSON.parse(localStorage.getItem("lg_mfa_codes") || "[]");
    const entry = codes.find(
      (c) =>
        c.userId === this.pendingMfaUser.id &&
        c.code === code &&
        !c.used &&
        new Date(c.expiresAt) > new Date(),
    );
    if (!entry) {
      this._logSecurity(this.pendingMfaUser.id, "mfa_failed", "OTP incorrecto");
      return { success: false, error: "Código inválido o expirado" };
    }
    entry.used = true;
    localStorage.setItem("lg_mfa_codes", JSON.stringify(codes));
    const user = this.pendingMfaUser;
    this.pendingMfaUser = null;
    return this._completeLogin(user);
  }

  _generateMfaCode(userId) {
    const code = generateOTP();
    const codes = JSON.parse(localStorage.getItem("lg_mfa_codes") || "[]");
    codes.push({
      userId,
      code,
      used: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    localStorage.setItem("lg_mfa_codes", JSON.stringify(codes));
    return code;
  }

  _completeLogin(user) {
    const sessionId = generateId();
    const session = {
      id: sessionId,
      userId: user.id,
      ipAddress: "127.0.0.1",
      userAgent: navigator.userAgent.slice(0, 120),
      deviceInfo: /mobile/i.test(navigator.userAgent) ? "Móvil" : "Escritorio",
      isActive: true,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const sessions = JSON.parse(localStorage.getItem("lg_sessions") || "[]");
    sessions.push(session);
    localStorage.setItem("lg_sessions", JSON.stringify(sessions));

    const userWithSess = { ...user, sessionId };
    const accessToken = JWTUtil.generateAccessToken(userWithSess);
    const refreshToken = JWTUtil.generateRefreshToken(userWithSess);
    this.currentUser = this._sanitize(userWithSess);
    this.accessToken = accessToken;
    this.isAuthenticated = true;
    localStorage.setItem("lg_current_user", JSON.stringify(this.currentUser));
    localStorage.setItem("lg_access_token", accessToken);
    localStorage.setItem("lg_refresh_token", refreshToken);
    this._logSecurity(user.id, "login_success", "Login exitoso");
    return { success: true, user: this.currentUser, accessToken, refreshToken };
  }

  // ── Refresh ──────────────────────────────────────────────────────────────────

  refreshAccessToken() {
    const rt = localStorage.getItem("lg_refresh_token");
    if (!rt) return { success: false };
    const check = JWTUtil.verify(rt, JWTUtil.REFRESH_SECRET);
    if (!check.valid) {
      this.logout();
      return { success: false };
    }
    const users = this._getUsers();
    const user = users.find((u) => u.id === check.payload.id);
    if (!user) return { success: false };
    const newAccess = JWTUtil.generateAccessToken({
      ...user,
      sessionId: check.payload.sessionId,
    });
    this.accessToken = newAccess;
    localStorage.setItem("lg_access_token", newAccess);
    return { success: true, accessToken: newAccess };
  }

  // ── Logout ───────────────────────────────────────────────────────────────────

  logout(sessionId = null) {
    if (sessionId) {
      this._revokeSession(sessionId);
      return;
    }
    if (this.currentUser?.sessionId)
      this._revokeSession(this.currentUser.sessionId);
    this.currentUser = null;
    this.accessToken = null;
    this.isAuthenticated = false;
    localStorage.removeItem("lg_current_user");
    localStorage.removeItem("lg_access_token");
    localStorage.removeItem("lg_refresh_token");
  }

  _revokeSession(sessionId) {
    const sessions = JSON.parse(
      localStorage.getItem("lg_sessions") || "[]",
    ).map((s) => (s.id === sessionId ? { ...s, isActive: false } : s));
    localStorage.setItem("lg_sessions", JSON.stringify(sessions));
  }

  getActiveSessions(userId) {
    const sessions = JSON.parse(localStorage.getItem("lg_sessions") || "[]");
    return sessions.filter(
      (s) => s.userId === (userId || this.currentUser?.id) && s.isActive,
    );
  }

  revokeSession(sessionId) {
    this._revokeSession(sessionId);
    this._logSecurity(this.currentUser?.id, "session_revoked", sessionId);
  }

  // ── Recovery ─────────────────────────────────────────────────────────────────

  requestPasswordReset(email) {
    const users = this._getUsers();
    const user = users.find((u) => u.email === email);
    if (!user) return { success: false, error: "Email no registrado" };
    const token = generateId();
    const resets = JSON.parse(
      localStorage.getItem("lg_password_resets") || "[]",
    );
    resets.push({
      userId: user.id,
      token,
      used: false,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    localStorage.setItem("lg_password_resets", JSON.stringify(resets));
    console.log(`[RESET] Token: ${token}`);
    return {
      success: true,
      message: "Token generado (ver consola para demo).",
      token,
    };
  }

  resetPasswordWithToken(token, newPassword) {
    const resets = JSON.parse(
      localStorage.getItem("lg_password_resets") || "[]",
    );
    const entry = resets.find(
      (r) => r.token === token && !r.used && new Date(r.expiresAt) > new Date(),
    );
    if (!entry) return { success: false, error: "Token inválido o expirado" };
    const users = this._getUsers();
    const idx = users.findIndex((u) => u.id === entry.userId);
    if (idx === -1) return { success: false, error: "Usuario no encontrado" };
    users[idx].password = hashPassword(newPassword);
    this._saveUsers(users);
    entry.used = true;
    localStorage.setItem("lg_password_resets", JSON.stringify(resets));
    return { success: true, message: "Contraseña actualizada." };
  }

  requestSmsReset(userId) {
    const otp = generateOTP();
    const codes = JSON.parse(localStorage.getItem("lg_mfa_codes") || "[]");
    codes.push({
      userId,
      code: otp,
      type: "sms_reset",
      used: false,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    localStorage.setItem("lg_mfa_codes", JSON.stringify(codes));
    console.log(`[SMS] OTP userId ${userId}: ${otp}`);
    return { success: true, message: "OTP enviado (ver consola)" };
  }

  verifySmsReset(userId, code, newPassword) {
    const codes = JSON.parse(localStorage.getItem("lg_mfa_codes") || "[]");
    const entry = codes.find(
      (c) =>
        c.userId === userId &&
        c.code === code &&
        c.type === "sms_reset" &&
        !c.used &&
        new Date(c.expiresAt) > new Date(),
    );
    if (!entry) return { success: false, error: "Código inválido o expirado" };
    const users = this._getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    users[idx].password = hashPassword(newPassword);
    this._saveUsers(users);
    entry.used = true;
    localStorage.setItem("lg_mfa_codes", JSON.stringify(codes));
    return { success: true, message: "Contraseña restablecida." };
  }

  verifySecretQuestion(emailOrUsername, answer) {
    const users = this._getUsers();
    const user = users.find(
      (u) => u.email === emailOrUsername || u.username === emailOrUsername,
    );
    if (!user || !user.secretAnswer)
      return { success: false, error: "Datos incorrectos" };
    if (answer && user.secretAnswer !== hashPassword(answer))
      return { success: false, error: "Respuesta incorrecta" };
    return { success: true, userId: user.id, question: user.secretQuestion };
  }

  // ── Settings ─────────────────────────────────────────────────────────────────

  changePassword(currentPassword, newPassword) {
    if (!this.isLoggedIn()) return { success: false, error: "No autenticado" };
    const users = this._getUsers();
    const user = users.find((u) => u.id === this.currentUser.id);
    if (user.password !== hashPassword(currentPassword))
      return { success: false, error: "Contraseña actual incorrecta" };
    user.password = hashPassword(newPassword);
    this._saveUsers(users);
    return { success: true };
  }

  toggleMfa(enable) {
    if (!this.isLoggedIn()) return { success: false };
    const users = this._getUsers();
    const idx = users.findIndex((u) => u.id === this.currentUser.id);
    users[idx].mfaEnabled = enable;
    this._saveUsers(users);
    this.currentUser.mfaEnabled = enable;
    localStorage.setItem("lg_current_user", JSON.stringify(this.currentUser));
    return { success: true, mfaEnabled: enable };
  }

  updatePreferences(prefs) {
    if (!this.isLoggedIn()) return { success: false };
    const users = this._getUsers();
    const idx = users.findIndex((u) => u.id === this.currentUser.id);
    if (idx !== -1) {
      Object.assign(users[idx], prefs);
      this._saveUsers(users);
    }
    Object.assign(this.currentUser, prefs);
    localStorage.setItem("lg_current_user", JSON.stringify(this.currentUser));
    return { success: true };
  }

  // ── RBAC ─────────────────────────────────────────────────────────────────────

  hasRole(role) {
    return this.currentUser?.role === role;
  }
  hasPermission(perm) {
    const map = {
      admin: [
        "read",
        "write",
        "delete",
        "manage_users",
        "manage_roles",
        "view_sessions",
      ],
      editor: ["read", "write", "manage_catalog"],
      usuario: ["read", "manage_own_lists"],
    };
    return (map[this.currentUser?.role || "usuario"] || []).includes(perm);
  }
  isAdmin() {
    return this.hasRole("admin");
  }
  isEditor() {
    return this.hasRole("editor");
  }
  isLoggedIn() {
    return this.isAuthenticated && !!this.currentUser;
  }
  getCurrentUser() {
    return this.currentUser;
  }
  getAccessToken() {
    return this.accessToken;
  }

  // ── SSO ──────────────────────────────────────────────────────────────────────

  generateSsoToken() {
    if (!this.isLoggedIn()) return null;
    const token = generateId();
    const tokens = JSON.parse(localStorage.getItem("lg_sso_tokens") || "[]");
    tokens.push({
      userId: this.currentUser.id,
      token,
      used: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    localStorage.setItem("lg_sso_tokens", JSON.stringify(tokens));
    return token;
  }

  validateSsoToken(token) {
    const tokens = JSON.parse(localStorage.getItem("lg_sso_tokens") || "[]");
    const entry = tokens.find(
      (t) => t.token === token && !t.used && new Date(t.expiresAt) > new Date(),
    );
    if (!entry) return { valid: false };
    entry.used = true;
    localStorage.setItem("lg_sso_tokens", JSON.stringify(tokens));
    const users = this._getUsers();
    const user = users.find((u) => u.id === entry.userId);
    return { valid: true, user: user ? this._sanitize(user) : null };
  }

  // ── Logs ─────────────────────────────────────────────────────────────────────

  _logSecurity(userId, event, details) {
    const logs = JSON.parse(localStorage.getItem("lg_security_logs") || "[]");
    logs.push({ userId, event, details, timestamp: new Date().toISOString() });
    if (logs.length > 200) logs.shift();
    localStorage.setItem("lg_security_logs", JSON.stringify(logs));
  }

  getSecurityLogs(userId) {
    const logs = JSON.parse(localStorage.getItem("lg_security_logs") || "[]");
    return userId ? logs.filter((l) => l.userId === userId) : logs;
  }
}

const userModel = new UserModel();
