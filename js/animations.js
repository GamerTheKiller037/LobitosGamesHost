// js/animations.js
// Motor de animaciones: scroll, parallax, efectos de mouse, transiciones suaves

class AnimationEngine {
  constructor() {
    this.observers = new Map();
    this.rafId = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.isParallaxActive = false;
  }

  init() {
    this.initScrollAnimations();
    this.initMouseEffects();
    this.initMagneticButtons();
    console.log("[Animations] Motor de animaciones inicializado");
  }

  // ============================================================
  // SECCIÓN 1: ANIMACIONES CON SCROLL (IntersectionObserver)
  // ============================================================

  initScrollAnimations() {
    // Observador principal con umbral de visibilidad del 15%
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, index) => {
          if (entry.isIntersecting) {
            // Animaciones escalonadas: cada elemento se retrasa un poco más
            const delay =
              entry.target.dataset.animDelay ||
              Array.from(entry.target.parentElement?.children || []).indexOf(
                entry.target,
              ) * 80;
            entry.target.style.transitionDelay = `${delay}ms`;
            entry.target.classList.add("animate-in");
            // Dejar de observar una vez animado para no repetir
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    this.observers.set("scroll", observer);

    // Aplicar a todos los elementos con clase animate-on-scroll
    document.querySelectorAll(".animate-on-scroll").forEach((el, i) => {
      el.dataset.animDelay = i * 80;
      observer.observe(el);
    });

    // Observador para catalog-item (tarjetas de contenido)
    const cardObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("card-visible");
            cardObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 },
    );

    this.observers.set("cards", cardObserver);
    document.querySelectorAll(".catalog-item").forEach((card) => {
      cardObserver.observe(card);
    });
  }

  /**
   * Re-observa los elementos nuevos (para contenido cargado dinámicamente)
   */
  observarNuevosElementos() {
    const scrollObs = this.observers.get("scroll");
    const cardObs = this.observers.get("cards");

    document
      .querySelectorAll(".animate-on-scroll:not(.animate-in)")
      .forEach((el) => {
        scrollObs?.observe(el);
      });

    document
      .querySelectorAll(".catalog-item:not(.card-visible)")
      .forEach((card) => {
        cardObs?.observe(card);
      });
  }

  // ============================================================
  // SECCIÓN 2: MOSTRAR / OCULTAR CON TRANSICIÓN SUAVE
  // No usa display:none directamente
  // ============================================================

  /**
   * Muestra un elemento con transición de opacidad y transform
   * @param {HTMLElement|string} el - Elemento o selector
   * @param {string} direction - 'up' | 'down' | 'left' | 'right'
   */
  mostrar(el, direction = "up") {
    const elemento = typeof el === "string" ? document.querySelector(el) : el;
    if (!elemento) return;

    const translateMap = {
      up: "translateY(20px)",
      down: "translateY(-20px)",
      left: "translateX(20px)",
      right: "translateX(-20px)",
    };

    // Estado inicial visible pero transparente
    elemento.style.opacity = "0";
    elemento.style.transform = translateMap[direction] || "translateY(20px)";
    elemento.style.visibility = "visible";
    elemento.style.pointerEvents = "auto";

    // Forzar reflow para que la transición funcione
    elemento.getBoundingClientRect();

    // Transición al estado final
    elemento.style.transition = "opacity 0.35s ease, transform 0.35s ease";
    elemento.style.opacity = "1";
    elemento.style.transform = "translate(0, 0)";
  }

  /**
   * Oculta un elemento con transición suave (sin display:none)
   * @param {HTMLElement|string} el - Elemento o selector
   * @param {Function} onComplete - Callback al terminar
   */
  ocultar(el, onComplete) {
    const elemento = typeof el === "string" ? document.querySelector(el) : el;
    if (!elemento) return;

    elemento.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    elemento.style.opacity = "0";
    elemento.style.transform = "translateY(-10px)";

    const onTransitionEnd = () => {
      elemento.style.visibility = "hidden";
      elemento.style.pointerEvents = "none";
      elemento.removeEventListener("transitionend", onTransitionEnd);
      if (typeof onComplete === "function") onComplete();
    };

    elemento.addEventListener("transitionend", onTransitionEnd);
  }

  /**
   * Alterna visibilidad con animación de height
   * @param {HTMLElement|string} el
   */
  toggleConAltura(el) {
    const elemento = typeof el === "string" ? document.querySelector(el) : el;
    if (!elemento) return;

    const isExpanded = elemento.dataset.expanded === "true";

    if (!isExpanded) {
      elemento.style.height = "0";
      elemento.style.overflow = "hidden";
      elemento.style.visibility = "visible";
      elemento.style.opacity = "0";
      elemento.style.transition = "height 0.35s ease, opacity 0.3s ease";

      // Necesitamos la altura real
      elemento.style.height = "auto";
      const targetH = elemento.scrollHeight;
      elemento.style.height = "0";

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          elemento.style.height = targetH + "px";
          elemento.style.opacity = "1";
        });
      });

      elemento.dataset.expanded = "true";
    } else {
      elemento.style.transition = "height 0.3s ease, opacity 0.25s ease";
      elemento.style.height = elemento.scrollHeight + "px";

      requestAnimationFrame(() => {
        elemento.style.height = "0";
        elemento.style.opacity = "0";
      });

      setTimeout(() => {
        elemento.style.visibility = "hidden";
      }, 300);

      elemento.dataset.expanded = "false";
    }
  }

  // ============================================================
  // SECCIÓN 3: EFECTOS DEL MOUSE
  // ============================================================

  initMouseEffects() {
    // Parallax con mousemove en el hero
    const heroSection = document.querySelector(".hero-carousel-section");
    if (heroSection) {
      heroSection.addEventListener(
        "mousemove",
        throttleRAF((e) => {
          this.aplicarParallax(e, heroSection);
        }),
      );

      heroSection.addEventListener("mouseleave", () => {
        this.resetParallax(heroSection);
      });
    }

    // Hover animado en tarjetas
    document.addEventListener("mouseover", (e) => {
      const card = e.target.closest(".catalog-item");
      if (card) this.iniciarHoverCard(card);
    });

    document.addEventListener("mouseout", (e) => {
      const card = e.target.closest(".catalog-item");
      if (card && !card.contains(e.relatedTarget)) {
        this.terminarHoverCard(card);
      }
    });

    // Seguimiento global del mouse para efectos
    document.addEventListener(
      "mousemove",
      throttleRAF((e) => {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      }),
    );
  }

  aplicarParallax(e, container) {
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / rect.width;
    const dy = (e.clientY - cy) / rect.height;

    const imagen = container.querySelector(".carousel-image img");
    if (imagen) {
      requestAnimationFrame(() => {
        imagen.style.transform = `scale(1.05) translate(${dx * 12}px, ${dy * 8}px)`;
        imagen.style.transition = "transform 0.1s linear";
      });
    }
  }

  resetParallax(container) {
    const imagen = container.querySelector(".carousel-image img");
    if (imagen) {
      imagen.style.transform = "scale(1) translate(0, 0)";
      imagen.style.transition = "transform 0.5s ease";
    }
  }

  iniciarHoverCard(card) {
    card.style.transition = "transform 0.25s ease, box-shadow 0.25s ease";
    card.style.transform = "translateY(-6px) scale(1.02)";
    card.style.boxShadow = "0 12px 30px rgba(104, 9, 229, 0.4)";
  }

  terminarHoverCard(card) {
    card.style.transform = "translateY(0) scale(1)";
    card.style.boxShadow = "";
  }

  // ============================================================
  // SECCIÓN 4: EFECTO MAGNÉTICO EN BOTONES
  // ============================================================

  initMagneticButtons() {
    document
      .querySelectorAll(".magnetic-btn, .btn-login, .btn-register, .play-btn")
      .forEach((btn) => {
        btn.addEventListener("mousemove", (e) => {
          const rect = btn.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = (e.clientX - cx) / (rect.width / 2);
          const dy = (e.clientY - cy) / (rect.height / 2);

          requestAnimationFrame(() => {
            btn.style.transform = `translate(${dx * 6}px, ${dy * 4}px)`;
            btn.style.transition = "transform 0.15s ease";
          });
        });

        btn.addEventListener("mouseleave", () => {
          btn.style.transform = "translate(0, 0)";
          btn.style.transition = "transform 0.3s ease";
        });
      });
  }

  // ============================================================
  // SECCIÓN 5: ANIMACIÓN PARA NUEVOS DATOS DEL POLLING
  // ============================================================

  animarNuevosDatos(elementos) {
    elementos.forEach((el, i) => {
      el.style.animation = "none";
      el.offsetHeight; // forzar reflow
      el.style.animation = `fadeInScale 0.4s ease ${i * 60}ms both`;
    });
  }
}

// Throttle usando requestAnimationFrame para animaciones
function throttleRAF(fn) {
  let rafPending = false;
  return (...args) => {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        fn(...args);
        rafPending = false;
      });
    }
  };
}

const animationEngine = new AnimationEngine();
