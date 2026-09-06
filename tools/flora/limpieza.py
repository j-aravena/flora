"""Normalización de textos de las planillas de origen. Funciones puras."""
import re
import unicodedata

CATEGORIAS = {
    "lc": "Preocupación Menor",
    "preocupacion menor": "Preocupación Menor",
    "casi amenazada": "Casi amenazada",
    "vulnerable": "Vulnerable",
    "en peligro": "En peligro",
}
HABITOS = {
    "hierba anual": "Hierba anual",
    "hierba perenne": "Hierba perenne",
    "arbusto": "Arbusto",
    "arbol": "Árbol",
    "suculenta": "Suculenta",
}
CICLOS = {
    "anual": "Anual",
    "perenne": "Perenne",
    "bienal": "Bienal",
    "anual o bienal": "Anual o bienal",
}
# Correcciones ortográficas de nombres científicos (sección 8.2 de la especificación).
CORRECCIONES_NOMBRE = {
    "Schinus montanas": "Schinus montanus",
    "Populus alba L.": "Populus alba",
    "cistanthe arenaria": "Cistanthe arenaria",
}
# Nombre en prefactibilidad -> nombre en la base.
SINONIMOS = {
    "Tetraglochin alata": "Tetraglochin alatum",
    "Echinopsis chiloensis": "Trichocereus chiloensis",
}
# Origen que prevalece cuando las dos planillas discrepan.
RESOLUCIONES_ORIGEN = {"Proustia cuneifolia": "Nativa"}


def limpiar_texto(v) -> str:
    if v is None:
        return ""
    s = str(v).replace(" ", " ").strip()  # espacio de no separación (U+00A0) a espacio normal
    return "" if s == "-" else s


def clave(nombre: str) -> str:
    s = unicodedata.normalize("NFKD", nombre or "").encode("ascii", "ignore").decode()
    return " ".join(s.lower().split())


def _normalizar_con(tabla: dict, v) -> str:
    s = limpiar_texto(v)
    if not s:
        return ""
    return tabla.get(clave(s), s)


def normalizar_categoria(v) -> str:
    return _normalizar_con(CATEGORIAS, v)


def normalizar_habito(v) -> str:
    return _normalizar_con(HABITOS, v)


def normalizar_ciclo(v) -> str:
    return _normalizar_con(CICLOS, v)


def normalizar_ds68(v) -> bool:
    return clave(limpiar_texto(v)) in ("x", "originaria")


def dividir_distribucion(v) -> list[str]:
    return [p.strip() for p in limpiar_texto(v).split("-") if p.strip()]


def nivel_y_nombre(nombre) -> tuple[str, str]:
    s = limpiar_texto(nombre)
    s = CORRECCIONES_NOMBRE.get(s, s)
    m = re.match(r"^(.+?)\s+sp\.?$", s)
    if m:
        return "genero", m.group(1)
    if s.endswith("aceae"):
        return "familia", s
    if " " not in s:
        return "genero", s
    return "especie", s
