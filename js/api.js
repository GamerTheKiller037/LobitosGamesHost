// js/api.js
// Módulo de implementación asíncrona avanzada
// Incluye: Promise.all, AbortController, caché, debounce, throttle, polling

// ============================================================
// SECCIÓN 1: UTILIDADES DE OPTIMIZACIÓN
// ============================================================

/**
 * Debounce: retrasa la ejecución hasta que el usuario deje de invocarla
 * @param {Function} fn - Función a debounce-ar
 * @param {number} delay - Tiempo de espera en ms
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle: limita la ejecución a una vez cada N ms
 * @param {Function} fn - Función a throttle-ar
 * @param {number} limit - Intervalo mínimo entre ejecuciones en ms
 * @returns {Function}
 */
function throttle(fn, limit) {
  let inThrottle = false;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// ============================================================
// SECCIÓN 2: PETICIONES CON AbortController
// ============================================================

/**
 * Realiza un fetch cancelable usando AbortController
 * @param {string} url - URL a consultar
 * @param {AbortSignal} signal - Señal de cancelación
 * @param {Object} options - Opciones adicionales de fetch
 * @returns {Promise<any>}
 */
async function fetchConCancelacion(url, signal, options = {}) {
  try {
    console.time(`[API] fetch ${url}`);
    const response = await fetch(url, { ...options, signal });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.timeEnd(`[API] fetch ${url}`);
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      console.warn(`[API] Petición cancelada: ${url}`);
      return null;
    }
    throw error;
  }
}

// Controladores de cancelación activos
const controladoresActivos = new Map();

/**
 * Cancela una petición en curso si existe
 * @param {string} id - Identificador de la petición
 */
function cancelarPeticion(id) {
  if (controladoresActivos.has(id)) {
    controladoresActivos.get(id).abort();
    controladoresActivos.delete(id);
    console.log(`[API] Cancelada petición: ${id}`);
  }
}

// ============================================================
// SECCIÓN 3: MÓDULO DE API AVANZADO CON CACHÉ
// ============================================================

class APIAvanzado {
  constructor() {
    this.jikanBase = "https://api.jikan.moe/v4";
    this.rawgBase = "https://api.rawg.io/api";
    this.rawgKey = "9127fc9008cb4f9898d42b7da484b496";

    // Instancia del caché global
    this.cache = typeof cacheManager !== "undefined" ? cacheManager : null;

    // Estado del loader visual
    this.pendingRequests = 0;
  }

  // ---- Indicador de carga ----
  mostrarLoader() {
    this.pendingRequests++;
    const loader = document.getElementById("globalLoader");
    if (loader) loader.style.display = "flex";
  }

  ocultarLoader() {
    this.pendingRequests = Math.max(0, this.pendingRequests - 1);
    if (this.pendingRequests === 0) {
      const loader = document.getElementById("globalLoader");
      if (loader) loader.style.display = "none";
    }
  }

  mostrarErrorVisual(mensaje) {
    const errorBanner = document.getElementById("errorBanner");
    if (!errorBanner) return;
    errorBanner.textContent = mensaje;
    errorBanner.style.display = "block";
    setTimeout(() => {
      errorBanner.style.display = "none";
    }, 4000);
  }

  // ---- Petición genérica con caché y cancelación ----
  async fetchConCache(url, cacheKey, ttl = 3600000) {
    // Revisar caché primero
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    // Cancelar petición previa con la misma clave
    cancelarPeticion(cacheKey);
    const controller = new AbortController();
    controladoresActivos.set(cacheKey, controller);

    this.mostrarLoader();
    try {
      const data = await fetchConCancelacion(url, controller.signal);
      if (data && this.cache) {
        this.cache.set(cacheKey, data, ttl);
      }
      controladoresActivos.delete(cacheKey);
      return data;
    } catch (error) {
      console.error(`[API] Error en ${cacheKey}:`, error);
      this.mostrarErrorVisual(`Error al cargar datos. Intenta de nuevo.`);
      return null;
    } finally {
      this.ocultarLoader();
    }
  }

  // ============================================================
  // SECCIÓN 4: PETICIONES SIMULTÁNEAS CON Promise.all
  // ============================================================

  /**
   * Carga animes y videojuegos de forma simultánea.
   * Si una falla, la otra sigue funcionando (manejo de errores parciales).
   * @returns {Promise<{animes: Array, juegos: Array, errores: Array}>}
   */
  async cargarDashboardCompleto() {
    console.time("[API] Dashboard completo");
    const errores = [];

    const promesas = [
      // Promesa de animes con manejo de error individual
      this.fetchConCache(
        `${this.jikanBase}/top/anime?page=1&limit=12`,
        "dashboard_animes",
      ).catch((err) => {
        errores.push({ origen: "animes", mensaje: err.message });
        return { data: [] }; // valor de fallback
      }),

      // Promesa de videojuegos con manejo de error individual
      this.fetchConCache(
        `${this.rawgBase}/games?ordering=-metacritic&metacritic=50,100&page_size=12&key=${this.rawgKey}`,
        "dashboard_juegos",
      ).catch((err) => {
        errores.push({ origen: "juegos", mensaje: err.message });
        return { results: [] }; // valor de fallback
      }),
    ];

    // Promise.all: espera TODAS las promesas en paralelo
    const [respuestaAnimes, respuestaJuegos] = await Promise.all(promesas);

    console.timeEnd("[API] Dashboard completo");

    if (errores.length > 0) {
      console.warn("[API] Errores parciales en dashboard:", errores);
      this.mostrarErrorVisual(
        `Algunos datos no se pudieron cargar: ${errores.map((e) => e.origen).join(", ")}`,
      );
    }

    return {
      animes: respuestaAnimes?.data || [],
      juegos: respuestaJuegos?.results || [],
      errores,
    };
  }

  /**
   * Busca en ambas APIs simultáneamente
   * @param {string} termino - Término de búsqueda
   * @returns {Promise<{animes: Array, juegos: Array}>}
   */
  async buscarEnTodo(termino) {
    const [resAnimes, resJuegos] = await Promise.allSettled([
      this.fetchConCache(
        `${this.jikanBase}/anime?q=${encodeURIComponent(termino)}&limit=10`,
        `busqueda_anime_${termino}`,
      ),
      this.fetchConCache(
        `${this.rawgBase}/games?search=${encodeURIComponent(termino)}&page_size=10&key=${this.rawgKey}`,
        `busqueda_juego_${termino}`,
      ),
    ]);

    // Promise.allSettled: procesa resultados independientemente de si fallaron
    return {
      animes:
        resAnimes.status === "fulfilled" ? resAnimes.value?.data || [] : [],
      juegos:
        resJuegos.status === "fulfilled" ? resJuegos.value?.results || [] : [],
      fallaron: [
        resAnimes.status === "rejected" ? "animes" : null,
        resJuegos.status === "rejected" ? "juegos" : null,
      ].filter(Boolean),
    };
  }
}

// ============================================================
// SECCIÓN 5: SISTEMA DE ACTUALIZACIÓN EN TIEMPO REAL (POLLING)
// ============================================================

class PollingManager {
  constructor() {
    this.intervaloActivo = null;
    this.ultimosIds = new Set();
    this.frecuencia = 30000; // 30 segundos
    this.maxFrecuencia = 120000; // máximo 2 minutos (backoff)
    this.errorCount = 0;
  }

  /**
   * Inicia el polling inteligente con control de frecuencia y backoff
   * @param {Function} callback - Función a llamar cuando hay datos nuevos
   */
  iniciar(callback) {
    if (this.intervaloActivo) return;

    const ejecutar = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(
          "https://api.jikan.moe/v4/top/anime?page=1&limit=5",
          { signal: controller.signal },
        );
        clearTimeout(timeout);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const nuevos = (data.data || []).filter(
          (a) => !this.ultimosIds.has(a.mal_id),
        );

        if (nuevos.length > 0) {
          nuevos.forEach((a) => this.ultimosIds.add(a.mal_id));
          callback(nuevos);
          this.mostrarNotificacionNuevos(nuevos.length);
        }

        // Resetear errores y frecuencia en éxito
        this.errorCount = 0;
        this.frecuencia = 30000;
      } catch (error) {
        if (error.name !== "AbortError") {
          this.errorCount++;
          // Backoff exponencial: duplicar el intervalo hasta el máximo
          this.frecuencia = Math.min(
            this.frecuencia * Math.pow(2, this.errorCount),
            this.maxFrecuencia,
          );
          console.warn(
            `[Polling] Error #${this.errorCount}, próxima en ${this.frecuencia / 1000}s`,
          );
          this.reiniciar(callback);
        }
      }
    };

    ejecutar();
    this.intervaloActivo = setInterval(ejecutar, this.frecuencia);
    console.log(
      "[Polling] Iniciado con intervalo de",
      this.frecuencia / 1000,
      "s",
    );
  }

  reiniciar(callback) {
    this.detener();
    setTimeout(() => this.iniciar(callback), this.frecuencia);
  }

  detener() {
    if (this.intervaloActivo) {
      clearInterval(this.intervaloActivo);
      this.intervaloActivo = null;
      console.log("[Polling] Detenido");
    }
  }

  mostrarNotificacionNuevos(cantidad) {
    const notif = document.createElement("div");
    notif.className = "notificacion-nuevos";
    notif.innerHTML = `
      <span class="notif-icono">&#9650;</span>
      <span>${cantidad} nuevo${cantidad > 1 ? "s títulos" : " título"} disponible${cantidad > 1 ? "s" : ""}</span>
    `;
    document.body.appendChild(notif);

    // Animar entrada
    requestAnimationFrame(() => {
      notif.classList.add("notif-visible");
    });

    // Eliminar después de 5 segundos
    setTimeout(() => {
      notif.classList.remove("notif-visible");
      setTimeout(() => notif.remove(), 400);
    }, 5000);
  }
}

// ============================================================
// Instancias globales
// ============================================================
const apiAvanzado = new APIAvanzado();
const pollingManager = new PollingManager();

// Buscador con debounce integrado
const buscarConDebounce = debounce((termino) => {
  if (termino.length >= 2) {
    apiAvanzado.buscarEnTodo(termino).then((resultados) => {
      console.log("[Búsqueda debounce] Resultados:", resultados);
      // Disparar evento personalizado para que otros módulos reaccionen
      document.dispatchEvent(
        new CustomEvent("resultadosBusqueda", {
          detail: resultados,
        }),
      );
    });
  }
}, 500);
