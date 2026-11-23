// Estado de la lista que sobrevive a cambiar de pantalla y a cerrar la aplicación: filtros, orden y la especie que estaba
// a la vista. Vive en localStorage; si el navegador lo bloquea, funciona igual pero sin recordar entre aperturas.
import { FILTRO_VACIO } from '../filtros.js';

export const CLAVE_MEMORIA = 'flora.lista';

function normalizar(d) {
  return {
    ...d, // conserva campos propios de cada pantalla (Estudio guarda modo, alcance y cantidad)
    filtro: { ...FILTRO_VACIO, ...(d?.filtro ?? {}) },
    orden: d?.orden ?? 'nombre',
    ancla: d?.ancla ?? null,
    ultimaId: d?.ultimaId ?? null,
  };
}

export function crearMemoria(obtenerAlmacen, clave = CLAVE_MEMORIA) {
  let actual = null;
  function leer() {
    try {
      return normalizar(JSON.parse(obtenerAlmacen().getItem(clave) ?? 'null'));
    } catch {
      return normalizar(null);
    }
  }
  function escribir() {
    try { obtenerAlmacen().setItem(clave, JSON.stringify(actual)); } catch { /* sin memoria persistente */ }
  }
  return {
    estado() {
      actual ??= leer();
      return actual;
    },
    actualizar(cambios) {
      actual = { ...this.estado(), ...cambios };
      escribir();
      return actual;
    },
    limpiarFiltros() {
      return this.actualizar({ filtro: { ...FILTRO_VACIO }, ancla: null });
    },
  };
}

export const memoria = crearMemoria(() => globalThis.localStorage);
