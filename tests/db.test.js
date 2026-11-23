import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {
  crearDb, nuevaEspecie, guardarEspecie, obtenerEspecie, borrarEspecie, listarEspecies,
  normalizar, leerMeta, escribirMeta, contar,
  fotosDe, agregarFoto, borrarFoto, moverFoto, miniaturasPrimeras, especiesConFoto,
  exportarRespaldo, importarRespaldo, leerManifest, valoresPetalos, agregarListado, aplicarComplementos, fusionarEdicion,
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

describe('agregarListado', () => {
  // Arma un paquete de listado con el mismo formato que un respaldo, desde una base aparte.
  async function paquete(especies, fotos = []) {
    const origen = crearDb('paquete-' + Math.random());
    await origen.especies.bulkPut(especies);
    for (const f of fotos) await agregarFoto(origen, f);
    return exportarRespaldo(origen, JSZip);
  }

  it('suma el sitio a las existentes (por id o por nombre) sin tocar su avance y agrega las nuevas con fotos', async () => {
    const semilla = await guardarEspecie(db, nuevaEspecie({
      nombre: 'Adesmia hystrix', sitios: ['STP'], aprendizaje: 'se', aciertos: 4, notas: 'mía', familia: 'Editada',
    }));
    await agregarFoto(db, { especieId: semilla.id, blob: blob(5), miniatura: blob(1), ancho: 1, alto: 1 });
    const manual = await guardarEspecie(db, nuevaEspecie({ nombre: 'Viola gelida', aprendizaje: 'falta', fallos: 2 }));

    const enPaquete = [
      nuevaEspecie({ id: semilla.id, nombre: 'Adesmia hystrix', sitios: ['Nevado Tres Cruces'] }),
      nuevaEspecie({ nombre: 'viola  GÉLIDA', sitios: ['Nevado Tres Cruces'], familia: 'Violaceae' }),
      nuevaEspecie({ nombre: 'Nueva especie', sitios: ['Nevado Tres Cruces'], familia: 'Asteraceae' }),
    ];
    const zip = await paquete(enPaquete, [
      { especieId: enPaquete[1].id, blob: blob(7), miniatura: blob(2), ancho: 1, alto: 1 },
      { especieId: enPaquete[2].id, blob: blob(8), miniatura: blob(3), ancho: 1, alto: 1 },
      { especieId: enPaquete[2].id, blob: blob(9), miniatura: blob(3), ancho: 1, alto: 1 },
    ]);

    const r = await agregarListado(db, JSZip, zip, 'Nevado Tres Cruces');
    expect(r).toEqual({ nuevas: 1, conSitio: 2, fotos: 3 });

    const s = await obtenerEspecie(db, semilla.id);
    expect(s).toMatchObject({ sitios: ['STP', 'Nevado Tres Cruces'], aprendizaje: 'se', aciertos: 4, notas: 'mía', familia: 'Editada' });
    expect((await fotosDe(db, semilla.id)).length).toBe(1);
    const m = await obtenerEspecie(db, manual.id);
    expect(m).toMatchObject({ nombre: 'Viola gelida', sitios: ['Nevado Tres Cruces'], aprendizaje: 'falta', fallos: 2, familia: 'Violaceae' });
    expect((await fotosDe(db, manual.id)).length).toBe(1);
    expect(await obtenerEspecie(db, enPaquete[1].id)).toBeUndefined();
    const nueva = await obtenerEspecie(db, enPaquete[2].id);
    expect(nueva).toMatchObject({ nombre: 'Nueva especie', sitios: ['Nevado Tres Cruces'], familia: 'Asteraceae' });
    expect((await fotosDe(db, nueva.id)).map(f => f.blob.size)).toEqual([8, 9]);

    // Aplicarlo de nuevo no cambia nada.
    expect(await agregarListado(db, JSZip, zip, 'Nevado Tres Cruces')).toEqual({ nuevas: 0, conSitio: 0, fotos: 0 });
    expect(await contar(db)).toEqual({ especies: 3, fotos: 4 });
    expect((await obtenerEspecie(db, semilla.id)).sitios).toEqual(['STP', 'Nevado Tres Cruces']);
  });
});

async function zipListado(especies, fotos = []) {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify({ formato: 1, generado: 'x', especies: especies.length, fotos: fotos.length }));
  zip.file('especies.json', JSON.stringify(especies));
  zip.file('fotos.json', JSON.stringify(fotos));
  for (const f of fotos) {
    zip.file(`fotos/${f.id}.webp`, new Uint8Array([1, 2, 3]));
    zip.file(`miniaturas/${f.id}.webp`, new Uint8Array([4]));
  }
  return zip.generateAsync({ type: 'uint8array' });
}

const fotoMeta = (id, especieId, orden) => ({ id, especieId, orden, ancho: 1, alto: 1, tipo: 'image/webp', fuente: 'presentacion', autor: 'A', licencia: '', url: '', creadoEn: 'x' });

describe('agregarListado con existentes', () => {
  it('suma fotos al final y completa solo campos vacíos, sin tocar avance ni notas', async () => {
    const existente = await guardarEspecie(db, nuevaEspecie({
      nombre: 'Acaena magellanica', familia: 'Rosaceae', categoriaMMA: '', notas: 'mía', aprendizaje: 'se', sitios: ['STP'],
    }));
    await agregarFoto(db, { especieId: existente.id, blob: new Blob(['a']), miniatura: new Blob(['a']) });
    const delPaquete = nuevaEspecie({
      id: 'otro-id', nombre: 'acaena magellanica', familia: 'Otra', categoriaMMA: 'Preocupación Menor', decreto: 'D.S. N° 1/2000',
      diagnostico: 'Espinas ganchudas', registroAI: 'si', hidrofila: true, ordenListado: { 'Chacao Chonchi': 7 }, notas: 'del pdf',
      sitios: ['Chacao Chonchi'],
    });
    const datos = await zipListado([delPaquete], [fotoMeta('f1', 'otro-id', 0), fotoMeta('f2', 'otro-id', 1)]);
    const r = await agregarListado(db, JSZip, datos, 'Chacao Chonchi');
    expect(r).toEqual({ nuevas: 0, conSitio: 1, fotos: 2 });
    const e = await obtenerEspecie(db, existente.id);
    expect(e.sitios).toEqual(['STP', 'Chacao Chonchi']);
    expect(e.familia).toBe('Rosaceae');
    expect(e.categoriaMMA).toBe('Preocupación Menor');
    expect(e.decreto).toBe('D.S. N° 1/2000');
    expect(e.diagnostico).toBe('Espinas ganchudas');
    expect(e).toMatchObject({ registroAI: 'si', hidrofila: true, ordenListado: { 'Chacao Chonchi': 7 }, notas: 'mía', aprendizaje: 'se' });
    const fotos = await fotosDe(db, existente.id);
    expect(fotos.map(f => [f.id, f.orden])).toEqual([[fotos[0].id, 0], ['f1', 1], ['f2', 2]]);
    expect(await db.especies.get('otro-id')).toBeUndefined();

    const r2 = await agregarListado(db, JSZip, datos, 'Chacao Chonchi');
    expect(r2).toEqual({ nuevas: 0, conSitio: 0, fotos: 0 });
    expect(await fotosDe(db, existente.id)).toHaveLength(3);
  });

  it('las nuevas entran con sus fotos', async () => {
    const nueva = nuevaEspecie({ nombre: 'Luma chequen', sitios: ['Chacao Chonchi'], ordenListado: { 'Chacao Chonchi': 1 } });
    const r = await agregarListado(db, JSZip, await zipListado([nueva], [fotoMeta('g1', nueva.id, 0)]), 'Chacao Chonchi');
    expect(r).toEqual({ nuevas: 1, conSitio: 0, fotos: 1 });
    expect((await obtenerEspecie(db, nueva.id)).ordenListado).toEqual({ 'Chacao Chonchi': 1 });
  });
});

describe('aplicarComplementos', () => {
  async function zipComplementos(registros) {
    const z = new JSZip();
    z.file('manifest.json', JSON.stringify({ formato: 1, tipo: 'complementos', version: 1, creado: '2026-11-23' }));
    z.file('complementos.json', JSON.stringify(registros));
    return z.generateAsync({ type: 'arraybuffer' });
  }
  const F = 'Chileflora — https://www.chileflora.com/x';

  it('llena solo campos vacíos, por id o por nombre, y marca la procedencia', async () => {
    const db = crearDb(`c-${crypto.randomUUID()}`);
    await db.especies.bulkAdd([
      nuevaEspecie({ id: 'a', nombre: 'Greigia sphacelata', origen: 'Nativa' }),
      nuevaEspecie({ id: 'b', nombre: 'Carex erinácea' }),
    ]);
    const r = await aplicarComplementos(db, JSZip, await zipComplementos([
      { id: 'a', nombre: 'Greigia sphacelata', campos: { origen: 'Endémica', colorFlor: ['rojo'] }, fuentes: { origen: F, colorFlor: F } },
      { id: 'zz', nombre: 'Carex erinacea', campos: { diagnostico: 'Espigas erizadas.' }, fuentes: { diagnostico: F } },
    ]));
    const a = await db.especies.get('a');
    const b = await db.especies.get('b');
    expect(a.origen).toBe('Nativa');
    expect(a.colorFlor).toEqual(['rojo']);
    expect(a.completado).toEqual({ colorFlor: F });
    expect(b.diagnostico).toBe('Espigas erizadas.');
    expect(b.completado).toEqual({ diagnostico: F });
    expect(r).toEqual({ especies: 2, campos: 2 });
  });

  it('categoría y decreto van juntos; decreto solo se completa si la categoría coincide', async () => {
    const db = crearDb(`c-${crypto.randomUUID()}`);
    await db.especies.bulkAdd([
      nuevaEspecie({ id: 'a', nombre: 'A a' }),
      nuevaEspecie({ id: 'b', nombre: 'B b', categoriaMMA: 'Vulnerable' }),
      nuevaEspecie({ id: 'c', nombre: 'C c', categoriaMMA: 'En peligro' }),
    ]);
    const campos = { categoriaMMA: 'Vulnerable', decreto: 'D.S. N° 52/2014' };
    const fuentes = { categoriaMMA: F, decreto: F };
    await aplicarComplementos(db, JSZip, await zipComplementos(['a', 'b', 'c'].map(id => ({ id, nombre: id, campos, fuentes }))));
    expect(await db.especies.get('a')).toMatchObject({ categoriaMMA: 'Vulnerable', decreto: 'D.S. N° 52/2014', completado: { categoriaMMA: F, decreto: F } });
    expect(await db.especies.get('b')).toMatchObject({ categoriaMMA: 'Vulnerable', decreto: 'D.S. N° 52/2014', completado: { decreto: F } });
    expect(await db.especies.get('c')).toMatchObject({ categoriaMMA: 'En peligro', decreto: '' });
  });

  it('un decreto solo se completa si la categoría coincide y el decreto está vacío', async () => {
    const db = crearDb(`c-${crypto.randomUUID()}`);
    await db.especies.bulkAdd([
      nuevaEspecie({ id: 'a', nombre: 'A a', categoriaMMA: 'Casi amenazada' }),
      nuevaEspecie({ id: 'b', nombre: 'B b', categoriaMMA: 'Vulnerable' }),
      nuevaEspecie({ id: 'c', nombre: 'C c', categoriaMMA: 'Casi amenazada', decreto: 'D.S. N° 1/2000' }),
    ]);
    const campos = { categoriaMMA: 'Casi amenazada', decreto: 'D.S. N° 44/2021' };
    const fuentes = { categoriaMMA: F, decreto: F };
    await aplicarComplementos(db, JSZip, await zipComplementos(['a', 'b', 'c'].map(id => ({ id, nombre: id, campos, fuentes }))));
    expect(await db.especies.get('a')).toMatchObject({ decreto: 'D.S. N° 44/2021', completado: { decreto: F } });
    expect(await db.especies.get('b')).toMatchObject({ categoriaMMA: 'Vulnerable', decreto: '' });
    expect(await db.especies.get('c')).toMatchObject({ decreto: 'D.S. N° 1/2000' });
  });

  it('no vuelve a llenar los campos que el usuario rechazó', async () => {
    const db = crearDb(`c-${crypto.randomUUID()}`);
    await db.especies.bulkAdd([
      nuevaEspecie({ id: 'a', nombre: 'A a', rechazado: ['origen', 'categoriaMMA'] }),
      nuevaEspecie({ id: 'b', nombre: 'B b', categoriaMMA: 'Vulnerable', rechazado: ['decreto'] }),
    ]);
    await aplicarComplementos(db, JSZip, await zipComplementos(['a', 'b'].map(id => ({
      id, nombre: id, campos: { origen: 'Nativa', familia: 'Fabaceae', categoriaMMA: 'Vulnerable', decreto: 'D.S. N° 52/2014' },
      fuentes: { origen: F, familia: F, categoriaMMA: F, decreto: F },
    }))));
    expect(await db.especies.get('a')).toMatchObject({ origen: '', familia: 'Fabaceae', categoriaMMA: '', decreto: '' });
    expect(await db.especies.get('b')).toMatchObject({ decreto: '' });
  });

  it('fusionarEdicion escribe solo lo editado, conserva lo de fondo y registra los rechazos', () => {
    const original = nuevaEspecie({ id: 'a', nombre: 'A a', familia: 'X', origen: 'Nativa', notas: '', completado: { familia: F, origen: F } });
    const fresca = { ...original, diagnostico: 'Nuevo', aciertos: 3, completado: { familia: F, origen: F, diagnostico: F } };
    const borrador = structuredClone(original);
    borrador.notas = 'mi nota';
    borrador.familia = '';
    delete borrador.completado.familia;
    delete borrador.completado.origen; // confirmado sin cambio
    const r = fusionarEdicion(fresca, original, borrador);
    expect(r).toMatchObject({ notas: 'mi nota', familia: '', origen: 'Nativa', diagnostico: 'Nuevo', aciertos: 3, rechazado: ['familia'] });
    expect(r.completado).toEqual({ diagnostico: F });
    expect(fusionarEdicion(null, original, borrador)).toBe(borrador);
  });

  it('es idempotente e ignora especies o campos desconocidos', async () => {
    const db = crearDb(`c-${crypto.randomUUID()}`);
    await db.especies.add(nuevaEspecie({ id: 'a', nombre: 'A a' }));
    const datos = await zipComplementos([
      { id: 'a', nombre: 'A a', campos: { petalos: '5', notas: 'x' }, fuentes: { petalos: F, notas: F } },
      { id: 'q', nombre: 'No existe', campos: { petalos: '4' }, fuentes: { petalos: F } },
    ]);
    expect(await aplicarComplementos(db, JSZip, datos)).toEqual({ especies: 1, campos: 1 });
    expect(await aplicarComplementos(db, JSZip, datos)).toEqual({ especies: 0, campos: 0 });
    expect((await db.especies.get('a')).notas).toBe('');
  });

  it('ignora valores vacíos entrantes y registros sin campos', async () => {
    const db = crearDb(`c-${crypto.randomUUID()}`);
    await db.especies.add(nuevaEspecie({ id: 'a', nombre: 'A a' }));
    const r = await aplicarComplementos(db, JSZip, await zipComplementos([
      { id: 'a', nombre: 'A a', campos: { familia: '', colorFlor: [], origen: 'Nativa' }, fuentes: { familia: F, colorFlor: F, origen: F } },
      { id: 'a', nombre: 'A a' },
    ]));
    expect(r).toEqual({ especies: 1, campos: 1 });
    expect(await db.especies.get('a')).toMatchObject({ familia: '', colorFlor: [], origen: 'Nativa' });
  });

  it('nuevaEspecie trae completado y fallosPorTipo vacíos', () => {
    expect(nuevaEspecie()).toMatchObject({ completado: {}, fallosPorTipo: {} });
  });
});
