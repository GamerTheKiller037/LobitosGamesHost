// js/middlewares/authMiddleware.js
// Versión DEFENSIVA: todas las referencias a authController están protegidas
// con typeof para evitar "not defined" sin importar el orden de carga.

const AuthMiddleware = {
  requireAuth() {
    const loggedIn = typeof userModel !== "undefined" && userModel.isLoggedIn();
    if (!loggedIn) {
      console.warn("[Middleware] No autenticado.");
      if (typeof authController !== "undefined") {
        authController.showMessage(
          "Debes iniciar sesión para acceder a esta sección.",
          "error",
        );
        authController.showLoginModal();
      }
      return false;
    }
    return true;
  },

  requireRole(role) {
    if (!this.requireAuth()) return false;
    const has = typeof userModel !== "undefined" && userModel.hasRole(role);
    if (!has) {
      console.warn(`[Middleware] Rol '${role}' requerido.`);
      if (typeof authController !== "undefined") {
        authController.showMessage(
          "No tienes permiso para esta sección.",
          "error",
        );
      }
      return false;
    }
    return true;
  },

  requirePermission(permission) {
    if (!this.requireAuth()) return false;
    const has =
      typeof userModel !== "undefined" && userModel.hasPermission(permission);
    if (!has) {
      if (typeof authController !== "undefined") {
        authController.showMessage(
          "No tienes los permisos necesarios.",
          "error",
        );
      }
      return false;
    }
    return true;
  },

  applyRoleVisibility() {
    const user =
      typeof userModel !== "undefined" ? userModel.getCurrentUser() : null;

    document.querySelectorAll("[data-role]").forEach((el) => {
      const req = el.getAttribute("data-role");
      const show =
        user && typeof userModel !== "undefined" && userModel.hasRole(req);
      el.style.display = show ? "" : "none";
    });

    document.querySelectorAll("[data-permission]").forEach((el) => {
      const perm = el.getAttribute("data-permission");
      const show =
        user &&
        typeof userModel !== "undefined" &&
        userModel.hasPermission(perm);
      el.style.display = show ? "" : "none";
    });

    document.querySelectorAll("[data-guest-only]").forEach((el) => {
      el.style.display = user ? "none" : "";
    });

    document.querySelectorAll("[data-auth-only]").forEach((el) => {
      el.style.display = user ? "" : "none";
    });
  },

  canAccessSection(sectionName) {
    const map = {
      "my-lists": null, // solo login
      settings: null, // solo login
      "admin-panel": "admin", // solo admin
    };
    const needed = map[sectionName];
    if (needed === undefined) return true; // sección pública
    if (!this.requireAuth()) return false;
    if (needed !== null) {
      const isAdmin = typeof userModel !== "undefined" && userModel.isAdmin();
      const hasRole =
        typeof userModel !== "undefined" && userModel.hasRole(needed);
      if (needed === "editor" && isAdmin) return true;
      if (!hasRole) {
        if (typeof authController !== "undefined") {
          authController.showMessage(
            "Acceso restringido para tu rol.",
            "error",
          );
        }
        return false;
      }
    }
    return true;
  },

  getAuthHeaders() {
    const token =
      typeof userModel !== "undefined" ? userModel.getAccessToken() : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};
