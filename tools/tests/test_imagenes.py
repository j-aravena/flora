import io
from pathlib import Path

import pytest
from PIL import Image

from flora.imagenes import a_webp, cortar_tira, crear_foto, mapa_celdas_imagen

RUTA_BASE = Path("data/source/stp y las tortolas.xlsx")


def _tira(n=6, ancho=400, alto=320, hueco=30) -> bytes:
    im = Image.new("RGB", (n * ancho + (n - 1) * hueco, alto), "white")
    for i in range(n):
        color = (200, 30 + 30 * i, 60)
        im.paste(color, (i * (ancho + hueco), 0, i * (ancho + hueco) + ancho, alto))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def test_cortar_tira_devuelve_seis_fotos():
    piezas = cortar_tira(_tira())
    assert len(piezas) == 6
    assert all(p.size == (400, 320) for p in piezas)


def test_cortar_tira_sin_huecos_devuelve_una():
    assert len(cortar_tira(_tira(n=1))) == 1


def _tira_con_franja_angosta() -> bytes:
    # Tile de 400 px + hueco de 30 px + franja de color de 60 px + hueco de 30 px + tile
    # de 400 px: la franja de 60 px pasa el ancho_min (50) pero no llega a ancho_fusion
    # (100), así que se fusiona con el segmento anterior.
    ancho_total = 400 + 30 + 60 + 30 + 400
    im = Image.new("RGB", (ancho_total, 320), "white")
    im.paste((200, 30, 60), (0, 0, 400, 320))
    im.paste((200, 90, 60), (430, 0, 490, 320))
    im.paste((200, 150, 60), (520, 0, 920, 320))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def test_cortar_tira_fusiona_segmento_angosto_con_el_anterior():
    piezas = cortar_tira(_tira_con_franja_angosta())
    assert len(piezas) == 2
    assert piezas[0].width == 490  # 400 (tile) + 30 (hueco) + 60 (franja angosta)
    assert piezas[1].width == 400


def test_a_webp_reduce_y_conserva_proporcion():
    im = Image.new("RGB", (2400, 1200), "green")
    datos, w, h = a_webp(im, 1200)
    assert (w, h) == (1200, 600)
    assert Image.open(io.BytesIO(datos)).format == "WEBP"
    datos2, w2, h2 = a_webp(im, 200)
    assert (w2, h2) == (200, 100)


def test_crear_foto_tiene_campos_y_es_determinista():
    im = Image.new("RGB", (640, 480), "blue")
    f = crear_foto("esp-1", im, "planilla", 0, "2026-09-05T00:00:00+00:00")
    g = crear_foto("esp-1", im, "planilla", 0, "2026-09-05T00:00:00+00:00")
    assert f["id"] == g["id"] and len(f["id"]) == 36
    assert f["especieId"] == "esp-1" and f["orden"] == 0 and f["tipo"] == "image/webp"
    assert (f["ancho"], f["alto"]) == (640, 480) and f["fuente"] == "planilla"
    assert f["autor"] == "" and f["licencia"] == "" and f["url"] == ""
    assert isinstance(f["blob"], bytes) and isinstance(f["miniatura"], bytes)
    assert crear_foto("esp-1", im, "planilla", 1, "x")["id"] != f["id"]


@pytest.mark.skipif(not RUTA_BASE.exists(), reason="planilla de origen no disponible")
def test_mapa_celdas_imagen_sobre_planilla_real():
    mapa = mapa_celdas_imagen(RUTA_BASE)
    assert len(mapa) == 388
    assert ("O", 2) in mapa and ("Q", 78) in mapa
    assert mapa[("O", 2)][:8] == b"\x89PNG\r\n\x1a\n"
    assert len(set(mapa.values())) == 388
