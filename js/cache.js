// js/cache.js
// Módulo de caché manual en memoria para evitar llamadas repetidas a las APIs

class CacheManager {
  constructor() {
    this.store = new Map();
    this.timestamps = new Map();
    this.defaultTTL = 3600000; // 1 hora en ms
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Guarda un valor en caché con TTL opcional
   * @param {string} key - Clave única
   * @param {*} value - Valor a almacenar
   * @param {number} ttl - Tiempo de vida en ms (default: 1 hora)
   */
  set(key, value, ttl = this.defaultTTL) {
    this.store.set(key, value);
    this.timestamps.set(key, Date.now() + ttl);
    console.log(`[Cache] SET: ${key} (TTL: ${ttl / 1000}s)`);
  }

  /**
   * Obtiene un valor del caché si no ha expirado
   * @param {string} key - Clave a buscar
   * @returns {*|null} Valor almacenado o null si expiró/no existe
   */
  get(key) {
    if (!this.store.has(key)) {
      this.missCount++;
      return null;
    }

    const expiry = this.timestamps.get(key);
    if (Date.now() > expiry) {
      this.delete(key);
      this.missCount++;
      console.log(`[Cache] EXPIRED: ${key}`);
      return null;
    }

    this.hitCount++;
    console.log(`[Cache] HIT: ${key}`);
    return this.store.get(key);
  }

  /**
   * Verifica si una clave existe y no ha expirado
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Elimina una entrada del caché
   * @param {string} key
   */
  delete(key) {
    this.store.delete(key);
    this.timestamps.delete(key);
  }

  /**
   * Limpia todas las entradas expiradas
   */
  purgeExpired() {
    const now = Date.now();
    let purged = 0;
    for (const [key, expiry] of this.timestamps.entries()) {
      if (now > expiry) {
        this.store.delete(key);
        this.timestamps.delete(key);
        purged++;
      }
    }
    console.log(`[Cache] Purged ${purged} expired entries`);
    return purged;
  }

  /**
   * Limpia todo el caché
   */
  clear() {
    this.store.clear();
    this.timestamps.clear();
    this.hitCount = 0;
    this.missCount = 0;
    console.log("[Cache] Cleared all entries");
  }

  /**
   * Retorna estadísticas del caché
   * @returns {Object}
   */
  getStats() {
    const total = this.hitCount + this.missCount;
    return {
      entries: this.store.size,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate:
        total > 0 ? ((this.hitCount / total) * 100).toFixed(1) + "%" : "0%",
      keys: Array.from(this.store.keys()),
    };
  }
}

const cacheManager = new CacheManager();

// Purgar entradas expiradas cada 10 minutos
setInterval(() => cacheManager.purgeExpired(), 600000);
