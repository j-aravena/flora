import { fotosDe, especiesConFoto, miniaturasPrimeras, obtenerEspecie, SITIOS } from '../db.js';
import { candidatas, armarSesion, resumenSesion, distractores, calificarA, registrarB, barajar } from '../study.js';
import { el, urlDe, aviso } from './dom.js';

// Sesión de estudio: persiste mientras la aplicación está abierta.
const sesion = { modo: 'A', sitio: '', alcance: 'todas', cantidad: 20, cola: [], indice: 0, respuestas: [] };

function resumenEstados(especies) {
  const c = { se: 0, falta: 0, no: 0, sin: 0 };
  for (const e of especies) c[e.aprendizaje ?? 'sin']++;
  return `La sé: ${c.se} · Me falta: ${c.falta} · No la sé: ${c.no} · Sin evaluar: ${c.sin}`;
}

function estadosDeAlcance(alcance) {
  if (alcance === 'pendientes') return ['falta', 'no'];
  if (alcance === 'sin') return ['sin'];
  return null;
}

async function fotoAlAzar(db, especieId) {
  const fotos = await fotosDe(db, especieId);
  return fotos[Math.floor(Math.random() * fotos.length)];
}

function abrirFoto(f) {
  const capa = el('div', { class: 'capa', onclick: () => capa.remove() },
    el('img', { src: urlDe(`foto-${f.id}`, f.blob), alt: '' }),
    f.fuente === 'inaturalist' ? el('p', { class: 'atribucion' }, `${f.autor} · ${f.licencia} · iNaturalist`) : null);
  document.body.append(capa);
}

export async function render(cont, ctx, especieFija) {
  const { db, navegar } = ctx;
  const conFoto = await especiesConFoto(db);

  async function candidatasActuales() {
    const todas = await db.especies.toArray();
    return candidatas(todas, conFoto, sesion.sitio);
  }

  function cabeceraAvance(i, N, esRepaso) {
    const etiqueta = esRepaso ? `Especie ${i} de ${N}` : `Pregunta ${i} de ${N}`;
    return el('div', { class: 'avance' }, el('p', {}, etiqueta), el('progress', { max: N, value: i - 1 }));
  }

  async function inicio() {
    const lista = await candidatasActuales();
    const seleccionEjercicio = el('select', { onchange: ev => { sesion.modo = ev.target.value; } },
      el('option', { value: 'A', selected: sesion.modo === 'A' }, 'Foto a nombre'),
      el('option', { value: 'B', selected: sesion.modo === 'B' }, 'Nombre a foto'),
      el('option', { value: 'R', selected: sesion.modo === 'R' }, 'Repasar'));
    const seleccionSitio = el('select', { onchange: ev => { sesion.sitio = ev.target.value; inicio(); } },
      el('option', { value: '', selected: sesion.sitio === '' }, 'Todos'),
      ...SITIOS.map(s => el('option', { value: s, selected: sesion.sitio === s }, s)));
    const seleccionAlcance = el('select', { onchange: ev => { sesion.alcance = ev.target.value; } },
      el('option', { value: 'todas', selected: sesion.alcance === 'todas' }, 'Todas'),
      el('option', { value: 'pendientes', selected: sesion.alcance === 'pendientes' }, 'Me falta y no la sé'),
      el('option', { value: 'sin', selected: sesion.alcance === 'sin' }, 'Sin evaluar'));
    const seleccionCantidad = el('select', { onchange: ev => { sesion.cantidad = ev.target.value === 'todas' ? 'todas' : Number(ev.target.value); } },
      el('option', { value: '10', selected: sesion.cantidad === 10 }, '10'),
      el('option', { value: '20', selected: sesion.cantidad === 20 }, '20'),
      el('option', { value: 'todas', selected: sesion.cantidad === 'todas' }, 'Todas'));
    cont.replaceChildren(
      el('header', { class: 'cabecera' }, el('h1', {}, 'Estudio'), el('p', { class: 'contador' }, resumenEstados(lista))),
      el('div', { class: 'formulario-sesion' },
        el('label', {}, 'Ejercicio', seleccionEjercicio),
        el('label', {}, 'Sitio', seleccionSitio),
        el('label', {}, 'Especies', seleccionAlcance),
        el('label', {}, 'Cantidad', seleccionCantidad)),
      el('div', { class: 'acciones' }, el('button', { class: 'btn primario', onclick: comenzar }, 'Comenzar')));
  }

  async function comenzar() {
    const lista = await candidatasActuales();
    if (sesion.modo === 'B' && lista.length < 4) {
      aviso('Se necesitan al menos 4 especies con foto para este ejercicio', 4000);
      return;
    }
    const estados = estadosDeAlcance(sesion.alcance);
    const n = sesion.cantidad === 'todas' ? Infinity : sesion.cantidad;
    const cola = armarSesion(lista, { n, estados, rng: Math.random });
    if (!cola.length) {
      aviso('No hay especies con foto para esta selección', 4000);
      return;
    }
    sesion.cola = cola;
    sesion.indice = 0;
    sesion.respuestas = [];
    mostrarPregunta();
  }

  function mostrarPregunta() {
    if (sesion.indice >= sesion.cola.length) { pantallaFinal(); return; }
    const e = sesion.cola[sesion.indice];
    const i = sesion.indice + 1;
    const N = sesion.cola.length;
    if (sesion.modo === 'R') pantallaRepaso(e, i, N);
    else if (sesion.modo === 'B') preguntaB(e, i, N);
    else preguntaA(e, { i, N });
  }

  async function preguntaA(e, { i, N, esFija = false }) {
    const fotos = await fotosDe(db, e.id);
    let respondido = false;
    const galeria = el('div', { class: 'galeria galeria-estudio' },
      ...fotos.map(f => el('img', { src: urlDe(`foto-${f.id}`, f.blob), alt: '' })));
    const indicador = el('p', { class: 'indicador' }, fotos.length ? `1 de ${fotos.length}` : '');
    galeria.addEventListener('scroll', () => {
      if (!fotos.length) return;
      const anchoFoto = galeria.firstElementChild?.getBoundingClientRect().width || 1;
      const idx = Math.min(fotos.length - 1, Math.max(0, Math.round(galeria.scrollLeft / anchoFoto)));
      indicador.textContent = `${idx + 1} de ${fotos.length}`;
    });
    const pista = el('p', { class: 'pista', hidden: true });
    const botonPista = el('button', { class: 'btn', onclick: () => {
      pista.textContent = `Familia: ${e.familia || 'sin dato'} · Hábito: ${e.habito || 'sin dato'}`;
      pista.hidden = false;
      botonPista.disabled = true;
    } }, 'Pista');
    const respuesta = el('p', { class: 'respuesta', hidden: true }, el('i', {}, e.nombre), ' ', el('small', {}, e.familia || ''));
    const siguientePanel = el('div', { class: 'acciones', hidden: true });
    const botones = el('div', { class: 'calificar', hidden: true },
      ...[['se', 'La sé'], ['falta', 'Me falta'], ['no', 'No la sé']].map(([valor, texto]) =>
        el('button', { class: `btn ${valor}`, onclick: async () => {
          if (respondido) return;
          respondido = true;
          await db.especies.put(calificarA(e, valor, new Date().toISOString()));
          if (esFija) { navegar(`#/ficha/${e.id}`); return; }
          sesion.respuestas.push({ id: e.id, resultado: valor });
          siguientePanel.replaceChildren(
            el('a', { class: 'btn', href: `#/ficha/${e.id}` }, 'Ver ficha'),
            el('button', { class: 'btn primario', onclick: () => { sesion.indice++; mostrarPregunta(); } }, 'Siguiente'));
          siguientePanel.hidden = false;
        } }, texto)));
    const mostrar = el('button', { class: 'btn primario', onclick: () => {
      respuesta.hidden = false;
      botones.hidden = false;
      mostrar.hidden = true;
    } }, 'Mostrar nombre');
    const saltar = el('button', { class: 'btn', onclick: () => {
      if (respondido) return;
      respondido = true;
      if (esFija) { navegar(`#/ficha/${e.id}`); return; }
      sesion.respuestas.push({ id: e.id, resultado: 'saltada' });
      sesion.indice++;
      mostrarPregunta();
    } }, 'Saltar');
    cont.replaceChildren(
      cabeceraAvance(i, N, false),
      galeria, indicador,
      el('div', { class: 'acciones' }, botonPista),
      pista,
      el('div', { class: 'acciones' }, mostrar),
      respuesta, botones, siguientePanel,
      el('div', { class: 'acciones' }, saltar));
  }

  async function preguntaB(e, i, N) {
    const todasCand = await candidatasActuales();
    const opciones = barajar([e, ...distractores(todasCand, e, 3, Math.random)], Math.random);
    const fotos = await Promise.all(opciones.map(o => fotoAlAzar(db, o.id)));
    let respondido = false;
    const cuadricula = el('div', { class: 'cuadricula' });
    const siguientePanel = el('div', { class: 'acciones', hidden: true });
    opciones.forEach((o, idx) => {
      const nombre = el('small', { class: 'nombre-opcion', hidden: true }, el('i', {}, o.nombre));
      const celda = el('div', { class: 'opcion', onclick: async () => {
        if (respondido) { abrirFoto(fotos[idx]); return; }
        respondido = true;
        const acierto = o.id === e.id;
        await db.especies.put(registrarB(e, acierto, new Date().toISOString()));
        sesion.respuestas.push({ id: e.id, resultado: acierto ? 'acierto' : 'fallo' });
        [...cuadricula.children].forEach((c, j) => {
          c.classList.add(opciones[j].id === e.id ? 'correcta' : j === idx ? 'incorrecta' : 'neutra');
          c.querySelector('.nombre-opcion').hidden = false;
        });
        aviso(acierto ? 'Correcto' : 'Incorrecto', 1500);
        siguientePanel.replaceChildren(
          el('a', { class: 'btn', href: `#/ficha/${e.id}` }, 'Ver ficha'),
          el('button', { class: 'btn primario', onclick: () => { sesion.indice++; mostrarPregunta(); } }, 'Siguiente'));
        siguientePanel.hidden = false;
      } }, el('img', { src: urlDe(`foto-${fotos[idx].id}`, fotos[idx].blob), alt: '' }), nombre);
      cuadricula.append(celda);
    });
    cont.replaceChildren(
      cabeceraAvance(i, N, false),
      el('header', { class: 'cabecera' }, el('h1', {}, el('i', {}, e.nombre)), el('p', {}, '¿Cuál es su foto?')),
      cuadricula,
      siguientePanel);
  }

  async function pantallaRepaso(e, i, N) {
    const fotos = await fotosDe(db, e.id);
    const galeria = el('div', { class: 'galeria galeria-estudio' },
      ...fotos.map(f => el('img', { src: urlDe(`foto-${f.id}`, f.blob), alt: '' })));
    const indicador = el('p', { class: 'indicador' }, fotos.length ? `1 de ${fotos.length}` : '');
    galeria.addEventListener('scroll', () => {
      if (!fotos.length) return;
      const anchoFoto = galeria.firstElementChild?.getBoundingClientRect().width || 1;
      const idx = Math.min(fotos.length - 1, Math.max(0, Math.round(galeria.scrollLeft / anchoFoto)));
      indicador.textContent = `${idx + 1} de ${fotos.length}`;
    });
    const esUltima = i === N;
    const anterior = el('button', { class: 'btn', disabled: i === 1, onclick: () => {
      if (sesion.indice > 0) { sesion.indice--; mostrarPregunta(); }
    } }, 'Anterior');
    const siguiente = el('button', { class: 'btn primario', onclick: () => {
      if (esUltima) inicio();
      else { sesion.indice++; mostrarPregunta(); }
    } }, esUltima ? 'Terminar' : 'Siguiente');
    cont.replaceChildren(
      cabeceraAvance(i, N, true),
      galeria, indicador,
      el('p', { class: 'respuesta' }, el('i', {}, e.nombre)),
      el('p', {}, `${e.familia || 'sin dato'} · ${e.habito || 'sin dato'}`),
      el('div', { class: 'acciones' }, anterior, siguiente));
  }

  async function repetirFalladas() {
    const r = resumenSesion(sesion.respuestas);
    const especies = (await Promise.all(r.falladas.map(id => obtenerEspecie(db, id)))).filter(Boolean);
    sesion.cola = especies;
    sesion.indice = 0;
    sesion.respuestas = [];
    mostrarPregunta();
  }

  async function pantallaFinal() {
    const r = resumenSesion(sesion.respuestas);
    const minis = await miniaturasPrimeras(db);
    const falladas = (await Promise.all(r.falladas.map(id => obtenerEspecie(db, id)))).filter(Boolean);
    const listaFalladas = el('ul', { class: 'resumen', hidden: falladas.length === 0 },
      ...falladas.map(e => el('li', {},
        el('a', { href: `#/ficha/${e.id}` },
          minis.has(e.id) ? el('img', { src: urlDe(`mini-${e.id}`, minis.get(e.id)), alt: '' }) : null,
          el('i', {}, e.nombre)))));
    const botonRepetir = el('button', { class: 'btn primario', hidden: falladas.length === 0, onclick: repetirFalladas }, 'Repetir las falladas');
    cont.replaceChildren(
      el('header', { class: 'cabecera' }, el('h1', {}, 'Sesión terminada'),
        el('p', {}, `Aciertos ${r.aciertos} · Fallos ${r.fallos} · Saltadas ${r.saltadas}`)),
      listaFalladas,
      el('div', { class: 'acciones' }, botonRepetir,
        el('button', { class: 'btn', onclick: inicio }, 'Nueva sesión'),
        el('a', { class: 'btn', href: '#/lista' }, 'Ir a la lista')));
  }

  if (especieFija) {
    const e = await obtenerEspecie(db, especieFija);
    if (!e) { navegar('#/lista'); return; }
    await preguntaA(e, { i: 1, N: 1, esFija: true });
  } else {
    await inicio();
  }
}
