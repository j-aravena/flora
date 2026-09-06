# Flora offline

Aplicación para estudiar especies de flora con fotos, sin conexión, en un teléfono Android. Reemplaza la planilla
Excel original. Los datos y las fotos viven en el teléfono; GitHub solo sirve para instalar y actualizar.

## Instalación en Android

1. Con conexión a internet, abrir en Chrome: `https://j-aravena.github.io/flora/`
2. Esperar el mensaje "Datos cargados" (descarga de unos 60 MB, una sola vez).
3. En el menú de Chrome (tres puntos) elegir "Instalar aplicación" o "Agregar a pantalla de inicio".
4. Abrir desde el ícono "Flora". Desde ahí funciona sin red.

## Uso

- **Lista.** Buscar por nombre o familia y filtrar por sitio, origen, hábito, aprendizaje, color de flor y pétalos. El botón "+" crea una especie.
- **Ficha.** Fotos, campos y notas. "Editar" permite cambiar cualquier campo (incluidos el color de flor y el número de pétalos) y agregar fotos con la cámara o la galería.
- **Estudio.** Dos ejercicios. "Foto a nombre" muestra una foto y pide recordar el nombre; "Nombre a foto" muestra el nombre y cuatro fotos. Las respuestas actualizan el estado de aprendizaje.
- **Ajustes.** Exportar un respaldo ZIP con todo (enviarlo a Drive o guardarlo fuera del teléfono) e importarlo en otro teléfono o después de reinstalar.

Si se borran los datos de Chrome o se desinstala la aplicación, se pierde todo lo que no esté en un respaldo.

## Desarrollo

- `npm install` y `npm test` para las pruebas de la capa de datos y del modo estudio (33 pruebas).
- `source .venv/bin/activate && pytest -q` para las pruebas del pipeline de migración (57 pruebas).
- `npm run servir` y abrir `http://localhost:8080/`.
- El paquete inicial `semilla/semilla.zip` lo genera `tools/migrar.py` (ver `docs/superpowers/plans/2026-09-05-flora-pipeline.md`).
- Al publicar un cambio de código, sube `FLORA_VERSION` en `version.js` y `version` en `package.json`.
- Especificación: `docs/superpowers/specs/2026-09-05-flora-pwa-design.md`.

## Datos y licencias

- Las fotos extraídas de la planilla original son de la usuaria.
- Las fotos descargadas de iNaturalist llevan autor y licencia Creative Commons en la ficha y son para uso personal de estudio.
- Los colores de flor y el número de pétalos provienen de descripciones y claves botánicas citadas en cada ficha, y pueden corregirse desde la aplicación.
