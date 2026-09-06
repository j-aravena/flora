// Búsqueda y activación de actualizaciones del service worker.

export function extraerVersion(texto) {
  const m = String(texto).match(/FLORA_VERSION\s*=\s*'([^']+)'/);
  if (!m) throw new Error('No se encontró la versión publicada');
  return m[1];
}

export async function versionPublicada() {
  const respuesta = await fetch(`./version.js?t=${Date.now()}`, { cache: 'no-store' });
  if (!respuesta.ok) throw new Error(`No se pudo consultar la versión (HTTP ${respuesta.status})`);
  return extraerVersion(await respuesta.text());
}

function esperarInstalacion(sw) {
  return new Promise(resolver => {
    const revisar = () => { if (sw.state === 'installed' || sw.state === 'activated' || sw.state === 'redundant') resolver(sw.state); };
    sw.addEventListener('statechange', revisar);
    revisar();
  });
}

// onEstado recibe: 'buscando' | 'descargando' | 'lista' | 'al-dia' | 'error'. Devuelve el registro del service worker.
export async function buscarActualizacion(onEstado) {
  const registro = await navigator.serviceWorker.getRegistration();
  if (!registro) throw new Error('La aplicación no está instalada como PWA en este navegador');
  onEstado('buscando');
  await registro.update();
  if (registro.waiting && !registro.installing) { onEstado('lista'); return registro; }
  const nuevo = registro.installing;
  if (!nuevo) { onEstado('al-dia'); return registro; }
  onEstado('descargando');
  const estado = await esperarInstalacion(nuevo);
  onEstado(estado === 'redundant' ? 'error' : 'lista');
  return registro;
}

export function reiniciarConNueva(registro) {
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  registro.waiting?.postMessage({ type: 'SKIP_WAITING' });
}
