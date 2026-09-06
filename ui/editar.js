import {
  obtenerEspecie, nuevaEspecie, guardarEspecie, borrarEspecie, fotosDe, agregarFoto, borrarFoto, moverFoto,
  SITIOS, ORIGENES, HABITOS, CICLOS, CATEGORIAS, APRENDIZAJES, COLORES_FLOR,
} from '../db.js';
import { procesarImagen } from '../images.js';
import { el, urlDe, aviso } from './dom.js';

const NIVELES_TEXTO = [['especie', 'Especie'], ['genero', 'Género'], ['familia', 'Familia']];

function campoTexto(objeto, clave, titulo, multilinea = false) {
  const entrada = el(multilinea ? 'textarea' : 'input', {
    type: multilinea ? null : 'text', value: objeto[clave] ?? '', oninput: ev => { objeto[clave] = ev.target.value; },
  });
  return el('label', {}, titulo, entrada);
}

function campoSelector(objeto, clave, titulo, opciones, textoVacio) {
  const opcionVacia = textoVacio == null ? null : el('option', { value: '' }, textoVacio);
  return el('label', {}, titulo, el('select', { onchange: ev => { objeto[clave] = ev.target.value; } },
    opcionVacia,
    ...opciones.map(o => {
      const [valor, texto] = Array.isArray(o) ? o : [o, o];
      return el('option', { value: valor, selected: objeto[clave] === valor }, texto);
    })));
}

export async function render(cont, ctx, id) {
  const { db, navegar } = ctx;
  const nueva = !id;
  const original = nueva ? nuevaEspecie() : await obtenerEspecie(db, id);
  if (!original) { navegar('#/lista'); return; }
  const borrador = structuredClone(original);

  const textoDistribucion = el('input', { type: 'text', value: borrador.distribucion.join(', '), placeholder: 'COQ, VAL, RME' });
  const selectorAprendizaje = el('select', { onchange: ev => { borrador.aprendizaje = ev.target.value === 'sin' ? null : ev.target.value; } },
    ...APRENDIZAJES.map(([v, t]) => el('option', { value: v, selected: (borrador.aprendizaje ?? 'sin') === v }, t)));

  async function guardar() {
    borrador.distribucion = textoDistribucion.value.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
    borrador.petalos = (borrador.petalos ?? '').trim();
    try {
      const r = await guardarEspecie(db, borrador);
      aviso('Guardado');
      navegar(`#/ficha/${r.id}`);
    } catch (err) {
      aviso(err.message, 4000);
    }
  }

  const formulario = el('form', { class: 'formulario', onsubmit: ev => { ev.preventDefault(); guardar(); } },
    campoTexto(borrador, 'nombre', 'Nombre científico'),
    campoSelector(borrador, 'nivel', 'Nivel', NIVELES_TEXTO, null),
    campoTexto(borrador, 'familia', 'Familia'),
    campoSelector(borrador, 'origen', 'Origen', ORIGENES, '(sin dato)'),
    campoSelector(borrador, 'habito', 'Hábito', HABITOS, '(sin dato)'),
    campoTexto(borrador, 'habitoDetalle', 'Hábito detallado'),
    campoSelector(borrador, 'ciclo', 'Ciclo de vida', CICLOS, '(sin dato)'),
    campoSelector(borrador, 'categoriaMMA', 'Categoría de conservación (MMA)', CATEGORIAS, '(sin categoría)'),
    campoTexto(borrador, 'decreto', 'Decreto'),
    el('label', { class: 'casilla' }, el('input', { type: 'checkbox', checked: borrador.ds68, onchange: ev => { borrador.ds68 = ev.target.checked; } }), 'Figura en el D.S. N° 68/2009'),
    el('label', {}, 'Distribución (códigos de región separados por coma)', textoDistribucion),
    campoTexto(borrador, 'rangoAltitudinal', 'Rango altitudinal'),
    el('fieldset', {}, el('legend', {}, 'Sitios'), ...SITIOS.map(s => el('label', { class: 'casilla' },
      el('input', { type: 'checkbox', checked: borrador.sitios.includes(s), onchange: ev => {
        borrador.sitios = ev.target.checked ? [...borrador.sitios, s] : borrador.sitios.filter(x => x !== s);
      } }), s))),
    el('fieldset', {}, el('legend', {}, 'Color de flor'), ...COLORES_FLOR.map(([valor, texto]) => el('label', { class: 'casilla' },
      el('input', { type: 'checkbox', checked: (borrador.colorFlor ?? []).includes(valor), onchange: ev => {
        const actual = borrador.colorFlor ?? [];
        borrador.colorFlor = ev.target.checked ? [...actual, valor] : actual.filter(x => x !== valor);
      } }), texto))),
    campoTexto(borrador, 'petalos', 'Pétalos (número, rango como 4-5, 0 o variable)'),
    campoTexto(borrador, 'petalosNota', 'Pétalos según clave (tipo y aclaración)'),
    el('label', {}, 'Aprendizaje', selectorAprendizaje),
    campoTexto(borrador, 'notas', 'Notas', true),
    el('div', { class: 'acciones' },
      el('button', { type: 'submit', class: 'btn primario' }, 'Guardar'),
      el('a', { class: 'btn', href: nueva ? '#/lista' : `#/ficha/${original.id}` }, 'Cancelar')));

  const estadoFotos = el('p', { class: 'estado' });
  const listaFotos = el('div', { class: 'fotos-edicion' });

  async function pintarFotos() {
    const fotos = await fotosDe(db, original.id);
    listaFotos.replaceChildren(...fotos.map((f, i) => el('div', { class: 'foto-item' },
      el('img', { src: urlDe(`mini-${f.id}`, f.miniatura), alt: '' }),
      el('div', { class: 'botones' },
        el('button', { type: 'button', class: 'btn chico', disabled: i === 0, onclick: async () => { await moverFoto(db, f.id, -1); pintarFotos(); } }, 'Subir'),
        el('button', { type: 'button', class: 'btn chico', disabled: i === fotos.length - 1, onclick: async () => { await moverFoto(db, f.id, 1); pintarFotos(); } }, 'Bajar'),
        el('button', { type: 'button', class: 'btn chico peligro', onclick: async () => {
          if (confirm('¿Borrar esta foto?')) { await borrarFoto(db, f.id); pintarFotos(); }
        } }, 'Borrar')))));
  }

  const entradaArchivo = el('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: async ev => {
    const archivos = [...ev.target.files];
    for (const [i, archivo] of archivos.entries()) {
      estadoFotos.textContent = `Procesando foto ${i + 1} de ${archivos.length}...`;
      try {
        const { blob, miniatura, ancho, alto } = await procesarImagen(archivo);
        await agregarFoto(db, { especieId: original.id, blob, miniatura, ancho, alto, fuente: 'usuaria' });
      } catch (err) {
        aviso(`No se pudo procesar ${archivo.name}`, 4000);
      }
    }
    estadoFotos.textContent = '';
    ev.target.value = '';
    await pintarFotos();
  } });

  const seccionFotos = nueva
    ? el('p', { class: 'estado' }, 'Guarda la especie para poder agregar fotos.')
    : el('section', {}, el('h2', {}, 'Fotos'), listaFotos, estadoFotos, entradaArchivo,
        el('button', { type: 'button', class: 'btn', onclick: () => entradaArchivo.click() }, 'Agregar foto'));

  const botonBorrar = nueva ? null : el('button', { type: 'button', class: 'btn peligro', onclick: async () => {
    if (confirm(`¿Borrar "${original.nombre}" y todas sus fotos?`)) {
      await borrarEspecie(db, original.id);
      aviso('Especie borrada');
      navegar('#/lista');
    }
  } }, 'Borrar especie');

  cont.append(...[
    el('header', { class: 'cabecera' }, el('h1', {}, nueva ? 'Nueva especie' : 'Editar especie')),
    formulario, seccionFotos,
    botonBorrar ? el('div', { class: 'acciones' }, botonBorrar) : null,
  ].filter(Boolean));
  if (!nueva) await pintarFotos();
}
