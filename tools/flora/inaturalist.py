"""Descarga de fotos con licencia desde la API pública de iNaturalist."""
import hashlib
import json
import time
from pathlib import Path

import requests

API = "https://api.inaturalist.org/v1"
CABECERAS = {"User-Agent": "flora-pwa-migracion/1.0 (+https://github.com/j-aravena/flora-pwa)"}
LICENCIAS = {"cc0", "cc-by", "cc-by-sa", "cc-by-nc", "cc-by-nc-sa", "cc-by-nd", "cc-by-nc-nd"}
RANGOS = {"especie": {"species"}, "genero": {"genus", "subgenus", "section"}, "familia": {"family"}}
_ORDEN_RANGOS = ["species", "genus", "subgenus", "section", "family"]
CHILE = 7182
# Nombre en la base -> nombre a consultar en iNaturalist, cuando la base usa un nombre
# que iNaturalist no reconoce bajo ninguna sinonimia resoluble por matched_term.
NOMBRES_CONSULTA = {"Pentaphorus foliolosus": "Gochnatia foliolosa"}


def _rank_consulta(nivel: str) -> str:
    """Rango(s) a pedir a /taxa: uno solo para especie/familia; para género se piden
    también subgenus y section, porque la API no siempre reclasifica un género antiguo
    (p. ej. Pyrrhocactus) bajo rank=genus."""
    return ",".join(r for r in _ORDEN_RANGOS if r in RANGOS[nivel])


class Cliente:
    def __init__(self, cache_dir, pausa: float = 1.0, sesion=None):
        self.cache = Path(cache_dir)
        self.cache.mkdir(parents=True, exist_ok=True)
        self.pausa = pausa
        self.sesion = sesion or requests.Session()
        self._ultimo = 0.0

    def _get(self, url: str, params: dict | None = None) -> bytes:
        firma = hashlib.sha1((url + json.dumps(params or {}, sort_keys=True)).encode()).hexdigest()
        ruta = self.cache / firma
        if ruta.exists():
            return ruta.read_bytes()
        espera = self.pausa - (time.time() - self._ultimo)
        if espera > 0:
            time.sleep(espera)
        r = self.sesion.get(url, params=params, headers=CABECERAS, timeout=30)
        self._ultimo = time.time()
        r.raise_for_status()
        ruta.write_bytes(r.content)
        return r.content

    def json(self, ruta: str, params: dict) -> dict:
        return json.loads(self._get(API + ruta, params))

    def bytes(self, url: str) -> bytes:
        return self._get(url)


def nombre_consulta(nombre: str) -> str:
    """Nombre efectivo a enviar a iNaturalist: el mapeado en NOMBRES_CONSULTA si existe,
    o el original."""
    return NOMBRES_CONSULTA.get(nombre, nombre)


def buscar_taxon(cliente, nombre: str, nivel: str) -> int | None:
    aceptados = RANGOS[nivel]
    consulta = nombre_consulta(nombre)
    datos = cliente.json("/taxa", {"q": consulta, "rank": _rank_consulta(nivel), "per_page": 10})
    resultados = datos["results"]
    # Primera pasada: coincidencia exacta de nombre con un rango aceptado.
    for t in resultados:
        if t["name"].lower() == consulta.lower() and t["rank"] in aceptados:
            return t["id"]
    # Segunda pasada: el nombre buscado coincide con el término con el que iNaturalist
    # encontró la coincidencia (sinónimo resuelto por iNaturalist a un nombre aceptado
    # distinto), por ejemplo Aristolochia chilensis -> Aristolochia vaginans.
    for t in resultados:
        if t.get("matched_term", "").lower() == consulta.lower() and t["rank"] in aceptados:
            return t["id"]
    return None


def seleccionar_fotos(observaciones: list[dict], maximo: int = 6) -> list[dict]:
    salida = []
    for obs in observaciones:
        for foto in obs.get("photos", []):
            if foto.get("license_code") in LICENCIAS:
                salida.append({
                    "url_media": foto["url"].replace("square", "medium"),
                    "autor": foto.get("attribution", ""),
                    "licencia": foto["license_code"],
                    "url": f"https://www.inaturalist.org/observations/{obs['id']}",
                })
                break
        if len(salida) >= maximo:
            break
    return salida


def fotos_para(cliente, taxon_id: int, maximo: int = 6) -> list[dict]:
    """Candidatas de foto para un taxón (sin descargar los bytes: eso lo hace quien
    llama, foto por foto, para poder seguir ante un fallo de descarga puntual)."""
    base = {"taxon_id": taxon_id, "quality_grade": "research", "photos": "true",
            "order_by": "votes", "per_page": 30}
    fotos = seleccionar_fotos(cliente.json("/observations", base | {"place_id": CHILE})["results"], maximo)
    if not fotos:
        fotos = seleccionar_fotos(cliente.json("/observations", base)["results"], maximo)
    return fotos
