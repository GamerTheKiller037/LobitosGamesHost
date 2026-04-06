// js/controllers/animeController.js
// FIX: modal de detalles usa ID "detailsModal" (no "itemDetailModal")
// FIX paginación: soporta IDs "animePaginationContainer" y "animePagination"

class AnimeController {
  constructor() {
    this.model = animeModel;
    this.currentFilter = "";
    this.currentPage = 1;
    this.totalPages = 10;
  }

  async init() {
    if (this.model.animes.length === 0) {
      await this.model.loadAnimes();
    }
    this.renderAnimeGrid();
    this.setupFilters();
    this.updatePaginationUI();
    console.log("📊 Fuente de datos animes:", this.model.getDataSource());
  }

  renderAnimeGrid(animes = null) {
    const grid = document.getElementById("animeGrid");
    if (!grid) return;
    const animesToShow = animes || this.model.getAllAnimes();
    if (animesToShow.length === 0) {
      grid.innerHTML = `<div class="loading"><p>Cargando animes...</p></div>`;
      return;
    }
    grid.innerHTML = animesToShow
      .map(
        (anime) => `
        <div class="catalog-item" onclick="animeController.showDetails(${anime.id})">
          <img src="${anime.image}" alt="${anime.title}" class="item-poster"
               onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22%231a0533%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2218%22 fill=%22%236809e5%22%3ENo Image%3C/text%3E%3C/svg%3E'">
          <div class="item-info">
            <h3>${anime.title}</h3>
            <div class="item-meta">
              <span class="rating">⭐ ${anime.rating || "N/A"}</span>
              <span class="year">${anime.year || ""}</span>
            </div>
            <p class="genre">${anime.genre || ""}</p>
            <button class="play-btn" onclick="event.stopPropagation(); animeController.showDetails(${anime.id})">
              Ver detalles
            </button>
          </div>
        </div>`,
      )
      .join("");
  }

  setupFilters() {
    const genreFilter =
      document.getElementById("animeGenreFilter") ||
      document.getElementById("animeGenre");
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
          .getAllAnimes()
          .filter(
            (a) =>
              a.genre && a.genre.toLowerCase().includes(genre.toLowerCase()),
          )
      : this.model.getAllAnimes();
    this.renderAnimeGrid(filtered);
  }

  async search(searchTerm) {
    const grid = document.getElementById("animeGrid");
    if (grid)
      grid.innerHTML = '<div class="loading"><p>Buscando animes...</p></div>';
    let results = await this.model.searchAnimes(searchTerm);
    if (this.currentFilter) {
      results = results.filter((a) =>
        a.genre.toLowerCase().includes(this.currentFilter.toLowerCase()),
      );
    }
    this.renderAnimeGrid(results);
  }

  async showDetails(id) {
    try {
      const anime = await this.model.getAnimeDetails(id);
      if (!anime) {
        console.error("Anime no encontrado:", id);
        return;
      }

      const modal = document.getElementById("detailsModal");
      const modalBody = document.getElementById("modalBody");
      if (!modal || !modalBody) return;

      let detailsHTML = `
        <div class="modal-hero">
          <h2>${anime.title}</h2>
          <div class="modal-meta">
            <span class="modal-rating">⭐ ${anime.rating || "N/A"}</span>
            <span class="modal-year">${anime.year || "N/A"}</span>
            <span class="modal-genre">${anime.genre || "N/A"}</span>
          </div>
        </div>
        <div class="modal-details">
          <p><strong>Episodios:</strong> ${anime.episodes || "Desconocido"}</p>
          ${anime.status ? `<p><strong>Estado:</strong> ${anime.status}</p>` : ""}
          ${anime.studios ? `<p><strong>Estudios:</strong> ${anime.studios}</p>` : ""}
          ${anime.source ? `<p><strong>Fuente:</strong> ${anime.source}</p>` : ""}
          <p><strong>Sinopsis:</strong></p>
          <p>${anime.synopsis || "Sin descripción disponible."}</p>
        </div>`;

      if (typeof userModel !== "undefined" && userModel.isLoggedIn()) {
        const currentList =
          typeof userListModel !== "undefined"
            ? userListModel.getItemListType(anime.id, "anime")
            : null;
        detailsHTML += `
          <div class="modal-actions">
            <h3>Agregar a mis listas:</h3>
            <div class="list-buttons">
              ${[
                { key: "favoritos", label: "⭐ Favoritos" },
                { key: "viendo", label: "👁️ Viendo" },
                { key: "considerando", label: "🤔 Considerando" },
                { key: "completado", label: "✅ Completado" },
                { key: "dropeado", label: "❌ Dropeado" },
              ]
                .map(
                  ({ key, label }) => `
                <button class="btn-list ${currentList === key ? "active" : ""}"
                  onclick="animeController.addToList(${anime.id}, '${key}', ${JSON.stringify(anime).replace(/"/g, "&quot;")})">
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
      console.error("Error mostrando detalles anime:", error);
    }
  }

  async addToList(animeId, listType, animeData) {
    if (!userModel.isLoggedIn()) {
      authController.showMessage(
        "Debes iniciar sesión para agregar a tus listas",
        "error",
      );
      return;
    }
    const result = await userListModel.addToList(listType, animeData, "anime");
    if (result.success) {
      authController.showMessage(`Agregado a ${listType}`, "success");
      this.showDetails(animeId);
    } else {
      authController.showMessage(result.error, "error");
    }
  }

  getFeaturedAnimes() {
    return this.model.getAllAnimes().slice(0, 4);
  }

  async changePage(page) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    const grid = document.getElementById("animeGrid");
    if (grid)
      grid.innerHTML = '<div class="loading"><p>Cargando página...</p></div>';
    const animes = await this.model.loadMoreAnimes(page);
    this.renderAnimeGrid(animes);
    this.updatePaginationUI();
    document.getElementById("animes")?.scrollIntoView({ behavior: "smooth" });
  }

  updatePaginationUI() {
    const paginationContainer =
      document.getElementById("animePaginationContainer") ||
      document.getElementById("animePagination");
    if (!paginationContainer) return;

    let html = '<div class="pagination">';
    html += `<button class="pagination-btn" onclick="animeController.changePage(${this.currentPage - 1})"
      ${this.currentPage === 1 ? "disabled" : ""}>← Anterior</button>`;
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);
    if (start > 1) {
      html += `<button class="pagination-btn" onclick="animeController.changePage(1)">1</button>`;
      if (start > 2) html += '<span class="pagination-dots">...</span>';
    }
    for (let i = start; i <= end; i++) {
      html += `<button class="pagination-btn ${i === this.currentPage ? "active" : ""}"
        onclick="animeController.changePage(${i})">${i}</button>`;
    }
    if (end < this.totalPages) {
      if (end < this.totalPages - 1)
        html += '<span class="pagination-dots">...</span>';
      html += `<button class="pagination-btn" onclick="animeController.changePage(${this.totalPages})">${this.totalPages}</button>`;
    }
    html += `<button class="pagination-btn" onclick="animeController.changePage(${this.currentPage + 1})"
      ${this.currentPage === this.totalPages ? "disabled" : ""}>Siguiente →</button>`;
    html += "</div>";
    paginationContainer.innerHTML = html;
  }
}

const animeController = new AnimeController();
