// Capa de datos: IndexedDB con Dexie. No toca el DOM.
import Dexie from './vendor/dexie.mjs';

export const FORMATO = 1;
export const SITIOS = ['Las Tórtolas', 'STP', 'Prefactibilidad'];
export const ORIGENES = ['Nativa', 'Endémica', 'Introducida'];
export const HABITOS = ['Hierba anual', 'Hierba perenne', 'Arbusto', 'Árbol', 'Suculenta'];
export const CICLOS = ['Anual', 'Perenne', 'Bienal', 'Anual o bienal'];
export const CATEGORIAS = ['Preocupación Menor', 'Casi amenazada', 'Vulnerable', 'En peligro'];
export const NIVELES = ['especie', 'genero', 'familia'];
export const APRENDIZAJES = [['se', 'La sé'], ['falta', 'Me falta'], ['no', 'No la sé'], ['sin', 'Sin evaluar']];
export const COLORES_FLOR = [
  ['blanco', 'Blanco'], ['amarillo', 'Amarillo'], ['naranja', 'Naranja'], ['rojo', 'Rojo'], ['rosado', 'Rosado'],
  ['morado', 'Morado'], ['azul', 'Azul'], ['verde', 'Verde'], ['cafe', 'Café'], ['sin_flor_vistosa', 'Sin flor vistosa'],
];

export function crearDb(nombre = 'flora') {
  const db = new Dexie(nombre);
  db.version(1).stores({
    especies: 'id, nombre, familia, aprendizaje, *sitios',
    fotos: 'id, especieId, orden, [especieId+orden]',
    meta: 'clave',
  });
  return db;
}

export const ahora = () => new Date().toISOString();

export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');
}

export function nuevaEspecie(datos = {}) {
  const t = ahora();
  return {
    id: crypto.randomUUID(), nombre: '', nivel: 'especie', familia: '', origen: '', habito: '',
    habitoDetalle: '', ciclo: '', categoriaMMA: '', decreto: '', ds68: false, distribucion: [],
    rangoAltitudinal: '', sitios: [], aprendizaje: null, aciertos: 0, fallos: 0, rachaAciertos: 0,
    ultimoEstudio: null, notas: '', colorFlor: [], petalos: '', petalosNota: '', rasgosFuente: '',
    creadoEn: t, modificadoEn: t, ...datos,
  };
}

export async function guardarEspecie(db, especie) {
  const nombre = String(especie.nombre ?? '').trim();
  if (!nombre) throw new Error('El nombre no puede estar vacío');
  const clave = normalizar(nombre);
  const repetida = await db.especies.filter(e => e.id !== especie.id && normalizar(e.nombre) === clave).first();
  if (repetida) throw new Error(`Ya existe una especie con el nombre "${repetida.nombre}"`);
  const registro = { ...especie, nombre, modificadoEn: ahora() };
  await db.especies.put(registro);
  return registro;
}

export function obtenerEspecie(db, id) {
  return db.especies.get(id);
}

export async function borrarEspecie(db, id) {
  await db.transaction('rw', db.especies, db.fotos, async () => {
    await db.fotos.where('especieId').equals(id).delete();
    await db.especies.delete(id);
  });
}

export async function listarEspecies(db, filtro = {}) {
  const texto = normalizar(filtro.texto);
  const todas = await db.especies.toArray();
  return todas
    .filter(e => !filtro.sitio || e.sitios.includes(filtro.sitio))
    .filter(e => !filtro.origen || e.origen === filtro.origen)
    .filter(e => !filtro.habito || e.habito === filtro.habito)
    .filter(e => !filtro.aprendizaje || (filtro.aprendizaje === 'sin' ? e.aprendizaje == null : e.aprendizaje === filtro.aprendizaje))
    .filter(e => !filtro.colorFlor || (e.colorFlor ?? []).includes(filtro.colorFlor))
    .filter(e => !filtro.petalos || e.petalos === filtro.petalos)
    .filter(e => !texto || normalizar(e.nombre).includes(texto) || normalizar(e.familia).includes(texto))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function leerMeta(db, clave, porDefecto = null) {
  const fila = await db.meta.get(clave);
  return fila === undefined ? porDefecto : fila.valor;
}

export function escribirMeta(db, clave, valor) {
  return db.meta.put({ clave, valor });
}

export async function contar(db) {
  return { especies: await db.especies.count(), fotos: await db.fotos.count() };
}

export function fotosDe(db, especieId) {
  return db.fotos.where('especieId').equals(especieId).sortBy('orden');
}

export async function agregarFoto(db, datos) {
  return db.transaction('rw', db.fotos, async () => {
    const orden = await db.fotos.where('especieId').equals(datos.especieId).count();
    const foto = {
      id: crypto.randomUUID(), orden, fuente: 'usuaria', autor: '', licencia: '', url: '',
      tipo: datos.blob?.type || 'image/webp', creadoEn: ahora(), ...datos,
    };
    await db.fotos.put(foto);
    return foto;
  });
}

async function renumerar(db, especieId) {
  const fotos = await fotosDe(db, especieId);
  await Promise.all(fotos.map((f, i) => (f.orden === i ? null : db.fotos.update(f.id, { orden: i }))));
}

export async function borrarFoto(db, id) {
  const foto = await db.fotos.get(id);
  if (!foto) return;
  await db.transaction('rw', db.fotos, async () => {
    await db.fotos.delete(id);
    await renumerar(db, foto.especieId);
  });
}

export async function moverFoto(db, id, delta) {
  const foto = await db.fotos.get(id);
  if (!foto) return;
  const fotos = await fotosDe(db, foto.especieId);
  const i = fotos.findIndex(f => f.id === id);
  const j = i + delta;
  if (j < 0 || j >= fotos.length) return;
  await db.transaction('rw', db.fotos, async () => {
    await db.fotos.update(fotos[i].id, { orden: j });
    await db.fotos.update(fotos[j].id, { orden: i });
  });
}

export async function miniaturasPrimeras(db) {
  const primeras = await db.fotos.where('orden').equals(0).toArray();
  return new Map(primeras.map(f => [f.especieId, f.miniatura]));
}

export async function especiesConFoto(db) {
  return new Set(await db.fotos.orderBy('especieId').uniqueKeys());
}

const CAMPOS_FOTO = ['id', 'especieId', 'orden', 'ancho', 'alto', 'tipo', 'fuente', 'autor', 'licencia', 'url', 'creadoEn'];
const LOTE = 50;

export async function exportarRespaldo(db, JSZip) {
  const zip = new JSZip();
  const especies = await db.especies.toArray();
  const fotos = await db.fotos.toArray();
  zip.file('manifest.json', JSON.stringify({ formato: FORMATO, generado: ahora(), especies: especies.length, fotos: fotos.length }));
  zip.file('especies.json', JSON.stringify(especies));
  zip.file('fotos.json', JSON.stringify(fotos.map(f => Object.fromEntries(CAMPOS_FOTO.map(c => [c, f[c]])))));
  for (const f of fotos) {
    // JSZip en Node no acepta Blob; ArrayBuffer funciona en navegador y en Node.
    zip.file(`fotos/${f.id}.webp`, await f.blob.arrayBuffer(), { compression: 'STORE' });
    zip.file(`miniaturas/${f.id}.webp`, await f.miniatura.arrayBuffer(), { compression: 'STORE' });
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', streamFiles: true });
}

export async function leerManifest(JSZip, datos) {
  const zip = await JSZip.loadAsync(datos);
  const manifest = JSON.parse((await zip.file('manifest.json')?.async('string')) ?? 'null');
  if (!manifest || manifest.formato !== FORMATO) throw new Error('Formato de respaldo desconocido');
  return manifest;
}

export async function importarRespaldo(db, JSZip, datos, modo = 'reemplazar', onProgreso = () => {}) {
  await leerManifest(JSZip, datos);
  const zip = await JSZip.loadAsync(datos);
  const especies = JSON.parse(await zip.file('especies.json').async('string'));
  const fotosMeta = JSON.parse(await zip.file('fotos.json').async('string'));
  if (modo === 'reemplazar') {
    await db.transaction('rw', db.especies, db.fotos, async () => {
      await db.especies.clear();
      await db.fotos.clear();
    });
  }
  await db.especies.bulkPut(especies);
  for (let i = 0; i < fotosMeta.length; i += LOTE) {
    const lote = [];
    for (const m of fotosMeta.slice(i, i + LOTE)) {
      const tipo = m.tipo || 'image/webp';
      const blob = new Blob([await zip.file(`fotos/${m.id}.webp`).async('arraybuffer')], { type: tipo });
      const miniatura = new Blob([await zip.file(`miniaturas/${m.id}.webp`).async('arraybuffer')], { type: tipo });
      lote.push({ ...m, tipo, blob, miniatura });
    }
    await db.fotos.bulkPut(lote);
    onProgreso(Math.min(i + LOTE, fotosMeta.length), fotosMeta.length);
  }
  return { especies: especies.length, fotos: fotosMeta.length };
}

function ordenPetalos(v) {
  const n = Number(v);
  if (Number.isFinite(n)) return [0, n, v];
  const rango = v.match(/^(\d+)-(\d+)$/);
  if (rango) return [1, Number(rango[1]), v];
  return [2, 0, v];
}

export async function valoresPetalos(db) {
  const todas = await db.especies.toArray();
  const valores = [...new Set(todas.map(e => e.petalos).filter(Boolean))];
  return valores.sort((a, b) => {
    const [ga, na, ta] = ordenPetalos(a);
    const [gb, nb, tb] = ordenPetalos(b);
    return ga - gb || na - nb || ta.localeCompare(tb, 'es');
  });
}
