// tema.js — Preferencia de tema (spec 1.5 §3.2). Sin dependencias; aplicarTema toca el DOM.
export const CLAVE_TEMA = 'flora.tema';
export const TEMAS = [['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']];
const VALIDOS = TEMAS.map(([v]) => v);
export const COLOR_BARRA = { claro: '#f3f5f0', oscuro: '#0a0d0b' };

export function leerTema(almacen) {
  try {
    const v = almacen.getItem(CLAVE_TEMA);
    return VALIDOS.includes(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function guardarTema(almacen, valor) {
  if (!VALIDOS.includes(valor)) throw new Error(`Tema desconocido: ${valor}`);
  try { almacen.setItem(CLAVE_TEMA, valor); } catch { /* sin persistencia */ }
}

export function temaEfectivo(preferencia, oscuroDelSistema) {
  if (preferencia === 'claro' || preferencia === 'oscuro') return preferencia;
  return oscuroDelSistema ? 'oscuro' : 'claro';
}

// Aplica la preferencia: con 'auto' quita el atributo y deja que mande prefers-color-scheme.
export function aplicarTema(preferencia) {
  const raiz = document.documentElement;
  if (preferencia === 'auto') raiz.removeAttribute('data-tema');
  else raiz.setAttribute('data-tema', preferencia);
  const oscuro = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOR_BARRA[temaEfectivo(preferencia, oscuro)]);
}
