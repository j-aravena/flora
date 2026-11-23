# Chacao Chonchi, filtros y memoria de la lista: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: superpowers:subagent-driven-development (recomendada) o superpowers:executing-plans,
> para implementar el plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** agregar el listado Chacao Chonchi desde el PDF, filtros de terreno ordenados en una hoja, y una lista que
recuerda su posición, sus filtros y su orden.

**Arquitectura:** un pipeline en Python (`tools/flora/presentacion.py` y `tools/agregar_presentacion.py`) genera
`semilla/chacao-chonchi.zip` con el formato de respaldo. En la PWA hay tres módulos puros nuevos: `taxonomia.js`,
`filtros.js` y `ui/memoria.js`. `ui/lista.js` se reescribe con hoja de filtros, chips, orden e insignias. `ui/ficha.js`
suma el recorrido anterior/siguiente.

**Tecnología:** JS ES modules sin build, Dexie 4 y vitest (entorno node con fake-indexeddb). En Python, PyMuPDF,
Pillow y pytest.

**Spec:** `docs/superpowers/specs/2026-11-23-chacao-chonchi-y-lista-design.md` (leerlo antes de cada tarea).

## Restricciones globales

- Todo el código, los comentarios, los textos de interfaz y los mensajes de commit van en español, con el estilo del repo:
  nombres en español, funciones cortas, sin dependencias nuevas en la PWA.
- Python: `.venv/Scripts/python -m pytest -q` desde la raíz (Windows; el `.venv` ya existe y tiene `pymupdf`). Para
  imprimir texto con tildes en la consola, usar `PYTHONIOENCODING=utf-8`.
- JS: `npx vitest run`.
- Antes de cada commit, las dos suites deben pasar. Línea base: 60 pruebas de Python (1 saltada) y 43 de JS.
- Sitio: `'Chacao Chonchi'`. Paquete: `semilla/chacao-chonchi.zip`. PDF: `data/source/chacao-chonchi.pdf` (ignorado por git; ya copiado).
- Autor de las fotos: `'Del Río, C. y M. Carrasco (2026)'`. Fuente: `'presentacion'`.
- Versión al publicar: `1.4.0`, en `version.js` y `package.json`.
- Los registros antiguos no tienen `registroAI`, `hidrofila`, `diagnostico` ni `ordenListado`. Leerlos siempre con `??`.
- Mensajes de commit terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `tools/flora/presentacion.py` (nuevo) | Interpretar los spans y las imágenes de una diapositiva |
| `tools/agregar_presentacion.py` (nuevo) | CLI: PDF → registros → cruce con existentes → fotos → zip e informe |
| `tools/flora/union.py` | `_base_registro` con los campos nuevos |
| `taxonomia.js` (nuevo) | grupo, formas de vida, hidrófila y sigla de categoría |
| `filtros.js` (nuevo) | filtrar, contar, ordenar y listar filtros activos |
| `db.js` | constantes ampliadas, campos nuevos, `listarEspecies` con orden, `agregarListado` que completa existentes |
| `ui/memoria.js` (nuevo) | estado persistente de la lista en localStorage |
| `ui/lista.js` | lista con hoja de filtros, chips, orden, insignias y restauración de scroll |
| `ui/ficha.js`, `ui/editar.js`, `ui/estudio.js` | recorrido, diagnóstico, campos nuevos y pista |
| `app.js`, `sw.js`, `styles.css`, `version.js`, `package.json`, `README.md` | integración y publicación |

---

### Tarea 1: Interpretación de una diapositiva (Python, puro)

**Archivos:**
- Crear: `tools/flora/presentacion.py`
- Modificar: `tools/flora/union.py`, en `_base_registro`: agregar `"registroAI": "", "hidrofila": False, "diagnostico": "", "ordenListado": {}`
- Probar: `tools/tests/test_presentacion.py`

**Interfaces:**
- Consume: `flora.union._base_registro(nombre, nivel, ahora) -> dict` y `flora.limpieza.limpiar_texto`.
- Produce:
  - `Span = dict` con las claves `texto: str`, `tamano: float`, `flags: int`, `bbox: tuple[float, float, float, float]`
  - `separar_nombre_y_categoria(linea: str) -> tuple[str, str, str, str]`: devuelve `(nombre_crudo, categoria, sigla_texto, decreto)`
  - `limpiar_nombre(crudo: str) -> str`
  - `normalizar_familia(texto: str) -> str`: devuelve `''` si no es una familia
  - `leer_habito(texto: str) -> tuple[str, str] | None`: devuelve `(habito, habitoDetalle)`
  - `leer_registro_ai(texto_pagina: str) -> str`: `'si'`, `'no'`, `'duda'` o `''`
  - `registro_desde_pagina(spans: list[Span], pagina: int, sitio: str, ahora: str) -> tuple[dict | None, list[str]]`: el registro y sus avisos para el informe
  - Constantes `SIGLAS`, `CORRECCIONES_FAMILIA`, `FAMILIAS_FALTANTES` y `AUTOR`

- [ ] **Paso 1: escribir las pruebas que fallan**

```python
# tools/tests/test_presentacion.py
import pytest

from flora.presentacion import (
    leer_habito, leer_registro_ai, limpiar_nombre, normalizar_familia, registro_desde_pagina,
    separar_nombre_y_categoria,
)

AHORA = "2026-11-23T00:00:00+00:00"


def span(texto, tamano=36, flags=16, x=7, y=508):
    return {"texto": texto, "tamano": tamano, "flags": flags, "bbox": (x, y, x + 200, y + 30)}


@pytest.mark.parametrize("linea, esperado", [
    ("Carex erinacea", ("Carex erinacea", "", "", "")),
    ("Aextoxicon punctatum – LC (D.S. N° 79/2018)", ("Aextoxicon punctatum", "Preocupación Menor", "LC", "D.S. N° 79/2018")),
    ("Austrolycopodium magellanicum (LC D.S. N°13/2013)", ("Austrolycopodium magellanicum", "Preocupación Menor", "LC", "D.S. N° 13/2013")),
    ("Austroblechnum leyboldtianum - (LC D.S. N°19/2012)", ("Austroblechnum leyboldtianum", "Preocupación Menor", "LC", "D.S. N° 19/2012")),
    ("Luma chequen – (LC D.S. 10/2023)", ("Luma chequen", "Preocupación Menor", "LC", "D.S. N° 10/2023")),
    ("Berberidopsis corallina – EP y R (D.S. N° 151/2007)", ("Berberidopsis corallina", "En peligro", "EP y R", "D.S. N° 151/2007")),
    ("Austroblechnum corralense (VU D.S. N°52/2014)", ("Austroblechnum corralense", "Vulnerable", "VU", "D.S. N° 52/2014")),
    ("Hymenophyllum secundum– LC (D.S. N° 52/2014)", ("Hymenophyllum secundum", "Preocupación Menor", "LC", "D.S. N° 52/2014")),
    ("Hymenophyllum nahuelhuapiense – DD (D.S. N° 52/2014)", ("Hymenophyllum nahuelhuapiense", "Datos insuficientes", "DD", "D.S. N° 52/2014")),
    ("Elaphoglossum gayanum (NT D.S. N°13/2013)", ("Elaphoglossum gayanum", "Casi amenazada", "NT", "D.S. N° 13/2013")),
])
def test_separar_nombre_y_categoria(linea, esperado):
    assert separar_nombre_y_categoria(linea) == esperado


@pytest.mark.parametrize("crudo, nombre", [
    ("Carex erinacea", "Carex erinacea"),
    ("Agrostis capillaris L.", "Agrostis capillaris"),
    ("Agrostis stolonifera L. var. stolonifera", "Agrostis stolonifera var. stolonifera"),
    ("Bromus catharticus Vahl var. catharticus.", "Bromus catharticus var. catharticus"),
    ("Gaultheria antarctica Hook. f.", "Gaultheria antarctica"),
    ("Empetrum rubrum Vahl ex Willd.", "Empetrum rubrum"),
    ("Gaultheria pumila var. pumila.", "Gaultheria pumila var. pumila"),
    ("Berberis microphylla G. Forst.", "Berberis microphylla"),
    ("Ovidia pillo-pillo", "Ovidia pillo-pillo"),
])
def test_limpiar_nombre(crudo, nombre):
    assert limpiar_nombre(crudo) == nombre


@pytest.mark.parametrize("texto, familia", [
    ("CYPERACEAE", "Cyperaceae"), ("BERBERIDOPSIS", "Berberidopsidaceae"), ("DROSSERACEAE", "Droseraceae"),
    ("HYNDRANGEACEAE", "Hydrangeaceae"), ("THYMELACEAE", "Thymelaeaceae"), ("Hierba perenne", ""), ("HIDROFILA", ""),
    ("ESPECIE DE HUMEDAL", ""),
])
def test_normalizar_familia(texto, familia):
    assert normalizar_familia(texto) == familia


@pytest.mark.parametrize("texto, esperado", [
    ("Hierba perenne", ("Hierba perenne", "")), ("Árbol", ("Árbol", "")), ("Arbusto", ("Arbusto", "")),
    ("Arbusto trepador", ("Arbusto", "Arbusto trepador")), ("Arbusto rastrero", ("Arbusto", "Arbusto rastrero")),
    ("Arbusto parásito", ("Arbusto", "Arbusto parásito")), ("Arbusto epífito", ("Arbusto", "Arbusto epífito")),
    ("Hierba perenne trepadora", ("Hierba perenne", "Hierba perenne trepadora")), ("Subarbusto", ("Subarbusto", "")),
    ("Hierba anual ", ("Hierba anual", "")), ("CYPERACEAE", None),
])
def test_leer_habito(texto, esperado):
    assert leer_habito(texto) == esperado


@pytest.mark.parametrize("texto, valor", [
    ("Si se ha registrado antes en el AI\nX", "si"), ("NO se ha registrado antes en el AI", "no"),
    ("No se ha registrado antes en el AI", "no"), ("Si se ha registrado antes en el AI?", "duda"),
    ("¿Si se ha registrado antes en el AI ?", "duda"), ("nada", ""),
])
def test_leer_registro_ai(texto, valor):
    assert leer_registro_ai(texto) == valor


def test_registro_con_categoria_oculta_y_diagnostico():
    spans = [
        span("NT (DS 33/2011)", tamano=28, x=755, y=473),               # cuadro oculto detrás de una foto
        span("Greigia sphacelata", flags=18),
        span("Si se ha registrado antes en el AI", tamano=24, y=5),
        span("BROMELIACEAE", tamano=28, x=715, y=9),
        span("Hierba perenne", x=706, y=507),
        span("Láminas foliares serradas en toda su ", tamano=18, y=440),
        span("extensión", tamano=18, y=462),
    ]
    r, avisos = registro_desde_pagina(spans, 48, "Chacao Chonchi", AHORA)
    assert r["nombre"] == "Greigia sphacelata"
    assert r["familia"] == "Bromeliaceae"
    assert r["habito"] == "Hierba perenne"
    assert r["categoriaMMA"] == "" and r["decreto"] == ""
    assert r["registroAI"] == "si"
    assert r["diagnostico"] == "Láminas foliares serradas en toda su extensión"
    assert r["sitios"] == ["Chacao Chonchi"]
    assert r["hidrofila"] is False
    assert "Presentación Chacao Chonchi: p. 48" in r["notas"]
    assert any("NT (DS 33/2011)" in a for a in avisos)


def test_registro_con_categoria_en_spans_separados_y_habito_en_la_misma_linea():
    spans = [
        span("Aextoxicon punctatum – ", flags=18),
        span("LC (D.S. N° 79/2018)  ", x=376),
        span("Si se ha registrado antes en el AI", tamano=24, y=5),
        span("AEXTOXICACEAE", tamano=28, x=711, y=9),
        span("Árbol", x=865, y=507),
    ]
    r, _ = registro_desde_pagina(spans, 58, "Chacao Chonchi", AHORA)
    assert r["nombre"] == "Aextoxicon punctatum"
    assert r["categoriaMMA"] == "Preocupación Menor"
    assert r["decreto"] == "D.S. N° 79/2018"
    assert r["habito"] == "Árbol"


def test_registro_con_dos_siglas_hidrofila_y_span_diminuto():
    spans = [
        span("Berberidopsis corallina – ", flags=18),
        span("EP y R (D.S. N° 151/2007) ", x=382),
        span("NO", tamano=24, y=5), span(" se ha registrado antes en el AI", tamano=24, x=39, y=5),
        span("HIDROFILA", tamano=24, x=700, y=60),
        span("Arbusto", x=828, y=507),
        span("BERBERIDOPSIS", tamano=28, x=715, y=9),
        span("D.S. N° 19/2012", tamano=9, x=1, y=3),
    ]
    r, _ = registro_desde_pagina(spans, 79, "Chacao Chonchi", AHORA)
    assert r["categoriaMMA"] == "En peligro"
    assert "Categoría en la presentación: EP y R" in r["notas"]
    assert r["registroAI"] == "no"
    assert r["hidrofila"] is True
    assert r["familia"] == "Berberidopsidaceae"
    assert r["diagnostico"] == ""


def test_pagina_sin_nombre_devuelve_none():
    r, avisos = registro_desde_pagina([span("Metodología", flags=16)], 3, "Chacao Chonchi", AHORA)
    assert r is None
```

- [ ] **Paso 2: ejecutar y verificar que fallan**

Correr: `.venv/Scripts/python -m pytest tools/tests/test_presentacion.py -q`
Esperado: error de importación (`flora.presentacion` no existe).

- [ ] **Paso 3: implementar**

```python
# tools/flora/presentacion.py
"""Lectura de la presentación de campaña (PDF exportado de PowerPoint): una especie por diapositiva.

Las funciones de interpretación trabajan sobre spans ya extraídos ({texto, tamano, flags, bbox}) para poder
probarlas sin el PDF. La lectura del PDF con PyMuPDF está en spans_de_pagina e imagenes_de_pagina."""
import re

from flora.limpieza import limpiar_texto
from flora.union import _base_registro

AUTOR = "Del Río, C. y M. Carrasco (2026)"
SIGLAS = {
    "LC": "Preocupación Menor", "NT": "Casi amenazada", "VU": "Vulnerable", "EN": "En peligro", "EP": "En peligro",
    "CR": "En peligro crítico", "DD": "Datos insuficientes", "R": "Rara",
}
CORRECCIONES_FAMILIA = {
    "BERBERIDOPSIS": "Berberidopsidaceae", "DROSSERACEAE": "Droseraceae",
    "HYNDRANGEACEAE": "Hydrangeaceae", "THYMELACEAE": "Thymelaeaceae",
}
# Género -> familia, para diapositivas sin rótulo de familia que no se pueden deducir de otras especies.
FAMILIAS_FALTANTES = {"Donatia": "Stylidiaceae"}
HABITOS_PDF = {
    "hierba perenne": ("Hierba perenne", ""), "hierba anual": ("Hierba anual", ""), "árbol": ("Árbol", ""),
    "arbusto": ("Arbusto", ""), "subarbusto": ("Subarbusto", ""),
    "arbusto trepador": ("Arbusto", "Arbusto trepador"), "arbusto rastrero": ("Arbusto", "Arbusto rastrero"),
    "arbusto parásito": ("Arbusto", "Arbusto parásito"), "arbusto epífito": ("Arbusto", "Arbusto epífito"),
    "hierba perenne trepadora": ("Hierba perenne", "Hierba perenne trepadora"),
}
_SIGLA = r"(LC|NT|VU|EN|EP|CR|DD|R)"
_CATEGORIA = re.compile(
    rf"\s*[–-]?\s*\(?\s*{_SIGLA}(?:\s+y\s+{_SIGLA})?\s*\(?\s*D\.?\s*S\.?\s*(?:N\s*°\s*)?(\d+)\s*/\s*(\d{{4}})\s*\)?\s*$")
_CATEGORIA_SUELTA = re.compile(rf"^\s*\(?\s*{_SIGLA}\b.*D\.?\s*S\b")
_REGISTRO_AI = re.compile(r"(¿?)\s*(si|sí|no)\s+se ha registrado antes en el ai\s*(\??)", re.IGNORECASE)
_INFRA = {"var.", "subsp.", "ssp.", "f."}
_MARCAS_HIDROFILA = ("HIDROFILA", "HIDRÓFILA", "ESPECIE DE HUMEDAL")


def _colapsar(texto: str) -> str:
    return " ".join(texto.split())


def separar_nombre_y_categoria(linea: str) -> tuple[str, str, str, str]:
    linea = _colapsar(linea)
    m = _CATEGORIA.search(linea)
    if not m:
        return linea.rstrip(" –-"), "", "", ""
    sigla, sigla2, numero, anio = m.groups()
    nombre = linea[:m.start()].rstrip(" –-")
    sigla_texto = f"{sigla} y {sigla2}" if sigla2 else sigla
    return nombre, SIGLAS[sigla], sigla_texto, f"D.S. N° {numero}/{anio}"


def limpiar_nombre(crudo: str) -> str:
    palabras = _colapsar(crudo).split()
    if len(palabras) < 2:
        return " ".join(palabras).rstrip(".")
    nombre = [palabras[0], palabras[1].rstrip(".")]
    for i, p in enumerate(palabras[2:], start=2):
        siguiente = palabras[i + 1].rstrip(".") if i + 1 < len(palabras) else ""
        if p in _INFRA and siguiente and siguiente[0].islower():
            nombre += [p, siguiente]
            break
    return " ".join(nombre)


def normalizar_familia(texto: str) -> str:
    t = _colapsar(texto)
    if t in CORRECCIONES_FAMILIA:
        return CORRECCIONES_FAMILIA[t]
    if t.isupper() and " " not in t and t.endswith("ACEAE"):
        return t.capitalize()
    return ""


def leer_habito(texto: str):
    return HABITOS_PDF.get(_colapsar(texto).lower())


def leer_registro_ai(texto_pagina: str) -> str:
    m = _REGISTRO_AI.search(_colapsar(texto_pagina))
    if not m:
        return ""
    if m.group(1) or m.group(3):
        return "duda"
    return "no" if m.group(2).lower() == "no" else "si"


def _y(s) -> float:
    return s["bbox"][1]


def registro_desde_pagina(spans, pagina: int, sitio: str, ahora: str):
    avisos = []
    visibles = [s for s in spans if s["tamano"] >= 12 and s["texto"].strip()]
    italicos = [s for s in visibles if s["flags"] & 2 and s["tamano"] >= 30 and _y(s) > 400]
    if not italicos:
        return None, avisos
    y_nombre = _y(italicos[0])
    familia, habito, linea, diagnostico, hidrofila = "", None, [], [], False
    for s in visibles:
        texto = _colapsar(s["texto"])
        if "registrado antes en el AI" in s["texto"] or texto.upper() in ("NO", "SI", "SÍ", "¿SI"):
            continue
        if texto.upper() in _MARCAS_HIDROFILA:
            hidrofila = True
            continue
        if normalizar_familia(texto):
            familia = normalizar_familia(texto)
            continue
        if leer_habito(texto):
            habito = habito or leer_habito(texto)
            continue
        if abs(_y(s) - y_nombre) < 8:
            linea.append(s)
            continue
        if _CATEGORIA_SUELTA.search(texto):
            avisos.append(f"p. {pagina}: se ignora la categoría fuera de la línea del nombre: {texto}")
            continue
        if 14 <= s["tamano"] <= 22:
            diagnostico.append(s)
    texto_linea = "".join(s["texto"] for s in sorted(linea, key=lambda s: s["bbox"][0]))
    crudo, categoria, sigla_texto, decreto = separar_nombre_y_categoria(texto_linea)
    nombre = limpiar_nombre(crudo)
    r = _base_registro(nombre, "especie", ahora)
    notas = [f"Presentación {sitio}: p. {pagina}"]
    if " y " in sigla_texto:
        notas.append(f"Categoría en la presentación: {sigla_texto}")
    texto_pagina = " ".join(s["texto"] for s in visibles)
    r.update({
        "familia": familia,
        "habito": habito[0] if habito else "",
        "habitoDetalle": habito[1] if habito else "",
        "categoriaMMA": categoria,
        "decreto": decreto,
        "sitios": [sitio],
        "registroAI": leer_registro_ai(texto_pagina),
        "hidrofila": hidrofila,
        "diagnostico": _colapsar(" ".join(s["texto"] for s in sorted(diagnostico, key=lambda s: (_y(s), s["bbox"][0])))),
        "notas": "\n".join(notas),
        "_pagina": pagina,
        "_nombre_pdf": _colapsar(texto_linea),
    })
    if not habito:
        avisos.append(f"p. {pagina}: {nombre} sin hábito")
    return r, avisos
```

Notas para quien implemente:
- `limpiar_texto` queda importado solo si se usa; si no, quitar el import.
- El span `"NO"` de la página 79 llega separado de `" se ha registrado..."`. Por eso se descartan los spans `NO`/`SI`
  sueltos y el registro se lee del texto completo de la página. `leer_registro_ai` colapsa los espacios, así que
  `"NO  se ha"` también calza.
- Si una prueba de los parámetros falla por un detalle del regex (por ejemplo `N°13` pegado), corregir el regex, no la prueba.

- [ ] **Paso 4: ejecutar y verificar que pasan**

Correr: `.venv/Scripts/python -m pytest -q`
Esperado: todas pasan, las 60 de antes más las nuevas. Si alguna prueba de `test_union` comparaba las claves exactas de
`_base_registro`, actualizarla para incluir los 4 campos nuevos.

- [ ] **Paso 5: commit**

```bash
git add tools/flora/presentacion.py tools/flora/union.py tools/tests/test_presentacion.py
git commit -m "Pipeline: interpretación de diapositivas de la presentación Chacao Chonchi"
```

---

### Tarea 2: Lectura del PDF, fotos y paquete `chacao-chonchi.zip`

**Archivos:**
- Modificar: `tools/flora/presentacion.py` (agregar `spans_de_pagina`, `es_ilustracion`, `imagenes_de_pagina`)
- Crear: `tools/agregar_presentacion.py`
- Modificar: `tools/requirements.txt` (agregar `pymupdf==1.26.5` o la versión instalada en `.venv`, según `pip show pymupdf`)
- Probar: `tools/tests/test_presentacion.py` (pruebas de `es_ilustracion` e integración con el PDF)
- Genera: `semilla/chacao-chonchi.zip`, `docs/informe-chacao-chonchi.md`

**Interfaces:**
- Consume: `registro_desde_pagina`, `FAMILIAS_FALTANTES` y `AUTOR` de la Tarea 1; `flora.imagenes.crear_foto(especie_id, im, fuente, orden, ahora, autor=...)`;
  `flora.paquete.construir_zip`, `verificar_zip` y `sin_foto`; `flora.union.inferir_familias`; `flora.limpieza.clave`; `flora.informe.Informe`.
- Produce: `semilla/chacao-chonchi.zip` en formato 1. Incluye `especies.json` con los registros (los existentes con el id y
  el nombre de la app, `sitios: ['Chacao Chonchi']` y `ordenListado: {'Chacao Chonchi': n}`), `fotos.json` y los WebP.

- [ ] **Paso 1: escribir las pruebas que fallan**

Agregar a `tools/tests/test_presentacion.py`:

```python
from pathlib import Path

from PIL import Image

from flora.presentacion import es_ilustracion

PDF = Path("data/source/chacao-chonchi.pdf")


def test_es_ilustracion():
    dibujo = Image.new("RGB", (300, 300), "white")
    for x in range(0, 300, 10):
        for y in range(300):
            dibujo.putpixel((x, y), (20, 20, 20))
    foto = Image.new("RGB", (300, 300), (40, 120, 30))
    assert es_ilustracion(dibujo) is True
    assert es_ilustracion(foto) is False


@pytest.mark.skipif(not PDF.exists(), reason="sin el PDF de la presentación")
@pytest.mark.parametrize("pagina, nombre, familia, habito, categoria, ai", [
    (18, "Carex erinacea", "Cyperaceae", "Hierba perenne", "", "si"),
    (47, "Fascicularia bicolor", "Bromeliaceae", "Hierba perenne", "", "si"),
    (58, "Aextoxicon punctatum", "Aextoxicaceae", "Árbol", "Preocupación Menor", "si"),
    (79, "Berberidopsis corallina", "Berberidopsidaceae", "Arbusto", "En peligro", "no"),
    (188, "Hymenophyllum falklandicum", "Hymenophyllaceae", "Hierba perenne", "Preocupación Menor", "duda"),
])
def test_paginas_reales(pagina, nombre, familia, habito, categoria, ai):
    import pymupdf
    from flora.presentacion import imagenes_de_pagina, spans_de_pagina
    doc = pymupdf.open(PDF)
    r, _ = registro_desde_pagina(spans_de_pagina(doc[pagina - 1]), pagina, "Chacao Chonchi", AHORA)
    assert (r["nombre"], r["familia"], r["habito"], r["categoriaMMA"], r["registroAI"]) == (nombre, familia, habito, categoria, ai)
    imagenes = imagenes_de_pagina(doc, doc[pagina - 1], set())
    assert len(imagenes) >= 2
    assert not es_ilustracion(imagenes[0])  # la miniatura es una foto
```

- [ ] **Paso 2: ejecutar y verificar que fallan**

Correr: `.venv/Scripts/python -m pytest tools/tests/test_presentacion.py -q`
Esperado: `ImportError` de `es_ilustracion`.

- [ ] **Paso 3: implementar la lectura del PDF**

Agregar a `tools/flora/presentacion.py`:

```python
import io

import numpy as np
from PIL import Image


def spans_de_pagina(page) -> list[dict]:
    salida = []
    for bloque in page.get_text("dict")["blocks"]:
        for linea in bloque.get("lines", []):
            for s in linea["spans"]:
                salida.append({"texto": s["text"], "tamano": s["size"], "flags": s["flags"], "bbox": tuple(s["bbox"])})
    return salida


def es_ilustracion(im: Image.Image) -> bool:
    chica = im.convert("RGB").copy()
    chica.thumbnail((200, 200))
    a = np.asarray(chica).astype(np.float32)
    blancos = (a.min(axis=2) > 225).mean()
    maximo, minimo = a.max(axis=2), a.min(axis=2)
    saturacion = np.where(maximo > 0, (maximo - minimo) / np.maximum(maximo, 1), 0).mean()
    return bool(blancos > 0.6 and saturacion < 0.12)


def _imagen_de_xref(doc, xref: int) -> Image.Image:
    import pymupdf
    pix = pymupdf.Pixmap(doc, xref)
    if pix.alpha:
        # Aplana la transparencia sobre blanco.
        im = Image.frombytes("RGBA", (pix.width, pix.height), pix.samples)
        fondo = Image.new("RGB", im.size, "white")
        fondo.paste(im, mask=im.split()[3])
        return fondo
    if pix.n - pix.alpha != 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")


def imagenes_de_pagina(doc, page, excluidos: set[int], lado_min: int = 150) -> list[Image.Image]:
    """Imágenes embebidas de la diapositiva, sin los textos superpuestos. Primero las fotos por área
    mostrada, de mayor a menor, y al final las ilustraciones."""
    vistas, candidatas = set(), []
    for info in page.get_image_info(xrefs=True):
        xref = info.get("xref")
        if not xref or xref in vistas or xref in excluidos:
            continue
        vistas.add(xref)
        if min(info["width"], info["height"]) < lado_min:
            continue
        x0, y0, x1, y1 = info["bbox"]
        im = _imagen_de_xref(doc, xref)
        candidatas.append((es_ilustracion(im), -(x1 - x0) * (y1 - y0), im))
    candidatas.sort(key=lambda c: (c[0], c[1]))
    return [im for _, _, im in candidatas]
```

- [ ] **Paso 4: implementar el CLI**

```python
# tools/agregar_presentacion.py
"""Genera el paquete incremental del sitio Chacao Chonchi desde la presentación de campaña (PDF).

Uso: python tools/agregar_presentacion.py [--salida data/build]

Cada diapositiva de las páginas 18 a 202 es una especie. Las especies que ya están en la aplicación (por nombre o por
binomio) se incluyen con su id y su nombre, para que la aplicación les sume el sitio, las fotos y los datos que les falten."""
import argparse
import collections
import json
import shutil
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

from flora.imagenes import crear_foto
from flora.informe import Informe
from flora.limpieza import clave
from flora.paquete import construir_zip, sin_foto, verificar_zip
from flora.presentacion import AUTOR, FAMILIAS_FALTANTES, imagenes_de_pagina, registro_desde_pagina, spans_de_pagina
from flora.union import inferir_familias

SITIO = "Chacao Chonchi"
RUTA_PDF = Path("data/source/chacao-chonchi.pdf")
PRIMERA, ULTIMA = 18, 202
RUTA_PAQUETE = Path("semilla/chacao-chonchi.zip")
EXISTENTES = [Path("semilla/semilla.zip"), Path("semilla/nevado-tres-cruces.zip")]
MINIMO = 180


def cargar_existentes() -> dict[str, dict]:
    salida = {}
    for ruta in EXISTENTES:
        with zipfile.ZipFile(ruta) as z:
            for e in json.loads(z.read("especies.json")):
                salida.setdefault(clave(e["nombre"]), e)
    return salida


def buscar_existente(nombre: str, existentes: dict[str, dict]):
    return existentes.get(clave(nombre)) or existentes.get(clave(" ".join(nombre.split()[:2])))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--salida", default="data/build")
    args = ap.parse_args(argv)
    salida = Path(args.salida)
    salida.mkdir(parents=True, exist_ok=True)
    ahora = datetime.now(timezone.utc).isoformat(timespec="seconds")
    informe = Informe()
    doc = pymupdf.open(RUTA_PDF)

    # Imágenes repetidas en muchas diapositivas (fondos, logos) no son fotos de la especie.
    usos = collections.Counter()
    for n in range(PRIMERA, ULTIMA + 1):
        usos.update({i["xref"] for i in doc[n - 1].get_image_info(xrefs=True) if i.get("xref")})
    excluidos = {x for x, c in usos.items() if c > 3}

    registros, paginas_de, indice = [], {}, {}
    for n in range(PRIMERA, ULTIMA + 1):
        r, avisos = registro_desde_pagina(spans_de_pagina(doc[n - 1]), n, SITIO, ahora)
        for a in avisos:
            informe.agregar("Avisos de lectura", a)
        if r is None:
            informe.agregar("Páginas sin especie", f"p. {n}")
            continue
        k = clave(r["nombre"])
        if k in indice:
            informe.agregar("Duplicados fusionados", f"{r['nombre']}: p. {indice[k]['_pagina']} y p. {n}")
            paginas_de[k].append(n)
            continue
        indice[k] = r
        paginas_de[k] = [n]
        r["_clave"] = k  # clave del nombre del PDF, antes de renombrar a una especie existente
        registros.append(r)
        if r["_nombre_pdf"] != r["nombre"]:
            informe.agregar("Nombres limpiados", f"{r['_nombre_pdf']} → {r['nombre']}")

    existentes = cargar_existentes()
    inferir_familias(list(existentes.values()) + registros, informe)
    for i, r in enumerate(registros, start=1):
        r["ordenListado"] = {SITIO: i}
        if not r["familia"]:
            r["familia"] = FAMILIAS_FALTANTES.get(r["nombre"].split()[0], "")
            if r["familia"]:
                informe.agregar("Familias asignadas a mano", f"{r['nombre']}: {r['familia']}")
        e = buscar_existente(r["nombre"], existentes)
        if e:
            informe.agregar("Ya estaban en la aplicación (se suman sitio, fotos y datos faltantes)", f"{r['nombre']} → {e['nombre']}")
            r["id"], r["nombre"] = e["id"], e["nombre"]

    fotos = []
    for r in registros:
        orden = 0
        for n in paginas_de_registro(r, paginas_de):
            for im in imagenes_de_pagina(doc, doc[n - 1], excluidos):
                fotos.append(crear_foto(r["id"], im, "presentacion", orden, ahora, autor=AUTOR))
                orden += 1
        informe.agregar("Fotos extraídas", f"{r['nombre']}: {orden}")

    errores = verificar(registros, fotos)
    construir_zip(RUTA_PAQUETE, registros, fotos, ahora)
    errores += verificar_zip(RUTA_PAQUETE)
    for e in errores:
        informe.agregar("Errores de verificación", e)
    informe.escribir(salida / "informe-chacao-chonchi.md")
    shutil.copy(salida / "informe-chacao-chonchi.md", "docs/informe-chacao-chonchi.md")
    print(f"{len(registros)} especies, {len(fotos)} fotos, paquete {RUTA_PAQUETE.stat().st_size / 1e6:.1f} MB")
    if errores:
        print("ERRORES:", *errores, sep="\n  ")
        return 1
    return 0
```

Las páginas de cada registro se buscan por `r["_clave"]`, la clave del nombre original del PDF. Agregar al mismo archivo,
antes de `main`:

```python
def paginas_de_registro(r: dict, paginas_de: dict[str, list[int]]) -> list[int]:
    return paginas_de[r["_clave"]]


def verificar(registros: list[dict], fotos: list[dict]) -> list[str]:
    errores = []
    if len(registros) < MINIMO:
        errores.append(f"{len(registros)} especies, se esperaban al menos {MINIMO}")
    if "�" in json.dumps(registros, ensure_ascii=False):
        errores.append("texto con U+FFFD")
    sin_familia = [r["nombre"] for r in registros if not r["familia"]]
    if sin_familia:
        errores.append(f"sin familia: {sin_familia}")
    faltan = sin_foto(registros, fotos)
    if faltan:
        errores.append(f"sin foto: {faltan}")
    claves = [clave(r["nombre"]) for r in registros]
    if len(set(claves)) != len(claves):
        errores.append("nombres repetidos")
    return errores


if __name__ == "__main__":
    sys.exit(main())
```

`construir_zip` ya descarta las claves que empiezan con `_`. Comprobar con `grep -n "def crear_foto" tools/flora/imagenes.py`
que `crear_foto` acepta `autor=`.

- [ ] **Paso 5: ejecutar las pruebas y el pipeline**

Correr: `.venv/Scripts/python -m pytest -q`. Esperado: todo pasa y las pruebas de integración corren (el PDF está).
Correr: `cd tools && PYTHONIOENCODING=utf-8 ../.venv/Scripts/python agregar_presentacion.py --salida ../data/build; cd ..`
(o desde la raíz con `PYTHONPATH=tools`, igual que `pytest.ini`; las rutas del script son relativas a la raíz, así que
lo correcto es correr desde la raíz: `PYTHONPATH=tools PYTHONIOENCODING=utf-8 .venv/Scripts/python tools/agregar_presentacion.py`).
Esperado: unas 185 especies, sin errores y un paquete de menos de 90 MB.

- [ ] **Paso 6: revisar el resultado a ojo**

- Leer `docs/informe-chacao-chonchi.md`: nombres limpiados, duplicados, existentes (unas 15), avisos de categoría oculta
  (unas 25) y especies sin hábito (se espera Dactylis glomerata).
- Abrir 6 fotos al azar del zip, incluida la primera (orden 0) de 3 especies, y confirmar que **no llevan el nombre
  impreso** y que la primera es una foto y no una ilustración. Para guardarlas en el scratchpad:
  `python -I -c "import zipfile,sys; z=zipfile.ZipFile('semilla/chacao-chonchi.zip'); ..."`.
- Si alguna foto es un recorte inútil (una franja, un logo), ajustar `lado_min` o los excluidos y volver a correr.

- [ ] **Paso 7: commit**

```bash
git add tools/flora/presentacion.py tools/agregar_presentacion.py tools/requirements.txt tools/tests/test_presentacion.py semilla/chacao-chonchi.zip docs/informe-chacao-chonchi.md
git commit -m "Listado Chacao Chonchi: paquete desde la presentación de campaña"
```

---

### Tarea 3: Taxonomía y modelo de datos (JS)

**Archivos:**
- Crear: `taxonomia.js`
- Modificar: `db.js`: `SITIOS`, `HABITOS`, `CATEGORIAS` y `nuevaEspecie`
- Probar: `tests/taxonomia.test.js`; actualizar `tests/db.test.js` (prueba de `nuevaEspecie`)

**Interfaces:**
- Produce (`taxonomia.js`, sin imports de `db.js`):
  - `GRUPOS: string[]` = `['Helechos y licófitas', 'Gimnospermas', 'Monocotiledóneas', 'Dicotiledóneas']`
  - `FORMAS_VIDA: string[]` = `['Trepadora', 'Rastrera', 'Epífita', 'Parásita']`
  - `grupoDe(e) -> string` (`''` sin familia)
  - `formasVida(e) -> string[]`
  - `esHidrofila(e) -> boolean`
  - `siglaCategoria(categoria) -> string` (`''` si no hay)
  - `nivelCategoria(categoria) -> 'amenazada' | 'casi' | 'otra' | ''`

- [ ] **Paso 1: escribir las pruebas que fallan**

```js
// tests/taxonomia.test.js
import { describe, it, expect } from 'vitest';
import { GRUPOS, FORMAS_VIDA, grupoDe, formasVida, esHidrofila, siglaCategoria, nivelCategoria } from '../taxonomia.js';
import { nuevaEspecie, CATEGORIAS, HABITOS, SITIOS } from '../db.js';

describe('taxonomía', () => {
  it('grupoDe clasifica por familia', () => {
    expect(grupoDe({ familia: 'Hymenophyllaceae' })).toBe('Helechos y licófitas');
    expect(grupoDe({ familia: 'Equisetaceae' })).toBe('Helechos y licófitas');
    expect(grupoDe({ familia: 'Podocarpaceae' })).toBe('Gimnospermas');
    expect(grupoDe({ familia: 'Ephedraceae' })).toBe('Gimnospermas');
    expect(grupoDe({ familia: 'Cyperaceae' })).toBe('Monocotiledóneas');
    expect(grupoDe({ familia: 'Luzuriagaceae' })).toBe('Monocotiledóneas');
    expect(grupoDe({ familia: 'Myrtaceae' })).toBe('Dicotiledóneas');
    expect(grupoDe({ familia: '' })).toBe('');
    expect(GRUPOS).toHaveLength(4);
  });

  it('formasVida lee el hábito detallado sin tildes', () => {
    expect(formasVida({ habitoDetalle: 'Arbusto trepador' })).toEqual(['Trepadora']);
    expect(formasVida({ habitoDetalle: 'Hierba trepadora' })).toEqual(['Trepadora']);
    expect(formasVida({ habitoDetalle: 'Arbusto parasito' })).toEqual(['Parásita']);
    expect(formasVida({ habitoDetalle: 'Arbusto epífito' })).toEqual(['Epífita']);
    expect(formasVida({ habitoDetalle: 'Arbusto rastrero' })).toEqual(['Rastrera']);
    expect(formasVida({})).toEqual([]);
    expect(FORMAS_VIDA).toEqual(['Trepadora', 'Rastrera', 'Epífita', 'Parásita']);
  });

  it('esHidrofila usa el campo o la nota de Nevado', () => {
    expect(esHidrofila({ hidrofila: true })).toBe(true);
    expect(esHidrofila({ notas: 'Especie hidrófila: vega' })).toBe(true);
    expect(esHidrofila({ notas: '' })).toBe(false);
  });

  it('siglas y niveles de categoría', () => {
    expect(siglaCategoria('Preocupación Menor')).toBe('LC');
    expect(siglaCategoria('En peligro crítico')).toBe('CR');
    expect(siglaCategoria('')).toBe('');
    expect(nivelCategoria('Vulnerable')).toBe('amenazada');
    expect(nivelCategoria('Casi amenazada')).toBe('casi');
    expect(nivelCategoria('Rara')).toBe('otra');
    expect(nivelCategoria('')).toBe('');
  });

  it('constantes y valores por defecto nuevos', () => {
    expect(SITIOS).toContain('Chacao Chonchi');
    expect(HABITOS).toContain('Subarbusto');
    expect(CATEGORIAS).toEqual(['Preocupación Menor', 'Casi amenazada', 'Vulnerable', 'En peligro', 'En peligro crítico', 'Datos insuficientes', 'Rara']);
    expect(nuevaEspecie()).toMatchObject({ registroAI: '', hidrofila: false, diagnostico: '', ordenListado: {} });
  });
});
```

- [ ] **Paso 2: ejecutar y verificar que fallan**

Correr: `npx vitest run tests/taxonomia.test.js`. Esperado: falla por el módulo inexistente.

- [ ] **Paso 3: implementar**

```js
// taxonomia.js
// Valores derivados de la especie que no se guardan: grupo, formas de vida, hidrófila y sigla de categoría.
// No importa db.js, para que db.js y filtros.js puedan usarlo sin ciclos.

const plano = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const GRUPOS = ['Helechos y licófitas', 'Gimnospermas', 'Monocotiledóneas', 'Dicotiledóneas'];

const HELECHOS = new Set(['Aspleniaceae', 'Athyriaceae', 'Azollaceae', 'Blechnaceae', 'Cystopteridaceae', 'Dennstaedtiaceae',
  'Dicksoniaceae', 'Dryopteridaceae', 'Equisetaceae', 'Gleicheniaceae', 'Hymenophyllaceae', 'Isoetaceae', 'Lindsaeaceae',
  'Lophosoriaceae', 'Lycopodiaceae', 'Marsileaceae', 'Ophioglossaceae', 'Osmundaceae', 'Polypodiaceae', 'Pteridaceae',
  'Salviniaceae', 'Schizaeaceae', 'Selaginellaceae', 'Thelypteridaceae', 'Woodsiaceae']);
const GIMNOSPERMAS = new Set(['Araucariaceae', 'Cupressaceae', 'Ephedraceae', 'Pinaceae', 'Podocarpaceae', 'Taxaceae']);
const MONOCOTILEDONEAS = new Set(['Alismataceae', 'Alliaceae', 'Alstroemeriaceae', 'Amaryllidaceae', 'Araceae', 'Arecaceae',
  'Asparagaceae', 'Asphodelaceae', 'Asteliaceae', 'Bromeliaceae', 'Commelinaceae', 'Cyperaceae', 'Dioscoreaceae',
  'Hydrocharitaceae', 'Iridaceae', 'Juncaceae', 'Juncaginaceae', 'Lemnaceae', 'Liliaceae', 'Luzuriagaceae', 'Orchidaceae',
  'Philesiaceae', 'Poaceae', 'Potamogetonaceae', 'Restionaceae', 'Ruppiaceae', 'Smilacaceae', 'Tecophilaeaceae',
  'Themidaceae', 'Typhaceae', 'Xanthorrhoeaceae', 'Zannichelliaceae']);

export function grupoDe(e) {
  const f = (e.familia ?? '').trim();
  if (!f) return '';
  if (HELECHOS.has(f)) return 'Helechos y licófitas';
  if (GIMNOSPERMAS.has(f)) return 'Gimnospermas';
  if (MONOCOTILEDONEAS.has(f)) return 'Monocotiledóneas';
  return 'Dicotiledóneas';
}

export const FORMAS_VIDA = ['Trepadora', 'Rastrera', 'Epífita', 'Parásita'];
const RAICES_FORMA = [['trepador', 'Trepadora'], ['rastrer', 'Rastrera'], ['epifit', 'Epífita'], ['parasit', 'Parásita']];

export function formasVida(e) {
  const t = plano(e.habitoDetalle);
  return RAICES_FORMA.filter(([raiz]) => t.includes(raiz)).map(([, forma]) => forma);
}

export function esHidrofila(e) {
  return Boolean(e.hidrofila) || plano(e.notas).includes('especie hidrofila');
}

const SIGLAS = {
  'Preocupación Menor': 'LC', 'Casi amenazada': 'NT', Vulnerable: 'VU', 'En peligro': 'EN', 'En peligro crítico': 'CR',
  'Datos insuficientes': 'DD', Rara: 'R',
};

export function siglaCategoria(categoria) {
  return SIGLAS[categoria] ?? '';
}

export function nivelCategoria(categoria) {
  if (!categoria) return '';
  if (['Vulnerable', 'En peligro', 'En peligro crítico'].includes(categoria)) return 'amenazada';
  if (categoria === 'Casi amenazada') return 'casi';
  return 'otra';
}
```

En `db.js`:
- `SITIOS`: agregar `'Chacao Chonchi'` al final.
- `HABITOS`: `['Hierba anual', 'Hierba perenne', 'Subarbusto', 'Arbusto', 'Árbol', 'Suculenta']`.
- `CATEGORIAS`: los 7 valores de la prueba.
- `nuevaEspecie`: agregar `registroAI: '', hidrofila: false, diagnostico: '', ordenListado: {},` antes de `creadoEn`.

Revisar las familias de las semillas contra las listas con
`.venv/Scripts/python -I -c "import zipfile,json; ..."`, o con la salida del pipeline de la Tarea 2 si ya está. Toda
familia de helechos, gimnospermas o monocotiledóneas presente en los datos debe estar en su lista; si falta alguna, agregarla.

- [ ] **Paso 4: ejecutar y verificar que pasan**

Correr: `npx vitest run`. Esperado: todo pasa.

- [ ] **Paso 5: commit**

```bash
git add taxonomia.js db.js tests/taxonomia.test.js tests/db.test.js
git commit -m "Taxonomía derivada (grupo, formas de vida, hidrófila) y campos nuevos de especie"
```

---

### Tarea 4: Filtros, conteos y orden (JS puro)

**Archivos:**
- Crear: `filtros.js`
- Modificar: `db.js` (`listarEspecies`)
- Probar: `tests/filtros.test.js`

**Interfaces:**
- Consume: `grupoDe`, `formasVida` y `esHidrofila` de `taxonomia.js`.
- Produce (`filtros.js`):
  - `FILTRO_VACIO` con las claves `texto, grupo, familia, habito, formaVida, colorFlor, petalos, categoria, origen, hidrofila, registroAI, sitio, aprendizaje, foto`, todas `''`
  - `cumple(e, filtro, ctx = { conFoto: new Set() }, excepto = null) -> boolean`
  - `filtrar(especies, filtro, ctx) -> especie[]`
  - `conteos(especies, filtro, clave, valores, ctx) -> Map<string, number>`
  - `hayOrdenListado(especies, sitio) -> boolean`
  - `ordenar(especies, orden = 'nombre', sitio = '') -> especie[]` (copia)
  - `filtrosActivos(filtro) -> Array<{ clave, valor }>`, sin `texto`
  - `ORDENES = [['nombre', 'A–Z'], ['familia', 'Por familia'], ['listado', 'Como en la presentación'], ['aprendizaje', 'Me falta primero']]`
- `db.js`: `listarEspecies(db, filtro = {}, orden = 'nombre')`.

- [ ] **Paso 1: escribir las pruebas que fallan**

```js
// tests/filtros.test.js
import { describe, it, expect } from 'vitest';
import { FILTRO_VACIO, cumple, filtrar, conteos, ordenar, hayOrdenListado, filtrosActivos } from '../filtros.js';
import { crearDb, nuevaEspecie, guardarEspecie, agregarFoto, listarEspecies } from '../db.js';

const e = (nombre, datos = {}) => nuevaEspecie({ nombre, ...datos });
const especies = [
  e('Hymenophyllum dentatum', { familia: 'Hymenophyllaceae', habito: 'Hierba perenne', categoriaMMA: 'Preocupación Menor', sitios: ['Chacao Chonchi'], registroAI: 'si', ordenListado: { 'Chacao Chonchi': 3 }, diagnostico: 'Frondes con pelos' }),
  e('Luzuriaga radicans', { familia: 'Luzuriagaceae', habito: 'Arbusto', habitoDetalle: 'Arbusto trepador', sitios: ['Chacao Chonchi'], registroAI: 'duda', ordenListado: { 'Chacao Chonchi': 1 }, aprendizaje: 'falta' }),
  e('Luma chequen', { familia: 'Myrtaceae', habito: 'Árbol', hidrofila: true, categoriaMMA: 'Vulnerable', sitios: ['Chacao Chonchi'], registroAI: 'no', ordenListado: { 'Chacao Chonchi': 2 }, aprendizaje: 'no' }),
  e('Adesmia confusa', { familia: 'Fabaceae', habito: 'Arbusto', sitios: ['STP'], notas: 'Especie hidrófila', aprendizaje: 'se' }),
  e('Zea mays', { familia: '', habito: 'Hierba anual', sitios: ['STP'] }),
];
const nombres = l => l.map(x => x.nombre);
const f = cambios => ({ ...FILTRO_VACIO, ...cambios });

describe('filtros', () => {
  it('cada filtro', () => {
    expect(nombres(filtrar(especies, f({ grupo: 'Helechos y licófitas' })))).toEqual(['Hymenophyllum dentatum']);
    expect(nombres(filtrar(especies, f({ grupo: 'Monocotiledóneas' })))).toEqual(['Luzuriaga radicans']);
    expect(nombres(filtrar(especies, f({ familia: 'Myrtaceae' })))).toEqual(['Luma chequen']);
    expect(nombres(filtrar(especies, f({ formaVida: 'Trepadora' })))).toEqual(['Luzuriaga radicans']);
    expect(nombres(filtrar(especies, f({ categoria: 'alguna' })))).toEqual(['Hymenophyllum dentatum', 'Luma chequen']);
    expect(nombres(filtrar(especies, f({ categoria: 'Vulnerable' })))).toEqual(['Luma chequen']);
    expect(nombres(filtrar(especies, f({ hidrofila: 'si' })))).toEqual(['Luma chequen', 'Adesmia confusa']);
    expect(nombres(filtrar(especies, f({ registroAI: 'duda' })))).toEqual(['Luzuriaga radicans']);
    expect(nombres(filtrar(especies, f({ sitio: 'STP', habito: 'Arbusto' })))).toEqual(['Adesmia confusa']);
    expect(nombres(filtrar(especies, f({ texto: 'pelos' })))).toEqual(['Hymenophyllum dentatum']);
    expect(nombres(filtrar(especies, f({ texto: 'MYRTA' })))).toEqual(['Luma chequen']);
    expect(nombres(filtrar(especies, f({ aprendizaje: 'sin' })))).toEqual(['Hymenophyllum dentatum', 'Zea mays']);
    const conFoto = new Set([especies[0].id]);
    expect(nombres(filtrar(especies, f({ foto: 'con' }), { conFoto }))).toEqual(['Hymenophyllum dentatum']);
    expect(filtrar(especies, f({ foto: 'sin' }), { conFoto })).toHaveLength(4);
  });

  it('cumple ignora la clave exceptuada', () => {
    expect(cumple(especies[3], f({ sitio: 'Chacao Chonchi' }), undefined, 'sitio')).toBe(true);
    expect(cumple(especies[3], f({ sitio: 'Chacao Chonchi' }))).toBe(false);
  });

  it('conteos usa los demás filtros y no el propio', () => {
    const c = conteos(especies, f({ sitio: 'Chacao Chonchi', habito: 'Árbol' }), 'habito', ['Arbusto', 'Árbol', 'Hierba anual']);
    expect(c.get('Arbusto')).toBe(1);
    expect(c.get('Árbol')).toBe(1);
    expect(c.get('Hierba anual')).toBe(0);
  });

  it('ordenar por nombre, familia, listado y aprendizaje', () => {
    expect(nombres(ordenar(especies))).toEqual(['Adesmia confusa', 'Hymenophyllum dentatum', 'Luma chequen', 'Luzuriaga radicans', 'Zea mays']);
    expect(nombres(ordenar(especies, 'familia'))).toEqual(['Adesmia confusa', 'Hymenophyllum dentatum', 'Luzuriaga radicans', 'Luma chequen', 'Zea mays']);
    expect(nombres(ordenar(especies, 'listado', 'Chacao Chonchi'))).toEqual(['Luzuriaga radicans', 'Luma chequen', 'Hymenophyllum dentatum', 'Adesmia confusa', 'Zea mays']);
    expect(nombres(ordenar(especies, 'listado', ''))).toEqual(nombres(ordenar(especies)));
    expect(nombres(ordenar(especies, 'aprendizaje'))).toEqual(['Luma chequen', 'Luzuriaga radicans', 'Hymenophyllum dentatum', 'Zea mays', 'Adesmia confusa']);
    expect(hayOrdenListado(especies, 'Chacao Chonchi')).toBe(true);
    expect(hayOrdenListado(especies, 'STP')).toBe(false);
  });

  it('filtrosActivos omite vacíos y el texto', () => {
    expect(filtrosActivos(f({ texto: 'x', sitio: 'STP', categoria: 'alguna' }))).toEqual([
      { clave: 'categoria', valor: 'alguna' }, { clave: 'sitio', valor: 'STP' },
    ]);
  });

  it('listarEspecies acepta orden y filtro de foto', async () => {
    const db = crearDb('prueba-' + Math.random());
    const a = await guardarEspecie(db, e('B b', { familia: 'Asteraceae' }));
    await guardarEspecie(db, e('A a', { familia: 'Poaceae' }));
    await agregarFoto(db, { especieId: a.id, blob: new Blob(['x']), miniatura: new Blob(['x']) });
    expect(nombres(await listarEspecies(db, {}, 'familia'))).toEqual(['B b', 'A a']);
    expect(nombres(await listarEspecies(db, { foto: 'con' }))).toEqual(['B b']);
    expect(nombres(await listarEspecies(db))).toEqual(['A a', 'B b']);
  });
});
```

Nota sobre el orden de `filtrosActivos`: sigue el orden de las claves de `FILTRO_VACIO` (ver más abajo:
`categoria` va antes que `sitio`).

- [ ] **Paso 2: ejecutar y verificar que fallan**

Correr: `npx vitest run tests/filtros.test.js`. Esperado: falla por el módulo inexistente.

- [ ] **Paso 3: implementar**

```js
// filtros.js
// Filtrado, conteo por valor y orden de la lista. Funciones puras: no tocan la base ni el DOM.
import { grupoDe, formasVida, esHidrofila } from './taxonomia.js';

const plano = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

export const FILTRO_VACIO = {
  texto: '', grupo: '', familia: '', habito: '', formaVida: '', colorFlor: '', petalos: '',
  categoria: '', origen: '', hidrofila: '', registroAI: '', sitio: '', aprendizaje: '', foto: '',
};

export const ORDENES = [['nombre', 'A–Z'], ['familia', 'Por familia'], ['listado', 'Como en la presentación'], ['aprendizaje', 'Me falta primero']];

const PRUEBAS = {
  texto: (e, v) => [e.nombre, e.familia, e.diagnostico].some(c => plano(c).includes(plano(v))),
  grupo: (e, v) => grupoDe(e) === v,
  familia: (e, v) => (e.familia ?? '') === v,
  habito: (e, v) => e.habito === v,
  formaVida: (e, v) => formasVida(e).includes(v),
  colorFlor: (e, v) => (e.colorFlor ?? []).includes(v),
  petalos: (e, v) => e.petalos === v,
  categoria: (e, v) => (v === 'alguna' ? Boolean(e.categoriaMMA) : e.categoriaMMA === v),
  origen: (e, v) => e.origen === v,
  hidrofila: (e, v) => (v === 'si' ? esHidrofila(e) : true),
  registroAI: (e, v) => (e.registroAI ?? '') === v,
  sitio: (e, v) => (e.sitios ?? []).includes(v),
  aprendizaje: (e, v) => (v === 'sin' ? e.aprendizaje == null : e.aprendizaje === v),
  foto: (e, v, ctx) => (v === 'con' ? ctx.conFoto.has(e.id) : !ctx.conFoto.has(e.id)),
};

export function cumple(e, filtro, ctx = { conFoto: new Set() }, excepto = null) {
  for (const [clave, prueba] of Object.entries(PRUEBAS)) {
    const v = filtro[clave];
    if (!v || clave === excepto) continue;
    if (!prueba(e, v, ctx)) return false;
  }
  return true;
}

export function filtrar(especies, filtro, ctx = { conFoto: new Set() }) {
  return especies.filter(e => cumple(e, filtro, ctx));
}

export function conteos(especies, filtro, clave, valores, ctx = { conFoto: new Set() }) {
  const base = especies.filter(e => cumple(e, filtro, ctx, clave));
  return new Map(valores.map(v => [v, base.filter(e => PRUEBAS[clave](e, v, ctx)).length]));
}

export function hayOrdenListado(especies, sitio) {
  return Boolean(sitio) && especies.some(e => e.ordenListado?.[sitio] != null);
}

const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
const RANGO_APRENDIZAJE = { no: 0, falta: 1, sin: 2, se: 3 };

export function ordenar(especies, orden = 'nombre', sitio = '') {
  const lista = [...especies];
  if (orden === 'familia') {
    return lista.sort((a, b) => Number(!a.familia) - Number(!b.familia)
      || (a.familia ?? '').localeCompare(b.familia ?? '', 'es') || porNombre(a, b));
  }
  if (orden === 'listado' && hayOrdenListado(especies, sitio)) {
    const pos = e => e.ordenListado?.[sitio] ?? Number.MAX_SAFE_INTEGER;
    return lista.sort((a, b) => pos(a) - pos(b) || porNombre(a, b));
  }
  if (orden === 'aprendizaje') {
    const rango = e => RANGO_APRENDIZAJE[e.aprendizaje ?? 'sin'];
    return lista.sort((a, b) => rango(a) - rango(b) || porNombre(a, b));
  }
  return lista.sort(porNombre);
}

export function filtrosActivos(filtro) {
  return Object.keys(FILTRO_VACIO).filter(c => c !== 'texto' && filtro[c]).map(clave => ({ clave, valor: filtro[clave] }));
}
```

En `db.js`, reemplazar `listarEspecies`:

```js
import { filtrar, ordenar } from './filtros.js';
// ...
export async function listarEspecies(db, filtro = {}, orden = 'nombre') {
  const todas = await db.especies.toArray();
  const conFoto = filtro.foto ? await especiesConFoto(db) : new Set();
  return ordenar(filtrar(todas, filtro, { conFoto }), orden, filtro.sitio);
}
```

Con esto `normalizar` deja de usarse en `listarEspecies`, pero sigue en uso en otras funciones: no borrarlo. La prueba
existente de `listarEspecies` en `tests/db.test.js` debe seguir pasando sin cambios.

- [ ] **Paso 4: ejecutar y verificar que pasan**

Correr: `npx vitest run`. Esperado: todo pasa.

- [ ] **Paso 5: commit**

```bash
git add filtros.js db.js tests/filtros.test.js
git commit -m "Filtros de terreno, conteos por valor y orden de la lista"
```

---

### Tarea 5: `agregarListado` completa especies existentes, y el listado entra en la app

**Archivos:**
- Modificar: `db.js` (`agregarListado`), `app.js` (`LISTADOS`)
- Probar: `tests/db.test.js` (agregar un bloque `describe('agregarListado con existentes')`)

**Interfaces:**
- Consume: el formato del zip de la Tarea 2.
- Produce: `agregarListado(db, JSZip, datos, sitio) -> { nuevas, conSitio, fotos }`, misma firma; `fotos` cuenta todas las agregadas.

- [ ] **Paso 1: escribir las pruebas que fallan**

Revisar primero cómo arma los zips de prueba el `describe` actual de `agregarListado` en `tests/db.test.js` y reutilizar
ese helper. Si no existe uno reutilizable, agregar este al archivo:

```js
async function zipListado(especies, fotos = []) {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify({ formato: 1, generado: 'x', especies: especies.length, fotos: fotos.length }));
  zip.file('especies.json', JSON.stringify(especies));
  zip.file('fotos.json', JSON.stringify(fotos));
  for (const f of fotos) {
    zip.file(`fotos/${f.id}.webp`, new Uint8Array([1, 2, 3]));
    zip.file(`miniaturas/${f.id}.webp`, new Uint8Array([4]));
  }
  return zip.generateAsync({ type: 'uint8array' });
}

const fotoMeta = (id, especieId, orden) => ({ id, especieId, orden, ancho: 1, alto: 1, tipo: 'image/webp', fuente: 'presentacion', autor: 'A', licencia: '', url: '', creadoEn: 'x' });

describe('agregarListado con existentes', () => {
  it('suma fotos al final y completa solo campos vacíos, sin tocar avance ni notas', async () => {
    const existente = await guardarEspecie(db, nuevaEspecie({
      nombre: 'Acaena magellanica', familia: 'Rosaceae', categoriaMMA: '', notas: 'mía', aprendizaje: 'se', sitios: ['STP'],
    }));
    await agregarFoto(db, { especieId: existente.id, blob: new Blob(['a']), miniatura: new Blob(['a']) });
    const delPaquete = nuevaEspecie({
      id: 'otro-id', nombre: 'acaena magellanica', familia: 'Otra', categoriaMMA: 'Preocupación Menor', decreto: 'D.S. N° 1/2000',
      diagnostico: 'Espinas ganchudas', registroAI: 'si', hidrofila: true, ordenListado: { 'Chacao Chonchi': 7 }, notas: 'del pdf',
      sitios: ['Chacao Chonchi'],
    });
    const datos = await zipListado([delPaquete], [fotoMeta('f1', 'otro-id', 0), fotoMeta('f2', 'otro-id', 1)]);
    const r = await agregarListado(db, JSZip, datos, 'Chacao Chonchi');
    expect(r).toEqual({ nuevas: 0, conSitio: 1, fotos: 2 });
    const e = await obtenerEspecie(db, existente.id);
    expect(e.sitios).toEqual(['STP', 'Chacao Chonchi']);
    expect(e.familia).toBe('Rosaceae');
    expect(e.categoriaMMA).toBe('Preocupación Menor');
    expect(e.decreto).toBe('D.S. N° 1/2000');
    expect(e.diagnostico).toBe('Espinas ganchudas');
    expect(e).toMatchObject({ registroAI: 'si', hidrofila: true, ordenListado: { 'Chacao Chonchi': 7 }, notas: 'mía', aprendizaje: 'se' });
    const fotos = await fotosDe(db, existente.id);
    expect(fotos.map(f => [f.id, f.orden])).toEqual([[fotos[0].id, 0], ['f1', 1], ['f2', 2]]);
    expect(await db.especies.get('otro-id')).toBeUndefined();

    const r2 = await agregarListado(db, JSZip, datos, 'Chacao Chonchi');
    expect(r2).toEqual({ nuevas: 0, conSitio: 0, fotos: 0 });
    expect(await fotosDe(db, existente.id)).toHaveLength(3);
  });

  it('las nuevas entran con sus fotos', async () => {
    const nueva = nuevaEspecie({ nombre: 'Luma chequen', sitios: ['Chacao Chonchi'], ordenListado: { 'Chacao Chonchi': 1 } });
    const r = await agregarListado(db, JSZip, await zipListado([nueva], [fotoMeta('g1', nueva.id, 0)]), 'Chacao Chonchi');
    expect(r).toEqual({ nuevas: 1, conSitio: 0, fotos: 1 });
    expect((await obtenerEspecie(db, nueva.id)).ordenListado).toEqual({ 'Chacao Chonchi': 1 });
  });
});
```

Ajustar los imports de la prueba si hace falta (`fotosDe`, `agregarFoto` y `obtenerEspecie` ya están importados).

- [ ] **Paso 2: ejecutar y verificar que fallan**

Correr: `npx vitest run tests/db.test.js`. Esperado: la primera prueba nueva falla (no se agregan fotos ni campos a la existente).

- [ ] **Paso 3: implementar**

Reemplazar `agregarListado` en `db.js`:

```js
const CAMPOS_SI_VACIOS = ['familia', 'habito', 'habitoDetalle', 'categoriaMMA', 'decreto', 'diagnostico'];

// Completa una especie existente con lo que trae el listado, sin tocar avance, notas ni lo que ya tiene.
function completarExistente(existente, delPaquete, sitio) {
  const e = { ...existente, sitios: existente.sitios.includes(sitio) ? existente.sitios : [...existente.sitios, sitio] };
  for (const c of CAMPOS_SI_VACIOS) if (!e[c] && delPaquete[c]) e[c] = delPaquete[c];
  if (delPaquete.registroAI) e.registroAI = delPaquete.registroAI;
  e.hidrofila = Boolean(existente.hidrofila || delPaquete.hidrofila);
  e.ordenListado = { ...(existente.ordenListado ?? {}), ...(delPaquete.ordenListado ?? {}) };
  return e;
}

const cambio = (a, b) => JSON.stringify(a) !== JSON.stringify(b);

// Aplica un paquete de listado de sitio sin reemplazar nada. Las especies que ya están en el teléfono (mismo id, o mismo
// nombre sin distinguir tildes ni mayúsculas, como las creadas a mano) reciben el sitio, las fotos del paquete al final y
// los datos que les falten. Las demás se agregan con sus fotos. Avance, notas, ediciones y fotos propias quedan intactos,
// y aplicarlo dos veces no cambia nada.
export async function agregarListado(db, JSZip, datos, sitio) {
  await leerManifest(JSZip, datos);
  const zip = await JSZip.loadAsync(datos);
  const especies = JSON.parse(await zip.file('especies.json').async('string'));
  const fotosMeta = JSON.parse(await zip.file('fotos.json').async('string'));
  const actuales = await db.especies.toArray();
  const porId = new Map(actuales.map(e => [e.id, e]));
  const porNombre = new Map(actuales.map(e => [normalizar(e.nombre), e]));
  const nuevas = [];
  const actualizadas = [];
  const destino = new Map(); // id en el paquete -> id en el teléfono
  for (const e of especies) {
    const existente = porId.get(e.id) ?? porNombre.get(normalizar(e.nombre));
    if (!existente) {
      nuevas.push(e);
      porNombre.set(normalizar(e.nombre), e);
      destino.set(e.id, e.id);
      continue;
    }
    destino.set(e.id, existente.id);
    const completada = completarExistente(existente, e, sitio);
    if (cambio(completada, existente)) actualizadas.push(completada);
  }
  const idsFotos = new Set(await db.fotos.toCollection().primaryKeys());
  const siguienteOrden = new Map();
  const fotos = [];
  for (const m of fotosMeta) {
    const especieId = destino.get(m.especieId);
    if (!especieId || idsFotos.has(m.id)) continue;
    if (!siguienteOrden.has(especieId)) siguienteOrden.set(especieId, await db.fotos.where('especieId').equals(especieId).count());
    const orden = siguienteOrden.get(especieId);
    siguienteOrden.set(especieId, orden + 1);
    const tipo = m.tipo || 'image/webp';
    const blob = new Blob([await zip.file(`fotos/${m.id}.webp`).async('arraybuffer')], { type: tipo });
    const miniatura = new Blob([await zip.file(`miniaturas/${m.id}.webp`).async('arraybuffer')], { type: tipo });
    fotos.push({ ...m, especieId, orden, tipo, blob, miniatura });
  }
  await db.transaction('rw', db.especies, db.fotos, async () => {
    await db.especies.bulkAdd(nuevas);
    await db.especies.bulkPut(actualizadas);
    await db.fotos.bulkAdd(fotos);
  });
  const conSitio = actualizadas.filter(e => !porId.get(e.id)?.sitios.includes(sitio)).length;
  return { nuevas: nuevas.length, conSitio, fotos: fotos.length };
}
```

Cuidado: `conSitio` cuenta las existentes que **no tenían** el sitio. Las pruebas actuales de `agregarListado` (Nevado)
deben seguir pasando. Si alguna esperaba `fotos` solo de nuevas y el paquete de prueba trae fotos de existentes,
revisar caso a caso y anotar el cambio en el commit.

En `app.js`:

```js
const LISTADOS = [
  { sitio: 'Nevado Tres Cruces', ruta: 'semilla/nevado-tres-cruces.zip' },
  { sitio: 'Chacao Chonchi', ruta: 'semilla/chacao-chonchi.zip' },
];
```

y el aviso de `aplicarListados` pasa a: ``aviso(`Listado ${sitio} agregado: ${r.nuevas} especies nuevas, ${r.conSitio} ya existentes completadas y ${r.fotos} fotos`, 5000);``

- [ ] **Paso 4: ejecutar y verificar que pasan**

Correr: `npx vitest run`. Esperado: todo pasa.

- [ ] **Paso 5: commit**

```bash
git add db.js app.js tests/db.test.js
git commit -m "Listados de sitio: completar especies existentes con fotos y datos; agregar Chacao Chonchi"
```

---

### Tarea 6: Memoria de la lista

**Archivos:**
- Crear: `ui/memoria.js`
- Probar: `tests/memoria.test.js`

**Interfaces:**
- Consume: `FILTRO_VACIO` de `filtros.js`.
- Produce:
  - `crearMemoria(obtenerAlmacen: () => Storage) -> { estado(): Memoria, actualizar(cambios: Partial<Memoria>): Memoria, limpiarFiltros(): Memoria }`
  - `Memoria = { filtro, orden, ancla: { id, desfase } | null, ultimaId: string | null }`
  - `memoria`: la instancia por defecto, sobre `globalThis.localStorage`
  - `CLAVE_MEMORIA = 'flora.lista'`

- [ ] **Paso 1: escribir las pruebas que fallan**

```js
// tests/memoria.test.js
import { describe, it, expect } from 'vitest';
import { crearMemoria, CLAVE_MEMORIA } from '../ui/memoria.js';
import { FILTRO_VACIO } from '../filtros.js';

function almacenFalso(inicial = {}) {
  const datos = { ...inicial };
  return { getItem: k => datos[k] ?? null, setItem: (k, v) => { datos[k] = String(v); }, datos };
}

describe('memoria de la lista', () => {
  it('parte vacía y persiste los cambios', () => {
    const almacen = almacenFalso();
    const m = crearMemoria(() => almacen);
    expect(m.estado()).toEqual({ filtro: FILTRO_VACIO, orden: 'nombre', ancla: null, ultimaId: null });
    m.actualizar({ filtro: { ...FILTRO_VACIO, sitio: 'STP' }, ancla: { id: 'x', desfase: 40 } });
    const otra = crearMemoria(() => almacen);
    expect(otra.estado().filtro.sitio).toBe('STP');
    expect(otra.estado().ancla).toEqual({ id: 'x', desfase: 40 });
  });

  it('completa filtros guardados con claves nuevas y tolera basura', () => {
    const m = crearMemoria(() => almacenFalso({ [CLAVE_MEMORIA]: JSON.stringify({ filtro: { sitio: 'STP' } }) }));
    expect(m.estado().filtro).toEqual({ ...FILTRO_VACIO, sitio: 'STP' });
    const roto = crearMemoria(() => almacenFalso({ [CLAVE_MEMORIA]: '{no es json' }));
    expect(roto.estado().orden).toBe('nombre');
  });

  it('funciona aunque el almacenamiento falle', () => {
    const m = crearMemoria(() => { throw new Error('bloqueado'); });
    expect(m.actualizar({ orden: 'familia' }).orden).toBe('familia');
    expect(m.estado().orden).toBe('familia');
  });

  it('limpiarFiltros conserva el orden y borra el ancla', () => {
    const m = crearMemoria(() => almacenFalso());
    m.actualizar({ filtro: { ...FILTRO_VACIO, sitio: 'STP' }, orden: 'familia', ancla: { id: 'a', desfase: 0 } });
    expect(m.limpiarFiltros()).toMatchObject({ filtro: FILTRO_VACIO, orden: 'familia', ancla: null });
  });
});
```

- [ ] **Paso 2: ejecutar y verificar que fallan**

Correr: `npx vitest run tests/memoria.test.js`. Esperado: falla por el módulo inexistente.

- [ ] **Paso 3: implementar**

```js
// ui/memoria.js
// Estado de la lista que sobrevive a cambiar de pantalla y a cerrar la aplicación: filtros, orden y la especie que estaba
// a la vista. Vive en localStorage; si el navegador lo bloquea, funciona igual pero sin recordar entre aperturas.
import { FILTRO_VACIO } from '../filtros.js';

export const CLAVE_MEMORIA = 'flora.lista';

function normalizar(d) {
  return {
    filtro: { ...FILTRO_VACIO, ...(d?.filtro ?? {}) },
    orden: d?.orden ?? 'nombre',
    ancla: d?.ancla ?? null,
    ultimaId: d?.ultimaId ?? null,
  };
}

export function crearMemoria(obtenerAlmacen) {
  let actual = null;
  function leer() {
    try {
      return normalizar(JSON.parse(obtenerAlmacen().getItem(CLAVE_MEMORIA) ?? 'null'));
    } catch {
      return normalizar(null);
    }
  }
  function escribir() {
    try { obtenerAlmacen().setItem(CLAVE_MEMORIA, JSON.stringify(actual)); } catch { /* sin memoria persistente */ }
  }
  return {
    estado() {
      actual ??= leer();
      return actual;
    },
    actualizar(cambios) {
      actual = { ...this.estado(), ...cambios };
      escribir();
      return actual;
    },
    limpiarFiltros() {
      return this.actualizar({ filtro: { ...FILTRO_VACIO }, ancla: null });
    },
  };
}

export const memoria = crearMemoria(() => globalThis.localStorage);
```

- [ ] **Paso 4: ejecutar y verificar que pasan**

Correr: `npx vitest run`. Esperado: todo pasa.

- [ ] **Paso 5: commit**

```bash
git add ui/memoria.js tests/memoria.test.js
git commit -m "Memoria persistente de la lista: filtros, orden y posición"
```

---

### Tarea 7: Lista con hoja de filtros, chips, orden, insignias y restauración

**Archivos:**
- Modificar: `ui/lista.js` (reescritura), `styles.css`, `app.js` (`enrutar`)
- Sin pruebas unitarias: el entorno de vitest es node, sin DOM. Se verifica en el navegador (paso 4).

**Interfaces:**
- Consume: `memoria` (Tarea 6); `FILTRO_VACIO`, `ORDENES`, `filtrar`, `ordenar`, `conteos`, `hayOrdenListado` y `filtrosActivos` (Tarea 4);
  `GRUPOS`, `FORMAS_VIDA`, `siglaCategoria`, `nivelCategoria` y `esHidrofila` (Tarea 3); de `db.js`: `miniaturasPrimeras`,
  `especiesConFoto`, `valoresPetalos` y las constantes.
- Produce: `ctx.desdeLista: boolean` y `ctx.reemplazando: boolean`, que maneja `enrutar` en `app.js` y lee la ficha (Tarea 8).
  Cada `li` de especie lleva `data-id`.

- [ ] **Paso 1: `app.js`, enrutar**

En `app.js`, agregar `desdeLista: false, reemplazando: false` a `ctx`; agregar `history.scrollRestoration = 'manual';` al
inicio de `iniciar()`; y en `enrutar()`:

```js
let rutaActual = '';

async function enrutar() {
  document.querySelectorAll('.capa, dialog.hoja').forEach(c => c.remove());
  const hash = location.hash || '#/lista';
  // La ficha sabe si se llegó desde la lista para que "Volver" use history.back(). Un location.replace
  // (anterior/siguiente en la ficha) conserva el origen.
  if (!ctx.reemplazando) ctx.desdeLista = rutaActual.startsWith('#/lista');
  ctx.reemplazando = false;
  rutaActual = hash;
  // ... resto igual (window.scrollTo(0, 0) se mantiene; la lista restaura su posición después de pintar)
}
```

- [ ] **Paso 2: reescribir `ui/lista.js`**

```js
import {
  miniaturasPrimeras, especiesConFoto, valoresPetalos, SITIOS, ORIGENES, HABITOS, APRENDIZAJES, COLORES_FLOR, CATEGORIAS,
} from '../db.js';
import { FILTRO_VACIO, ORDENES, filtrar, ordenar, conteos, hayOrdenListado, filtrosActivos } from '../filtros.js';
import { GRUPOS, FORMAS_VIDA, siglaCategoria, nivelCategoria, esHidrofila } from '../taxonomia.js';
import { el, urlDe, estiloColor, tinteFondo } from './dom.js';
import { memoria } from './memoria.js';

const SITIO_AI = 'Chacao Chonchi';
const TITULOS = {
  grupo: 'Grupo', familia: 'Familia', habito: 'Hábito', formaVida: 'Forma de vida', colorFlor: 'Color de flor',
  petalos: 'Pétalos', categoria: 'Conservación', origen: 'Origen', hidrofila: 'Hidrófila o de humedal',
  registroAI: 'Registrada antes en el AI', sitio: 'Sitio', aprendizaje: 'Aprendizaje', foto: 'Fotos',
};
const SECCIONES = [
  ['Identificación', ['grupo', 'familia', 'habito', 'formaVida', 'colorFlor', 'petalos']],
  ['Evaluación ambiental', ['categoria', 'origen', 'hidrofila', 'registroAI']],
  ['Estudio', ['sitio', 'aprendizaje', 'foto']],
];

function etiquetaPetalos(v) {
  if (v === '0') return 'Sin pétalos (0)';
  if (v === '1') return '1 pétalo';
  if (v === 'variable') return 'Número variable';
  return `${v} pétalos`;
}

const pares = l => l.map(o => (Array.isArray(o) ? o : [o, o]));

export async function render(cont, ctx) {
  const { db } = ctx;
  const [todas, minis, conFoto, petalos] = await Promise.all([
    db.especies.toArray(), miniaturasPrimeras(db), especiesConFoto(db), valoresPetalos(db),
  ]);
  const ctxFiltro = { conFoto };
  const familias = [...new Set(todas.map(e => e.familia).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const OPCIONES = {
    grupo: pares(GRUPOS), familia: pares(familias), habito: pares(HABITOS), formaVida: pares(FORMAS_VIDA),
    colorFlor: COLORES_FLOR, petalos: petalos.map(v => [v, etiquetaPetalos(v)]),
    categoria: [['alguna', 'En alguna categoría'], ...pares(CATEGORIAS)], origen: pares(ORIGENES),
    hidrofila: [['si', 'Sí']], registroAI: [['si', 'Sí'], ['no', 'No'], ['duda', 'Por confirmar']],
    sitio: pares(SITIOS), aprendizaje: APRENDIZAJES, foto: [['con', 'Con foto'], ['sin', 'Sin foto']],
  };
  const etiqueta = (clave, valor) => (OPCIONES[clave].find(([v]) => v === valor) ?? [valor, valor])[1];
  const visible = clave => clave !== 'registroAI' || memoria.estado().filtro.sitio === SITIO_AI;

  const contador = el('p', { class: 'contador', 'aria-live': 'polite' });
  const chips = el('div', { class: 'chips' });
  const botonFiltros = el('button', { type: 'button', class: 'btn chico boton-filtros', onclick: () => abrirHoja() });
  const selectorOrden = el('select', { 'aria-label': 'Orden', onchange: ev => cambiar({ orden: ev.target.value }) });
  const ul = el('ul', { class: 'lista' });
  let visibles = [];

  function cambiar({ filtro, orden }) {
    const actual = memoria.estado();
    const nuevoFiltro = { ...actual.filtro, ...(filtro ?? {}) };
    if (nuevoFiltro.sitio !== SITIO_AI) nuevoFiltro.registroAI = '';
    memoria.actualizar({ filtro: nuevoFiltro, orden: orden ?? actual.orden, ancla: null });
    pintar();
    window.scrollTo(0, 0);
  }

  function pintarControles() {
    const { filtro, orden } = memoria.estado();
    const activos = filtrosActivos(filtro);
    botonFiltros.textContent = activos.length ? `Filtros (${activos.length})` : 'Filtros';
    const ordenes = ORDENES.filter(([v]) => v !== 'listado' || hayOrdenListado(todas, filtro.sitio));
    selectorOrden.replaceChildren(...ordenes.map(([v, t]) => el('option', { value: v, selected: v === orden }, t)));
    chips.replaceChildren(
      ...activos.map(({ clave, valor }) => el('button', {
        type: 'button', class: 'chip', 'aria-label': `Quitar ${TITULOS[clave]}`,
        onclick: () => cambiar({ filtro: { [clave]: '' } }),
      }, `${TITULOS[clave]}: ${etiqueta(clave, valor)} ×`)),
      activos.length ? el('button', { type: 'button', class: 'chip limpiar', onclick: () => {
        const texto = memoria.estado().filtro.texto;
        memoria.limpiarFiltros();
        cambiar({ filtro: { texto } });
      } }, 'Limpiar todo') : null);
  }

  function fila(e) {
    const banda = estiloColor(e.colorFlor);
    const tinte = tinteFondo(e.colorFlor);
    const sigla = siglaCategoria(e.categoriaMMA);
    const insignias = [
      sigla ? el('span', { class: `insignia cat-${nivelCategoria(e.categoriaMMA)}`, title: e.categoriaMMA }, sigla) : null,
      esHidrofila(e) ? el('span', { class: 'insignia hidrofila', title: 'Hidrófila o de humedal' }, 'Hidrófila') : null,
      e.registroAI === 'si' ? el('span', { class: 'insignia ai', title: 'Registrada antes en el AI' }, 'AI') : null,
      e.registroAI === 'duda' ? el('span', { class: 'insignia ai duda', title: 'Registro en el AI por confirmar' }, 'AI?') : null,
    ].filter(Boolean);
    return el('li', { 'data-id': e.id },
      el('a', {
        href: `#/ficha/${e.id}`, style: tinte ? `background: ${tinte}` : null,
        onclick: ev => memoria.actualizar({ ancla: { id: e.id, desfase: ev.currentTarget.getBoundingClientRect().top }, ultimaId: e.id }),
      },
      banda ? el('span', { class: 'banda', style: `background: ${banda}`, 'aria-hidden': 'true' }) : null,
      minis.has(e.id)
        ? el('img', { src: urlDe(`mini-${e.id}`, minis.get(e.id)), alt: '', loading: 'lazy', width: 64, height: 64 })
        : el('div', { class: 'sin-foto' }, 'Sin foto'),
      el('div', { class: 'texto' }, el('i', {}, e.nombre),
        el('small', {}, e.familia || ''),
        insignias.length ? el('span', { class: 'insignias' }, ...insignias) : null),
      el('span', { class: `punto ${e.aprendizaje ?? 'sin'}` })));
  }

  function pintar() {
    const { filtro, orden } = memoria.estado();
    visibles = ordenar(filtrar(todas, filtro, ctxFiltro), orden, filtro.sitio);
    contador.textContent = `${visibles.length} especies`;
    const items = [];
    let familiaActual = null;
    for (const e of visibles) {
      if (orden === 'familia' && (e.familia || 'Sin familia') !== familiaActual) {
        familiaActual = e.familia || 'Sin familia';
        const n = visibles.filter(x => (x.familia || 'Sin familia') === familiaActual).length;
        items.push(el('li', { class: 'grupo-familia' }, familiaActual, el('small', {}, ` ${n}`)));
      }
      items.push(fila(e));
    }
    ul.replaceChildren(...items);
    pintarControles();
  }

  function abrirHoja() {
    const dialogo = el('dialog', { class: 'hoja', 'aria-label': 'Filtros' });
    let porAtras = false;
    function pintarHoja() {
      const { filtro } = memoria.estado();
      const total = filtrar(todas, filtro, ctxFiltro).length;
      dialogo.replaceChildren(
        el('div', { class: 'hoja-cabecera' }, el('h2', {}, 'Filtros'),
          el('button', { type: 'button', class: 'btn chico', onclick: () => { const texto = memoria.estado().filtro.texto; memoria.limpiarFiltros(); cambiar({ filtro: { texto } }); pintarHoja(); } }, 'Limpiar todo')),
        ...SECCIONES.map(([titulo, claves]) => el('section', { class: 'hoja-seccion' }, el('h3', {}, titulo),
          ...claves.filter(visible).map(clave => {
            const ops = OPCIONES[clave];
            const n = conteos(todas, filtro, clave, ops.map(([v]) => v), ctxFiltro);
            return el('label', {}, TITULOS[clave], el('select', {
              onchange: ev => { cambiar({ filtro: { [clave]: ev.target.value } }); pintarHoja(); },
            }, el('option', { value: '' }, 'Todas'),
            ...ops.map(([v, t]) => el('option', {
              value: v, selected: filtro[clave] === v, disabled: n.get(v) === 0 && filtro[clave] !== v,
            }, `${t} (${n.get(v)})`))));
          }))),
        el('div', { class: 'hoja-pie' },
          el('button', { type: 'button', class: 'btn primario', onclick: () => dialogo.close() }, `Ver ${total} especies`)));
    }
    const alVolver = () => { porAtras = true; if (dialogo.open) dialogo.close(); };
    dialogo.addEventListener('close', () => {
      window.removeEventListener('popstate', alVolver);
      dialogo.remove();
      if (!porAtras) history.back();
    });
    pintarHoja();
    document.body.append(dialogo);
    history.pushState({ hoja: true }, '');
    window.addEventListener('popstate', alVolver);
    dialogo.showModal();
  }

  const buscador = el('input', {
    type: 'search', placeholder: 'Buscar nombre, familia o rasgo', value: memoria.estado().filtro.texto,
    oninput: ev => cambiar({ filtro: { texto: ev.target.value } }),
  });
  cont.append(
    el('header', { class: 'cabecera' }, buscador,
      el('div', { class: 'barra-filtros' }, botonFiltros, selectorOrden), chips, contador),
    ul,
    el('a', { class: 'flotante', href: '#/editar/', 'aria-label': 'Nueva especie' }, '+'));
  pintar();
  restaurar();
  vigilarScroll();

  function restaurar() {
    const { ancla, ultimaId } = memoria.estado();
    const buscar = id => ul.querySelector(`li[data-id="${CSS.escape(id)}"]`);
    if (ancla) {
      const f = buscar(ancla.id);
      if (f) window.scrollTo(0, window.scrollY + f.getBoundingClientRect().top - ancla.desfase);
    }
    if (ultimaId) {
      const f = buscar(ultimaId);
      if (f) {
        f.classList.add('reciente');
        setTimeout(() => f.classList.remove('reciente'), 1500);
      }
    }
  }

  function vigilarScroll() {
    let pendiente = null;
    const guardar = () => {
      pendiente = null;
      if (!ul.isConnected) return;
      const filaVisible = [...ul.querySelectorAll('li[data-id]')].find(li => li.getBoundingClientRect().bottom > 0);
      if (filaVisible) memoria.actualizar({ ancla: { id: filaVisible.dataset.id, desfase: filaVisible.getBoundingClientRect().top } });
    };
    const alScroll = () => {
      if (!ul.isConnected) { window.removeEventListener('scroll', alScroll); window.removeEventListener('pagehide', guardar); return; }
      if (!pendiente) pendiente = setTimeout(guardar, 200);
    };
    window.addEventListener('scroll', alScroll, { passive: true });
    window.addEventListener('pagehide', guardar);
  }
}
```

Notas:
- `querySelectorAll` sobre ~750 filas cada 200 ms es aceptable. Si se nota lento en el teléfono, cambiar por una búsqueda
  binaria sobre `offsetTop`.
- El buscador conserva la posición al escribir porque `cambiar` no reconstruye la cabecera.
- `memoria.limpiarFiltros()` seguido de `cambiar({ filtro: { texto } })` mantiene el texto del buscador.

- [ ] **Paso 3: estilos**

Agregar a `styles.css`:

```css
.barra-filtros { display: grid; grid-template-columns: auto 1fr; gap: 8px; margin-top: 8px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.chips:empty { display: none; }
.chip { min-height: 36px; padding: 4px 12px; border-radius: 18px; border: 1px solid var(--verde); background: #e7f0e4; color: var(--verde); font: inherit; font-size: .9rem; cursor: pointer; }
.chip.limpiar { background: transparent; border-style: dashed; }
.lista li.grupo-familia { position: sticky; top: 0; z-index: 2; background: var(--fondo); padding: 8px 4px 4px; font-weight: 700; color: var(--verde); border-bottom: 2px solid var(--verde); }
.lista li.grupo-familia small { color: var(--texto-suave); font-weight: 400; }
.lista li.reciente > a { animation: reciente 1.5s ease-out; }
@keyframes reciente { from { background: #fff1b8; } to { background: transparent; } }
.insignias { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.insignia { font-size: .75rem; font-weight: 700; padding: 1px 6px; border-radius: 6px; border: 1px solid var(--borde); color: var(--texto-suave); line-height: 1.4; }
.insignia.cat-amenazada { background: #fde8e6; border-color: var(--rojo); color: var(--rojo); }
.insignia.cat-casi { background: #fff4e0; border-color: var(--ambar); color: #7a4a00; }
.insignia.hidrofila { background: #e4f1fb; border-color: #4a90e2; color: #1f5f9e; }
.insignia.ai { background: #e7f0e4; border-color: var(--verde); color: var(--verde); }
.insignia.ai.duda { background: transparent; border-style: dashed; }
dialog.hoja { width: 100%; max-width: 720px; max-height: 88vh; margin: auto auto 0; padding: 0; border: none; border-radius: 16px 16px 0 0; background: var(--fondo); color: var(--texto); overflow-y: auto; }
dialog.hoja::backdrop { background: rgba(0,0,0,.45); }
.hoja-cabecera { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 0; }
.hoja-cabecera h2 { margin: 0; }
.hoja-seccion { padding: 0 16px; }
.hoja-seccion h3 { font-size: 1rem; margin: 16px 0 0; color: var(--verde); }
.hoja-pie { position: sticky; bottom: 0; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: var(--fondo); border-top: 1px solid var(--borde); }
.hoja-pie .btn { width: 100%; }
```

Reemplazar la regla `.filtros` de `styles.css` solo si ya no la usa nadie (comprobar con `grep -rn "filtros" ui/`; Estudio
podría usar `formulario-sesion`).

- [ ] **Paso 4: verificar en el navegador**

`npm run servir` (en Windows, si `python3` no existe: `.venv/Scripts/python -m http.server 8080`) y abrir
`http://localhost:8080/` a 390 px de ancho. Comprobar:
1. La lista carga; "Filtros" abre la hoja; elegir Sitio = Chacao Chonchi muestra "Registrada antes en el AI" y los conteos cambian.
2. Las opciones en 0 quedan deshabilitadas. "Ver N especies" cierra la hoja. El botón atrás del navegador cierra la hoja sin salir de la lista.
3. Los chips aparecen y la × quita el filtro. "Limpiar todo" funciona.
4. El orden "Como en la presentación" solo aparece con el sitio Chacao. "Por familia" muestra encabezados fijos.
5. Bajar hasta la mitad, abrir una ficha y volver con atrás: la lista queda en la misma especie, resaltada. Recargar la página: igual.

Para los datos de Chacao en el navegador local hace falta el zip de la Tarea 2 y la Tarea 5; la app lo aplica al abrir.

- [ ] **Paso 5: commit**

```bash
git add ui/lista.js styles.css app.js
git commit -m "Lista: hoja de filtros con conteos, chips, orden, insignias y memoria de posición"
```

---

### Tarea 8: Ficha (recorrido, diagnóstico, campos nuevos), Editar y Estudio

**Archivos:**
- Modificar: `ui/ficha.js`, `ui/editar.js`, `ui/estudio.js`, `styles.css`

**Interfaces:**
- Consume: `memoria` (`estado()` y `actualizar`); `filtrar` y `ordenar`; `grupoDe`, `formasVida` y `esHidrofila`;
  `ctx.desdeLista` y `ctx.reemplazando` (Tarea 7); `especiesConFoto` de `db.js`.

- [ ] **Paso 1: `ui/ficha.js`**

Cambios:

```js
import { obtenerEspecie, fotosDe, especiesConFoto, COLORES_FLOR } from '../db.js';
import { filtrar, ordenar } from '../filtros.js';
import { grupoDe, formasVida, esHidrofila } from '../taxonomia.js';
import { memoria } from './memoria.js';
// ...
const CAMPOS = [
  ['nivel', 'Nivel'], ['grupo', 'Grupo'], ['origen', 'Origen'], ['habito', 'Hábito'], ['habitoDetalle', 'Hábito detallado'],
  ['formasVida', 'Forma de vida'], ['ciclo', 'Ciclo de vida'], ['categoriaMMA', 'Categoría de conservación (MMA)'],
  ['decreto', 'Decreto'], ['ds68', 'D.S. 68/2009'], ['hidrofila', 'Hidrófila o de humedal'], ['registroAI', 'Registrada antes en el AI'],
  ['distribucion', 'Distribución'], ['rangoAltitudinal', 'Rango altitudinal'],
  ['colorFlor', 'Color de flor'], ['petalos', 'Pétalos'], ['petalosNota', 'Pétalos según clave'],
  ['sitios', 'Sitios'], ['aprendizaje', 'Aprendizaje'], ['aciertos', 'Aciertos en estudio'], ['fallos', 'Fallos en estudio'],
];
const REGISTRO_AI = { si: 'Sí', no: 'No', duda: 'Por confirmar' };
const ATRIBUCION_PRESENTACION = 'Presentación Chacao Chonchi';
```

En `valorTexto`, agregar antes del `if (Array.isArray(v))`:

```js
  if (clave === 'hidrofila') return v ? 'Sí' : '';
  if (clave === 'registroAI') return REGISTRO_AI[v] ?? '';
```

En `render`, construir una vista derivada para los campos calculados y usarla en el `flatMap` (`vista[clave]` en lugar de `e[clave]`):

```js
  const vista = { ...e, grupo: grupoDe(e), formasVida: formasVida(e), hidrofila: esHidrofila(e) };
```

En `abrirFoto`:

```js
    f.fuente === 'inaturalist' ? el('p', { class: 'atribucion' }, `${f.autor} · ${f.licencia} · iNaturalist`) : null,
    f.fuente === 'presentacion' ? el('p', { class: 'atribucion' }, `${f.autor} · ${ATRIBUCION_PRESENTACION}`) : null);
```

Barra de recorrido, calculada con la memoria:

```js
async function barraRecorrido(db, id) {
  const { filtro, orden } = memoria.estado();
  const todas = await db.especies.toArray();
  const conFoto = filtro.foto ? await especiesConFoto(db) : new Set();
  const ids = ordenar(filtrar(todas, filtro, { conFoto }), orden, filtro.sitio).map(x => x.id);
  const i = ids.indexOf(id);
  if (i < 0) return null;
  const ir = destino => () => {
    const { ancla } = memoria.estado();
    memoria.actualizar({ ancla: { id: destino, desfase: ancla?.desfase ?? 120 }, ultimaId: destino });
    ctxGlobal.reemplazando = true;
    location.replace(`#/ficha/${destino}`);
  };
  return el('nav', { class: 'recorrido', 'aria-label': 'Recorrer la lista' },
    el('button', { type: 'button', class: 'btn chico', disabled: i === 0, onclick: i > 0 ? ir(ids[i - 1]) : null }, '‹ Anterior'),
    el('span', {}, `${i + 1} de ${ids.length}`),
    el('button', { type: 'button', class: 'btn chico', disabled: i === ids.length - 1, onclick: i < ids.length - 1 ? ir(ids[i + 1]) : null }, 'Siguiente ›'));
}
```

`ctxGlobal` no existe: pasar `ctx` como parámetro (`barraRecorrido(ctx, id)`, con `ctx.db` dentro) y usar
`ctx.reemplazando = true`. En `render`, `const recorrido = await barraRecorrido(ctx, id);` y agregar `recorrido` como
primer elemento del `cont.append(...)`.

Diagnóstico, después de la galería:

```js
    e.diagnostico ? el('section', { class: 'diagnostico' }, el('h2', {}, 'Para reconocerla'), el('p', {}, e.diagnostico)) : null,
```

Botón Volver:

```js
      el('button', { type: 'button', class: 'btn', onclick: () => (ctx.desdeLista ? history.back() : navegar('#/lista')) }, 'Volver')
```

- [ ] **Paso 2: `ui/editar.js`**

Después de `campoTexto(borrador, 'decreto', 'Decreto'),` agregar:

```js
    campoSelector(borrador, 'registroAI', 'Registrada antes en el área de influencia (AI)', [['si', 'Sí'], ['no', 'No'], ['duda', 'Por confirmar']], '(sin dato)'),
    el('label', { class: 'casilla' }, el('input', { type: 'checkbox', checked: Boolean(borrador.hidrofila), onchange: ev => { borrador.hidrofila = ev.target.checked; } }), 'Hidrófila o de humedal'),
    campoTexto(borrador, 'diagnostico', 'Para reconocerla (rasgo diagnóstico)', true),
```

Como `borrador` puede venir de un registro antiguo sin estos campos, `campoSelector` compara `objeto[clave] === valor` y
`undefined` no marca ninguna opción: está bien.

- [ ] **Paso 3: `ui/estudio.js`**

En el `onclick` de `botonPista`:

```js
      pista.textContent = `Familia: ${e.familia || 'sin dato'} · Hábito: ${e.habito || 'sin dato'}`
        + (e.diagnostico ? `\n${e.diagnostico}` : '');
```

y en `styles.css`: `.pista { text-align: center; white-space: pre-line; }` (reemplaza la regla `.pista` existente).

- [ ] **Paso 4: estilos de la ficha**

```css
.recorrido { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; margin-bottom: 8px; }
.recorrido span { color: var(--texto-suave); font-size: .95rem; text-align: center; }
.diagnostico { background: #fff8e1; border: 1px solid var(--ambar); border-radius: 10px; padding: 4px 12px 8px; margin: 8px 0; }
.diagnostico h2 { margin: 6px 0 2px; font-size: 1rem; color: #7a4a00; }
```

- [ ] **Paso 5: ejecutar las pruebas y verificar en el navegador**

Correr: `npx vitest run`. Esperado: todo pasa.
En el navegador a 390 px:
1. Abrir una ficha de Chacao: se ve "Para reconocerla" si tiene diagnóstico, junto con Grupo, Registro en el AI y la barra "n de N".
2. "Siguiente ›" tres veces y luego atrás del navegador: vuelve a la lista y no a las fichas anteriores; la lista queda en la última especie vista.
3. Una foto ampliada de la presentación muestra la atribución.
4. Editar: aparecen los campos nuevos y se guardan.
5. Estudio: la pista muestra el diagnóstico.

- [ ] **Paso 6: commit**

```bash
git add ui/ficha.js ui/editar.js ui/estudio.js styles.css
git commit -m "Ficha: recorrido anterior/siguiente, rasgo diagnóstico y campos nuevos; edición y pista"
```

---

### Tarea 9: Publicación 1.4.0

**Archivos:**
- Modificar: `version.js` (`'1.4.0'`), `package.json` (`"version": "1.4.0"`), `sw.js` (`ARCHIVOS` con `./taxonomia.js`,
  `./filtros.js` y `./ui/memoria.js`), `README.md`, `tests/sw.test.js` (si verifica la lista de archivos)

- [ ] **Paso 1:** actualizar `ARCHIVOS` en `sw.js` y las versiones. Si `tests/sw.test.js` compara la lista de archivos con
  los módulos importados, debe pasar con los tres nuevos.
- [ ] **Paso 2:** README, sección Uso, punto **Lista**:

```markdown
- **Lista.** Buscar por nombre, familia o rasgo. "Filtros" abre una hoja con tres secciones. Identificación: grupo, familia, hábito, forma de vida, color de flor y pétalos. Evaluación ambiental: categoría de conservación, origen, hidrófila y registro previo en el área de influencia (solo Chacao Chonchi). Estudio: sitio, aprendizaje y fotos. Cada opción muestra cuántas especies quedan. Los filtros activos aparecen como chips. El orden puede ser alfabético, por familia, como en la presentación del sitio o "me falta primero". La lista recuerda los filtros, el orden y la especie donde quedaste, incluso al cerrar la aplicación. El botón "+" crea una especie.
- **Ficha.** Fotos, rasgo para reconocerla, campos y notas. "‹ Anterior" y "Siguiente ›" recorren la lista filtrada sin volver a ella. "Editar" permite cambiar cualquier campo y agregar fotos con la cámara o la galería.
```

Y en Desarrollo, junto a los listados: "`tools/agregar_presentacion.py` genera `semilla/chacao-chonchi.zip` desde el PDF
de la presentación de campaña (`data/source/chacao-chonchi.pdf`, no versionado). Con `agregarListado`, las especies
que ya estaban reciben además las fotos y los datos que les faltan." Actualizar los conteos de pruebas del README con
los números reales.

En "Datos y licencias": "Las fotos e ilustraciones del listado Chacao Chonchi provienen de la presentación de campaña
de Del Río, C. y M. Carrasco (2026), para uso interno de estudio."

- [ ] **Paso 3:** correr las dos suites completas y anotar los totales.
- [ ] **Paso 4:** commit

```bash
git add version.js package.json sw.js README.md tests/sw.test.js
git commit -m "Flora offline 1.4.0: listado Chacao Chonchi, filtros de terreno y lista que recuerda dónde quedaste"
```
