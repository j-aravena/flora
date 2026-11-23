from pathlib import Path

import pytest
from PIL import Image

from flora.presentacion import (
    es_ilustracion,
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
