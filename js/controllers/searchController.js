// js/controllers/searchController.js
// CORREGIDO: filtros avanzados ocultos por defecto, toggle con clase "open"/"show",
// applyAdvancedFilters y clearFilters funcionando

class SearchController {
  constructor() {
    this.advancedPanelOpen = false;
    this.currentSection = "animes";
    this.advancedFilters = {};
  }

  init() {
    this.setupEventListeners();
    this.updateGenreFilters();
    this.updateRatingSlider();
    // Asegurar que el panel empiece cerrado
    this._closePanel();
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  setupEventListeners() {
    // Input búsqueda
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      let timer;
      searchInput.addEventListener("input", (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const val = e.target.value.trim();
          this._runSearch(val);
        }, 500);
      });
      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          clearTimeout(timer);
          this._runSearch(e.target.value.trim());
        }
      });
    }

    // Botón buscar
    const searchBtn = document.querySelector(".search-btn");
    if (searchBtn) {
      searchBtn.addEventListener("click", () => {
        this._runSearch(
          document.getElementById("searchInput")?.value.trim() || "",
        );
      });
    }

    // Slider calificación (soporta ambos IDs de ambas versiones del HTML)
    const slider = document.getElementById("filterRating");
    const sliderVal =
      document.getElementById("filterRatingValue") ||
      document.getElementById("ratingValue");
    if (slider && sliderVal) {
      slider.addEventListener("input", (e) => {
        const v = parseFloat(e.target.value);
        sliderVal.textContent =
          this.currentSection === "games" ? Math.round(v * 10) : v.toFixed(1);
      });
    }

    // Detectar sección activa desde los botones de nav
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sec = btn.getAttribute("data-section");
        if (sec === "animes" || sec === "games") {
          this.currentSection = sec;
          this.updateGenreFilters();
          this.updateRatingSlider();
        }
      });
    });
  }

  _runSearch(val) {
    if (!val || val.length < 2) {
      // Sin búsqueda: recargar catálogo normal
      if (
        this.currentSection === "animes" &&
        typeof animeController !== "undefined"
      ) {
        animeController.renderAnimeGrid && animeController.renderAnimeGrid();
      } else if (typeof gameController !== "undefined") {
        gameController.renderGameGrid && gameController.renderGameGrid();
      }
      return;
    }
    if (
      this.currentSection === "animes" &&
      typeof animeController !== "undefined"
    ) {
      animeController.search(val);
    } else if (typeof gameController !== "undefined") {
      gameController.search(val);
    }
  }

  // ── Toggle del panel de filtros avanzados ─────────────────────────────────

  toggleAdvancedSearch() {
    this.advancedPanelOpen ? this._closePanel() : this._openPanel();
  }

  _openPanel() {
    // Soporta ambas versiones del panel (nuevo y original)
    const panel =
      document.getElementById("advancedFiltersPanel") ||
      document.getElementById("advancedSearchPanel");
    const btn =
      document.querySelector(".btn-filters") ||
      document.querySelector(".btn-advanced-search");
    if (!panel) return;

    this.advancedPanelOpen = true;
    panel.style.display = "block";
    requestAnimationFrame(() => {
      // Soporta ambas clases
      panel.classList.add("open");
      panel.classList.add("show");
    });
    if (btn) btn.textContent = "Ocultar Filtros ▲";
  }

  _closePanel() {
    const panel =
      document.getElementById("advancedFiltersPanel") ||
      document.getElementById("advancedSearchPanel");
    const btn =
      document.querySelector(".btn-filters") ||
      document.querySelector(".btn-advanced-search");
    if (!panel) return;

    this.advancedPanelOpen = false;
    panel.classList.remove("open");
    panel.classList.remove("show");
    setTimeout(() => {
      if (!this.advancedPanelOpen) panel.style.display = "none";
    }, 310);
    if (btn) btn.textContent = "Filtros avanzados ▼";
  }

  // ── Aplicar filtros ───────────────────────────────────────────────────────

  applyAdvancedFilters() {
    const genre = document.getElementById("filterGenre")?.value || "";
    const yearMin =
      parseInt(document.getElementById("filterYearMin")?.value) || null;
    const yearMax =
      parseInt(document.getElementById("filterYearMax")?.value) || null;
    const rating =
      parseFloat(document.getElementById("filterRating")?.value) || 0;
    const sort = document.getElementById("filterSort")?.value || "relevance";

    if (yearMin && yearMax && yearMin > yearMax) {
      if (typeof authController !== "undefined") {
        authController.showMessage(
          "El año inicial no puede ser mayor que el año final.",
          "error",
        );
      }
      return;
    }

    this.advancedFilters = { genre, yearMin, yearMax, rating, sort };

    if (
      this.currentSection === "animes" &&
      typeof animeController !== "undefined"
    ) {
      this._applyToAnimes();
    } else if (typeof gameController !== "undefined") {
      this._applyToGames();
    }
  }

  _applyToAnimes() {
    const { genre, yearMin, yearMax, rating, sort } = this.advancedFilters;
    let items = typeof animeModel !== "undefined" ? [...animeModel.animes] : [];

    if (genre) {
      items = items.filter((a) => {
        const g = (a.genre || a.genero || "").toLowerCase();
        return g.includes(genre.toLowerCase());
      });
    }
    if (yearMin)
      items = items.filter((a) => parseInt(a.year || a.año || 0) >= yearMin);
    if (yearMax)
      items = items.filter((a) => parseInt(a.year || a.año || 0) <= yearMax);
    if (rating > 0)
      items = items.filter((a) => parseFloat(a.rating || 0) >= rating);

    items = this._sort(items, sort, false);

    if (
      typeof animeController !== "undefined" &&
      typeof animeController.renderAnimeGrid === "function"
    ) {
      animeController.renderAnimeGrid(items);
    }

    const msg = `${items.length} resultado${items.length !== 1 ? "s" : ""} encontrado${items.length !== 1 ? "s" : ""}.`;
    if (typeof authController !== "undefined")
      authController.showMessage(msg, "success");
  }

  _applyToGames() {
    const { genre, yearMin, yearMax, rating, sort } = this.advancedFilters;
    let items = typeof gameModel !== "undefined" ? [...gameModel.games] : [];

    if (genre) {
      items = items.filter((g) => {
        const gen = Array.isArray(g.genres)
          ? g.genres
              .map((x) => x.name || x)
              .join(",")
              .toLowerCase()
          : (g.genre || g.genero || "").toLowerCase();
        return gen.includes(genre.toLowerCase());
      });
    }
    if (yearMin) {
      items = items.filter((g) => {
        const y = g.released
          ? parseInt(g.released.slice(0, 4))
          : parseInt(g.year || g.año || 0);
        return y >= yearMin;
      });
    }
    if (yearMax) {
      items = items.filter((g) => {
        const y = g.released
          ? parseInt(g.released.slice(0, 4))
          : parseInt(g.year || g.año || 0);
        return y <= yearMax;
      });
    }
    if (rating > 0) {
      const threshold = rating > 10 ? rating : rating * 10; // normalizar
      items = items.filter((g) => (g.metacritic || g.rating || 0) >= threshold);
    }

    items = this._sort(items, sort, true);

    if (
      typeof gameController !== "undefined" &&
      typeof gameController.renderGameGrid === "function"
    ) {
      gameController.renderGameGrid(items);
    }

    const msg = `${items.length} resultado${items.length !== 1 ? "s" : ""} encontrado${items.length !== 1 ? "s" : ""}.`;
    if (typeof authController !== "undefined")
      authController.showMessage(msg, "success");
  }

  _sort(items, sort, isGame) {
    switch (sort) {
      case "rating":
        return items.sort((a, b) => {
          const ra = isGame
            ? b.metacritic || b.rating || 0
            : parseFloat(b.rating || 0);
          const rb = isGame
            ? a.metacritic || a.rating || 0
            : parseFloat(a.rating || 0);
          return ra - rb;
        });
      case "year":
        return items.sort((a, b) => {
          const ya = isGame
            ? parseInt((b.released || "0").slice(0, 4))
            : parseInt(b.year || b.año || 0);
          const yb = isGame
            ? parseInt((a.released || "0").slice(0, 4))
            : parseInt(a.year || a.año || 0);
          return ya - yb;
        });
      case "title":
        return items.sort((a, b) =>
          (a.title || a.titulo || a.name || "").localeCompare(
            b.title || b.titulo || b.name || "",
          ),
        );
      default:
        return items;
    }
  }

  clearFilters() {
    [
      "filterGenre",
      "filterYearMin",
      "filterYearMax",
      "filterRating",
      "filterSort",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === "SELECT") el.selectedIndex = 0;
      else if (el.type === "range") {
        el.value = 0;
      } else el.value = "";
    });
    const sliderVal =
      document.getElementById("filterRatingValue") ||
      document.getElementById("ratingValue");
    if (sliderVal) sliderVal.textContent = "0";
    this.advancedFilters = {};
    this._runSearch("");
  }

  // Alias para compatibilidad con el nuevo index.html
  applyFilters() {
    this.applyAdvancedFilters();
  }
  resetFilters() {
    this.clearFilters();
  }

  // ── Género y slider ───────────────────────────────────────────────────────

  updateGenreFilters() {
    const filterGenre = document.getElementById("filterGenre");
    if (!filterGenre) return;

    const sourceId =
      this.currentSection === "animes" ? "animeGenreFilter" : "gameGenreFilter";
    const source = document.getElementById(sourceId);
    if (!source) return;

    // Copiar opciones de género del filtro de la sección al filtro avanzado
    filterGenre.innerHTML = '<option value="">Todos los géneros</option>';
    Array.from(source.options).forEach((opt) => {
      if (opt.value) {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.textContent;
        filterGenre.appendChild(o);
      }
    });
  }

  updateRatingSlider() {
    const slider = document.getElementById("filterRating");
    const sliderVal =
      document.getElementById("filterRatingValue") ||
      document.getElementById("ratingValue");
    if (!slider || !sliderVal) return;

    if (this.currentSection === "games") {
      slider.max = "100";
      slider.step = "1";
      slider.value = "0";
      sliderVal.textContent = "0";
    } else {
      slider.max = "10";
      slider.step = "0.1";
      slider.value = "0";
      sliderVal.textContent = "0.0";
    }
  }
}

const searchController = new SearchController();
