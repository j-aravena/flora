# Flora offline 1.5 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estudio como cuestionario de rondas con filtros, estilo "bosque" claro/oscuro sobre la estructura de Raycast, y relleno de datos faltantes con procedencia marcada.

**Architecture:** Lógica pura nueva en `tema.js` y `quiz.js` (probada en vitest); componentes de filtros compartidos en `ui/filtros-ui.js`; `styles.css` reescrito sobre tokens; paquete `semilla/complementos.zip` construido por `tools/completar_datos.py` y aplicado por `aplicarComplementos` en `db.js`.

**Tech Stack:** Módulos ES sin build, Dexie 4, vitest (node + fake-indexeddb, sin DOM), Python 3 + pytest, Inter variable woff2.

**Spec:** `docs/superpowers/specs/2026-11-23-v1-5-estudio-estilo-datos-design.md` (autoridad; leer la sección que cita cada tarea).

## Global Constraints

- Rama `v1.5`. No push, no merge, no publicar.
- Sin dependencias nuevas de runtime salvo el archivo de fuente Inter (OFL) en `vendor/inter/`.
- Textos de interfaz en español de Chile, como el resto de la app. Nombres científicos en itálica.
- Controles táctiles de al menos 48px de alto.
- No tocar `sw.js` ni `version.js`/`package.json` salvo en la Tarea 8 (ARCHIVOS y versión se actualizan una sola vez al final).
- `styles.css` solo lo editan las Tareas 2 y 5 (la 6 agrega su bloque al final, marcado `/* Complementos */`).
- Pruebas: `npx vitest run` (hoy 60) y `.venv/Scripts/python -m pytest -q` (hoy 114 + 1 skipped) deben quedar verdes al terminar cada tarea. `node --check` sobre cada JS tocado.
- Commits en español terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Nada de `localStorage` sin `try/catch`.

## Mapa de archivos

| Archivo | Tarea | Responsabilidad |
|---|---|---|
| `tema.js` (nuevo) | 1 | preferencia de tema, pura |
| `index.html` | 1 | script en línea que aplica el tema antes de pintar |
| `ui/ajustes.js` | 1 | sección Apariencia |
| `styles.css` | 2, 5, 6 | tokens + componentes; quiz (5); marcas de complemento (6) |
| `vendor/inter/*` (nuevo) | 2 | fuente Inter + licencia |
| `ui/dom.js` | 2 | `tinteFondo` sobre `--superficie` |
| `tools/contraste.py` (nuevo) | 2 | verificación WCAG de tokens |
| `ui/memoria.js` | 3 | `crearMemoria(obtenerAlmacen, clave)` |
| `ui/filtros-ui.js` (nuevo) | 3 | selector de filtro y hoja "Más filtros" compartidos |
| `ui/lista.js` | 3 | usa `filtros-ui.js` (sin cambio visible) |
| `quiz.js` (nuevo) | 4 | rondas, alternativas, calificación |
| `study.js` | 4 | `candidatas` con filtro, `resumenSesion` extendido |
| `ui/estudio.js` | 5 | pantalla de cuestionario, repaso y fin de sesión |
| `db.js` | 6 | `aplicarComplementos`, defaults nuevos |
| `app.js` | 6 | aplicar complementos tras listados |
| `ui/ficha.js`, `ui/editar.js` | 6 | marca ⓘ y "Confirmar" |
| `tools/completar_datos.py` | 7 | `construir`: validar lotes y armar el zip |
| `semilla/complementos.zip`, `docs/informe-complementos.md` | 8 | datos |
| `sw.js`, `version.js`, `package.json`, `README.md` | 8 | versión 1.5.0 |

Dependencias: 5 requiere 2, 3 y 4. 8 requiere 6, 7 y la investigación de datos. 1, 2, 3, 4, 6 y 7 son independientes entre sí (archivos disjuntos, salvo el bloque final de `styles.css` de la 6).

---

### Tarea 1: Tema claro/oscuro

**Files:** Create `tema.js`, `tests/tema.test.js`. Modify `index.html`, `ui/ajustes.js`.

**Interfaces — Produces:** `TEMAS`, `CLAVE_TEMA`, `leerTema(almacen)`, `guardarTema(almacen, valor)`, `temaEfectivo(preferencia, oscuroDelSistema)`, `aplicarTema(preferencia)` (esta última usa `document`; no se prueba en vitest).

- [ ] **Step 1: test**

```js
// tests/tema.test.js
import { describe, it, expect } from 'vitest';
import { TEMAS, CLAVE_TEMA, leerTema, guardarTema, temaEfectivo } from '../tema.js';

function almacen(inicial = {}) {
  const d = { ...inicial };
  return { getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, d };
}

describe('tema', () => {
  it('TEMAS ofrece auto, claro y oscuro con etiquetas', () => {
    expect(TEMAS.map(([v]) => v)).toEqual(['auto', 'claro', 'oscuro']);
  });
  it('leerTema devuelve auto sin dato, con dato inválido o si el almacén falla', () => {
    expect(leerTema(almacen())).toBe('auto');
    expect(leerTema(almacen({ [CLAVE_TEMA]: 'rosa' }))).toBe('auto');
    expect(leerTema({ getItem: () => { throw new Error('bloqueado'); } })).toBe('auto');
    expect(leerTema(almacen({ [CLAVE_TEMA]: 'oscuro' }))).toBe('oscuro');
  });
  it('guardarTema guarda valores válidos y no lanza si el almacén falla', () => {
    const a = almacen();
    guardarTema(a, 'claro');
    expect(a.d[CLAVE_TEMA]).toBe('claro');
    expect(() => guardarTema(a, 'rosa')).toThrow();
    expect(() => guardarTema({ setItem: () => { throw new Error('x'); } }, 'claro')).not.toThrow();
  });
  it('temaEfectivo resuelve auto con la preferencia del sistema', () => {
    expect(temaEfectivo('auto', true)).toBe('oscuro');
    expect(temaEfectivo('auto', false)).toBe('claro');
    expect(temaEfectivo('claro', true)).toBe('claro');
    expect(temaEfectivo('oscuro', false)).toBe('oscuro');
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/tema.test.js` → FAIL (módulo no existe).
- [ ] **Step 3: implementación**

```js
// tema.js — Preferencia de tema (spec 1.5 §3.2). Sin dependencias; aplicarTema toca el DOM.
export const CLAVE_TEMA = 'flora.tema';
export const TEMAS = [['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']];
const VALIDOS = TEMAS.map(([v]) => v);
export const COLOR_BARRA = { claro: '#f3f5f0', oscuro: '#0a0d0b' };

export function leerTema(almacen) {
  try {
    const v = almacen.getItem(CLAVE_TEMA);
    return VALIDOS.includes(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function guardarTema(almacen, valor) {
  if (!VALIDOS.includes(valor)) throw new Error(`Tema desconocido: ${valor}`);
  try { almacen.setItem(CLAVE_TEMA, valor); } catch { /* sin persistencia */ }
}

export function temaEfectivo(preferencia, oscuroDelSistema) {
  if (preferencia === 'claro' || preferencia === 'oscuro') return preferencia;
  return oscuroDelSistema ? 'oscuro' : 'claro';
}

// Aplica la preferencia: con 'auto' quita el atributo y deja que mande prefers-color-scheme.
export function aplicarTema(preferencia) {
  const raiz = document.documentElement;
  if (preferencia === 'auto') raiz.removeAttribute('data-tema');
  else raiz.setAttribute('data-tema', preferencia);
  const oscuro = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOR_BARRA[temaEfectivo(preferencia, oscuro)]);
}
```

- [ ] **Step 4:** `index.html`: reemplazar `<meta name="theme-color" content="#2f6b3a">` por `<meta name="theme-color" content="#f3f5f0">` y agregar justo después, en `<head>`, un script en línea clásico (no módulo) que replique la lógica sin importar nada (debe correr antes de `styles.css`):

```html
  <script>
    // Aplica el tema guardado antes de pintar (misma lógica que tema.js).
    (function () {
      var t = 'auto';
      try { t = localStorage.getItem('flora.tema') || 'auto'; } catch (e) {}
      var oscuro = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
      if (t === 'claro' || t === 'oscuro') document.documentElement.setAttribute('data-tema', t);
      var efectivo = t === 'claro' || t === 'oscuro' ? t : (oscuro ? 'oscuro' : 'claro');
      document.querySelector('meta[name="theme-color"]').setAttribute('content', efectivo === 'oscuro' ? '#0a0d0b' : '#f3f5f0');
    })();
  </script>
```

- [ ] **Step 5:** `ui/ajustes.js`: agregar al inicio de la pantalla (antes de la sección de respaldo) una sección `el('section', {}, el('h2', {}, 'Apariencia'), el('label', {}, 'Tema', <select>))` con las opciones de `TEMAS`, seleccionada la de `leerTema(localStorage)`; `onchange` → `guardarTema(globalThis.localStorage, v); aplicarTema(v);`. Envolver el acceso a `localStorage` como lo hace `leerTema` (pasar `globalThis.localStorage`; si el getter mismo lanza, capturarlo con try/catch y usar un almacén nulo `{ getItem: () => null, setItem() {} }`).
- [ ] **Step 6:** `npx vitest run` (todo verde), `node --check tema.js ui/ajustes.js`.
- [ ] **Step 7: commit** `Tema claro/oscuro: preferencia guardada, aplicada antes de pintar y elegible en Ajustes`.

---

### Tarea 2: Estilo "bosque" sobre tokens

**Files:** Rewrite `styles.css`. Create `vendor/inter/InterVariable-latin.woff2`, `vendor/inter/LICENSE.txt`, `tools/contraste.py`, `tools/tests/test_contraste.py`. Modify `ui/dom.js` (solo `tinteFondo`).

Leer spec §3 completa: es la autoridad de valores (tabla de tokens 3.1, radios y reglas 3.3, tipografía 3.4).

- [ ] **Step 1: fuente.** Obtener Inter variable latin woff2 y su licencia OFL. Vía recomendada: `npm pack @fontsource-variable/inter@5.1.0` en el scratchpad (si esa versión no existe, `npm view @fontsource-variable/inter versions` y usar la última 5.x publicada hace más de 2 semanas), extraer `files/inter-latin-wght-normal.woff2` → `vendor/inter/InterVariable-latin.woff2` y `LICENSE` → `vendor/inter/LICENSE.txt`. No agregar el paquete a `package.json`.
- [ ] **Step 2: test de contraste (pytest)**

```python
# tools/tests/test_contraste.py
from contraste import contraste, tokens_de_css, verificar

def test_contraste_conocido():
    assert round(contraste('#000000', '#ffffff'), 1) == 21.0
    assert round(contraste('#2f6b3a', '#ffffff'), 2) > 4.5

def test_tokens_de_css_lee_claro_y_oscuro():
    css = (":root { --fondo: #f3f5f0; --texto: #18211a; }\n"
           ":root[data-tema=\"oscuro\"] { --fondo: #0a0d0b; --texto: #eef3ee; }\n")
    t = tokens_de_css(css)
    assert t['claro']['--fondo'] == '#f3f5f0'
    assert t['oscuro']['--texto'] == '#eef3ee'

def test_styles_css_cumple_aa():
    assert verificar('styles.css') == []
```

- [ ] **Step 3: `tools/contraste.py`**

```python
"""Contraste WCAG de los tokens de styles.css en tema claro y oscuro (spec 1.5 §3.1)."""
import re
import sys
from pathlib import Path

PARES = [  # (texto, fondo) que deben cumplir 4.5:1
    ('--texto', '--fondo'), ('--texto', '--superficie'), ('--texto-suave', '--fondo'),
    ('--texto-suave', '--superficie'), ('--acento', '--superficie'), ('--acento-texto', '--acento'),
    ('--ambar', '--ambar-suave'), ('--rojo', '--rojo-suave'), ('--azul', '--azul-suave'), ('--acento', '--acento-suave'),
]


def _lineal(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminancia(hex_: str) -> float:
    h = hex_.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * _lineal(r) + 0.7152 * _lineal(g) + 0.0722 * _lineal(b)


def contraste(a: str, b: str) -> float:
    la, lb = sorted((luminancia(a), luminancia(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def _bloque(css: str, selector_regex: str) -> dict:
    m = re.search(selector_regex + r'\s*\{([^}]*)\}', css)
    return dict(re.findall(r'(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})', m.group(1))) if m else {}


def tokens_de_css(css: str) -> dict:
    claro = _bloque(css, r'(?m)^:root')
    oscuro = {**claro, **_bloque(css, r':root\[data-tema="oscuro"\]')}
    return {'claro': claro, 'oscuro': oscuro}


def verificar(ruta='styles.css') -> list[str]:
    errores = []
    for tema, t in tokens_de_css(Path(ruta).read_text(encoding='utf-8')).items():
        for texto, fondo in PARES:
            if texto not in t or fondo not in t:
                errores.append(f'{tema}: falta {texto} o {fondo}')
                continue
            c = contraste(t[texto], t[fondo])
            if c < 4.5:
                errores.append(f'{tema}: {texto} sobre {fondo} = {c:.2f} < 4.5')
    return errores


if __name__ == '__main__':
    e = verificar(sys.argv[1] if len(sys.argv) > 1 else 'styles.css')
    print('\n'.join(e) or 'Contraste AA: OK')
    sys.exit(1 if e else 0)
```

Nota: el bloque `@media (prefers-color-scheme: dark) { :root:not([data-tema="claro"]) { ... } }` debe repetir exactamente los mismos valores que `:root[data-tema="oscuro"]`; el script lee este último. Si algún par de la tabla del spec no da 4.5, ajustar el valor oscureciendo/aclarando lo mínimo y anotarlo en el reporte (el spec manda en intención, el contraste AA manda en el valor exacto).

- [ ] **Step 4: reescribir `styles.css`.** Estructura obligatoria, en este orden:
  1. `@font-face` Inter (`src: url('vendor/inter/InterVariable-latin.woff2') format('woff2'); font-weight: 100 900; font-display: swap;`).
  2. `:root` con tokens claros de la tabla 3.1 + `--radio-ctrl: 8px; --radio-tarjeta: 16px; --radio-pildora: 9999px; --radio-insignia: 6px; --barra: 64px;` y alias `--se: var(--acento); --falta: var(--ambar); --no: var(--rojo); --sin: var(--texto-tenue); --verde: var(--acento); --tarjeta: var(--superficie); --gris: var(--texto-tenue);` (los alias mantienen funcionando reglas o JS que aún los nombren). `color-scheme: light;`
  3. `:root[data-tema="oscuro"] { ...tokens oscuros...; color-scheme: dark; }` y el mismo bloque dentro de `@media (prefers-color-scheme: dark) { :root:not([data-tema="claro"]) { ... } }`.
  4. Base (`body` con `font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-feature-settings: 'calt', 'kern', 'liga';`, `background: var(--fondo)`, `color: var(--texto)`), formularios, botones, y luego todos los componentes que hoy existen (conservar TODOS los selectores actuales: la app los usa), reescritos con tokens.
  5. Reglas de §3.3: sin sombras salvo `.flotante` y `.aviso`; en oscuro las tarjetas (`.notas`, `.diagnostico`, `dialog.hoja`, `.opcion`) llevan `box-shadow: inset 0 1px 0 rgba(255,255,255,.06)`; barra inferior con `backdrop-filter: blur(20px)` y fondo `color-mix(in srgb, var(--superficie) 85%, transparent)`; `.barra a.activa` sin `border-top`: color `--acento` y un indicador `::before` de píldora (32×4px, `--radio-pildora`, `--acento`) centrado sobre el texto; `.contador, .indicador, .recorrido span, progress` con `font-variant-numeric: tabular-nums`; `.insignia` 12px/600 con `--radio-insignia`; chips con `--radio-pildora`; `dialog.hoja` con `--radio-tarjeta` arriba.
  6. Ningún color hex fuera de los bloques de tokens (excepto dentro de `rgba()` de velos/sombras). Comprobar: `grep -nE '#[0-9a-fA-F]{3,6}' styles.css` solo debe mostrar líneas de los bloques de tokens.
- [ ] **Step 5:** `ui/dom.js` `tinteFondo`: `var(--tarjeta)` → `var(--superficie)`.
- [ ] **Step 6:** `.venv/Scripts/python -m pytest -q` (incluye contraste), `npx vitest run`, `node --check ui/dom.js`. Anotar en el reporte la tabla final de contrastes (`PYTHONPATH=tools .venv/Scripts/python tools/contraste.py`).
- [ ] **Step 7: commit** `Estilo bosque: tokens claro/oscuro, Inter, bordes finos y radios del sistema`.

---

### Tarea 3: Filtros compartidos

**Files:** Create `ui/filtros-ui.js`. Modify `ui/lista.js`, `ui/memoria.js`, `tests/memoria.test.js`.

**Interfaces — Produces** (`ui/filtros-ui.js`):
- `TITULOS`, `PRINCIPALES`, `SECCIONES` (movidos tal cual desde `ui/lista.js`).
- `opcionesFiltro({ todas, petalos }) -> OPCIONES` (el objeto `OPCIONES` que hoy arma `render` de la lista).
- `etiquetaFiltro(OPCIONES, clave, valor) -> string`.
- `visibleCon(filtro) -> (clave) => boolean` (registroAI solo con sitio 'Chacao Chonchi').
- `selectorFiltro({ clave, vacio, OPCIONES, todas, ctxFiltro, filtro, alCambiar }) -> HTMLSelectElement` — `alCambiar(valor)`.
- `abrirHojaFiltros({ titulo, OPCIONES, todas, ctxFiltro, leerFiltro, cambiar, limpiar })` — `leerFiltro()` devuelve el filtro actual; `cambiar({ [clave]: valor })` aplica un cambio; `limpiar()` limpia. Contiene el `dialog.hoja` con el manejo de historial/popstate actual SIN cambios de comportamiento.
- `crearMemoria(obtenerAlmacen, clave = CLAVE_MEMORIA)` en `ui/memoria.js` (segundo parámetro nuevo, por defecto el actual).

- [ ] **Step 1: test** en `tests/memoria.test.js`, agregar:

```js
it('crearMemoria acepta otra clave y no pisa la de la lista', () => {
  const d = {};
  const almacen = { getItem: k => d[k] ?? null, setItem: (k, v) => { d[k] = v; } };
  const otra = crearMemoria(() => almacen, 'flora.estudio');
  otra.actualizar({ filtro: { ...otra.estado().filtro, sitio: 'STP' } });
  expect(JSON.parse(d['flora.estudio']).filtro.sitio).toBe('STP');
  expect(d['flora.lista']).toBeUndefined();
});
```

- [ ] **Step 2:** correr → FAIL. **Step 3:** en `ui/memoria.js` cambiar la firma a `crearMemoria(obtenerAlmacen, clave = CLAVE_MEMORIA)` y usar `clave` en `getItem/setItem`. Correr → PASS.
- [ ] **Step 4:** crear `ui/filtros-ui.js` moviendo desde `ui/lista.js`: `TITULOS`, `PRINCIPALES`, `SECCIONES`, `etiquetaPetalos`, `pares`, la construcción de `OPCIONES`, `etiqueta`, `visible`, `selectorFiltro` y el cuerpo de `abrirHoja` (parametrizado como en Interfaces). `ui/lista.js` importa y usa estas funciones; su `cambiar`/`limpiar` siguen siendo los de la lista. El HTML resultante de la lista y la hoja debe ser idéntico al de 1.4.1 (mismas clases, textos y orden).
- [ ] **Step 5:** `npx vitest run`, `node --check ui/filtros-ui.js ui/lista.js ui/memoria.js`. Revisar a mano con `git diff` que no cambió ningún texto visible.
- [ ] **Step 6: commit** `Filtros compartidos: selector y hoja "Más filtros" reutilizables; memoria con clave propia`.

---

### Tarea 4: Lógica del cuestionario

**Files:** Create `quiz.js`, `tests/quiz.test.js`. Modify `study.js`, `tests/study.test.js`.

**Interfaces — Consumes:** `registrarB, barajar, elegirPonderado` (`study.js`), `CATEGORIAS, ORIGENES, HABITOS` (`db.js`), `grupoDe` (`taxonomia.js`), `filtrar` (`filtros.js`).
**Produces:** `TIPOS`, `CAMPO_DE_TIPO`, `tiposDisponibles(e)`, `alternativas(tipo, e, todas, rng)`, `ponderarTipos(e, disponibles, rng)`, `armarRonda(e, todas, rng, maxExtra = 2)`, `calificarRonda(e, resultados, fecha)`, `resultadoRonda(resultados)`; en `study.js`: `candidatas(especies, conFoto, filtro = {})`, `resumenSesion` extendido.

- [ ] **Step 1: tests** `tests/quiz.test.js`

```js
import { describe, it, expect } from 'vitest';
import { TIPOS, tiposDisponibles, alternativas, ponderarTipos, armarRonda, calificarRonda, resultadoRonda } from '../quiz.js';
import { rngSemilla } from '../study.js';

const esp = (id, nombre, extra = {}) => ({ id, nombre, familia: '', habito: '', origen: '', categoriaMMA: '', diagnostico: '', aprendizaje: null, aciertos: 0, fallos: 0, rachaAciertos: 0, ...extra });
const TODAS = [
  esp('a', 'Greigia sphacelata', { familia: 'Bromeliaceae', habito: 'Hierba perenne', origen: 'Endémica', categoriaMMA: 'Vulnerable', diagnostico: 'Roseta espinosa con brácteas rojas.' }),
  esp('b', 'Greigia landbeckii', { familia: 'Bromeliaceae', habito: 'Hierba perenne', diagnostico: 'Hojas más angostas y flores rosadas.' }),
  esp('c', 'Fascicularia bicolor', { familia: 'Bromeliaceae', habito: 'Hierba perenne', diagnostico: 'Epífita con centro rojo.' }),
  esp('d', 'Ochagavia carnea', { familia: 'Bromeliaceae', habito: 'Hierba perenne' }),
  esp('e', 'Carex erinacea', { familia: 'Cyperaceae', habito: 'Hierba perenne', diagnostico: 'Espigas erizadas.' }),
  esp('f', 'Nothofagus dombeyi', { familia: 'Nothofagaceae', habito: 'Árbol', diagnostico: 'Hojas aserradas perennes.' }),
  esp('g', 'Drimys winteri', { familia: 'Winteraceae', habito: 'Árbol' }),
  esp('h', 'Blechnum chilense', { familia: 'Blechnaceae', habito: 'Hierba perenne' }),
];

describe('tiposDisponibles', () => {
  it('lista solo los tipos con dato, sin el nombre', () => {
    expect(tiposDisponibles(TODAS[0]).sort()).toEqual(['categoria', 'diagnostico', 'familia', 'habito', 'origen']);
    expect(tiposDisponibles(TODAS[6]).sort()).toEqual(['familia', 'habito']);
    expect(tiposDisponibles(esp('x', 'Algo'))).toEqual([]);
  });
});

describe('alternativas', () => {
  const rng = rngSemilla(7);
  it.each(['nombre', 'familia', 'categoria', 'diagnostico', 'habito'])('%s: 4 únicas e incluye la correcta', tipo => {
    const a = alternativas(tipo, TODAS[0], TODAS, rng);
    expect(a).toHaveLength(4);
    expect(new Set(a).size).toBe(4);
    const correcta = { nombre: 'Greigia sphacelata', familia: 'Bromeliaceae', categoria: 'Vulnerable', diagnostico: 'Roseta espinosa con brácteas rojas.', habito: 'Hierba perenne' }[tipo];
    expect(a).toContain(correcta);
  });
  it('origen ofrece las 3 opciones', () => {
    expect(alternativas('origen', TODAS[0], TODAS, rng).sort()).toEqual(['Endémica', 'Introducida', 'Nativa']);
  });
  it('nombre prefiere el mismo género y luego la misma familia', () => {
    const a = alternativas('nombre', TODAS[0], TODAS, rngSemilla(1));
    expect(a).toContain('Greigia landbeckii');
    expect(a.filter(n => ['Fascicularia bicolor', 'Ochagavia carnea'].includes(n))).toHaveLength(2);
  });
  it('diagnostico prefiere rasgos de la misma familia', () => {
    const a = alternativas('diagnostico', TODAS[0], TODAS, rngSemilla(3));
    expect(a).toContain('Hojas más angostas y flores rosadas.');
    expect(a).toContain('Epífita con centro rojo.');
  });
  it('categoria no ofrece Rara ni Datos insuficientes como distractor', () => {
    for (let s = 1; s < 20; s++) {
      const a = alternativas('categoria', TODAS[0], TODAS, rngSemilla(s));
      expect(a).not.toContain('Rara');
      expect(a).not.toContain('Datos insuficientes');
    }
  });
});

describe('ponderarTipos', () => {
  it('devuelve todos los disponibles sin repetir, favoreciendo los fallados', () => {
    const e = { ...TODAS[0], fallosPorTipo: { origen: 50 } };
    let primeroOrigen = 0;
    for (let s = 1; s <= 50; s++) {
      const orden = ponderarTipos(e, tiposDisponibles(e), rngSemilla(s));
      expect(new Set(orden).size).toBe(5);
      if (orden[0] === 'origen') primeroOrigen++;
    }
    expect(primeroOrigen).toBeGreaterThan(35);
  });
});

describe('armarRonda', () => {
  it('empieza por el nombre y agrega 2 tipos distintos con al menos 3 alternativas', () => {
    const r = armarRonda(TODAS[0], TODAS, rngSemilla(5));
    expect(r).toHaveLength(3);
    expect(r[0].tipo).toBe('nombre');
    expect(r[0].enunciado).toBe(TIPOS.nombre);
    expect(new Set(r.map(p => p.tipo)).size).toBe(3);
    for (const p of r) {
      expect(p.alternativas.length).toBeGreaterThanOrEqual(3);
      expect(p.alternativas).toContain(p.correcta);
    }
  });
  it('sin datos extra la ronda es solo el nombre', () => {
    expect(armarRonda(esp('x', 'Algo rara'), TODAS, rngSemilla(2)).map(p => p.tipo)).toEqual(['nombre']);
  });
});

describe('calificarRonda y resultadoRonda', () => {
  const f = '2026-11-23T10:00:00.000Z';
  it('todas correctas cuenta como acierto', () => {
    const r = [{ tipo: 'nombre', acierto: true }, { tipo: 'familia', acierto: true }];
    const e = calificarRonda(TODAS[0], r, f);
    expect(e.aciertos).toBe(1);
    expect(e.rachaAciertos).toBe(1);
    expect(resultadoRonda(r)).toBe('perfecta');
  });
  it('nombre incorrecto cuenta como fallo y suma fallosPorTipo', () => {
    const r = [{ tipo: 'nombre', acierto: false }, { tipo: 'origen', acierto: false }];
    const e = calificarRonda({ ...TODAS[0], aprendizaje: 'se' }, r, f);
    expect(e.fallos).toBe(1);
    expect(e.aprendizaje).toBe('falta');
    expect(e.fallosPorTipo).toEqual({ nombre: 1, origen: 1 });
    expect(resultadoRonda(r)).toBe('fallo');
  });
  it('nombre correcto con otro error: sin cambio de nivel y racha a 0', () => {
    const r = [{ tipo: 'nombre', acierto: true }, { tipo: 'familia', acierto: false }];
    const e = calificarRonda({ ...TODAS[0], aprendizaje: 'falta', rachaAciertos: 1 }, r, f);
    expect(e.aprendizaje).toBe('falta');
    expect(e.rachaAciertos).toBe(0);
    expect(e.aciertos).toBe(0);
    expect(e.fallos).toBe(0);
    expect(e.ultimoEstudio).toBe(f);
    expect(e.fallosPorTipo).toEqual({ familia: 1 });
    expect(resultadoRonda(r)).toBe('parcial');
  });
});
```

En `tests/study.test.js` agregar (y adaptar las llamadas existentes a `candidatas` si usan el tercer argumento `sitio` string → `{ sitio }`):

```js
it('candidatas aplica el filtro de la lista y exige foto', () => {
  const es = [
    { id: '1', nombre: 'A', familia: 'Poaceae', sitios: ['STP'] },
    { id: '2', nombre: 'B', familia: 'Poaceae', sitios: [] },
    { id: '3', nombre: 'C', familia: 'Asteraceae', sitios: ['STP'] },
  ];
  const conFoto = new Set(['1', '2', '3']);
  expect(candidatas(es, conFoto, { familia: 'Poaceae' }).map(e => e.id)).toEqual(['1', '2']);
  expect(candidatas(es, new Set(['1']), { familia: 'Poaceae' }).map(e => e.id)).toEqual(['1']);
  expect(candidatas(es, conFoto, { sitio: 'STP' }).map(e => e.id)).toEqual(['1', '3']);
});
it('resumenSesion cuenta rondas perfectas, parciales y preguntas', () => {
  const r = resumenSesion([
    { id: 'a', resultado: 'perfecta', correctas: 3, preguntas: 3 },
    { id: 'b', resultado: 'parcial', correctas: 2, preguntas: 3 },
    { id: 'c', resultado: 'fallo', correctas: 0, preguntas: 2 },
  ]);
  expect(r.aciertos).toBe(1);
  expect(r.fallos).toBe(2);
  expect(r.falladas).toEqual(['b', 'c']);
  expect(r.correctas).toBe(5);
  expect(r.preguntas).toBe(8);
});
```

- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3: `quiz.js`**

```js
// Cuestionario por rondas (spec 1.5 §4.3). Funciones puras; el generador aleatorio se inyecta.
import { registrarB, barajar, elegirPonderado } from './study.js';
import { CATEGORIAS, ORIGENES, HABITOS } from './db.js';
import { grupoDe } from './taxonomia.js';

export const TIPOS = {
  nombre: '¿Qué especie es?',
  familia: '¿De qué familia es?',
  categoria: '¿En qué categoría de conservación está?',
  origen: '¿Cuál es su origen?',
  diagnostico: '¿Cuál es su rasgo para reconocerla?',
  habito: '¿Cuál es su hábito?',
};
export const CAMPO_DE_TIPO = { nombre: 'nombre', familia: 'familia', categoria: 'categoriaMMA', origen: 'origen', diagnostico: 'diagnostico', habito: 'habito' };
const EXTRAS = ['familia', 'categoria', 'origen', 'diagnostico', 'habito'];
const OPCIONES = 4;
const MINIMO = 3;
const HABITOS_VECINOS = {
  'Hierba anual': ['Hierba perenne'], 'Hierba perenne': ['Hierba anual', 'Subarbusto'],
  Subarbusto: ['Arbusto', 'Hierba perenne'], Arbusto: ['Subarbusto', 'Árbol'], 'Árbol': ['Arbusto'],
  Suculenta: ['Subarbusto', 'Hierba perenne'],
};

const genero = nombre => String(nombre ?? '').trim().split(/\s+/)[0];
const valor = (tipo, e) => e[CAMPO_DE_TIPO[tipo]];

export function tiposDisponibles(e) {
  return EXTRAS.filter(t => Boolean(valor(t, e)));
}

// Hasta n valores únicos y distintos de la correcta, recorriendo los grupos en orden de preferencia.
function tomar(grupos, correcta, n, rng) {
  const vistos = new Set([correcta]);
  const salida = [];
  for (const grupo of grupos) {
    for (const v of barajar(grupo, rng)) {
      if (salida.length >= n) return salida;
      if (v && !vistos.has(v)) { vistos.add(v); salida.push(v); }
    }
  }
  return salida;
}

function gruposDistractores(tipo, e, otras) {
  const deCampo = lista => lista.map(x => valor(tipo, x));
  switch (tipo) {
    case 'nombre':
      return [
        otras.filter(x => genero(x.nombre) === genero(e.nombre)),
        otras.filter(x => e.familia && x.familia === e.familia),
        otras.filter(x => e.habito && x.habito === e.habito),
        otras,
      ].map(deCampo);
    case 'familia':
      return [deCampo(otras.filter(x => grupoDe(x) === grupoDe(e))), deCampo(otras)];
    case 'categoria':
      return [CATEGORIAS.filter(c => c !== 'Rara' && c !== 'Datos insuficientes'), CATEGORIAS];
    case 'origen':
      return [ORIGENES];
    case 'diagnostico':
      return [
        otras.filter(x => e.familia && x.familia === e.familia),
        otras.filter(x => grupoDe(x) === grupoDe(e)),
        otras,
      ].map(deCampo);
    case 'habito':
      return [HABITOS_VECINOS[e.habito] ?? [], HABITOS];
    default:
      throw new Error(`Tipo de pregunta desconocido: ${tipo}`);
  }
}

export function alternativas(tipo, e, todas, rng) {
  const correcta = valor(tipo, e);
  const otras = todas.filter(x => x.id !== e.id);
  return barajar([correcta, ...tomar(gruposDistractores(tipo, e, otras), correcta, OPCIONES - 1, rng)], rng);
}

// Orden de los tipos disponibles: sorteo sin reposición con peso 1 + fallos previos de ese tipo.
export function ponderarTipos(e, disponibles, rng) {
  const fallos = e.fallosPorTipo ?? {};
  const restantes = disponibles.slice();
  const orden = [];
  while (restantes.length) {
    const t = elegirPonderado(restantes, x => 1 + (fallos[x] ?? 0), rng);
    orden.push(t);
    restantes.splice(restantes.indexOf(t), 1);
  }
  return orden;
}

const pregunta = (tipo, e, alts) => ({ tipo, enunciado: TIPOS[tipo], correcta: valor(tipo, e), alternativas: alts });

// Ronda: siempre el nombre y luego hasta maxExtra tipos con al menos 3 alternativas.
export function armarRonda(e, todas, rng, maxExtra = 2) {
  const ronda = [pregunta('nombre', e, alternativas('nombre', e, todas, rng))];
  for (const tipo of ponderarTipos(e, tiposDisponibles(e), rng)) {
    if (ronda.length > maxExtra) break;
    const alts = alternativas(tipo, e, todas, rng);
    if (alts.length >= MINIMO) ronda.push(pregunta(tipo, e, alts));
  }
  return ronda;
}

export function resultadoRonda(resultados) {
  if (resultados.every(r => r.acierto)) return 'perfecta';
  return resultados.find(r => r.tipo === 'nombre')?.acierto === false ? 'fallo' : 'parcial';
}

export function calificarRonda(e, resultados, fecha) {
  const fallosPorTipo = { ...(e.fallosPorTipo ?? {}) };
  for (const r of resultados) if (!r.acierto) fallosPorTipo[r.tipo] = (fallosPorTipo[r.tipo] ?? 0) + 1;
  const resultado = resultadoRonda(resultados);
  const base = resultado === 'parcial'
    ? { ...e, rachaAciertos: 0, ultimoEstudio: fecha, modificadoEn: fecha }
    : registrarB(e, resultado === 'perfecta', fecha);
  return { ...base, fallosPorTipo };
}
```

Nota de prueba: `armarRonda` con `maxExtra = 2` produce como máximo 3 preguntas (`ronda.length > maxExtra` corta cuando ya hay nombre + 2).

- [ ] **Step 4: `study.js`**: `candidatas(especies, conFoto, filtro = {})` → `filtrar(especies, filtro, { conFoto }).filter(e => conFoto.has(e.id))` (importar `filtrar` de `./filtros.js`; `filtro` se completa con `FILTRO_VACIO` si `filtrar` lo requiere). `resumenSesion`: `'perfecta'` cuenta como acierto; `'parcial'` como fallo; suma `correctas` y `preguntas` cuando vienen (0 si no). Mantener compatibles los resultados viejos (`se`, `acierto`, `falta`, `no`, `fallo`, `saltada`).
- [ ] **Step 5:** `npx vitest run` → todo verde (si `ui/estudio.js` llamaba `candidatas(..., sesion.sitio)` déjalo compilando pasando `{ sitio: sesion.sitio }`; la Tarea 5 lo reescribe). `node --check quiz.js study.js ui/estudio.js`.
- [ ] **Step 6: commit** `Cuestionario: rondas por especie con alternativas plausibles y calificación por tipo`.

---

### Tarea 5: Pantalla de Estudio

**Files:** Rewrite `ui/estudio.js`. Modify `styles.css` (bloque nuevo `/* Cuestionario */` al final, solo tokens). Modify `study.js` (borrar `distractores` y `calificarA` si quedan sin uso, con sus pruebas).

**Interfaces — Consumes:** Tarea 3 (`ui/filtros-ui.js`, `crearMemoria(…, 'flora.estudio')`, `memoria` de la lista), Tarea 4 (`quiz.js`, `candidatas`, `armarSesion`, `resumenSesion`), Tarea 2 (tokens/clases).

Leer spec §4 completa: es el contrato de esta pantalla. Requisitos verificables:

- [ ] **Step 1: inicio** (`#/estudio`): título "Estudio", resumen de estados (`resumenEstados` actual); selector "Modo" (Cuestionario | Repasar); los 4 filtros principales con `selectorFiltro` + botón "Más filtros" con `abrirHojaFiltros` sobre una memoria propia `crearMemoria(() => globalThis.localStorage, 'flora.estudio')` (ignorar su `texto`); botón "Usar los filtros de la lista" (copia `memoria.estado().filtro` con `texto: ''`); chips de filtros activos con "Limpiar todo" (como la lista); "Especies" (Todas / Me falta y no la sé / Sin evaluar) y "Cantidad" (10 / 20 / Todas) guardados también en la memoria de estudio (campos `alcance`, `cantidad`, `modo`); texto vivo "N especies con foto entran" (con `estados` aplicados); "Comenzar" deshabilitado si N = 0.
- [ ] **Step 2: tarjeta** (modo Cuestionario): cabecera "Especie i de N" + `<progress>` + 3 puntos (`.puntos-ronda span.hecho/.actual`); galería de fotos (reutilizar el patrón `galeria galeria-estudio` + indicador, empezando en una foto al azar: hacer `scrollLeft` a esa foto tras montar); enunciado `<h2>`; alternativas como `<button class="alternativa">` en una columna (nombres en `<i>` cuando `tipo === 'nombre'`); al tocar: deshabilitar todas, `.correcta` a la correcta, `.incorrecta` a la elegida si falló, `.atenuada` al resto, y anunciar "Correcto" / "Era: X" en un `<p aria-live="polite">`; aparece "Siguiente pregunta" (o "Ver resultado" en la última). Tras la primera pregunta, la cabecera muestra el nombre en itálica.
- [ ] **Step 3: fin de tarjeta**: "2 de 3", lista de cada pregunta (✓/✗, enunciado, respuesta correcta), el diagnóstico si existe (caja `.diagnostico` existente), botones "Ver ficha" (`#/ficha/<id>`) y "Siguiente especie". Guardar con `db.especies.put(calificarRonda(e, resultados, ahora))` al completar la última pregunta (una vez). Registrar en `sesion.respuestas` `{ id, resultado: resultadoRonda(resultados), correctas, preguntas }`.
- [ ] **Step 4: fin de sesión**: "Acertaste X de Y preguntas" y "Z de N especies perfectas"; lista de especies con error (miniatura de `miniaturasPrimeras`, nombre en itálica, tipos fallados); "Repetir las falladas" (nueva cola solo con ellas, `resultados` reiniciados) y "Volver" (inicio).
- [ ] **Step 5: Repasar**: conservar la pantalla de repaso actual (`pantallaRepaso`) usando la cola filtrada.
- [ ] **Step 6: `#/estudio/<id>`**: una sola tarjeta de cuestionario de esa especie; al terminar, "Volver a la ficha".
- [ ] **Step 7: retomar**: el objeto `sesion` vive a nivel de módulo; si al renderizar hay una sesión en curso (`sesion.cola.length && sesion.indice < sesion.cola.length`), se retoma en la tarjeta actual (con su ronda ya armada y respuestas dadas) en vez de mostrar el inicio. Incluir "Terminar sesión" en la cabecera de la tarjeta.
- [ ] **Step 8: estilos** `/* Cuestionario */`: `.alternativa` (ancho 100%, min-height 56px, texto a la izquierda, `--superficie`, borde `--borde`, `--radio-ctrl`), estados `.correcta` (borde y fondo `--acento`/`--acento-suave`), `.incorrecta` (`--rojo`/`--rojo-suave`), `.atenuada` (opacity .55), `.puntos-ronda`, `.resultado-ronda`, foto de estudio a `--radio-tarjeta`. Correr `tools/contraste.py` sigue OK.
- [ ] **Step 9:** quitar de `study.js` lo que quedó sin uso (`distractores`, `calificarA`) y sus tests; `npx vitest run`; `node --check ui/estudio.js study.js`.
- [ ] **Step 10: commit** `Estudio como cuestionario: rondas de 3 preguntas, filtros de la lista y resumen de falladas`.

---

### Tarea 6: Complementos en la app

**Files:** Modify `db.js`, `app.js`, `ui/ficha.js`, `ui/editar.js`, `tests/db.test.js`, `styles.css` (bloque final `/* Complementos */`).

**Interfaces — Produces:** `aplicarComplementos(db, JSZip, datos) -> { especies, campos }`; `CAMPOS_COMPLEMENTO`; `nuevaEspecie` con `completado: {}` y `fallosPorTipo: {}`; constante `COMPLEMENTOS = { version: 1, ruta: 'semilla/complementos.zip' }` en `app.js`.

- [ ] **Step 1: tests** en `tests/db.test.js` (usar los helpers que ya usa ese archivo para crear la base y zips; formato del paquete: spec §5.3):

```js
describe('aplicarComplementos', () => {
  async function zipComplementos(registros) {
    const z = new JSZip();
    z.file('manifest.json', JSON.stringify({ formato: 1, tipo: 'complementos', version: 1, creado: '2026-11-23' }));
    z.file('complementos.json', JSON.stringify(registros));
    return z.generateAsync({ type: 'arraybuffer' });
  }
  const F = 'Chileflora — https://www.chileflora.com/x';

  it('llena solo campos vacíos, por id o por nombre, y marca la procedencia', async () => {
    const db = crearDb(`c-${crypto.randomUUID()}`);
    await db.especies.bulkAdd([
      nuevaEspecie({ id: 'a', nombre: 'Greigia sphacelata', origen: 'Nativa' }),
      nuevaEspecie({ id: 'b', nombre: 'Carex erinácea' }),
    ]);
    const r = await aplicarComplementos(db, JSZip, await zipComplementos([
      { id: 'a', nombre: 'Greigia sphacelata', campos: { origen: 'Endémica', colorFlor: ['rojo'] }, fuentes: { origen: F, colorFlor: F } },
      { id: 'zz', nombre: 'Carex erinacea', campos: { diagnostico: 'Espigas erizadas.' }, fuentes: { diagnostico: F } },
    ]));
    const a = await db.especies.get('a');
    const b = await db.especies.get('b');
    expect(a.origen).toBe('Nativa');
    expect(a.colorFlor).toEqual(['rojo']);
    expect(a.completado).toEqual({ colorFlor: F });
    expect(b.diagnostico).toBe('Espigas erizadas.');
    expect(b.completado).toEqual({ diagnostico: F });
    expect(r).toEqual({ especies: 2, campos: 2 });
  });

  it('categoría y decreto van juntos; decreto solo se completa si la categoría coincide', async () => {
    const db = crearDb(`c-${crypto.randomUUID()}`);
    await db.especies.bulkAdd([
      nuevaEspecie({ id: 'a', nombre: 'A a' }),
      nuevaEspecie({ id: 'b', nombre: 'B b', categoriaMMA: 'Vulnerable' }),
      nuevaEspecie({ id: 'c', nombre: 'C c', categoriaMMA: 'En peligro' }),
    ]);
    const campos = { categoriaMMA: 'Vulnerable', decreto: 'D.S. N° 52/2014' };
    const fuentes = { categoriaMMA: F, decreto: F };
    await aplicarComplementos(db, JSZip, await zipComplementos(['a', 'b', 'c'].map(id => ({ id, nombre: id, campos, fuentes }))));
    expect(await db.especies.get('a')).toMatchObject({ categoriaMMA: 'Vulnerable', decreto: 'D.S. N° 52/2014', completado: { categoriaMMA: F, decreto: F } });
    expect(await db.especies.get('b')).toMatchObject({ categoriaMMA: 'Vulnerable', decreto: 'D.S. N° 52/2014', completado: { decreto: F } });
    expect(await db.especies.get('c')).toMatchObject({ categoriaMMA: 'En peligro', decreto: '' });
  });

  it('es idempotente e ignora especies o campos desconocidos', async () => {
    const db = crearDb(`c-${crypto.randomUUID()}`);
    await db.especies.add(nuevaEspecie({ id: 'a', nombre: 'A a' }));
    const datos = await zipComplementos([
      { id: 'a', nombre: 'A a', campos: { petalos: '5', notas: 'x' }, fuentes: { petalos: F, notas: F } },
      { id: 'q', nombre: 'No existe', campos: { petalos: '4' }, fuentes: { petalos: F } },
    ]);
    expect(await aplicarComplementos(db, JSZip, datos)).toEqual({ especies: 1, campos: 1 });
    expect(await aplicarComplementos(db, JSZip, datos)).toEqual({ especies: 0, campos: 0 });
    expect((await db.especies.get('a')).notas).toBe('');
  });

  it('nuevaEspecie trae completado y fallosPorTipo vacíos', () => {
    expect(nuevaEspecie()).toMatchObject({ completado: {}, fallosPorTipo: {} });
  });
});
```

- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3: `db.js`**

```js
export const CAMPOS_COMPLEMENTO = ['familia', 'habito', 'habitoDetalle', 'origen', 'colorFlor', 'petalos', 'diagnostico', 'categoriaMMA', 'decreto'];
const sinValor = v => v == null || v === '' || (Array.isArray(v) && v.length === 0);

// Aplica un paquete de complementos (spec 1.5 §5.4): solo llena campos vacíos y anota su fuente en `completado`.
// Categoría y decreto van juntos; el decreto solo se completa si la categoría del teléfono coincide. Idempotente.
export async function aplicarComplementos(db, JSZip, datos) {
  await leerManifest(JSZip, datos);
  const zip = await JSZip.loadAsync(datos);
  const registros = JSON.parse(await zip.file('complementos.json').async('string'));
  const actuales = await db.especies.toArray();
  const porId = new Map(actuales.map(e => [e.id, e]));
  const porNombre = new Map(actuales.map(e => [normalizar(e.nombre), e]));
  const cambiadas = new Map();
  let campos = 0;
  for (const r of registros) {
    const original = porId.get(r.id) ?? porNombre.get(normalizar(r.nombre));
    if (!original) continue;
    const e = cambiadas.get(original.id) ?? { ...original, completado: { ...(original.completado ?? {}) } };
    let tocada = false;
    const poner = campo => { e[campo] = r.campos[campo]; e.completado[campo] = r.fuentes[campo]; campos++; tocada = true; };
    for (const campo of Object.keys(r.campos)) {
      if (!CAMPOS_COMPLEMENTO.includes(campo) || campo === 'decreto' || !r.fuentes?.[campo]) continue;
      if (campo === 'categoriaMMA') {
        if (sinValor(e.categoriaMMA)) {
          poner('categoriaMMA');
          if (r.campos.decreto && r.fuentes.decreto && sinValor(e.decreto)) poner('decreto');
        } else if (e.categoriaMMA === r.campos.categoriaMMA && r.campos.decreto && r.fuentes.decreto && sinValor(e.decreto)) {
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
}
```

y en `nuevaEspecie` agregar `completado: {}, fallosPorTipo: {},` antes de `creadoEn`.

- [ ] **Step 4:** correr tests → PASS.
- [ ] **Step 5: `app.js`**: `const COMPLEMENTOS = { version: 1, ruta: 'semilla/complementos.zip' };`. En `aplicarListadosPendientes`, después del bucle de listados: si `(await leerMeta(db, 'complementosAplicados', 0)) < COMPLEMENTOS.version`, `fetch(COMPLEMENTOS.ruta, { cache: 'no-store' })`; si ok, `aplicarComplementos`, `escribirMeta(db, 'complementosAplicados', COMPLEMENTOS.version)`, `aviso(\`Datos completados: ${r.campos} campos en ${r.especies} especies\`, 5000)`; errores de red → silencioso (se reintenta). Si hubo cambios, el valor devuelto suma `r.especies` para que `refrescarLista` repinte. En `cargarSemilla` también `escribirMeta(db, 'complementosAplicados', 0)` junto a `listadosAplicados`.
- [ ] **Step 6: `ui/ficha.js`**: en la lista `campos`, si `e.completado?.[clave]`, agregar tras el valor `el('button', { type: 'button', class: 'marca-completado', 'aria-label': 'Completado desde ' + nombreFuente, 'aria-expanded': 'false', onclick })` con texto `ⓘ`; el clic alterna un `<p class="fuente-completado">` bajo ese `dd` con "Completado desde <nombre>" y un enlace a la URL (`target=_blank rel=noopener`). Parsear `"<nombre> — <url>"` con `split(' — ')`. Para `categoriaMMA` la clave del mapa de la ficha puede llamarse distinto: usar el campo real de la especie. Aplica también al recuadro "Para reconocerla" (`diagnostico`).
- [ ] **Step 7: `ui/editar.js`**: para cada campo con `borrador.completado?.[c]`, debajo de su control mostrar `p.nota-completado` "Completado desde <nombre>" + botón "Confirmar" (quita `borrador.completado[c]` y la nota). Al guardar, para cada clave de `completado` cuyo valor en el borrador difiera del original (`JSON.stringify`), borrar la marca.
- [ ] **Step 8: estilos** `/* Complementos */` al final de `styles.css`: `.marca-completado` (sin borde, `background: none`, color `--texto-tenue`, 32×32 mínimo de área táctil con padding, cursor pointer), `.fuente-completado` y `.nota-completado` (0.9rem, `--texto-suave`). Solo tokens.
- [ ] **Step 9:** `npx vitest run`, `node --check db.js app.js ui/ficha.js ui/editar.js`.
- [ ] **Step 10: commit** `Complementos: datos faltantes con procedencia, marca en la ficha y confirmación al editar`.

---

### Tarea 7: Construir el paquete de complementos

**Files:** Modify `tools/completar_datos.py` (ya tiene `faltantes`; agregar `construir`). Create `tools/tests/test_completar_datos.py`.

**Interfaces — Consumes:** lotes `tools/datos/complementos/lote-*.json` y `categorias.json` (formato en `tools/datos/INSTRUCCIONES-INVESTIGACION.md`), `data/build/faltantes.json`, paquetes de `semilla/`. **Produces:** `semilla/complementos.zip` (spec §5.3), `docs/informe-complementos.md`.

- [ ] **Step 1: tests**

```python
# tools/tests/test_completar_datos.py
import json
import zipfile

import pytest

from completar_datos import validar_registro, construir, VOCAB, normalizar


def reg(campos, fuentes=None, clave='k1', nombre='Greigia sphacelata', no=None):
    f = fuentes if fuentes is not None else {c: {'nombre': 'Chileflora', 'url': 'https://www.chileflora.com/x'} for c in campos}
    return {'clave': clave, 'nombre': nombre, 'campos': campos, 'fuentes': f, 'noEncontrado': no or []}


@pytest.mark.parametrize('campos', [
    {'habito': 'Arbusto'}, {'origen': 'Endémica'}, {'colorFlor': ['rojo', 'blanco']}, {'petalos': '5'},
    {'petalos': '4-5'}, {'petalos': 'variable'}, {'familia': 'Bromeliaceae'}, {'habitoDetalle': 'Epífita'},
    {'diagnostico': 'Roseta espinosa con brácteas rojas.'},
    {'categoriaMMA': 'Vulnerable', 'decreto': 'D.S. N° 52/2014'},
])
def test_valores_validos(campos):
    assert validar_registro(reg(campos), permitidos=set(campos)) == []


@pytest.mark.parametrize('campos', [
    {'habito': 'Liana'}, {'origen': 'Nativo'}, {'colorFlor': ['fucsia']}, {'colorFlor': ['rojo', 'azul', 'blanco']},
    {'colorFlor': []}, {'petalos': 'cinco'}, {'familia': 'Compositae'}, {'habitoDetalle': 'x' * 61},
    {'diagnostico': 'x' * 161}, {'categoriaMMA': 'Amenazada', 'decreto': 'D.S. N° 52/2014'},
    {'categoriaMMA': 'Vulnerable', 'decreto': 'DS 52/2014'}, {'categoriaMMA': 'Vulnerable'},
])
def test_valores_invalidos(campos):
    assert validar_registro(reg(campos), permitidos=set(campos)) != []


def test_fuente_obligatoria_y_https():
    assert validar_registro(reg({'habito': 'Arbusto'}, fuentes={}), permitidos={'habito'})
    assert validar_registro(reg({'habito': 'Arbusto'}, fuentes={'habito': {'nombre': 'X', 'url': 'http://a'}}), permitidos={'habito'})
    assert validar_registro(reg({'habito': 'Arbusto'}, fuentes={'habito': {'nombre': '', 'url': 'https://a'}}), permitidos={'habito'})


def test_campo_no_pedido_y_doble_estado():
    assert validar_registro(reg({'habito': 'Arbusto'}), permitidos={'origen'})
    assert validar_registro(reg({'habito': 'Arbusto'}, no=['habito']), permitidos={'habito'})


def test_vocabulario_igual_a_db_js():
    texto = open('db.js', encoding='utf-8').read()
    for nombre in ('HABITOS', 'ORIGENES', 'CATEGORIAS'):
        for v in VOCAB[nombre]:
            assert f"'{v}'" in texto


def test_construir_arma_el_zip(tmp_path):
    lotes = tmp_path / 'lotes'
    lotes.mkdir()
    (lotes / 'lote-01.json').write_text(json.dumps([
        reg({'origen': 'Endémica'}, clave='k1'),
        reg({}, clave='k2', nombre='Carex erinacea', no=['origen']),
    ]), encoding='utf-8')
    faltantes = [{'clave': 'k1', 'nombre': 'Greigia sphacelata', 'faltan': ['origen']},
                 {'clave': 'k2', 'nombre': 'Carex erinacea', 'faltan': ['origen']}]
    destino = tmp_path / 'complementos.zip'
    informe = tmp_path / 'informe.md'
    errores = construir(lotes, faltantes, destino, informe, generado='2026-11-23')
    assert errores == []
    with zipfile.ZipFile(destino) as z:
        m = json.loads(z.read('manifest.json'))
        c = json.loads(z.read('complementos.json'))
    assert m == {'formato': 1, 'tipo': 'complementos', 'version': 1, 'creado': '2026-11-23'}
    assert c == [{'id': 'k1', 'nombre': 'Greigia sphacelata', 'campos': {'origen': 'Endémica'},
                  'fuentes': {'origen': 'Chileflora — https://www.chileflora.com/x'}}]
    assert 'origen' in informe.read_text(encoding='utf-8')


def test_construir_no_escribe_con_errores(tmp_path):
    lotes = tmp_path / 'lotes'
    lotes.mkdir()
    (lotes / 'lote-01.json').write_text(json.dumps([reg({'origen': 'Nativo'})]), encoding='utf-8')
    destino = tmp_path / 'c.zip'
    errores = construir(lotes, [{'clave': 'k1', 'nombre': 'x', 'faltan': ['origen']}], destino, tmp_path / 'i.md', generado='x')
    assert errores and not destino.exists() and not (tmp_path / 'c.zip.tmp').exists()
```

- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3: implementación** en `tools/completar_datos.py`:
  - `VOCAB = {'HABITOS': [...], 'ORIGENES': [...], 'CATEGORIAS': [...], 'COLORES': ['blanco','amarillo','naranja','rojo','rosado','morado','azul','verde','cafe','sin_flor_vistosa']}` copiados de `db.js`.
  - `validar_registro(r, permitidos) -> list[str]` con las reglas de §5.1 y del archivo de instrucciones: familia `^[A-Z][a-z]+aceae$`; habito ∈ HABITOS; habitoDetalle 1–60 caracteres; origen ∈ ORIGENES; colorFlor lista de 1–2 claves de COLORES sin repetir; petalos `^\d+$|^\d+-\d+$|^variable$`; diagnostico 1–160 caracteres; categoriaMMA ∈ CATEGORIAS y exige `decreto` que cumpla `^D\.S\. N° \d+/\d{4}$`; `decreto` solo junto a `categoriaMMA` en el mismo registro o si `permitidos` incluye 'decreto'; cada campo con fuente `{nombre no vacío, url que empieza por https://}`; cada campo de `campos` debe estar en `permitidos`; ningún campo a la vez en `campos` y `noEncontrado`.
  - `construir(dir_lotes, faltantes, destino, informe, generado) -> list[str]`: lee `lote-*.json` y `categorias.json` (si existe) de `dir_lotes`; `permitidos` por clave = `faltan` de `faltantes` (para `categorias.json`: `{'categoriaMMA', 'decreto'}`); claves desconocidas o repetidas entre archivos de lotes (excepto `categorias.json`, que se fusiona) → error con archivo y clave; si hay errores, no escribe nada y los devuelve; si no, escribe `destino.with_suffix('.zip.tmp')` → `os.replace` al destino, con `complementos.json` = `[{id: clave, nombre, campos, fuentes: {campo: f"{nombre} — {url}"}}]` (solo registros con al menos un campo) y el `manifest`; escribe el informe Markdown: total de especies y campos llenados, tabla por campo (llenados / no encontrados / sin investigar), fuentes más usadas (conteo por `nombre`), y lista de especies con sus campos llenados.
  - Subcomando `construir` en `main`: `construir(Path('tools/datos/complementos'), json.load(data/build/faltantes.json), Path('semilla/complementos.zip'), Path('docs/informe-complementos.md'), generado=date.today().isoformat())`; imprime errores y sale 1, o un resumen y 0.
- [ ] **Step 4:** `.venv/Scripts/python -m pytest -q` → verde.
- [ ] **Step 5: commit** `Complementos: validación de lotes investigados y construcción del paquete con informe`.

---

### Tarea 8: Datos, versión 1.5.0 y cierre

**Files:** `semilla/complementos.zip`, `docs/informe-complementos.md`, `tools/datos/complementos/*.json` (evidencia), `sw.js`, `version.js`, `package.json`, `README.md`.

- [ ] **Step 1:** `PYTHONPATH=tools PYTHONIOENCODING=utf-8 .venv/Scripts/python tools/completar_datos.py construir` → sin errores (si hay errores de validación en los lotes, corregir el lote: valor fuera de vocabulario → mover el campo a `noEncontrado`; nunca inventar).
- [ ] **Step 2:** `sw.js` `ARCHIVOS`: agregar `./tema.js`, `./quiz.js`, `./ui/filtros-ui.js`, `./vendor/inter/InterVariable-latin.woff2`. Verificar que todo import de la app esté en la lista: `grep -ho "from '[^']*'" app.js ui/*.js *.js | sort -u` contra `ARCHIVOS`.
- [ ] **Step 3:** versión `1.5.0` en `version.js` y `package.json`.
- [ ] **Step 4:** `README.md`: Estudio (cuestionario por rondas, tipos de pregunta, filtros, repaso), Apariencia (tema), datos completados (marca ⓘ, confirmar al editar, informe en `docs/informe-complementos.md`), herramienta `tools/completar_datos.py` (faltantes / construir), conteos de pruebas actualizados.
- [ ] **Step 5:** `npx vitest run`, `.venv/Scripts/python -m pytest -q`, `node --check` de todos los JS.
- [ ] **Step 6: commit** `Flora offline 1.5.0: cuestionario, tema claro/oscuro y datos completados con procedencia`.
