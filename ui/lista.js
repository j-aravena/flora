import {
  miniaturasPrimeras, especiesConFoto, valoresPetalos, SITIOS, ORIGENES, HABITOS, APRENDIZAJES, COLORES_FLOR, CATEGORIAS,
} from '../db.js';
import { FILTRO_VACIO, ORDENES, filtrar, ordenar, conteos, hayOrdenListado, filtrosActivos } from '../filtros.js';
import { GRUPOS, FORMAS_VIDA, siglaCategoria, nivelCategoria, esHidrofila } from '../taxonomia.js';
import { el, urlDe, estiloColor, tinteFondo } from './dom.js';
import { memoria } from './memoria.js';

const SITIO_AI = 'Chacao Chonchi';
const TITULOS = {
  grupo: 'Grupo', familia: 'Familia', habito: 'Hábito', formaVida: 'Forma de vida', colorFlor: 'Color de flor',
  petalos: 'Pétalos', categoria: 'Conservación', origen: 'Origen', hidrofila: 'Hidrófila o de humedal',
  registroAI: 'Registrada antes en el AI', sitio: 'Sitio', aprendizaje: 'Aprendizaje', foto: 'Fotos',
};
const SECCIONES = [
  ['Identificación', ['grupo', 'familia', 'habito', 'formaVida', 'colorFlor', 'petalos']],
  ['Evaluación ambiental', ['categoria', 'origen', 'hidrofila', 'registroAI']],
  ['Estudio', ['sitio', 'aprendizaje', 'foto']],
];

function etiquetaPetalos(v) {
  if (v === '0') return 'Sin pétalos (0)';
  if (v === '1') return '1 pétalo';
  if (v === 'variable') return 'Número variable';
  return `${v} pétalos`;
}

const pares = l => l.map(o => (Array.isArray(o) ? o : [o, o]));

export async function render(cont, ctx) {
  const { db } = ctx;
  const [todas, minis, conFoto, petalos] = await Promise.all([
    db.especies.toArray(), miniaturasPrimeras(db), especiesConFoto(db), valoresPetalos(db),
  ]);
  const ctxFiltro = { conFoto };
  const familias = [...new Set(todas.map(e => e.familia).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const OPCIONES = {
    grupo: pares(GRUPOS), familia: pares(familias), habito: pares(HABITOS), formaVida: pares(FORMAS_VIDA),
    colorFlor: COLORES_FLOR, petalos: petalos.map(v => [v, etiquetaPetalos(v)]),
    categoria: [['alguna', 'En alguna categoría'], ...pares(CATEGORIAS)], origen: pares(ORIGENES),
    hidrofila: [['si', 'Sí']], registroAI: [['si', 'Sí'], ['no', 'No'], ['duda', 'Por confirmar']],
    sitio: pares(SITIOS), aprendizaje: APRENDIZAJES, foto: [['con', 'Con foto'], ['sin', 'Sin foto']],
  };
  const etiqueta = (clave, valor) => (OPCIONES[clave].find(([v]) => v === valor) ?? [valor, valor])[1];
  const visible = clave => clave !== 'registroAI' || memoria.estado().filtro.sitio === SITIO_AI;

  const contador = el('p', { class: 'contador', 'aria-live': 'polite' });
  const chips = el('div', { class: 'chips' });
  const botonFiltros = el('button', { type: 'button', class: 'btn chico boton-filtros', onclick: () => abrirHoja() });
  const selectorOrden = el('select', { 'aria-label': 'Orden', onchange: ev => cambiar({ orden: ev.target.value }) });
  const ul = el('ul', { class: 'lista' });
  let visibles = [];

  function cambiar({ filtro, orden }) {
    const actual = memoria.estado();
    const nuevoFiltro = { ...actual.filtro, ...(filtro ?? {}) };
    if (nuevoFiltro.sitio !== SITIO_AI) nuevoFiltro.registroAI = '';
    memoria.actualizar({ filtro: nuevoFiltro, orden: orden ?? actual.orden, ancla: null });
    pintar();
    window.scrollTo(0, 0);
  }

  function pintarControles() {
    const { filtro, orden } = memoria.estado();
    const activos = filtrosActivos(filtro);
    botonFiltros.textContent = activos.length ? `Filtros (${activos.length})` : 'Filtros';
    const ordenes = ORDENES.filter(([v]) => v !== 'listado' || hayOrdenListado(todas, filtro.sitio));
    selectorOrden.replaceChildren(...ordenes.map(([v, t]) => el('option', { value: v, selected: v === orden }, t)));
    chips.replaceChildren(
      ...activos.map(({ clave, valor }) => el('button', {
        type: 'button', class: 'chip', 'aria-label': `Quitar ${TITULOS[clave]}`,
        onclick: () => cambiar({ filtro: { [clave]: '' } }),
      }, `${TITULOS[clave]}: ${etiqueta(clave, valor)} ×`)),
      activos.length ? el('button', { type: 'button', class: 'chip limpiar', onclick: () => {
        const texto = memoria.estado().filtro.texto;
        memoria.limpiarFiltros();
        cambiar({ filtro: { texto } });
      } }, 'Limpiar todo') : null);
  }

  function fila(e) {
    const banda = estiloColor(e.colorFlor);
    const tinte = tinteFondo(e.colorFlor);
    const sigla = siglaCategoria(e.categoriaMMA);
    const insignias = [
      sigla ? el('span', { class: `insignia cat-${nivelCategoria(e.categoriaMMA)}`, title: e.categoriaMMA }, sigla) : null,
      esHidrofila(e) ? el('span', { class: 'insignia hidrofila', title: 'Hidrófila o de humedal' }, 'Hidrófila') : null,
      e.registroAI === 'si' ? el('span', { class: 'insignia ai', title: 'Registrada antes en el AI' }, 'AI') : null,
      e.registroAI === 'duda' ? el('span', { class: 'insignia ai duda', title: 'Registro en el AI por confirmar' }, 'AI?') : null,
    ].filter(Boolean);
    return el('li', { 'data-id': e.id },
      el('a', {
        href: `#/ficha/${e.id}`, style: tinte ? `background: ${tinte}` : null,
        onclick: ev => memoria.actualizar({ ancla: { id: e.id, desfase: ev.currentTarget.getBoundingClientRect().top }, ultimaId: e.id }),
      },
      banda ? el('span', { class: 'banda', style: `background: ${banda}`, 'aria-hidden': 'true' }) : null,
      minis.has(e.id)
        ? el('img', { src: urlDe(`mini-${e.id}`, minis.get(e.id)), alt: '', loading: 'lazy', width: 64, height: 64 })
        : el('div', { class: 'sin-foto' }, 'Sin foto'),
      el('div', { class: 'texto' }, el('i', {}, e.nombre),
        el('small', {}, e.familia || ''),
        insignias.length ? el('span', { class: 'insignias' }, ...insignias) : null),
      el('span', { class: `punto ${e.aprendizaje ?? 'sin'}` })));
  }

  function pintar() {
    const { filtro, orden } = memoria.estado();
    visibles = ordenar(filtrar(todas, filtro, ctxFiltro), orden, filtro.sitio);
    contador.textContent = `${visibles.length} especies`;
    const items = [];
    let familiaActual = null;
    for (const e of visibles) {
      if (orden === 'familia' && (e.familia || 'Sin familia') !== familiaActual) {
        familiaActual = e.familia || 'Sin familia';
        const n = visibles.filter(x => (x.familia || 'Sin familia') === familiaActual).length;
        items.push(el('li', { class: 'grupo-familia' }, familiaActual, el('small', {}, ` ${n}`)));
      }
      items.push(fila(e));
    }
    ul.replaceChildren(...items);
    pintarControles();
  }

  function abrirHoja() {
    const dialogo = el('dialog', { class: 'hoja', 'aria-label': 'Filtros' });
    let porAtras = false;
    function pintarHoja() {
      const { filtro } = memoria.estado();
      const total = filtrar(todas, filtro, ctxFiltro).length;
      dialogo.replaceChildren(
        el('div', { class: 'hoja-cabecera' }, el('h2', {}, 'Filtros'),
          el('button', { type: 'button', class: 'btn chico', onclick: () => { const texto = memoria.estado().filtro.texto; memoria.limpiarFiltros(); cambiar({ filtro: { texto } }); pintarHoja(); } }, 'Limpiar todo')),
        ...SECCIONES.map(([titulo, claves]) => el('section', { class: 'hoja-seccion' }, el('h3', {}, titulo),
          ...claves.filter(visible).map(clave => {
            const ops = OPCIONES[clave];
            const n = conteos(todas, filtro, clave, ops.map(([v]) => v), ctxFiltro);
            return el('label', {}, TITULOS[clave], el('select', {
              onchange: ev => { cambiar({ filtro: { [clave]: ev.target.value } }); pintarHoja(); },
            }, el('option', { value: '' }, 'Todas'),
            ...ops.map(([v, t]) => el('option', {
              value: v, selected: filtro[clave] === v, disabled: n.get(v) === 0 && filtro[clave] !== v,
            }, `${t} (${n.get(v)})`))));
          }))),
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

  const buscador = el('input', {
    type: 'search', placeholder: 'Buscar nombre, familia o rasgo', value: memoria.estado().filtro.texto,
    oninput: ev => cambiar({ filtro: { texto: ev.target.value } }),
  });
  cont.append(
    el('header', { class: 'cabecera' }, buscador,
      el('div', { class: 'barra-filtros' }, botonFiltros, selectorOrden), chips, contador),
    ul,
    el('a', { class: 'flotante', href: '#/editar/', 'aria-label': 'Nueva especie' }, '+'));
  pintar();
  restaurar();
  vigilarScroll();

  function restaurar() {
    const { ancla, ultimaId } = memoria.estado();
    const buscar = id => ul.querySelector(`li[data-id="${CSS.escape(id)}"]`);
    if (ancla) {
      const f = buscar(ancla.id);
      if (f) window.scrollTo(0, window.scrollY + f.getBoundingClientRect().top - ancla.desfase);
    }
    if (ultimaId) {
      const f = buscar(ultimaId);
      if (f) {
        f.classList.add('reciente');
        setTimeout(() => f.classList.remove('reciente'), 1500);
      }
    }
  }

  function vigilarScroll() {
    let pendiente = null;
    const guardar = () => {
      pendiente = null;
      if (!ul.isConnected) return;
      const filaVisible = [...ul.querySelectorAll('li[data-id]')].find(li => li.getBoundingClientRect().bottom > 0);
      if (filaVisible) memoria.actualizar({ ancla: { id: filaVisible.dataset.id, desfase: filaVisible.getBoundingClientRect().top } });
    };
    const alScroll = () => {
      if (!ul.isConnected) { window.removeEventListener('scroll', alScroll); window.removeEventListener('pagehide', guardar); return; }
      if (!pendiente) pendiente = setTimeout(guardar, 200);
    };
    window.addEventListener('scroll', alScroll, { passive: true });
    window.addEventListener('pagehide', guardar);
  }
}
