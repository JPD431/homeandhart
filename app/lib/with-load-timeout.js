/** Timeout por defecto para cargas de página (cliente). */
export const LOAD_TIMEOUT_MS = 20_000;

/**
 * Corta una promesa si supera `ms`. Nunca deja la UI esperando indefinidamente.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} [ms]
 * @returns {Promise<T>}
 */
export function withLoadTimeout(promise, ms = LOAD_TIMEOUT_MS) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("LOAD_TIMEOUT"));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export function friendlyLoadError(err) {
  if (err?.message === "LOAD_TIMEOUT") {
    return "La carga está tardando demasiado. Reintentar";
  }
  return "No se pudieron cargar los datos. Reintentar";
}
