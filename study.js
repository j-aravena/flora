// Reglas del modo estudio (sección 7 de la especificación). Funciones puras; el generador aleatorio se inyecta.

const PESOS = { no: 4, falta: 3, sin: 2, se: 1 };
const SUBE = { no: 'falta', falta: 'se', sin: 'se', se: 'se' };
const BAJA = { se: 'falta', falta: 'no', sin: 'no', no: 'no' };
const MAX_RECIENTES = 5;
const MINIMO_PARA_EXCLUIR = 6;

export function peso(especie) {
  return PESOS[especie.aprendizaje ?? 'sin'];
}

export function candidatas(especies, conFoto, sitio = '') {
  return especies.filter(e => conFoto.has(e.id) && (!sitio || e.sitios.includes(sitio)));
}

export function elegirPonderado(items, pesoDe, rng) {
  const total = items.reduce((s, it) => s + pesoDe(it), 0);
  let r = rng() * total;
  for (const it of items) {
    r -= pesoDe(it);
    if (r < 0) return it;
  }
  return items[items.length - 1];
}

export function siguienteEspecie(cands, recientes, rng) {
  const sinRecientes = cands.length > MINIMO_PARA_EXCLUIR ? cands.filter(e => !recientes.includes(e.id)) : cands;
  return elegirPonderado(sinRecientes.length ? sinRecientes : cands, peso, rng);
}

export function barajar(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function distractores(cands, correcta, n, rng) {
  const otras = cands.filter(e => e.id !== correcta.id);
  const mismaFamilia = otras.filter(e => e.familia && e.familia === correcta.familia);
  const mismoHabito = otras.filter(e => !mismaFamilia.includes(e) && e.habito && e.habito === correcta.habito);
  const resto = otras.filter(e => !mismaFamilia.includes(e) && !mismoHabito.includes(e));
  const elegidas = [];
  for (const grupo of [mismaFamilia, mismoHabito, resto]) {
    for (const e of barajar(grupo, rng)) {
      if (elegidas.length < n) elegidas.push(e);
    }
  }
  return elegidas;
}

export function calificarA(especie, valor, fecha) {
  return { ...especie, aprendizaje: valor, ultimoEstudio: fecha, modificadoEn: fecha };
}

export function registrarB(especie, acierto, fecha) {
  const nivel = especie.aprendizaje ?? 'sin';
  if (acierto) {
    const racha = (especie.rachaAciertos ?? 0) + 1;
    const sube = racha >= 2;
    return {
      ...especie,
      aciertos: (especie.aciertos ?? 0) + 1,
      rachaAciertos: sube ? 0 : racha,
      aprendizaje: sube ? SUBE[nivel] : especie.aprendizaje,
      ultimoEstudio: fecha, modificadoEn: fecha,
    };
  }
  return {
    ...especie,
    fallos: (especie.fallos ?? 0) + 1,
    rachaAciertos: 0,
    aprendizaje: BAJA[nivel],
    ultimoEstudio: fecha, modificadoEn: fecha,
  };
}

export function actualizarRecientes(recientes, id, max = MAX_RECIENTES) {
  return [...recientes.filter(x => x !== id), id].slice(-max);
}

// Cola de la sesión: sorteo ponderado SIN reposición (no se repite ninguna especie), hasta n.
// estados: null (todas) o lista de valores de aprendizaje; 'sin' representa null.
export function armarSesion(cands, { n = 20, estados = null, rng = Math.random } = {}) {
  const filtradas = estados ? cands.filter(e => estados.includes(e.aprendizaje ?? 'sin')) : cands.slice();
  const restantes = filtradas.slice();
  const cola = [];
  while (restantes.length && cola.length < n) {
    const elegida = elegirPonderado(restantes, peso, rng);
    cola.push(elegida);
    restantes.splice(restantes.indexOf(elegida), 1);
  }
  return cola;
}

// respuestas: lista de { id, resultado } con resultado en 'se' | 'falta' | 'no' | 'acierto' | 'fallo' | 'saltada'.
export function resumenSesion(respuestas) {
  const cuenta = { aciertos: 0, fallos: 0, saltadas: 0, falladas: [] };
  for (const r of respuestas) {
    if (r.resultado === 'se' || r.resultado === 'acierto') cuenta.aciertos++;
    else if (r.resultado === 'saltada') cuenta.saltadas++;
    else { cuenta.fallos++; cuenta.falladas.push(r.id); }
  }
  cuenta.falladas = [...new Set(cuenta.falladas)];
  return cuenta;
}

// mulberry32: generador pequeño y determinista para pruebas.
export function rngSemilla(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
