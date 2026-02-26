// js/carousel.js
// Carrusel avanzado sin librerías externas
// Incluye: autoplay, controles manuales, indicadores dinámicos,
//          loop infinito simulado, soporte táctil y lazy loading

class CarruselAvanzado {
  constructor(selector, opciones = {}) {
    this.contenedor = document.querySelector(selector);
    if (!this.contenedor) {
      console.warn(`[Carrusel] No se encontró el contenedor: ${selector}`);
      return;
    }

    // Opciones configurables
    this.opciones = {
      autoplay: opciones.autoplay ?? true,
      intervalo: opciones.intervalo ?? 5000,
      transicion: opciones.transicion ?? 450,
      pausa: opciones.pausa ?? true, // pausar en hover
      teclado: opciones.teclado ?? true,
      loop: opciones.loop ?? true,
      ...opciones,
    };

    this.slides = [];
    this.indiceActual = 0;
    this.totalSlides = 0;
    this.temporizador = null;
    this.enTransicion = false;

    // Para soporte táctil
    this.touchInicioX = 0;
    this.touchInicioY = 0;
    this.touchMovX = 0;
    this.touchActivo = false;

    this.iniciar();
  }

  iniciar() {
    this.track = this.contenedor.querySelector(
      ".carousel-track, #carouselTrack",
    );
    this.prevBtn = this.contenedor.querySelector(
      ".carousel-prev, #carouselPrev",
    );
    this.nextBtn = this.contenedor.querySelector(
      ".carousel-next, #carouselNext",
    );
    this.indicadores = this.contenedor.querySelector(
      ".carousel-indicators, #carouselIndicators",
    );

    this.actualizarSlides();
    this.crearIndicadores();
    this.registrarEventos();

    if (this.opciones.autoplay) this.iniciarAutoplay();

    console.log(`[Carrusel] Inicializado con ${this.totalSlides} slides`);
  }

  // ---- Obtener referencia actualizada a slides ----
  actualizarSlides() {
    this.slides = Array.from(
      this.contenedor.querySelectorAll(".carousel-slide"),
    );
    this.totalSlides = this.slides.length;

    // Asegurar que el primero esté activo
    if (this.slides.length > 0) {
      this.slides.forEach((s, i) => {
        s.classList.toggle("active", i === this.indiceActual);
        s.setAttribute("aria-hidden", i !== this.indiceActual);
      });
    }
  }

  // ---- Indicadores dinámicos ----
  crearIndicadores() {
    if (!this.indicadores || this.totalSlides === 0) return;

    this.indicadores.innerHTML = this.slides
      .map(
        (_, i) => `
        <button
          class="carousel-indicator ${i === 0 ? "active" : ""}"
          data-slide="${i}"
          aria-label="Ir a slide ${i + 1}"
        ></button>
      `,
      )
      .join("");

    this.indicadores.querySelectorAll(".carousel-indicator").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.irA(parseInt(btn.dataset.slide));
        this.reiniciarAutoplay();
      });
    });
  }

  actualizarIndicadores() {
    const btns = this.indicadores?.querySelectorAll(".carousel-indicator");
    btns?.forEach((btn, i) => {
      btn.classList.toggle("active", i === this.indiceActual);
    });
  }

  // ---- Navegación ----
  irA(indice) {
    if (this.enTransicion || this.totalSlides === 0) return;
    if (indice === this.indiceActual && !this.opciones.loop) return;

    this.enTransicion = true;

    const anterior = this.indiceActual;
    // Loop infinito simulado
    if (this.opciones.loop) {
      this.indiceActual =
        ((indice % this.totalSlides) + this.totalSlides) % this.totalSlides;
    } else {
      this.indiceActual = Math.max(0, Math.min(indice, this.totalSlides - 1));
    }

    const slideAnterior = this.slides[anterior];
    const slideSiguiente = this.slides[this.indiceActual];

    // Determinar dirección para la animación
    const direccion = indice > anterior ? "siguiente" : "anterior";

    slideAnterior.classList.add(`salir-${direccion}`);
    slideSiguiente.classList.add(`entrar-${direccion}`);
    slideSiguiente.classList.add("active");
    slideSiguiente.setAttribute("aria-hidden", "false");

    setTimeout(() => {
      slideAnterior.classList.remove("active", `salir-${direccion}`);
      slideAnterior.setAttribute("aria-hidden", "true");
      slideSiguiente.classList.remove(`entrar-${direccion}`);
      this.enTransicion = false;
    }, this.opciones.transicion);

    this.actualizarIndicadores();
    this.actualizarBotones();

    // Cargar imagen con lazy loading
    this.cargarImagenLazy(slideSiguiente);
  }

  siguiente() {
    this.irA(this.indiceActual + 1);
  }

  anterior() {
    this.irA(this.indiceActual - 1);
  }

  actualizarBotones() {
    if (!this.prevBtn || !this.nextBtn) return;
    if (!this.opciones.loop) {
      this.prevBtn.disabled = this.indiceActual === 0;
      this.nextBtn.disabled = this.indiceActual === this.totalSlides - 1;
    }
  }

  // ---- Lazy loading ----
  cargarImagenLazy(slide) {
    const img = slide.querySelector("img[data-src]");
    if (img) {
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    }
  }

  // ---- Autoplay ----
  iniciarAutoplay() {
    if (!this.opciones.autoplay || this.totalSlides <= 1) return;
    this.detenerAutoplay();
    this.temporizador = setInterval(
      () => this.siguiente(),
      this.opciones.intervalo,
    );
  }

  detenerAutoplay() {
    if (this.temporizador) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  reiniciarAutoplay() {
    this.detenerAutoplay();
    this.iniciarAutoplay();
  }

  // ---- Registro de eventos ----
  registrarEventos() {
    // Botones de navegación
    this.prevBtn?.addEventListener("click", () => {
      this.anterior();
      this.reiniciarAutoplay();
    });

    this.nextBtn?.addEventListener("click", () => {
      this.siguiente();
      this.reiniciarAutoplay();
    });

    // Pausa en hover
    if (this.opciones.pausa) {
      this.contenedor.addEventListener("mouseenter", () =>
        this.detenerAutoplay(),
      );
      this.contenedor.addEventListener("mouseleave", () =>
        this.iniciarAutoplay(),
      );
    }

    // Navegación con teclado
    if (this.opciones.teclado) {
      document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") {
          this.anterior();
          this.reiniciarAutoplay();
        }
        if (e.key === "ArrowRight") {
          this.siguiente();
          this.reiniciarAutoplay();
        }
      });
    }

    // Soporte táctil
    const track = this.track || this.contenedor;
    track.addEventListener(
      "touchstart",
      (e) => {
        this.touchInicioX = e.touches[0].clientX;
        this.touchInicioY = e.touches[0].clientY;
        this.touchActivo = true;
      },
      { passive: true },
    );

    track.addEventListener(
      "touchmove",
      (e) => {
        if (!this.touchActivo) return;
        this.touchMovX = e.touches[0].clientX;
      },
      { passive: true },
    );

    track.addEventListener("touchend", () => {
      if (!this.touchActivo) return;
      const diff = this.touchInicioX - this.touchMovX;
      const diffY = Math.abs(
        this.touchInicioY - (this.touchMovX || this.touchInicioY),
      );

      // Solo swipe horizontal (ignorar scroll vertical)
      if (Math.abs(diff) > 50 && Math.abs(diff) > diffY) {
        diff > 0 ? this.siguiente() : this.anterior();
        this.reiniciarAutoplay();
      }
      this.touchActivo = false;
    });

    // Visibilidad de página (pausar cuando no está visible)
    document.addEventListener("visibilitychange", () => {
      document.hidden ? this.detenerAutoplay() : this.iniciarAutoplay();
    });
  }

  // ---- API pública ----
  destruir() {
    this.detenerAutoplay();
    this.observers?.forEach((o) => o.disconnect());
  }
}
