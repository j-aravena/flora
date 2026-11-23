"""Lectura de la presentación de campaña (PDF exportado de PowerPoint): una especie por diapositiva.

Las funciones de interpretación trabajan sobre spans ya extraídos ({texto, tamano, flags, bbox}) para poder
probarlas sin el PDF. La lectura del PDF con PyMuPDF está en spans_de_pagina e imagenes_de_pagina."""
import re

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
