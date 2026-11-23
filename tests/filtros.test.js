import { describe, it, expect } from 'vitest';
import { FILTRO_VACIO, cumple, filtrar, conteos, ordenar, hayOrdenListado, filtrosActivos } from '../filtros.js';
import { crearDb, nuevaEspecie, guardarEspecie, agregarFoto, listarEspecies } from '../db.js';

const e = (nombre, datos = {}) => nuevaEspecie({ nombre, ...datos });
const especies = [
  e('Hymenophyllum dentatum', { familia: 'Hymenophyllaceae', habito: 'Hierba perenne', categoriaMMA: 'Preocupación Menor', sitios: ['Chacao Chonchi'], registroAI: 'si', ordenListado: { 'Chacao Chonchi': 3 }, diagnostico: 'Frondes con pelos' }),
  e('Luzuriaga radicans', { familia: 'Luzuriagaceae', habito: 'Arbusto', habitoDetalle: 'Arbusto trepador', sitios: ['Chacao Chonchi'], registroAI: 'duda', ordenListado: { 'Chacao Chonchi': 1 }, aprendizaje: 'falta' }),
  e('Luma chequen', { familia: 'Myrtaceae', habito: 'Árbol', hidrofila: true, categoriaMMA: 'Vulnerable', sitios: ['Chacao Chonchi'], registroAI: 'no', ordenListado: { 'Chacao Chonchi': 2 }, aprendizaje: 'no' }),
  e('Adesmia confusa', { familia: 'Fabaceae', habito: 'Arbusto', sitios: ['STP'], notas: 'Especie hidrófila', aprendizaje: 'se' }),
  e('Zea mays', { familia: '', habito: 'Hierba anual', sitios: ['STP'] }),
];
const nombres = l => l.map(x => x.nombre);
const f = cambios => ({ ...FILTRO_VACIO, ...cambios });

describe('filtros', () => {
  it('cada filtro', () => {
    expect(nombres(filtrar(especies, f({ grupo: 'Helechos y licófitas' })))).toEqual(['Hymenophyllum dentatum']);
    expect(nombres(filtrar(especies, f({ grupo: 'Monocotiledóneas' })))).toEqual(['Luzuriaga radicans']);
    expect(nombres(filtrar(especies, f({ familia: 'Myrtaceae' })))).toEqual(['Luma chequen']);
    expect(nombres(filtrar(especies, f({ formaVida: 'Trepadora' })))).toEqual(['Luzuriaga radicans']);
    expect(nombres(filtrar(especies, f({ categoria: 'alguna' })))).toEqual(['Hymenophyllum dentatum', 'Luma chequen']);
    expect(nombres(filtrar(especies, f({ categoria: 'Vulnerable' })))).toEqual(['Luma chequen']);
    expect(nombres(filtrar(especies, f({ hidrofila: 'si' })))).toEqual(['Luma chequen', 'Adesmia confusa']);
    expect(nombres(filtrar(especies, f({ registroAI: 'duda' })))).toEqual(['Luzuriaga radicans']);
    expect(nombres(filtrar(especies, f({ sitio: 'STP', habito: 'Arbusto' })))).toEqual(['Adesmia confusa']);
    expect(nombres(filtrar(especies, f({ texto: 'pelos' })))).toEqual(['Hymenophyllum dentatum']);
    expect(nombres(filtrar(especies, f({ texto: 'MYRTA' })))).toEqual(['Luma chequen']);
    expect(nombres(filtrar(especies, f({ aprendizaje: 'sin' })))).toEqual(['Hymenophyllum dentatum', 'Zea mays']);
    const conFoto = new Set([especies[0].id]);
    expect(nombres(filtrar(especies, f({ foto: 'con' }), { conFoto }))).toEqual(['Hymenophyllum dentatum']);
    expect(filtrar(especies, f({ foto: 'sin' }), { conFoto })).toHaveLength(4);
  });

  it('cumple ignora la clave exceptuada', () => {
    expect(cumple(especies[3], f({ sitio: 'Chacao Chonchi' }), undefined, 'sitio')).toBe(true);
    expect(cumple(especies[3], f({ sitio: 'Chacao Chonchi' }))).toBe(false);
  });

  it('conteos usa los demás filtros y no el propio', () => {
    const c = conteos(especies, f({ sitio: 'Chacao Chonchi', habito: 'Árbol' }), 'habito', ['Arbusto', 'Árbol', 'Hierba anual']);
    expect(c.get('Arbusto')).toBe(1);
    expect(c.get('Árbol')).toBe(1);
    expect(c.get('Hierba anual')).toBe(0);
  });

  it('ordenar por nombre, familia, listado y aprendizaje', () => {
    expect(nombres(ordenar(especies))).toEqual(['Adesmia confusa', 'Hymenophyllum dentatum', 'Luma chequen', 'Luzuriaga radicans', 'Zea mays']);
    expect(nombres(ordenar(especies, 'familia'))).toEqual(['Adesmia confusa', 'Hymenophyllum dentatum', 'Luzuriaga radicans', 'Luma chequen', 'Zea mays']);
    expect(nombres(ordenar(especies, 'listado', 'Chacao Chonchi'))).toEqual(['Luzuriaga radicans', 'Luma chequen', 'Hymenophyllum dentatum', 'Adesmia confusa', 'Zea mays']);
    expect(nombres(ordenar(especies, 'listado', ''))).toEqual(nombres(ordenar(especies)));
    expect(nombres(ordenar(especies, 'aprendizaje'))).toEqual(['Luma chequen', 'Luzuriaga radicans', 'Hymenophyllum dentatum', 'Zea mays', 'Adesmia confusa']);
    expect(hayOrdenListado(especies, 'Chacao Chonchi')).toBe(true);
    expect(hayOrdenListado(especies, 'STP')).toBe(false);
  });

  it('filtrosActivos omite vacíos y el texto', () => {
    expect(filtrosActivos(f({ texto: 'x', sitio: 'STP', categoria: 'alguna' }))).toEqual([
      { clave: 'categoria', valor: 'alguna' }, { clave: 'sitio', valor: 'STP' },
    ]);
  });

  it('listarEspecies acepta orden y filtro de foto', async () => {
    const db = crearDb('prueba-' + Math.random());
    const a = await guardarEspecie(db, e('B b', { familia: 'Asteraceae' }));
    await guardarEspecie(db, e('A a', { familia: 'Poaceae' }));
    await agregarFoto(db, { especieId: a.id, blob: new Blob(['x']), miniatura: new Blob(['x']) });
    expect(nombres(await listarEspecies(db, {}, 'familia'))).toEqual(['B b', 'A a']);
    expect(nombres(await listarEspecies(db, { foto: 'con' }))).toEqual(['B b']);
    expect(nombres(await listarEspecies(db))).toEqual(['A a', 'B b']);
  });
});
