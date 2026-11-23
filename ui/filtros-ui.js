// Piezas de filtrado compartidas por la lista y Estudio: opciones, selector con conteos y la hoja "Más filtros".
// No guardan estado: quien las usa decide dónde se recuerda el filtro (su propia memoria).
import { SITIOS, ORIGENES, HABITOS, APRENDIZAJES, COLORES_FLOR, CATEGORIAS } from '../db.js';
import { filtrar, conteos } from '../filtros.js';
import { GRUPOS, FORMAS_VIDA } from '../taxonomia.js';
import { el } from './dom.js';

const SITIO_AI = 'Chacao Chonchi';
export const TITULOS = {
  grupo: 'Grupo', familia: 'Familia', habito: 'Hábito', formaVida: 'Forma de vida', colorFlor: 'Color de flor',
  petalos: 'Pétalos', categoria: 'Conservación', origen: 'Origen', hidrofila: 'Hidrófila o de humedal',
  registroAI: 'Registrada antes en el AI', sitio: 'Sitio', aprendizaje: 'Aprendizaje', foto: 'Fotos',
};
// Los filtros más usados en terreno quedan a la vista sobre la lista; el resto, en la hoja "Más filtros".
export const PRINCIPALES = ['sitio', 'familia', 'habito', 'categoria'];
export const SECCIONES = [
  ['Identificación', ['grupo', 'formaVida', 'colorFlor', 'petalos']],
  ['Evaluación ambiental', ['origen', 'hidrofila', 'registroAI']],
  ['Estudio', ['aprendizaje', 'foto']],
];

function etiquetaPetalos(v) {
  if (v === '0') return 'Sin pétalos (0)';
  if (v === '1') return '1 pétalo';
  if (v === 'variable') return 'Número variable';
  return `${v} pétalos`;
}

const pares = l => l.map(o => (Array.isArray(o) ? o : [o, o]));

export function opcionesFiltro({ todas, petalos }) {
  const familias = [...new Set(todas.map(e => e.familia).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  return {
    grupo: pares(GRUPOS), familia: pares(familias), habito: pares(HABITOS), formaVida: pares(FORMAS_VIDA),
    colorFlor: COLORES_FLOR, petalos: petalos.map(v => [v, etiquetaPetalos(v)]),
    categoria: [['alguna', 'En alguna categoría'], ...pares(CATEGORIAS)], origen: pares(ORIGENES),
    hidrofila: [['si', 'Sí']], registroAI: [['si', 'Sí'], ['no', 'No'], ['duda', 'Por confirmar']],
    sitio: pares(SITIOS), aprendizaje: APRENDIZAJES, foto: [['con', 'Con foto'], ['sin', 'Sin foto']],
  };
}

export const etiquetaFiltro = (OPCIONES, clave, valor) => (OPCIONES[clave].find(([v]) => v === valor) ?? [valor, valor])[1];

export const visibleCon = filtro => clave => clave !== 'registroAI' || filtro.sitio === SITIO_AI;

// Selector de un filtro con el conteo de cada opción; las que dejarían la lista vacía quedan deshabilitadas.
// vacio: texto de la opción sin filtro ('Todas' en la hoja; el nombre del filtro sobre la lista).
export function selectorFiltro({ clave, vacio, OPCIONES, todas, ctxFiltro, filtro, alCambiar }) {
  const ops = OPCIONES[clave];
  const n = conteos(todas, filtro, clave, ops.map(([v]) => v), ctxFiltro);
  return el('select', {
    'aria-label': TITULOS[clave], class: filtro[clave] ? 'activo' : null,
    onchange: ev => alCambiar(ev.target.value),
  }, el('option', { value: '' }, vacio),
  ...ops.map(([v, t]) => el('option', {
    value: v, selected: filtro[clave] === v, disabled: n.get(v) === 0 && filtro[clave] !== v,
  }, `${t} (${n.get(v)})`)));
}

// Hoja "Más filtros". leerFiltro() devuelve el filtro actual; cambiar({ [clave]: valor }) aplica un cambio; limpiar() lo limpia.
export function abrirHojaFiltros({ titulo = 'Más filtros', OPCIONES, todas, ctxFiltro, leerFiltro, cambiar, limpiar }) {
  const dialogo = el('dialog', { class: 'hoja', 'aria-label': 'Filtros' });
  let porAtras = false;
  function pintarHoja() {
    const filtro = leerFiltro();
    const total = filtrar(todas, filtro, ctxFiltro).length;
    dialogo.replaceChildren(
      el('div', { class: 'hoja-cabecera' }, el('h2', {}, titulo),
        el('button', { type: 'button', class: 'btn chico', onclick: () => { limpiar(); pintarHoja(); } }, 'Limpiar todo')),
      ...SECCIONES.map(([seccion, claves]) => el('section', { class: 'hoja-seccion' }, el('h3', {}, seccion),
        ...claves.filter(visibleCon(filtro)).map(clave => el('label', {}, TITULOS[clave], selectorFiltro({
          clave, vacio: 'Todas', OPCIONES, todas, ctxFiltro, filtro,
          alCambiar: valor => { cambiar({ [clave]: valor }); pintarHoja(); },
        }))))),
      el('div', { class: 'hoja-pie' },
        el('button', { type: 'button', class: 'btn primario', onclick: () => dialogo.close() }, `Ver ${total} especies`)));
  }
  const alVolver = () => { porAtras = true; if (dialogo.open) dialogo.close(); };
  dialogo.addEventListener('close', () => {
    window.removeEventListener('popstate', alVolver);
    dialogo.remove();
    if (!porAtras) history.back();
  });
  pintarHoja();
  document.body.append(dialogo);
  history.pushState({ hoja: true }, '');
  window.addEventListener('popstate', alVolver);
  dialogo.showModal();
}
