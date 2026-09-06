// Utilidades de interfaz: constructor de elementos, URLs de blobs, avisos.

export function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === false || valor == null) continue;
    if (clave === 'class') nodo.className = valor;
    else if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2).toLowerCase(), valor);
    else if (['value', 'checked', 'selected', 'hidden', 'disabled', 'multiple'].includes(clave)) nodo[clave] = valor;
    else nodo.setAttribute(clave, valor === true ? '' : valor);
  }
  for (const hijo of hijos.flat()) {
    if (hijo == null || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return nodo;
}

// Las URLs de blobs se liberan al cambiar de pantalla (app.js llama a liberarUrls).
const urls = new Map();

export function urlDe(clave, blob) {
  if (!urls.has(clave)) urls.set(clave, URL.createObjectURL(blob));
  return urls.get(clave);
}

export function liberarUrls() {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
}

export function aviso(texto, ms = 2500) {
  const nodo = el('div', { class: 'aviso', role: 'status' }, texto);
  document.body.append(nodo);
  setTimeout(() => nodo.remove(), ms);
}

const ETIQUETAS = { se: 'La sé', falta: 'Me falta', no: 'No la sé', sin: 'Sin evaluar' };

export function etiquetaAprendizaje(valor) {
  return ETIQUETAS[valor ?? 'sin'];
}

export function fechaCorta(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-CL') : 'nunca';
}

// Indicio visual del color de flor: mapa de la paleta a color CSS y helpers
// para la banda de color y el tinte de fondo de lista y ficha.
export const COLOR_HEX = {
  blanco: '#f4f1e8', amarillo: '#f2c94c', naranja: '#f2994a', rojo: '#d94141', rosado: '#f28cb8',
  morado: '#9b59b6', azul: '#4a90e2', verde: '#6fbf73', cafe: '#a5714b',
};

function utiles(colores) {
  return (colores ?? []).filter(c => COLOR_HEX[c]);
}

export function estiloColor(colores) {
  const [a, b] = utiles(colores);
  if (!a) return '';
  if (!b) return COLOR_HEX[a];
  return `linear-gradient(180deg, ${COLOR_HEX[a]} 0 50%, ${COLOR_HEX[b]} 50% 100%)`;
}

export function tinteFondo(colores) {
  const [a] = utiles(colores);
  return a ? `color-mix(in srgb, ${COLOR_HEX[a]} 14%, var(--tarjeta))` : '';
}
