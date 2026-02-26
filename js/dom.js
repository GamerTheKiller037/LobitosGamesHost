// js/dom.js
// Módulo de manipulación del DOM: helpers reutilizables para toda la app
// Separación de responsabilidades: toda la lógica del DOM está aquí

const DOM = {
  // ---- Selección ----
  select: (sel, ctx = document) => ctx.querySelector(sel),
  selectAll: (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel)),

  // ---- Creación ----
  crear(tag, atributos = {}, texto = "") {
    const el = document.createElement(tag);
    Object.entries(atributos).forEach(([k, v]) => {
      if (k === "class") el.className = v;
      else if (k === "style") Object.assign(el.style, v);
      else if (k.startsWith("data-")) el.dataset[k.slice(5)] = v;
      else el[k] = v;
    });
    if (texto) el.textContent = texto;
    return el;
  },

  // ---- Inserción ----
  agregar: (padre, hijo) => padre.appendChild(hijo),
  prepend: (padre, hijo) => padre.prepend(hijo),
  insertarAntes: (ref, el) => ref.parentNode.insertBefore(el, ref),

  // ---- Eliminación ----
  eliminar: (el) => el?.remove(),
  vaciar: (el) => {
    while (el.firstChild) el.firstChild.remove();
  },

  // ---- Clases ----
  addClass: (el, ...cls) => el?.classList.add(...cls),
  removeClass: (el, ...cls) => el?.classList.remove(...cls),
  toggleClass: (el, cls) => el?.classList.toggle(cls),
  hasClass: (el, cls) => el?.classList.contains(cls),

  // ---- Atributos ----
  setAttr: (el, k, v) => el?.setAttribute(k, v),
  getAttr: (el, k) => el?.getAttribute(k),
  removeAttr: (el, k) => el?.removeAttribute(k),

  // ---- Contenido ----
  setText: (el, txt) => {
    if (el) el.textContent = txt;
  },
  setHTML: (el, html) => {
    if (el) el.innerHTML = html;
  },

  // ---- Eventos ----
  on: (el, ev, fn, opts) => el?.addEventListener(ev, fn, opts),
  off: (el, ev, fn) => el?.removeEventListener(ev, fn),

  // ---- Loader visual ----
  mostrarLoader(contenedorId, mensaje = "Cargando...") {
    const el = document.getElementById(contenedorId);
    if (!el) return;
    el.innerHTML = `
      <div class="loader-wrapper">
        <div class="loader-spinner"></div>
        <p class="loader-texto">${mensaje}</p>
      </div>
    `;
  },

  // ---- Mensaje de error visual ----
  mostrarError(contenedorId, mensaje = "Ocurrió un error") {
    const el = document.getElementById(contenedorId);
    if (!el) return;
    el.innerHTML = `
      <div class="error-visual">
        <span class="error-visual-icono">&#9888;</span>
        <p>${mensaje}</p>
        <button onclick="location.reload()">Reintentar</button>
      </div>
    `;
  },

  // ---- Tarjeta de catálogo genérica ----
  crearTarjeta({ id, titulo, imagen, rating, anio, genero, tipo, onClick }) {
    const card = this.crear("div", {
      class: "catalog-item animate-on-scroll",
      "data-id": id,
      "data-tipo": tipo,
    });

    card.innerHTML = `
      <img src="${imagen}" alt="${titulo}" class="item-poster" loading="lazy"
           onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22280%22 height=%22200%22%3E%3Crect fill=%22%236809e5%22 width=%22280%22 height=%22200%22/%3E%3C/svg%3E'">
      <div class="item-info">
        <h3>${titulo}</h3>
        <div class="item-meta">
          <span class="rating">&#9733; ${rating}</span>
          <span class="year">${anio}</span>
        </div>
        <p class="genre">${genero}</p>
        <button class="play-btn magnetic-btn">Ver detalles</button>
      </div>
    `;

    if (typeof onClick === "function") {
      card.addEventListener("click", onClick);
    }

    return card;
  },

  // ---- Renderizar grid de tarjetas ----
  renderizarGrid(contenedorId, items, fnCrearTarjeta) {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    if (!items || items.length === 0) {
      this.mostrarError(contenedorId, "No se encontraron resultados");
      return;
    }

    this.vaciar(contenedor);

    const fragmento = document.createDocumentFragment();
    items.forEach((item) => {
      fragmento.appendChild(fnCrearTarjeta(item));
    });

    contenedor.appendChild(fragmento);

    // Notificar al motor de animaciones que hay nuevos elementos
    if (typeof animationEngine !== "undefined") {
      animationEngine.observarNuevosElementos();
    }
  },
};
