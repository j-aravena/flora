"""Lectura de la presentación de campaña (PDF exportado de PowerPoint): una especie por diapositiva.

Las funciones de interpretación trabajan sobre spans ya extraídos ({texto, tamano, flags, bbox}) para poder
probarlas sin el PDF. La lectura del PDF con PyMuPDF está en spans_de_pagina e imagenes_de_pagina."""
import io
import re

import numpy as np
from PIL import Image

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
        if abs(_y(s) - y_nombre) < 8 and s["tamano"] >= 30:
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
