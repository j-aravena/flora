import { fotosDe, especiesConFoto, leerMeta, escribirMeta, SITIOS } from '../db.js';
import { candidatas, siguienteEspecie, distractores, calificarA, registrarB, actualizarRecientes, barajar } from '../study.js';
import { el, urlDe, aviso } from './dom.js';

// Persiste mientras la aplicación está abierta.
const estado = { modo: 'A', sitio: '' };

async function fotoAlAzar(db, especieId) {
  const fotos = await fotosDe(db, especieId);
  return fotos[Math.floor(Math.random() * fotos.length)];
}

function resumenEstados(especies) {
  const c = { se: 0, falta: 0, no: 0, sin: 0 };
  for (const e of especies) c[e.aprendizaje ?? 'sin']++;
  return `La sé: ${c.se} · Me falta: ${c.falta} · No la sé: ${c.no} · Sin evaluar: ${c.sin}`;
}

export async function render(cont, ctx, especieFija) {
  const { db, navegar } = ctx;
  const conFoto = await especiesConFoto(db);

  async function candidatasActuales() {
    const todas = await db.especies.toArray();
    const lista = candidatas(todas, conFoto, especieFija ? '' : estado.sitio);
    return especieFija ? lista.filter(e => e.id === especieFija) : lista;
  }

  async function inicio() {
    const lista = await candidatasActuales();
    cont.replaceChildren(
      el('header', { class: 'cabecera' }, el('h1', {}, 'Estudio'), el('p', { class: 'contador' }, resumenEstados(lista))),
      el('label', {}, 'Ejercicio', el('select', { onchange: ev => { estado.modo = ev.target.value; } },
        el('option', { value: 'A', selected: estado.modo === 'A' }, 'Foto a nombre'),
        el('option', { value: 'B', selected: estado.modo === 'B' }, 'Nombre a foto'))),
      el('label', {}, 'Sitio', el('select', { onchange: ev => { estado.sitio = ev.target.value; inicio(); } },
        el('option', { value: '' }, 'Todos'),
        ...SITIOS.map(s => el('option', { value: s, selected: estado.sitio === s }, s)))),
      el('div', { class: 'acciones' }, el('button', { class: 'btn primario', onclick: pregunta }, 'Comenzar')));
  }

  async function pregunta() {
    const lista = await candidatasActuales();
    const minimo = estado.modo === 'B' && !especieFija ? 4 : 1;
    if (lista.length < minimo) {
      aviso(`Se necesitan al menos ${minimo} especies con foto para este ejercicio`, 4000);
      if (!cont.querySelector('h1')) inicio();
      return;
    }
    const recientes = await leerMeta(db, 'ultimaPregunta', []);
    const e = siguienteEspecie(lista, recientes, Math.random);
    await escribirMeta(db, 'ultimaPregunta', actualizarRecientes(recientes, e.id));
    if (estado.modo === 'A' || especieFija) await preguntaA(e);
    else await preguntaB(e, lista);
  }

  async function despuesDeResponder() {
    if (especieFija) navegar(`#/ficha/${especieFija}`);
    else pregunta();
  }

  async function preguntaA(e) {
    const f = await fotoAlAzar(db, e.id);
    let respondido = false;
    const respuesta = el('p', { class: 'respuesta', hidden: true }, el('i', {}, e.nombre), ' ', el('small', {}, e.familia || ''));
    const botones = el('div', { class: 'calificar', hidden: true },
      ...[['se', 'La sé'], ['falta', 'Me falta'], ['no', 'No la sé']].map(([valor, texto]) =>
        el('button', { class: `btn ${valor}`, onclick: async () => {
          if (respondido) return;
          respondido = true;
          await db.especies.put(calificarA(e, valor, new Date().toISOString()));
          despuesDeResponder();
        } }, texto)));
    const mostrar = el('button', { class: 'btn primario', onclick: () => {
      respuesta.hidden = false;
      botones.hidden = false;
      mostrar.hidden = true;
    } }, 'Mostrar nombre');
    const saltar = el('button', { class: 'btn', onclick: () => {
      if (respondido) return;
      respondido = true;
      despuesDeResponder();
    } }, 'Saltar');
    cont.replaceChildren(
      el('img', { class: 'foto-estudio', src: urlDe(`foto-${f.id}`, f.blob), alt: '' }),
      el('div', { class: 'acciones' }, mostrar),
      respuesta, botones,
      el('div', { class: 'acciones' },
        saltar,
        el('button', { class: 'btn', onclick: () => (especieFija ? navegar(`#/ficha/${especieFija}`) : inicio()) }, 'Terminar')));
  }

  async function preguntaB(e, lista) {
    const opciones = barajar([e, ...distractores(lista, e, 3, Math.random)], Math.random);
    const fotos = await Promise.all(opciones.map(o => fotoAlAzar(db, o.id)));
    const siguiente = el('button', { class: 'btn primario', hidden: true, onclick: pregunta }, 'Siguiente');
    const cuadricula = el('div', { class: 'cuadricula' });
    let respondido = false;
    opciones.forEach((o, i) => {
      const nombre = el('small', { class: 'nombre-opcion', hidden: true }, el('i', {}, o.nombre));
      const celda = el('div', { class: 'opcion', onclick: async () => {
        if (respondido) return;
        respondido = true;
        const acierto = o.id === e.id;
        await db.especies.put(registrarB(e, acierto, new Date().toISOString()));
        [...cuadricula.children].forEach((c, j) => {
          c.classList.add(opciones[j].id === e.id ? 'correcta' : j === i ? 'incorrecta' : 'neutra');
          c.querySelector('.nombre-opcion').hidden = false;
        });
        aviso(acierto ? 'Correcto' : 'Incorrecto', 1500);
        siguiente.hidden = false;
      } }, el('img', { src: urlDe(`foto-${fotos[i].id}`, fotos[i].blob), alt: '' }), nombre);
      cuadricula.append(celda);
    });
    cont.replaceChildren(
      el('header', { class: 'cabecera' }, el('h1', {}, el('i', {}, e.nombre)), el('p', {}, '¿Cuál es su foto?')),
      cuadricula,
      el('div', { class: 'acciones' }, siguiente, el('button', { class: 'btn', onclick: inicio }, 'Terminar')));
  }

  if (especieFija) await pregunta();
  else await inicio();
}
