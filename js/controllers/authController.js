// js/controllers/authController.js
// AuthController — Práctica 1 Unidad 3
// reCAPTCHA Google v2, login instantáneo sin recarga,
// switch de tema, MFA, settings, recovery, SSO.

class AuthController {
  constructor() {
    this.model = userModel;
    this.validationService = validationService;
    this.loginCaptcha = null; // fallback si reCAPTCHA no carga
    this.registerCaptcha = null;
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  init() {
    this.updateAuthUI();
    this._bindForms();
    this._bindThemeSwitch();
    this._applyStoredTheme();
    this._bindResetTabs();
    AuthMiddleware.applyRoleVisibility();
    console.log("✅ AuthController inicializado");
  }

  _bindForms() {
    document.getElementById("loginForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleLogin();
    });
    document.getElementById("registerForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleRegister();
    });
    document.getElementById("mfaForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleMfaVerification();
    });
    document
      .getElementById("changePasswordForm")
      ?.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleChangePassword();
      });
  }

  // ── Theme switch ─────────────────────────────────────────────────────────────

  _bindThemeSwitch() {
    const sw = document.getElementById("themeSwitch");
    if (!sw) return;

    sw.addEventListener("change", () => {
      const theme = sw.checked ? "light" : "dark";
      this._applyTheme(theme);
      // Guardar preferencia en usuario si está logueado
      if (userModel.isLoggedIn()) userModel.updatePreferences({ tema: theme });
    });
  }

  _applyTheme(theme) {
    // Aplicar en ambos elementos para que funcionen todos los selectores CSS
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("lg_theme", theme);
    const sw = document.getElementById("themeSwitch");
    if (sw) sw.checked = theme === "light";
  }

  _applyStoredTheme() {
    const user = userModel.getCurrentUser();
    const saved = user?.tema || localStorage.getItem("lg_theme") || "dark";
    this._applyTheme(saved);
  }

  // ── reCAPTCHA helpers ────────────────────────────────────────────────────────

  _getRecaptchaResponse(id) {
    try {
      return grecaptcha.getResponse(
        grecaptcha.render(id, {
          sitekey: "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
        }),
      );
    } catch {
      // reCAPTCHA ya renderizado: obtener respuesta directa
      const widgets = { loginRecaptcha: 0, registerRecaptcha: 1 };
      try {
        return grecaptcha.getResponse(widgets[id] ?? 0);
      } catch {
        return "";
      }
    }
  }

  _resetRecaptcha(id) {
    try {
      const el = document.getElementById(id);
      if (el) grecaptcha.reset(el.dataset.widgetId ?? 0);
    } catch {
      /* silencioso */
    }
  }

  _validateRecaptcha(formType) {
    // En producción usar la sitekey real, este es el key de prueba de Google
    // que siempre devuelve token válido. En producción verificar en el server.
    const el = document.getElementById(`${formType}Recaptcha`);
    if (!el) return true; // si no existe el elemento, pasar
    try {
      const response = grecaptcha.getResponse();
      if (!response || response.length === 0) {
        this.showError(
          "Por favor completa el reCAPTCHA.",
          `${formType}RecaptchaError`,
        );
        return false;
      }
      return true;
    } catch {
      // reCAPTCHA no cargó (sin internet). Permitir pasar con advertencia.
      console.warn("[reCAPTCHA] No disponible, omitiendo verificación.");
      return true;
    }
  }

  // ── Login ────────────────────────────────────────────────────────────────────

  handleLogin() {
    const emailOrUsername = document.getElementById("loginEmail")?.value.trim();
    const password = document.getElementById("loginPassword")?.value;

    // Limpiar errores
    document.querySelectorAll("#loginForm .error-message").forEach((el) => {
      el.textContent = "";
      el.style.display = "none";
    });

    if (!emailOrUsername || !password) {
      return this.showError("Completa todos los campos.", "loginEmailError");
    }

    if (!this._validateRecaptcha("login")) return;

    const result = this.model.login(emailOrUsername, password);

    if (result.requiresMfa) {
      this.closeAuthModals();
      document.getElementById("mfaModal")?.classList.add("active");
      return;
    }

    if (result.success) {
      this.closeAuthModals();
      // Actualizar UI instantáneamente sin recargar
      this.updateAuthUI();
      AuthMiddleware.applyRoleVisibility();
      this._applyTheme(result.user.tema || "dark");
      document.getElementById("loginForm").reset();
      this._resetRecaptcha("loginRecaptcha");
      this.showMessage(
        `¡Bienvenido ${result.user.nombre}! (Rol: ${result.user.role})`,
        "success",
      );
    } else {
      this.showError(result.error, "loginEmailError");
      this._resetRecaptcha("loginRecaptcha");
    }
  }

  // ── MFA ──────────────────────────────────────────────────────────────────────

  handleMfaVerification() {
    const code = document.getElementById("mfaCode")?.value.trim();
    const result = this.model.verifyMfa(code);
    if (result.success) {
      document.getElementById("mfaModal")?.classList.remove("active");
      this.updateAuthUI();
      AuthMiddleware.applyRoleVisibility();
      this._applyTheme(result.user.tema || "dark");
      this.showMessage(`¡Bienvenido ${result.user.nombre}!`, "success");
    } else {
      this.showError(result.error, "mfaCodeError");
    }
  }

  // ── Registro ─────────────────────────────────────────────────────────────────

  async handleRegister() {
    const nombre = document.getElementById("regNombre")?.value.trim();
    const apellido = document.getElementById("regApellido")?.value.trim();
    const username = document.getElementById("regUsername")?.value.trim();
    const email = document.getElementById("regEmail")?.value.trim();
    const password = document.getElementById("regPassword")?.value;
    const confirmPassword =
      document.getElementById("regConfirmPassword")?.value;
    const secretQuestion = document.getElementById("regSecretQuestion")?.value;
    const secretAnswer = document
      .getElementById("regSecretAnswer")
      ?.value.trim();
    const acceptTerms = document.getElementById("regTerms")?.checked;

    document.querySelectorAll("#registerForm .error-message").forEach((el) => {
      el.textContent = "";
      el.style.display = "none";
    });

    let valid = true;
    valid = this._validateField("regNombre", "name") && valid;
    valid = this._validateField("regApellido", "name") && valid;
    valid = this._validateField("regUsername", "username") && valid;
    valid = this._validateField("regEmail", "email") && valid;
    valid = this._validateField("regPassword", "password") && valid;
    valid =
      this._validateField("regConfirmPassword", "confirmPassword") && valid;
    if (!acceptTerms) {
      this.showError("Debes aceptar los términos.", "regTermsError");
      valid = false;
    }
    if (!valid) return;

    if (!this._validateRecaptcha("register")) return;

    const backendVal = await this.validationService.validateBackend({
      email,
      username,
    });
    if (!backendVal.valid) {
      backendVal.errors.forEach((e) =>
        this.showError(
          e.message,
          `reg${e.field.charAt(0).toUpperCase() + e.field.slice(1)}Error`,
        ),
      );
      return;
    }

    const result = this.model.register({
      nombre,
      apellido,
      username,
      email,
      password,
      secretQuestion,
      secretAnswer,
    });
    if (result.success) {
      this.showMessage(
        "¡Registro exitoso! Ahora puedes iniciar sesión.",
        "success",
      );
      this.closeAuthModals();
      document.getElementById("registerForm").reset();
      this._resetRecaptcha("registerRecaptcha");
      this.showLoginModal();
    } else {
      this.showError(result.error, "regEmailError");
    }
  }

  // ── Logout ───────────────────────────────────────────────────────────────────

  handleLogout() {
    if (!confirm("¿Cerrar sesión?")) return;
    this.model.logout();
    this.updateAuthUI();
    AuthMiddleware.applyRoleVisibility();
    this._applyTheme("dark");
    if (typeof viewManager !== "undefined") viewManager.showSection("home");
    this.showMessage("Sesión cerrada.", "success");
  }

  // ── Recuperación contraseña ──────────────────────────────────────────────────

  handleResetRequest() {
    const email = document.getElementById("resetEmail")?.value.trim();
    if (!email) return this.showError("Ingresa tu email.", "resetEmailError");
    const result = this.model.requestPasswordReset(email);
    this.showMessage(
      result.message || result.error,
      result.success ? "success" : "error",
    );
    if (result.success) {
      document.getElementById("resetRequestSection").style.display = "none";
      document.getElementById("resetPasswordSection").style.display = "block";
    }
  }

  handleResetPassword() {
    const token = document.getElementById("resetToken")?.value.trim();
    const newPass = document.getElementById("newPassword")?.value;
    const confirm = document.getElementById("confirmNewPassword")?.value;
    if (newPass !== confirm)
      return this.showError(
        "Las contraseñas no coinciden.",
        "confirmNewPasswordError",
      );
    const result = this.model.resetPasswordWithToken(token, newPass);
    this.showMessage(
      result.message || result.error,
      result.success ? "success" : "error",
    );
    if (result.success) this.showLoginModal();
  }

  handleSmsResetRequest() {
    const ident = document.getElementById("smsResetUser")?.value.trim();
    const users = JSON.parse(localStorage.getItem("lg_users") || "[]");
    const user = users.find((u) => u.email === ident || u.username === ident);
    if (!user) return this.showMessage("Usuario no encontrado.", "error");
    const result = this.model.requestSmsReset(user.id);
    this.showMessage(result.message, "success");
    document.getElementById("smsVerifySection").style.display = "block";
    this._smsResetUserId = user.id;
  }

  handleSmsVerify() {
    const code = document.getElementById("smsOtpCode")?.value.trim();
    const newPass = document.getElementById("smsNewPassword")?.value;
    const result = this.model.verifySmsReset(
      this._smsResetUserId,
      code,
      newPass,
    );
    this.showMessage(
      result.message || result.error,
      result.success ? "success" : "error",
    );
    if (result.success) this.closeAuthModals();
  }

  loadSecretQuestion() {
    const ident = document.getElementById("secretUser")?.value.trim();
    const result = this.model.verifySecretQuestion(ident, "");
    if (result.success === false && result.error === "Respuesta incorrecta") {
      // usuario existe, mostrar pregunta
    }
    const users = JSON.parse(localStorage.getItem("lg_users") || "[]");
    const user = users.find((u) => u.email === ident || u.username === ident);
    if (!user || !user.secretQuestion)
      return this.showMessage(
        "No tiene pregunta de seguridad registrada.",
        "error",
      );
    document.getElementById("secretQuestionText").textContent =
      user.secretQuestion;
    document.getElementById("secretQuestionSection").style.display = "block";
    this._secretUserId = user.id;
  }

  handleSecretReset() {
    const answer = document.getElementById("secretAnswer")?.value.trim();
    const newPass = document.getElementById("secretNewPassword")?.value;
    const ident = document.getElementById("secretUser")?.value.trim();
    const check = this.model.verifySecretQuestion(ident, answer);
    if (!check.success) return this.showMessage(check.error, "error");
    const r = this.model.resetPasswordWithToken(
      this.model.requestPasswordReset(ident).token || "",
      newPass,
    );
    // Alternativa directa
    const users = JSON.parse(localStorage.getItem("lg_users") || "[]");
    const idx = users.findIndex(
      (u) => u.email === ident || u.username === ident,
    );
    if (idx !== -1) {
      users[idx].password = hashPassword(newPass);
      localStorage.setItem("lg_users", JSON.stringify(users));
      this.showMessage("Contraseña cambiada correctamente.", "success");
      this.closeAuthModals();
    }
  }

  // ── Settings ─────────────────────────────────────────────────────────────────

  handleChangePassword() {
    const current = document.getElementById("currentPassword")?.value;
    const newPass = document.getElementById("newSettingsPassword")?.value;
    const confirm = document.getElementById("confirmSettingsPassword")?.value;
    if (newPass !== confirm)
      return this.showError(
        "Las contraseñas no coinciden.",
        "confirmSettingsPasswordError",
      );
    const result = this.model.changePassword(current, newPass);
    this.showMessage(
      result.success ? "Contraseña actualizada." : result.error,
      result.success ? "success" : "error",
    );
  }

  handleToggleMfa() {
    if (!AuthMiddleware.requireAuth()) return;
    const current = userModel.getCurrentUser().mfaEnabled;
    const result = this.model.toggleMfa(!current);
    this.showMessage(
      result.mfaEnabled ? "MFA activado." : "MFA desactivado.",
      "success",
    );
    this.refreshSettingsPanel();
  }

  renderActiveSessions() {
    if (!AuthMiddleware.requireAuth()) return;
    const container = document.getElementById("sessionsContainer");
    if (!container) return;
    const sessions = this.model.getActiveSessions();
    if (!sessions.length) {
      container.innerHTML =
        "<p class='no-sessions'>No hay sesiones activas.</p>";
      return;
    }
    container.innerHTML = sessions
      .map(
        (s) => `
      <div class="session-item ${s.id === userModel.getCurrentUser().sessionId ? "current-session" : ""}">
        <div class="session-info">
          <span class="session-device">${s.deviceInfo || "Dispositivo desconocido"}</span>
          <span class="session-agent">${(s.userAgent || "").slice(0, 60)}…</span>
          <span class="session-ip">IP: ${s.ipAddress || "N/A"}</span>
          <span class="session-date">${new Date(s.createdAt).toLocaleString()}</span>
        </div>
        ${
          s.id === userModel.getCurrentUser().sessionId
            ? '<span class="session-badge">Sesión actual</span>'
            : `<button class="btn-revoke-session" onclick="authController.revokeSessionById('${s.id}')">Cerrar sesión</button>`
        }
      </div>`,
      )
      .join("");
  }

  revokeSessionById(sessionId) {
    this.model.revokeSession(sessionId);
    this.showMessage("Sesión cerrada.", "success");
    this.renderActiveSessions();
  }

  savePreferences() {
    const tema = document.getElementById("prefersTema")?.value;
    const idioma = document.getElementById("prefersIdioma")?.value;
    this.model.updatePreferences({ tema, idioma });
    this._applyTheme(tema);
    this.showMessage("Preferencias guardadas.", "success");
  }

  refreshSettingsPanel() {
    const user = userModel.getCurrentUser();
    if (!user) return;
    const mfaStatus = document.getElementById("mfaStatus");
    const mfaBtn = document.getElementById("toggleMfaBtn");
    if (mfaStatus)
      mfaStatus.textContent = user.mfaEnabled ? "Activado" : "Desactivado";
    if (mfaBtn)
      mfaBtn.textContent = user.mfaEnabled ? "Desactivar MFA" : "Activar MFA";
  }

  // ── UI actualización instantánea ─────────────────────────────────────────────

  /**
   * Actualiza header, nav y role badge SIN recargar la página.
   * Se llama justo después de login, logout o cambio de rol.
   */
  updateAuthUI() {
    const user = this.model.getCurrentUser();
    const authBtns = document.getElementById("authButtons");
    const userMenu = document.getElementById("userMenu");
    const myListsBtn = document.getElementById("myListsBtn");
    const settingsBtn = document.getElementById("settingsBtn");
    const adminBtn = document.getElementById("adminNavBtn");

    if (user) {
      if (authBtns) authBtns.style.display = "none";
      if (userMenu) userMenu.style.display = "flex";
      if (myListsBtn) myListsBtn.style.display = "block";
      if (settingsBtn) settingsBtn.style.display = "block";
      if (adminBtn)
        adminBtn.style.display = user.role === "admin" ? "block" : "none";

      const nameEl = document.getElementById("usernameDisplay");
      const roleEl = document.getElementById("userRoleBadge");
      const avatarEl = document.getElementById("userAvatar");

      if (nameEl) nameEl.textContent = user.username;
      if (roleEl) {
        roleEl.textContent = user.role;
        roleEl.className = `role-badge role-${user.role}`;
      }
      if (avatarEl)
        avatarEl.src =
          user.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nombre + "+" + user.apellido)}&background=6809e5&color=fff&size=40`;
    } else {
      if (authBtns) authBtns.style.display = "flex";
      if (userMenu) userMenu.style.display = "none";
      if (myListsBtn) myListsBtn.style.display = "none";
      if (settingsBtn) settingsBtn.style.display = "none";
      if (adminBtn) adminBtn.style.display = "none";
    }
  }

  // ── Modales ──────────────────────────────────────────────────────────────────

  showLoginModal() {
    document.getElementById("loginModal")?.classList.add("active");
    document.body.style.overflow = "hidden";
  }
  showRegisterModal() {
    document.getElementById("registerModal")?.classList.add("active");
    document.body.style.overflow = "hidden";
  }
  showResetModal() {
    document.getElementById("resetModal")?.classList.add("active");
    document.body.style.overflow = "hidden";
  }
  closeAuthModals() {
    ["loginModal", "registerModal", "mfaModal", "resetModal"].forEach((id) =>
      document.getElementById(id)?.classList.remove("active"),
    );
    document.body.style.overflow = "";
  }

  // ── Reset modal tabs ──────────────────────────────────────────────────────────

  _bindResetTabs() {
    document.querySelectorAll(".reset-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document
          .querySelectorAll(".reset-tab")
          .forEach((t) => t.classList.remove("active"));
        document
          .querySelectorAll(".reset-tab-content")
          .forEach((c) => c.classList.remove("active"));
        tab.classList.add("active");
        document
          .getElementById(tab.getAttribute("data-tab"))
          ?.classList.add("active");
      });
    });
  }

  // ── Toast messages ────────────────────────────────────────────────────────────

  showMessage(msg, type = "info") {
    const div = document.createElement("div");
    div.className = `toast-message ${type}`;
    div.textContent = msg;
    document.body.appendChild(div);
    requestAnimationFrame(() => div.classList.add("visible"));
    setTimeout(() => {
      div.classList.remove("visible");
      setTimeout(() => div.remove(), 400);
    }, 3500);
  }

  showError(msg, errorElId) {
    const el = document.getElementById(errorElId);
    if (
      el &&
      (el.classList.contains("error-message") || el.tagName === "SPAN")
    ) {
      el.textContent = msg;
      el.style.display = "block";
    } else {
      this.showMessage(msg, "error");
    }
  }

  // ── Validación de campo ──────────────────────────────────────────────────────

  _validateField(fieldId, type) {
    const field = document.getElementById(fieldId);
    if (!field) return true;
    const val = field.value.trim();
    const patterns = {
      email: /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
      username: /^[a-zA-Z0-9_\-]{3,20}$/,
      password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/,
      name: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/,
      confirmPassword: null,
    };
    const msgs = {
      email: "Correo inválido.",
      username: "3-20 caracteres alfanuméricos.",
      password:
        "Mínimo 6 caracteres, una mayúscula, una minúscula y un número.",
      name: "Solo letras y espacios (2-50 caracteres).",
      confirmPassword: "Las contraseñas no coinciden.",
    };
    const errId = fieldId + "Error";
    if (!val) {
      this.showError("Este campo es obligatorio.", errId);
      return false;
    }
    if (type === "confirmPassword") {
      const pass = document.getElementById("regPassword")?.value;
      if (val !== pass) {
        this.showError(msgs.confirmPassword, errId);
        return false;
      }
      return true;
    }
    if (patterns[type] && !patterns[type].test(val)) {
      this.showError(msgs[type], errId);
      return false;
    }
    return true;
  }
}

const authController = new AuthController();
