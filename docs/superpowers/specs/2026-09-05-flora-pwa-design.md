# Flora offline: aplicación PWA para estudio de especies en terreno

## 1. Resumen ejecutivo

Una bióloga (persona usuaria, en adelante "la usuaria") estudia la flora de la zona centro de Anglo American (sitios Las Tórtolas y STP) asociando el nombre científico de cada especie con su imagen. Su herramienta actual es una planilla Excel de 784 MB con 392 especies y 388 fotos incrustadas, más una segunda planilla con 67 especies de un estudio de prefactibilidad. La planilla no se puede usar bien en un teléfono, editar fotos es impracticable y el registro de aprendizaje se lleva a mano. La restricción que define el problema es que la herramienta tiene que funcionar sin internet, en terreno.

Se decidió reemplazar la planilla por una aplicación web progresiva (PWA) instalada en un teléfono Android. La aplicación y todos los datos residen en el teléfono; no existe servidor ni sincronización. GitHub Pages se usa una sola vez para instalar y, en el futuro, para actualizar el código. Lo que la diferencia de la planilla es que permite buscar y filtrar, editar campos y fotos desde el teléfono, y practicar la asociación nombre-imagen con un modo de estudio que actualiza el registro de aprendizaje de forma automática.

El entregable tiene tres partes: la aplicación, un pipeline de migración que convierte las dos planillas en un paquete inicial de 426 registros con foto, y la publicación en GitHub Pages con instrucciones de instalación. Este documento fija requisitos, arquitectura, modelo de datos, formato del paquete, comportamiento de cada pantalla, reglas del pipeline y plan de pruebas.

## 2. Requisitos

### 2.1 Funcionales

| Id | Requisito |
|---|---|
| RF1 | Listar especies con búsqueda por nombre o familia y filtros por sitio, origen, hábito y estado de aprendizaje. |
| RF2 | Mostrar la ficha de una especie con galería de fotos y todos sus campos. |
| RF3 | Crear, editar y borrar especies. Agregar fotos desde cámara o galería, reordenarlas y borrarlas. |
| RF4 | Modo de estudio con dos ejercicios (foto a nombre, nombre a foto) que actualiza el estado de aprendizaje. |
| RF5 | Exportar un respaldo ZIP con datos y fotos, e importarlo en modo reemplazar o fusionar. |
| RF6 | Cargar el paquete inicial en la primera apertura y no volver a necesitar red. |
| RF7 | Mostrar autor y licencia de cada foto descargada de internet. |

### 2.2 No funcionales

| Id | Requisito |
|---|---|
| RNF1 | Funcionamiento completo sin conexión después de la primera carga, verificado en modo avión. |
| RNF2 | Plataforma principal Android con Chrome. iOS con Safari queda como soporte de mejor esfuerzo, sin pruebas en dispositivo. |
| RNF3 | Sin servidor propio, sin cuentas, sin telemetría. |
| RNF4 | Sin paso de compilación. El código publicado es el código fuente. |
| RNF5 | Almacenamiento local total inferior a 150 MB con el paquete inicial cargado. |
| RNF6 | Lista de 430 especies con miniaturas desplazable sin trabas en un teléfono de gama media. |
| RNF7 | Interfaz en español neutro, botones de al menos 48 px, texto de al menos 16 px, alto contraste para uso bajo sol. |
| RNF8 | Solicitud de almacenamiento persistente al navegador tras la carga inicial. |

### 2.3 Fuera de alcance en la primera versión

Sincronización entre dispositivos, uso multiusuario, repetición espaciada con calendario, mapa o GPS, identificación automática por imagen, y edición de la planilla original. El respaldo ZIP es el único mecanismo para mover datos entre dispositivos.

## 3. Arquitectura

### 3.1 Componentes

La aplicación es un sitio estático servido desde GitHub Pages. Al abrirse por primera vez, el service worker copia los archivos de la aplicación a la caché del navegador y la aplicación descarga el paquete inicial y lo escribe en IndexedDB. Desde ese momento ninguna operación requiere red.

| Archivo | Responsabilidad |
|---|---|
| `index.html` | Único documento. Contiene los contenedores de las cuatro pantallas y la barra de navegación. |
| `app.js` | Arranque, enrutador por fragmento de URL (`#/lista`, `#/ficha/<id>`, `#/editar/<id>`, `#/estudio`, `#/ajustes`), carga inicial. |
| `db.js` | Esquema Dexie, operaciones CRUD, exportación e importación del ZIP. Sin dependencia de la interfaz. |
| `study.js` | Selección de la siguiente pregunta y actualización del estado de aprendizaje. Funciones puras. |
| `images.js` | Redimensionado y compresión de fotos con canvas, generación de miniaturas. |
| `ui/lista.js`, `ui/ficha.js`, `ui/editar.js`, `ui/estudio.js`, `ui/ajustes.js` | Una pantalla por módulo. Reciben datos de `db.js` y emiten acciones. |
| `styles.css` | Estilos. Sin framework. |
| `sw.js` | Service worker. Precarga los archivos de la aplicación con estrategia caché primero. |
| `manifest.webmanifest` | Nombre, íconos, color, modo pantalla completa. |
| `vendor/dexie.min.js`, `vendor/jszip.min.js` | Librerías incluidas en el repositorio, versión fija. |
| `semilla/semilla.zip` | Paquete inicial generado por el pipeline. |
| `tools/` | Pipeline de migración en Python. No se publica. |

`db.js` y `study.js` no tocan el DOM, de modo que se prueban en Node sin navegador.

### 3.2 Service worker y actualización

El service worker precarga la lista fija de archivos de la aplicación bajo un nombre de caché con versión (`flora-v` seguido de `FLORA_VERSION`, definida una sola vez en `version.js`). Cada publicación sube `FLORA_VERSION`. Cuando el teléfono tiene red y abre la aplicación, el navegador detecta el service worker nuevo, lo instala en segundo plano y lo activa en la siguiente apertura. Al iniciar, la aplicación compara `FLORA_VERSION` con `meta.versionApp`: si `meta.versionApp` existe y difiere, muestra un aviso breve de actualización y luego guarda la versión activa en `meta.versionApp`. Los datos en IndexedDB no se tocan en las actualizaciones.

El paquete inicial no pasa por la caché del service worker. Se descarga una vez con `fetch`, se importa a IndexedDB y no se vuelve a solicitar.

Ajustes ofrece "Buscar actualizaciones": consulta `version.js` en el servidor, compara con la instalada, pide la actualización al service worker y muestra el estado (buscando, descargando con barra de actividad, lista) y un botón "Reiniciar ahora" que activa la versión nueva mediante el mensaje `SKIP_WAITING`. Si la aplicación detecta una versión nueva al abrirse con internet, la pestaña Ajustes muestra un punto de aviso. El registro del service worker usa `updateViaCache: 'none'`.

### 3.3 Almacenamiento

IndexedDB a través de Dexie. Tras la carga inicial se llama a `navigator.storage.persist()`. En Android con Chrome, una PWA instalada obtiene el permiso sin diálogo, y el sistema no borra sus datos por falta de espacio. Los datos se pierden solo si la usuaria borra los datos de Chrome o desinstala la aplicación, y por eso la pantalla de ajustes muestra la fecha del último respaldo y avisa cuando pasan más de 30 días.

## 4. Modelo de datos

### 4.1 Tabla `especies`

| Campo | Tipo | Valores |
|---|---|---|
| `id` | texto | UUID generado con `crypto.randomUUID()`. |
| `nombre` | texto | Nombre científico. Único, comparado sin mayúsculas ni espacios sobrantes. |
| `nivel` | texto | `especie`, `genero` o `familia`. |
| `familia` | texto | Puede quedar vacío. |
| `origen` | texto | `Nativa`, `Endémica`, `Introducida` o vacío. |
| `habito` | texto | `Hierba anual`, `Hierba perenne`, `Arbusto`, `Árbol`, `Suculenta` o vacío. |
| `habitoDetalle` | texto | Texto libre de la columna "Habito" de la planilla (por ejemplo "Hierba trepadora"). |
| `ciclo` | texto | `Anual`, `Perenne`, `Bienal`, `Anual o bienal` o vacío. |
| `categoriaMMA` | texto | `Preocupación Menor`, `Casi amenazada`, `Vulnerable`, `En peligro` o vacío. |
| `decreto` | texto | Texto libre, por ejemplo `D.S. N° 38/2015`. |
| `ds68` | booleano | Verdadero si la especie figura en el D.S. N° 68/2009. |
| `distribucion` | lista de texto | Códigos de región tal como vienen (`COQ`, `VAL`, `RME`...). |
| `rangoAltitudinal` | texto | Texto libre, por ejemplo `0-1800 m.`. |
| `sitios` | lista de texto | Subconjunto de `Las Tórtolas`, `STP`, `Prefactibilidad`. |
| `aprendizaje` | texto o nulo | `se`, `falta`, `no` o nulo (sin evaluar). |
| `aciertos`, `fallos` | entero | Contadores del modo estudio. |
| `rachaAciertos` | entero | Aciertos consecutivos en el ejercicio B desde la última falla. |
| `ultimoEstudio` | texto o nulo | Fecha ISO de la última pregunta respondida. |
| `notas` | texto | Texto libre. Recibe las cuatro columnas informales de la planilla. |
| `colorFlor` | lista de texto | Colores de la flor, subconjunto de la paleta de la sección 13: `blanco`, `amarillo`, `naranja`, `rojo`, `rosado`, `morado`, `azul`, `verde`, `cafe`, `sin_flor_vistosa`. |
| `petalos` | texto | Número de pétalos según la clave botánica: entero (`5`), rango (`4-5`), `0` o `variable`. Vacío sin dato. |
| `petalosNota` | texto | Tipo de pieza (pétalos, tépalos, lígulas, sin pétalos, apétala) y aclaración de la clave. |
| `rasgosFuente` | texto | URLs de las fuentes de color y pétalos, una por línea. |
| `creadoEn`, `modificadoEn` | texto | Fecha ISO. |

### 4.2 Tabla `fotos`

| Campo | Tipo | Valores |
|---|---|---|
| `id` | texto | UUID. |
| `especieId` | texto | Referencia a `especies.id`. Índice. |
| `orden` | entero | Posición en la galería, desde 0. |
| `blob` | Blob | WebP, lado mayor de 1200 px como máximo, calidad 80. |
| `miniatura` | Blob | WebP, lado mayor de 200 px. |
| `ancho`, `alto` | entero | Dimensiones de `blob`. |
| `fuente` | texto | `planilla`, `inaturalist` o `usuaria`. |
| `autor`, `licencia`, `url` | texto | Vacíos para fotos de la planilla o de la usuaria. |
| `creadoEn` | texto | Fecha ISO. |

Las miniaturas se almacenan para que la lista no decodifique fotos completas. Si el navegador no puede codificar WebP, `images.js` usa JPEG con calidad 85 y el campo `blob` conserva el tipo MIME real.

### 4.3 Tabla `meta`

Pares clave-valor. Claves definidas en la primera versión: `semillaCargada` (fecha), `versionDatos` (entero), `ultimoRespaldo` (fecha o nulo), `ultimaPregunta` (lista de los últimos cinco `especieId` preguntados).

## 5. Formato del respaldo y del paquete inicial

El paquete inicial y el respaldo comparten formato, de modo que importar un respaldo y cargar la semilla son la misma operación.

```
semilla.zip
├── manifest.json        {"formato": 1, "generado": "<ISO>", "especies": 426, "fotos": <n>}
├── especies.json        lista de registros de la tabla especies
├── fotos.json           lista de registros de la tabla fotos sin los blobs
├── fotos/<id>.webp      una por registro de fotos.json
└── miniaturas/<id>.webp una por registro de fotos.json
```

Modos de importación:

- **Reemplazar.** Borra `especies` y `fotos` y carga el contenido del ZIP; conserva `meta`. Es el modo de la carga inicial y de la restauración en un teléfono nuevo.
- **Fusionar.** Para cada especie del ZIP, si existe un registro con el mismo `id` se actualiza con la versión del ZIP; si no existe, se crea. Igual para fotos. No borra nada que no venga en el ZIP.

La importación se ejecuta en lotes de 50 fotos para no agotar memoria, con barra de progreso. Un ZIP con `formato` distinto de 1 se rechaza con mensaje.

## 6. Pantallas

Barra inferior fija con tres accesos: Lista, Estudio, Ajustes. Ficha y Edición se abren desde Lista y vuelven con el botón atrás del teléfono.

### 6.1 Lista

Campo de búsqueda arriba, que filtra en vivo por nombre o familia sin distinguir mayúsculas ni tildes. Debajo, filtros desplegables (sitio, origen, hábito, aprendizaje, color de flor y pétalos), combinables entre sí y con la búsqueda. El filtro de color acepta una especie cuando su lista `colorFlor` contiene el color elegido; el de pétalos ofrece los valores distintos presentes en la base. Cada fila muestra miniatura de la primera foto, nombre en cursiva, familia y un punto de color por estado de aprendizaje. Botón flotante "+" para crear especie. El contador "N especies" refleja el filtro activo.

### 6.2 Ficha

Galería horizontal deslizable con las fotos en su orden. Un toque abre la foto a pantalla completa con zoom, y en fotos descargadas muestra autor y licencia. Debajo, los campos en dos columnas etiqueta-valor, omitiendo los vacíos (incluidos color de flor, pétalos y su nota), y las notas al final. Botones "Editar" y "Estudiar esta especie".

### 6.3 Edición

Mismo formulario para crear y editar. Campos con lista cerrada (origen, hábito, ciclo, categoría, sitios, colores de flor) se editan con selectores o casillas; el resto con texto. Sección de fotos con miniaturas, botón "Agregar foto" que abre el selector nativo de Android (cámara o galería), reordenamiento por botones subir y bajar, y borrado con confirmación. Cada foto se comprime al agregarla, con indicador de progreso. Guardar valida que el nombre no esté vacío ni repetido. Borrar especie exige confirmación y borra sus fotos.

### 6.4 Estudio

Pantalla de inicio con selectores de ejercicio (foto a nombre, nombre a foto, repasar), sitio, alcance de especies (todas, me falta y no la sé, sin evaluar) y cantidad de preguntas (10, 20 o todas). Muestra cuántas especies quedan en cada estado de aprendizaje. Al pulsar "Comenzar" se arma una cola de especies según la sección 7, sin repetir ninguna dentro de la sesión; si no hay especies para la selección elegida, se avisa y se permanece en el inicio. Para el ejercicio B se requieren al menos cuatro candidatas en total.

Cada pregunta muestra un contador "Pregunta i de N" con una barra de avance (en el modo Repasar, "Especie i de N").

**Ejercicio A, foto a nombre.** Galería horizontal deslizable con todas las fotos de la especie, con un indicador "k de m" de la foto visible. Un botón "Pista" muestra la familia y el hábito antes de revelar el nombre, y se deshabilita después de usarse. Al pulsar "Mostrar nombre" aparecen el nombre, la familia y tres botones de calificación, "La sé", "Me falta" y "No la sé", que fijan `aprendizaje` en `se`, `falta` o `no` respectivamente. "Saltar" registra la pregunta como saltada y avanza de inmediato. Tras calificar aparecen "Ver ficha" (abre la ficha de la especie) y "Siguiente".

**Ejercicio B, nombre a foto.** Se muestra el nombre y cuatro fotos de especies distintas en cuadrícula de dos por dos, elegidas entre todas las candidatas del filtro de sitio y no solo entre las de la cola. Al elegir, se marca la correcta en verde y la elegida en rojo si difiere, y se muestra el nombre de la especie de cada foto. Tras responder, tocar una foto la abre a pantalla completa. La respuesta se registra según la sección 7 y luego aparecen "Ver ficha" y "Siguiente".

**Repasar.** Recorre la cola mostrando la galería de fotos junto con el nombre, la familia y el hábito visibles, sin calificar ni escribir en la base. Se navega con "Anterior" y "Siguiente".

**Fin de sesión.** Al completar la cola se muestra "Sesión terminada" con los conteos de aciertos, fallos y saltadas, y la lista de especies marcadas "No la sé" o falladas en el ejercicio B, con miniatura y enlace a su ficha. Botones "Repetir las falladas" (arma una nueva cola solo con esas especies, en el mismo ejercicio), "Nueva sesión" (vuelve al inicio) e "Ir a la lista".

La ruta `#/estudio?especie=<id>` abre una sesión de una sola pregunta en el ejercicio A con esa especie; al calificar o saltar vuelve directamente a la ficha, sin pantalla de resumen.

El fondo de la pantalla de estudio es claro y sin distracciones.

### 6.5 Ajustes

Exportar respaldo: al pulsar el botón se genera primero el ZIP (con un estado "Generando respaldo..."); una vez listo se ofrecen dos botones, "Descargar" (siempre disponible, enlace de descarga directa) y "Compartir" (solo si el navegador admite compartir archivos y el ZIP pesa hasta 45 MB; usa el diálogo de compartir de Android para enviarlo a Drive, WhatsApp o similares). Se muestra el tamaño del archivo. Importar respaldo, con dos botones que eligen el modo antes de abrir el selector de archivo ("Importar reemplazando" e "Importar fusionando"); antes de importar se lee el manifest del ZIP y se confirma mostrando el número de especies y fotos que trae y el modo elegido. Espacio usado y número de especies y fotos. Fecha del último respaldo y aviso si supera 30 días. Versión de la aplicación. Botón "Volver a cargar el paquete inicial" con doble confirmación, que ejecuta una importación en modo reemplazar y requiere red.

## 7. Reglas del modo estudio

Todas las reglas viven en `study.js` como funciones puras que reciben la lista de especies candidatas y un generador de números aleatorios inyectable, para poder probarlas.

**Candidatas.** Especies con al menos una foto que cumplen el filtro de sitio. Para el ejercicio B se requieren al menos cuatro candidatas.

**Peso de selección.** Según `aprendizaje`: `no` pesa 4, `falta` pesa 3, nulo pesa 2, `se` pesa 1. Se elige por sorteo ponderado, excluyendo los cinco últimos `especieId` guardados en `meta.ultimaPregunta` cuando hay más de seis candidatas.

**Cola de sesión.** Sorteo ponderado sin reposición hasta la cantidad elegida; sin exclusión de recientes porque no hay repeticiones.

**Distractores del ejercicio B.** Tres especies distintas de la correcta. Se prefieren las de la misma familia; si no alcanzan, las del mismo hábito; el resto al azar. Cada distractor aporta una foto al azar. Las cuatro posiciones se barajan.

**Registro del ejercicio B.** Acierto incrementa `aciertos` y, si es el segundo acierto consecutivo de esa especie desde la última falla, sube un nivel (`no` a `falta`, `falta` a `se`, nulo a `se`). Falla incrementa `fallos` y baja un nivel (`se` a `falta`, `falta` o nulo a `no`). Se guarda `ultimoEstudio` en cada respuesta. El conteo de aciertos consecutivos se deriva de una clave adicional `rachaAciertos` en la especie, que se reinicia a cero con cada falla.

## 8. Pipeline de migración

Se ejecuta una vez en el Mac, con Python 3 y las librerías openpyxl, Pillow y requests. Entradas en `data/source/` (ignorada por git), salidas en `data/build/`. Cada etapa es un módulo con una función principal comprobable en aislamiento.

### 8.1 Etapas

1. **Lectura.** Carga las 392 filas de `stp y las tortolas.xlsx` y las 67 de `Flora potencial (prefactibilidad).xlsx`.
2. **Limpieza.** Aplica las reglas de la tabla 8.2 y escribe cada corrección en el informe.
3. **Unión.** Para cada fila de la planilla de prefactibilidad busca el nombre normalizado en la base grande, aplicando la tabla de sinónimos. Si existe, agrega el sitio `Prefactibilidad`; si no, crea el registro con sitio `Prefactibilidad` y `nivel` según el nombre. La terminación `sp.` o `sp` indica género y se elimina del nombre guardado (`Dioscorea sp.` queda como `Dioscorea`); la terminación `aceae` indica familia.
4. **Extracción de imágenes.** Recorre las celdas con atributo `vm` de la hoja, resuelve la cadena `metadata.xml` a `rdrichvalue.xml` a `richValueRel.xml` a `xl/media/` y asocia cada imagen con la fila. Se verificó que las 388 imágenes se resuelven a archivos distintos.
5. **Corte de tiras.** Una imagen se trata como tira cuando su proporción ancho/alto es al menos 3 (`PROPORCION_TIRA`), sin importar en qué columna de la planilla esté; las demás (por ejemplo las de la columna "Diferencias") son fotos individuales y no se cortan. Una tira se corta por las columnas de píxeles blancos (valor mínimo de canal superior a 235) en segmentos de ancho mayor a 50 px (`ancho_min`); cualquier segmento resultante de ancho menor a 100 px (`ancho_fusion`) se fusiona con el segmento anterior (o con el siguiente si es el primero), formando un recorte que incluye el hueco blanco intermedio. El número de fotos por especie varía genuinamente (no siempre 6): un corte es válido si produce entre 1 y 12 piezas (`MAX_SEGMENTOS`); un número distinto de 6 se anota como información y un corte con más de 12 piezas se considera anómalo, conservando la tira completa como una sola foto.
6. **Descarga desde iNaturalist.** Para cada registro sin foto se aplican las reglas de la sección 8.3.
7. **Conversión.** Cada foto se guarda en WebP calidad 80 con lado mayor de 1200 px y se genera la miniatura de 200 px.
8. **Rasgos florales.** Aplica las reglas de la sección 13 a partir de `data/rasgos/color-flor.csv` y `data/rasgos/petalos-reglas.csv`, complementadas con el color dominante de las fotos.
9. **Empaquetado.** Genera `data/build/semilla.zip` con el formato de la sección 5 y `data/build/informe-migracion.md` con conteos por origen, correcciones aplicadas, tiras con corte anómalo y registros que quedaron sin foto.

### 8.2 Reglas de limpieza

| Regla | Detalle |
|---|---|
| Espacios | Se eliminan espacios iniciales y finales en todos los textos. Se detectaron 62 celdas en Familia, 79 en Habito, 57 en Ciclo de vida y 174 en Distribución. |
| Categoría MMA | `LC`, `Preocupación menor` y `Preocupación Menor` pasan a `Preocupación Menor`. `-` pasa a vacío. |
| D.S. 68 | `X` pasa a verdadero; `Originaria` (planilla de prefactibilidad) pasa a verdadero; `-` pasa a falso. |
| Hábito | `Hierba Anual` y `Hierba Perenne` pasan a `Hierba anual` y `Hierba perenne`. |
| Distribución | La cadena ` COQ- VAL- RME` se divide por guion y se recorta cada código. |
| Duplicado | Las dos filas de `Adiantum chilense` se fusionan en una. Se conservan los datos completos de la primera y el decreto de la segunda se añade a notas como "También citada en D.S. N° 38/2015". |
| Nombres | `Schinus montanas` pasa a `Schinus montanus`. `Populus alba L.` pasa a `Populus alba`. `cistanthe arenaria` pasa a `Cistanthe arenaria`. `Pyrrhocactus ` queda como `Pyrrhocactus` con `nivel` género. Un espacio de no separación (U+00A0) se reemplaza por espacio normal antes de recortar el texto. Cada cambio se registra en el informe, en la sección "Correcciones de nombre". |
| Sinónimos | `Tetraglochin alata` (prefactibilidad) se une con `Tetraglochin alatum` (base). `Echinopsis chiloensis` se une con `Trichocereus chiloensis`. |
| Notas | Las columnas "Fotos propias o naturalist", "dato random", "Intento de asociacion mental" y la columna T sin encabezado se concatenan en `notas`, separadas por salto de línea, sin alterar el texto. |
| Origen en conflicto | `Proustia cuneifolia` figura como Endémica en la base y Nativa en prefactibilidad. Se conserva Nativa porque la especie también se distribuye en Argentina, y se registra en el informe. |

### 8.3 Reglas de descarga desde iNaturalist

Aplican a los registros sin foto tras la extracción. Son 42 registros: 35 nuevos de prefactibilidad y 7 de la base (Austroflourensia thurifera, Neltuma chilensis, Pentaphorus foliolosus, Poa gayana, Pyrrhocactus, Senecio francisci y Vachellia caven).

- **Taxón.** Consulta `GET /v1/taxa?q=<nombre>&rank=<nivel>` y acepta solo la coincidencia exacta de nombre y rango. Sin coincidencia, el registro queda sin foto y se informa.
- **Observaciones.** Consulta `GET /v1/observations` con `taxon_id`, `quality_grade=research`, `photos=true`, `place_id=7182` (Chile), `order_by=votes`, `per_page=30`. Si no hay resultados en Chile se repite sin `place_id`.
- **Licencias.** Se aceptan fotos con `license_code` en `cc0`, `cc-by`, `cc-by-sa`, `cc-by-nc`, `cc-by-nc-sa`, `cc-by-nd`, `cc-by-nc-nd`. Se descartan las fotos sin licencia.
- **Selección.** Hasta 6 fotos, una por observación, en tamaño `medium` (lado mayor 500 px). Se guardan `autor` (campo `attribution`), `licencia` y `url` de la observación.
- **Ritmo.** Una solicitud por segundo, encabezado `User-Agent` identificable, respuestas en caché en `data/cache/` para poder repetir el pipeline sin volver a consultar.

Las fotos con licencia no comercial son válidas para este uso, que es personal y de estudio. La ficha muestra la atribución (RF7).

### 8.4 Verificación del paquete

El pipeline termina con una comprobación que falla si no se cumple cualquiera de estas condiciones: 425 registros en `especies.json` (391 de la base tras fusionar el duplicado más 34 nuevos), nombres únicos, cada foto de `fotos.json` con su archivo y miniatura en el ZIP, y a lo más 5 registros sin foto (los que iNaturalist no cubra). El informe lista esos registros para completarlos a mano desde la aplicación.

## 9. Publicación e instalación

**Repositorio.** `j-aravena/flora` en GitHub, público, con GitHub Pages sirviendo la rama `main` desde la raíz. El paquete inicial se versiona en el repositorio (estimado 60 MB, bajo el límite de 100 MB por archivo). Regenerarlo agrega ese tamaño al historial, de modo que se regenera solo cuando cambia el pipeline y no para correcciones menores, que se hacen desde la aplicación.

**Contenido publicado.** El paquete incluye las notas personales de la usuaria. La URL no se indexa ni se difunde, y esa exposición se aceptó en el diseño.

**Instalación en Android.** Abrir la URL en Chrome con conexión, esperar el mensaje "Datos cargados" (descarga de unos 60 MB), y en el menú de Chrome elegir "Instalar aplicación" o "Agregar a pantalla de inicio". A partir de ahí se abre desde el ícono. La primera prueba de aceptación es activar el modo avión y recorrer las cuatro pantallas.

## 10. Pruebas

| Nivel | Herramienta | Cobertura |
|---|---|---|
| Unitarias JS | Vitest con `fake-indexeddb` | `db.js` (CRUD, exportar e importar en ambos modos, rechazo de formato desconocido) y `study.js` (pesos, exclusión de recientes, distractores, ascenso y descenso de nivel). |
| Unitarias Python | pytest | Reglas de limpieza, unión con sinónimos, corte de tiras sobre imágenes sintéticas, filtro de licencias con respuestas grabadas. |
| Aceptación | Lista de verificación manual en el teléfono Android | Instalación, modo avión, agregar foto con cámara, editar y borrar, exportar e importar respaldo, ambos ejercicios de estudio, actualización de versión. |

El desarrollo sigue prueba primero para `db.js`, `study.js` y las funciones del pipeline. Las pantallas se verifican con la lista de aceptación.

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| Borrado de datos del navegador por la usuaria. | Almacenamiento persistente y aviso de respaldo a los 30 días. |
| Foto de iNaturalist con identificación errónea. | Solo observaciones con grado de investigación. La usuaria puede borrar la foto desde la aplicación. |
| Especie sin fotos en iNaturalist. | Se informa y se completa a mano con la cámara. |
| iOS borra el almacenamiento tras semanas sin uso. | Fuera del alcance probado; documentado como limitación. |
| Crecimiento del historial de git por el paquete. | Regeneración solo ante cambios del pipeline. |

## 12. Plan de trabajo

1. Pipeline de migración y paquete inicial, con informe.
2. Capa de datos (`db.js`) con pruebas, incluida importación y exportación.
3. Interfaz de lista, ficha y edición, con carga inicial.
4. Modo estudio (`study.js` con pruebas y `ui/estudio.js`).
5. Ajustes, service worker, manifiesto, publicación en GitHub Pages.
6. Pruebas de aceptación en el teléfono y ajustes finales.

El detalle de tareas se escribe en un plan de implementación separado a partir de esta especificación.

## 13. Rasgos florales: color de flor y número de pétalos (extensión del 6 de septiembre de 2026)

La usuaria pidió dos filtros más en la lista: color de la flor, según lo que se ve en las fotos, y número de pétalos, según la clave botánica de cada especie. Ambos rasgos se incorporan al paquete inicial y quedan editables en la ficha, porque las fuentes no cubren todas las especies y la usuaria corrige en terreno.

**Fuentes.** Una investigación previa produjo dos archivos en `data/rasgos/` (fuera de git): `color-flor.csv` (`nombre,colores,fuente,nota`, una fila por registro) y `petalos-reglas.csv` (`ambito,taxon,petalos,tipo,fuente,nota`, reglas por familia, género o especie tomadas de claves botánicas en línea). Cada fila cita la URL consultada.

**Paleta de color.** Diez valores cerrados: `blanco`, `amarillo`, `naranja`, `rojo`, `rosado`, `morado`, `azul`, `verde`, `cafe`, `sin_flor_vistosa`. El pipeline normaliza sinónimos (violeta y lila a `morado`, celeste a `azul`, crema a `blanco`, anaranjado a `naranja`, rosa a `rosado`).

**Color desde las fotos.** Para cada especie el pipeline analiza hasta seis fotos: reduce cada una a 160 px, pasa a HSV, toma los píxeles saturados y claros que no son verdes (tono fuera de 60 a 170 grados) y los agrupa en rojo, naranja, amarillo, azul, morado y rosado por tono; el rojo con saturación baja cuenta como rosado. Un color entra si suma al menos el 25 % de esos píxeles; se conservan hasta dos por foto. Los colores de todas las fotos analizadas se votan y solo se conservan los que reciben al menos la mitad de los votos posibles (mínimo 2 votos), como máximo dos colores; con una sola foto analizada nunca se infiere color, porque una sola lectura no es evidencia suficiente. El blanco no se detecta por fotos porque se confunde con cielo y papel.

**Precedencia.** `colorFlor` toma el valor del CSV cuando existe; si el CSV dice `sin dato`, toma el color de las fotos (si el umbral de votos lo permite) y se anota en el informe bajo "Color desde fotos", agregando a `rasgosFuente` la cadena "Color estimado desde las fotos". Si CSV y fotos no comparten ningún color, se conserva el CSV y se anota bajo "Color en desacuerdo" para revisión manual. `petalos` y `petalosNota` se resuelven con la primera regla que exista en este orden: especie, género (primera palabra del nombre), familia; los registros de nivel familia usan su propio nombre como familia. `petalosNota` combina la etiqueta del tipo de pieza floral (Pétalos, Tépalos, Lígulas, Sin pétalos, Apétala) con la nota de la regla. `rasgosFuente` acumula las URLs usadas.

**Interfaz.** La lista suma dos selectores, "Color de flor" (paleta) y "Pétalos" (valores distintos presentes). La ficha muestra los tres campos cuando no están vacíos. La edición ofrece casillas para los colores y texto para pétalos y nota. Cada fila de la lista y la cabecera de la ficha llevan una banda vertical con el color de flor (dividida en dos cuando hay dos colores) y un tinte suave de fondo del primer color; las especies sin color o sin flor vistosa no cambian de aspecto.

**Verificación.** El informe de migración agrega la sección "Rasgos" con: especies con color desde CSV, desde fotos, sin color; especies con regla de pétalos y sin regla. No se exige un mínimo, porque la usuaria completa desde la aplicación.

---
José Aravena con Claude Code. 5 de septiembre de 2026.
