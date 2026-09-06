"""Orquestador del pipeline de migración. Uso: python tools/migrar.py [--sin-descarga] [--salida data/build]"""
import argparse
import collections
import io
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from PIL import Image

from flora import inaturalist
from flora.imagenes import cortar_tira, crear_foto, mapa_celdas_imagen
from flora.informe import Informe
from flora.lectura import leer_base, leer_prefactibilidad
from flora.paquete import construir_zip, sin_foto, verificar, verificar_zip
from flora.rasgos import aplicar_rasgos, leer_colores, leer_reglas_petalos
from flora.union import fusionar_duplicados, inferir_familias, registro_desde_base, unir

RUTA_BASE = Path("data/source/stp y las tortolas.xlsx")
RUTA_PREF = Path("data/source/Flora potencial (prefactibilidad).xlsx")
RUTA_COLORES = Path("data/rasgos/color-flor.csv")
RUTA_PETALOS = Path("data/rasgos/petalos-reglas.csv")
# El número de fotos por fila varía genuinamente entre las especies (confirmado
# visualmente contra la planilla original): no siempre son 6. Un corte se considera
# válido si produce entre 1 y MAX_SEGMENTOS piezas; en ese caso cada pieza es una foto,
# aunque el total no sea 6. Solo se trata como "anómalo" (y se conserva la tira entera
# como una sola foto) un corte que produce un número irrazonable de piezas.
MAX_SEGMENTOS = 12
# Una imagen se trata como tira (y se intenta cortar) cuando su proporción ancho/alto
# alcanza este valor, sin importar en qué columna de la planilla esté.
PROPORCION_TIRA = 3


def plural(n: int, singular: str, plural: str) -> str:
    return f"{n} {singular if n == 1 else plural}"


def asignar_fotos_planilla(registros, imagenes, ahora, informe) -> list[dict]:
    por_fila = {fila: r for r in registros for fila in r.get("_filas", [])}
    fotos, contador = [], collections.Counter()
    for (col, fila), png in sorted(imagenes.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        r = por_fila.get(fila)
        if r is None:
            informe.agregar("Imágenes sin fila", f"{col}{fila}")
            continue
        imagen = Image.open(io.BytesIO(png)).convert("RGB")
        if imagen.width / imagen.height >= PROPORCION_TIRA:
            piezas = cortar_tira(png)
            if 1 <= len(piezas) <= MAX_SEGMENTOS:
                if len(piezas) != 6:
                    informe.agregar("Tiras con número de fotos distinto de 6",
                                     f"{r['nombre']} (fila {fila}): {plural(len(piezas), 'foto', 'fotos')}")
            else:
                informe.agregar("Tiras con corte anómalo",
                                 f"{r['nombre']} (fila {fila}): {plural(len(piezas), 'segmento', 'segmentos')}")
                piezas = [imagen]
        else:
            piezas = [imagen]
        for im in piezas:
            fotos.append(crear_foto(r["id"], im, "planilla", contador[r["id"]], ahora))
            contador[r["id"]] += 1
    return fotos


def completar_con_inaturalist(registros, fotos, cliente, ahora, informe,
                              buscar=inaturalist.buscar_taxon, descargar=inaturalist.fotos_para) -> list[dict]:
    con_foto = {f["especieId"] for f in fotos}
    salida = list(fotos)
    for r in registros:
        if r["id"] in con_foto:
            continue
        consulta = inaturalist.nombre_consulta(r["nombre"])
        if consulta != r["nombre"]:
            informe.agregar("Consultas por nombre alternativo", f"{r['nombre']} -> {consulta}")
        taxon = buscar(cliente, r["nombre"], r["nivel"])
        if taxon is None:
            informe.agregar("Sin taxón en iNaturalist", r["nombre"])
            continue
        candidatas = descargar(cliente, taxon)
        if not candidatas:
            informe.agregar("Sin fotos con licencia en iNaturalist", r["nombre"])
            continue
        exitosas = 0
        for f in candidatas:
            try:
                datos = cliente.bytes(f["url_media"])
                im = Image.open(io.BytesIO(datos))
                im.load()
            except (OSError, requests.RequestException) as err:
                informe.agregar("Fallos de descarga",
                                 f"{r['nombre']}: {f['url_media']}: {type(err).__name__}")
                continue
            salida.append(crear_foto(r["id"], im, "inaturalist", exitosas, ahora,
                                      f["autor"], f["licencia"], f["url"]))
            exitosas += 1
        if exitosas:
            informe.agregar("Fotos descargadas de iNaturalist",
                             f"{r['nombre']}: {plural(exitosas, 'foto', 'fotos')}")
    return salida


def resumen(registros, fotos, informe) -> None:
    for campo in ("origen", "habito", "nivel"):
        c = collections.Counter(r[campo] or "(vacío)" for r in registros)
        informe.agregar(f"Registros por {campo}", ", ".join(f"{k}: {v}" for k, v in sorted(c.items())))
    c = collections.Counter(s for r in registros for s in r["sitios"])
    informe.agregar("Registros por sitio", ", ".join(f"{k}: {v}" for k, v in sorted(c.items())))
    c = collections.Counter(f["fuente"] for f in fotos)
    informe.agregar("Fotos por fuente", ", ".join(f"{k}: {v}" for k, v in sorted(c.items())))
    for nombre in sin_foto(registros, fotos):
        informe.agregar("Registros sin foto", nombre)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sin-descarga", action="store_true", help="no consulta iNaturalist")
    ap.add_argument("--salida", default="data/build")
    args = ap.parse_args(argv)
    salida = Path(args.salida)
    salida.mkdir(parents=True, exist_ok=True)
    ahora = datetime.now(timezone.utc).isoformat(timespec="seconds")
    informe = Informe()

    print("Leyendo planillas...")
    base = [registro_desde_base(f, ahora, informe) for f in leer_base(RUTA_BASE)]
    base = fusionar_duplicados(base, informe)

    # "_filas" solo contiene números de fila de la planilla base; los de prefactibilidad
    # quedan en "_filas_pref", así que asignar las fotos con "base" antes de unir sigue
    # siendo correcto tanto antes como después de unir().
    print("Extrayendo imágenes de la planilla...")
    fotos = asignar_fotos_planilla(base, mapa_celdas_imagen(RUTA_BASE), ahora, informe)
    print(f"{len(fotos)} fotos de la planilla")

    registros = unir(base, leer_prefactibilidad(RUTA_PREF), ahora, informe)
    inferir_familias(registros, informe)
    print(f"{len(registros)} registros")

    if not args.sin_descarga:
        print("Descargando fotos faltantes desde iNaturalist...")
        fotos = completar_con_inaturalist(registros, fotos, inaturalist.Cliente("data/cache"), ahora, informe)
        print(f"{len(fotos)} fotos en total")

    if RUTA_COLORES.exists() and RUTA_PETALOS.exists():
        print("Aplicando rasgos florales...")
        aplicar_rasgos(registros, fotos, leer_colores(RUTA_COLORES), leer_reglas_petalos(RUTA_PETALOS), informe)
    else:
        informe.agregar("Rasgos", "sin archivos en data/rasgos/; campos vacíos")

    resumen(registros, fotos, informe)
    errores = verificar(registros, fotos)
    ruta_zip = salida / "semilla.zip"
    construir_zip(ruta_zip, registros, fotos, ahora)
    errores += verificar_zip(ruta_zip)
    for e in errores:
        informe.agregar("Errores de verificación", e)
    informe.escribir(salida / "informe-migracion.md")
    print(f"Paquete: {ruta_zip} ({ruta_zip.stat().st_size / 1e6:.1f} MB). Informe: {salida / 'informe-migracion.md'}")
    if errores:
        print("ERRORES:", *errores, sep="\n  ")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
