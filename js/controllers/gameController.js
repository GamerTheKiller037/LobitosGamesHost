// js/controllers/gameController.js
// FIX: modal de detalles usa ID "detailsModal" (no "itemDetailModal")
// FIX paginación: soporta IDs "gamePaginationContainer" y "gamePagination"

class GameController {
  constructor() {
    this.model = gameModel;
    this.currentFilter = "";
    this.currentPage = 1;
    this.totalPages = 10;
  }

  async init() {
    if (this.model.games.length === 0) {
      await this.model.loadGames();
    }
    this.renderGameGrid();
    this.setupFilters();
    this.updatePaginationUI();
    console.log("📊 Fuente de datos juegos:", this.model.getDataSource());
  }

  renderGameGrid(games = null) {
    const grid = document.getElementById("gameGrid");
    if (!grid) return;
    const gamesToShow = games || this.model.getAllGames();
    if (gamesToShow.length === 0) {
      grid.innerHTML = `<div class="loading"><p>Cargando videojuegos...</p></div>`;
      return;
    }
    grid.innerHTML = gamesToShow
      .map((game) => {
        const metacriticColor =
          game.metacritic > 75
            ? "#27ae60"
            : game.metacritic > 50
              ? "#f39c12"
              : "#e74c3c";
        return `
        <div class="catalog-item" onclick="gameController.showDetails(${game.id})">
          <img src="${game.image}" alt="${game.title}" class="item-poster"
               onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22%231a0533%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2218%22 fill=%22%236809e5%22%3ENo Image%3C/text%3E%3C/svg%3E'">
          <div class="item-info">
            <h3>${game.title}</h3>
            <div class="item-meta">
              ${
                game.metacritic
                  ? `<span class="metacritic-score" style="background:${metacriticColor}">${game.metacritic}</span>`
                  : '<span class="no-score">N/A</span>'
              }
              <span class="year">${game.year || ""}</span>
            </div>
            <p class="genre">${game.genre || ""}</p>
            <button class="play-btn" onclick="event.stopPropagation(); gameController.showDetails(${game.id})">
              Ver detalles
            </button>
          </div>
        </div>`;
      })
      .join("");
  }

  setupFilters() {
    const genreFilter =
      document.getElementById("gameGenreFilter") ||
      document.getElementById("gameGenre");
    if (genreFilter) {
      genreFilter.addEventListener("change", (e) => {
        this.filterByGenre(e.target.value);
      });
    }
  }

  filterByGenre(genre) {
    this.currentFilter = genre;
    const filtered = genre
      ? this.model
          .getAllGames()
          .filter(
            (g) =>
              g.genre && g.genre.toLowerCase().includes(genre.toLowerCase()),
          )
      : this.model.getAllGames();
    this.renderGameGrid(filtered);
  }

  async search(searchTerm) {
    const grid = document.getElementById("gameGrid");
    if (grid)
      grid.innerHTML =
        '<div class="loading"><p>Buscando videojuegos...</p></div>';
    let results = await this.model.searchGames(searchTerm);
    if (this.currentFilter) {
      results = results.filter((g) =>
        g.genre.toLowerCase().includes(this.currentFilter.toLowerCase()),
      );
    }
    this.renderGameGrid(results);
  }

  getPlatformBadges(platformsData) {
    if (!platformsData || !platformsData.length)
      return '<span class="platform-tag">N/A</span>';
    return platformsData
      .slice(0, 4)
      .map((p) => {
        const name = p.platform ? p.platform.name : p;
        return `<span class="platform-tag">${name}</span>`;
      })
      .join("");
  }

  async showDetails(id) {
    try {
      const game = await this.model.getGameDetails(id);
      if (!game) {
        console.error("Juego no encontrado:", id);
        return;
      }

      const modal = document.getElementById("detailsModal");
      const modalBody = document.getElementById("modalBody");
      if (!modal || !modalBody) return;

      const metacriticBadge = game.metacritic
        ? `<span class="modal-rating" style="background-color:${game.metacriticColor || "#27ae60"};color:white">
             Metacritic ${game.metacritic}
           </span>`
        : "";

      let detailsHTML = `
        <div class="modal-hero">
          <h2>${game.title}</h2>
          <div class="modal-meta">
            ${metacriticBadge}
            <span class="modal-year">${game.year || "N/A"}</span>
            <span class="modal-genre">${game.genre || "N/A"}</span>
          </div>
        </div>
        <div class="modal-details">
          <p><strong>Plataformas:</strong></p>
          <div class="platforms-grid">
            ${game.platformsData ? this.getPlatformBadges(game.platformsData) : '<span class="platform-tag">N/A</span>'}
          </div>
          ${game.developers && game.developers !== "Información no disponible" ? `<p><strong>Desarrolladores:</strong> ${game.developers}</p>` : ""}
          ${game.publishers && game.publishers !== "Información no disponible" ? `<p><strong>Publicadores:</strong> ${game.publishers}</p>` : ""}
          ${game.esrb && game.esrb !== "N/A" ? `<p><strong>Clasificación:</strong> ${game.esrb}</p>` : ""}
          ${game.playtime && game.playtime !== "N/A" ? `<p><strong>Tiempo promedio:</strong> ${game.playtime}</p>` : ""}
          <p><strong>Descripción:</strong></p>
          <p>${game.synopsis || "Sin descripción disponible."}</p>
        </div>`;

      if (typeof userModel !== "undefined" && userModel.isLoggedIn()) {
        const currentList =
          typeof userListModel !== "undefined"
            ? userListModel.getItemListType(game.id, "game")
            : null;
        detailsHTML += `
          <div class="modal-actions">
            <h3>Agregar a mis listas:</h3>
            <div class="list-buttons">
              ${[
                { key: "favoritos", label: "⭐ Favoritos" },
                { key: "jugando", label: "🎮 Jugando" },
                { key: "considerando", label: "🤔 Considerando" },
                { key: "completado", label: "✅ Completado" },
                { key: "dropeado", label: "❌ Dropeado" },
              ]
                .map(
                  ({ key, label }) => `
                <button class="btn-list ${currentList === key ? "active" : ""}"
                  onclick="gameController.addToList(${game.id}, '${key}', ${JSON.stringify(game).replace(/"/g, "&quot;")})">
                  ${label}
                </button>`,
                )
                .join("")}
            </div>
          </div>`;
      }

      modalBody.innerHTML = detailsHTML;
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    } catch (error) {
      console.error("Error mostrando detalles juego:", error);
    }
  }

  async addToList(gameId, listType, gameData) {
    if (!userModel.isLoggedIn()) {
      authController.showMessage(
        "Debes iniciar sesión para agregar a tus listas",
        "error",
      );
      return;
    }
    const result = await userListModel.addToList(listType, gameData, "game");
    if (result.success) {
      authController.showMessage(`Agregado a ${listType}`, "success");
      this.showDetails(gameId);
    } else {
      authController.showMessage(result.error, "error");
    }
  }

  getFeaturedGames() {
    return this.model.getAllGames().slice(0, 4);
  }

  async changePage(page) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    const grid = document.getElementById("gameGrid");
    if (grid)
      grid.innerHTML = '<div class="loading"><p>Cargando página...</p></div>';
    const games = await this.model.loadMoreGames(page);
    this.renderGameGrid(games);
    this.updatePaginationUI();
    document.getElementById("games")?.scrollIntoView({ behavior: "smooth" });
  }

  updatePaginationUI() {
    const paginationContainer =
      document.getElementById("gamePaginationContainer") ||
      document.getElementById("gamePagination");
    if (!paginationContainer) return;

    let html = '<div class="pagination">';
    html += `<button class="pagination-btn" onclick="gameController.changePage(${this.currentPage - 1})"
      ${this.currentPage === 1 ? "disabled" : ""}>← Anterior</button>`;
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);
    if (start > 1) {
      html += `<button class="pagination-btn" onclick="gameController.changePage(1)">1</button>`;
      if (start > 2) html += '<span class="pagination-dots">...</span>';
    }
    for (let i = start; i <= end; i++) {
      html += `<button class="pagination-btn ${i === this.currentPage ? "active" : ""}"
        onclick="gameController.changePage(${i})">${i}</button>`;
    }
    if (end < this.totalPages) {
      if (end < this.totalPages - 1)
        html += '<span class="pagination-dots">...</span>';
      html += `<button class="pagination-btn" onclick="gameController.changePage(${this.totalPages})">${this.totalPages}</button>`;
    }
    html += `<button class="pagination-btn" onclick="gameController.changePage(${this.currentPage + 1})"
      ${this.currentPage === this.totalPages ? "disabled" : ""}>Siguiente →</button>`;
    html += "</div>";
    paginationContainer.innerHTML = html;
  }
}

const gameController = new GameController();
