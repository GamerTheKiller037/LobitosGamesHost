// js/controllers/carouselController.js
// CORREGIDO: viewDetails usa animeController/gameController en lugar de viewManager
// Ambos botones (prev/next) garantizados visibles

class CarouselController {
  constructor() {
    this.slides = [];
    this.currentIndex = 0;
    this.autoPlayInterval = null;
    this.autoPlayDelay = 5000;
    this.isLoading = false;
  }

  async init() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      await this.loadSlides();
      this.renderCarousel();
      this.renderIndicators();
      this.setupEventListeners();
      if (this.slides.length > 0) this.startAutoPlay();
    } catch (error) {
      console.error("[Carrusel] Error:", error);
    } finally {
      this.isLoading = false;
    }
  }

  async loadSlides() {
    try {
      // Esperar a que los modelos tengan datos
      if (typeof animeModel !== "undefined" && animeModel.animes.length === 0) {
        await animeModel.loadAnimes();
      }
      if (typeof gameModel !== "undefined" && gameModel.games.length === 0) {
        await gameModel.loadGames();
      }

      const animes =
        typeof animeModel !== "undefined" ? animeModel.animes.slice(0, 3) : [];
      const games =
        typeof gameModel !== "undefined" ? gameModel.games.slice(0, 2) : [];

      this.slides = [
        ...animes.map((a) => ({
          id: a.id || a.mal_id,
          type: "anime",
          title: a.title || a.titulo || "Sin título",
          image: a.image || a.imagen_url || "",
          rating: a.rating || "N/A",
          year: a.year || a.año || "",
          genre: a.genre || a.genero || "",
          description: this._truncate(
            a.synopsis || a.sinopsis || "Sin descripción disponible.",
            180,
          ),
        })),
        ...games.map((g) => ({
          id: g.id || g.rawg_id,
          type: "game",
          title: g.name || g.title || g.titulo || "Sin título",
          image: g.background_image || g.image || g.imagen_url || "",
          rating: g.metacritic || g.rating || "N/A",
          year: g.released ? g.released.slice(0, 4) : g.year || g.año || "",
          genre: Array.isArray(g.genres)
            ? g.genres.map((x) => x.name || x).join(", ")
            : g.genre || g.genero || "",
          description: this._truncate(
            g.description_raw ||
              g.description ||
              g.synopsis ||
              "Sin descripción disponible.",
            180,
          ),
        })),
      ].filter((s) => s.id); // solo slides con id válido

      console.log(`[Carrusel] ${this.slides.length} slides cargados`);
    } catch (err) {
      console.warn("[Carrusel] No se pudieron cargar slides:", err.message);
      this.slides = [];
    }
  }

  _truncate(text, max) {
    if (!text) return "Sin descripción disponible.";
    const clean = text
      .replace(/\[.*?\]/g, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (clean.length <= max) return clean;
    const cut = clean.lastIndexOf(" ", max);
    return clean.substring(0, cut > 0 ? cut : max) + "…";
  }

  // ── Render ────────────────────────────────────────────────────────────────

  renderCarousel() {
    const track = document.getElementById("carouselTrack");
    if (!track) return;

    if (!this.slides.length) {
      track.innerHTML = `
        <div class="carousel-slide active">
          <div class="carousel-image" style="background:linear-gradient(135deg,#1a0533,#6809e5)"></div>
          <div class="carousel-content">
            <h3 class="carousel-title">Cargando contenido…</h3>
          </div>
        </div>`;
      return;
    }

    track.innerHTML = this.slides
      .map((slide, i) => {
        const fallbackSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='450'%3E%3Crect fill='%236809e5' width='800' height='450'/%3E%3Ctext fill='white' x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='24'%3ESin imagen%3C/text%3E%3C/svg%3E`;
        return `
        <div class="carousel-slide ${i === 0 ? "active" : ""}" data-index="${i}">
          <div class="carousel-image">
            <img src="${slide.image || fallbackSvg}"
                 alt="${slide.title}"
                 onerror="this.onerror=null;this.src='${fallbackSvg}'">
            <div class="carousel-gradient"></div>
          </div>
          <div class="carousel-content">
            <div class="carousel-badge ${slide.type}">
              ${slide.type === "anime" ? "ANIME" : "VIDEOJUEGO"}
            </div>
            <h3 class="carousel-title">${slide.title}</h3>
            <div class="carousel-meta">
              <span class="carousel-rating">★ ${slide.rating}</span>
              <span class="carousel-year">${slide.year}</span>
              <span class="carousel-genre">${slide.genre}</span>
            </div>
            <p class="carousel-description">${slide.description}</p>
            <button class="carousel-btn-view"
                    onclick="carouselController.viewDetails(${i})">
              Ver Detalles
            </button>
          </div>
        </div>`;
      })
      .join("");
  }

  renderIndicators() {
    const container = document.getElementById("carouselIndicators");
    if (!container) return;

    container.innerHTML = this.slides
      .map(
        (_, i) => `
        <button class="carousel-indicator ${i === 0 ? "active" : ""}"
                onclick="carouselController.goToSlide(${i})"
                aria-label="Ir a slide ${i + 1}">
        </button>`,
      )
      .join("");
  }

  // ── Navegación ────────────────────────────────────────────────────────────

  setupEventListeners() {
    // Buscar botones por ID y por clase
    const prevBtn =
      document.getElementById("carouselPrev") ||
      document.querySelector(".carousel-btn.prev");
    const nextBtn =
      document.getElementById("carouselNext") ||
      document.querySelector(".carousel-btn.next");

    if (prevBtn) {
      // Eliminar listener anterior para evitar duplicados
      prevBtn.replaceWith(prevBtn.cloneNode(true));
      const freshPrev =
        document.getElementById("carouselPrev") ||
        document.querySelector(".carousel-btn.prev");
      if (freshPrev)
        freshPrev.addEventListener("click", () => this.previousSlide());
    }
    if (nextBtn) {
      nextBtn.replaceWith(nextBtn.cloneNode(true));
      const freshNext =
        document.getElementById("carouselNext") ||
        document.querySelector(".carousel-btn.next");
      if (freshNext)
        freshNext.addEventListener("click", () => this.nextSlide());
    }

    // Pausar autoplay al hover
    const container = document.querySelector(".carousel-container");
    if (container) {
      container.addEventListener("mouseenter", () => this.stopAutoPlay());
      container.addEventListener("mouseleave", () => this.startAutoPlay());
    }

    this._setupSwipe();
  }

  _setupSwipe() {
    const track = document.getElementById("carouselTrack");
    if (!track) return;
    let startX = 0;
    track.addEventListener(
      "touchstart",
      (e) => {
        startX = e.touches[0].clientX;
      },
      { passive: true },
    );
    track.addEventListener(
      "touchend",
      (e) => {
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50)
          diff > 0 ? this.nextSlide() : this.previousSlide();
      },
      { passive: true },
    );
  }

  goToSlide(index) {
    if (index < 0 || index >= this.slides.length) return;
    this.currentIndex = index;
    this.updateSlides();
    this.resetAutoPlay();
  }

  nextSlide() {
    if (!this.slides.length) return;
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
    this.updateSlides();
    this.resetAutoPlay();
  }

  previousSlide() {
    if (!this.slides.length) return;
    this.currentIndex =
      (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.updateSlides();
    this.resetAutoPlay();
  }

  updateSlides() {
    document
      .querySelectorAll(".carousel-slide")
      .forEach((s, i) => s.classList.toggle("active", i === this.currentIndex));
    document
      .querySelectorAll(".carousel-indicator")
      .forEach((ind, i) =>
        ind.classList.toggle("active", i === this.currentIndex),
      );
  }

  startAutoPlay() {
    if (!this.slides.length) return;
    this.stopAutoPlay();
    this.autoPlayInterval = setInterval(
      () => this.nextSlide(),
      this.autoPlayDelay,
    );
  }

  stopAutoPlay() {
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
      this.autoPlayInterval = null;
    }
  }

  resetAutoPlay() {
    this.startAutoPlay();
  }

  // ── Ver detalles — FIX PRINCIPAL ─────────────────────────────────────────
  // El error era que llamaba a viewManager.showAnimeDetails / viewManager.showGameDetails
  // pero esos métodos no existen en viewManager. Los métodos correctos están en
  // animeController.showDetails() y gameController.showDetails()

  viewDetails(index) {
    const slide = this.slides[index];
    if (!slide) return;

    const id = slide.id;

    if (slide.type === "anime") {
      if (
        typeof animeController !== "undefined" &&
        typeof animeController.showDetails === "function"
      ) {
        animeController.showDetails(id);
      } else {
        console.warn("[Carrusel] animeController.showDetails no disponible");
      }
    } else {
      if (
        typeof gameController !== "undefined" &&
        typeof gameController.showDetails === "function"
      ) {
        gameController.showDetails(id);
      } else {
        console.warn("[Carrusel] gameController.showDetails no disponible");
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getFeaturedSlides() {
    return this.slides.slice(0, 5);
  }
  getSlideCount() {
    return this.slides.length;
  }
}

const carouselController = new CarouselController();
