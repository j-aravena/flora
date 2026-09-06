import { exportarRespaldo, importarRespaldo, leerManifest, contar, leerMeta, escribirMeta } from '../db.js';
import { el, aviso, fechaCorta } from './dom.js';

const DIAS_AVISO = 30;
const LIMITE_COMPARTIR = 45 * 1024 * 1024;

function diasDesde(iso) {
  return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : Infinity;
}

export async function render(cont, ctx) {
  const { db, JSZip, VERSION, cargarSemilla, navegar } = ctx;
  const n = await contar(db);
  const ultimoRespaldo = await leerMeta(db, 'ultimoRespaldo');
  const uso = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  const estado = el('p', { class: 'estado' });
  const listo = el('div', { class: 'acciones', hidden: true });
  let modoPendiente = 'reemplazar';

  function repintar() {
    cont.replaceChildren();
    render(cont, ctx).catch(err => aviso(`No se pudo actualizar la pantalla: ${err.message}`, 4000));
  }

  function mostrarListo(archivo) {
    const mb = (archivo.size / (1024 * 1024)).toFixed(1);
    const descargar = el('a', {
      class: 'btn primario', href: URL.createObjectURL(archivo), download: archivo.name,
      onclick: () => {
        escribirMeta(db, 'ultimoRespaldo', new Date().toISOString());
        setTimeout(() => URL.revokeObjectURL(descargar.href), 60000);
      },
    }, 'Descargar');
    const puedeCompartir = Boolean(navigator.canShare?.({ files: [archivo] })) && archivo.size <= LIMITE_COMPARTIR;
    const compartir = el('button', { class: 'btn', hidden: !puedeCompartir, onclick: async () => {
      try {
        await navigator.share({ files: [archivo], title: 'Respaldo flora' });
        await escribirMeta(db, 'ultimoRespaldo', new Date().toISOString());
      } catch (err) {
        if (err.name !== 'AbortError') aviso(`No se pudo compartir: ${err.message}. Usa "Descargar".`, 4000);
      }
    } }, 'Compartir');
    listo.replaceChildren(descargar, compartir, el('p', { class: 'estado' }, `Archivo de ${mb} MB`));
    listo.hidden = false;
  }

  async function exportar() {
    listo.hidden = true;
    estado.textContent = 'Generando respaldo...';
    try {
      const datos = await exportarRespaldo(db, JSZip);
      const fecha = new Date().toISOString().slice(0, 10);
      const archivo = new File([datos], `flora-respaldo-${fecha}.zip`, { type: 'application/zip' });
      estado.textContent = '';
      mostrarListo(archivo);
    } catch (err) {
      aviso(`No se pudo exportar: ${err.message}`, 4000);
      estado.textContent = '';
    }
  }

  async function importarConfirmado(archivo, modo) {
    estado.textContent = 'Leyendo respaldo...';
    let manifest;
    try {
      manifest = await leerManifest(JSZip, await archivo.arrayBuffer());
    } catch (err) {
      aviso(`No se pudo leer el respaldo: ${err.message}`, 4000);
      estado.textContent = '';
      return;
    }
    const accion = modo === 'reemplazar' ? 'REEMPLAZARÁ' : 'FUSIONARÁ';
    const texto = `El respaldo tiene ${manifest.especies} especies y ${manifest.fotos} fotos.\nSe ${accion} con lo que hay en el teléfono. ¿Continuar?`;
    if (!confirm(texto)) { estado.textContent = ''; return; }
    if (modo === 'reemplazar' && !confirm('Se borrarán todas las especies y fotos actuales. ¿Continuar?')) {
      estado.textContent = '';
      return;
    }
    estado.textContent = 'Importando...';
    try {
      const r = await importarRespaldo(db, JSZip, await archivo.arrayBuffer(), modo,
        (i, t) => { estado.textContent = `Importando fotos ${i} de ${t}...`; });
      aviso(`Importadas ${r.especies} especies y ${r.fotos} fotos`);
      repintar();
    } catch (err) {
      aviso(`No se pudo importar: ${err.message}`, 4000);
      estado.textContent = '';
    }
  }

  const entrada = el('input', { type: 'file', accept: '.zip,application/zip', hidden: true, onchange: async ev => {
    const archivo = ev.target.files[0];
    ev.target.value = '';
    if (!archivo) return;
    await importarConfirmado(archivo, modoPendiente);
  } });

  async function recargarSemilla() {
    if (!confirm('Esto borra todas las especies y fotos del teléfono y vuelve a descargar el paquete inicial. Necesita conexión. ¿Continuar?')) return;
    if (!confirm('Segunda confirmación. Los cambios propios que no estén en un respaldo se pierden. ¿Seguro?')) return;
    try {
      await cargarSemilla(cont);
      navegar('#/lista');
    } catch (err) {
      aviso(err.message, 5000);
      repintar();
    }
  }

  const dias = diasDesde(ultimoRespaldo);
  cont.append(
    el('header', { class: 'cabecera' }, el('h1', {}, 'Ajustes')),
    el('section', {}, el('h2', {}, 'Respaldo'),
      el('p', {}, `Último respaldo: ${fechaCorta(ultimoRespaldo)}`),
      dias > DIAS_AVISO ? el('p', { class: 'advertencia' }, 'Han pasado más de 30 días desde el último respaldo. Exporta uno y guárdalo fuera del teléfono.') : null,
      el('div', { class: 'acciones' },
        el('button', { class: 'btn primario', onclick: exportar }, 'Exportar respaldo'),
        el('button', { class: 'btn', onclick: () => { modoPendiente = 'reemplazar'; entrada.click(); } }, 'Importar reemplazando'),
        el('button', { class: 'btn', onclick: () => { modoPendiente = 'fusionar'; entrada.click(); } }, 'Importar fusionando')),
      entrada, estado, listo),
    el('section', {}, el('h2', {}, 'Datos'),
      el('p', {}, `${n.especies} especies, ${n.fotos} fotos`),
      uso ? el('p', {}, `Espacio usado: ${Math.round(uso.usage / 1e6)} MB de ${Math.round(uso.quota / 1e6)} MB disponibles`) : null,
      el('div', { class: 'acciones' }, el('button', { class: 'btn peligro', onclick: recargarSemilla }, 'Volver a cargar el paquete inicial'))),
    el('section', {}, el('h2', {}, 'Aplicación'), el('p', {}, `Versión ${VERSION}`)));
}
