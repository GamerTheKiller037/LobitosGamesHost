// js/models/userModel.js
// Modelo de Usuario - CORREGIDO con usuario de prueba funcional

class UserModel {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;

    // Cargar usuario desde localStorage si existe
    this.loadUserFromStorage();
  }

  // ==================== MÉTODOS DE AUTENTICACIÓN ====================

  /**
   * Registrar un nuevo usuario
   * @param {Object} userData - { username, email, password, nombre, apellido }
   * @returns {Promise<Object>} - Usuario creado o error
   */
  async register(userData) {
    try {
      // TODO: Cuando se implemente la BD, hacer:
      // const response = await fetch('/api/auth/register', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(userData)
      // });
      // const data = await response.json();

      // SIMULACIÓN TEMPORAL (sin BD)
      const users = this.getUsersFromStorage();

      // Verificar si el usuario ya existe
      if (users.find((u) => u.email === userData.email)) {
        throw new Error("El correo electrónico ya está registrado");
      }

      if (users.find((u) => u.username === userData.username)) {
        throw new Error("El nombre de usuario ya está en uso");
      }

      // Crear nuevo usuario
      const newUser = {
        id: Date.now(),
        username: userData.username,
        email: userData.email,
        nombre: userData.nombre,
        apellido: userData.apellido,
        password: this.hashPassword(userData.password), // En producción usar bcrypt
        createdAt: new Date().toISOString(),
        avatar: this.getDefaultAvatar(),
      };

      users.push(newUser);
      localStorage.setItem("users", JSON.stringify(users));

      return { success: true, user: this.sanitizeUser(newUser) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Iniciar sesión
   * @param {string} emailOrUsername - Email o nombre de usuario
   * @param {string} password - Contraseña
   * @returns {Promise<Object>} - Usuario autenticado o error
   */
  async login(emailOrUsername, password) {
    try {
      // TODO: Cuando se implemente la BD, hacer:
      // const response = await fetch('/api/auth/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ emailOrUsername, password })
      // });

      // SIMULACIÓN TEMPORAL (sin BD)
      const users = this.getUsersFromStorage();
      const hashedPassword = this.hashPassword(password);

      console.log("🔐 Intentando login con:", emailOrUsername);
      console.log("🔑 Password hasheado:", hashedPassword);

      const user = users.find(
        (u) =>
          (u.email === emailOrUsername || u.username === emailOrUsername) &&
          u.password === hashedPassword,
      );

      if (!user) {
        console.error("❌ Usuario no encontrado o contraseña incorrecta");
        throw new Error("Credenciales incorrectas");
      }

      console.log("✅ Login exitoso:", user.username);

      // Establecer usuario actual
      this.currentUser = this.sanitizeUser(user);
      this.isAuthenticated = true;

      // Guardar sesión
      localStorage.setItem("currentUser", JSON.stringify(this.currentUser));
      localStorage.setItem("isAuthenticated", "true");

      return { success: true, user: this.currentUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Cerrar sesión
   */
  logout() {
    this.currentUser = null;
    this.isAuthenticated = false;
    localStorage.removeItem("currentUser");
    localStorage.removeItem("isAuthenticated");
  }

  /**
   * Verificar si hay un usuario autenticado
   * @returns {boolean}
   */
  isLoggedIn() {
    return this.isAuthenticated && this.currentUser !== null;
  }

  /**
   * Obtener usuario actual
   * @returns {Object|null}
   */
  getCurrentUser() {
    return this.currentUser;
  }

  // ==================== MÉTODOS AUXILIARES ====================

  /**
   * Cargar usuario desde localStorage
   */
  loadUserFromStorage() {
    const userData = localStorage.getItem("currentUser");
    const authStatus = localStorage.getItem("isAuthenticated");

    if (userData && authStatus === "true") {
      this.currentUser = JSON.parse(userData);
      this.isAuthenticated = true;
    }
  }

  /**
   * Obtener lista de usuarios desde localStorage
   * @returns {Array}
   */
  getUsersFromStorage() {
    const users = localStorage.getItem("users");

    if (!users) {
      // Si no hay usuarios, crear usuario de prueba por defecto
      const defaultUsers = [
        {
          id: 1,
          username: "prueba",
          email: "prueba@lobitosgames.com",
          password: "1gcgahs", // Hash de "123456"
          nombre: "Usuario",
          apellido: "Prueba",
          createdAt: new Date().toISOString(),
          avatar: this.getDefaultAvatar(),
        },
        {
          id: 2,
          username: "admin",
          email: "admin@lobitosgames.com",
          password: "1gcgahs", // Hash de "123456"
          nombre: "Admin",
          apellido: "Sistema",
          createdAt: new Date().toISOString(),
          avatar: this.getDefaultAvatar(),
        },
      ];

      localStorage.setItem("users", JSON.stringify(defaultUsers));
      console.log("✅ Usuarios de prueba creados:");
      console.log("   👤 Usuario: prueba / Contraseña: 123456");
      console.log("   👤 Usuario: admin / Contraseña: 123456");

      return defaultUsers;
    }

    return JSON.parse(users);
  }

  /**
   * Hash simple de contraseña (SOLO PARA DESARROLLO)
   * En producción se debe usar bcrypt o similar
   * @param {string} password
   * @returns {string}
   */
  hashPassword(password) {
    // ⚠️ ESTO ES SOLO PARA DESARROLLO - NO USAR EN PRODUCCIÓN
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Remover información sensible del usuario
   * @param {Object} user
   * @returns {Object}
   */
  sanitizeUser(user) {
    const { password, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Obtener avatar por defecto
   * @returns {string}
   */
  getDefaultAvatar() {
    return "https://via.placeholder.com/150/6809e5/FFFFFF?text=User";
  }

  /**
   * Actualizar perfil de usuario
   * @param {Object} updates - Datos a actualizar
   * @returns {Promise<Object>}
   */
  async updateProfile(updates) {
    try {
      if (!this.isLoggedIn()) {
        throw new Error("Debes iniciar sesión para actualizar tu perfil");
      }

      // TODO: Cuando se implemente la BD
      // const response = await fetch(`/api/users/${this.currentUser.id}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(updates)
      // });

      // SIMULACIÓN TEMPORAL
      const users = this.getUsersFromStorage();
      const userIndex = users.findIndex((u) => u.id === this.currentUser.id);

      if (userIndex === -1) {
        throw new Error("Usuario no encontrado");
      }

      // Actualizar usuario
      users[userIndex] = { ...users[userIndex], ...updates };
      localStorage.setItem("users", JSON.stringify(users));

      // Actualizar usuario actual
      this.currentUser = this.sanitizeUser(users[userIndex]);
      localStorage.setItem("currentUser", JSON.stringify(this.currentUser));

      return { success: true, user: this.currentUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Crear instancia global
const userModel = new UserModel();
