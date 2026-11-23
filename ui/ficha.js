import { obtenerEspecie, fotosDe, especiesConFoto, COLORES_FLOR } from '../db.js';
import { filtrar, ordenar } from '../filtros.js';
import { grupoDe, formasVida, esHidrofila } from '../taxonomia.js';
import { memoria } from './memoria.js';
import { el, urlDe, etiquetaAprendizaje, COLOR_HEX, estiloColor, tinteFondo } from './dom.js';

const CAMPOS = [
  ['nivel', 'Nivel'], ['grupo', 'Grupo'], ['origen', 'Origen'], ['habito', 'Hábito'], ['habitoDetalle', 'Hábito detallado'],
  ['formasVida', 'Forma de vida'], ['ciclo', 'Ciclo de vida'], ['categoriaMMA', 'Categoría de conservación (MMA)'],
  ['decreto', 'Decreto'], ['ds68', 'D.S. 68/2009'], ['hidrofila', 'Hidrófila o de humedal'], ['registroAI', 'Registrada antes en el AI'],
  ['distribucion', 'Distribución'], ['rangoAltitudinal', 'Rango altitudinal'],
  ['colorFlor', 'Color de flor'], ['petalos', 'Pétalos'], ['petalosNota', 'Pétalos según clave'],
  ['sitios', 'Sitios'], ['aprendizaje', 'Aprendizaje'], ['aciertos', 'Aciertos en estudio'], ['fallos', 'Fallos en estudio'],
];

const REGISTRO_AI = { si: 'Sí', no: 'No', duda: 'Por confirmar' };
const ATRIBUCION_PRESENTACION = 'Presentación Chacao Chonchi';

function valorTexto(clave, v) {
  if (clave === 'ds68') return v ? 'Sí' : '';
  if (clave === 'nivel') return v === 'especie' ? '' : v === 'genero' ? 'Género' : 'Familia';
  if (clave === 'aprendizaje') return etiquetaAprendizaje(v);
  if (clave === 'aciertos' || clave === 'fallos') return v ? String(v) : '';
  if (clave === 'colorFlor') return (v ?? []).map(c => (COLORES_FLOR.find(([valor]) => valor === c) ?? [c, c])[1]).join(', ');
  if (clave === 'hidrofila') return v ? 'Sí' : '';
  if (clave === 'registroAI') return REGISTRO_AI[v] ?? '';
  if (Array.isArray(v)) return v.join(', ');
  return v ?? '';
}

function abrirFoto(f) {
  const capa = el('div', { class: 'capa', onclick: () => capa.remove() },
    el('img', { src: urlDe(`foto-${f.id}`, f.blob), alt: '' }),
    f.fuente === 'inaturalist' ? el('p', { class: 'atribucion' }, `${f.autor} · ${f.licencia} · iNaturalist`) : null,
    f.fuente === 'presentacion' ? el('p', { class: 'atribucion' }, `${f.autor} · ${ATRIBUCION_PRESENTACION}`) : null);
  document.body.append(capa);
}

async function barraRecorrido(ctx, id) {
  const { filtro, orden } = memoria.estado();
  const todas = await ctx.db.especies.toArray();
  const conFoto = filtro.foto ? await especiesConFoto(ctx.db) : new Set();
  const ids = ordenar(filtrar(todas, filtro, { conFoto }), orden, filtro.sitio).map(x => x.id);
  const i = ids.indexOf(id);
  if (i < 0) return null;
  const ir = destino => () => {
    const { ancla } = memoria.estado();
    memoria.actualizar({ ancla: { id: destino, desfase: ancla?.desfase ?? 120 }, ultimaId: destino });
    ctx.reemplazando = true;
    location.replace(`#/ficha/${destino}`);
  };
  return el('nav', { class: 'recorrido', 'aria-label': 'Recorrer la lista' },
    el('button', { type: 'button', class: 'btn chico', disabled: i === 0, onclick: i > 0 ? ir(ids[i - 1]) : null }, '‹ Anterior'),
    el('span', {}, `${i + 1} de ${ids.length}`),
    el('button', { type: 'button', class: 'btn chico', disabled: i === ids.length - 1, onclick: i < ids.length - 1 ? ir(ids[i + 1]) : null }, 'Siguiente ›'));
}

export async function render(cont, ctx, id) {
  const { db, navegar } = ctx;
  const e = await obtenerEspecie(db, id);
  if (!e) { navegar('#/lista'); return; }
  const fotos = await fotosDe(db, id);
  const galeria = el('div', { class: 'galeria' },
    ...fotos.map(f => el('img', { src: urlDe(`foto-${f.id}`, f.blob), alt: '', onclick: () => abrirFoto(f) })));
  const vista = { ...e, grupo: grupoDe(e), formasVida: formasVida(e), hidrofila: esHidrofila(e) };
  const recorrido = await barraRecorrido(ctx, id);
  const campos = el('dl', { class: 'campos' }, ...CAMPOS.flatMap(([clave, titulo]) => {
    const v = valorTexto(clave, vista[clave]);
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
    recorrido,
    el('header', { class: tinte ? 'cabecera con-color' : 'cabecera', style: tinte ? `background: ${tinte}` : null },
      banda ? el('span', { class: 'banda', style: `background: ${banda}`, 'aria-hidden': 'true' }) : null,
      el('h1', {}, el('i', {}, e.nombre)), el('p', {}, e.familia || '')),
    fotos.length ? galeria : el('p', { class: 'estado' }, 'Sin fotos. Agrega una desde Editar.'),
    campos,
    e.diagnostico ? el('section', { class: 'diagnostico' }, el('h2', {}, 'Para reconocerla'), el('p', {}, e.diagnostico)) : null,
    e.notas ? el('section', {}, el('h2', {}, 'Notas'), el('p', { class: 'notas' }, e.notas)) : null,
    e.rasgosFuente ? el('section', {}, el('h2', {}, 'Fuentes de rasgos'),
      ...e.rasgosFuente.split('\n').map(u => u.trim()).filter(Boolean).map(url => el('p', { class: 'notas' }, el('a', { href: url, target: '_blank', rel: 'noopener' }, url)))) : null,
    el('div', { class: 'acciones' },
      el('a', { class: 'btn primario', href: `#/editar/${e.id}` }, 'Editar'),
      fotos.length ? el('a', { class: 'btn', href: `#/estudio?especie=${e.id}` }, 'Estudiar esta especie') : null,
      el('button', { type: 'button', class: 'btn', onclick: () => (ctx.desdeLista ? history.back() : navegar('#/lista')) }, 'Volver')),
  ].filter(Boolean));
}
