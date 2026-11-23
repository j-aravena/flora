// filtros.js
// Filtrado, conteo por valor y orden de la lista. Funciones puras: no tocan la base ni el DOM.
import { grupoDe, formasVida, esHidrofila } from './taxonomia.js';

const plano = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

export const FILTRO_VACIO = {
  texto: '', grupo: '', familia: '', habito: '', formaVida: '', colorFlor: '', petalos: '',
  categoria: '', origen: '', hidrofila: '', registroAI: '', sitio: '', aprendizaje: '', foto: '',
};

export const ORDENES = [['nombre', 'A–Z'], ['familia', 'Por familia'], ['listado', 'Como en la presentación'], ['aprendizaje', 'Me falta primero']];

const PRUEBAS = {
  texto: (e, v) => [e.nombre, e.familia, e.diagnostico].some(c => plano(c).includes(plano(v))),
  grupo: (e, v) => grupoDe(e) === v,
  familia: (e, v) => (e.familia ?? '') === v,
  habito: (e, v) => e.habito === v,
  formaVida: (e, v) => formasVida(e).includes(v),
  colorFlor: (e, v) => (e.colorFlor ?? []).includes(v),
  petalos: (e, v) => e.petalos === v,
  categoria: (e, v) => (v === 'alguna' ? Boolean(e.categoriaMMA) : e.categoriaMMA === v),
  origen: (e, v) => e.origen === v,
  hidrofila: (e, v) => (v === 'si' ? esHidrofila(e) : true),
  registroAI: (e, v) => (e.registroAI ?? '') === v,
  sitio: (e, v) => (e.sitios ?? []).includes(v),
  aprendizaje: (e, v) => (v === 'sin' ? e.aprendizaje == null : e.aprendizaje === v),
  foto: (e, v, ctx) => (v === 'con' ? ctx.conFoto.has(e.id) : !ctx.conFoto.has(e.id)),
};

export function cumple(e, filtro, ctx = { conFoto: new Set() }, excepto = null) {
  for (const [clave, prueba] of Object.entries(PRUEBAS)) {
    const v = filtro[clave];
    if (!v || clave === excepto) continue;
    if (!prueba(e, v, ctx)) return false;
  }
  return true;
}

export function filtrar(especies, filtro, ctx = { conFoto: new Set() }) {
  return especies.filter(e => cumple(e, filtro, ctx));
}

export function conteos(especies, filtro, clave, valores, ctx = { conFoto: new Set() }) {
  const base = especies.filter(e => cumple(e, filtro, ctx, clave));
  return new Map(valores.map(v => [v, base.filter(e => PRUEBAS[clave](e, v, ctx)).length]));
}

export function hayOrdenListado(especies, sitio) {
  return Boolean(sitio) && especies.some(e => e.ordenListado?.[sitio] != null);
}

const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
const RANGO_APRENDIZAJE = { no: 0, falta: 1, sin: 2, se: 3 };

export function ordenar(especies, orden = 'nombre', sitio = '') {
  const lista = [...especies];
  if (orden === 'familia') {
    return lista.sort((a, b) => Number(!a.familia) - Number(!b.familia)
      || (a.familia ?? '').localeCompare(b.familia ?? '', 'es') || porNombre(a, b));
  }
  if (orden === 'listado' && hayOrdenListado(especies, sitio)) {
    const pos = e => e.ordenListado?.[sitio] ?? Number.MAX_SAFE_INTEGER;
    return lista.sort((a, b) => pos(a) - pos(b) || porNombre(a, b));
  }
  if (orden === 'aprendizaje') {
    const rango = e => RANGO_APRENDIZAJE[e.aprendizaje ?? 'sin'];
    return lista.sort((a, b) => rango(a) - rango(b) || porNombre(a, b));
  }
  return lista.sort(porNombre);
}

export function filtrosActivos(filtro) {
  return Object.keys(FILTRO_VACIO).filter(c => c !== 'texto' && filtro[c]).map(clave => ({ clave, valor: filtro[clave] }));
}
