// js/controllers/authController.js
// FIX updateAuthUI: soporta tanto id="authButtons" como id="guestMenu"
// FIX reCAPTCHA: widget IDs rastreados manualmente para login y registro

class AuthController {
  constructor() {
    this.model = userModel;
    this.validationService = validationService;
    this._captchaWidgets = {};
  }

  init() {
    this.updateAuthUI();
    this._bindForms();
    this._bindThemeSwitch();
    this._applyStoredTheme();
    this._bindResetTabs();
    AuthMiddleware.applyRoleVisibility();
    this._renderRecaptchas();
    console.log("✅ AuthController inicializado");
  }

  // ── reCAPTCHA ─────────────────────────────────────────────────────────────────

  _renderRecaptchas() {
    this._tryRenderWidget("loginRecaptcha");
    this._tryRenderWidget("registerRecaptcha");
  }

  _tryRenderWidget(elementId) {
    try {
      if (typeof grecaptcha === "undefined") return;
      const el = document.getElementById(elementId);
      if (!el) return;
      if (el.querySelector("iframe")) {
        this._captchaWidgets[elementId] =
          elementId === "loginRecaptcha" ? 0 : 1;
        return;
      }
      const widgetId = grecaptcha.render(el, {
        sitekey: "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
      });
      this._captchaWidgets[elementId] = widgetId;
    } catch (e) {
      if (!String(e).includes("already been rendered")) {
        console.warn("[reCAPTCHA]", e);
      }
    }
  }

  _getRecaptchaResponse(elementId) {
    try {
      if (typeof grecaptcha === "undefined") return "";
      const widgetId = this._captchaWidgets[elementId];
      return widgetId !== undefined
        ? grecaptcha.getResponse(widgetId)
        : grecaptcha.getResponse();
    } catch {
      return "";
    }
  }

  _resetRecaptcha(elementId) {
    try {
      if (typeof grecaptcha === "undefined") return;
      const widgetId = this._captchaWidgets[elementId];
      widgetId !== undefined ? grecaptcha.reset(widgetId) : grecaptcha.reset();
    } catch {
      /* silencioso */
    }
  }

  _validateRecaptcha(formType) {
    const elementId = `${formType}Recaptcha`;
    const el = document.getElementById(elementId);
    if (!el) return true;
    this._tryRenderWidget(elementId);
    try {
      const response = this._getRecaptchaResponse(elementId);
      if (!response || response.length === 0) {
        this.showError(
          "Por favor completa el reCAPTCHA.",
          `${formType}RecaptchaError`,
        );
        return false;
      }
      return true;
    } catch {
      console.warn("[reCAPTCHA] No disponible, omitiendo.");
      return true;
    }
  }

  // ── Formularios ───────────────────────────────────────────────────────────────

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

  // ── Tema ──────────────────────────────────────────────────────────────────────

  _bindThemeSwitch() {
    const sw = document.getElementById("themeSwitch");
    if (!sw) return;
    sw.addEventListener("change", () => {
      const theme = sw.checked ? "light" : "dark";
      this._applyTheme(theme);
      if (userModel.isLoggedIn()) userModel.updatePreferences({ tema: theme });
    });
  }

  _applyTheme(theme) {
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

  // ── Modales ───────────────────────────────────────────────────────────────────

  showLoginModal() {
    document.getElementById("loginModal")?.classList.add("active");
    document.body.style.overflow = "hidden";
    setTimeout(() => this._tryRenderWidget("loginRecaptcha"), 150);
  }

  showRegisterModal() {
    document.getElementById("registerModal")?.classList.add("active");
    document.body.style.overflow = "hidden";
    setTimeout(() => this._tryRenderWidget("registerRecaptcha"), 150);
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

  // ── Login ─────────────────────────────────────────────────────────────────────

  handleLogin() {
    const emailOrUsername = document.getElementById("loginEmail")?.value.trim();
    const password = document.getElementById("loginPassword")?.value;

    document.querySelectorAll("#loginForm .error-message").forEach((el) => {
      el.textContent = "";
      el.style.display = "none";
    });

    if (!emailOrUsername || !password)
      return this.showError("Completa todos los campos.", "loginEmailError");
    if (!this._validateRecaptcha("login")) return;

    const result = this.model.login(emailOrUsername, password);

    if (result.requiresMfa) {
      this.closeAuthModals();
      document.getElementById("mfaModal")?.classList.add("active");
      return;
    }

    if (result.success) {
      this.closeAuthModals();
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

  // ── MFA ───────────────────────────────────────────────────────────────────────

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

  // ── Registro ──────────────────────────────────────────────────────────────────

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

  // ── Logout ────────────────────────────────────────────────────────────────────

  handleLogout() {
    if (!confirm("¿Cerrar sesión?")) return;
    this.model.logout();
    this.updateAuthUI();
    AuthMiddleware.applyRoleVisibility();
    this._applyTheme("dark");
    if (typeof viewManager !== "undefined") viewManager.showSection("home");
    this.showMessage("Sesión cerrada.", "success");
  }

  // ── Recuperación ──────────────────────────────────────────────────────────────

  handleResetRequest() {
    const email = document.getElementById("resetEmail")?.value.trim();
    if (!email) return this.showError("Ingresa tu email.", "resetEmailError");
    const result = this.model.requestPasswordReset(email);
    this.showMessage(
      result.message || result.error,
      result.success ? "success" : "error",
    );
    if (result.success) {
      const req = document.getElementById("resetRequestSection");
      const pass = document.getElementById("resetPasswordSection");
      if (req) req.style.display = "none";
      if (pass) pass.style.display = "block";
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
    const section = document.getElementById("smsVerifySection");
    if (section) section.style.display = "block";
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
  }

  // ── Settings ──────────────────────────────────────────────────────────────────

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
    const mfaBtn =
      document.getElementById("toggleMfaBtn") ||
      document.getElementById("mfaToggleBtn");
    if (mfaStatus)
      mfaStatus.textContent = user.mfaEnabled ? "Activado" : "Desactivado";
    if (mfaBtn)
      mfaBtn.textContent = user.mfaEnabled ? "Desactivar MFA" : "Activar MFA";
  }

  // ── UI ────────────────────────────────────────────────────────────────────────

  updateAuthUI() {
    const user = this.model.getCurrentUser();

    // Soporta tanto id="authButtons" (original) como id="guestMenu" (alternativo)
    const authBtns =
      document.getElementById("authButtons") ||
      document.getElementById("guestMenu");
    const userMenu = document.getElementById("userMenu");
    const myListsBtn = document.getElementById("myListsBtn");
    const settingsBtn = document.getElementById("settingsBtn");
    const adminBtn = document.getElementById("adminNavBtn");

    if (user) {
      if (authBtns) authBtns.style.display = "none";
      if (userMenu) userMenu.style.display = "flex";
      if (myListsBtn) myListsBtn.style.display = "";
      if (settingsBtn) settingsBtn.style.display = "";
      if (adminBtn)
        adminBtn.style.display =
          user.role === "admin" || user.role === "editor" ? "" : "none";

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
          `https://ui-avatars.com/api/?name=${encodeURIComponent(
            (user.nombre || "U") + "+" + (user.apellido || ""),
          )}&background=6809e5&color=fff&size=40`;
    } else {
      if (authBtns) authBtns.style.display = "flex";
      if (userMenu) userMenu.style.display = "none";
      if (myListsBtn) myListsBtn.style.display = "none";
      if (settingsBtn) settingsBtn.style.display = "none";
      if (adminBtn) adminBtn.style.display = "none";
    }
  }

  // ── Mensajes ──────────────────────────────────────────────────────────────────

  showMessage(msg, type = "info") {
    const existing = document.getElementById("authMessage");
    if (existing) existing.remove();
    const div = document.createElement("div");
    div.id = "authMessage";
    div.className = `toast-message ${type}`;
    div.textContent = msg;
    document.body.appendChild(div);
    requestAnimationFrame(() => div.classList.add("visible"));
    setTimeout(() => {
      div.classList.remove("visible");
      setTimeout(() => div.remove(), 400);
    }, 3500);
  }

  showError(msg, targetId) {
    const el = document.getElementById(targetId);
    if (el) {
      el.textContent = msg;
      el.style.display = "block";
    } else {
      this.showMessage(msg, "error");
    }
  }

  // ── Validación ────────────────────────────────────────────────────────────────

  _validateField(fieldId, type) {
    const field = document.getElementById(fieldId);
    if (!field) return true;
    const val = field.value.trim();
    const errId = fieldId + "Error";

    if (!val) {
      this.showError("Este campo es obligatorio.", errId);
      return false;
    }

    // Patrones sin caracteres acentuados en la clase (evita el SyntaxError del navegador)
    const patterns = {
      email: /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
      username: /^[a-zA-Z0-9_\-]{3,20}$/,
      password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/,
      // "name" solo verifica longitud — los caracteres acentuados los deja pasar
      name: null,
    };

    const msgs = {
      email: "Ingresa un correo electrónico válido.",
      username: "Solo letras, números y guiones (3-20 caracteres).",
      password:
        "Mínimo 6 caracteres, una mayúscula, una minúscula y un número.",
      name: null,
    };

    if (type === "confirmPassword") {
      const pass = document.getElementById("regPassword")?.value;
      if (val !== pass) {
        this.showError("Las contraseñas no coinciden.", errId);
        return false;
      }
      return true;
    }

    if (patterns[type] && !patterns[type].test(val)) {
      this.showError(msgs[type], errId);
      return false;
    }

    // Validación mínima de longitud para nombres
    if (type === "name" && val.length < 2) {
      this.showError("Mínimo 2 caracteres.", errId);
      return false;
    }

    return true;
  }
}

const authController = new AuthController();
