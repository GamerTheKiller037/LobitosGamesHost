// js/models/gameModel.js
// Modelo de Videojuegos - CORREGIDO para usar RAWG API

class GameModel {
  constructor() {
    this.games = [];
    this.usingAPI = false; // Cambiado a false por defecto
    this.apiAttempted = false;
    // No cargar automáticamente en el constructor
  }

  /**
   * Cargar videojuegos desde la API o fallback local
   */
  async loadGames() {
    // Si ya se intentó cargar, no volver a intentar
    if (this.games.length > 0) {
      console.log("✅ Juegos ya cargados:", this.games.length);
      return this.games;
    }

    try {
      console.log("🔄 Intentando cargar videojuegos desde RAWG API...");

      // Intentar cargar desde la API
      const apiGames = await apiService.getTopGames(1);

      if (apiGames && apiGames.length > 0) {
        this.games = apiGames;
        this.usingAPI = true;
        this.apiAttempted = true;
        console.log("✅ Videojuegos cargados desde API:", this.games.length);
        return this.games;
      } else {
        throw new Error("No se obtuvieron juegos de la API");
      }
    } catch (error) {
      console.warn("⚠️ Error cargando desde API, usando datos locales:", error);

      // Fallback a datos locales
      try {
        const response = await fetch("data/games.json");
        if (!response.ok) throw new Error("Error cargando JSON local");

        this.games = await response.json();
        this.usingAPI = false;
        this.apiAttempted = true;
        console.log(
          "✅ Videojuegos cargados desde JSON local:",
          this.games.length,
        );
        return this.games;
      } catch (localError) {
        console.error("❌ Error cargando datos locales:", localError);
        this.games = this.getFallbackData();
        this.usingAPI = false;
        this.apiAttempted = true;
        console.log(
          "✅ Usando datos de fallback hardcodeados:",
          this.games.length,
        );
        return this.games;
      }
    }
  }

  /**
   * Recargar videojuegos desde la API
   */
  async reloadFromAPI() {
    console.log("🔄 Recargando desde API...");
    this.games = [];
    this.apiAttempted = false;
    await this.loadGames();
    return this.games;
  }

  /**
   * Cargar más videojuegos (paginación)
   * @param {number} page - Número de página
   */
  async loadMoreGames(page = 1) {
    // Intentar con API primero
    try {
      console.log(`🔄 Cargando página ${page} de videojuegos desde API...`);
      const newGames = await apiService.getTopGames(page);

      if (newGames && newGames.length > 0) {
        this.games = newGames;
        this.usingAPI = true;
        console.log(
          `✅ Cargados ${newGames.length} videojuegos desde API (página ${page})`,
        );
        return this.games;
      }
    } catch (error) {
      console.error("❌ Error cargando desde API:", error);
    }

    // Si falla la API, usar datos locales
    if (!this.usingAPI) {
      console.log("📝 Usando datos locales (paginación no disponible)");
      return this.games;
    }

    return this.games;
  }

  /**
   * Buscar videojuegos por término
   * @param {string} searchTerm - Término de búsqueda
   * @returns {Array} - Videojuegos encontrados
   */
  async searchGames(searchTerm) {
    if (!searchTerm || searchTerm.trim() === "") {
      return this.games;
    }

    // Intentar buscar en la API primero
    try {
      console.log(`🔍 Buscando "${searchTerm}" en RAWG API...`);
      const results = await apiService.searchGames(searchTerm, 20);

      if (results && results.length > 0) {
        console.log(`✅ Encontrados ${results.length} resultados desde API`);
        return results;
      }
    } catch (error) {
      console.error("❌ Error en búsqueda API:", error);
    }

    // Fallback a búsqueda local
    console.log("🔍 Realizando búsqueda local...");
    const term = searchTerm.toLowerCase();
    return this.games.filter(
      (game) =>
        game.title.toLowerCase().includes(term) ||
        game.genre.toLowerCase().includes(term) ||
        (game.platform && game.platform.toLowerCase().includes(term)),
    );
  }

  /**
   * Obtener todos los videojuegos
   * @returns {Array}
   */
  getAllGames() {
    return this.games;
  }

  /**
   * Obtener videojuego por ID
   * @param {number} id - ID del videojuego
   * @returns {Object|null}
   */
  getGameById(id) {
    return this.games.find((game) => game.id === parseInt(id));
  }

  /**
   * Obtener detalles completos de un videojuego desde la API
   * @param {number} id - ID del videojuego
   * @returns {Promise<Object>}
   */
  async getGameDetails(id) {
    // Intentar obtener desde API
    try {
      console.log(`🔍 Obteniendo detalles del juego ${id} desde API...`);
      const details = await apiService.getGameDetails(id);
      if (details) {
        console.log("✅ Detalles obtenidos desde API");
        return details;
      }
    } catch (error) {
      console.error("❌ Error obteniendo detalles desde API:", error);
    }

    // Fallback a datos locales
    console.log("📝 Usando datos locales para detalles");
    return this.getGameById(id);
  }

  /**
   * Filtrar videojuegos por género
   * @param {string} genre - Género a filtrar
   * @returns {Array}
   */
  getGamesByGenre(genre) {
    if (!genre) return this.games;

    return this.games.filter((game) =>
      game.genre.toLowerCase().includes(genre.toLowerCase()),
    );
  }

  /**
   * Datos de fallback (solo si todo falla)
   * @returns {Array}
   */
  getFallbackData() {
    return [
      {
        id: 3498,
        title: "Grand Theft Auto V",
        year: "2013",
        platform: "PC, PlayStation, Xbox",
        genre: "Acción, Aventura",
        rating: "9.3",
        synopsis:
          "Los criminales de carrera Michael De Santa, Trevor Philips y Franklin Clinton luchan por sobrevivir en una ciudad despiadada donde no pueden confiar en nadie, ni siquiera el uno en el otro.",
        image:
          "https://media.rawg.io/media/games/20a/20aa03a10cda45239fe22d035c0ebe64.jpg",
        metacritic: 97,
        metacriticColor: "#66cc33",
        developers: "Rockstar North",
        publishers: "Rockstar Games",
        platformsData: [
          { platform: { name: "PC", slug: "pc" } },
          { platform: { name: "PlayStation 4", slug: "playstation4" } },
          { platform: { name: "Xbox One", slug: "xbox-one" } },
        ],
      },
      {
        id: 3328,
        title: "The Witcher 3: Wild Hunt",
        year: "2015",
        platform: "PC, PlayStation, Xbox, Nintendo Switch",
        genre: "RPG, Aventura",
        rating: "9.3",
        synopsis:
          "Geralt de Rivia busca a su hija adoptiva Ciri mientras navega por un mundo de fantasía lleno de monstruos, intrigas políticas y decisiones morales complejas.",
        image:
          "https://media.rawg.io/media/games/618/618c2031a07bbff6b4f611f10b6bcdbc.jpg",
        metacritic: 92,
        metacriticColor: "#66cc33",
        developers: "CD PROJEKT RED",
        publishers: "CD PROJEKT RED",
        platformsData: [
          { platform: { name: "PC", slug: "pc" } },
          { platform: { name: "PlayStation 4", slug: "playstation4" } },
          { platform: { name: "Xbox One", slug: "xbox-one" } },
          { platform: { name: "Nintendo Switch", slug: "nintendo-switch" } },
        ],
      },
      {
        id: 4200,
        title: "Portal 2",
        year: "2011",
        platform: "PC, PlayStation, Xbox",
        genre: "Puzzle, Aventura",
        rating: "9.4",
        synopsis:
          "El juego de rompecabezas en primera persona Portal 2 te catapulta a un futuro misterioso donde deberás trabajar con una IA dañada para resolver acertijos imposibles.",
        image:
          "https://media.rawg.io/media/games/328/3283617cb7d75d67257fc58339188742.jpg",
        metacritic: 95,
        metacriticColor: "#66cc33",
        developers: "Valve",
        publishers: "Valve",
        platformsData: [
          { platform: { name: "PC", slug: "pc" } },
          { platform: { name: "PlayStation 3", slug: "playstation3" } },
          { platform: { name: "Xbox 360", slug: "xbox360" } },
        ],
      },
      {
        id: 5286,
        title: "Tomb Raider (2013)",
        year: "2013",
        platform: "PC, PlayStation, Xbox",
        genre: "Acción, Aventura",
        rating: "8.9",
        synopsis:
          "Lara Croft debe sobrevivir en una misteriosa isla mientras descubre los secretos oscuros de un antiguo culto.",
        image:
          "https://media.rawg.io/media/games/021/021c4e21a1824d2526f925eff6324653.jpg",
        metacritic: 86,
        metacriticColor: "#66cc33",
        developers: "Crystal Dynamics",
        publishers: "Square Enix",
        platformsData: [
          { platform: { name: "PC", slug: "pc" } },
          { platform: { name: "PlayStation 4", slug: "playstation4" } },
          { platform: { name: "Xbox One", slug: "xbox-one" } },
        ],
      },
      {
        id: 13536,
        title: "Portal",
        year: "2007",
        platform: "PC, Xbox 360, PlayStation 3",
        genre: "Puzzle, Plataformas",
        rating: "9.1",
        synopsis:
          "Portal es un juego de rompecabezas y acción en primera persona que revolucionó la industria con su innovadora mecánica de portales.",
        image:
          "https://media.rawg.io/media/games/7fa/7fa0b586293c5861ee32490e953a4996.jpg",
        metacritic: 90,
        metacriticColor: "#66cc33",
        developers: "Valve",
        publishers: "Valve",
        platformsData: [
          { platform: { name: "PC", slug: "pc" } },
          { platform: { name: "Xbox 360", slug: "xbox360" } },
          { platform: { name: "PlayStation 3", slug: "playstation3" } },
        ],
      },
      {
        id: 12020,
        title: "Left 4 Dead 2",
        year: "2009",
        platform: "PC, Xbox 360",
        genre: "Acción, Shooter",
        rating: "8.9",
        synopsis:
          "Este shooter cooperativo de zombis te pone en la piel de uno de cuatro nuevos supervivientes armados con una gran variedad de armas clásicas y mejoradas.",
        image:
          "https://media.rawg.io/media/games/d58/d588947d4286e7b5e0e12e1bea7d9844.jpg",
        metacritic: 89,
        metacriticColor: "#66cc33",
        developers: "Valve",
        publishers: "Valve",
        platformsData: [
          { platform: { name: "PC", slug: "pc" } },
          { platform: { name: "Xbox 360", slug: "xbox360" } },
        ],
      },
      {
        id: 4291,
        title: "Counter-Strike: Global Offensive",
        year: "2012",
        platform: "PC, PlayStation 3, Xbox 360",
        genre: "Shooter, Acción",
        rating: "8.8",
        synopsis:
          "Counter-Strike: Global Offensive expande el juego de acción por equipos que fue pionero cuando se lanzó hace 19 años.",
        image:
          "https://media.rawg.io/media/games/736/73619bd336c894d6941d926bfd563946.jpg",
        metacritic: 83,
        metacriticColor: "#66cc33",
        developers: "Valve, Hidden Path Entertainment",
        publishers: "Valve",
        platformsData: [
          { platform: { name: "PC", slug: "pc" } },
          { platform: { name: "PlayStation 3", slug: "playstation3" } },
          { platform: { name: "Xbox 360", slug: "xbox360" } },
        ],
      },
      {
        id: 58175,
        title: "God of War (2018)",
        year: "2018",
        platform: "PlayStation 4, PC",
        genre: "Acción, Aventura",
        rating: "9.4",
        synopsis:
          "Kratos vive ahora como un hombre en el reino de los dioses y monstruos nórdicos. Es en este mundo duro e implacable donde debe luchar para sobrevivir y enseñar a su hijo a hacer lo mismo.",
        image:
          "https://media.rawg.io/media/games/4be/4be6a6ad0364751a96229c56bf69be59.jpg",
        metacritic: 94,
        metacriticColor: "#66cc33",
        developers: "Santa Monica Studio",
        publishers: "Sony Interactive Entertainment",
        platformsData: [
          { platform: { name: "PlayStation 4", slug: "playstation4" } },
          { platform: { name: "PC", slug: "pc" } },
        ],
      },
    ];
  }

  /**
   * Verificar si está usando API o datos locales
   * @returns {boolean}
   */
  isUsingAPI() {
    return this.usingAPI;
  }

  /**
   * Obtener estado de la fuente de datos
   * @returns {string}
   */
  getDataSource() {
    return this.usingAPI ? "RAWG API" : "Datos locales / Fallback";
  }
}

// Crear instancia global
const gameModel = new GameModel();
