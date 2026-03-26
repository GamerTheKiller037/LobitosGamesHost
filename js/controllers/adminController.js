// js/controllers/adminController.js
// AdminController — gestión de usuarios, logs y sesiones (solo admin).

class AdminController {
  loadUsers() {
    const isAdmin = typeof userModel !== "undefined" && userModel.isAdmin();
    if (!isAdmin) {
      if (typeof authController !== "undefined")
        authController.showMessage("Solo administradores.", "error");
      return;
    }

    const users = JSON.parse(localStorage.getItem("lg_users") || "[]");
    const container = document.getElementById("adminUsersList");
    if (!container) return;

    if (!users.length) {
      container.innerHTML = "<p>No hay usuarios registrados.</p>";
      return;
    }

    container.innerHTML = `
      <div class="admin-table-wrapper">
        <table class="admin-table">
          <thead>
            <tr><th>Usuario</th><th>Email</th><th>Rol</th><th>MFA</th><th>Creado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            ${users
              .map(
                (u) => `
              <tr>
                <td>${u.username}</td>
                <td>${u.email}</td>
                <td><span class="role-badge role-${u.role}">${u.role}</span></td>
                <td>${u.mfaEnabled ? "✅" : "❌"}</td>
                <td>${new Date(u.createdAt).toLocaleDateString()}</td>
                <td>
                  <select onchange="adminController.changeUserRole('${u.id}', this.value)" style="font-size:.8rem;padding:3px;">
                    <option ${u.role === "usuario" ? "selected" : ""} value="usuario">Usuario</option>
                    <option ${u.role === "editor" ? "selected" : ""} value="editor">Editor</option>
                    <option ${u.role === "admin" ? "selected" : ""} value="admin">Admin</option>
                  </select>
                </td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  }

  changeUserRole(userId, newRole) {
    const users = JSON.parse(localStorage.getItem("lg_users") || "[]");
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return;
    users[idx].role = newRole;
    localStorage.setItem("lg_users", JSON.stringify(users));
    if (typeof authController !== "undefined")
      authController.showMessage(
        `Rol de ${users[idx].username} cambiado a ${newRole}.`,
        "success",
      );
  }

  loadSecurityLogs() {
    const isAdmin = typeof userModel !== "undefined" && userModel.isAdmin();
    if (!isAdmin) return;

    const logs = JSON.parse(
      localStorage.getItem("lg_security_logs") || "[]",
    ).reverse();
    const container = document.getElementById("securityLogsList");
    if (!container) return;

    if (!logs.length) {
      container.innerHTML = "<p>No hay logs.</p>";
      return;
    }

    container.innerHTML = `
      <div class="admin-table-wrapper">
        <table class="admin-table">
          <thead><tr><th>Fecha</th><th>UserID</th><th>Evento</th><th>Detalles</th></tr></thead>
          <tbody>
            ${logs
              .slice(0, 50)
              .map(
                (l) => `
              <tr>
                <td>${new Date(l.timestamp).toLocaleString()}</td>
                <td>${l.userId || "—"}</td>
                <td><span class="log-event log-${l.event}">${l.event}</span></td>
                <td>${l.details || ""}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  }

  loadAllSessions() {
    const isAdmin = typeof userModel !== "undefined" && userModel.isAdmin();
    if (!isAdmin) return;

    const sessions = JSON.parse(
      localStorage.getItem("lg_sessions") || "[]",
    ).filter((s) => s.isActive);
    const container = document.getElementById("allSessionsList");
    if (!container) return;

    if (!sessions.length) {
      container.innerHTML = "<p>No hay sesiones activas.</p>";
      return;
    }

    container.innerHTML = `
      <div class="admin-table-wrapper">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>UserID</th><th>IP</th><th>Dispositivo</th><th>Inicio</th><th>Acción</th></tr></thead>
          <tbody>
            ${sessions
              .map(
                (s) => `
              <tr>
                <td>${s.id.slice(0, 10)}…</td>
                <td>${s.userId}</td>
                <td>${s.ipAddress || "N/A"}</td>
                <td>${s.deviceInfo || "N/A"}</td>
                <td>${new Date(s.createdAt).toLocaleString()}</td>
                <td><button class="btn-danger-sm" onclick="adminController.forceRevokeSession('${s.id}')">Revocar</button></td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  }

  forceRevokeSession(sessionId) {
    if (typeof userModel !== "undefined") userModel.revokeSession(sessionId);
    if (typeof authController !== "undefined")
      authController.showMessage("Sesión revocada.", "success");
    this.loadAllSessions();
  }
}

const adminController = new AdminController();
