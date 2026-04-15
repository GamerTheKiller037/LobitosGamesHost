// js/models/userModel.js
const PLACEHOLDER_USER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect width='100%25' height='100%25' fill='%231a0533'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='18' fill='%236809e5'%3EUser%3C/text%3E%3C/svg%3E";

// ─────────────────────────────────────────────────────────────
// CAMBIA ESTO A true PARA USAR EL BACKEND REAL
// ─────────────────────────────────────────────────────────────
const USE_BACKEND = true;
const API_BASE =
  "https://lobitosgameshostbackend-production.up.railway.app/api";

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

    if (USE_BACKEND) {
      // En modo backend solo comprobamos que el token exista
      // El servidor lo validará en cada petición
      this.currentUser = JSON.parse(raw);
      this.accessToken = tok;
      this.isAuthenticated = true;
      return;
    }

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
      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) return { success: false, error: json.error };
        return { success: true, user: json.user };
      } catch (err) {
        return { success: false, error: "Error de conexión al servidor." };
      }
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

      if (json.requiresMfa) {
        this.pendingMfaUserId = json.userId;
        return { success: true, requiresMfa: true };
      }

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

  async verifyMfa(code) {
    if (USE_BACKEND) {
      try {
        const res = await fetch(`${API_BASE}/auth/mfa/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: this.pendingMfaUserId, code }),
        });
        const json = await res.json();
        if (!res.ok) return { success: false, error: json.error };

        this.currentUser = json.user;
        this.accessToken = json.accessToken;
        this.isAuthenticated = true;
        this.pendingMfaUserId = null;
        localStorage.setItem("lg_current_user", JSON.stringify(json.user));
        localStorage.setItem("lg_access_token", json.accessToken);
        localStorage.setItem("lg_refresh_token", json.refreshToken);
        return { success: true, user: json.user };
      } catch (err) {
        return { success: false, error: "Error de conexión al servidor." };
      }
    }

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
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    const sessions = JSON.parse(localStorage.getItem("lg_sessions") || "[]");
    sessions.push(session);
    localStorage.setItem("lg_sessions", JSON.stringify(sessions));

    const userWithSession = { ...user, sessionId };
    this.currentUser = this._sanitize(userWithSession);
    this.isAuthenticated = true;

    const accessToken = JWTUtil.generateAccessToken(this.currentUser);
    const refreshToken = JWTUtil.generateRefreshToken(this.currentUser);
    this.accessToken = accessToken;

    localStorage.setItem("lg_current_user", JSON.stringify(this.currentUser));
    localStorage.setItem("lg_access_token", accessToken);
    localStorage.setItem("lg_refresh_token", refreshToken);

    this._logSecurity(user.id, "login", "Inicio de sesión exitoso");
    return { success: true, user: this.currentUser };
  }

  // ── Logout ───────────────────────────────────────────────────────────────────

  logout() {
    if (USE_BACKEND && this.accessToken) {
      fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
      }).catch(() => {});
    }

    this.currentUser = null;
    this.isAuthenticated = false;
    this.accessToken = null;
    localStorage.removeItem("lg_current_user");
    localStorage.removeItem("lg_access_token");
    localStorage.removeItem("lg_refresh_token");
  }

  // ── Recuperación de contraseña ────────────────────────────────────────────────

  async requestPasswordReset(email) {
    if (USE_BACKEND) {
      try {
        const res = await fetch(`${API_BASE}/auth/reset/request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const json = await res.json();
        return { success: true, message: json.message };
      } catch {
        return { success: false, error: "Error de conexión." };
      }
    }

    const users = this._getUsers();
    const user = users.find((u) => u.email === email);
    if (!user)
      return {
        success: true,
        message: "Si el correo está registrado recibirás instrucciones.",
      };

    const token = Math.random().toString(36).slice(2, 10).toUpperCase();
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    this._saveUsers(users.map((u) => (u.email === email ? user : u)));
    console.log(`[Reset] Token para ${email}: ${token}`);
    return {
      success: true,
      message: "Si el correo está registrado recibirás instrucciones.",
    };
  }

  async confirmPasswordReset(token, newPassword) {
    if (USE_BACKEND) {
      try {
        const res = await fetch(`${API_BASE}/auth/reset/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, newPassword }),
        });
        const json = await res.json();
        if (!res.ok) return { success: false, error: json.error };
        return { success: true, message: json.message };
      } catch {
        return { success: false, error: "Error de conexión." };
      }
    }

    const users = this._getUsers();
    const user = users.find(
      (u) =>
        u.resetToken === token &&
        u.resetTokenExpiry &&
        new Date(u.resetTokenExpiry) > new Date(),
    );
    if (!user) return { success: false, error: "Token inválido o expirado." };

    user.password = hashPassword(newPassword);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    this._saveUsers(users.map((u) => (u.id === user.id ? user : u)));
    return { success: true, message: "Contraseña actualizada." };
  }

  // ── Cambiar contraseña (desde settings) ─────────────────────────────────────

  async changePassword(currentPassword, newPassword) {
    if (USE_BACKEND) {
      try {
        const res = await fetch(`${API_BASE}/users/change-password`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const json = await res.json();
        if (!res.ok) return { success: false, error: json.error };
        return { success: true };
      } catch {
        return { success: false, error: "Error de conexión." };
      }
    }

    const users = this._getUsers();
    const user = users.find((u) => u.id === this.currentUser?.id);
    if (!user) return { success: false, error: "Usuario no encontrado." };
    if (user.password !== hashPassword(currentPassword))
      return { success: false, error: "Contraseña actual incorrecta." };
    user.password = hashPassword(newPassword);
    this._saveUsers(users.map((u) => (u.id === user.id ? user : u)));
    return { success: true };
  }

  // ── Toggle MFA ───────────────────────────────────────────────────────────────

  async toggleMfa(enable) {
    if (USE_BACKEND) {
      try {
        const res = await fetch(`${API_BASE}/users/toggle-mfa`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify({ enable }),
        });
        const json = await res.json();
        if (!res.ok) return { success: false, error: json.error };
        if (this.currentUser) {
          this.currentUser.mfaEnabled = enable;
          localStorage.setItem(
            "lg_current_user",
            JSON.stringify(this.currentUser),
          );
        }
        return { success: true, mfaEnabled: enable };
      } catch {
        return { success: false, error: "Error de conexión." };
      }
    }

    const users = this._getUsers();
    const user = users.find((u) => u.id === this.currentUser?.id);
    if (!user) return { success: false, error: "Usuario no encontrado." };
    user.mfaEnabled = enable;
    this._saveUsers(users.map((u) => (u.id === user.id ? user : u)));
    if (this.currentUser) {
      this.currentUser.mfaEnabled = enable;
      localStorage.setItem("lg_current_user", JSON.stringify(this.currentUser));
    }
    return { success: true };
  }

  // ── Sesiones activas ─────────────────────────────────────────────────────────

  getActiveSessions() {
    if (USE_BACKEND) {
      return [];
    }
    const sessions = JSON.parse(localStorage.getItem("lg_sessions") || "[]");
    return sessions.filter(
      (s) => s.userId === this.currentUser?.id && s.isActive,
    );
  }

  async fetchActiveSessions() {
    if (!USE_BACKEND) return this.getActiveSessions();
    try {
      const res = await fetch(`${API_BASE}/auth/sessions`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      const json = await res.json();
      return json.sessions || [];
    } catch {
      return [];
    }
  }

  revokeSession(sessionId) {
    if (USE_BACKEND) {
      fetch(`${API_BASE}/auth/sessions/${sessionId}/revoke`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }).catch(() => {});
      return;
    }
    const sessions = JSON.parse(localStorage.getItem("lg_sessions") || "[]");
    const updated = sessions.map((s) =>
      s.id === sessionId ? { ...s, isActive: false } : s,
    );
    localStorage.setItem("lg_sessions", JSON.stringify(updated));
  }

  // ── Preferencias ─────────────────────────────────────────────────────────────

  async updatePreferences(prefs) {
    if (USE_BACKEND) {
      try {
        const res = await fetch(`${API_BASE}/users/preferences`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify(prefs),
        });
        const json = await res.json();
        if (!res.ok) return { success: false, error: json.error };
        if (this.currentUser) {
          Object.assign(this.currentUser, prefs);
          localStorage.setItem(
            "lg_current_user",
            JSON.stringify(this.currentUser),
          );
        }
        return { success: true };
      } catch {
        return { success: false, error: "Error de conexión." };
      }
    }

    const users = this._getUsers();
    const user = users.find((u) => u.id === this.currentUser?.id);
    if (user) {
      Object.assign(user, prefs);
      this._saveUsers(users.map((u) => (u.id === user.id ? user : u)));
    }
    if (this.currentUser) {
      Object.assign(this.currentUser, prefs);
      localStorage.setItem("lg_current_user", JSON.stringify(this.currentUser));
    }
    return { success: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  isLoggedIn() {
    return !!this.currentUser && this.isAuthenticated;
  }

  hasRole(role) {
    const roles = { admin: 3, editor: 2, usuario: 1 };
    const userRole = this.currentUser?.role || "usuario";
    return (roles[userRole] || 0) >= (roles[role] || 0);
  }

  isAdmin() {
    return this.currentUser?.role === "admin";
  }

  hasPermission(permission) {
    const perms = {
      admin: [
        "manage_users",
        "manage_content",
        "view_logs",
        "edit_content",
        "view_content",
      ],
      editor: ["edit_content", "view_content", "manage_content"],
      usuario: ["view_content"],
    };
    return (
      perms[this.currentUser?.role || "usuario"]?.includes(permission) || false
    );
  }

  isGuest() {
    return !this.currentUser;
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
