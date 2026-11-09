"""Listados de sitio adicionales (por ejemplo, Nevado Tres Cruces) que se entregan como paquete
incremental: especies nuevas con sus fotos y especies ya existentes a las que solo se suma el sitio."""
import openpyxl

from flora.limpieza import (
    CATEGORIAS, clave, dividir_distribucion, limpiar_texto, nivel_y_nombre, normalizar_categoria,
    normalizar_ds68, normalizar_habito,
)
from flora.union import _anotar_correccion_nombre, _base_registro

# Columnas de la planilla que no tienen campo propio en el modelo y se conservan como notas.
_NOTAS = [
    ("Atacama", "Categoría en Atacama"),
    ("Boletín N°47", "Boletín N°47"),
    ("Proceso 19 ECC", "Proceso 19 ECC"),
]
_SIN_DATO = {"", "0", "#n/a", "none"}
# Categorías con texto compuesto que se resuelven a la categoría de Chile continental.
_CATEGORIA_CONTINENTAL = {
    "chile continental: preocupacion menor. islas desventuradas: en peligro": "Preocupación Menor",
}


def _texto(v) -> str:
    s = limpiar_texto(v)
    return "" if clave(s) in _SIN_DATO else s


def leer_hoja(ruta, hoja: str) -> list[dict]:
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    filas = wb[hoja].iter_rows(values_only=True)
    encabezado = [limpiar_texto(h) for h in next(filas)]
    salida = []
    for i, fila in enumerate(filas, start=2):
        d = dict(zip(encabezado, fila))
        if limpiar_texto(d.get("ESPECIE")):
            d["_fila"] = i
            salida.append(d)
    return salida


def registro_desde_listado(fila: dict, sitio: str, ahora: str, informe=None) -> dict:
    original = limpiar_texto(fila["ESPECIE"])
    nivel, nombre = nivel_y_nombre(original)
    _anotar_correccion_nombre(informe, original, nombre)
    r = _base_registro(nombre, nivel, ahora)
    notas = []
    mma = _texto(fila.get("MMA"))
    categoria = _CATEGORIA_CONTINENTAL.get(clave(mma), normalizar_categoria(mma))
    if mma and (categoria not in CATEGORIAS.values() or categoria != normalizar_categoria(mma)):
        # La aplicación ofrece una lista cerrada de categorías: lo que no calza se guarda como nota.
        notas.append(f"Categoría MMA en la planilla: {' '.join(mma.split())}")
        if categoria not in CATEGORIAS.values():
            categoria = ""
    for col, etiqueta in _NOTAS:
        t = _texto(fila.get(col))
        if t:
            notas.append(f"{etiqueta}: {t}")
    if clave(_texto(fila.get("Especie hidrófila"))) == "x":
        tipo = _texto(fila.get("Tipo"))
        notas.append(f"Especie hidrófila: {tipo}" if tipo else "Especie hidrófila")
    r.update({
        "familia": _texto(fila.get("Familia")),
        "origen": _texto(fila.get("Origen")),
        "habito": normalizar_habito(fila.get("Habito de crecimiento")),
        "categoriaMMA": categoria,
        "decreto": _texto(fila.get("D.S.")),
        "ds68": normalizar_ds68(fila.get("D.S. N° 68/2009")),
        "distribucion": dividir_distribucion(fila.get("Distribución en Chile")),
        "rangoAltitudinal": _texto(fila.get("Rango altitudinal")),
        "sitios": [sitio],
        "notas": "\n".join(notas),
        "_filas": [fila["_fila"]],
    })
    return r


def registros_del_listado(filas: list[dict], sitio: str, ahora: str, informe) -> list[dict]:
    """Convierte las filas y fusiona las repetidas (mismo nombre normalizado)."""
    salida, indice = [], {}
    for fila in filas:
        r = registro_desde_listado(fila, sitio, ahora, informe)
        k = clave(r["nombre"])
        if k in indice:
            indice[k]["_filas"] += r["_filas"]
            informe.agregar("Duplicados fusionados", f"{r['nombre']}: filas {indice[k]['_filas']}")
            continue
        indice[k] = r
        salida.append(r)
    return salida


def separar_existentes(registros: list[dict], ids_existentes: set[str]) -> tuple[list[dict], list[dict]]:
    nuevos = [r for r in registros if r["id"] not in ids_existentes]
    existentes = [r for r in registros if r["id"] in ids_existentes]
    return nuevos, existentes
