// js/controllers/searchController.js
// CORREGIDO: botón toggleFiltersBtn conectado, filtros funcionando, clearFilters OK

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
    this._closePanel();
  }

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

    // ── FIX: Botón de filtros avanzados — conectar el listener aquí ──────────
    const toggleBtn =
      document.getElementById("toggleFiltersBtn") ||
      document.querySelector(".btn-filters") ||
      document.querySelector(".btn-advanced-search");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        this.toggleAdvancedSearch();
      });
    }

    // Slider calificación
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

  // ── Toggle del panel ──────────────────────────────────────────────────────
  toggleAdvancedSearch() {
    this.advancedPanelOpen ? this._closePanel() : this._openPanel();
  }

  _openPanel() {
    const panel =
      document.getElementById("advancedFiltersPanel") ||
      document.getElementById("advancedSearchPanel");
    const btn =
      document.getElementById("toggleFiltersBtn") ||
      document.querySelector(".btn-filters") ||
      document.querySelector(".btn-advanced-search");
    if (!panel) return;

    this.advancedPanelOpen = true;
    panel.style.display = "block";
    requestAnimationFrame(() => {
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
      document.getElementById("toggleFiltersBtn") ||
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
    let items =
      typeof animeModel !== "undefined" ? animeModel.getAllAnimes() : [];

    if (genre) {
      items = items.filter(
        (a) => a.genre && a.genre.toLowerCase().includes(genre.toLowerCase()),
      );
    }
    if (yearMin) items = items.filter((a) => a.year && a.year >= yearMin);
    if (yearMax) items = items.filter((a) => a.year && a.year <= yearMax);
    if (rating > 0) items = items.filter((a) => parseFloat(a.rating) >= rating);

    if (sort === "rating")
      items.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    else if (sort === "year")
      items.sort((a, b) => (b.year || 0) - (a.year || 0));
    else if (sort === "title")
      items.sort((a, b) => a.title.localeCompare(b.title));

    animeController.renderAnimeGrid(items);

    if (typeof authController !== "undefined")
      authController.showMessage(
        `Se encontraron ${items.length} resultados`,
        "success",
      );
  }

  _applyToGames() {
    const { genre, yearMin, yearMax, rating, sort } = this.advancedFilters;
    let items = typeof gameModel !== "undefined" ? gameModel.getAllGames() : [];

    if (genre) {
      items = items.filter(
        (g) => g.genre && g.genre.toLowerCase().includes(genre.toLowerCase()),
      );
    }
    if (yearMin) items = items.filter((g) => g.year && g.year >= yearMin);
    if (yearMax) items = items.filter((g) => g.year && g.year <= yearMax);
    if (rating > 0)
      items = items.filter((g) => (g.metacritic || 0) / 10 >= rating);

    if (sort === "rating")
      items.sort((a, b) => (b.metacritic || 0) - (a.metacritic || 0));
    else if (sort === "year")
      items.sort((a, b) => (b.year || 0) - (a.year || 0));
    else if (sort === "title")
      items.sort((a, b) => a.title.localeCompare(b.title));

    gameController.renderGameGrid(items);

    if (typeof authController !== "undefined")
      authController.showMessage(
        `Se encontraron ${items.length} resultados`,
        "success",
      );
  }

  // ── Limpiar filtros ───────────────────────────────────────────────────────
  clearFilters() {
    const genre = document.getElementById("filterGenre");
    const yearMin = document.getElementById("filterYearMin");
    const yearMax = document.getElementById("filterYearMax");
    const rating = document.getElementById("filterRating");
    const sort = document.getElementById("filterSort");
    const sliderVal =
      document.getElementById("filterRatingValue") ||
      document.getElementById("ratingValue");

    if (genre) genre.value = "";
    if (yearMin) yearMin.value = "";
    if (yearMax) yearMax.value = "";
    if (rating) rating.value = 0;
    if (sort) sort.value = "relevance";
    if (sliderVal) sliderVal.textContent = "0";

    this.advancedFilters = {};

    // Recargar catálogo sin filtros
    if (
      this.currentSection === "animes" &&
      typeof animeController !== "undefined"
    ) {
      animeController.renderAnimeGrid();
    } else if (typeof gameController !== "undefined") {
      gameController.renderGameGrid();
    }

    if (typeof authController !== "undefined")
      authController.showMessage("Filtros limpiados", "success");
  }

  // ── Actualizar géneros según sección ──────────────────────────────────────
  updateGenreFilters() {
    const select = document.getElementById("filterGenre");
    if (!select) return;

    const genres =
      this.currentSection === "animes"
        ? [
            "Action",
            "Adventure",
            "Comedy",
            "Drama",
            "Fantasy",
            "Horror",
            "Mystery",
            "Romance",
            "Sci-Fi",
            "Slice of Life",
            "Sports",
            "Supernatural",
            "Thriller",
          ]
        : [
            "Action",
            "Adventure",
            "RPG",
            "Strategy",
            "Shooter",
            "Simulation",
            "Sports",
            "Racing",
            "Puzzle",
            "Fighting",
            "Platformer",
            "Horror",
          ];

    select.innerHTML =
      '<option value="">Todos los géneros</option>' +
      genres.map((g) => `<option value="${g}">${g}</option>`).join("");
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
