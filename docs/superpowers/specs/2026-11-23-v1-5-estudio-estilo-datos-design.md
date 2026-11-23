# Flora offline 1.5: cuestionario, estilo "bosque" y relleno de datos con procedencia

Fecha: 2026-11-23. Rama: `v1.5` (no se publica hasta que el dueño la pruebe). Versión: 1.5.0.

## 1. Objetivo

Tres subproyectos independientes, entregados juntos en 1.5.0:

1. **Estilo visual nuevo** (sección 3): sistema de tokens con tema claro y oscuro, tomando la estructura del
   design system de Raycast (`DESIGN.md` del usuario) con un acento verde de naturaleza.
2. **Estudio como cuestionario** (sección 4): rondas de 3 preguntas de alternativas por especie, con los mismos
   filtros de la lista.
3. **Relleno de datos** (sección 5): investigación por especie de los campos vacíos, entregada como paquete
   `semilla/complementos.zip` que solo llena campos vacíos y deja marcada la procedencia.

Fuera de alcance: cambiar el esquema de fotos, sincronización, nuevos sitios, traducir la app.

## 2. Situación de partida

- PWA en módulos ES sin build, Dexie 4, service worker con caché por `FLORA_VERSION`, rutas por hash.
- 737 especies (semilla 425 + Nevado + Chacao Chonchi). Vacíos medidos el 2026-11-23: categoría 666,
  hábito detallado 630, notas 452, color de flor 194, pétalos 182, diagnóstico 179, origen 176, familia 14,
  hábito 8, sin foto 21.
- Estudio actual: modos "Foto a nombre" (A, autoevaluación), "Nombre a foto" (B, 4 fotos) y "Repasar" (R);
  filtros solo por sitio y estado de aprendizaje; ruta `#/estudio/<id>` estudia una sola especie desde la ficha.
- Lista 1.4.1: filtros principales (sitio, familia, hábito, conservación) a la vista y "Más filtros" en una hoja
  (`dialog.hoja`); lógica pura en `filtros.js`, derivados en `taxonomia.js`, memoria en `ui/memoria.js`.

## 3. Estilo visual

### 3.1 Tokens

`styles.css` se reescribe sobre variables CSS en `:root`. Ningún color literal fuera de la definición de
tokens, salvo la paleta de color de flor (`COLOR_HEX` en `ui/dom.js`) y `rgba()` de sombras/velos.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--fondo` | `#f3f5f0` | `#0a0d0b` | canvas |
| `--superficie` | `#ffffff` | `#111612` | tarjetas, barra, inputs |
| `--superficie-2` | `#e9eee5` | `#1a211c` | pozos, chips, filas activas |
| `--borde` | `#d3dccd` | `#26302a` | bordes finos 1px |
| `--texto` | `#18211a` | `#eef3ee` | texto principal |
| `--texto-suave` | `#4c5a4e` | `#9faea2` | secundario |
| `--texto-tenue` | `#6b776c` | `#6f7d72` | terciario |
| `--acento` | `#2f6b3a` | `#5fd38d` | acción primaria, activo, "la sé" |
| `--acento-texto` | `#ffffff` | `#06210f` | texto sobre acento |
| `--acento-suave` | `#e3efe0` | `#173323` | fondos de chip/activo |
| `--ambar` | `#a45f00` | `#f0b450` | "me falta", casi amenazada, diagnóstico |
| `--ambar-suave` | `#fff4df` | `#2e2410` | fondo diagnóstico |
| `--rojo` | `#b3261e` | `#ff7a6e` | "no la sé", amenazada, peligro |
| `--rojo-suave` | `#fde8e6` | `#3a1714` | |
| `--azul` | `#1f5f9e` | `#7db8f0` | hidrófila |
| `--azul-suave` | `#e4f1fb` | `#122638` | |

Los valores de `--se/--falta/--no/--sin` se definen como alias de `--acento/--ambar/--rojo/--texto-tenue`.
Contraste mínimo WCAG AA (4.5:1) para texto normal sobre `--fondo` y `--superficie` en ambos temas; la tarea de
estilo lo verifica con un script (sección 6).

### 3.2 Tema

- `html[data-tema="claro"|"oscuro"]`. Sin atributo, sigue a `prefers-color-scheme`.
- Preferencia en `localStorage['flora.tema']` = `'auto' | 'claro' | 'oscuro'` (por defecto `'auto'`).
- Un script en línea en `<head>` de `index.html` aplica el atributo antes de pintar (sin parpadeo) y
  actualiza `<meta name="theme-color">` (claro `#f3f5f0`, oscuro `#0a0d0b`).
- Ajustes gana una sección "Apariencia" con un selector Automático / Claro / Oscuro que aplica al instante.
- Lógica pura en `tema.js` (exporta `TEMAS`, `leerTema(almacen)`, `guardarTema(almacen, valor)`,
  `temaEfectivo(preferencia, oscuroDelSistema)`), probada en vitest.

### 3.3 Estructura tomada de Raycast

- Un solo acento, racionado: verde solo en la acción primaria, el estado activo, la pestaña activa y "la sé".
- Bordes finos en lugar de sombras; tarjetas con `box-shadow: inset 0 1px 0 rgba(255,255,255,.06)` en oscuro
  (el "borde con brillo") y ninguna sombra exterior salvo el botón flotante y el aviso.
- Radios: `--radio-ctrl: 8px` (botones, inputs, selects, fotos de lista), `--radio-tarjeta: 16px` (tarjetas,
  hoja, galería), `--radio-pildora: 9999px` (chips), `--radio-insignia: 6px`.
- Espaciado en la grilla de 8 (4 permitido para ajustes finos dentro de componentes).
- Barra inferior con `backdrop-filter: blur(20px)` sobre `--superficie` al 85 % de opacidad; la pestaña activa se
  marca con color de acento y un punto/indicador de píldora bajo el texto (no un borde superior).
- Insignias compactas (`--radio-insignia`, 11–12px, peso 600).
- Cifras (contadores, versión, "3 de 10") con `font-variant-numeric: tabular-nums`.

### 3.4 Tipografía

- Inter variable (latin, eje wght) en `vendor/inter/InterVariable-latin.woff2` con su licencia OFL en
  `vendor/inter/LICENSE.txt`; `@font-face` con `font-display: swap`; agregado a `ARCHIVOS` de `sw.js`.
- Pila: `'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`. Tamaño base 17px (se mantiene por
  legibilidad en terreno). Títulos 600, cuerpo 400, etiquetas 500.
- Nombres científicos siempre en itálica.

### 3.5 Lo que no se toma

Canvas negro único, botones neutros sin color, hero con degradados, tracking positivo en display.

### 3.6 Componentes que se rediseñan

Lista (filas planas con separador `--borde`),
cabecera de lista y filtros, chips, hoja de filtros, ficha (galería con `--radio-tarjeta`, `campos`, caja
diagnóstico), edición, ajustes, avisos, barra inferior, botón flotante, y todo Estudio (sección 4).
El tinte por color de flor de filas y ficha debe verse bien en ambos temas: `tinteFondo` pasa a devolver
`color-mix(in srgb, <color> 14%, var(--superficie))` (o equivalente) en lugar de un color claro fijo.

## 4. Estudio: cuestionario por rondas

### 4.1 Pantalla de inicio

- Título "Estudio" y resumen de estados (como hoy).
- Selector de modo: **Cuestionario** (por defecto) o **Repasar** (el modo R actual, sin cambios de lógica).
- Filtros: los mismos que la lista, con el mismo componente: los 4 principales a la vista y "Más filtros".
  El estado de filtros de Estudio es propio y persiste en `localStorage['flora.estudio']` (mismo formato que
  `FILTRO_VACIO` de `filtros.js`, sin `texto`), independiente de la lista.
- Botón "Usar los filtros de la lista": copia `memoria.estado().filtro` (sin `texto`) al filtro de Estudio.
- "Especies": Todas / Me falta y no la sé / Sin evaluar. "Cantidad": 10 / 20 / Todas.
- Texto en vivo "N especies con foto entran" y botón "Comenzar" (deshabilitado con 0).
- Para el componente compartido, `selectorFiltro` y la hoja de "Más filtros" salen de `ui/lista.js` a
  `ui/filtros-ui.js`, parametrizados por el almacén de estado (memoria de lista o memoria de estudio).
  El comportamiento de la lista no cambia.

### 4.2 Tarjeta por especie

- Cabecera: "Especie i de N" con barra de avance y 3 puntos de progreso de la ronda.
- Galería de fotos de la especie (deslizable, indicador "1 de k"), primera foto al azar.
- 3 preguntas en secuencia sobre la misma especie, cada una con 4 alternativas (3 si el vocabulario no da
  más, p. ej. origen). Pregunta 1 siempre **nombre**. Preguntas 2 y 3: dos tipos distintos elegidos entre los
  **disponibles** para esa especie (sección 4.3), sorteados con peso `1 + fallosPorTipo[tipo]`.
- Si la especie tiene menos de 2 tipos disponibles además del nombre, la ronda tiene 1 o 2 preguntas.
- Al tocar una alternativa: queda marcada; la correcta se pinta con `--acento`, la elegida incorrecta con
  `--rojo`; las demás se atenúan; aparece "Siguiente pregunta". Tras la pregunta 1 el nombre correcto queda
  visible en la cabecera de la tarjeta para las preguntas siguientes.
- Fin de tarjeta: resumen "2 de 3" con cada pregunta (✓/✗ y la respuesta correcta), el rasgo diagnóstico si
  existe, y botones "Ver ficha" y "Siguiente especie".
- Accesibilidad: alternativas son `<button>` de al menos 48px de alto; el resultado se anuncia con
  `aria-live="polite"`.

### 4.3 Tipos de pregunta (`quiz.js`, funciones puras con `rng` inyectado)

| tipo | Disponible si | Enunciado | Correcta | Distractores (en orden de preferencia) |
|---|---|---|---|---|
| `nombre` | siempre | ¿Qué especie es? | `e.nombre` | mismo género → misma familia → mismo hábito → cualquiera; tomados de todas las especies (no solo las filtradas), sin repetir nombres |
| `familia` | `e.familia` | ¿De qué familia es? | `e.familia` | familias de especies del mismo grupo (`grupoDe`) → cualquier familia de la base |
| `categoria` | `e.categoriaMMA` | ¿En qué categoría de conservación está? | `e.categoriaMMA` | otras de `CATEGORIAS` (excluye 'Rara' y 'Datos insuficientes' salvo que sea la correcta) |
| `origen` | `e.origen` | ¿Cuál es su origen? | `e.origen` | los otros dos de `ORIGENES` (3 alternativas) |
| `diagnostico` | `e.diagnostico` | ¿Cuál es su rasgo para reconocerla? | `e.diagnostico` | diagnósticos de otras especies de la misma familia → del mismo grupo → cualquiera |
| `habito` | `e.habito` | ¿Cuál es su hábito? | `e.habito` | otros de `HABITOS`, preferentemente vecinos (hierba anual/perenne, subarbusto/arbusto) |

API de `quiz.js`:

- `TIPOS` (lista de los 6 tipos con su enunciado).
- `tiposDisponibles(e) -> string[]` (sin `nombre`).
- `armarRonda(e, todas, rng) -> Pregunta[]` donde
  `Pregunta = { tipo, enunciado, correcta, alternativas: string[] }` (alternativas barajadas, la correcta incluida
  una sola vez, sin duplicados, longitud 3–4).
- `alternativas(tipo, e, todas, rng) -> string[]`.
- `calificarRonda(e, resultados, fecha) -> especie` donde `resultados = [{ tipo, acierto }]`:
  - todas correctas → `registrarB(e, true, fecha)` (reutiliza `study.js`);
  - nombre incorrecto → `registrarB(e, false, fecha)`;
  - nombre correcto y alguna otra incorrecta → sin cambio de nivel, `rachaAciertos = 0`,
    `ultimoEstudio = modificadoEn = fecha`;
  - en todos los casos `fallosPorTipo[tipo]++` por cada pregunta fallada (campo nuevo, objeto, por defecto `{}`).
- `ponderarTipos(e, disponibles, rng, k=2) -> string[]` (sin reposición, peso `1 + fallosPorTipo[t]`).

`armarSesion`, `candidatas` (ahora con filtro: `candidatas(especies, conFoto, filtro, ctxFiltro)` usando
`filtrar` de `filtros.js`) y `resumenSesion` siguen en `study.js`. Se eliminan el modo B, `distractores` y
`calificarA` si quedan sin uso (la ruta `#/estudio/<id>` pasa a ser una tarjeta de cuestionario de esa sola
especie y al terminar vuelve a la ficha).

### 4.4 Fin de sesión

Puntaje "Acertaste X de Y preguntas" y "Z de N especies perfectas"; lista de especies con algún error
(miniatura, nombre, qué falló); botones "Repetir las falladas" (nueva sesión solo con ellas) y "Volver".
`resumenSesion` se extiende para respuestas `{ id, resultado: 'perfecta' | 'parcial' | 'fallo' }`.

### 4.5 Estado de sesión

La sesión vive en memoria mientras la app está abierta (como hoy). Si la pantalla se reconstruye
(volver desde "Ver ficha"), se retoma en la tarjeta donde estaba.

## 5. Relleno de datos con procedencia

### 5.1 Campos y fuentes

| Campo | Vocabulario | Fuentes permitidas |
|---|---|---|
| `familia` | nombre APG terminado en "-aceae" (o Compositae→Asteraceae normalizado) | Flora de Chile / Rodríguez et al. 2018, Chileflora, POWO, Tropicos |
| `habito` | `HABITOS` | Chileflora, Enciclopedia de la Flora Chilena, Flora de Chile |
| `habitoDetalle` | texto corto ≤ 60 caracteres (p. ej. "Trepadora leñosa", "Epífita", "Hierba en cojín") | ídem |
| `origen` | `ORIGENES` | Rodríguez et al. 2018 / Chileflora |
| `colorFlor` | claves de `COLORES_FLOR` (1–2) | Chileflora, Enciclopedia de la Flora Chilena, iNaturalist (fotos de investigación) |
| `petalos` | `^\d+$`, `^\d+-\d+$` o `variable` | Chileflora, Flora de Chile |
| `diagnostico` | 1 oración ≤ 160 caracteres, rasgo visible en terreno | Chileflora, Enciclopedia de la Flora Chilena, claves de Flora de Chile |
| `categoriaMMA` + `decreto` | `CATEGORIAS` + decreto (p. ej. "DS 79/2018") | solo el listado oficial del RCE del MMA (clasificacionespecies.mma.gob.cl) |

Una especie sin clasificación en el RCE queda con `categoriaMMA` vacío: no es un dato faltante.
`notas` no se rellena.

### 5.2 Investigación (herramienta de desarrollo)

- `tools/completar_datos.py faltantes` reúne las 737 especies de los tres paquetes (misma unión que usa la app:
  por id o nombre normalizado) y escribe `data/build/faltantes.json`:
  `[{ clave, nombre, familia, faltan: [campos] }]`, y lotes `data/build/lotes/lote-NN.json` de ≤ 75 especies.
- Agentes Sonnet en paralelo, uno por lote, escriben `tools/datos/complementos/lote-NN.json` (se commitean:
  son la evidencia; `data/` está ignorado por git) con formato
  `[{ clave, nombre, campos: { campo: valor }, fuentes: { campo: { nombre, url } }, noEncontrado: [campos] }]`.
  Regla: un valor sin fuente verificable no se escribe; ante duda, `noEncontrado`.
- `tools/completar_datos.py construir` valida cada lote contra el vocabulario de 5.1 (errores bloquean),
  exige fuente con URL `https://` para cada campo, y construye `semilla/complementos.zip` (escritura atómica
  como en `agregar_presentacion.py`) y `docs/informe-complementos.md` (por campo: llenados, no encontrados,
  fuentes más usadas; lista de especies con lo que se llenó).

### 5.3 Paquete

`semilla/complementos.zip`: `manifest.json` `{ formato: 1, tipo: 'complementos', version: 1, creado }` y
`complementos.json` = `[{ id, nombre, campos, fuentes }]` donde `fuentes[campo]` es el texto
`"<nombre de la fuente> — <url>"`. `id` es el id que tiene la especie en su paquete de origen.

### 5.4 Aplicación en la app

- `db.js` exporta `aplicarComplementos(db, JSZip, datos) -> { especies, campos }`:
  busca cada registro por `id` o por `normalizar(nombre)`; para cada campo, solo si el valor del teléfono está
  vacío (`''`, `null`, `[]`) escribe el valor y agrega `completado[campo] = fuente`. Nunca toca avance, notas,
  fotos ni campos con valor. Idempotente. `categoriaMMA` y `decreto` se llenan juntos o ninguno.
- `nuevaEspecie` gana `completado: {}` y `fallosPorTipo: {}`.
- `app.js`: después de los listados, si `meta.complementosAplicados < version` del paquete, descarga
  `semilla/complementos.zip`, aplica y guarda la versión; aviso "Datos completados: N campos en M especies".
  Sin conexión se reintenta en la próxima apertura (mismo patrón y mismo candado en curso que los listados).
  En instalación nueva el orden es semilla → listados → complementos.
- Ficha: cada campo con entrada en `completado` muestra tras el valor una marca discreta "ⓘ" con
  `title` y texto accesible "Completado desde <fuente>"; tocarla muestra la fuente (con enlace) bajo el campo.
- Edición: cada campo completado muestra "Completado desde <nombre de fuente>" y un botón "Confirmar" que
  quita la marca. Guardar con el valor cambiado también quita la marca de ese campo.
- El cuestionario usa los datos completados igual que los originales.

## 6. Pruebas y verificación

- vitest: `tema.js`, `quiz.js` (cada tipo: disponibilidad, alternativas únicas que incluyen la correcta, 3–4
  opciones, distractores preferidos; `calificarRonda` en los 3 casos; `ponderarTipos`), `study.js`
  (`candidatas` con filtro, `resumenSesion` nuevo), `db.js` (`aplicarComplementos`: solo vacíos, por nombre,
  idempotente, categoría+decreto juntos, `completado`), `sw.js` (`ARCHIVOS` incluye los archivos nuevos).
- pytest: validación de `completar_datos.py` (valores fuera de vocabulario, sin fuente, URL no https,
  diagnóstico largo → errores; lote válido → zip con el formato de 5.3).
- Script de contraste: `tools/contraste.py` calcula el contraste de los pares texto/fondo de la tabla 3.1 en
  ambos temas y falla bajo 4.5:1 (3:1 para `--texto-tenue` y bordes no se exige).
- E2E con Playwright/Edge (`scratchpad/pw/e2e.mjs` ampliado) cuando el dueño levante el servidor local:
  lista, filtros, ficha, cuestionario completo de 2 especies, tema oscuro, aviso de complementos.

## 7. Entrega

- Todo en la rama `v1.5`. Versión 1.5.0 en `version.js` y `package.json`; `README.md` actualizado
  (cuestionario, tema, complementos, conteos de pruebas).
- No se mergea ni publica hasta que el dueño lo pruebe y lo pida.
