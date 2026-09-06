"""Conversión de filas a registros del modelo y unión de las dos planillas."""
import uuid

from flora.lectura import COLS_NOTAS
from flora.limpieza import (
    RESOLUCIONES_ORIGEN, SINONIMOS, clave, dividir_distribucion, limpiar_texto,
    nivel_y_nombre, normalizar_categoria, normalizar_ciclo, normalizar_ds68, normalizar_habito,
)

_NS = uuid.UUID("6f1c2a4e-2b7d-4c1e-9a3b-5d8e7f6a1b2c")
_APRENDIZAJE = {"si": "se", "falta": "falta", "no": "no"}


def id_para(nombre: str) -> str:
    return str(uuid.uuid5(_NS, clave(nombre)))


def _base_registro(nombre: str, nivel: str, ahora: str) -> dict:
    return {
        "id": id_para(nombre), "nombre": nombre, "nivel": nivel,
        "familia": "", "origen": "", "habito": "", "habitoDetalle": "", "ciclo": "",
        "categoriaMMA": "", "decreto": "", "ds68": False, "distribucion": [],
        "rangoAltitudinal": "", "sitios": [], "aprendizaje": None,
        "aciertos": 0, "fallos": 0, "rachaAciertos": 0, "ultimoEstudio": None,
        "notas": "", "creadoEn": ahora, "modificadoEn": ahora, "_filas": [], "_filas_pref": [],
        "colorFlor": [], "petalos": "", "petalosNota": "", "rasgosFuente": "",
    }


def _anotar_correccion_nombre(informe, original: str, nombre: str) -> None:
    if informe is not None and nombre != original:
        informe.agregar("Correcciones de nombre", f"{original} -> {nombre}")


def registro_desde_base(fila: dict, ahora: str, informe=None) -> dict:
    original = limpiar_texto(fila["Especie"])
    nivel, nombre = nivel_y_nombre(original)
    _anotar_correccion_nombre(informe, original, nombre)
    r = _base_registro(nombre, nivel, ahora)
    r.update({
        "familia": limpiar_texto(fila.get("Familia")),
        "origen": limpiar_texto(fila.get("Origen")),
        "habito": normalizar_habito(fila.get("Hábito de crecimiento")),
        "habitoDetalle": limpiar_texto(fila.get("Habito")),
        "ciclo": normalizar_ciclo(fila.get("Ciclo de vida")),
        "categoriaMMA": normalizar_categoria(fila.get("Categoría de conservación (MMA)")),
        "decreto": limpiar_texto(fila.get("Decreto supremo")),
        "ds68": normalizar_ds68(fila.get("D.S.68")),
        "distribucion": dividir_distribucion(fila.get("Distribución")),
        "rangoAltitudinal": limpiar_texto(fila.get("Rango altitudinal")),
        "aprendizaje": _APRENDIZAJE.get(clave(limpiar_texto(fila.get("Aprendizaje")))),
        "notas": "\n".join(t for t in (limpiar_texto(fila.get(c)) for c in COLS_NOTAS) if t),
        "_filas": [fila["_fila"]],
    })
    if limpiar_texto(fila.get("Las tortolas")):
        r["sitios"].append("Las Tórtolas")
    if limpiar_texto(fila.get("STP")):
        r["sitios"].append("STP")
    return r


def registro_desde_prefactibilidad(fila: dict, ahora: str, informe=None) -> dict:
    original = limpiar_texto(fila["Especie"])
    nivel, nombre = nivel_y_nombre(SINONIMOS.get(original, original))
    _anotar_correccion_nombre(informe, original, nombre)
    r = _base_registro(nombre, nivel, ahora)
    r.update({
        "origen": limpiar_texto(fila.get("Origen")),
        "habito": normalizar_habito(fila.get("Hábito")),
        "ds68": normalizar_ds68(fila.get("D.S.N°68/2009")),
        "categoriaMMA": normalizar_categoria(fila.get("RCE")),
        "sitios": ["Prefactibilidad"],
        "_filas_pref": [fila["_fila"]],
    })
    return r


def fusionar_duplicados(registros: list[dict], informe) -> list[dict]:
    salida, indice = [], {}
    for r in registros:
        k = clave(r["nombre"])
        if k not in indice:
            indice[k] = r
            salida.append(r)
            continue
        primero = indice[k]
        if r["decreto"] and r["decreto"] != primero["decreto"]:
            nota = f"También citada en {r['decreto']}"
            primero["notas"] = f"{primero['notas']}\n{nota}".strip()
        for s in r["sitios"]:
            if s not in primero["sitios"]:
                primero["sitios"].append(s)
        primero["_filas"] += r["_filas"]
        informe.agregar("Duplicados fusionados", f"{r['nombre']}: filas {primero['_filas']}")
    return salida


def unir(base: list[dict], pref: list[dict], ahora: str, informe) -> list[dict]:
    indice = {clave(r["nombre"]): r for r in base}
    salida = list(base)
    for fila in pref:
        nuevo = registro_desde_prefactibilidad(fila, ahora, informe)
        k = clave(nuevo["nombre"])
        existente = indice.get(k)
        if existente is None:
            indice[k] = nuevo
            salida.append(nuevo)
            continue
        if "Prefactibilidad" not in existente["sitios"]:
            existente["sitios"].append("Prefactibilidad")
        existente["_filas_pref"] += nuevo["_filas_pref"]
        if nuevo["origen"] and existente["origen"] and clave(nuevo["origen"]) != clave(existente["origen"]):
            resuelto = RESOLUCIONES_ORIGEN.get(existente["nombre"], existente["origen"])
            informe.agregar("Conflictos de origen",
                            f"{existente['nombre']}: base={existente['origen']}, prefactibilidad={nuevo['origen']}, se conserva {resuelto}")
            existente["origen"] = resuelto
    return salida


def inferir_familias(registros: list[dict], informe) -> None:
    """Completa la familia de los registros que llegan sin ella: por nivel (si el registro
    es la familia misma) o por el género, cuando todos los registros de especie de ese
    género conocidos comparten una única familia."""
    por_genero: dict[str, str] = {}
    ambiguos = set()
    for r in registros:
        if r["nivel"] == "especie" and r["familia"]:
            genero = r["nombre"].split()[0]
            familia_previa = por_genero.get(genero)
            if familia_previa is None:
                por_genero[genero] = r["familia"]
            elif familia_previa != r["familia"]:
                ambiguos.add(genero)
    for genero in ambiguos:
        por_genero.pop(genero, None)
    for r in registros:
        if r["familia"]:
            continue
        if r["nivel"] == "familia":
            r["familia"] = r["nombre"]
        else:
            r["familia"] = por_genero.get(r["nombre"].split()[0], "")
        if r["familia"]:
            informe.agregar("Familias inferidas", f"{r['nombre']}: {r['familia']}")
