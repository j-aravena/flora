import io

import requests
from PIL import Image

from flora.informe import Informe
from migrar import asignar_fotos_planilla, completar_con_inaturalist, plural


def _png(ancho, alto, color="red"):
    buf = io.BytesIO()
    Image.new("RGB", (ancho, alto), color).save(buf, "PNG")
    return buf.getvalue()


def _tira6():
    im = Image.new("RGB", (6 * 400 + 5 * 30, 320), "white")
    for i in range(6):
        im.paste((200, 40 * i, 50), (i * 430, 0, i * 430 + 400, 320))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def _tira_muchos_segmentos():
    # 14 tiles de 150 px separados por huecos blancos de 30 px, altura 100 px: proporción
    # ancho/alto de sobra para ser tira (24,9), pero 14 segmentos superan MAX_SEGMENTOS (12).
    n, ancho, alto, hueco = 14, 150, 100, 30
    im = Image.new("RGB", (n * ancho + (n - 1) * hueco, alto), "white")
    for i in range(n):
        im.paste((10 + (5 * i) % 240, 80, 200), (i * (ancho + hueco), 0, i * (ancho + hueco) + ancho, alto))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def test_asignar_fotos_planilla_corta_tiras_por_proporcion():
    regs = [
        {"id": "a", "nombre": "A", "_filas": [2]},
        {"id": "b", "nombre": "B", "_filas": [3, 4]},
        {"id": "c", "nombre": "C", "_filas": [5]},
    ]
    imagenes = {
        ("O", 2): _tira6(), ("Q", 2): _png(800, 600),
        ("O", 3): _png(300, 300),
        ("O", 5): _tira_muchos_segmentos(),
        ("O", 9): _png(10, 10),
    }
    inf = Informe()
    fotos = asignar_fotos_planilla(regs, imagenes, "x", inf)
    de_a = [f for f in fotos if f["especieId"] == "a"]
    de_b = [f for f in fotos if f["especieId"] == "b"]
    de_c = [f for f in fotos if f["especieId"] == "c"]
    assert len(de_a) == 7 and [f["orden"] for f in de_a] == list(range(7))
    # Con el orden por (fila, columna), la tira de O2 va antes que la foto de Q2.
    assert de_a[6]["ancho"] == 800  # 800x600: proporción 1,3 - no es tira, va al final sin cortar
    # 300x300: proporción 1 - no es tira; una sola foto, sin entradas en ninguna sección de tiras.
    assert len(de_b) == 1 and de_b[0]["ancho"] == 300
    assert "Tiras con número de fotos distinto de 6" not in inf.secciones
    # 2490x100: proporción 24,9 - sí es tira; 14 segmentos > MAX_SEGMENTOS (12), corte
    # anómalo, se conserva la tira completa como una sola foto (sin cortar). crear_foto
    # la reduce a 1200 px de lado mayor (2490 supera el límite de a_webp).
    assert len(de_c) == 1 and de_c[0]["ancho"] == 1200
    assert inf.secciones["Tiras con corte anómalo"] == ["C (fila 5): 14 segmentos"]
    assert inf.secciones["Imágenes sin fila"] == ["O9"]


def test_asignar_fotos_planilla_ignora_filas_de_prefactibilidad():
    # Regresión: _filas_pref no debe usarse para indexar imágenes de la planilla base
    # (esas filas pertenecen a la planilla de prefactibilidad, no a la que trae las fotos).
    regs = [
        {"id": "pref", "nombre": "De prefactibilidad", "_filas": [], "_filas_pref": [2]},
        {"id": "base", "nombre": "De la base", "_filas": [2], "_filas_pref": []},
    ]
    imagenes = {("O", 2): _png(300, 300)}
    inf = Informe()
    fotos = asignar_fotos_planilla(regs, imagenes, "x", inf)
    assert len(fotos) == 1 and fotos[0]["especieId"] == "base"


def test_plural():
    assert plural(1, "foto", "fotos") == "1 foto"
    assert plural(0, "foto", "fotos") == "0 fotos"
    assert plural(2, "segmento", "segmentos") == "2 segmentos"


def test_completar_con_inaturalist_solo_registros_sin_foto():
    class ClienteFalso:
        def __init__(self): self.consultas = []
        def bytes(self, url): return _png(500, 400)
    regs = [{"id": "a", "nombre": "Con foto", "nivel": "especie"}, {"id": "b", "nombre": "Cordia decandra", "nivel": "especie"}, {"id": "c", "nombre": "Nadie", "nivel": "especie"}]
    fotos = [{"id": "f", "especieId": "a"}]
    def buscar(cliente, nombre, nivel):
        return 7 if nombre == "Cordia decandra" else None
    def descargar(cliente, taxon_id):
        return [{"url_media": "https://i/1.jpg", "autor": "(c) x", "licencia": "cc-by", "url": "https://i/1"}]
    inf = Informe()
    salida = completar_con_inaturalist(regs, fotos, ClienteFalso(), "x", inf, buscar=buscar, descargar=descargar)
    nuevas = [f for f in salida if f["especieId"] == "b"]
    assert len(salida) == 2 and len(nuevas) == 1
    assert nuevas[0]["fuente"] == "inaturalist" and nuevas[0]["licencia"] == "cc-by" and nuevas[0]["orden"] == 0
    assert inf.secciones["Sin taxón en iNaturalist"] == ["Nadie"]


def test_completar_con_inaturalist_anota_consulta_alternativa():
    regs = [{"id": "a", "nombre": "Pentaphorus foliolosus", "nivel": "especie"}]
    def buscar(cliente, nombre, nivel):
        return None
    inf = Informe()
    completar_con_inaturalist(regs, [], object(), "x", inf, buscar=buscar, descargar=lambda *a: [])
    assert inf.secciones["Consultas por nombre alternativo"] == ["Pentaphorus foliolosus -> Gochnatia foliolosa"]
    assert inf.secciones["Sin taxón en iNaturalist"] == ["Pentaphorus foliolosus"]


def test_completar_con_inaturalist_registra_fallo_de_descarga_y_continua():
    class ClienteFalso:
        def bytes(self, url):
            if "malo" in url:
                raise requests.RequestException("boom")
            return _png(500, 400)
    regs = [{"id": "a", "nombre": "Especie X", "nivel": "especie"}]
    def buscar(cliente, nombre, nivel):
        return 1
    def descargar(cliente, taxon_id):
        return [
            {"url_media": "https://i/malo.jpg", "autor": "x", "licencia": "cc-by", "url": "https://i/1"},
            {"url_media": "https://i/bueno.jpg", "autor": "y", "licencia": "cc0", "url": "https://i/2"},
        ]
    inf = Informe()
    salida = completar_con_inaturalist(regs, [], ClienteFalso(), "x", inf, buscar=buscar, descargar=descargar)
    assert len(salida) == 1 and salida[0]["licencia"] == "cc0" and salida[0]["orden"] == 0
    assert inf.secciones["Fallos de descarga"] == ["Especie X: https://i/malo.jpg: RequestException"]
    assert inf.secciones["Fotos descargadas de iNaturalist"] == ["Especie X: 1 foto"]
