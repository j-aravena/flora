import { describe, it, expect } from 'vitest';
import { TIPOS, tiposDisponibles, alternativas, ponderarTipos, armarRonda, calificarRonda, resultadoRonda } from '../quiz.js';
import { rngSemilla } from '../study.js';

const esp = (id, nombre, extra = {}) => ({ id, nombre, familia: '', habito: '', origen: '', categoriaMMA: '', diagnostico: '', aprendizaje: null, aciertos: 0, fallos: 0, rachaAciertos: 0, ...extra });
const TODAS = [
  esp('a', 'Greigia sphacelata', { familia: 'Bromeliaceae', habito: 'Hierba perenne', origen: 'Endémica', categoriaMMA: 'Vulnerable', diagnostico: 'Roseta espinosa con brácteas rojas.' }),
  esp('b', 'Greigia landbeckii', { familia: 'Bromeliaceae', habito: 'Hierba perenne', diagnostico: 'Hojas más angostas y flores rosadas.' }),
  esp('c', 'Fascicularia bicolor', { familia: 'Bromeliaceae', habito: 'Hierba perenne', diagnostico: 'Epífita con centro rojo.' }),
  esp('d', 'Ochagavia carnea', { familia: 'Bromeliaceae', habito: 'Hierba perenne' }),
  esp('e', 'Carex erinacea', { familia: 'Cyperaceae', habito: 'Hierba perenne', diagnostico: 'Espigas erizadas.' }),
  esp('f', 'Nothofagus dombeyi', { familia: 'Nothofagaceae', habito: 'Árbol', diagnostico: 'Hojas aserradas perennes.' }),
  esp('g', 'Drimys winteri', { familia: 'Winteraceae', habito: 'Árbol' }),
  esp('h', 'Blechnum chilense', { familia: 'Blechnaceae', habito: 'Hierba perenne' }),
];

describe('tiposDisponibles', () => {
  it('lista solo los tipos con dato, sin el nombre', () => {
    expect(tiposDisponibles(TODAS[0]).sort()).toEqual(['categoria', 'diagnostico', 'familia', 'habito', 'origen']);
    expect(tiposDisponibles(TODAS[6]).sort()).toEqual(['familia', 'habito']);
    expect(tiposDisponibles(esp('x', 'Algo'))).toEqual([]);
  });
});

describe('alternativas', () => {
  const rng = rngSemilla(7);
  it.each(['nombre', 'familia', 'categoria', 'diagnostico', 'habito'])('%s: 4 únicas e incluye la correcta', tipo => {
    const a = alternativas(tipo, TODAS[0], TODAS, rng);
    expect(a).toHaveLength(4);
    expect(new Set(a).size).toBe(4);
    const correcta = { nombre: 'Greigia sphacelata', familia: 'Bromeliaceae', categoria: 'Vulnerable', diagnostico: 'Roseta espinosa con brácteas rojas.', habito: 'Hierba perenne' }[tipo];
    expect(a).toContain(correcta);
  });
  it('origen ofrece las 3 opciones', () => {
    expect(alternativas('origen', TODAS[0], TODAS, rng).sort()).toEqual(['Endémica', 'Introducida', 'Nativa']);
  });
  it('nombre prefiere el mismo género y luego la misma familia', () => {
    const a = alternativas('nombre', TODAS[0], TODAS, rngSemilla(1));
    expect(a).toContain('Greigia landbeckii');
    expect(a.filter(n => ['Fascicularia bicolor', 'Ochagavia carnea'].includes(n))).toHaveLength(2);
  });
  it('diagnostico prefiere rasgos de la misma familia', () => {
    const a = alternativas('diagnostico', TODAS[0], TODAS, rngSemilla(3));
    expect(a).toContain('Hojas más angostas y flores rosadas.');
    expect(a).toContain('Epífita con centro rojo.');
  });
  it('categoria no ofrece Rara ni Datos insuficientes como distractor', () => {
    for (let s = 1; s < 20; s++) {
      const a = alternativas('categoria', TODAS[0], TODAS, rngSemilla(s));
      expect(a).not.toContain('Rara');
      expect(a).not.toContain('Datos insuficientes');
    }
  });
});

describe('ponderarTipos', () => {
  it('devuelve todos los disponibles sin repetir, favoreciendo los fallados', () => {
    const e = { ...TODAS[0], fallosPorTipo: { origen: 50 } };
    let primeroOrigen = 0;
    for (let s = 1; s <= 50; s++) {
      const orden = ponderarTipos(e, tiposDisponibles(e), rngSemilla(s));
      expect(new Set(orden).size).toBe(5);
      if (orden[0] === 'origen') primeroOrigen++;
    }
    expect(primeroOrigen).toBeGreaterThan(35);
  });
});

describe('armarRonda', () => {
  it('empieza por el nombre y agrega 2 tipos distintos con al menos 3 alternativas', () => {
    const r = armarRonda(TODAS[0], TODAS, rngSemilla(5));
    expect(r).toHaveLength(3);
    expect(r[0].tipo).toBe('nombre');
    expect(r[0].enunciado).toBe(TIPOS.nombre);
    expect(new Set(r.map(p => p.tipo)).size).toBe(3);
    for (const p of r) {
      expect(p.alternativas.length).toBeGreaterThanOrEqual(3);
      expect(p.alternativas).toContain(p.correcta);
    }
  });
  it('sin datos extra la ronda es solo el nombre', () => {
    expect(armarRonda(esp('x', 'Algo rara'), TODAS, rngSemilla(2)).map(p => p.tipo)).toEqual(['nombre']);
  });
});

describe('calificarRonda y resultadoRonda', () => {
  const f = '2026-11-23T10:00:00.000Z';
  it('todas correctas cuenta como acierto', () => {
    const r = [{ tipo: 'nombre', acierto: true }, { tipo: 'familia', acierto: true }];
    const e = calificarRonda(TODAS[0], r, f);
    expect(e.aciertos).toBe(1);
    expect(e.rachaAciertos).toBe(1);
    expect(resultadoRonda(r)).toBe('perfecta');
  });
  it('nombre incorrecto cuenta como fallo y suma fallosPorTipo', () => {
    const r = [{ tipo: 'nombre', acierto: false }, { tipo: 'origen', acierto: false }];
    const e = calificarRonda({ ...TODAS[0], aprendizaje: 'se' }, r, f);
    expect(e.fallos).toBe(1);
    expect(e.aprendizaje).toBe('falta');
    expect(e.fallosPorTipo).toEqual({ nombre: 1, origen: 1 });
    expect(resultadoRonda(r)).toBe('fallo');
  });
  it('nombre correcto con otro error: sin cambio de nivel y racha a 0', () => {
    const r = [{ tipo: 'nombre', acierto: true }, { tipo: 'familia', acierto: false }];
    const e = calificarRonda({ ...TODAS[0], aprendizaje: 'falta', rachaAciertos: 1 }, r, f);
    expect(e.aprendizaje).toBe('falta');
    expect(e.rachaAciertos).toBe(0);
    expect(e.aciertos).toBe(0);
    expect(e.fallos).toBe(0);
    expect(e.ultimoEstudio).toBe(f);
    expect(e.fallosPorTipo).toEqual({ familia: 1 });
    expect(resultadoRonda(r)).toBe('parcial');
  });
});
