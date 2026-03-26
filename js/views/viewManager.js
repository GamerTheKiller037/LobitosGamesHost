// js/views/viewManager.js
// ViewManager CORREGIDO — sin dependencia directa de AuthMiddleware en showSection
// Mantiene toda la lógica original de paginación, listas, home y búsqueda.

const PLACEHOLDER_280x200 =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='280' height='200'%3E%3Crect width='100%25' height='100%25' fill='%231a0533'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='18' fill='%236809e5'%3ENo+Image%3C/text%3E%3C/svg%3E";
const PLACEHOLDER_200x280 =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='280'%3E%3Crect width='100%25' height='100%25' fill='%231a0533'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='18' fill='%236809e5'%3ENo+Image%3C/text%3E%3C/svg%3E";

class ViewManager {
  constructor() {
    this.currentSection = "home";
    this.searchTimeout = null;
  }

  init() {
    this.setupNavigation();
    this.setupSearch();
    this.setupModal();
    this.setupResetTabs();
    this.showSection("home");

    // Inicializar authController (ya existe porque se cargó antes en los scripts)
    if (typeof authController !== "undefined") {
      authController.init();
    }
  }

  // ── Navegación ────────────────────────────────────────────────────────────

  setupNavigation() {
    const navButtons = document.querySelectorAll(".nav-btn");
    navButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const section = button.getAttribute("data-section");
        this.showSection(section);
      });
    });
  }

  /**
   * Muestra una sección. Protección de rutas integrada aquí directamente
   * sin depender de AuthMiddleware para evitar el error de "not defined".
   */
  showSection(sectionName) {
    // ── Protección de rutas sin usar AuthMiddleware ──────────────────────────
    const routesRequiringLogin = ["my-lists", "settings", "admin-panel"];

    if (routesRequiringLogin.includes(sectionName)) {
      // Verificar login de forma segura
      const isLoggedIn =
        typeof userModel !== "undefined" && userModel.isLoggedIn();
      if (!isLoggedIn) {
        if (typeof authController !== "undefined") {
          authController.showMessage(
            "Debes iniciar sesión para acceder a esta sección.",
            "error",
          );
          authController.showLoginModal();
        }
        return;
      }

      // Para admin-panel, verificar rol
      if (sectionName === "admin-panel") {
        const isAdmin = typeof userModel !== "undefined" && userModel.isAdmin();
        if (!isAdmin) {
          if (typeof authController !== "undefined") {
            authController.showMessage(
              "Acceso restringido. Solo administradores.",
              "error",
            );
          }
          return;
        }
      }
    }

    // ── Ocultar todas las secciones ──────────────────────────────────────────
    const sections = document.querySelectorAll(".section");
    sections.forEach((section) => section.classList.remove("active"));

    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
      targetSection.classList.add("active");
      this.currentSection = sectionName;
    }

    // ── Actualizar nav activo ────────────────────────────────────────────────
    const navButtons = document.querySelectorAll(".nav-btn");
    navButtons.forEach((btn) => btn.classList.remove("active"));
    const activeButton = document.querySelector(
      `[data-section="${sectionName}"]`,
    );
    if (activeButton) activeButton.classList.add("active");

    // ── Mostrar/ocultar barra de búsqueda ────────────────────────────────────
    const searchSection = document.getElementById("searchSection");
    if (searchSection) {
      const noSearch = ["home", "my-lists", "settings", "admin-panel"];
      if (noSearch.includes(sectionName)) {
        searchSection.classList.remove("active");
      } else {
        searchSection.classList.add("active");
      }
    }

    this.initializeSection(sectionName);
    this.clearSearch();
  }

  async initializeSection(sectionName) {
    switch (sectionName) {
      case "home":
        await this.loadHomeContent();
        break;
      case "animes":
        await animeController.init();
        if (typeof animeController.updatePaginationUI === "function") {
          animeController.updatePaginationUI();
        }
        break;
      case "games":
        await gameController.init();
        if (typeof gameController.updatePaginationUI === "function") {
          gameController.updatePaginationUI();
        }
        break;
      case "my-lists":
        await this.loadUserLists();
        break;
      case "settings":
        this._initSettings();
        break;
      case "admin-panel":
        if (typeof adminController !== "undefined") adminController.loadUsers();
        break;
      default:
        break;
    }
  }

  // ── Home content ──────────────────────────────────────────────────────────

  async loadHomeContent() {
    const featuredContent = document.getElementById("featuredContent");
    if (!featuredContent) return;

    featuredContent.innerHTML =
      '<div class="loading"><p>Cargando contenido...</p></div>';

    await Promise.all([animeModel.loadAnimes(), gameModel.loadGames()]);

    const animes = animeController.getFeaturedAnimes();
    const games = gameController.getFeaturedGames();
    const allFeatured = [...animes, ...games];

    if (allFeatured.length === 0) {
      featuredContent.innerHTML =
        '<div class="error-message"><p>No se pudo cargar el contenido destacado</p></div>';
      return;
    }

    featuredContent.innerHTML = allFeatured
      .map((item) => {
        const isAnime = item.episodes !== undefined;
        const controller = isAnime ? "animeController" : "gameController";

        let ratingHTML = "";
        if (isAnime) {
          ratingHTML = `<span class="rating">⭐ ${item.rating}</span>`;
        } else {
          ratingHTML = item.metacritic
            ? `<span class="metacritic-score" style="background-color:${item.metacriticColor || "#27ae60"}">${item.metacritic}</span>`
            : '<span class="no-score">N/A</span>';
        }

        return `
          <div class="catalog-item" onclick="${controller}.showDetails(${item.id})">
            <img src="${item.image}" alt="${item.title}" class="item-poster"
                 onerror="this.onerror=null;this.src='${PLACEHOLDER_280x200}'">
            <div class="item-info">
              <h3>${item.title}</h3>
              <div class="item-meta">
                ${ratingHTML}
                <span class="year">${item.year}</span>
              </div>
              <p class="genre">${item.genre}</p>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  _initSettings() {
    if (typeof authController === "undefined") return;
    authController.refreshSettingsPanel();
    authController.renderActiveSessions();
    const user =
      typeof userModel !== "undefined" ? userModel.getCurrentUser() : null;
    if (!user) return;
    const temaEl = document.getElementById("prefersTema");
    const idiomaEl = document.getElementById("prefersIdioma");
    if (temaEl) temaEl.value = user.tema || "dark";
    if (idiomaEl) idiomaEl.value = user.idioma || "es";
  }

  // ── Búsqueda ──────────────────────────────────────────────────────────────

  setupSearch() {
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.querySelector(".search-btn");

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.handleSearch(e.target.value);
        }, 300);
      });

      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          clearTimeout(this.searchTimeout);
          this.handleSearch(e.target.value);
        }
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener("click", () => {
        const searchTerm = searchInput ? searchInput.value : "";
        this.handleSearch(searchTerm);
      });
    }
  }

  handleSearch(searchTerm) {
    if (this.currentSection === "animes") {
      animeController.search(searchTerm);
    } else if (this.currentSection === "games") {
      gameController.search(searchTerm);
    }
  }

  clearSearch() {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";
  }

  // ── Modal de detalles ─────────────────────────────────────────────────────

  setupModal() {
    const modal = document.getElementById("detailsModal");
    const overlay = modal ? modal.querySelector(".modal-overlay") : null;
    const closeBtn = modal ? modal.querySelector(".modal-close") : null;

    if (overlay) overlay.addEventListener("click", () => this.closeModal());
    if (closeBtn) closeBtn.addEventListener("click", () => this.closeModal());

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && modal.classList.contains("active")) {
        this.closeModal();
      }
    });
  }

  closeModal() {
    const modal = document.getElementById("detailsModal");
    if (modal) {
      modal.classList.remove("active");
      document.body.style.overflow = "auto";
    }
  }

  // ── Listas de usuario ─────────────────────────────────────────────────────

  async loadUserLists() {
    if (typeof userModel === "undefined" || !userModel.isLoggedIn()) return;

    const lists = userListModel.getUserLists();
    this.renderList("favoritosList", lists.favoritos);
    this.renderList("viendoJugandoList", [...lists.viendo, ...lists.jugando]);
    this.renderList("considerandoList", lists.considerando);
    this.renderList("completadoList", lists.completado);
    this.renderList("dropeadoList", lists.dropeado);
  }

  renderList(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML =
        '<div class="list-empty">No hay items en esta lista</div>';
      return;
    }

    container.innerHTML = items
      .map((item) => {
        const isAnime = item.mediaType === "anime";
        const controller = isAnime ? "animeController" : "gameController";

        let ratingHTML = "";
        if (isAnime) {
          ratingHTML = `<span class="rating">⭐ ${item.rating || "N/A"}</span>`;
        } else {
          ratingHTML = item.metacritic
            ? `<span class="metacritic-score" style="background-color:${item.metacriticColor || "#27ae60"}">${item.metacritic}</span>`
            : '<span class="no-score">N/A</span>';
        }

        return `
          <div class="catalog-item" onclick="${controller}.showDetails(${item.id})">
            <img src="${item.image}" alt="${item.title}" class="item-poster"
                 onerror="this.onerror=null;this.src='${PLACEHOLDER_200x280}'">
            <div class="item-info">
              <h3>${item.title}</h3>
              <div class="item-meta">
                ${ratingHTML}
                <span class="year">${item.year || ""}</span>
              </div>
              <p class="genre">${item.genre || ""}</p>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // ── Tabs de recuperación de contraseña ───────────────────────────────────

  setupResetTabs() {
    document.querySelectorAll(".reset-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document
          .querySelectorAll(".reset-tab")
          .forEach((t) => t.classList.remove("active"));
        document
          .querySelectorAll(".reset-tab-content")
          .forEach((c) => c.classList.remove("active"));
        tab.classList.add("active");
        const target = document.getElementById(tab.getAttribute("data-tab"));
        if (target) target.classList.add("active");
      });
    });
  }
}

const viewManager = new ViewManager();
