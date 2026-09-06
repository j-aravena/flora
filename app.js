// Arranque, enrutador por fragmento, carga inicial del paquete y service worker.
import { crearDb, leerMeta, escribirMeta, importarRespaldo } from './db.js';
import { el, aviso, liberarUrls } from './ui/dom.js';
import * as lista from './ui/lista.js';
import * as ficha from './ui/ficha.js';
import * as editar from './ui/editar.js';
import * as estudio from './ui/estudio.js';
import * as ajustes from './ui/ajustes.js';

export const VERSION = globalThis.FLORA_VERSION;
const RUTA_SEMILLA = 'semilla/semilla.zip';

const db = crearDb();
const ctx = {
  db,
  JSZip: globalThis.JSZip,
  VERSION,
  navegar: ruta => { location.hash = ruta; },
  cargarSemilla,
};

const rutas = [
  [/^#\/lista$/, lista.render, 'lista'],
  [/^#\/ficha\/(.+)$/, ficha.render, 'lista'],
  [/^#\/editar\/(.*)$/, editar.render, 'lista'],
  [/^#\/estudio(?:\?especie=([^&]+))?$/, estudio.render, 'estudio'],
  [/^#\/ajustes$/, ajustes.render, 'ajustes'],
];

function marcarNav(seccion) {
  document.querySelectorAll('.barra a').forEach(a => a.classList.toggle('activa', a.dataset.ruta === seccion));
}

let navegacion = 0;

async function enrutar() {
  document.querySelectorAll('.capa').forEach(c => c.remove());
  const hash = location.hash || '#/lista';
  const pantalla = document.getElementById('pantalla');
  for (const [patron, render, seccion] of rutas) {
    const m = hash.match(patron);
    if (!m) continue;
    liberarUrls();
    const n = ++navegacion;
    const sec = el('section', { class: 'pantalla' });
    pantalla.replaceChildren(sec);
    window.scrollTo(0, 0);
    marcarNav(seccion);
    await render(sec, ctx, m[1]);
    if (n !== navegacion) return;
    return;
  }
  location.hash = '#/lista';
}

export async function cargarSemilla(pantalla) {
  const barra = el('progress', { max: 100, value: 0 });
  const estado = el('p', {}, 'Descargando datos iniciales. Se necesita conexión solo esta vez.');
  pantalla.replaceChildren(el('div', { class: 'carga' }, el('h1', {}, 'Flora offline'), estado, barra));
  const respuesta = await fetch(RUTA_SEMILLA, { cache: 'no-store' });
  if (!respuesta.ok) throw new Error(`No se pudo descargar el paquete inicial (${respuesta.status})`);
  const total = Number(respuesta.headers.get('content-length')) || 0;
  const lector = respuesta.body.getReader();
  const partes = [];
  let recibido = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    partes.push(value);
    recibido += value.length;
    if (total) barra.value = 50 * recibido / total;
  }
  estado.textContent = 'Guardando especies y fotos...';
  const datos = await new Blob(partes).arrayBuffer();
  partes.length = 0;
  const r = await importarRespaldo(db, ctx.JSZip, datos, 'reemplazar', (n, t) => { barra.value = 50 + 50 * n / t; });
  await escribirMeta(db, 'semillaCargada', new Date().toISOString());
  await escribirMeta(db, 'versionDatos', 1);
  if (navigator.storage?.persist) await navigator.storage.persist();
  aviso(`Datos cargados: ${r.especies} especies, ${r.fotos} fotos`);
}

async function iniciar() {
  const pantalla = document.getElementById('pantalla');
  if (!(await leerMeta(db, 'semillaCargada'))) {
    try {
      await cargarSemilla(pantalla);
    } catch (err) {
      pantalla.replaceChildren(el('div', { class: 'carga' },
        el('h1', {}, 'Flora offline'),
        el('p', {}, err.message),
        el('button', { class: 'btn primario', onclick: () => location.reload() }, 'Reintentar')));
      return;
    }
  }
  window.addEventListener('hashchange', enrutar);
  await enrutar();
  const versionAnterior = await leerMeta(db, 'versionApp');
  if (versionAnterior && versionAnterior !== VERSION) aviso('Aplicación actualizada a la versión ' + VERSION);
  await escribirMeta(db, 'versionApp', VERSION);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

iniciar();
