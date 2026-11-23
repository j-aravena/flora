"""Genera el paquete incremental del sitio Chacao Chonchi desde la presentación de campaña (PDF).

Uso: python tools/agregar_presentacion.py [--salida data/build]

Cada diapositiva de las páginas 18 a 202 es una especie. Las especies que ya están en la aplicación (por nombre o por
binomio) se incluyen con su id y su nombre, para que la aplicación les sume el sitio, las fotos y los datos que les falten."""
import argparse
import collections
import json
import os
import shutil
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

from flora.imagenes import crear_foto
from flora.informe import Informe
from flora.limpieza import clave
from flora.paquete import construir_zip, sin_foto, verificar_zip
from flora.presentacion import AUTOR, FAMILIAS_FALTANTES, imagenes_de_pagina, registro_desde_pagina, spans_de_pagina
from flora.union import inferir_familias

SITIO = "Chacao Chonchi"
RUTA_PDF = Path("data/source/chacao-chonchi.pdf")
PRIMERA, ULTIMA = 18, 202
RUTA_PAQUETE = Path("semilla/chacao-chonchi.zip")
EXISTENTES = [Path("semilla/semilla.zip"), Path("semilla/nevado-tres-cruces.zip")]
MINIMO = 180


def cargar_existentes() -> dict[str, dict]:
    salida = {}
    for ruta in EXISTENTES:
        with zipfile.ZipFile(ruta) as z:
            for e in json.loads(z.read("especies.json")):
                salida.setdefault(clave(e["nombre"]), e)
    return salida


def buscar_existente(nombre: str, existentes: dict[str, dict]):
    return existentes.get(clave(nombre)) or existentes.get(clave(" ".join(nombre.split()[:2])))


def paginas_de_registro(r: dict, paginas_de: dict[str, list[int]]) -> list[int]:
    return paginas_de[r["_clave"]]


def verificar(registros: list[dict], fotos: list[dict]) -> list[str]:
    errores = []
    if len(registros) < MINIMO:
        errores.append(f"{len(registros)} especies, se esperaban al menos {MINIMO}")
    if "\ufffd" in json.dumps(registros, ensure_ascii=False):
        errores.append("texto con U+FFFD")
    sin_familia = [r["nombre"] for r in registros if not r["familia"]]
    if sin_familia:
        errores.append(f"sin familia: {sin_familia}")
    faltan = sin_foto(registros, fotos)
    if faltan:
        errores.append(f"sin foto: {faltan}")
    claves = [clave(r["nombre"]) for r in registros]
    if len(set(claves)) != len(claves):
        errores.append("nombres repetidos")
    return errores


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--salida", default="data/build")
    args = ap.parse_args(argv)
    salida = Path(args.salida)
    salida.mkdir(parents=True, exist_ok=True)
    ahora = datetime.now(timezone.utc).isoformat(timespec="seconds")
    informe = Informe()
    doc = pymupdf.open(RUTA_PDF)

    # Imágenes repetidas en muchas diapositivas (fondos, logos) no son fotos de la especie.
    usos = collections.Counter()
    for n in range(PRIMERA, ULTIMA + 1):
        usos.update({i["xref"] for i in doc[n - 1].get_image_info(xrefs=True) if i.get("xref")})
    excluidos = {x for x, c in usos.items() if c > 3}

    registros, paginas_de, indice = [], {}, {}
    for n in range(PRIMERA, ULTIMA + 1):
        r, avisos = registro_desde_pagina(spans_de_pagina(doc[n - 1]), n, SITIO, ahora)
        for a in avisos:
            informe.agregar("Avisos de lectura", a)
        if r is None:
            informe.agregar("Páginas sin especie", f"p. {n}")
            continue
        k = clave(r["nombre"])
        if k in indice:
            informe.agregar("Duplicados fusionados", f"{r['nombre']}: p. {indice[k]['_pagina']} y p. {n}")
            paginas_de[k].append(n)
            continue
        indice[k] = r
        paginas_de[k] = [n]
        r["_clave"] = k  # clave del nombre del PDF, antes de renombrar a una especie existente
        registros.append(r)
        if r["_nombre_pdf"] != r["nombre"]:
            informe.agregar("Nombres limpiados", f"{r['_nombre_pdf']} → {r['nombre']}")

    existentes = cargar_existentes()
    # Las existentes aportan el conocimiento género→familia, pero solo se informa lo inferido en las nuevas.
    inferir_familias(list(existentes.values()), Informe())
    inferir_familias(list(existentes.values()) + registros, informe)
    for i, r in enumerate(registros, start=1):
        r["ordenListado"] = {SITIO: i}
        if not r["familia"]:
            r["familia"] = FAMILIAS_FALTANTES.get(r["nombre"].split()[0], "")
            if r["familia"]:
                informe.agregar("Familias asignadas a mano", f"{r['nombre']}: {r['familia']}")
        e = buscar_existente(r["nombre"], existentes)
        if e:
            informe.agregar("Ya estaban en la aplicación (se suman sitio, fotos y datos faltantes)", f"{r['nombre']} → {e['nombre']}")
            r["id"], r["nombre"] = e["id"], e["nombre"]

    fotos = []
    for r in registros:
        orden = 0
        for n in paginas_de_registro(r, paginas_de):
            for im in imagenes_de_pagina(doc, doc[n - 1], excluidos):
                fotos.append(crear_foto(r["id"], im, "presentacion", orden, ahora, autor=AUTOR))
                orden += 1
        informe.agregar("Fotos extraídas", f"{r['nombre']}: {orden}")

    errores = verificar(registros, fotos)
    temporal = RUTA_PAQUETE.with_name(RUTA_PAQUETE.name + ".tmp")
    construir_zip(temporal, registros, fotos, ahora)
    errores += verificar_zip(temporal)
    for e in errores:
        informe.agregar("Errores de verificación", e)
    informe.escribir(salida / "informe-chacao-chonchi.md")
    shutil.copy(salida / "informe-chacao-chonchi.md", "docs/informe-chacao-chonchi.md")
    if errores:
        temporal.unlink(missing_ok=True)
        print("ERRORES:", *errores, sep="\n  ")
        return 1
    os.replace(temporal, RUTA_PAQUETE)
    print(f"{len(registros)} especies, {len(fotos)} fotos, paquete {RUTA_PAQUETE.stat().st_size / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
