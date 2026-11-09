"""Genera un paquete incremental con un listado de sitio nuevo.

Uso: python tools/agregar_listado.py [--sin-descarga] [--salida data/build]

Lee la hoja del listado, separa las especies que ya están en el paquete inicial (a esas la
aplicación solo les suma el sitio) de las nuevas, completa las nuevas con fotos de iNaturalist
y rasgos florales, y escribe semilla/<nombre>.zip con el mismo formato que un respaldo."""
import argparse
import sys
import zipfile
import json
from datetime import datetime, timezone
from pathlib import Path

from flora import inaturalist
from flora.informe import Informe
from flora.listado import leer_hoja, registros_del_listado, separar_existentes
from flora.paquete import construir_zip, sin_foto, verificar_zip
from flora.rasgos import aplicar_rasgos, leer_colores, leer_reglas_petalos
from flora.union import inferir_familias
from migrar import completar_con_inaturalist, resumen

SITIO = "Nevado Tres Cruces"
RUTA_LISTADO = Path("data/source/Flora potencial (nevado tres cruces).xlsx")
HOJA = "Hoja2"
RUTA_SEMILLA = Path("semilla/semilla.zip")
RUTA_PAQUETE = Path("semilla/nevado-tres-cruces.zip")
RUTA_COLORES = Path("data/rasgos/nevado-color-flor.csv")
RUTA_PETALOS = Path("data/rasgos/nevado-petalos-reglas.csv")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sin-descarga", action="store_true", help="no consulta iNaturalist")
    ap.add_argument("--salida", default="data/build")
    args = ap.parse_args(argv)
    salida = Path(args.salida)
    salida.mkdir(parents=True, exist_ok=True)
    ahora = datetime.now(timezone.utc).isoformat(timespec="seconds")
    informe = Informe()

    with zipfile.ZipFile(RUTA_SEMILLA) as z:
        semilla = json.loads(z.read("especies.json"))
    registros = registros_del_listado(leer_hoja(RUTA_LISTADO, HOJA), SITIO, ahora, informe)
    nuevos, existentes = separar_existentes(registros, {e["id"] for e in semilla})
    for r in existentes:
        informe.agregar("Ya estaban en la aplicación (solo se suma el sitio)", r["nombre"])
    # inferir_familias usa todos los registros conocidos para deducir la familia por género.
    inferir_familias(semilla + nuevos, informe)
    print(f"{len(registros)} registros: {len(nuevos)} nuevos, {len(existentes)} ya existentes")

    fotos = []
    if not args.sin_descarga:
        print("Descargando fotos desde iNaturalist...")
        fotos = completar_con_inaturalist(nuevos, [], inaturalist.Cliente("data/cache"), ahora, informe)
        print(f"{len(fotos)} fotos")

    if RUTA_COLORES.exists() and RUTA_PETALOS.exists():
        print("Aplicando rasgos florales...")
        aplicar_rasgos(nuevos, fotos, leer_colores(RUTA_COLORES), leer_reglas_petalos(RUTA_PETALOS), informe)
    else:
        informe.agregar("Rasgos", "sin archivos de rasgos; campos vacíos")

    resumen(nuevos, fotos, informe)
    construir_zip(RUTA_PAQUETE, nuevos + existentes, fotos, ahora)
    errores = verificar_zip(RUTA_PAQUETE)
    faltan = sin_foto(nuevos, fotos)
    for e in errores:
        informe.agregar("Errores de verificación", e)
    informe.escribir(salida / "informe-nevado-tres-cruces.md")
    print(f"Paquete: {RUTA_PAQUETE} ({RUTA_PAQUETE.stat().st_size / 1e6:.1f} MB), {len(faltan)} sin foto")
    if errores:
        print("ERRORES:", *errores, sep="\n  ")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
