// js/controllers/authController.js
// Controlador de autenticación y gestión de usuario - CORREGIDO

class AuthController {
  constructor() {
    this.model = userModel;
  }

  /**
   * Inicializar el controlador
   */
  init() {
    this.setupEventListeners();
    this.updateUIState();

    // Mostrar botón de "Mis Listas" si el usuario está logueado
    const myListsBtn = document.getElementById("myListsBtn");
    if (myListsBtn) {
      myListsBtn.style.display = this.model.isLoggedIn() ? "block" : "none";
    }
  }

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    // Event listener para formulario de login
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;

        if (!email || !password) {
          this.showMessage("Por favor completa todos los campos", "error");
          return;
        }

        await this.handleLogin(email, password);
      });
    }

    // Event listener para formulario de registro
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = {
          nombre: document.getElementById("regNombre").value,
          apellido: document.getElementById("regApellido").value,
          username: document.getElementById("regUsername").value,
          email: document.getElementById("regEmail").value,
          password: document.getElementById("regPassword").value,
          confirmPassword: document.getElementById("regConfirmPassword").value,
        };

        // Validar formulario
        const validation = this.validateRegisterForm(formData);
        if (!validation.valid) {
          this.showMessage(validation.errors.join(", "), "error");
          return;
        }

        await this.handleRegister(formData);
      });
    }
  }

  /**
   * Manejar el registro de usuario
   * @param {Object} formData - Datos del formulario
   */
  async handleRegister(formData) {
    try {
      const result = await this.model.register(formData);

      if (result.success) {
        // Limpiar formulario
        document.getElementById("registerForm").reset();

        // Mostrar mensaje de éxito
        this.showMessage(
          "Registro exitoso. Por favor inicia sesión.",
          "success",
        );

        // Cerrar modal de registro y abrir login
        this.closeAuthModals();

        setTimeout(() => {
          this.showLoginModal();
        }, 500);
      } else {
        this.showMessage(result.error, "error");
      }
    } catch (error) {
      this.showMessage("Error al registrar usuario", "error");
      console.error(error);
    }
  }

  /**
   * Manejar el inicio de sesión
   * @param {string} emailOrUsername - Email o username
   * @param {string} password - Contraseña
   */
  async handleLogin(emailOrUsername, password) {
    try {
      const result = await this.model.login(emailOrUsername, password);

      if (result.success) {
        // Limpiar formulario
        document.getElementById("loginForm").reset();

        this.showMessage(`¡Bienvenido, ${result.user.nombre}!`, "success");
        this.updateUIState();
        this.closeAuthModals();

        // Mostrar botón de "Mis Listas"
        const myListsBtn = document.getElementById("myListsBtn");
        if (myListsBtn) {
          myListsBtn.style.display = "block";
        }
      } else {
        this.showMessage(result.error, "error");
      }
    } catch (error) {
      this.showMessage("Error al iniciar sesión", "error");
      console.error(error);
    }
  }

  /**
   * Manejar el cierre de sesión
   */
  handleLogout() {
    if (confirm("¿Estás seguro de que quieres cerrar sesión?")) {
      this.model.logout();
      this.updateUIState();
      this.showMessage("Sesión cerrada exitosamente", "info");

      // Ocultar botón de "Mis Listas"
      const myListsBtn = document.getElementById("myListsBtn");
      if (myListsBtn) {
        myListsBtn.style.display = "none";
      }

      // Redirigir a inicio
      if (viewManager) {
        viewManager.showSection("home");
      }
    }
  }

  /**
   * Actualizar el estado de la UI según la autenticación
   */
  updateUIState() {
    const isLoggedIn = this.model.isLoggedIn();
    const user = this.model.getCurrentUser();

    // Actualizar botones de header
    const authButtons = document.getElementById("authButtons");
    const userMenu = document.getElementById("userMenu");

    if (authButtons && userMenu) {
      if (isLoggedIn) {
        authButtons.style.display = "none";
        userMenu.style.display = "flex";

        // Actualizar información del usuario
        const usernameDisplay = document.getElementById("usernameDisplay");
        const userAvatar = document.getElementById("userAvatar");

        if (usernameDisplay) {
          usernameDisplay.textContent = user.username;
        }

        if (userAvatar) {
          userAvatar.src = user.avatar || userModel.getDefaultAvatar();
        }
      } else {
        authButtons.style.display = "flex";
        userMenu.style.display = "none";
      }
    }

    // Actualizar botón de "Mis Listas"
    const myListsBtn = document.getElementById("myListsBtn");
    if (myListsBtn) {
      myListsBtn.style.display = isLoggedIn ? "block" : "none";
    }
  }

  /**
   * Mostrar modal de login
   */
  showLoginModal() {
    const modal = document.getElementById("loginModal");
    if (modal) {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";

      // Focus en el primer campo
      setTimeout(() => {
        const emailInput = document.getElementById("loginEmail");
        if (emailInput) emailInput.focus();
      }, 100);
    }
  }

  /**
   * Mostrar modal de registro
   */
  showRegisterModal() {
    const modal = document.getElementById("registerModal");
    if (modal) {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";

      // Focus en el primer campo
      setTimeout(() => {
        const nombreInput = document.getElementById("regNombre");
        if (nombreInput) nombreInput.focus();
      }, 100);
    }
  }

  /**
   * Cerrar modales de autenticación
   */
  closeAuthModals() {
    const loginModal = document.getElementById("loginModal");
    const registerModal = document.getElementById("registerModal");

    if (loginModal) {
      loginModal.classList.remove("active");
    }

    if (registerModal) {
      registerModal.classList.remove("active");
    }

    document.body.style.overflow = "auto";
  }

  /**
   * Mostrar mensaje al usuario
   * @param {string} message - Mensaje
   * @param {string} type - Tipo: 'success', 'error', 'info'
   */
  showMessage(message, type = "info") {
    // Crear elemento de notificación
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Agregar al DOM
    document.body.appendChild(notification);

    // Animar entrada
    setTimeout(() => notification.classList.add("show"), 100);

    // Remover después de 3 segundos
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Validar formulario de registro
   * @param {Object} formData - Datos del formulario
   * @returns {Object} - { valid: boolean, errors: Array }
   */
  validateRegisterForm(formData) {
    const errors = [];

    if (!formData.nombre || formData.nombre.trim().length < 2) {
      errors.push("El nombre debe tener al menos 2 caracteres");
    }

    if (!formData.apellido || formData.apellido.trim().length < 2) {
      errors.push("El apellido debe tener al menos 2 caracteres");
    }

    if (!formData.username || formData.username.trim().length < 3) {
      errors.push("El nombre de usuario debe tener al menos 3 caracteres");
    }

    if (!formData.email || !this.isValidEmail(formData.email)) {
      errors.push("El correo electrónico no es válido");
    }

    if (!formData.password || formData.password.length < 6) {
      errors.push("La contraseña debe tener al menos 6 caracteres");
    }

    if (formData.password !== formData.confirmPassword) {
      errors.push("Las contraseñas no coinciden");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validar email
   * @param {string} email - Email a validar
   * @returns {boolean}
   */
  isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }
}

// Crear instancia global
const authController = new AuthController();
