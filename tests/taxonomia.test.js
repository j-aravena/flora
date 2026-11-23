import { describe, it, expect } from 'vitest';
import { GRUPOS, FORMAS_VIDA, grupoDe, formasVida, esHidrofila, siglaCategoria, nivelCategoria } from '../taxonomia.js';
import { nuevaEspecie, CATEGORIAS, HABITOS, SITIOS } from '../db.js';

describe('taxonomía', () => {
  it('grupoDe clasifica por familia', () => {
    expect(grupoDe({ familia: 'Hymenophyllaceae' })).toBe('Helechos y licófitas');
    expect(grupoDe({ familia: 'Equisetaceae' })).toBe('Helechos y licófitas');
    expect(grupoDe({ familia: 'Podocarpaceae' })).toBe('Gimnospermas');
    expect(grupoDe({ familia: 'Ephedraceae' })).toBe('Gimnospermas');
    expect(grupoDe({ familia: 'Cyperaceae' })).toBe('Monocotiledóneas');
    expect(grupoDe({ familia: 'Luzuriagaceae' })).toBe('Monocotiledóneas');
    expect(grupoDe({ familia: 'Myrtaceae' })).toBe('Dicotiledóneas');
    expect(grupoDe({ familia: '' })).toBe('');
    expect(GRUPOS).toHaveLength(4);
  });

  it('formasVida lee el hábito detallado sin tildes', () => {
    expect(formasVida({ habitoDetalle: 'Arbusto trepador' })).toEqual(['Trepadora']);
    expect(formasVida({ habitoDetalle: 'Hierba trepadora' })).toEqual(['Trepadora']);
    expect(formasVida({ habitoDetalle: 'Arbusto parasito' })).toEqual(['Parásita']);
    expect(formasVida({ habitoDetalle: 'Arbusto epífito' })).toEqual(['Epífita']);
    expect(formasVida({ habitoDetalle: 'Arbusto rastrero' })).toEqual(['Rastrera']);
    expect(formasVida({})).toEqual([]);
    expect(FORMAS_VIDA).toEqual(['Trepadora', 'Rastrera', 'Epífita', 'Parásita']);
  });

  it('esHidrofila usa el campo o la nota de Nevado', () => {
    expect(esHidrofila({ hidrofila: true })).toBe(true);
    expect(esHidrofila({ notas: 'Especie hidrófila: vega' })).toBe(true);
    expect(esHidrofila({ notas: '' })).toBe(false);
  });

  it('siglas y niveles de categoría', () => {
    expect(siglaCategoria('Preocupación Menor')).toBe('LC');
    expect(siglaCategoria('En peligro crítico')).toBe('CR');
    expect(siglaCategoria('')).toBe('');
    expect(nivelCategoria('Vulnerable')).toBe('amenazada');
    expect(nivelCategoria('Casi amenazada')).toBe('casi');
    expect(nivelCategoria('Rara')).toBe('otra');
    expect(nivelCategoria('')).toBe('');
  });

  it('constantes y valores por defecto nuevos', () => {
    expect(SITIOS).toContain('Chacao Chonchi');
    expect(HABITOS).toContain('Subarbusto');
    expect(CATEGORIAS).toEqual(['Preocupación Menor', 'Casi amenazada', 'Vulnerable', 'En peligro', 'En peligro crítico', 'Datos insuficientes', 'Rara']);
    expect(nuevaEspecie()).toMatchObject({ registroAI: '', hidrofila: false, diagnostico: '', ordenListado: {} });
  });
});
