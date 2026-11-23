// Iconos de trazo (24×24, trazo 1.75, extremos redondeados). SVG en línea: sin red ni fuentes de iconos.
const NS = 'http://www.w3.org/2000/svg';

const TRAZOS = {
  buscar: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'm20 20-4-4'],
  filtros: ['M4 7h10', 'M18 7h2', 'M4 17h4', 'M12 17h8', 'M16 5v4', 'M10 15v4'],
  atras: ['m15 18-6-6 6-6'],
  adelante: ['m9 18 6-6-6-6'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 16v-4.5', 'M12 8h.01'],
  mas: ['M12 5v14', 'M5 12h14'],
  hoja: ['M5 19c0-8 5-14 14-14 0 9-6 14-14 14Z', 'M5 19 13 11'],
  estudio: ['M4 6.5 12 3l8 3.5-8 3.5-8-3.5Z', 'M7 8.5V14c0 1.7 2.2 3 5 3s5-1.3 5-3V8.5', 'M20 6.5V12'],
  ajustes: ['M4 6h9', 'M17 6h3', 'M4 12h3', 'M11 12h9', 'M4 18h11', 'M19 18h1', 'M15 4v4', 'M9 10v4', 'M17 16v4'],
  check: ['m5 12.5 4.5 4.5L19 7.5'],
  cerrar: ['M6 6l12 12', 'M18 6 6 18'],
  editar: ['M4 20h4L19 9l-4-4L4 16v4Z', 'm13.5 6.5 4 4'],
};

export function icono(nombre, { clase = 'icono', tam = 20 } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({
    viewBox: '0 0 24 24', width: tam, height: tam, fill: 'none', stroke: 'currentColor',
    'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: clase,
  })) svg.setAttribute(k, v);
  for (const d of TRAZOS[nombre] ?? []) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}
