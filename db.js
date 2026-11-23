// Capa de datos: IndexedDB con Dexie. No toca el DOM.
import Dexie from './vendor/dexie.mjs';
import { filtrar, ordenar } from './filtros.js';

export const FORMATO = 1;
export const SITIOS = ['Las Tórtolas', 'STP', 'Prefactibilidad', 'Nevado Tres Cruces', 'Chacao Chonchi'];
export const ORIGENES = ['Nativa', 'Endémica', 'Introducida'];
export const HABITOS = ['Hierba anual', 'Hierba perenne', 'Subarbusto', 'Arbusto', 'Árbol', 'Suculenta'];
export const CICLOS = ['Anual', 'Perenne', 'Bienal', 'Anual o bienal'];
export const CATEGORIAS = ['Preocupación Menor', 'Casi amenazada', 'Vulnerable', 'En peligro', 'En peligro crítico', 'Datos insuficientes', 'Rara'];
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
    registroAI: '', hidrofila: false, diagnostico: '', ordenListado: {},
    completado: {}, fallosPorTipo: {},
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

// Fusiona la edición del usuario sobre la copia más reciente de la BD: solo escribe los campos que el usuario cambió
// respecto de `original` (la copia con que abrió el formulario), y conserva lo demás de `fresca` (complementos aplicados
// en segundo plano, avance de estudio, fallos). Un campo completado que el usuario cambia o borra pasa a `rechazado`
// para que los complementos no lo vuelvan a llenar; confirmarlo solo quita su marca de `completado`.
export function fusionarEdicion(fresca, original, borrador) {
  if (!fresca) return borrador;
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const r = { ...fresca };
  for (const k of Object.keys(borrador)) {
    if (k === 'completado' || k === 'rechazado') continue;
    if (!igual(borrador[k], original[k])) r[k] = borrador[k];
  }
  const completado = { ...(fresca.completado ?? {}) };
  const rechazado = new Set(fresca.rechazado ?? []);
  for (const k of Object.keys(original.completado ?? {})) {
    if (borrador.completado && k in borrador.completado) continue;
    delete completado[k];
    if (!igual(borrador[k], original[k])) rechazado.add(k);
  }
  r.completado = completado;
  if (rechazado.size) r.rechazado = [...rechazado];
  return r;
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

export async function listarEspecies(db, filtro = {}, orden = 'nombre') {
  const todas = await db.especies.toArray();
  const conFoto = filtro.foto ? await especiesConFoto(db) : new Set();
  return ordenar(filtrar(todas, filtro, { conFoto }), orden, filtro.sitio);
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

export const CAMPOS_COMPLEMENTO = ['familia', 'habito', 'habitoDetalle', 'origen', 'colorFlor', 'petalos', 'diagnostico', 'categoriaMMA', 'decreto'];
const sinValor = v => v == null || v === '' || (Array.isArray(v) && v.length === 0);

// Aplica un paquete de complementos (spec 1.5 §5.4): solo llena campos vacíos y anota su fuente en `completado`.
// Categoría y decreto van juntos; el decreto solo se completa si la categoría del teléfono coincide. Idempotente.
export async function aplicarComplementos(db, JSZip, datos) {
  await leerManifest(JSZip, datos);
  const zip = await JSZip.loadAsync(datos);
  const registros = JSON.parse(await zip.file('complementos.json').async('string'));
  return db.transaction('rw', db.especies, async () => {
  const actuales = await db.especies.toArray();
  const porId = new Map(actuales.map(e => [e.id, e]));
  const porNombre = new Map(actuales.map(e => [normalizar(e.nombre), e]));
  const cambiadas = new Map();
  let campos = 0;
  for (const r of registros) {
    if (!r.campos || !r.fuentes) continue;
    const original = porId.get(r.id) ?? porNombre.get(normalizar(r.nombre));
    if (!original) continue;
    const e = cambiadas.get(original.id) ?? { ...original, completado: { ...(original.completado ?? {}) } };
    let tocada = false;
    const rechazado = original.rechazado ?? [];
    const poner = campo => { e[campo] = r.campos[campo]; e.completado[campo] = r.fuentes[campo]; campos++; tocada = true; };
    for (const campo of Object.keys(r.campos)) {
      if (!CAMPOS_COMPLEMENTO.includes(campo) || campo === 'decreto' || !r.fuentes[campo] || sinValor(r.campos[campo])) continue;
      if (rechazado.includes(campo)) continue;
      if (campo === 'categoriaMMA') {
        const puedeDecreto = !rechazado.includes('decreto');
        if (sinValor(e.categoriaMMA)) {
          poner('categoriaMMA');
          if (puedeDecreto && r.campos.decreto && r.fuentes.decreto && sinValor(e.decreto)) poner('decreto');
        } else if (puedeDecreto && e.categoriaMMA === r.campos.categoriaMMA && r.campos.decreto && r.fuentes.decreto && sinValor(e.decreto)) {
          poner('decreto');
        }
        continue;
      }
      if (sinValor(e[campo])) poner(campo);
    }
    if (tocada) cambiadas.set(original.id, e);
  }
  await db.especies.bulkPut([...cambiadas.values()]);
  return { especies: cambiadas.size, campos };
  });
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

const CAMPOS_SI_VACIOS = ['familia', 'habito', 'habitoDetalle', 'categoriaMMA', 'decreto', 'diagnostico'];

// Completa una especie existente con lo que trae el listado, sin tocar avance, notas ni lo que ya tiene.
function completarExistente(existente, delPaquete, sitio) {
  const e = { ...existente, sitios: existente.sitios.includes(sitio) ? existente.sitios : [...existente.sitios, sitio] };
  for (const c of CAMPOS_SI_VACIOS) if (!e[c] && delPaquete[c]) e[c] = delPaquete[c];
  if (delPaquete.registroAI) e.registroAI = delPaquete.registroAI;
  e.hidrofila = Boolean(existente.hidrofila || delPaquete.hidrofila);
  e.ordenListado = { ...(existente.ordenListado ?? {}), ...(delPaquete.ordenListado ?? {}) };
  return e;
}

const cambio = (a, b) => JSON.stringify(a) !== JSON.stringify(b);

// Aplica un paquete de listado de sitio sin reemplazar nada. Las especies que ya están en el teléfono (mismo id, o mismo
// nombre sin distinguir tildes ni mayúsculas, como las creadas a mano) reciben el sitio, las fotos del paquete al final y
// los datos que les falten. Las demás se agregan con sus fotos. Avance, notas, ediciones y fotos propias quedan intactos,
// y aplicarlo dos veces no cambia nada.
export async function agregarListado(db, JSZip, datos, sitio) {
  await leerManifest(JSZip, datos);
  const zip = await JSZip.loadAsync(datos);
  const especies = JSON.parse(await zip.file('especies.json').async('string'));
  const fotosMeta = JSON.parse(await zip.file('fotos.json').async('string'));
  const actuales = await db.especies.toArray();
  const porId = new Map(actuales.map(e => [e.id, e]));
  const porNombre = new Map(actuales.map(e => [normalizar(e.nombre), e]));
  const nuevas = [];
  const actualizadas = [];
  const destino = new Map(); // id en el paquete -> id en el teléfono
  for (const e of especies) {
    const existente = porId.get(e.id) ?? porNombre.get(normalizar(e.nombre));
    if (!existente) {
      nuevas.push(e);
      porNombre.set(normalizar(e.nombre), e);
      destino.set(e.id, e.id);
      continue;
    }
    destino.set(e.id, existente.id);
    const completada = completarExistente(existente, e, sitio);
    if (cambio(completada, existente)) actualizadas.push(completada);
  }
  const idsFotos = new Set(await db.fotos.toCollection().primaryKeys());
  const siguienteOrden = new Map();
  const fotos = [];
  for (const m of [...fotosMeta].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))) {
    const especieId = destino.get(m.especieId);
    if (!especieId || idsFotos.has(m.id)) continue;
    if (!siguienteOrden.has(especieId)) siguienteOrden.set(especieId, await db.fotos.where('especieId').equals(especieId).count());
    const orden = siguienteOrden.get(especieId);
    siguienteOrden.set(especieId, orden + 1);
    const tipo = m.tipo || 'image/webp';
    const blob = new Blob([await zip.file(`fotos/${m.id}.webp`).async('arraybuffer')], { type: tipo });
    const miniatura = new Blob([await zip.file(`miniaturas/${m.id}.webp`).async('arraybuffer')], { type: tipo });
    fotos.push({ ...m, especieId, orden, tipo, blob, miniatura });
  }
  await db.transaction('rw', db.especies, db.fotos, async () => {
    await db.especies.bulkAdd(nuevas);
    await db.especies.bulkPut(actualizadas);
    await db.fotos.bulkAdd(fotos);
  });
  const conSitio = actualizadas.filter(e => !porId.get(e.id)?.sitios.includes(sitio)).length;
  return { nuevas: nuevas.length, conSitio, fotos: fotos.length };
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
