// js/app.js
// Punto de entrada principal - Práctica 2 Unidad 2
// Integra todos los módulos: api, cache, dom, animations, carousel

class AppP2 {
  constructor() {
    this.version = "2.0.0";
    this.inicializado = false;
  }

  async init() {
    if (this.inicializado) return;

    try {
      if (document.readyState === "loading") {
        await new Promise((resolve) =>
          document.addEventListener("DOMContentLoaded", resolve),
        );
      }

      console.time("[App] Tiempo de inicialización");

      // 1. Inicializar módulos base
      animationEngine.init();

      // 2. Inicializar carrusel avanzado
      const carrusel = new CarruselAvanzado(".carousel-container", {
        autoplay: true,
        intervalo: 5000,
        loop: true,
        teclado: true,
      });

      // 3. Cargar dashboard con peticiones simultáneas
      await this.cargarDashboard();

      // 4. Configurar buscador con debounce
      this.configurarBuscador();

      // 5. Iniciar polling inteligente
      pollingManager.iniciar((nuevos) => {
        console.log("[Polling] Nuevos datos recibidos:", nuevos.length);
        this.manejarNuevosDatos(nuevos);
      });

      // 6. Inicializar controladores existentes del proyecto
      if (typeof viewManager !== "undefined") viewManager.init();
      if (typeof searchController !== "undefined") searchController.init();
      if (typeof carouselController !== "undefined")
        await carouselController.init();

      // 7. Configurar efecto de scroll en header
      this.configurarScrollHeader();

      console.timeEnd("[App] Tiempo de inicialización");
      console.log(`LobitosGames v${this.version} inicializado`);
      console.log("[Cache] Stats iniciales:", cacheManager.getStats());

      this.inicializado = true;
    } catch (error) {
      console.error("[App] Error de inicialización:", error);
    }
  }

  async cargarDashboard() {
    console.time("[App] Carga de dashboard");
    DOM.mostrarLoader("featuredContent", "Cargando contenido destacado...");

    try {
      const { animes, juegos, errores } =
        await apiAvanzado.cargarDashboardCompleto();

      if (errores.length > 0) {
        console.warn("[App] Errores parciales:", errores);
      }

      // Renderizar con los datos disponibles
      const todoContenido = [
        ...animes.slice(0, 4).map((a) => ({ ...a, tipo: "anime" })),
        ...juegos.slice(0, 4).map((j) => ({ ...j, tipo: "juego" })),
      ];

      DOM.renderizarGrid("featuredContent", todoContenido, (item) => {
        return DOM.crearTarjeta({
          id: item.tipo === "anime" ? item.mal_id : item.id,
          titulo:
            item.tipo === "anime"
              ? item.title || "Sin título"
              : item.name || "Sin título",
          imagen:
            item.tipo === "anime"
              ? item.images?.jpg?.large_image_url ||
                item.images?.jpg?.image_url ||
                ""
              : item.background_image || "",
          rating:
            item.tipo === "anime" ? item.score || "N/A" : item.rating || "N/A",
          anio:
            item.tipo === "anime"
              ? item.year ||
                (item.aired?.from
                  ? new Date(item.aired.from).getFullYear()
                  : "N/A")
              : item.released
                ? new Date(item.released).getFullYear()
                : "N/A",
          genero:
            item.tipo === "anime"
              ? item.genres
                  ?.slice(0, 2)
                  .map((g) => g.name)
                  .join(", ") || "N/A"
              : item.genres
                  ?.slice(0, 2)
                  .map((g) => g.name)
                  .join(", ") || "N/A",
          tipo: item.tipo,
          onClick: () => {
            const id = item.tipo === "anime" ? item.mal_id : item.id;
            if (
              item.tipo === "anime" &&
              typeof animeController !== "undefined"
            ) {
              animeController.showDetails(id);
            } else if (typeof gameController !== "undefined") {
              gameController.showDetails(id);
            }
          },
        });
      });
    } catch (error) {
      console.error("[App] Error cargando dashboard:", error);
      DOM.mostrarError(
        "featuredContent",
        "No se pudo cargar el contenido. Verifica tu conexión.",
      );
    }

    console.timeEnd("[App] Carga de dashboard");
  }

  configurarBuscador() {
    const inputBusqueda = document.getElementById("searchInput");
    if (!inputBusqueda) return;

    // Reemplazar el listener existente con el debounce del módulo api.js
    inputBusqueda.addEventListener("input", (e) => {
      buscarConDebounce(e.target.value.trim());
    });

    // Escuchar resultados del evento personalizado
    document.addEventListener("resultadosBusqueda", (e) => {
      const { animes, juegos, fallaron } = e.detail;
      if (fallaron.length > 0) {
        console.warn("[Búsqueda] No se pudo buscar en:", fallaron.join(", "));
      }
      // Los controladores existentes se encargan del render
    });
  }

  manejarNuevosDatos(nuevos) {
    // Prevenir duplicados comprobando el DOM
    const idsExistentes = new Set(
      DOM.selectAll("[data-id]").map((el) => el.dataset.id),
    );

    const realmente = nuevos.filter((item) => {
      const id = String(item.mal_id || item.id);
      return !idsExistentes.has(id);
    });

    if (realmente.length === 0) return;

    // Animar los nuevos elementos que se inserten
    const nuevasTarjetas = DOM.selectAll(".catalog-item:not(.card-visible)");
    animationEngine.animarNuevosDatos(nuevasTarjetas);
  }

  configurarScrollHeader() {
    const header = document.querySelector(".header");
    if (!header) return;

    const actualizarHeader = throttleRAF
      ? throttleRAF(() => {
          header.classList.toggle("scrolled", window.scrollY > 50);
        })
      : () => {
          header.classList.toggle("scrolled", window.scrollY > 50);
        };

    window.addEventListener("scroll", actualizarHeader, { passive: true });
  }
}

const appP2 = new AppP2();
appP2.init();
