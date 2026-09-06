"""Acumulador del informe de migración."""
from pathlib import Path


class Informe:
    def __init__(self):
        self.secciones: dict[str, list[str]] = {}

    def agregar(self, seccion: str, linea: str) -> None:
        self.secciones.setdefault(seccion, []).append(linea)

    def escribir(self, ruta) -> None:
        lineas = ["# Informe de migración", ""]
        for seccion, items in self.secciones.items():
            lineas += [f"## {seccion} ({len(items)})", ""] + [f"- {x}" for x in items] + [""]
        Path(ruta).write_text("\n".join(lineas), encoding="utf-8")
