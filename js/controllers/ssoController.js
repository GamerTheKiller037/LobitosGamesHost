// js/controllers/ssoController.js
// SSOController — Single Sign-On simulado entre App A y App B.

class SSOController {
  openAppB() {
    const loggedIn = typeof userModel !== "undefined" && userModel.isLoggedIn();
    if (!loggedIn) {
      if (typeof authController !== "undefined")
        authController.showMessage(
          "Debes iniciar sesión para usar SSO.",
          "error",
        );
      return;
    }

    const token = userModel.generateSsoToken();
    const user = userModel.getCurrentUser();
    const modal = document.getElementById("ssoModal");
    const appBEl = document.getElementById("ssoAppB");

    if (!modal || !appBEl) return;

    // Simular recepción en App B
    const validation = userModel.validateSsoToken(token);

    if (validation.valid) {
      appBEl.innerHTML = `
        <div class="sso-header">
          <span class="sso-logo">App B — LobitosStore</span>
          <span style="font-size:.8rem;color:#888">(Simulado)</span>
        </div>
        <div style="padding:12px 0;font-size:.9rem;">
          <p>✅ Autenticado correctamente sin credenciales nuevas.</p>
          <p><strong>Usuario:</strong> ${validation.user.username}</p>
          <p><strong>Rol:</strong> ${validation.user.role}</p>
          <p><strong>Token SSO:</strong> <code style="font-size:.8rem">${token.slice(0, 18)}…</code></p>
          <p style="font-size:.78rem;color:#888;font-style:italic">Este token es de un solo uso y expira en 5 minutos.</p>
        </div>
        <div style="border-top:1px solid rgba(104,9,229,.2);padding-top:12px;margin-top:4px;">
          <h4 style="color:#6809e5;margin-bottom:8px">Catálogo exclusivo App B</h4>
          <p style="font-size:.85rem;color:#888">Contenido al que accediste via SSO desde LobitosGames.</p>
        </div>`;
    } else {
      appBEl.innerHTML =
        '<p style="color:#e74c3c">Error al generar token SSO.</p>';
    }

    modal.classList.add("active");
    console.log(`[SSO] Token generado: ${token}`);
  }

  handleIncomingSSO() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("sso_token");
    if (!token) return;

    if (typeof userModel !== "undefined") {
      const result = userModel.validateSsoToken(token);
      if (result.valid && typeof authController !== "undefined") {
        authController.showMessage(
          `Bienvenido via SSO: ${result.user.username}`,
          "success",
        );
      }
    }
  }
}

const ssoController = new SSOController();
