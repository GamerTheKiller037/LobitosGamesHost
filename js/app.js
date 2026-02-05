// js/app.js
// Aplicación principal ACTUALIZADA

class App {
  constructor() {
    this.version = "1.0.1";
  }

  async init() {
    try {
      if (document.readyState === "loading") {
        await new Promise((resolve) => {
          document.addEventListener("DOMContentLoaded", resolve);
        });
      }

      // Inicializar controladores
      viewManager.init();
      searchController.init();

      await carouselController.init();

      this.setupScrollEffect();
      // this.setupSearchHandlers();

      console.log(`LobitosGames v${this.version} initialized`);
      console.log("Módulos activos: Búsqueda Avanzada, Validación, CAPTCHA");
    } catch (error) {
      console.error("Error initializing app:", error);
    }
  }

  setupScrollEffect() {
    const header = document.querySelector(".header");
    window.addEventListener("scroll", () => {
      if (window.scrollY > 50) {
        header.classList.add("scrolled");
      } else {
        header.classList.remove("scrolled");
      }
    });
  }

  setupSearchHandlers() {
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.querySelector(".search-btn");

    if (searchInput) {
      let searchTimeout;

      searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          const searchTerm = e.target.value.trim();
          if (searchTerm.length >= 2) {
            searchController.performSimpleSearch(searchTerm);
          }
        }, 500);
      });

      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          const searchTerm = e.target.value.trim();
          searchController.performSimpleSearch(searchTerm);
        }
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener("click", () => {
        const searchTerm = searchInput.value.trim();
        searchController.performSimpleSearch(searchTerm);
      });
    }
  }
}

const app = new App();
app.init();
