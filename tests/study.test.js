import { describe, it, expect } from 'vitest';
import {
  peso, candidatas, elegirPonderado, siguienteEspecie, registrarB,
  actualizarRecientes, barajar, rngSemilla, armarSesion, resumenSesion, tiposFalladosPorId,
} from '../study.js';

const esp = (id, extra = {}) => ({ id, nombre: id, familia: '', habito: '', sitios: ['STP'], aprendizaje: null, aciertos: 0, fallos: 0, rachaAciertos: 0, ...extra });

describe('pesos y selección', () => {
  it('peso según aprendizaje', () => {
    expect(peso(esp('a', { aprendizaje: 'no' }))).toBe(4);
    expect(peso(esp('a', { aprendizaje: 'falta' }))).toBe(3);
    expect(peso(esp('a'))).toBe(2);
    expect(peso(esp('a', { aprendizaje: 'se' }))).toBe(1);
  });

  it('candidatas exige foto y respeta el sitio', () => {
    const lista = [esp('a'), esp('b', { sitios: ['Las Tórtolas'] }), esp('c')];
    const conFoto = new Set(['a', 'b']);
    expect(candidatas(lista, conFoto, {}).map(e => e.id)).toEqual(['a', 'b']);
    expect(candidatas(lista, conFoto, { sitio: 'Las Tórtolas' }).map(e => e.id)).toEqual(['b']);
  });

  it('elegirPonderado recorre los pesos acumulados', () => {
    const items = [esp('a', { aprendizaje: 'se' }), esp('b', { aprendizaje: 'no' })]; // pesos 1 y 4
    expect(elegirPonderado(items, peso, () => 0.1).id).toBe('a');
    expect(elegirPonderado(items, peso, () => 0.3).id).toBe('b');
    expect(elegirPonderado(items, peso, () => 0.999).id).toBe('b');
  });

  it('siguienteEspecie excluye recientes solo con más de seis candidatas', () => {
    const muchas = 'abcdefgh'.split('').map(id => esp(id));
    const rng = rngSemilla(7);
    for (let i = 0; i < 50; i++) {
      expect(['a', 'b']).toContain(siguienteEspecie(muchas, ['c', 'd', 'e', 'f', 'g', 'h'], rng).id);
    }
    const pocas = 'abc'.split('').map(id => esp(id));
    expect(siguienteEspecie(pocas, ['a', 'b', 'c'], () => 0).id).toBe('a');
    expect(siguienteEspecie(muchas, 'abcdefgh'.split(''), () => 0).id).toBe('a'); // todas recientes: se usa la lista completa
  });

  it('barajar devuelve una permutación sin tocar el original', () => {
    const original = [1, 2, 3, 4, 5];
    const b = barajar(original, rngSemilla(2));
    expect(original).toEqual([1, 2, 3, 4, 5]);
    expect([...b].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('rngSemilla es determinista y está en [0,1)', () => {
    const a = rngSemilla(3);
    const b = rngSemilla(3);
    const xs = Array.from({ length: 5 }, () => a());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b()));
    expect(xs.every(x => x >= 0 && x < 1)).toBe(true);
  });
});

describe('registro de respuestas', () => {
  it('dos aciertos seguidos suben un nivel y reinician la racha', () => {
    let e = esp('a', { aprendizaje: 'no' });
    e = registrarB(e, true, 'T1');
    expect(e).toMatchObject({ aprendizaje: 'no', aciertos: 1, rachaAciertos: 1, ultimoEstudio: 'T1' });
    e = registrarB(e, true, 'T2');
    expect(e).toMatchObject({ aprendizaje: 'falta', aciertos: 2, rachaAciertos: 0 });
    e = registrarB(registrarB(e, true, 'T3'), true, 'T4');
    expect(e.aprendizaje).toBe('se');
    e = registrarB(registrarB(e, true, 'T5'), true, 'T6');
    expect(e.aprendizaje).toBe('se');
  });

  it('sin evaluar sube directo a "la sé" con dos aciertos', () => {
    const e = registrarB(registrarB(esp('a'), true, 'T'), true, 'T');
    expect(e.aprendizaje).toBe('se');
  });

  it('una falla baja un nivel y reinicia la racha', () => {
    let e = esp('a', { aprendizaje: 'se', rachaAciertos: 1 });
    e = registrarB(e, false, 'T');
    expect(e).toMatchObject({ aprendizaje: 'falta', fallos: 1, rachaAciertos: 0 });
    e = registrarB(e, false, 'T');
    expect(e.aprendizaje).toBe('no');
    e = registrarB(e, false, 'T');
    expect(e.aprendizaje).toBe('no');
    expect(registrarB(esp('b'), false, 'T').aprendizaje).toBe('no');
  });

  it('actualizarRecientes mantiene los últimos cinco sin repetir', () => {
    expect(actualizarRecientes(['a', 'b', 'c', 'd', 'e'], 'f')).toEqual(['b', 'c', 'd', 'e', 'f']);
    expect(actualizarRecientes(['a', 'b'], 'a')).toEqual(['b', 'a']);
    expect(actualizarRecientes([], 'a')).toEqual(['a']);
  });
});

describe('armarSesion', () => {
  const ocho = 'abcdefgh'.split('').map(id => esp(id));

  it('no repite ninguna especie y respeta la cantidad pedida', () => {
    const cola5 = armarSesion(ocho, { n: 5, rng: rngSemilla(1) });
    expect(cola5).toHaveLength(5);
    expect(new Set(cola5.map(e => e.id)).size).toBe(5);
    const cola20 = armarSesion(ocho, { n: 20, rng: rngSemilla(1) });
    expect(cola20).toHaveLength(8);
    expect(new Set(cola20.map(e => e.id)).size).toBe(8);
  });

  it('con estados solo entran las candidatas de esos valores de aprendizaje', () => {
    const variadas = [
      esp('a', { aprendizaje: 'no' }), esp('b', { aprendizaje: 'falta' }),
      esp('c', { aprendizaje: null }), esp('d', { aprendizaje: 'se' }),
    ];
    const cola = armarSesion(variadas, { n: 20, estados: ['no', 'sin'], rng: rngSemilla(2) });
    expect(cola.map(e => e.id).sort()).toEqual(['a', 'c']);
  });

  it('con rng determinista el orden es reproducible', () => {
    const cola1 = armarSesion(ocho, { n: 8, rng: rngSemilla(9) }).map(e => e.id);
    const cola2 = armarSesion(ocho, { n: 8, rng: rngSemilla(9) }).map(e => e.id);
    expect(cola1).toEqual(cola2);
  });

  it('las candidatas de mayor peso tienden a salir primero', () => {
    const pesadas = [
      esp('a', { aprendizaje: 'no' }), esp('b', { aprendizaje: 'no' }),
      esp('c', { aprendizaje: null }), esp('d', { aprendizaje: null }),
      esp('e', { aprendizaje: 'falta' }), esp('f', { aprendizaje: 'falta' }),
      esp('g', { aprendizaje: 'se' }), esp('h', { aprendizaje: 'se' }),
    ];
    let primerasPesadas = 0;
    for (let semilla = 0; semilla < 50; semilla++) {
      const primera = armarSesion(pesadas, { n: 8, rng: rngSemilla(semilla) })[0];
      if (['no', 'sin'].includes(primera.aprendizaje ?? 'sin')) primerasPesadas++;
    }
    expect(primerasPesadas).toBeGreaterThan(25);
  });
});

describe('resumenSesion', () => {
  it('cuenta aciertos, fallos y saltadas, y deduplica falladas', () => {
    const respuestas = [
      { id: 'a', resultado: 'se' }, { id: 'b', resultado: 'acierto' },
      { id: 'c', resultado: 'falta' }, { id: 'd', resultado: 'no' },
      { id: 'e', resultado: 'fallo' }, { id: 'e', resultado: 'fallo' },
      { id: 'f', resultado: 'saltada' },
    ];
    const r = resumenSesion(respuestas);
    expect(r.aciertos).toBe(2);
    expect(r.fallos).toBe(4);
    expect(r.saltadas).toBe(1);
    expect(r.falladas).toEqual(['c', 'd', 'e']);
  });

  it('con lista vacía devuelve todo en cero', () => {
    expect(resumenSesion([])).toEqual({ aciertos: 0, fallos: 0, saltadas: 0, falladas: [], correctas: 0, preguntas: 0 });
  });
});

describe('candidatas con filtro y rondas', () => {
  it('candidatas aplica el filtro de la lista y exige foto', () => {
    const es = [
      { id: '1', nombre: 'A', familia: 'Poaceae', sitios: ['STP'] },
      { id: '2', nombre: 'B', familia: 'Poaceae', sitios: [] },
      { id: '3', nombre: 'C', familia: 'Asteraceae', sitios: ['STP'] },
    ];
    const conFoto = new Set(['1', '2', '3']);
    expect(candidatas(es, conFoto, { familia: 'Poaceae' }).map(e => e.id)).toEqual(['1', '2']);
    expect(candidatas(es, new Set(['1']), { familia: 'Poaceae' }).map(e => e.id)).toEqual(['1']);
    expect(candidatas(es, conFoto, { sitio: 'STP' }).map(e => e.id)).toEqual(['1', '3']);
  });
  it('resumenSesion cuenta rondas perfectas, parciales y preguntas', () => {
    const r = resumenSesion([
      { id: 'a', resultado: 'perfecta', correctas: 3, preguntas: 3 },
      { id: 'b', resultado: 'parcial', correctas: 2, preguntas: 3 },
      { id: 'c', resultado: 'fallo', correctas: 0, preguntas: 2 },
    ]);
    expect(r.aciertos).toBe(1);
    expect(r.fallos).toBe(2);
    expect(r.falladas).toEqual(['b', 'c']);
    expect(r.correctas).toBe(5);
    expect(r.preguntas).toBe(8);
  });
});

describe('tiposFalladosPorId', () => {
  it('reúne los tipos fallados por especie y omite perfectas y saltadas', () => {
    const m = tiposFalladosPorId([
      { id: 'a', resultado: 'perfecta', fallados: [] },
      { id: 'b', resultado: 'parcial', fallados: ['familia'] },
      { id: 'c', resultado: 'fallo', fallados: ['nombre', 'habito'] },
      { id: 'b', resultado: 'parcial', fallados: ['familia', 'origen'] },
      { id: 'd', resultado: 'saltada' },
    ]);
    expect([...m.keys()]).toEqual(['b', 'c']);
    expect(m.get('b')).toEqual(['familia', 'origen']);
    expect(m.get('c')).toEqual(['nombre', 'habito']);
  });
});
