"""Construcción y verificación del paquete ZIP (formato 1, sección 5 de la especificación)."""
import json
import zipfile

from flora.limpieza import clave

FORMATO = 1
_CAMPOS_FOTO = ["id", "especieId", "orden", "ancho", "alto", "tipo", "fuente", "autor", "licencia", "url", "creadoEn"]


def _publico(registro: dict) -> dict:
    return {k: v for k, v in registro.items() if not k.startswith("_")}


def construir_zip(ruta_zip, registros: list[dict], fotos: list[dict], generado: str) -> None:
    manifest = {"formato": FORMATO, "generado": generado, "especies": len(registros), "fotos": len(fotos)}
    with zipfile.ZipFile(ruta_zip, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False))
        z.writestr("especies.json", json.dumps([_publico(r) for r in registros], ensure_ascii=False))
        z.writestr("fotos.json", json.dumps([{k: f[k] for k in _CAMPOS_FOTO} for f in fotos], ensure_ascii=False))
        for f in fotos:
            z.writestr(f"fotos/{f['id']}.webp", f["blob"], compress_type=zipfile.ZIP_STORED)
            z.writestr(f"miniaturas/{f['id']}.webp", f["miniatura"], compress_type=zipfile.ZIP_STORED)


def sin_foto(registros: list[dict], fotos: list[dict]) -> list[str]:
    con_foto = {f["especieId"] for f in fotos}
    return [r["nombre"] for r in registros if r["id"] not in con_foto]


def verificar(registros: list[dict], fotos: list[dict], esperado: int = 425, max_sin_foto: int = 5) -> list[str]:
    errores = []
    if len(registros) != esperado:
        errores.append(f"{len(registros)} registros, se esperaban {esperado}")
    claves = [clave(r["nombre"]) for r in registros]
    if len(set(claves)) != len(claves):
        errores.append("nombres repetidos")
    faltan = sin_foto(registros, fotos)
    if len(faltan) > max_sin_foto:
        errores.append(f"{len(faltan)} registros sin foto (máximo {max_sin_foto}): {faltan}")
    ids = {r["id"] for r in registros}
    huerfanas = [f["id"] for f in fotos if f["especieId"] not in ids]
    if huerfanas:
        errores.append(f"{len(huerfanas)} fotos sin especie")
    return errores


def verificar_zip(ruta_zip) -> list[str]:
    errores = []
    with zipfile.ZipFile(ruta_zip) as z:
        nombres = set(z.namelist())
        manifest = json.loads(z.read("manifest.json"))
        if manifest.get("formato") != FORMATO:
            errores.append("formato desconocido")
        especies = json.loads(z.read("especies.json"))
        fotos = json.loads(z.read("fotos.json"))
        if manifest.get("especies") != len(especies) or manifest.get("fotos") != len(fotos):
            errores.append("manifest no coincide con los listados")
        for f in fotos:
            for carpeta in ("fotos", "miniaturas"):
                if f"{carpeta}/{f['id']}.webp" not in nombres:
                    errores.append(f"falta {carpeta}/{f['id']}.webp")
    return errores
