// Cuestionario por rondas (spec 1.5 §4.3). Funciones puras; el generador aleatorio se inyecta.
import { registrarB, barajar, elegirPonderado } from './study.js';
import { CATEGORIAS, ORIGENES, HABITOS } from './db.js';
import { grupoDe } from './taxonomia.js';

export const TIPOS = {
  nombre: '¿Qué especie es?',
  familia: '¿De qué familia es?',
  categoria: '¿En qué categoría de conservación está?',
  origen: '¿Cuál es su origen?',
  diagnostico: '¿Cuál es su rasgo para reconocerla?',
  habito: '¿Cuál es su hábito?',
};
export const CAMPO_DE_TIPO = { nombre: 'nombre', familia: 'familia', categoria: 'categoriaMMA', origen: 'origen', diagnostico: 'diagnostico', habito: 'habito' };
const EXTRAS = ['familia', 'categoria', 'origen', 'diagnostico', 'habito'];
const OPCIONES = 4;
const MINIMO = 3;
const HABITOS_VECINOS = {
  'Hierba anual': ['Hierba perenne'], 'Hierba perenne': ['Hierba anual', 'Subarbusto'],
  Subarbusto: ['Arbusto', 'Hierba perenne'], Arbusto: ['Subarbusto', 'Árbol'], 'Árbol': ['Arbusto'],
  Suculenta: ['Subarbusto', 'Hierba perenne'],
};

const genero = nombre => String(nombre ?? '').trim().split(/\s+/)[0];
const valor = (tipo, e) => e[CAMPO_DE_TIPO[tipo]];

export function tiposDisponibles(e) {
  return EXTRAS.filter(t => Boolean(valor(t, e)));
}

// Hasta n valores únicos y distintos de la correcta, recorriendo los grupos en orden de preferencia.
function tomar(grupos, correcta, n, rng) {
  const vistos = new Set([correcta]);
  const salida = [];
  for (const grupo of grupos) {
    for (const v of barajar(grupo, rng)) {
      if (salida.length >= n) return salida;
      if (v && !vistos.has(v)) { vistos.add(v); salida.push(v); }
    }
  }
  return salida;
}

function gruposDistractores(tipo, e, otras) {
  const deCampo = lista => lista.map(x => valor(tipo, x));
  switch (tipo) {
    case 'nombre':
      return [
        otras.filter(x => genero(x.nombre) === genero(e.nombre)),
        otras.filter(x => e.familia && x.familia === e.familia),
        otras.filter(x => e.habito && x.habito === e.habito),
        otras,
      ].map(deCampo);
    case 'familia':
      return [deCampo(otras.filter(x => grupoDe(x) === grupoDe(e))), deCampo(otras)];
    case 'categoria':
      return [CATEGORIAS.filter(c => c !== 'Rara' && c !== 'Datos insuficientes'), CATEGORIAS];
    case 'origen':
      return [ORIGENES];
    case 'diagnostico':
      return [
        otras.filter(x => e.familia && x.familia === e.familia),
        otras.filter(x => grupoDe(x) === grupoDe(e)),
        otras,
      ].map(deCampo);
    case 'habito':
      return [HABITOS_VECINOS[e.habito] ?? [], HABITOS];
    default:
      throw new Error(`Tipo de pregunta desconocido: ${tipo}`);
  }
}

export function alternativas(tipo, e, todas, rng) {
  const correcta = valor(tipo, e);
  const otras = todas.filter(x => x.id !== e.id);
  return barajar([correcta, ...tomar(gruposDistractores(tipo, e, otras), correcta, OPCIONES - 1, rng)], rng);
}

// Orden de los tipos disponibles: sorteo sin reposición con peso 1 + fallos previos de ese tipo.
export function ponderarTipos(e, disponibles, rng) {
  const fallos = e.fallosPorTipo ?? {};
  const restantes = disponibles.slice();
  const orden = [];
  while (restantes.length) {
    const t = elegirPonderado(restantes, x => 1 + (fallos[x] ?? 0), rng);
    orden.push(t);
    restantes.splice(restantes.indexOf(t), 1);
  }
  return orden;
}

const pregunta = (tipo, e, alts) => ({ tipo, enunciado: TIPOS[tipo], correcta: valor(tipo, e), alternativas: alts });

// Ronda: siempre el nombre y luego hasta maxExtra tipos con al menos 3 alternativas.
export function armarRonda(e, todas, rng, maxExtra = 2) {
  const ronda = [pregunta('nombre', e, alternativas('nombre', e, todas, rng))];
  for (const tipo of ponderarTipos(e, tiposDisponibles(e), rng)) {
    if (ronda.length > maxExtra) break;
    const alts = alternativas(tipo, e, todas, rng);
    if (alts.length >= MINIMO) ronda.push(pregunta(tipo, e, alts));
  }
  return ronda;
}

export function resultadoRonda(resultados) {
  if (resultados.every(r => r.acierto)) return 'perfecta';
  return resultados.find(r => r.tipo === 'nombre')?.acierto === false ? 'fallo' : 'parcial';
}

export function calificarRonda(e, resultados, fecha) {
  const fallosPorTipo = { ...(e.fallosPorTipo ?? {}) };
  for (const r of resultados) if (!r.acierto) fallosPorTipo[r.tipo] = (fallosPorTipo[r.tipo] ?? 0) + 1;
  const resultado = resultadoRonda(resultados);
  const base = resultado === 'parcial'
    ? { ...e, rachaAciertos: 0, ultimoEstudio: fecha, modificadoEn: fecha }
    : registrarB(e, resultado === 'perfecta', fecha);
  return { ...base, fallosPorTipo };
}
