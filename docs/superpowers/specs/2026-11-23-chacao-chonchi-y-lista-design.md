# Listado Chacao Chonchi, filtros de terreno y memoria de la lista

Fecha: 2026-11-23. Versión de la aplicación al publicar: 1.4.0.

## 1. Objetivo

1. Agregar el sitio **Chacao Chonchi** con las especies de la presentación de la campaña
   "Preparación Campañas EIA Chacao Chonchi – Flora y Vegetación" (páginas 18 a 202, una especie por diapositiva).
   Las fotos salen del PDF y quedan como las del resto de la app.
2. Que la lista **recuerde dónde quedó**: al volver de una ficha, de Estudio o al reabrir la aplicación, aparece
   en la misma especie, con los mismos filtros y el mismo orden.
3. Agregar los filtros que usa un botánico de consultora en terreno y en el informe EIA, ordenados en una hoja de filtros.
4. Mejoras de UX: recorrer las fichas con anterior/siguiente, insignias en las filas y rasgo diagnóstico destacado.

El PDF de origen se copia a `data/source/chacao-chonchi.pdf`, que está ignorado por git.

## 2. Datos del PDF

Cada diapositiva de las páginas 18 a 202 trae estos textos. Se usan `page.get_text('dict')` de PyMuPDF y sus spans
(texto, tamaño, flags y bbox).

| Dato | Cómo se reconoce | Ejemplos |
|---|---|---|
| Nombre | El span en negrita e itálica (flags & 2 y flags & 16), tamaño ≥ 30, en la franja inferior (y > 400). El nombre continúa en los spans de la misma línea. | `Carex erinacea`, `Aextoxicon punctatum – LC (D.S. N° 79/2018)`, `Bromus catharticus Vahl var. catharticus.` |
| Familia | Un span en mayúsculas de una sola palabra, terminado en ACEAE o con corrección conocida | `CYPERACEAE`, `BERBERIDOPSIS`→Berberidopsidaceae |
| Hábito | Un span que, ya reparado, calza con el vocabulario de la tabla 2.2 | `Hierba perenne`, `Arbusto trepador` |
| Registro en el AI | El texto de la página contiene "registrado antes en el AI" | `Si se ha…` → `si`; `NO se ha…`/`No se ha…` → `no`; si lleva `?` o `¿` → `duda` |
| Hidrófila | El texto de la página contiene `HIDROFILA` o `ESPECIE DE HUMEDAL` | página 120, página 35 |
| Rasgo diagnóstico | Spans de tamaño entre 14 y 22 que no son ninguno de los anteriores (pueden venir en negrita), unidos en orden de lectura. | `Láminas foliares serradas en toda su extensión` |

### 2.1 Reglas de limpieza

- **Texto.** PyMuPDF entrega el texto con sus tildes correctas: `Árbol`, `N°` y el guion largo `–`. En la consola
  de Windows aparecen como `�`, pero es solo la consola. Para leer los scripts, usar `PYTHONIOENCODING=utf-8`. Por
  seguridad, si un registro contiene U+FFFD es un error de verificación y aborta el paquete. Los espacios se colapsan.
- **Categoría de conservación.** Solo se toma la escrita en la línea del nombre. Hay un cuadro "NT (DS 33/2011)"
  oculto detrás de una foto en unas 25 diapositivas: no se ve, así que no vale. Todo span de categoría fuera de la
  línea del nombre se ignora y se anota en el informe. Lo mismo vale para el span de tamaño 9 "D.S. N° 19/2012" de la página 201.
- **Formatos de categoría** en la línea del nombre: `– LC (D.S. N° 79/2018)`, `(LC D.S. N°13/2013)`,
  `– (LC D.S. N°52/2014)`, `(LC D.S. 10/2023)`, `– EP y R (D.S. N° 151/2007)`, `(VU D.S. N°52/2014)`, `– DD (…)`.
  Siglas: LC→Preocupación Menor, NT→Casi amenazada, VU→Vulnerable, EN y EP→En peligro, CR→En peligro crítico,
  DD→Datos insuficientes, R→Rara. Con dos siglas (`EP y R`) la categoría es la primera y el texto completo queda en
  las notas ("Categoría en la presentación: EP y R"). El decreto se guarda como `D.S. N° 79/2018`.
- **Nombre.** Se quita la categoría y se queda el binomio más el infraespecífico. Tras `var.`, `subsp.` o `f.` se
  conserva esa marca y el epíteto siguiente. Se descartan los autores (`L.`, `Vahl`, `Lam.`, `G. Forst.`,
  `Hook. f.`, `Vahl ex Willd.`) y el punto final. Ejemplos: `Bromus catharticus Vahl var. catharticus.` →
  `Bromus catharticus var. catharticus`; `Agrostis stolonifera L. var. stolonifera` →
  `Agrostis stolonifera var. stolonifera`; `Gaultheria antarctica Hook. f.` → `Gaultheria antarctica`.
- **Familia.** Se pasa a formato título (`CYPERACEAE`→`Cyperaceae`) y se corrigen las erratas: DROSSERACEAE→Droseraceae,
  HYNDRANGEACEAE→Hydrangeaceae, THYMELACEAE→Thymelaeaceae, BERBERIDOPSIS→Berberidopsidaceae. Si falta, se deduce
  por género desde las otras especies del mismo listado (p. 182, Hymenophyllum) y, si no se puede, con
  `FAMILIAS_FALTANTES` (Donatia→Stylidiaceae). Cada deducción queda en el informe.
- **Duplicados.** Mismo nombre normalizado en dos diapositivas: se fusionan y queda el orden de la primera.

### 2.2 Hábito

| En el PDF | `habito` | `habitoDetalle` |
|---|---|---|
| Hierba perenne / Hierba anual / Árbol / Arbusto | igual | vacío |
| Arbusto trepador / rastrero / parásito / epífito | Arbusto | el texto del PDF |
| Hierba perenne trepadora | Hierba perenne | el texto del PDF |
| Subarbusto | Subarbusto (valor nuevo en `HABITOS`) | vacío |
| Sin hábito (p. 42) | vacío; se anota en el informe | |

### 2.3 Fotos

- Se toman las imágenes embebidas de cada página (`page.get_image_info(xrefs=True)` y `pymupdf.Pixmap(doc, xref)`;
  si hay máscara alfa se aplana sobre blanco). Así salen sin los textos superpuestos de la diapositiva, en particular
  **sin el nombre**, que arruinaría el modo estudio.
- Se descartan las imágenes con un lado menor a 150 px y los xref que aparecen en más de 3 páginas (fondos o logos).
  Si un xref se repite en la misma página, se toma una sola vez.
- Orden: primero las fotos, de mayor a menor área mostrada en la diapositiva, y al final las ilustraciones. Una imagen
  es ilustración cuando más del 60 % de sus píxeles son casi blancos (mín. RGB > 225) y la saturación media es baja
  (< 0,12). Así la miniatura de la lista es una foto.
- Se convierten con `crear_foto` de `flora/imagenes.py` (1200 px y miniatura de 200 px, WebP). Fuente `presentacion`,
  autor `Del Río, C. y M. Carrasco (2026)`, licencia vacía y url vacía. El id es
  `uuid5(especieId:presentacion:orden)`, como en el resto del pipeline.

### 2.4 Especies que ya están en la aplicación

El pipeline lee `semilla/semilla.zip` y `semilla/nevado-tres-cruces.zip`. Una especie del PDF es la misma que una
existente cuando coincide el nombre normalizado o, si el del PDF tiene infraespecífico, cuando coincide su binomio con
el nombre existente. En ese caso el registro del paquete usa el id y el nombre de la existente. Se esperan unas 15 coincidencias.

## 3. Modelo de datos

Campos nuevos de la especie. `nuevaEspecie` y `_base_registro` les ponen valor por defecto; los registros antiguos
no los tienen y todo el código los lee con `??`.

| Campo | Tipo | Significado |
|---|---|---|
| `registroAI` | `'si' \| 'no' \| 'duda' \| ''` | "Se ha registrado antes en el área de influencia" (listado Chacao Chonchi) |
| `hidrofila` | boolean | Especie hidrófila o de humedal según una fuente del listado |
| `diagnostico` | string | Rasgo para reconocerla en terreno |
| `ordenListado` | `{ [sitio]: number }` | Posición en la presentación del sitio (1 = primera especie) |

`CATEGORIAS` pasa a ser `['Preocupación Menor', 'Casi amenazada', 'Vulnerable', 'En peligro', 'En peligro crítico',
'Datos insuficientes', 'Rara']`. `HABITOS` suma `Subarbusto`. `SITIOS` suma `Chacao Chonchi`.

Valores que se calculan al vuelo, sin migrar datos (módulo nuevo `taxonomia.js`, funciones puras):

- `grupoDe(e)`: `Helechos y licófitas` | `Gimnospermas` | `Monocotiledóneas` | `Dicotiledóneas`. Se deduce de la familia
  con listas explícitas de familias de helechos y licófitas, gimnospermas y monocotiledóneas; lo demás es
  Dicotiledóneas. Las listas cubren todas las familias de la semilla, de Nevado y de Chacao (Equisetaceae, Pteridaceae y
  Salviniaceae son helechos; Ephedraceae y Cupressaceae, gimnospermas; Alismataceae, Juncaginaceae, Potamogetonaceae,
  Ruppiaceae, Typhaceae, Tecophilaeaceae y Asphodelaceae, entre otras, monocotiledóneas). Sin familia → `''`.
- `formasVida(e)`: subconjunto de `['Trepadora', 'Rastrera', 'Epífita', 'Parásita']`, buscado sin tildes en
  `habitoDetalle` (`trepador`, `rastrer`, `epifit`, `parasit`). Funciona también con los datos existentes
  (`Hierba trepadora`, `Arbusto parásito`).
- `esHidrofila(e)`: `e.hidrofila` o notas que contienen "Especie hidrófila" (así vienen las de Nevado).
- `siglaCategoria(c)`: LC, NT, VU, EN, CR, DD o R.

## 4. Aplicar el listado en el teléfono (`agregarListado`)

Mantiene lo que ya hace y suma lo siguiente para las especies existentes, sin tocar avance, notas ni lo que la persona editó:

- Les agrega las fotos del paquete cuyo `especieId` es el de esa especie, reasignadas al id existente si la
  coincidencia fue por nombre. Van al final (`orden` = cantidad actual + i). Una foto cuyo id ya existe se salta.
- Completa solo los campos vacíos: `familia`, `habito`, `habitoDetalle`, `categoriaMMA`, `decreto` y `diagnostico`.
- `registroAI`: el del paquete, si no está vacío. `hidrofila`: queda `true` si cualquiera de los dos lo es.
  `ordenListado`: fusión con lo que ya tiene.
- Devuelve `{ nuevas, conSitio, fotos }`, donde `fotos` cuenta todas las fotos agregadas.

Aplicarlo dos veces no cambia nada. `LISTADOS` de `app.js` suma `{ sitio: 'Chacao Chonchi', ruta: 'semilla/chacao-chonchi.zip' }`.

## 5. Filtros y orden (módulo puro `filtros.js`)

`filtro` es un objeto plano. `''` significa sin filtro.

| Clave | Sección de la hoja | Valores |
|---|---|---|
| `texto` | buscador | busca en nombre, familia y diagnóstico, sin tildes |
| `grupo` | Identificación | los 4 grupos |
| `familia` | Identificación | familias presentes, en orden alfabético |
| `habito` | Identificación | `HABITOS` |
| `formaVida` | Identificación | Trepadora, Rastrera, Epífita, Parásita |
| `colorFlor` | Identificación | `COLORES_FLOR` |
| `petalos` | Identificación | `valoresPetalos` |
| `categoria` | Evaluación ambiental | `alguna` (cualquier categoría) o una de `CATEGORIAS` |
| `origen` | Evaluación ambiental | `ORIGENES` |
| `hidrofila` | Evaluación ambiental | `si` |
| `registroAI` | Evaluación ambiental | `si`, `no` o `duda`; solo se muestra con sitio = Chacao Chonchi |
| `sitio` | Estudio | `SITIOS` |
| `aprendizaje` | Estudio | `APRENDIZAJES` |
| `foto` | Estudio | `con` / `sin` |

Funciones:

- `cumple(e, filtro, ctx)` y `filtrar(especies, filtro, ctx)`, donde `ctx = { conFoto: Set<id> }`. Todos los filtros se combinan con Y.
- `conteos(especies, filtro, clave, valores, ctx)` → `Map(valor → n)`: cuántas quedarían con ese valor y el resto de los filtros.
- `ordenar(especies, orden, sitio)` con `orden` ∈ `nombre` (por defecto), `familia` (familia y nombre; sin familia al
  final), `listado` (por `ordenListado[sitio]`, las que no tienen van al final por nombre; solo se ofrece si hay sitio y
  alguna especie tiene orden en él; si no, cae a `nombre`) y `aprendizaje` (no, falta, sin evaluar, la sé; luego nombre).
- `filtrosActivos(filtro)` → `[{ clave, valor, etiqueta }]` para los chips.

`listarEspecies(db, filtro, orden)` de `db.js` usa estas funciones y conserva su firma con `orden` opcional, así que
las llamadas actuales no cambian.

## 6. Memoria de la lista (`ui/memoria.js`)

- Estado guardado en `localStorage['flora.lista']`: `{ filtro, orden, ancla: { id, desfase }, ultimaId }`. Toda lectura y
  escritura va en try/catch; si falla, la aplicación funciona igual, sin memoria.
- `ancla`: la primera fila cuya parte inferior queda bajo el borde superior de la ventana, con `desfase` = su
  `getBoundingClientRect().top`. Se guarda al hacer scroll (como máximo cada 200 ms), al tocar una fila (ancla = esa
  fila) y en `pagehide`.
- Al pintar la lista se busca la fila del ancla y se hace `scrollTo(0, scrollY + rect.top - desfase)`. Si el ancla ya no
  está en la lista filtrada, se queda arriba. Las filas tienen alto fijo (72 px) y las miniaturas tamaño fijo, así que la
  posición no salta mientras cargan.
- La fila de `ultimaId` recibe la clase `reciente`: un resaltado que se desvanece en 1,5 s.
- `history.scrollRestoration = 'manual'`. `enrutar` sigue subiendo al inicio en las demás pantallas.
- Al cambiar un filtro, el orden o el texto, el ancla se borra y la lista queda arriba.

## 7. Interfaz

### 7.1 Lista

- Cabecera: el buscador, y debajo una fila con el botón **Filtros** (con el número de filtros activos) y el selector de
  **Orden**. Luego los chips de los filtros activos, cada uno con ×, más el chip "Limpiar todo" cuando hay alguno. Al
  final el contador "N especies".
- Hoja de filtros: un `<dialog>` que sube desde abajo y se abre con `showModal()`. Tiene tres secciones (Identificación,
  Evaluación ambiental, Estudio) con un `<select>` por filtro. Cada opción muestra su conteo, "Arbusto (124)", y las
  que darían 0 quedan deshabilitadas, salvo la elegida. El pie fijo dice "Ver N especies" y cierra la hoja. Los cambios
  se aplican al momento. Al abrirla se hace `history.pushState`, así el botón atrás de Android la cierra con `popstate`
  en vez de salir de la lista.
- Fila: además de lo actual, insignias pequeñas a la derecha del nombre: la sigla de categoría (VU, EN y CR en rojo, NT
  en ámbar, LC, DD y R en gris), "Hidrófila" (gota) y "AI" o "AI?" según `registroAI`.
- Con orden por familia, encabezado por familia (`li.grupo-familia`, `position: sticky`) con nombre y cantidad.

### 7.2 Ficha

- Arriba, una barra de recorrido: "‹ Anterior", "12 de 185" y "Siguiente ›". Recorre la lista con los filtros y el orden
  guardados en memoria. Navega con `location.replace`, así el botón atrás vuelve a la lista y no recorre cada ficha
  vista, y actualiza el ancla de la memoria a la especie mostrada. Si la especie no está en la lista filtrada, la barra no aparece.
- "Para reconocerla": el diagnóstico en un recuadro destacado bajo las fotos.
- Campos nuevos en la lista de campos: Grupo, Formas de vida, Hidrófila (Sí), Registro en el AI (Sí / No / Por confirmar).
- Atribución en la foto ampliada para la fuente `presentacion`: "Del Río, C. y M. Carrasco (2026) · Presentación Chacao Chonchi".
- "Volver" hace `history.back()` cuando se llegó desde la lista (marca `ctx.desdeLista`); si no, navega a `#/lista`.

### 7.3 Editar y Estudio

- Editar: selector de registro en el AI, casilla de hidrófila y área de texto de diagnóstico. Categoría y hábito toman
  las listas ampliadas.
- Estudio: la pista agrega el diagnóstico en una segunda línea, si existe.

## 8. Pipeline

- `tools/flora/presentacion.py`: funciones puras sobre listas de spans (`{texto, tamano, flags, bbox}`), probables sin el PDF:
  `separar_nombre_y_categoria`, `limpiar_nombre`, `normalizar_familia`, `leer_habito`, `leer_registro_ai`,
  `leer_diagnostico` y `registro_desde_pagina`. Además `spans_de_pagina(page)` e `imagenes_de_pagina(doc, page)` para PyMuPDF.
- `tools/agregar_presentacion.py`: lee el PDF, construye los registros, cruza con los existentes, extrae las fotos, escribe
  `semilla/chacao-chonchi.zip` y `data/build/informe-chacao-chonchi.md`, y lo verifica con `verificar_zip`. Se copia el
  informe a `docs/informe-chacao-chonchi.md`.
- Verificaciones que abortan: menos de 180 especies, algún U+FFFD, alguna especie sin foto o sin familia, o nombres
  repetidos.
- `tools/requirements.txt` suma `pymupdf`.

## 9. Pruebas

- pytest: cada función de `presentacion.py` con los casos reales de la sección 2. También una prueba de integración que se
  salta si no está `data/source/chacao-chonchi.pdf`: lee las páginas 18, 47, 58, 79, 147, 182 y 188 y comprueba nombre,
  familia, hábito, categoría y fotos.
- vitest: `taxonomia.js`; `filtros.js` (cada filtro, conteos, orden, chips); `agregarListado` con existentes (fotos al
  final, campos solo si están vacíos, idempotencia, coincidencia por nombre); `memoria.js` con un `localStorage` falso
  y uno que lanza error.
- En el navegador, a 390 px de ancho: aplicar el listado, filtrar, abrir una ficha desde la mitad de la lista, avanzar
  con siguiente, volver y comprobar que la lista queda en la última especie vista; recargar y comprobar lo mismo.

## 10. Fuera de alcance

Ambiente o formación vegetal, invasora, fenología y tipo de hoja: no hay datos confiables por especie (ver la
investigación en la conversación del 2026-11-23). Filtros con varios valores a la vez dentro de un mismo filtro.
Gestos de deslizar entre fichas.
