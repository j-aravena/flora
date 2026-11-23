import { miniaturasPrimeras, especiesConFoto, valoresPetalos } from '../db.js';
import { ORDENES, filtrar, ordenar, hayOrdenListado, filtrosActivos } from '../filtros.js';
import { siglaCategoria, nivelCategoria, esHidrofila } from '../taxonomia.js';
import { el, urlDe, estiloColor, tinteFondo } from './dom.js';
import { memoria } from './memoria.js';
import { PRINCIPALES, TITULOS, opcionesFiltro, etiquetaFiltro, selectorFiltro, abrirHojaFiltros } from './filtros-ui.js';

const SITIO_AI = 'Chacao Chonchi';

export async function render(cont, ctx) {
  const { db } = ctx;
  const [todas, minis, conFoto, petalos] = await Promise.all([
    db.especies.toArray(), miniaturasPrimeras(db), especiesConFoto(db), valoresPetalos(db),
  ]);
  const ctxFiltro = { conFoto };
  const OPCIONES = opcionesFiltro({ todas, petalos });
  const etiqueta = (clave, valor) => etiquetaFiltro(OPCIONES, clave, valor);

  const contador = el('p', { class: 'contador', 'aria-live': 'polite' });
  const chips = el('div', { class: 'chips' });
  const principales = el('div', { class: 'filtros-principales' });
  const botonFiltros = el('button', { type: 'button', class: 'btn chico boton-filtros', onclick: () => abrirHoja() });
  const selectorOrden = el('select', { 'aria-label': 'Orden', onchange: ev => cambiar({ orden: ev.target.value }) });
  const ul = el('ul', { class: 'lista' });

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
    const otros = activos.filter(({ clave }) => !PRINCIPALES.includes(clave)).length;
    botonFiltros.textContent = otros ? `Más filtros (${otros})` : 'Más filtros';
    principales.replaceChildren(...PRINCIPALES.map(clave => selectorFiltro({
      clave, vacio: TITULOS[clave], OPCIONES, todas, ctxFiltro, filtro,
      alCambiar: valor => cambiar({ filtro: { [clave]: valor } }),
    })));
    const ordenes = ORDENES.filter(([v]) => v !== 'listado' || hayOrdenListado(todas, filtro.sitio));
    selectorOrden.replaceChildren(...ordenes.map(([v, t]) => el('option', { value: v, selected: v === orden }, t)));
    // replaceChildren convierte null en el texto "null": solo se pasan nodos.
    chips.replaceChildren(...[
      ...activos.map(({ clave, valor }) => el('button', {
        type: 'button', class: 'chip', 'aria-label': `Quitar ${TITULOS[clave]}`,
        onclick: () => cambiar({ filtro: { [clave]: '' } }),
      }, `${TITULOS[clave]}: ${etiqueta(clave, valor)} ×`)),
      activos.length ? el('button', { type: 'button', class: 'chip limpiar', onclick: () => {
        const texto = memoria.estado().filtro.texto;
        memoria.limpiarFiltros();
        cambiar({ filtro: { texto } });
      } }, 'Limpiar todo') : null,
    ].filter(Boolean));
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
    const visibles = ordenar(filtrar(todas, filtro, ctxFiltro), orden, filtro.sitio);
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
    abrirHojaFiltros({
      OPCIONES, todas, ctxFiltro,
      leerFiltro: () => memoria.estado().filtro,
      cambiar: filtro => cambiar({ filtro }),
      limpiar: () => { const texto = memoria.estado().filtro.texto; memoria.limpiarFiltros(); cambiar({ filtro: { texto } }); },
    });
  }

  const buscador = el('input', {
    type: 'search', placeholder: 'Buscar nombre, familia o rasgo', value: memoria.estado().filtro.texto,
    oninput: ev => cambiar({ filtro: { texto: ev.target.value } }),
  });
  cont.append(
    el('header', { class: 'cabecera' }, buscador, principales,
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
