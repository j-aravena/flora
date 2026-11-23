import { fotosDe, especiesConFoto, miniaturasPrimeras, obtenerEspecie, valoresPetalos, ahora } from '../db.js';
import { filtrosActivos } from '../filtros.js';
import { candidatas, armarSesion, resumenSesion, tiposFalladosPorId } from '../study.js';
import { armarRonda, calificarRonda, resultadoRonda, ETIQUETAS_TIPO } from '../quiz.js';
import { el, urlDe, aviso } from './dom.js';
import { icono } from './iconos.js';
import { barraSuperior, volverA } from './volver.js';
import { crearMemoria, memoria as memoriaLista } from './memoria.js';
import { PRINCIPALES, TITULOS, opcionesFiltro, etiquetaFiltro, selectorFiltro, abrirHojaFiltros } from './filtros-ui.js';

const SITIO_AI = 'Chacao Chonchi';
// Filtros, modo, alcance y cantidad de Estudio: propios y persistentes, independientes de la lista.
const memoria = crearMemoria(() => globalThis.localStorage, 'flora.estudio');
const MODOS = [['cuestionario', 'Cuestionario'], ['repasar', 'Repasar']];
const ALCANCES = [['todas', 'Todas'], ['pendientes', 'Por repasar'], ['sin', 'Sin evaluar']];
const CANTIDADES = [[10, '10'], [20, '20'], ['todas', 'Todas']];

// Sesión de estudio: persiste mientras la aplicación está abierta y se retoma al volver a la pantalla.
// ronda: { preguntas, resultados, elegidas, pos, guardada, foto } de la especie en curso (null si aún no se arma).
const sesion = { modo: 'cuestionario', cola: [], indice: 0, respuestas: [], ronda: null, terminada: false };

const enCurso = s => s.cola.length > 0 && s.indice < s.cola.length;
const reiniciar = s => Object.assign(s, { cola: [], indice: 0, respuestas: [], ronda: null, terminada: false });

function resumenEstados(especies) {
  const c = { se: 0, falta: 0, no: 0, sin: 0 };
  for (const e of especies) c[e.aprendizaje ?? 'sin']++;
  return `${c.se} sabidas · ${c.falta + c.no} por repasar · ${c.sin} sin evaluar`;
}

function estadosDeAlcance(alcance) {
  if (alcance === 'pendientes') return ['falta', 'no'];
  if (alcance === 'sin') return ['sin'];
  return null;
}

const nombreEn = (texto, tipo) => (tipo === 'nombre' ? el('i', {}, texto) : texto);

// Galería deslizable con indicador. azar: empieza en una foto al azar (índice dado).
function galeriaDe(fotos, inicio = 0) {
  const galeria = el('div', { class: 'galeria galeria-estudio' },
    ...fotos.map(f => el('img', {
      src: urlDe(`foto-${f.id}`, f.blob), alt: '',
      style: f.ancho && f.alto ? `aspect-ratio: ${f.ancho} / ${f.alto}` : null,
    })));
  const indicador = el('p', { class: 'indicador' }, fotos.length > 1 ? `Foto ${inicio + 1} de ${fotos.length}` : '');
  galeria.addEventListener('scroll', () => {
    if (!fotos.length) return;
    const anchoFoto = galeria.firstElementChild?.getBoundingClientRect().width || 1;
    const idx = Math.min(fotos.length - 1, Math.max(0, Math.round(galeria.scrollLeft / anchoFoto)));
    indicador.textContent = fotos.length > 1 ? `Foto ${idx + 1} de ${fotos.length}` : '';
  });
  if (inicio > 0) {
    const ir = () => {
      const img = galeria.children[inicio];
      if (img) galeria.scrollLeft = img.getBoundingClientRect().left - galeria.getBoundingClientRect().left + galeria.scrollLeft;
    };
    requestAnimationFrame(ir);
    galeria.children[inicio]?.addEventListener('load', ir, { once: true });
  }
  return [galeria, indicador];
}

export async function render(cont, ctx, especieFija) {
  const { db, navegar } = ctx;
  const [todas, conFoto, petalos] = await Promise.all([db.especies.toArray(), especiesConFoto(db), valoresPetalos(db)]);
  const ctxFiltro = { conFoto };
  const OPCIONES = opcionesFiltro({ todas, petalos });

  const filtroActual = () => ({ ...memoria.estado().filtro, texto: '' });
  const ajuste = (campo, defecto) => memoria.estado()[campo] ?? defecto;
  const estadosActuales = () => estadosDeAlcance(ajuste('alcance', 'todas'));
  const conEstados = c => {
    const estados = estadosActuales();
    return estados ? c.filter(e => estados.includes(e.aprendizaje ?? 'sin')) : c;
  };
  const contarCon = filtro => conEstados(candidatas(todas, conFoto, filtro)).length;
  const listaActual = () => conEstados(candidatas(todas, conFoto, filtroActual()));

  // ---------- Inicio ----------

  function inicio() {
    reiniciar(sesion);
    const principales = el('div', { class: 'filtros-principales' });
    const chips = el('div', { class: 'chips' });
    const etiquetaFiltros = el('span', {}, 'Filtros');
    const botonFiltros = el('button', { type: 'button', class: 'pildora boton-filtros', onclick: () => abrirHoja() }, icono('filtros', { tam: 18 }), etiquetaFiltros);
    const bloqueModo = el('div', { class: 'segmentos', role: 'group', 'aria-label': 'Modo' });
    const bloqueAlcance = el('div', { class: 'segmentos', role: 'group', 'aria-label': 'Especies' });
    const bloqueCantidad = el('div', { class: 'segmentos', role: 'group', 'aria-label': 'Cantidad' });
    const disponibles = el('p', { class: 'disponibles', 'aria-live': 'polite' });
    const comenzar = el('button', { type: 'button', class: 'btn primario', onclick: () => iniciarSesion() }, 'Comenzar');

    function cambiarFiltro(cambio) {
      const nuevo = { ...filtroActual(), ...cambio, texto: '' };
      if (nuevo.sitio !== SITIO_AI) nuevo.registroAI = '';
      memoria.actualizar({ filtro: nuevo });
      pintar();
    }
    function cambiarAjuste(campo, valor) { memoria.actualizar({ [campo]: valor }); pintar(); }

    function segmentos(bloque, opciones, campo, defecto) {
      const actual = ajuste(campo, defecto);
      bloque.replaceChildren(...opciones.map(([valor, texto]) => el('button', {
        type: 'button', 'aria-pressed': String(actual === valor), class: actual === valor ? 'segmento activo' : 'segmento',
        onclick: () => cambiarAjuste(campo, valor),
      }, texto)));
    }

    function pintar() {
      const filtro = filtroActual();
      const activos = filtrosActivos(filtro);
      const otros = activos.filter(({ clave }) => !PRINCIPALES.includes(clave)).length;
      etiquetaFiltros.textContent = otros ? `Filtros · ${otros}` : 'Filtros';
      botonFiltros.classList.toggle('activo', otros > 0);
      principales.replaceChildren(...PRINCIPALES.map(clave => selectorFiltro({
        clave, vacio: TITULOS[clave], OPCIONES, todas, ctxFiltro, filtro,
        alCambiar: valor => cambiarFiltro({ [clave]: valor }),
      })));
      // replaceChildren convierte null en el texto "null": solo se pasan nodos.
      chips.replaceChildren(...[
        ...activos.filter(({ clave }) => !PRINCIPALES.includes(clave)).map(({ clave, valor }) => el('button', {
          type: 'button', class: 'chip', 'aria-label': `Quitar ${TITULOS[clave]}`,
          onclick: () => cambiarFiltro({ [clave]: '' }),
        }, `${TITULOS[clave]}: ${etiquetaFiltro(OPCIONES, clave, valor)}`, icono('cerrar', { tam: 14 }))),
        activos.length ? el('button', { type: 'button', class: 'chip limpiar', onclick: () => {
          memoria.limpiarFiltros();
          pintar();
        } }, 'Limpiar todo') : null,
      ].filter(Boolean));
      segmentos(bloqueModo, MODOS, 'modo', 'cuestionario');
      segmentos(bloqueAlcance, ALCANCES, 'alcance', 'todas');
      segmentos(bloqueCantidad, CANTIDADES, 'cantidad', 20);
      const n = contarCon(filtro);
      disponibles.textContent = n === 1 ? '1 especie con foto entra' : `${n} especies con foto entran`;
      disponibles.classList.toggle('vacio', n === 0);
      comenzar.disabled = n === 0;
    }

    function abrirHoja() {
      abrirHojaFiltros({
        OPCIONES, todas, ctxFiltro,
        leerFiltro: filtroActual,
        contar: filtro => contarCon(filtro),
        cambiar: filtro => cambiarFiltro(filtro),
        limpiar: () => { memoria.limpiarFiltros(); pintar(); },
      });
    }

    function usarFiltrosDeLaLista() {
      const nuevo = { ...memoriaLista.estado().filtro, texto: '' };
      if (nuevo.sitio !== SITIO_AI) nuevo.registroAI = '';
      memoria.actualizar({ filtro: nuevo });
      pintar();
      aviso('Filtros de la lista aplicados');
    }

    cont.replaceChildren(
      el('header', { class: 'cabecera' }, el('h1', {}, 'Estudio'), el('p', { class: 'contador' }, resumenEstados(todas))),
      el('section', { class: 'bloque-estudio' }, el('h2', {}, 'Modo'), bloqueModo),
      el('section', { class: 'bloque-estudio' },
        el('h2', {}, 'Filtros'),
        el('div', { class: 'filtros-fila' }, botonFiltros, principales),
        chips,
        el('button', { type: 'button', class: 'enlace', onclick: usarFiltrosDeLaLista }, 'Usar los filtros de la lista')),
      el('section', { class: 'bloque-estudio' }, el('h2', {}, 'Especies'), bloqueAlcance),
      el('section', { class: 'bloque-estudio' }, el('h2', {}, 'Cantidad'), bloqueCantidad),
      disponibles,
      el('div', { class: 'acciones' }, comenzar));
    pintar();
  }

  function iniciarSesion() {
    const cantidad = ajuste('cantidad', 20);
    const n = cantidad === 'todas' ? Infinity : cantidad;
    const cola = armarSesion(listaActual(), { n, estados: null, rng: Math.random });
    if (!cola.length) { aviso('No hay especies con foto para esta selección', 4000); return; }
    reiniciar(sesion);
    sesion.modo = ajuste('modo', 'cuestionario') === 'repasar' ? 'repasar' : 'cuestionario';
    sesion.cola = cola;
    mostrar();
  }

  function mostrar() {
    window.scrollTo(0, 0);
    if (!enCurso(sesion)) { pantallaFinal(); return; }
    const e = sesion.cola[sesion.indice];
    if (sesion.modo === 'repasar') pantallaRepaso(e, sesion.indice + 1, sesion.cola.length);
    else tarjeta(sesion, e);
  }

  // ---------- Tarjeta de cuestionario ----------

  // s: sesión de módulo o, en #/estudio?especie=<id>, una sesión local de una sola especie (fija).
  async function tarjeta(s, e, { fija = false } = {}) {
    const fotos = await fotosDe(db, e.id);
    if (!s.ronda) {
      s.ronda = {
        preguntas: armarRonda(e, todas, Math.random), resultados: [], elegidas: [], pos: 0, guardada: false, guardando: false,
        foto: fotos.length ? Math.floor(Math.random() * fotos.length) : 0,
      };
    }
    const r = s.ronda;
    const N = s.cola.length;
    const i = s.indice + 1;
    // La galería se arma una sola vez por especie: pasar de pregunta solo repinta la zona de abajo.
    const [galeria, indicador] = galeriaDe(fotos, r.foto);
    const terminar = () => (fija ? navegar(`#/ficha/${e.id}`) : terminarSesion());
    const puntos = el('span', {});
    const nombreRonda = el('div', {});
    const zona = el('div', {});
    const cabecera = el('div', { class: 'avance' },
      el('div', { class: 'avance-fila' },
        el('p', {}, fija ? 'Una especie' : `Especie ${i} de ${N}`, puntos),
        fija ? null : el('button', { type: 'button', class: 'btn chico terminar', onclick: terminar }, 'Terminar sesión')),
      fija ? null : el('progress', { max: N, value: i - 1 }));
    const volver = fija ? barraSuperior({ alVolver: () => volverA(ctx, `#/ficha/${e.id}`) }) : null;
    cont.replaceChildren(...[volver, cabecera, galeria, indicador, nombreRonda, zona].filter(Boolean));

    function pintar() {
      puntos.textContent = ` · Pregunta ${Math.min(r.pos + 1, r.preguntas.length)} de ${r.preguntas.length}`;
      nombreRonda.replaceChildren(r.resultados.length > 0 || r.pos >= r.preguntas.length
        ? el('p', { class: 'nombre-ronda' }, el('i', {}, e.nombre)) : '');
      if (r.pos >= r.preguntas.length) pintarFin();
      else pintarPregunta();
    }

    function pintarPregunta() {
      const p = r.preguntas[r.pos];
      const respondida = r.resultados.length > r.pos;
      const anuncio = el('p', { class: 'resultado-ronda', 'aria-live': 'polite' });
      const siguiente = el('button', { type: 'button', class: 'btn primario', hidden: !respondida, onclick: () => {
        if (siguiente.disabled) return;
        siguiente.disabled = true;
        r.pos++;
        pintar();
      } }, r.pos === r.preguntas.length - 1 ? 'Ver resultado' : 'Siguiente pregunta');
      const botones = p.alternativas.map(alt => el('button', {
        type: 'button', class: 'alternativa', onclick: () => responder(alt),
      }, nombreEn(alt, p.tipo)));

      function marcar(elegida) {
        botones.forEach((b, k) => {
          const alt = p.alternativas[k];
          b.disabled = true;
          if (alt === p.correcta) b.classList.add('correcta');
          else if (alt === elegida) b.classList.add('incorrecta');
          else b.classList.add('atenuada');
        });
        const acierto = elegida === p.correcta;
        anuncio.className = `resultado-ronda ${acierto ? 'ok' : 'mal'}`;
        if (acierto) anuncio.replaceChildren('Correcto');
        else anuncio.replaceChildren('Era: ', nombreEn(p.correcta, p.tipo));
        siguiente.hidden = false;
      }

      function responder(elegida) {
        if (r.resultados.length > r.pos) return;
        r.resultados.push({ tipo: p.tipo, acierto: elegida === p.correcta });
        r.elegidas.push(elegida);
        marcar(elegida);
        if (r.pos === r.preguntas.length - 1) guardarRonda(s, e);
        siguiente.focus({ preventScroll: true });
        // El resultado y "Siguiente" deben quedar sobre la barra inferior.
        requestAnimationFrame(() => siguiente.scrollIntoView({ block: 'end', behavior: 'smooth' }));
      }

      zona.replaceChildren(
        el('h2', { class: 'enunciado' }, p.enunciado),
        el('div', { class: 'alternativas' }, ...botones),
        anuncio,
        el('div', { class: 'acciones' }, siguiente));
      if (respondida) marcar(r.elegidas[r.pos]);
    }

    async function pintarFin() {
      const aciertos = r.resultados.filter(x => x.acierto).length;
      const esUltima = s.indice === s.cola.length - 1;
      const filas = r.preguntas.map((p, k) => {
        const bien = r.resultados[k]?.acierto;
        return el('li', { class: bien ? 'ok' : 'mal' },
          el('span', { class: 'marca', role: 'img', 'aria-label': bien ? 'Acertaste' : 'Fallaste' }, bien ? '✓' : '✗'),
          el('div', {}, el('small', {}, p.enunciado), el('p', {}, nombreEn(p.correcta, p.tipo))));
      });
      const siguiente = el('button', { type: 'button', class: 'btn primario', disabled: !r.guardada, onclick: () => {
        if (siguiente.disabled) return;
        siguiente.disabled = true;
        s.indice++;
        s.ronda = null;
        if (esUltima) s.terminada = true;
        mostrar();
      } }, esUltima ? 'Ver resultado' : 'Siguiente especie');
      const fallo = el('div', { class: 'diagnostico', hidden: r.guardada || r.guardando },
        el('p', {}, 'No se pudo guardar el resultado de esta especie.'),
        el('button', { type: 'button', class: 'btn', onclick: async () => { await guardarRonda(s, e); pintar(); } }, 'Reintentar'));
      zona.replaceChildren(
        el('div', { class: `marcador ${resultadoRonda(r.resultados)}` },
          el('h2', {}, `${aciertos} de ${r.preguntas.length}`),
          el('p', {}, resultadoRonda(r.resultados) === 'perfecta' ? 'Ronda perfecta' : 'Para repasar')),
        el('ul', { class: 'resultado-lista' }, ...filas),
        e.diagnostico ? el('div', { class: 'diagnostico' }, el('h2', {}, 'Rasgo para reconocerla'), el('p', {}, e.diagnostico)) : null,
        fallo,
        el('div', { class: 'acciones' },
          fija
            ? el('button', { type: 'button', class: 'btn primario', onclick: () => volverA(ctx, `#/ficha/${e.id}`) }, 'Volver a la ficha')
            : [el('a', { class: 'btn', href: `#/ficha/${e.id}` }, 'Ver ficha'), siguiente]));
      // Si el guardado de la última pregunta falló o sigue en curso, se reintenta/espera aquí; la especie no pasa hasta quedar guardada.
      if (r.guardando) { while (r.guardando) await new Promise(res => setTimeout(res, 50)); pintar(); }
      else if (!r.guardada) { await guardarRonda(s, e); if (r.guardada) pintar(); else fallo.hidden = false; }
    }

    pintar();
  }

  async function guardarRonda(s, e) {
    const r = s.ronda;
    if (r.guardada || r.guardando) return;
    r.guardando = true;
    try {
      const fresca = (await obtenerEspecie(db, e.id)) ?? e;
      await db.especies.put(calificarRonda(fresca, r.resultados, ahora()));
      r.guardada = true;
      s.respuestas.push({
        id: e.id, resultado: resultadoRonda(r.resultados),
        correctas: r.resultados.filter(x => x.acierto).length, preguntas: r.resultados.length,
        fallados: r.resultados.filter(x => !x.acierto).map(x => x.tipo),
      });
    } catch {
      aviso('No se pudo guardar el resultado de esta especie', 4000);
    } finally {
      r.guardando = false;
    }
  }

  function terminarSesion() {
    if (sesion.respuestas.length) { sesion.terminada = true; sesion.indice = sesion.cola.length; sesion.ronda = null; pantallaFinal(); }
    else inicio();
  }

  // ---------- Repasar ----------

  async function pantallaRepaso(e, i, N) {
    const fotos = await fotosDe(db, e.id);
    const [galeria, indicador] = galeriaDe(fotos, 0);
    const esUltima = i === N;
    const anterior = el('button', { class: 'btn', disabled: i === 1, onclick: () => {
      if (sesion.indice > 0) { sesion.indice--; mostrar(); }
    } }, 'Anterior');
    const siguiente = el('button', { class: 'btn primario', onclick: () => {
      if (esUltima) inicio();
      else { sesion.indice++; mostrar(); }
    } }, esUltima ? 'Terminar' : 'Siguiente');
    cont.replaceChildren(
      el('div', { class: 'avance' },
        el('div', { class: 'avance-fila' }, el('p', {}, `Especie ${i} de ${N}`),
          el('button', { type: 'button', class: 'btn chico terminar', onclick: inicio }, 'Terminar sesión')),
        el('progress', { max: N, value: i - 1 })),
      galeria, indicador,
      el('p', { class: 'respuesta' }, el('i', {}, e.nombre)),
      el('p', {}, `${e.familia || 'sin dato'} · ${e.habito || 'sin dato'}`),
      el('div', { class: 'acciones' }, anterior, siguiente));
  }

  // ---------- Fin de sesión ----------

  async function repetirFalladas() {
    const r = resumenSesion(sesion.respuestas);
    const especies = (await Promise.all(r.falladas.map(id => obtenerEspecie(db, id)))).filter(Boolean);
    reiniciar(sesion);
    sesion.cola = especies;
    mostrar();
  }

  async function pantallaFinal() {
    const r = resumenSesion(sesion.respuestas);
    const minis = await miniaturasPrimeras(db);
    const tipos = tiposFalladosPorId(sesion.respuestas);
    const falladas = (await Promise.all(r.falladas.map(id => obtenerEspecie(db, id)))).filter(Boolean);
    const perfectas = r.aciertos;
    const listaFalladas = el('ul', { class: 'resumen' },
      ...falladas.map(e => el('li', {},
        el('a', { href: `#/ficha/${e.id}` },
          minis.has(e.id) ? el('img', { src: urlDe(`mini-${e.id}`, minis.get(e.id)), alt: '' }) : el('span', { class: 'sin-mini' }),
          el('div', { class: 'texto' }, el('i', {}, e.nombre),
            el('small', {}, `Fallaste: ${(tipos.get(e.id) ?? []).map(t => ETIQUETAS_TIPO[t]).join(', ') || 'algo'}`))))));
    cont.replaceChildren(
      el('header', { class: 'cabecera' }, el('h1', {}, 'Sesión terminada')),
      el('div', { class: 'marcador' },
        el('h2', {}, `Acertaste ${r.correctas} de ${r.preguntas} preguntas`),
        el('p', {}, `${perfectas} de ${sesion.respuestas.length} especies perfectas`)),
      falladas.length ? el('h2', { class: 'subtitulo' }, 'Para repasar') : null,
      falladas.length ? listaFalladas : el('p', { class: 'contador' }, 'Sin errores en esta sesión.'),
      el('div', { class: 'acciones' },
        falladas.length ? el('button', { type: 'button', class: 'btn primario', onclick: repetirFalladas }, 'Repetir las falladas') : null,
        el('button', { type: 'button', class: 'btn', onclick: inicio }, 'Volver')));
  }

  // ---------- Entrada ----------

  if (especieFija) {
    const e = await obtenerEspecie(db, especieFija);
    if (!e) { navegar('#/lista'); return; }
    await tarjeta({ cola: [e], indice: 0, respuestas: [], ronda: null }, e, { fija: true });
  } else if (sesion.terminada) {
    await pantallaFinal();
  } else if (enCurso(sesion)) {
    mostrar();
  } else {
    inicio();
  }
}
