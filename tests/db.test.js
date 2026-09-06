import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {
  crearDb, nuevaEspecie, guardarEspecie, obtenerEspecie, borrarEspecie, listarEspecies,
  normalizar, leerMeta, escribirMeta, contar,
  fotosDe, agregarFoto, borrarFoto, moverFoto, miniaturasPrimeras, especiesConFoto,
  exportarRespaldo, importarRespaldo, leerManifest, valoresPetalos,
} from '../db.js';

let db;
beforeEach(() => { db = crearDb('prueba-' + Math.random()); });

describe('especies', () => {
  it('nuevaEspecie tiene los valores por defecto', () => {
    const e = nuevaEspecie({ nombre: 'Adesmia confusa' });
    expect(e.id).toHaveLength(36);
    expect(e).toMatchObject({
      nombre: 'Adesmia confusa', nivel: 'especie', familia: '', origen: '', habito: '', habitoDetalle: '',
      ciclo: '', categoriaMMA: '', decreto: '', ds68: false, distribucion: [], rangoAltitudinal: '',
      sitios: [], aprendizaje: null, aciertos: 0, fallos: 0, rachaAciertos: 0, ultimoEstudio: null, notas: '',
    });
    expect(e.creadoEn).toBe(e.modificadoEn);
  });

  it('guardarEspecie exige nombre y rechaza repetidos sin distinguir tildes ni mayúsculas', async () => {
    await expect(guardarEspecie(db, nuevaEspecie())).rejects.toThrow('vacío');
    await guardarEspecie(db, nuevaEspecie({ nombre: 'Árbol uno' }));
    await expect(guardarEspecie(db, nuevaEspecie({ nombre: ' arbol UNO ' }))).rejects.toThrow('Ya existe');
  });

  it('guardarEspecie recorta el nombre, actualiza y no choca consigo misma', async () => {
    const e = await guardarEspecie(db, nuevaEspecie({ nombre: '  Avena barbata ' }));
    expect(e.nombre).toBe('Avena barbata');
    const e2 = await guardarEspecie(db, { ...e, familia: 'Poaceae' });
    expect((await obtenerEspecie(db, e.id)).familia).toBe('Poaceae');
    expect(e2.modificadoEn >= e.modificadoEn).toBe(true);
  });

  it('listarEspecies filtra por texto, sitio, origen, hábito y aprendizaje, y ordena por nombre', async () => {
    await guardarEspecie(db, nuevaEspecie({ nombre: 'Zea mays', familia: 'Poaceae', origen: 'Introducida', habito: 'Hierba anual', sitios: ['STP'], aprendizaje: 'se' }));
    await guardarEspecie(db, nuevaEspecie({ nombre: 'Adesmia confusa', familia: 'Fabaceae', origen: 'Endémica', habito: 'Arbusto', sitios: ['Las Tórtolas', 'STP'], aprendizaje: null }));
    await guardarEspecie(db, nuevaEspecie({ nombre: 'Baccharis linearis', familia: 'Asteraceae', origen: 'Nativa', habito: 'Arbusto', sitios: ['Las Tórtolas'], aprendizaje: 'falta' }));
    const nombres = async f => (await listarEspecies(db, f)).map(e => e.nombre);
    expect(await nombres({})).toEqual(['Adesmia confusa', 'Baccharis linearis', 'Zea mays']);
    expect(await nombres({ texto: 'poac' })).toEqual(['Zea mays']);
    expect(await nombres({ texto: 'ADESMIA' })).toEqual(['Adesmia confusa']);
    expect(await nombres({ sitio: 'Las Tórtolas' })).toEqual(['Adesmia confusa', 'Baccharis linearis']);
    expect(await nombres({ origen: 'Nativa' })).toEqual(['Baccharis linearis']);
    expect(await nombres({ habito: 'Arbusto', sitio: 'STP' })).toEqual(['Adesmia confusa']);
    expect(await nombres({ aprendizaje: 'sin' })).toEqual(['Adesmia confusa']);
    expect(await nombres({ aprendizaje: 'falta' })).toEqual(['Baccharis linearis']);
    expect(await nombres({ aprendizaje: '', texto: '', sitio: '' })).toHaveLength(3);
  });

  it('borrarEspecie elimina la especie', async () => {
    const e = await guardarEspecie(db, nuevaEspecie({ nombre: 'X y' }));
    await borrarEspecie(db, e.id);
    expect(await obtenerEspecie(db, e.id)).toBeUndefined();
  });

  it('normalizar quita tildes, mayúsculas y espacios sobrantes', () => {
    expect(normalizar('  Árbol  GRANDE ')).toBe('arbol grande');
    expect(normalizar(null)).toBe('');
  });

  it('meta y contar', async () => {
    expect(await leerMeta(db, 'x', 'defecto')).toBe('defecto');
    await escribirMeta(db, 'x', [1, 2]);
    expect(await leerMeta(db, 'x')).toEqual([1, 2]);
    await guardarEspecie(db, nuevaEspecie({ nombre: 'A b' }));
    expect(await contar(db)).toEqual({ especies: 1, fotos: 0 });
  });

  it('nuevaEspecie trae los rasgos florales vacíos', () => {
    expect(nuevaEspecie()).toMatchObject({ colorFlor: [], petalos: '', petalosNota: '', rasgosFuente: '' });
  });

  it('listarEspecies filtra por color de flor y por pétalos; valoresPetalos ordena', async () => {
    await guardarEspecie(db, nuevaEspecie({ nombre: 'A b', colorFlor: ['amarillo', 'blanco'], petalos: '5' }));
    await guardarEspecie(db, nuevaEspecie({ nombre: 'C d', colorFlor: ['rojo'], petalos: '4-5' }));
    await guardarEspecie(db, nuevaEspecie({ nombre: 'E f', colorFlor: [], petalos: '0' }));
    await guardarEspecie(db, nuevaEspecie({ nombre: 'G h', colorFlor: ['amarillo'], petalos: '' }));
    const nombres = async f => (await listarEspecies(db, f)).map(e => e.nombre);
    expect(await nombres({ colorFlor: 'amarillo' })).toEqual(['A b', 'G h']);
    expect(await nombres({ colorFlor: 'blanco', petalos: '5' })).toEqual(['A b']);
    expect(await nombres({ petalos: '0' })).toEqual(['E f']);
    expect(await nombres({ colorFlor: '', petalos: '' })).toHaveLength(4);
    expect(await valoresPetalos(db)).toEqual(['0', '5', '4-5']);
  });
});

const blob = n => new Blob([new Uint8Array(n)], { type: 'image/webp' });

describe('fotos', () => {
  it('agregarFoto asigna orden creciente, tipo y valores por defecto', async () => {
    const e = await guardarEspecie(db, nuevaEspecie({ nombre: 'A b' }));
    const f1 = await agregarFoto(db, { especieId: e.id, blob: blob(10), miniatura: blob(2), ancho: 10, alto: 5 });
    const f2 = await agregarFoto(db, { especieId: e.id, blob: new Blob([new Uint8Array(3)], { type: 'image/jpeg' }), miniatura: blob(2), ancho: 10, alto: 5, fuente: 'inaturalist', autor: 'x', licencia: 'cc-by', url: 'u' });
    expect(f1).toMatchObject({ orden: 0, fuente: 'usuaria', autor: '', licencia: '', url: '', tipo: 'image/webp' });
    expect(f1.id).toHaveLength(36);
    expect(f2).toMatchObject({ orden: 1, fuente: 'inaturalist', autor: 'x', tipo: 'image/jpeg' });
    expect((await fotosDe(db, e.id)).map(f => f.id)).toEqual([f1.id, f2.id]);
  });

  it('borrarFoto renumera y moverFoto intercambia con la vecina', async () => {
    const e = await guardarEspecie(db, nuevaEspecie({ nombre: 'A b' }));
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await agregarFoto(db, { especieId: e.id, blob: blob(1), miniatura: blob(1), ancho: 1, alto: 1 })).id);
    await borrarFoto(db, ids[0]);
    let fotos = await fotosDe(db, e.id);
    expect(fotos.map(f => [f.id, f.orden])).toEqual([[ids[1], 0], [ids[2], 1]]);
    await moverFoto(db, ids[2], -1);
    fotos = await fotosDe(db, e.id);
    expect(fotos.map(f => f.id)).toEqual([ids[2], ids[1]]);
    await moverFoto(db, ids[2], -1); // ya está primera: no cambia
    expect((await fotosDe(db, e.id)).map(f => f.id)).toEqual([ids[2], ids[1]]);
    await moverFoto(db, ids[2], 1);
    expect((await fotosDe(db, e.id)).map(f => f.id)).toEqual([ids[1], ids[2]]);
  });

  it('borrarEspecie borra sus fotos', async () => {
    const e = await guardarEspecie(db, nuevaEspecie({ nombre: 'A b' }));
    await agregarFoto(db, { especieId: e.id, blob: blob(1), miniatura: blob(1), ancho: 1, alto: 1 });
    await borrarEspecie(db, e.id);
    expect(await contar(db)).toEqual({ especies: 0, fotos: 0 });
  });

  it('miniaturasPrimeras y especiesConFoto', async () => {
    const a = await guardarEspecie(db, nuevaEspecie({ nombre: 'A b' }));
    const b = await guardarEspecie(db, nuevaEspecie({ nombre: 'C d' }));
    await agregarFoto(db, { especieId: a.id, blob: blob(9), miniatura: blob(4), ancho: 1, alto: 1 });
    await agregarFoto(db, { especieId: a.id, blob: blob(9), miniatura: blob(6), ancho: 1, alto: 1 });
    const minis = await miniaturasPrimeras(db);
    expect(minis.size).toBe(1);
    expect(minis.get(a.id).size).toBe(4);
    expect(await especiesConFoto(db)).toEqual(new Set([a.id]));
    expect(b.id).toBeDefined();
  });
});

describe('respaldo', () => {
  async function poblar(base) {
    const e = await guardarEspecie(base, nuevaEspecie({ nombre: 'A b', sitios: ['STP'], notas: 'ñandú' }));
    await agregarFoto(base, { especieId: e.id, blob: blob(100), miniatura: blob(10), ancho: 10, alto: 5 });
    return e;
  }

  it('exportar e importar en modo reemplazar reproduce los datos', async () => {
    const e = await poblar(db);
    const zip = await exportarRespaldo(db, JSZip);
    expect(zip).toBeInstanceOf(Uint8Array);
    const db2 = crearDb('prueba-' + Math.random());
    await guardarEspecie(db2, nuevaEspecie({ nombre: 'Basura' }));
    const progreso = [];
    const r = await importarRespaldo(db2, JSZip, zip, 'reemplazar', (n, t) => progreso.push([n, t]));
    expect(r).toEqual({ especies: 1, fotos: 1 });
    const especies = await db2.especies.toArray();
    expect(especies.map(x => x.nombre)).toEqual(['A b']);
    expect(especies[0].notas).toBe('ñandú');
    const f = (await fotosDe(db2, e.id))[0];
    expect(f.blob.size).toBe(100);
    expect(f.miniatura.size).toBe(10);
    expect(f.blob.type).toBe('image/webp');
    expect(f.orden).toBe(0);
    expect(progreso).toEqual([[1, 1]]);
  });

  it('fusionar conserva lo existente y actualiza por id', async () => {
    const e = await poblar(db);
    const zip = await exportarRespaldo(db, JSZip);
    await db.especies.update(e.id, { familia: 'Cambiada' });
    const otra = await guardarEspecie(db, nuevaEspecie({ nombre: 'Otra x' }));
    const r = await importarRespaldo(db, JSZip, zip, 'fusionar');
    expect(r).toEqual({ especies: 1, fotos: 1 });
    expect((await obtenerEspecie(db, e.id)).familia).toBe('');
    expect(await obtenerEspecie(db, otra.id)).toBeDefined();
    expect(await contar(db)).toEqual({ especies: 2, fotos: 1 });
  });

  it('rechaza un ZIP con formato distinto', async () => {
    const z = new JSZip();
    z.file('manifest.json', JSON.stringify({ formato: 2 }));
    z.file('especies.json', '[]');
    z.file('fotos.json', '[]');
    const datos = await z.generateAsync({ type: 'uint8array' });
    await expect(importarRespaldo(db, JSZip, datos, 'reemplazar')).rejects.toThrow('Formato');
  });

  it('leerManifest devuelve el manifest de un respaldo exportado y rechaza formato desconocido', async () => {
    await poblar(db);
    const zip = await exportarRespaldo(db, JSZip);
    const manifest = await leerManifest(JSZip, zip);
    expect(manifest).toMatchObject({ formato: 1, especies: 1, fotos: 1 });
    const z = new JSZip();
    z.file('manifest.json', JSON.stringify({ formato: 2 }));
    const datos = await z.generateAsync({ type: 'uint8array' });
    await expect(leerManifest(JSZip, datos)).rejects.toThrow('Formato de respaldo desconocido');
  });

  it.skipIf(!fs.existsSync('semilla/semilla.zip'))('importa el paquete inicial del pipeline', async () => {
    const datos = fs.readFileSync('semilla/semilla.zip');
    const r = await importarRespaldo(db, JSZip, new Uint8Array(datos), 'reemplazar');
    expect(r.especies).toBe(425);
    expect(await contar(db)).toEqual({ especies: 425, fotos: r.fotos });
    const conFoto = await especiesConFoto(db);
    expect(425 - conFoto.size).toBeLessThanOrEqual(5);
  }, 180000);
});

