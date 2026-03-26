// js/services/validationService.js
// ValidationService — CORREGIDO: usa lg_users como clave de localStorage
// para que sea compatible con el nuevo userModel.

class ValidationService {
  constructor() {
    this.patterns = {
      email: /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
      username: /^[a-zA-Z0-9_\-]{3,20}$/,
      password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/,
      name: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/,
      phone: /^[\d\s\-\+\(\)]{7,20}$/,
    };

    this.errorMessages = {
      required: "Este campo es obligatorio",
      email: "Por favor ingresa un correo electrónico válido",
      username:
        "El usuario debe tener entre 3 y 20 caracteres (letras, números, guiones)",
      password:
        "La contraseña debe tener mínimo 6 caracteres, una mayúscula, una minúscula y un número",
      name: "El nombre solo debe contener letras y espacios",
      minLength: "Debe tener al menos {min} caracteres",
      maxLength: "No debe exceder {max} caracteres",
      match: "Los campos no coinciden",
    };
  }

  // ── Validación de campo individual ───────────────────────────────────────

  validateField(field) {
    if (!field) return { valid: true, error: "" };
    const value = field.value ? field.value.trim() : "";
    const fieldName = field.id || "";
    let error = "";

    if (field.hasAttribute && field.hasAttribute("required") && !value) {
      error = this.errorMessages.required;
      this.showFieldError(field, error);
      return { valid: false, error };
    }

    switch (fieldName) {
      case "regEmail":
        if (value && !this.patterns.email.test(value))
          error = this.errorMessages.email;
        break;
      case "regPassword":
        if (value && !this.patterns.password.test(value))
          error = this.errorMessages.password;
        break;
      case "regConfirmPassword": {
        const pass = document.getElementById("regPassword");
        if (pass && value && value !== pass.value)
          error = this.errorMessages.match;
        break;
      }
      case "regNombre":
      case "regApellido":
        if (value && !this.patterns.name.test(value))
          error = this.errorMessages.name;
        break;
      case "regUsername":
        if (value && !this.patterns.username.test(value))
          error = this.errorMessages.username;
        break;
    }

    if (error) {
      this.showFieldError(field, error);
      return { valid: false, error };
    }

    this.clearFieldError(field);
    return { valid: true, error: "" };
  }

  // ── Mostrar / limpiar error ───────────────────────────────────────────────

  showFieldError(field, message) {
    if (!field) return;
    field.classList && field.classList.add("error");
    const errorId = field.id + "Error";
    let errorElement = document.getElementById(errorId);
    if (!errorElement) {
      errorElement = field.parentElement
        ? field.parentElement.querySelector(".error-message")
        : null;
    }
    if (!errorElement) {
      errorElement = document.createElement("span");
      errorElement.className = "error-message";
      errorElement.id = errorId;
      if (field.parentElement) field.parentElement.appendChild(errorElement);
    }
    errorElement.textContent = message;
    errorElement.style.display = "block";
  }

  clearFieldError(field) {
    if (!field) return;
    field.classList && field.classList.remove("error");
    const errorId = field.id + "Error";
    let el = document.getElementById(errorId);
    if (!el && field.parentElement)
      el = field.parentElement.querySelector(".error-message");
    if (el) {
      el.textContent = "";
      el.style.display = "none";
    }
  }

  // ── Validación completa de formulario ─────────────────────────────────────

  validateForm(form) {
    let isValid = true;
    const inputs = form.querySelectorAll("input[required], input[pattern]");
    inputs.forEach((input) => {
      const v = this.validateField(input);
      if (!v.valid) isValid = false;
    });
    return isValid;
  }

  setupLiveValidation(form) {
    const inputs = form.querySelectorAll("input");
    inputs.forEach((input) => {
      input.addEventListener("blur", () => this.validateField(input));
      input.addEventListener("input", () => {
        if (input.classList.contains("error")) this.validateField(input);
      });
    });
  }

  // ── Validación backend (CORREGIDA: usa lg_users) ─────────────────────────

  async validateBackend(data) {
    const errors = [];

    // Simular latencia
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Lee la clave correcta que usa el nuevo userModel
    const users = JSON.parse(localStorage.getItem("lg_users") || "[]");

    if (data.email) {
      const emailExists = users.some((u) => u.email === data.email);
      if (emailExists) {
        errors.push({
          field: "email",
          message: "Este correo ya está registrado",
        });
      }
    }

    if (data.username) {
      const usernameExists = users.some((u) => u.username === data.username);
      if (usernameExists) {
        errors.push({
          field: "username",
          message: "Este nombre de usuario ya está en uso",
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ── CAPTCHA matemático (fallback si reCAPTCHA no carga) ──────────────────

  generateMathCaptcha() {
    const ops = [
      { type: "sum", symbol: "+" },
      { type: "subtract", symbol: "-" },
      { type: "multiply", symbol: "×" },
    ];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let n1 = Math.floor(Math.random() * 10) + 1;
    let n2 = Math.floor(Math.random() * 10) + 1;
    let answer;

    switch (op.type) {
      case "sum":
        answer = n1 + n2;
        break;
      case "subtract":
        if (n1 < n2) [n1, n2] = [n2, n1];
        answer = n1 - n2;
        break;
      case "multiply":
        n1 = Math.floor(Math.random() * 5) + 1;
        n2 = Math.floor(Math.random() * 5) + 1;
        answer = n1 * n2;
        break;
    }

    return { question: `¿Cuánto es ${n1} ${op.symbol} ${n2}?`, answer };
  }

  // ── Sanitización ─────────────────────────────────────────────────────────

  sanitize(input) {
    const div = document.createElement("div");
    div.textContent = input;
    return div.innerHTML;
  }
}

const validationService = new ValidationService();
