import { obtenerEspecie, fotosDe, especiesConFoto, COLORES_FLOR } from '../db.js';
import { filtrar, ordenar } from '../filtros.js';
import { grupoDe, formasVida, esHidrofila } from '../taxonomia.js';
import { memoria } from './memoria.js';
import { el, urlDe, etiquetaAprendizaje } from './dom.js';
import { icono } from './iconos.js';
import { leyendaColor } from './lista.js';
import { barraSuperior, volverA } from './volver.js';
import { siglaCategoria, nivelCategoria } from '../taxonomia.js';

const CAMPOS = [
  ['nivel', 'Nivel'], ['grupo', 'Grupo'], ['origen', 'Origen'], ['habito', 'Hábito'], ['habitoDetalle', 'Hábito detallado'],
  ['formasVida', 'Forma de vida'], ['ciclo', 'Ciclo de vida'], ['categoriaMMA', 'Conservación (MMA)'],
  ['decreto', 'Decreto'], ['ds68', 'D.S. 68/2009'], ['hidrofila', 'Hidrófila o de humedal'], ['registroAI', 'Registrada antes en el AI'],
  ['distribucion', 'Distribución'], ['rangoAltitudinal', 'Rango altitudinal'],
  ['colorFlor', 'Color de flor'], ['petalos', 'Pétalos'], ['petalosNota', 'Pétalos según clave'],
  ['sitios', 'Sitios'], ['aprendizaje', 'Aprendizaje'],
];

const REGISTRO_AI = { si: 'Sí', no: 'No', duda: 'Por confirmar' };
const ATRIBUCION_PRESENTACION = 'Presentación Chacao Chonchi';

// Marca ⓘ junto a un dato completado desde una fuente externa: al tocarla muestra de dónde salió.
function marcaCompletado(e, clave, notaAfuera = false) {
  const fuente = e.completado?.[clave];
  if (!fuente) return null;
  const [nombre, url] = fuente.split(' — ');
  let nota = null;
  const boton = el('button', {
    type: 'button', class: 'marca-completado', title: 'Completado desde ' + nombre, 'aria-label': 'Completado desde ' + nombre, 'aria-expanded': 'false',
    onclick: () => {
      if (nota) { nota.remove(); nota = null; boton.setAttribute('aria-expanded', 'false'); return; }
      nota = el('p', { class: 'fuente-completado' }, 'Completado desde ',
        url ? el('a', { href: url, target: '_blank', rel: 'noopener' }, nombre) : nombre);
      if (notaAfuera) boton.parentNode.after(nota); else boton.parentNode.append(nota);
      boton.setAttribute('aria-expanded', 'true');
    },
  }, icono('info', { tam: 16 }));
  return boton;
}

// Las mismas cápsulas de la lista: conservación, hidrófila y registro en el AI.
function insigniasFicha(e) {
  const sigla = siglaCategoria(e.categoriaMMA);
  const lista = [
    sigla ? el('span', { class: `insignia cat-${nivelCategoria(e.categoriaMMA)}`, title: e.categoriaMMA }, sigla) : null,
    esHidrofila(e) ? el('span', { class: 'insignia hidrofila' }, 'Hidrófila') : null,
    e.registroAI === 'si' ? el('span', { class: 'insignia ai', title: 'Registrada antes en el AI' }, 'AI') : null,
    e.registroAI === 'duda' ? el('span', { class: 'insignia ai duda', title: 'Registro en el AI por confirmar' }, 'AI?') : null,
  ].filter(Boolean);
  return lista.length ? el('p', { class: 'insignias' }, ...lista) : null;
}

function valorTexto(clave, v) {
  if (clave === 'ds68') return v ? 'Sí' : '';
  if (clave === 'nivel') return v === 'especie' ? '' : v === 'genero' ? 'Género' : 'Familia';
  if (clave === 'aprendizaje') return v && v !== 'sin' ? etiquetaAprendizaje(v) : '';
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
  if (i < 0) return { pasos: null };
  const ir = destino => () => {
    const { ancla } = memoria.estado();
    memoria.actualizar({ ancla: { id: destino, desfase: ancla?.desfase ?? 120 }, ultimaId: destino });
    ctx.reemplazando = true;
    location.replace(`#/ficha/${destino}`);
  };
  return { pasos: el('div', { class: 'pasos' },
    el('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Especie anterior', disabled: i === 0, onclick: i > 0 ? ir(ids[i - 1]) : null }, icono('atras')),
    el('span', {}, `${i + 1} de ${ids.length}`),
    el('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Especie siguiente', disabled: i === ids.length - 1, onclick: i < ids.length - 1 ? ir(ids[i + 1]) : null }, icono('adelante'))) };
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
    if (clave === 'colorFlor') {
      const leyenda = leyendaColor(e.colorFlor);
      return leyenda ? [el('div', {}, el('dt', {}, titulo), el('dd', {}, leyenda, marcaCompletado(e, clave)))] : [];
    }
    const v = valorTexto(clave, vista[clave]);
    if (!v) return [];
    return [el('div', {}, el('dt', {}, titulo), el('dd', {}, v, marcaCompletado(e, clave)))];
  }));
  cont.append(...[
    barraSuperior({ alVolver: () => volverA(ctx, '#/lista'), derecha: recorrido.pasos }),
    fotos.length ? galeria : el('p', { class: 'estado' }, 'Sin fotos. Agrega una desde Editar.'),
    el('header', { class: 'cabecera-ficha' },
      el('h1', {}, el('i', {}, e.nombre)), el('p', { class: 'familia' }, e.familia || '', marcaCompletado(e, 'familia', true)),
      insigniasFicha(e)),
    e.diagnostico ? el('section', { class: 'diagnostico' }, el('h2', {}, 'Para reconocerla'), el('p', {}, e.diagnostico, marcaCompletado(e, 'diagnostico', true))) : null,
    campos.childElementCount ? campos : null,
    e.notas ? el('section', { class: 'bloque' }, el('h2', {}, 'Notas'), el('p', { class: 'notas' }, e.notas)) : null,
    e.rasgosFuente ? el('section', { class: 'bloque' }, el('h2', {}, 'Fuentes'),
      ...e.rasgosFuente.split('\n').map(u => u.trim()).filter(Boolean).map(url => el('p', { class: 'fuente' }, el('a', { href: url, target: '_blank', rel: 'noopener' }, url)))) : null,
    el('div', { class: 'acciones' },
      fotos.length ? el('a', { class: 'btn primario', href: `#/estudio?especie=${e.id}` }, 'Estudiar') : null,
      el('a', { class: 'btn', href: `#/editar/${e.id}` }, icono('editar', { tam: 18 }), 'Editar')),
  ].filter(Boolean));
}
