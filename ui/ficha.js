import { obtenerEspecie, fotosDe, COLORES_FLOR } from '../db.js';
import { el, urlDe, etiquetaAprendizaje, COLOR_HEX, estiloColor, tinteFondo } from './dom.js';

const CAMPOS = [
  ['nivel', 'Nivel'], ['origen', 'Origen'], ['habito', 'Hábito'], ['habitoDetalle', 'Hábito detallado'],
  ['ciclo', 'Ciclo de vida'], ['categoriaMMA', 'Categoría de conservación (MMA)'], ['decreto', 'Decreto'], ['ds68', 'D.S. 68/2009'],
  ['distribucion', 'Distribución'], ['rangoAltitudinal', 'Rango altitudinal'],
  ['colorFlor', 'Color de flor'], ['petalos', 'Pétalos'], ['petalosNota', 'Pétalos según clave'],
  ['sitios', 'Sitios'], ['aprendizaje', 'Aprendizaje'], ['aciertos', 'Aciertos en estudio'], ['fallos', 'Fallos en estudio'],
];

function valorTexto(clave, v) {
  if (clave === 'ds68') return v ? 'Sí' : '';
  if (clave === 'nivel') return v === 'especie' ? '' : v === 'genero' ? 'Género' : 'Familia';
  if (clave === 'aprendizaje') return etiquetaAprendizaje(v);
  if (clave === 'aciertos' || clave === 'fallos') return v ? String(v) : '';
  if (clave === 'colorFlor') return (v ?? []).map(c => (COLORES_FLOR.find(([valor]) => valor === c) ?? [c, c])[1]).join(', ');
  if (Array.isArray(v)) return v.join(', ');
  return v ?? '';
}

function abrirFoto(f) {
  const capa = el('div', { class: 'capa', onclick: () => capa.remove() },
    el('img', { src: urlDe(`foto-${f.id}`, f.blob), alt: '' }),
    f.fuente === 'inaturalist' ? el('p', { class: 'atribucion' }, `${f.autor} · ${f.licencia} · iNaturalist`) : null);
  document.body.append(capa);
}

export async function render(cont, ctx, id) {
  const { db, navegar } = ctx;
  const e = await obtenerEspecie(db, id);
  if (!e) { navegar('#/lista'); return; }
  const fotos = await fotosDe(db, id);
  const galeria = el('div', { class: 'galeria' },
    ...fotos.map(f => el('img', { src: urlDe(`foto-${f.id}`, f.blob), alt: '', onclick: () => abrirFoto(f) })));
  const campos = el('dl', { class: 'campos' }, ...CAMPOS.flatMap(([clave, titulo]) => {
    const v = valorTexto(clave, e[clave]);
    if (!v) return [];
    if (clave === 'colorFlor') {
      const muestras = (e.colorFlor ?? []).filter(c => COLOR_HEX[c])
        .map(c => el('span', { class: 'muestra-color', style: `background: ${COLOR_HEX[c]}` }));
      return [el('dt', {}, titulo), el('dd', {}, ...muestras, ' ', v)];
    }
    return [el('dt', {}, titulo), el('dd', {}, v)];
  }));
  const banda = estiloColor(e.colorFlor);
  const tinte = tinteFondo(e.colorFlor);
  cont.append(...[
    el('header', { class: tinte ? 'cabecera con-color' : 'cabecera', style: tinte ? `background: ${tinte}` : null },
      banda ? el('span', { class: 'banda', style: `background: ${banda}`, 'aria-hidden': 'true' }) : null,
      el('h1', {}, el('i', {}, e.nombre)), el('p', {}, e.familia || '')),
    fotos.length ? galeria : el('p', { class: 'estado' }, 'Sin fotos. Agrega una desde Editar.'),
    campos,
    e.notas ? el('section', {}, el('h2', {}, 'Notas'), el('p', { class: 'notas' }, e.notas)) : null,
    e.rasgosFuente ? el('section', {}, el('h2', {}, 'Fuentes de rasgos'),
      ...e.rasgosFuente.split('\n').map(u => u.trim()).filter(Boolean).map(url => el('p', { class: 'notas' }, el('a', { href: url, target: '_blank', rel: 'noopener' }, url)))) : null,
    el('div', { class: 'acciones' },
      el('a', { class: 'btn primario', href: `#/editar/${e.id}` }, 'Editar'),
      fotos.length ? el('a', { class: 'btn', href: `#/estudio?especie=${e.id}` }, 'Estudiar esta especie') : null,
      el('a', { class: 'btn', href: '#/lista' }, 'Volver')),
  ].filter(Boolean));
}
