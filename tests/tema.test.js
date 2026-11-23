import { describe, it, expect } from 'vitest';
import { TEMAS, CLAVE_TEMA, leerTema, guardarTema, temaEfectivo } from '../tema.js';

function almacen(inicial = {}) {
  const d = { ...inicial };
  return { getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, d };
}

describe('tema', () => {
  it('TEMAS ofrece auto, claro y oscuro con etiquetas', () => {
    expect(TEMAS.map(([v]) => v)).toEqual(['auto', 'claro', 'oscuro']);
  });
  it('leerTema devuelve auto sin dato, con dato inválido o si el almacén falla', () => {
    expect(leerTema(almacen())).toBe('auto');
    expect(leerTema(almacen({ [CLAVE_TEMA]: 'rosa' }))).toBe('auto');
    expect(leerTema({ getItem: () => { throw new Error('bloqueado'); } })).toBe('auto');
    expect(leerTema(almacen({ [CLAVE_TEMA]: 'oscuro' }))).toBe('oscuro');
  });
  it('guardarTema guarda valores válidos y no lanza si el almacén falla', () => {
    const a = almacen();
    guardarTema(a, 'claro');
    expect(a.d[CLAVE_TEMA]).toBe('claro');
    expect(() => guardarTema(a, 'rosa')).toThrow();
    expect(() => guardarTema({ setItem: () => { throw new Error('x'); } }, 'claro')).not.toThrow();
  });
  it('temaEfectivo resuelve auto con la preferencia del sistema', () => {
    expect(temaEfectivo('auto', true)).toBe('oscuro');
    expect(temaEfectivo('auto', false)).toBe('claro');
    expect(temaEfectivo('claro', true)).toBe('claro');
    expect(temaEfectivo('oscuro', false)).toBe('oscuro');
  });
});
