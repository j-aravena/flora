"""Rasgos florales: color de flor y número de pétalos desde los CSV de investigación y desde las fotos."""
import collections
import csv
import io
import math

import numpy as np
from PIL import Image

from flora.limpieza import clave

PALETA = ["blanco", "amarillo", "naranja", "rojo", "rosado", "morado", "azul", "verde", "cafe", "sin_flor_vistosa"]
SINONIMOS_COLOR = {
    "violeta": "morado", "purpura": "morado", "lila": "morado", "magenta": "morado",
    "celeste": "azul", "crema": "blanco", "cremoso": "blanco", "blanquecino": "blanco",
    "anaranjado": "naranja", "rosa": "rosado", "rojizo": "rojo", "amarillento": "amarillo",
    "marron": "cafe", "pardo": "cafe", "verdoso": "verde",
}
ETIQUETAS_TIPO = {
    "petalos": "Pétalos", "tepalos": "Tépalos", "ligulas": "Lígulas",
    "sin_petalos": "Sin pétalos", "apetala": "Apétala",
}
FOTOS_POR_ESPECIE = 6
MIN_PIXELES_VIVOS = 0.01
MIN_FRACCION_COLOR = 0.25
# Ajustado de 0.35 a 0.28: los rosados pastel (pétalos claros bajo mucha luz) caen con
# saturación baja pero brillo alto, y con 0.35 quedaban fuera de "vivos" por completo.
MIN_SATURACION_VIVA = 0.28


def normalizar_colores(texto) -> list[str]:
    salida = []
    for parte in str(texto or "").replace(",", ";").split(";"):
        c = clave(parte).replace("_", " ")
        c = SINONIMOS_COLOR.get(c, c).replace(" ", "_")
        if c in PALETA and c not in salida:
            salida.append(c)
    return salida


def leer_colores(ruta) -> dict[str, dict]:
    with open(ruta, newline="", encoding="utf-8") as f:
        return {
            clave(fila["nombre"]): {
                "colores": normalizar_colores(fila.get("colores")),
                "fuente": (fila.get("fuente") or "").strip(),
                "nota": (fila.get("nota") or "").strip(),
            }
            for fila in csv.DictReader(f) if fila.get("nombre")
        }


def leer_reglas_petalos(ruta) -> dict[tuple[str, str], dict]:
    with open(ruta, newline="", encoding="utf-8") as f:
        return {
            ((fila.get("ambito") or "").strip().lower(), clave(fila["taxon"])): {
                "petalos": (fila.get("petalos") or "").strip(),
                "tipo": (fila.get("tipo") or "").strip(),
                "fuente": (fila.get("fuente") or "").strip(),
                "nota": (fila.get("nota") or "").strip(),
            }
            for fila in csv.DictReader(f) if fila.get("taxon")
        }


def petalos_para(registro: dict, reglas: dict) -> dict | None:
    nombre = registro["nombre"]
    familia = registro.get("familia") or (nombre if registro.get("nivel") == "familia" else "")
    candidatos = (("especie", nombre), ("genero", nombre.split()[0]), ("familia", familia))
    for ambito, taxon in candidatos:
        regla = reglas.get((ambito, clave(taxon)))
        if regla and regla["petalos"]:
            return regla
    return None


def color_desde_imagen(im: Image.Image) -> list[str]:
    """Píxeles saturados y claros que no son verdes, agrupados por tono. Hasta dos colores."""
    im = im.convert("RGB")
    im.thumbnail((160, 160))
    hsv = np.asarray(im.convert("HSV")).reshape(-1, 3).astype(float)
    tono, sat, val = hsv[:, 0] * 360 / 255, hsv[:, 1] / 255, hsv[:, 2] / 255
    vivos = (sat > MIN_SATURACION_VIVA) & (val > 0.35) & ~((tono >= 60) & (tono <= 170))
    if vivos.sum() < MIN_PIXELES_VIVOS * len(tono):
        return []
    t, s = tono[vivos], sat[vivos]
    rojizo = (t < 12) | (t >= 340)
    cubos = {
        "rojo": rojizo & (s > 0.6),
        "rosado": (rojizo & (s <= 0.6)) | ((t >= 300) & (t < 340)),
        "naranja": (t >= 12) & (t < 40),
        "amarillo": (t >= 40) & (t < 60),
        "azul": (t >= 170) & (t < 250),
        "morado": (t >= 250) & (t < 300),
    }
    conteo = {nombre: int(m.sum()) for nombre, m in cubos.items()}
    total = sum(conteo.values()) or 1
    ordenados = sorted(conteo.items(), key=lambda kv: -kv[1])
    return [nombre for nombre, n in ordenados if n >= MIN_FRACCION_COLOR * total][:2]


def votar_colores(listas: list[list[str]], minimo: int | None = None) -> list[str]:
    """Cuenta votos de color entre las fotos analizadas y conserva los que alcanzan el umbral.

    El umbral por defecto es al menos la mitad de las fotos analizadas (`listas`), con un
    mínimo de 2 votos: con una sola foto analizada nunca se infiere color, porque una sola
    lectura no es evidencia suficiente. Como máximo se conservan dos colores.
    """
    votos = collections.Counter(c for lista in listas for c in lista)
    umbral = minimo if minimo is not None else max(2, math.ceil(len(listas) / 2))
    return [c for c, v in votos.most_common() if v >= umbral][:2]


def _colores_de_fotos(fotos: list[dict]) -> list[str]:
    listas = []
    for f in fotos[:FOTOS_POR_ESPECIE]:
        try:
            listas.append(color_desde_imagen(Image.open(io.BytesIO(f["blob"]))))
        except OSError:
            continue
    return votar_colores(listas)


def aplicar_rasgos(registros: list[dict], fotos: list[dict], colores: dict, reglas: dict, informe) -> None:
    por_especie = collections.defaultdict(list)
    for f in fotos:
        por_especie[f["especieId"]].append(f)
    desde_csv = desde_fotos = sin_color = con_regla = 0
    for r in registros:
        fuentes = []
        csv_ = colores.get(clave(r["nombre"]), {"colores": [], "fuente": "", "nota": ""})
        # Si el CSV ya dice que no hay flor vistosa, las fotos no pueden contradecirlo
        # (papel de pliego, etiquetas o cielo de fondo producen colores espurios): no se
        # analizan y no se anota desacuerdo.
        sin_flor_vistosa = csv_["colores"] == ["sin_flor_vistosa"]
        de_fotos = [] if sin_flor_vistosa else _colores_de_fotos(por_especie.get(r["id"], []))
        if csv_["colores"]:
            r["colorFlor"] = list(csv_["colores"])
            desde_csv += 1
            if csv_["fuente"]:
                fuentes.append(csv_["fuente"])
            if de_fotos and not set(de_fotos) & set(csv_["colores"]):
                informe.agregar("Color en desacuerdo", f"{r['nombre']}: csv {', '.join(csv_['colores'])}, fotos {', '.join(de_fotos)}")
        elif de_fotos:
            r["colorFlor"] = de_fotos
            desde_fotos += 1
            fuentes.append("Color estimado desde las fotos")
            informe.agregar("Color desde fotos", f"{r['nombre']}: {', '.join(de_fotos)}")
        else:
            r["colorFlor"] = []
            sin_color += 1
        regla = petalos_para(r, reglas)
        if regla:
            r["petalos"] = regla["petalos"]
            etiqueta_tipo = ETIQUETAS_TIPO.get(regla["tipo"], regla["tipo"])
            r["petalosNota"] = f"{etiqueta_tipo}. {regla['nota']}" if regla["nota"] else etiqueta_tipo
            con_regla += 1
            if regla["fuente"]:
                fuentes.append(regla["fuente"])
        else:
            r["petalos"] = ""
            r["petalosNota"] = ""
            informe.agregar("Sin regla de pétalos", r["nombre"])
        r["rasgosFuente"] = "\n".join(dict.fromkeys(fuentes))
    informe.agregar("Rasgos", f"Color desde CSV: {desde_csv}, desde fotos: {desde_fotos}, sin color: {sin_color}")
    informe.agregar("Rasgos", f"Con regla de pétalos: {con_regla}, sin regla: {len(registros) - con_regla}")
