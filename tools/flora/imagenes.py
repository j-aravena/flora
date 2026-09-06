"""Imágenes en celda del xlsx, corte de tiras y conversión a WebP."""
import io
import re
import uuid
import zipfile

import numpy as np
from PIL import Image

_NS_FOTO = uuid.UUID("a3d1f0c2-7b6e-4e5a-8c9d-1e2f3a4b5c6d")


def mapa_celdas_imagen(ruta_xlsx) -> dict[tuple[str, int], bytes]:
    """Resuelve la cadena celda(vm) -> metadata -> richvalue -> relación -> media."""
    with zipfile.ZipFile(ruta_xlsx) as z:
        hoja = z.read("xl/worksheets/sheet1.xml").decode()
        celdas = re.findall(r'<c r="([A-Z]+)(\d+)"[^>]*? vm="(\d+)"', hoja)
        meta = z.read("xl/metadata.xml").decode()
        rvb = [int(i) for i in re.findall(r'<xlrd:rvb i="(\d+)"', meta)]
        rv = z.read("xl/richData/rdrichvalue.xml").decode()
        valores = re.findall(r"<rv s=\"0\"><v>(\d+)</v><v>(\d+)</v></rv>", rv)
        rels = re.findall(r'<rel r:id="(rId\d+)"', z.read("xl/richData/richValueRel.xml").decode())
        destinos = dict(re.findall(
            r'Id="(rId\d+)"[^>]*Target="\.\./media/([^"]+)"',
            z.read("xl/richData/_rels/richValueRel.xml.rels").decode()))
        salida = {}
        for col, fila, vm in celdas:
            indice_rv = rvb[int(vm) - 1]
            indice_imagen = int(valores[indice_rv][0])
            archivo = destinos[rels[indice_imagen]]
            salida[(col, int(fila))] = z.read("xl/media/" + archivo)
    return salida


def _fusionar_angostos(segmentos: list[tuple[int, int]], ancho_fusion: int) -> list[tuple[int, int]]:
    """Fusiona cada segmento de ancho menor que ancho_fusion con el segmento anterior
    (o con el siguiente si es el primero), formando un recorte que va desde el x0 del
    primero hasta el x1 del segundo, incluido el hueco blanco intermedio."""
    if len(segmentos) <= 1:
        return segmentos
    fusionados = [segmentos[0]]
    for x0, x1 in segmentos[1:]:
        if x1 - x0 < ancho_fusion:
            x0_previo, _ = fusionados[-1]
            fusionados[-1] = (x0_previo, x1)
        else:
            fusionados.append((x0, x1))
    if len(fusionados) > 1 and fusionados[0][1] - fusionados[0][0] < ancho_fusion:
        x0 = fusionados[0][0]
        x1 = fusionados[1][1]
        fusionados = [(x0, x1)] + fusionados[2:]
    return fusionados


def cortar_tira(png: bytes, umbral: int = 235, ancho_min: int = 50,
                 ancho_fusion: int = 100) -> list[Image.Image]:
    """Corta por columnas de píxeles blancos. Devuelve una lista de recortes."""
    im = Image.open(io.BytesIO(png)).convert("RGB")
    a = np.asarray(im)
    blanca = (a.min(axis=2) > umbral).all(axis=0)
    segmentos, inicio = [], None
    for x, b in enumerate(blanca):
        if not b and inicio is None:
            inicio = x
        elif b and inicio is not None:
            segmentos.append((inicio, x))
            inicio = None
    if inicio is not None:
        segmentos.append((inicio, len(blanca)))
    segmentos = [s for s in segmentos if s[1] - s[0] > ancho_min]
    if not segmentos:
        return [im]
    segmentos = _fusionar_angostos(segmentos, ancho_fusion)
    return [im.crop((x0, 0, x1, im.height)) for x0, x1 in segmentos]


def a_webp(im: Image.Image, lado_max: int, calidad: int = 80) -> tuple[bytes, int, int]:
    im = im.convert("RGB")
    im.thumbnail((lado_max, lado_max))
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=calidad)
    return buf.getvalue(), im.width, im.height


def crear_foto(especie_id: str, im: Image.Image, fuente: str, orden: int, ahora: str,
               autor: str = "", licencia: str = "", url: str = "") -> dict:
    blob, ancho, alto = a_webp(im, 1200)
    miniatura, _, _ = a_webp(im, 200)
    return {
        "id": str(uuid.uuid5(_NS_FOTO, f"{especie_id}:{fuente}:{orden}")),
        "especieId": especie_id, "orden": orden, "ancho": ancho, "alto": alto,
        "tipo": "image/webp", "fuente": fuente, "autor": autor, "licencia": licencia, "url": url,
        "creadoEn": ahora, "blob": blob, "miniatura": miniatura,
    }
