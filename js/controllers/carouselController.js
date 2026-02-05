// js/controllers/carouselController.js - CORREGIDO
class CarouselController {
  constructor() {
    this.currentIndex = 0;
    this.slides = [];
    this.autoPlayInterval = null;
    this.autoPlayDelay = 5000;
  }

  async init() {
    console.log("🎠 Inicializando carrusel");
    await this.loadFeaturedContent();
    this.setupEventListeners();
    this.startAutoPlay();
  }

  async loadFeaturedContent() {
    try {
      // Usar métodos que SÍ existen en apiService
      const topAnimes = await apiService.getTopAnimes(1, 4);

      // Para juegos, usar el método correcto
      let topGames = [];
      try {
        // Llamar al método que carga juegos
        await gameModel.loadGames(1);
        topGames = gameModel.getAllGames().slice(0, 4);
      } catch (error) {
        console.warn("No se pudieron cargar juegos:", error);
      }

      this.slides = [];

      // Agregar animes
      if (topAnimes && topAnimes.length > 0) {
        topAnimes.forEach((anime) => {
          this.slides.push({
            type: "anime",
            id: anime.mal_id,
            title: anime.title,
            image:
              anime.images?.jpg?.large_image_url ||
              anime.images?.jpg?.image_url ||
              "https://via.placeholder.com/800x450?text=Anime",
            rating: anime.score || "N/A",
            description: this.truncateDescription(
              anime.synopsis || "Sin descripción disponible",
              120,
            ),
            year: anime.year || anime.aired?.prop?.from?.year || "N/A",
            genre:
              anime.genres
                ?.map((g) => g.name)
                .slice(0, 2)
                .join(", ") || "Anime",
          });
        });
      }

      // Agregar juegos
      if (topGames && topGames.length > 0) {
        topGames.forEach((game) => {
          this.slides.push({
            type: "game",
            id: game.id,
            title: game.name,
            image:
              game.background_image ||
              "https://via.placeholder.com/800x450?text=Game",
            rating: game.rating || "N/A",
            description: this.truncateDescription(
              game.description_raw || "Sin descripción disponible",
              120,
            ),
            year: game.released ? new Date(game.released).getFullYear() : "N/A",
            genre:
              game.genres
                ?.map((g) => g.name)
                .slice(0, 2)
                .join(", ") || "Videojuego",
          });
        });
      }

      // Mezclar
      this.shuffleSlides();

      // Renderizar
      this.renderCarousel();
      this.renderIndicators();

      console.log(`✅ Carrusel cargado con ${this.slides.length} slides`);
    } catch (error) {
      console.error("❌ Error cargando contenido del carrusel:", error);
      // Crear slides de fallback
      this.createFallbackSlides();
    }
  }

  createFallbackSlides() {
    this.slides = [
      {
        type: "anime",
        id: 1,
        title: "Cargando contenido...",
        image: "https://via.placeholder.com/800x450?text=LobitosGames",
        rating: "9.0",
        description:
          "Descubre los mejores animes y videojuegos en LobitosGames",
        year: "2026",
        genre: "Entretenimiento",
      },
    ];
    this.renderCarousel();
    this.renderIndicators();
  }

  shuffleSlides() {
    for (let i = this.slides.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.slides[i], this.slides[j]] = [this.slides[j], this.slides[i]];
    }
  }

  truncateDescription(text, maxLength) {
    if (!text) return "Sin descripción disponible";

    const cleanText = text.replace(/<[^>]*>/g, "").replace(/\[.*?\]/g, "");

    if (cleanText.length <= maxLength) return cleanText;

    const truncated = cleanText.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");

    return (
      truncated.substring(0, lastSpace > 0 ? lastSpace : maxLength) + "..."
    );
  }

  renderCarousel() {
    const track = document.getElementById("carouselTrack");
    if (!track) {
      console.warn("No se encontró el elemento carouselTrack");
      return;
    }

    if (this.slides.length === 0) {
      track.innerHTML =
        '<div class="carousel-slide active"><div class="carousel-content"><h3>Cargando contenido...</h3></div></div>';
      return;
    }

    track.innerHTML = this.slides
      .map(
        (slide, index) => `
      <div class="carousel-slide ${index === 0 ? "active" : ""}" data-index="${index}">
        <div class="carousel-image">
          <img src="${slide.image}" 
               alt="${slide.title}"
               onerror="this.src='https://via.placeholder.com/800x450?text=${encodeURIComponent(slide.title)}'">
          <div class="carousel-gradient"></div>
        </div>
        <div class="carousel-content">
          <div class="carousel-badge ${slide.type}">
            ${slide.type === "anime" ? "📺 Anime" : "🎮 Videojuego"}
          </div>
          <h3 class="carousel-title">${slide.title}</h3>
          <div class="carousel-meta">
            <span class="carousel-rating">⭐ ${slide.rating}</span>
            <span class="carousel-year">${slide.year}</span>
            <span class="carousel-genre">${slide.genre}</span>
          </div>
          <p class="carousel-description">${slide.description}</p>
          <button class="carousel-btn-view" onclick="carouselController.viewDetails(${index})">
            Ver Detalles
          </button>
        </div>
      </div>
    `,
      )
      .join("");
  }

  renderIndicators() {
    const container = document.getElementById("carouselIndicators");
    if (!container) return;

    if (this.slides.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = this.slides
      .map(
        (_, index) => `
      <button class="carousel-indicator ${index === 0 ? "active" : ""}" 
              onclick="carouselController.goToSlide(${index})"
              aria-label="Ir a slide ${index + 1}">
      </button>
    `,
      )
      .join("");
  }

  setupEventListeners() {
    const prevBtn = document.getElementById("carouselPrev");
    const nextBtn = document.getElementById("carouselNext");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => this.previousSlide());
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => this.nextSlide());
    }

    const container = document.querySelector(".carousel-container");
    if (container) {
      container.addEventListener("mouseenter", () => this.stopAutoPlay());
      container.addEventListener("mouseleave", () => this.startAutoPlay());
    }

    this.setupSwipeListeners();
  }

  setupSwipeListeners() {
    const track = document.getElementById("carouselTrack");
    if (!track) return;

    let startX = 0;
    let endX = 0;

    track.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
    });

    track.addEventListener("touchend", (e) => {
      endX = e.changedTouches[0].clientX;
      const diff = startX - endX;

      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          this.nextSlide();
        } else {
          this.previousSlide();
        }
      }
    });
  }

  goToSlide(index) {
    if (index < 0 || index >= this.slides.length) return;

    this.currentIndex = index;
    this.updateSlides();
    this.resetAutoPlay();
  }

  nextSlide() {
    if (this.slides.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
    this.updateSlides();
    this.resetAutoPlay();
  }

  previousSlide() {
    if (this.slides.length === 0) return;
    this.currentIndex =
      (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.updateSlides();
    this.resetAutoPlay();
  }

  updateSlides() {
    const slides = document.querySelectorAll(".carousel-slide");
    const indicators = document.querySelectorAll(".carousel-indicator");

    slides.forEach((slide, index) => {
      slide.classList.toggle("active", index === this.currentIndex);
    });

    indicators.forEach((indicator, index) => {
      indicator.classList.toggle("active", index === this.currentIndex);
    });
  }

  startAutoPlay() {
    if (this.slides.length === 0) return;
    this.stopAutoPlay();
    this.autoPlayInterval = setInterval(() => {
      this.nextSlide();
    }, this.autoPlayDelay);
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

  viewDetails(index) {
    const slide = this.slides[index];
    if (!slide) return;

    if (slide.type === "anime") {
      viewManager.showAnimeDetails(slide.id);
    } else {
      viewManager.showGameDetails(slide.id);
    }
  }
}

const carouselController = new CarouselController();
