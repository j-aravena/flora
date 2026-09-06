import { listarEspecies, miniaturasPrimeras, SITIOS, ORIGENES, HABITOS, APRENDIZAJES, COLORES_FLOR, valoresPetalos } from '../db.js';
import { el, urlDe, estiloColor, tinteFondo } from './dom.js';

// El filtro persiste mientras la aplicación está abierta.
const filtro = { texto: '', sitio: '', origen: '', habito: '', aprendizaje: '', colorFlor: '', petalos: '' };

function etiquetaPetalos(v) {
  if (v === '0') return 'Sin pétalos (0)';
  if (v === '1') return '1 pétalo';
  if (v === 'variable') return 'Número variable';
  return `${v} pétalos`;
}

function selector(clave, opciones, titulo, alCambiar) {
  return el('select', { 'aria-label': titulo, onchange: ev => { filtro[clave] = ev.target.value; alCambiar(); } },
    el('option', { value: '' }, titulo),
    ...opciones.map(o => {
      const [valor, texto] = Array.isArray(o) ? o : [o, o];
      return el('option', { value: valor, selected: filtro[clave] === valor }, texto);
    }));
}

export async function render(cont, ctx) {
  const { db } = ctx;
  const minis = await miniaturasPrimeras(db);
  const petalos = await valoresPetalos(db);
  const contador = el('p', { class: 'contador' });
  const ul = el('ul', { class: 'lista' });

  async function pintar() {
    const especies = await listarEspecies(db, filtro);
    contador.textContent = `${especies.length} especies`;
    ul.replaceChildren(...especies.map(e => {
      const banda = estiloColor(e.colorFlor);
      const tinte = tinteFondo(e.colorFlor);
      return el('li', {},
        el('a', { href: `#/ficha/${e.id}`, style: tinte ? `background: ${tinte}` : null },
          banda ? el('span', { class: 'banda', style: `background: ${banda}`, 'aria-hidden': 'true' }) : null,
          minis.has(e.id)
            ? el('img', { src: urlDe(`mini-${e.id}`, minis.get(e.id)), alt: '', loading: 'lazy' })
            : el('div', { class: 'sin-foto' }, 'Sin foto'),
          el('div', { class: 'texto' }, el('i', {}, e.nombre), el('small', {}, e.familia || '')),
          el('span', { class: `punto ${e.aprendizaje ?? 'sin'}` })));
    }));
  }

  const buscador = el('input', { type: 'search', placeholder: 'Buscar nombre o familia', value: filtro.texto, oninput: ev => { filtro.texto = ev.target.value; pintar(); } });
  const filtros = el('div', { class: 'filtros' },
    selector('sitio', SITIOS, 'Sitio', pintar),
    selector('origen', ORIGENES, 'Origen', pintar),
    selector('habito', HABITOS, 'Hábito', pintar),
    selector('aprendizaje', APRENDIZAJES, 'Aprendizaje', pintar),
    selector('colorFlor', COLORES_FLOR, 'Color de flor', pintar),
    selector('petalos', petalos.map(v => [v, etiquetaPetalos(v)]), 'Pétalos', pintar));
  cont.append(
    el('header', { class: 'cabecera' }, buscador, filtros, contador),
    ul,
    el('a', { class: 'flotante', href: '#/editar/', 'aria-label': 'Nueva especie' }, '+'));
  await pintar();
}
