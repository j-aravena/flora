# Flora offline

Aplicación para estudiar especies de flora con fotos, sin conexión, en un teléfono Android. Reemplaza la planilla
Excel original. Los datos y las fotos viven en el teléfono; GitHub solo sirve para instalar y actualizar.

## Instalación en Android

1. Con conexión a internet, abrir en Chrome: `https://j-aravena.github.io/flora/`
2. Esperar el mensaje "Datos cargados" (descarga de unos 60 MB, una sola vez).
3. En el menú de Chrome (tres puntos) elegir "Instalar aplicación" o "Agregar a pantalla de inicio".
4. Abrir desde el ícono "Flora". Desde ahí funciona sin red.

## Uso

- **Lista.** Buscar por nombre, familia o rasgo. Sobre la lista están los filtros más usados: sitio, familia, hábito y conservación. "Más filtros" abre una hoja con el resto. Identificación: grupo, forma de vida, color de flor y pétalos. Evaluación ambiental: origen, hidrófila y registro previo en el área de influencia (solo Chacao Chonchi). Estudio: aprendizaje y fotos. Cada opción muestra cuántas especies quedan. Los filtros activos aparecen como chips. El orden puede ser alfabético, por familia, como en la presentación del sitio o "me falta primero". La lista recuerda los filtros, el orden y la especie donde quedaste, incluso al cerrar la aplicación. El botón "+" crea una especie.
- **Ficha.** Fotos, rasgo para reconocerla, campos y notas. "‹ Anterior" y "Siguiente ›" recorren la lista filtrada sin volver a ella. "Editar" permite cambiar cualquier campo y agregar fotos con la cámara o la galería.
- **Estudio.** Cuestionario por rondas, con filtros (los mismos de la lista) para elegir qué repasar. Tipos de pregunta: foto a nombre, nombre a foto, familia, forma de vida, color de flor y más, según los datos de cada especie. Al final de cada ronda se ve el resultado y se repasan las que fallaste. Las respuestas actualizan el estado de aprendizaje.
- **Ajustes.** Apariencia: claro, oscuro o automático (sigue al teléfono). El diseño "carta de vegetación" está documentado en `DESIGN.md`. Exportar un respaldo ZIP con todo (enviarlo a Drive o guardarlo fuera del teléfono) e importarlo en otro teléfono o después de reinstalar.

Si se borran los datos de Chrome o se desinstala la aplicación, se pierde todo lo que no esté en un respaldo.

## Desarrollo

- `npm install` y `npm test` para las pruebas de la capa de datos y del modo estudio (87 pruebas).
- `source .venv/bin/activate && pytest -q` para las pruebas del pipeline de migración (150 pruebas, 1 saltada).
- `npm run servir` y abrir `http://localhost:8080/`.
- El paquete inicial `semilla/semilla.zip` lo genera `tools/migrar.py` (ver `docs/superpowers/plans/2026-09-05-flora-pipeline.md`).
- Los listados de sitio posteriores (Nevado Tres Cruces y Chacao Chonchi) los genera `tools/agregar_listado.py` como `semilla/<sitio>.zip`. La aplicación los descarga y aplica una sola vez, en `aplicarListados` de `app.js`. Solo agregan: las especies que ya están en el teléfono, identificadas por id o por nombre, reciben el sitio, las fotos del listado al final y únicamente los campos que les faltaban, sin tocar nunca su avance, sus notas ni sus ediciones.
- `tools/agregar_presentacion.py` genera `semilla/chacao-chonchi.zip` desde el PDF de la presentación de campaña (`data/source/chacao-chonchi.pdf`, no versionado). Con `agregarListado`, las especies que ya estaban reciben además las fotos y los datos que les faltan.
- Al publicar un cambio de código, sube `FLORA_VERSION` en `version.js` y `version` en `package.json`.
- Especificación: `docs/superpowers/specs/2026-09-05-flora-pwa-design.md`.

## Datos completados

`semilla/complementos.zip` agrega a las especies datos que faltaban (familia, hábito, origen, color de flor, número de pétalos, categoría de conservación). La aplicación lo aplica una sola vez y solo llena campos vacíos: nunca pisa lo que la usuaria ya editó. Cada dato nuevo muestra la marca ⓘ con su fuente y se puede revisar; al editarlo, la aplicación pide confirmar. El origen (GBIF/WCVP) y el número de pétalos (Chileflora) son datos de fuente secundaria y quedan marcados ⓘ para revisión. Resultado: 201 especies con 427 campos llenados (detalle y fuentes en `docs/informe-complementos.md`). Lo que no se encontró queda vacío, nunca inventado.

- `tools/completar_datos.py faltantes` lista lo que falta por investigar y `construir` valida los lotes de `tools/datos/complementos/` y regenera el zip y el informe (`PYTHONPATH=tools`). Instrucciones de investigación y evidencia del método en `tools/datos/`.

## Datos y licencias

- Las fotos extraídas de la planilla original son de la usuaria.
- Las fotos descargadas de iNaturalist llevan autor y licencia Creative Commons en la ficha y son para uso personal de estudio.
- Los colores de flor y el número de pétalos provienen de descripciones y claves botánicas citadas en cada ficha, y pueden corregirse desde la aplicación.
- Las fotos e ilustraciones del listado Chacao Chonchi provienen de la presentación de campaña de Del Río, C. y M. Carrasco (2026), para uso interno de estudio.
