// Barra superior con "Volver" para toda pantalla a la que se entra desde otra (ficha, editar, estudiar una especie).
// Queda fija arriba: se esconde al bajar y reaparece apenas se sube, sin tener que volver al principio.
import { el } from './dom.js';
import { icono } from './iconos.js';

// Vuelve por el historial cuando se llegó desde otra pantalla de la app; si no (enlace directo), va a `destino`.
export function volverA(ctx, destino) {
  if (ctx.rutaPrevia) history.back();
  else ctx.navegar(destino);
}

export function barraSuperior({ alVolver, etiqueta = 'Volver', derecha = null }) {
  const barra = el('nav', { class: 'barra-superior', 'aria-label': 'Navegación' },
    el('button', { type: 'button', class: 'boton-volver', onclick: alVolver }, icono('atras', { tam: 20 }), el('span', {}, etiqueta)),
    derecha);
  let ultimoY = window.scrollY;
  let pendiente = false;
  const alScroll = () => {
    if (!barra.isConnected) { window.removeEventListener('scroll', alScroll); return; }
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      const y = window.scrollY;
      const dy = y - ultimoY;
      if (y < 80 || dy < -4) barra.classList.remove('oculta');
      else if (dy > 4) barra.classList.add('oculta');
      barra.classList.toggle('flotando', y > 8);
      ultimoY = y;
    });
  };
  window.addEventListener('scroll', alScroll, { passive: true });
  return barra;
}
