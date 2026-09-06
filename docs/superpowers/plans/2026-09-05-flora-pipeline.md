# Pipeline de migración de flora. Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir las dos planillas Excel de origen en el paquete inicial `semilla/semilla.zip` con 426 registros de flora y sus fotos, más un informe de migración.

**Architecture:** Paquete Python `tools/flora/` con un módulo por etapa (lectura, limpieza, unión, imágenes, iNaturalist, paquete) y un orquestador `tools/migrar.py`. Cada módulo expone funciones puras o con dependencias inyectables, probadas con pytest sobre datos sintéticos. El formato de salida es el mismo ZIP que la aplicación importa como respaldo.

**Tech Stack:** Python 3.14 en entorno virtual `.venv`, openpyxl, Pillow, numpy, requests, pytest.

**Spec:** `docs/superpowers/specs/2026-09-05-flora-pwa-design.md` (secciones 4, 5 y 8).

## Global Constraints

- Todo texto de código, comentarios, mensajes y commits en español neutro. Sin chilenismos ni argentinismos.
- Cada commit termina con las dos líneas `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_01TYRxdE3Enu9eAVFiapHpSx`.
- Los archivos de origen están en `data/source/` (ignorada por git): `stp y las tortolas.xlsx` (784 MB) y `Flora potencial (prefactibilidad).xlsx`. No se modifican.
- Salidas en `data/build/` (ignorada por git). Caché HTTP en `data/cache/` (ignorada por git).
- Fotos: WebP calidad 80, lado mayor 1200 px. Miniaturas: WebP, lado mayor 200 px.
- Verificación final: 426 registros, nombres únicos, a lo más 5 registros sin foto.
- Licencias aceptadas de iNaturalist: `cc0`, `cc-by`, `cc-by-sa`, `cc-by-nc`, `cc-by-nc-sa`, `cc-by-nd`, `cc-by-nc-nd`. Una solicitud por segundo.
- Todos los comandos se ejecutan desde `~/dev/flora-pwa` con el entorno virtual activo (`source .venv/bin/activate`).

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `tools/requirements.txt` | Dependencias del pipeline. |
| `tools/flora/__init__.py` | Vacío. |
| `tools/flora/limpieza.py` | Normalización de textos, categorías, nombres y niveles. Funciones puras. |
| `tools/flora/lectura.py` | Lectura de las dos planillas a listas de diccionarios. |
| `tools/flora/union.py` | Conversión de filas a registros del modelo, fusión de duplicados y unión con prefactibilidad. |
| `tools/flora/informe.py` | Acumulador de líneas del informe de migración. |
| `tools/flora/imagenes.py` | Extracción de imágenes en celda del xlsx, corte de tiras, conversión a WebP, registro de foto. |
| `tools/flora/inaturalist.py` | Cliente con caché y ritmo, búsqueda de taxón, selección y descarga de fotos. |
| `tools/flora/paquete.py` | Construcción del ZIP, verificación. |
| `tools/migrar.py` | Orquestador de línea de comandos. |
| `tools/tests/test_*.py` | Pruebas pytest. |

---

### Task 1: Entorno y esqueleto del paquete

**Files:**
- Create: `tools/requirements.txt`, `tools/flora/__init__.py`, `tools/tests/__init__.py`, `tools/tests/test_entorno.py`, `pytest.ini`

**Interfaces:**
- Produces: entorno virtual `.venv` con las dependencias; `pytest` ejecutable desde la raíz.

- [ ] **Step 1: Crear el entorno virtual e instalar dependencias**

```bash
cd ~/dev/flora-pwa
python3 -m venv .venv
source .venv/bin/activate
cat > tools/requirements.txt <<'REQ'
openpyxl==3.1.5
Pillow==12.2.0
numpy==2.4.4
requests==2.32.5
pytest==9.0.2
REQ
pip install -r tools/requirements.txt
```

Si alguna versión fija no existe en PyPI, usar la más reciente de la misma versión mayor y actualizar el archivo.

- [ ] **Step 2: Crear esqueleto y prueba de entorno**

```bash
mkdir -p tools/flora tools/tests
touch tools/flora/__init__.py tools/tests/__init__.py
cat > pytest.ini <<'INI'
[pytest]
testpaths = tools/tests
pythonpath = tools
INI
```

`tools/tests/test_entorno.py`:

```python
def test_dependencias_importan():
    import openpyxl, PIL, numpy, requests  # noqa: F401
    from PIL import features
    assert features.check("webp")
```

- [ ] **Step 3: Ejecutar la prueba**

Run: `pytest -q`
Expected: `1 passed`

- [ ] **Step 4: Commit**

```bash
git add tools/requirements.txt tools/flora/__init__.py tools/tests/__init__.py tools/tests/test_entorno.py pytest.ini
git commit -m "Entorno del pipeline de migración" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TYRxdE3Enu9eAVFiapHpSx"
```

---

### Task 2: Funciones de limpieza

**Files:**
- Create: `tools/flora/limpieza.py`
- Test: `tools/tests/test_limpieza.py`

**Interfaces:**
- Produces:
  - `limpiar_texto(v) -> str`: recorta espacios; `None` y `"-"` devuelven `""`.
  - `clave(nombre: str) -> str`: minúsculas, sin tildes, espacios simples. Se usa para comparar nombres.
  - `normalizar_categoria(v) -> str`, `normalizar_habito(v) -> str`, `normalizar_ciclo(v) -> str`, `normalizar_ds68(v) -> bool`, `dividir_distribucion(v) -> list[str]`.
  - `nivel_y_nombre(nombre) -> tuple[str, str]`: devuelve `("especie" | "genero" | "familia", nombre_limpio)` aplicando `CORRECCIONES_NOMBRE`.
  - Constantes `SINONIMOS`, `CORRECCIONES_NOMBRE`, `RESOLUCIONES_ORIGEN`.

- [ ] **Step 1: Escribir las pruebas**

`tools/tests/test_limpieza.py`:

```python
from flora.limpieza import (
    limpiar_texto, clave, normalizar_categoria, normalizar_habito, normalizar_ciclo,
    normalizar_ds68, dividir_distribucion, nivel_y_nombre,
)


def test_limpiar_texto_recorta_y_vacia_guion():
    assert limpiar_texto("  Hierba ") == "Hierba"
    assert limpiar_texto("-") == ""
    assert limpiar_texto(None) == ""


def test_clave_ignora_mayusculas_tildes_y_espacios():
    assert clave("  Adesmia  CONFUSA ") == "adesmia confusa"
    assert clave("Árbol") == "arbol"


def test_normalizar_categoria_unifica_variantes():
    assert normalizar_categoria("LC") == "Preocupación Menor"
    assert normalizar_categoria(" Preocupación menor") == "Preocupación Menor"
    assert normalizar_categoria("Casi amenazada") == "Casi amenazada"
    assert normalizar_categoria("-") == ""


def test_normalizar_habito_pone_minuscula_en_segunda_palabra():
    assert normalizar_habito("Hierba Anual") == "Hierba anual"
    assert normalizar_habito("Hierba Perenne") == "Hierba perenne"
    assert normalizar_habito("Árbol") == "Árbol"
    assert normalizar_habito(None) == ""


def test_normalizar_ciclo():
    assert normalizar_ciclo(" Anual o bienal") == "Anual o bienal"
    assert normalizar_ciclo("Perenne") == "Perenne"
    assert normalizar_ciclo(None) == ""


def test_normalizar_ds68_acepta_x_y_originaria():
    assert normalizar_ds68("X") is True
    assert normalizar_ds68("Originaria") is True
    assert normalizar_ds68("-") is False
    assert normalizar_ds68(None) is False


def test_dividir_distribucion():
    assert dividir_distribucion(" COQ- VAL- RME- LBO") == ["COQ", "VAL", "RME", "LBO"]
    assert dividir_distribucion(" AYP- TAR- MAG-") == ["AYP", "TAR", "MAG"]
    assert dividir_distribucion(None) == []


def test_nivel_y_nombre_detecta_genero_familia_y_corrige():
    assert nivel_y_nombre("Adesmia confusa") == ("especie", "Adesmia confusa")
    assert nivel_y_nombre("Dioscorea sp.") == ("genero", "Dioscorea")
    assert nivel_y_nombre("Lycium sp") == ("genero", "Lycium")
    assert nivel_y_nombre("Pyrrhocactus ") == ("genero", "Pyrrhocactus")
    assert nivel_y_nombre("Fabaceae") == ("familia", "Fabaceae")
    assert nivel_y_nombre("Schinus montanas") == ("especie", "Schinus montanus")
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `pytest -q tools/tests/test_limpieza.py`
Expected: FAIL con `ModuleNotFoundError: No module named 'flora.limpieza'`

- [ ] **Step 3: Implementar**

`tools/flora/limpieza.py`:

```python
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
CORRECCIONES_NOMBRE = {"Schinus montanas": "Schinus montanus"}
# Nombre en prefactibilidad -> nombre en la base.
SINONIMOS = {"Tetraglochin alata": "Tetraglochin alatum"}
# Origen que prevalece cuando las dos planillas discrepan.
RESOLUCIONES_ORIGEN = {"Proustia cuneifolia": "Nativa"}


def limpiar_texto(v) -> str:
    if v is None:
        return ""
    s = str(v).strip()
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
```

- [ ] **Step 4: Ejecutar las pruebas**

Run: `pytest -q tools/tests/test_limpieza.py`
Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/flora/limpieza.py tools/tests/test_limpieza.py
git commit -m "Pipeline: funciones de limpieza" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TYRxdE3Enu9eAVFiapHpSx"
```

---

### Task 3: Lectura de las planillas

**Files:**
- Create: `tools/flora/lectura.py`
- Test: `tools/tests/test_lectura.py`

**Interfaces:**
- Produces:
  - `leer_base(ruta) -> list[dict]`: una entrada por fila no vacía de `Hoja1`, claves iguales al encabezado (la columna sin encabezado se llama `col_T`), más `_fila` con el número de fila de Excel. Se detiene tras 500 filas vacías consecutivas.
  - `leer_prefactibilidad(ruta) -> list[dict]`: igual sobre la hoja activa, sin corte anticipado.
  - Constante `COLS_NOTAS`: lista de columnas de la base que se concatenan en `notas`.

- [ ] **Step 1: Escribir las pruebas**

`tools/tests/test_lectura.py`:

```python
import openpyxl
from flora.lectura import leer_base, leer_prefactibilidad


def _planilla(tmp_path, nombre_hoja, filas):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = nombre_hoja
    for fila in filas:
        ws.append(fila)
    ruta = tmp_path / "p.xlsx"
    wb.save(ruta)
    return ruta


def test_leer_base_salta_vacias_y_numera_filas(tmp_path):
    ruta = _planilla(tmp_path, "Hoja1", [
        ["Especie", "Familia", None],
        ["Adesmia confusa", "Fabaceae", "cardo"],
        [None, None, None],
        ["Avena barbata", "Poaceae", None],
    ])
    filas = leer_base(ruta)
    assert [f["Especie"] for f in filas] == ["Adesmia confusa", "Avena barbata"]
    assert [f["_fila"] for f in filas] == [2, 4]
    assert filas[0]["col_T"] == "cardo"


def test_leer_prefactibilidad(tmp_path):
    ruta = _planilla(tmp_path, "Hoja2", [
        ["Especie", "Origen", "Hábito", "D.S.N°68/2009", "RCE"],
        ["Cordia decandra", "Endémica", "Árbol", "Originaria", "Casi amenazada"],
    ])
    filas = leer_prefactibilidad(ruta)
    assert len(filas) == 1
    assert filas[0]["RCE"] == "Casi amenazada"
    assert filas[0]["_fila"] == 2
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `pytest -q tools/tests/test_lectura.py`
Expected: FAIL con `ModuleNotFoundError`

- [ ] **Step 3: Implementar**

`tools/flora/lectura.py`:

```python
"""Lectura de las planillas de origen a listas de diccionarios."""
import openpyxl

COLS_NOTAS = [
    "Fotos propias o naturalist",
    "dato random (aveces relacionado con la imagen anterior, aveces no)",
    "Intento de asociacion mental",
    "col_T",
]
_MAX_VACIAS = 500


def _fila_vacia(fila) -> bool:
    return not any(v is not None and str(v).strip() for v in fila)


def _leer(ws, corte_vacias: int | None) -> list[dict]:
    filas = ws.iter_rows(values_only=True)
    encabezado = [h if h is not None else "col_T" for h in next(filas)]
    salida, vacias = [], 0
    for i, fila in enumerate(filas, start=2):
        if _fila_vacia(fila):
            vacias += 1
            if corte_vacias and vacias >= corte_vacias:
                break
            continue
        vacias = 0
        d = dict(zip(encabezado, fila))
        d["_fila"] = i
        salida.append(d)
    return salida


def leer_base(ruta) -> list[dict]:
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    return _leer(wb["Hoja1"], _MAX_VACIAS)


def leer_prefactibilidad(ruta) -> list[dict]:
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    return _leer(wb.active, None)
```

- [ ] **Step 4: Ejecutar las pruebas**

Run: `pytest -q tools/tests/test_lectura.py`
Expected: `2 passed`

- [ ] **Step 5: Verificar contra los archivos reales**

Run:
```bash
PYTHONPATH=tools python3 -c "
from flora.lectura import leer_base, leer_prefactibilidad
b = leer_base('data/source/stp y las tortolas.xlsx'); p = leer_prefactibilidad('data/source/Flora potencial (prefactibilidad).xlsx')
print(len(b), len(p), b[0]['Especie'], b[-1]['_fila'])"
```
Expected: `392 67 Acaena pinnatifida 393`

- [ ] **Step 6: Commit**

```bash
git add tools/flora/lectura.py tools/tests/test_lectura.py
git commit -m "Pipeline: lectura de planillas" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TYRxdE3Enu9eAVFiapHpSx"
```

---

### Task 4: Informe y unión de registros

**Files:**
- Create: `tools/flora/informe.py`, `tools/flora/union.py`
- Test: `tools/tests/test_union.py`

**Interfaces:**
- Produces:
  - `Informe`: `agregar(seccion: str, linea: str)`, `escribir(ruta)`, atributo `secciones: dict[str, list[str]]`.
  - `id_para(nombre: str) -> str`: UUID v5 determinista a partir de `clave(nombre)`.
  - `registro_desde_base(fila: dict, ahora: str) -> dict`: registro del modelo de la sección 4.1 más la clave privada `_filas: list[int]`.
  - `registro_desde_prefactibilidad(fila: dict, ahora: str) -> dict`.
  - `fusionar_duplicados(registros, informe) -> list[dict]`.
  - `unir(base: list[dict], pref: list[dict], ahora: str, informe) -> list[dict]`.

- [ ] **Step 1: Escribir las pruebas**

`tools/tests/test_union.py`:

```python
from flora.informe import Informe
from flora.union import (
    id_para, registro_desde_base, registro_desde_prefactibilidad, fusionar_duplicados, unir,
)

AHORA = "2026-09-05T00:00:00+00:00"


def _fila_base(**kw):
    base = {
        "Especie": "Adesmia confusa", "Familia": "Fabaceae ", "Origen": "Endémica",
        "Hábito de crecimiento": "Arbusto", "Habito": " Arbusto", "Ciclo de vida": "Perenne",
        "Categoría de conservación (MMA)": "-", "Decreto supremo": "-", "D.S.68": "X",
        "Distribución": " COQ- VAL- RME- LBO", "Rango altitudinal": "0-1800 m.",
        "Las tortolas": "Las Tortolas", "STP": "STP", "Aprendizaje": "si", "Fotos": "#VALUE!",
        "Fotos propias o naturalist": None,
        "dato random (aveces relacionado con la imagen anterior, aveces no)": "hojas pinnadas",
        "Intento de asociacion mental": None, "col_T": None, "_fila": 7,
    }
    base.update(kw)
    return base


def test_id_es_determinista_y_uuid():
    assert id_para("Adesmia confusa") == id_para(" adesmia CONFUSA ")
    assert len(id_para("Adesmia confusa")) == 36


def test_registro_desde_base_mapea_campos():
    r = registro_desde_base(_fila_base(), AHORA)
    assert r["nombre"] == "Adesmia confusa" and r["nivel"] == "especie"
    assert r["familia"] == "Fabaceae" and r["habito"] == "Arbusto" and r["habitoDetalle"] == "Arbusto"
    assert r["ds68"] is True and r["categoriaMMA"] == "" and r["decreto"] == ""
    assert r["distribucion"] == ["COQ", "VAL", "RME", "LBO"]
    assert r["sitios"] == ["Las Tórtolas", "STP"]
    assert r["aprendizaje"] == "se" and r["notas"] == "hojas pinnadas"
    assert r["aciertos"] == 0 and r["fallos"] == 0 and r["rachaAciertos"] == 0
    assert r["ultimoEstudio"] is None and r["creadoEn"] == AHORA
    assert r["_filas"] == [7]


def test_registro_solo_stp_sin_aprendizaje():
    r = registro_desde_base(_fila_base(**{"Las tortolas": None, "Aprendizaje": None}), AHORA)
    assert r["sitios"] == ["STP"] and r["aprendizaje"] is None


def test_fusionar_duplicados_conserva_primera_y_anota_decreto():
    a = registro_desde_base(_fila_base(**{"Especie": "Adiantum chilense", "Decreto supremo": "D.S. N° 19/2012", "_fila": 12}), AHORA)
    b = registro_desde_base(_fila_base(**{"Especie": "Adiantum chilense", "Decreto supremo": "D.S. N° 38/2015", "_fila": 13, "Las tortolas": None}), AHORA)
    inf = Informe()
    salida = fusionar_duplicados([a, b], inf)
    assert len(salida) == 1
    assert salida[0]["decreto"] == "D.S. N° 19/2012"
    assert "También citada en D.S. N° 38/2015" in salida[0]["notas"]
    assert salida[0]["_filas"] == [12, 13]
    assert salida[0]["sitios"] == ["Las Tórtolas", "STP"]
    assert inf.secciones["Duplicados fusionados"]


def test_unir_agrega_sitio_crea_nuevos_y_aplica_sinonimos():
    base = [
        registro_desde_base(_fila_base(), AHORA),
        registro_desde_base(_fila_base(Especie="Tetraglochin alatum"), AHORA),
        registro_desde_base(_fila_base(Especie="Proustia cuneifolia"), AHORA),
    ]
    pref = [
        {"Especie": "Adesmia confusa", "Origen": "Endémica", "Hábito": "Arbusto", "D.S.N°68/2009": "Originaria", "RCE": "-", "_fila": 2},
        {"Especie": "Tetraglochin alata", "Origen": "Nativa", "Hábito": "Arbusto", "D.S.N°68/2009": "-", "RCE": "-", "_fila": 3},
        {"Especie": "Proustia cuneifolia", "Origen": "Nativa", "Hábito": "Arbusto", "D.S.N°68/2009": "-", "RCE": "-", "_fila": 4},
        {"Especie": "Cordia decandra", "Origen": "Endémica", "Hábito": "Árbol", "D.S.N°68/2009": "Originaria", "RCE": "Casi amenazada", "_fila": 5},
        {"Especie": "Haplopappus sp", "Origen": "-", "Hábito": "-", "D.S.N°68/2009": "-", "RCE": "-", "_fila": 6},
    ]
    inf = Informe()
    salida = unir(base, pref, AHORA, inf)
    por_nombre = {r["nombre"]: r for r in salida}
    assert len(salida) == 5
    assert por_nombre["Adesmia confusa"]["sitios"] == ["Las Tórtolas", "STP", "Prefactibilidad"]
    assert por_nombre["Tetraglochin alatum"]["sitios"][-1] == "Prefactibilidad"
    assert por_nombre["Proustia cuneifolia"]["origen"] == "Nativa"
    nuevo = por_nombre["Cordia decandra"]
    assert nuevo["sitios"] == ["Prefactibilidad"] and nuevo["ds68"] is True
    assert nuevo["categoriaMMA"] == "Casi amenazada" and nuevo["habito"] == "Árbol"
    assert por_nombre["Haplopappus"]["nivel"] == "genero"
    assert inf.secciones["Conflictos de origen"]


def test_registro_desde_prefactibilidad_ignora_guiones():
    r = registro_desde_prefactibilidad({"Especie": "Fabaceae", "Origen": "-", "Hábito": "-", "D.S.N°68/2009": "-", "RCE": "-", "_fila": 31}, AHORA)
    assert r["nivel"] == "familia" and r["origen"] == "" and r["habito"] == "" and r["ds68"] is False
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `pytest -q tools/tests/test_union.py`
Expected: FAIL con `ModuleNotFoundError`

- [ ] **Step 3: Implementar el informe**

`tools/flora/informe.py`:

```python
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
```

- [ ] **Step 4: Implementar la unión**

`tools/flora/union.py`:

```python
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
        "notas": "", "creadoEn": ahora, "modificadoEn": ahora, "_filas": [],
    }


def registro_desde_base(fila: dict, ahora: str) -> dict:
    nivel, nombre = nivel_y_nombre(fila["Especie"])
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


def registro_desde_prefactibilidad(fila: dict, ahora: str) -> dict:
    nombre = limpiar_texto(fila["Especie"])
    nivel, nombre = nivel_y_nombre(SINONIMOS.get(nombre, nombre))
    r = _base_registro(nombre, nivel, ahora)
    r.update({
        "origen": limpiar_texto(fila.get("Origen")),
        "habito": normalizar_habito(fila.get("Hábito")),
        "ds68": normalizar_ds68(fila.get("D.S.N°68/2009")),
        "categoriaMMA": normalizar_categoria(fila.get("RCE")),
        "sitios": ["Prefactibilidad"],
        "_filas": [fila["_fila"]],
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
        nuevo = registro_desde_prefactibilidad(fila, ahora)
        k = clave(nuevo["nombre"])
        existente = indice.get(k)
        if existente is None:
            indice[k] = nuevo
            salida.append(nuevo)
            continue
        if "Prefactibilidad" not in existente["sitios"]:
            existente["sitios"].append("Prefactibilidad")
        existente["_filas"] += nuevo["_filas"]
        if nuevo["origen"] and existente["origen"] and clave(nuevo["origen"]) != clave(existente["origen"]):
            resuelto = RESOLUCIONES_ORIGEN.get(existente["nombre"], existente["origen"])
            informe.agregar("Conflictos de origen",
                            f"{existente['nombre']}: base={existente['origen']}, prefactibilidad={nuevo['origen']}, se conserva {resuelto}")
            existente["origen"] = resuelto
    return salida
```

- [ ] **Step 5: Ejecutar las pruebas**

Run: `pytest -q tools/tests/test_union.py`
Expected: `6 passed`

- [ ] **Step 6: Verificar el conteo con los archivos reales**

Run:
```bash
PYTHONPATH=tools python3 -c "
from flora.lectura import leer_base, leer_prefactibilidad
from flora.union import registro_desde_base, fusionar_duplicados, unir
from flora.informe import Informe
inf = Informe()
base = fusionar_duplicados([registro_desde_base(f, 'x') for f in leer_base('data/source/stp y las tortolas.xlsx')], inf)
todos = unir(base, leer_prefactibilidad('data/source/Flora potencial (prefactibilidad).xlsx'), 'x', inf)
print(len(base), len(todos), inf.secciones)"
```
Expected: `391 426` y un conflicto de origen para Proustia cuneifolia. Si el total no es 426, listar los nombres nuevos y revisar sinónimos antes de seguir; no ajustar la constante de verificación.

- [ ] **Step 7: Commit**

```bash
git add tools/flora/informe.py tools/flora/union.py tools/tests/test_union.py
git commit -m "Pipeline: unión de planillas y fusión de duplicados" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TYRxdE3Enu9eAVFiapHpSx"
```

---

### Task 5: Extracción y corte de imágenes

**Files:**
- Create: `tools/flora/imagenes.py`
- Test: `tools/tests/test_imagenes.py`

**Interfaces:**
- Produces:
  - `mapa_celdas_imagen(ruta_xlsx) -> dict[tuple[str, int], bytes]`: `{("O", 2): png_bytes, ...}`.
  - `cortar_tira(png: bytes, umbral=235, ancho_min=50) -> list[PIL.Image.Image]`.
  - `a_webp(im, lado_max, calidad=80) -> tuple[bytes, int, int]`.
  - `crear_foto(especie_id, im, fuente, orden, ahora, autor="", licencia="", url="") -> dict` con las claves de la sección 4.2 más `tipo` (`"image/webp"`), `blob` (bytes) y `miniatura` (bytes).

- [ ] **Step 1: Escribir las pruebas**

`tools/tests/test_imagenes.py`:

```python
import io
from pathlib import Path

import pytest
from PIL import Image

from flora.imagenes import a_webp, cortar_tira, crear_foto, mapa_celdas_imagen

RUTA_BASE = Path("data/source/stp y las tortolas.xlsx")


def _tira(n=6, ancho=400, alto=320, hueco=30) -> bytes:
    im = Image.new("RGB", (n * ancho + (n - 1) * hueco, alto), "white")
    for i in range(n):
        color = (200, 30 + 30 * i, 60)
        im.paste(color, (i * (ancho + hueco), 0, i * (ancho + hueco) + ancho, alto))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def test_cortar_tira_devuelve_seis_fotos():
    piezas = cortar_tira(_tira())
    assert len(piezas) == 6
    assert all(p.size == (400, 320) for p in piezas)


def test_cortar_tira_sin_huecos_devuelve_una():
    assert len(cortar_tira(_tira(n=1))) == 1


def test_a_webp_reduce_y_conserva_proporcion():
    im = Image.new("RGB", (2400, 1200), "green")
    datos, w, h = a_webp(im, 1200)
    assert (w, h) == (1200, 600)
    assert Image.open(io.BytesIO(datos)).format == "WEBP"
    datos2, w2, h2 = a_webp(im, 200)
    assert (w2, h2) == (200, 100)


def test_crear_foto_tiene_campos_y_es_determinista():
    im = Image.new("RGB", (640, 480), "blue")
    f = crear_foto("esp-1", im, "planilla", 0, "2026-09-05T00:00:00+00:00")
    g = crear_foto("esp-1", im, "planilla", 0, "2026-09-05T00:00:00+00:00")
    assert f["id"] == g["id"] and len(f["id"]) == 36
    assert f["especieId"] == "esp-1" and f["orden"] == 0 and f["tipo"] == "image/webp"
    assert (f["ancho"], f["alto"]) == (640, 480) and f["fuente"] == "planilla"
    assert f["autor"] == "" and f["licencia"] == "" and f["url"] == ""
    assert isinstance(f["blob"], bytes) and isinstance(f["miniatura"], bytes)
    assert crear_foto("esp-1", im, "planilla", 1, "x")["id"] != f["id"]


@pytest.mark.skipif(not RUTA_BASE.exists(), reason="planilla de origen no disponible")
def test_mapa_celdas_imagen_sobre_planilla_real():
    mapa = mapa_celdas_imagen(RUTA_BASE)
    assert len(mapa) == 388
    assert ("O", 2) in mapa and ("Q", 78) in mapa
    assert mapa[("O", 2)][:8] == b"\x89PNG\r\n\x1a\n"
    assert len(set(mapa.values())) == 388
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `pytest -q tools/tests/test_imagenes.py`
Expected: FAIL con `ModuleNotFoundError`

- [ ] **Step 3: Implementar**

`tools/flora/imagenes.py`:

```python
"""Imágenes en celda del xlsx, corte de tiras y conversión a WebP."""
import io
import re
import uuid
import zipfile

import numpy as np
from PIL import Image

_NS_FOTO = uuid.UUID("a3d1f0c2-7b6e-4e5a-8c9d-1e2f3a4b5c6d")


def mapa_celdas_imagen(ruta_xlsx) -> dict[tuple[str, int], bytes]:
    """Resuelve la cadena celda(vm) -> metadata -> richvalue -> relación -> media."""
    z = zipfile.ZipFile(ruta_xlsx)
    hoja = z.read("xl/worksheets/sheet1.xml").decode()
    celdas = re.findall(r'<c r="([A-Z]+)(\d+)"[^>]*? vm="(\d+)"', hoja)
    meta = z.read("xl/metadata.xml").decode()
    rvb = [int(i) for i in re.findall(r'<xlrd:rvb i="(\d+)"', meta)]
    rv = z.read("xl/richData/rdrichvalue.xml").decode()
    valores = re.findall(r"<rv s=\"0\"><v>(\d+)</v><v>(\d+)</v></rv>", rv)
    rels = re.findall(r'<rel r:id="(rId\d+)"', z.read("xl/richData/richValueRel.xml").decode())
    destinos = dict(re.findall(
        r'Id="(rId\d+)"[^>]*Target="\.\./media/([^"]+)"',
        z.read("xl/richData/_rels/richValueRel.xml.rels").decode()))
    salida = {}
    for col, fila, vm in celdas:
        indice_rv = rvb[int(vm) - 1]
        indice_imagen = int(valores[indice_rv][0])
        archivo = destinos[rels[indice_imagen]]
        salida[(col, int(fila))] = z.read("xl/media/" + archivo)
    return salida


def cortar_tira(png: bytes, umbral: int = 235, ancho_min: int = 50) -> list[Image.Image]:
    """Corta por columnas de píxeles blancos. Devuelve una lista de recortes."""
    im = Image.open(io.BytesIO(png)).convert("RGB")
    a = np.asarray(im)
    blanca = (a.min(axis=2) > umbral).all(axis=0)
    segmentos, inicio = [], None
    for x, b in enumerate(blanca):
        if not b and inicio is None:
            inicio = x
        elif b and inicio is not None:
            segmentos.append((inicio, x))
            inicio = None
    if inicio is not None:
        segmentos.append((inicio, len(blanca)))
    segmentos = [s for s in segmentos if s[1] - s[0] > ancho_min]
    if not segmentos:
        return [im]
    return [im.crop((x0, 0, x1, im.height)) for x0, x1 in segmentos]


def a_webp(im: Image.Image, lado_max: int, calidad: int = 80) -> tuple[bytes, int, int]:
    im = im.convert("RGB")
    im.thumbnail((lado_max, lado_max))
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=calidad)
    return buf.getvalue(), im.width, im.height


def crear_foto(especie_id: str, im: Image.Image, fuente: str, orden: int, ahora: str,
               autor: str = "", licencia: str = "", url: str = "") -> dict:
    blob, ancho, alto = a_webp(im, 1200)
    miniatura, _, _ = a_webp(im, 200)
    return {
        "id": str(uuid.uuid5(_NS_FOTO, f"{especie_id}:{fuente}:{orden}")),
        "especieId": especie_id, "orden": orden, "ancho": ancho, "alto": alto,
        "tipo": "image/webp", "fuente": fuente, "autor": autor, "licencia": licencia, "url": url,
        "creadoEn": ahora, "blob": blob, "miniatura": miniatura,
    }
```

- [ ] **Step 4: Ejecutar las pruebas**

Run: `pytest -q tools/tests/test_imagenes.py`
Expected: `5 passed` (la última tarda unos segundos por el tamaño del xlsx)

- [ ] **Step 5: Commit**

```bash
git add tools/flora/imagenes.py tools/tests/test_imagenes.py
git commit -m "Pipeline: extracción y corte de imágenes" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TYRxdE3Enu9eAVFiapHpSx"
```

---

### Task 6: Cliente de iNaturalist

**Files:**
- Create: `tools/flora/inaturalist.py`
- Test: `tools/tests/test_inaturalist.py`

**Interfaces:**
- Produces:
  - `Cliente(cache_dir, pausa=1.0, sesion=None)` con `json(ruta, params) -> dict` y `bytes(url) -> bytes`. Cachea cada respuesta en disco por hash de URL y parámetros.
  - `buscar_taxon(cliente, nombre, nivel) -> int | None`.
  - `seleccionar_fotos(observaciones, maximo=6) -> list[dict]` (pura): dicts con `url_media`, `autor`, `licencia`, `url`.
  - `fotos_para(cliente, taxon_id, maximo=6) -> list[dict]`: como `seleccionar_fotos` más la clave `bytes`.

- [ ] **Step 1: Escribir las pruebas**

`tools/tests/test_inaturalist.py`:

```python
from flora.inaturalist import Cliente, buscar_taxon, fotos_para, seleccionar_fotos


class ClienteFalso:
    def __init__(self, respuestas):
        self.respuestas = respuestas
        self.llamadas = []

    def json(self, ruta, params):
        self.llamadas.append((ruta, dict(params)))
        return self.respuestas[(ruta, params.get("place_id"))]

    def bytes(self, url):
        return b"IMG:" + url.encode()


def _obs(id_, fotos):
    return {"id": id_, "photos": [{"url": f"https://x/photos/{i}/square.jpg", "license_code": lic, "attribution": f"(c) autor {i}"} for i, lic in fotos]}


def test_seleccionar_fotos_filtra_licencias_y_una_por_observacion():
    obs = [
        _obs(1, [(10, None), (11, "cc-by")]),
        _obs(2, [(20, "cc-by-nc"), (21, "cc0")]),
        _obs(3, [(30, None)]),
    ]
    fotos = seleccionar_fotos(obs, maximo=6)
    assert [f["url_media"] for f in fotos] == ["https://x/photos/11/medium.jpg", "https://x/photos/20/medium.jpg"]
    assert fotos[0]["licencia"] == "cc-by" and fotos[0]["autor"] == "(c) autor 11"
    assert fotos[0]["url"] == "https://www.inaturalist.org/observations/1"


def test_seleccionar_fotos_respeta_maximo():
    obs = [_obs(i, [(i, "cc0")]) for i in range(10)]
    assert len(seleccionar_fotos(obs, maximo=6)) == 6


def test_buscar_taxon_exige_coincidencia_exacta():
    c = ClienteFalso({("/taxa", None): {"results": [
        {"id": 1, "name": "Cordia decandra", "rank": "species"},
        {"id": 2, "name": "Cordia", "rank": "genus"},
    ]}})
    assert buscar_taxon(c, "Cordia decandra", "especie") == 1
    assert buscar_taxon(c, "Cordia", "genero") == 2
    assert buscar_taxon(c, "Cordia decandra", "genero") is None
    assert c.llamadas[0][1]["rank"] == "species"


def test_fotos_para_reintenta_sin_chile_y_descarga():
    c = ClienteFalso({
        ("/observations", 7182): {"results": []},
        ("/observations", None): {"results": [_obs(5, [(50, "cc-by")])]},
    })
    fotos = fotos_para(c, 99)
    assert len(fotos) == 1 and fotos[0]["bytes"] == b"IMG:https://x/photos/50/medium.jpg"
    assert c.llamadas[0][1]["place_id"] == 7182 and "place_id" not in c.llamadas[1][1]
    assert c.llamadas[0][1]["quality_grade"] == "research"


def test_cliente_cachea_en_disco(tmp_path):
    class Resp:
        content = b'{"ok": 1}'
        def raise_for_status(self): pass
    class Sesion:
        n = 0
        def get(self, url, params=None, headers=None, timeout=None):
            self.n += 1
            return Resp()
    s = Sesion()
    c = Cliente(tmp_path, pausa=0, sesion=s)
    assert c.json("/taxa", {"q": "a"}) == {"ok": 1}
    assert c.json("/taxa", {"q": "a"}) == {"ok": 1}
    assert s.n == 1
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `pytest -q tools/tests/test_inaturalist.py`
Expected: FAIL con `ModuleNotFoundError`

- [ ] **Step 3: Implementar**

`tools/flora/inaturalist.py`:

```python
"""Descarga de fotos con licencia desde la API pública de iNaturalist."""
import hashlib
import json
import time
from pathlib import Path

import requests

API = "https://api.inaturalist.org/v1"
CABECERAS = {"User-Agent": "flora-pwa-migracion/1.0 (uso personal de estudio)"}
LICENCIAS = {"cc0", "cc-by", "cc-by-sa", "cc-by-nc", "cc-by-nc-sa", "cc-by-nd", "cc-by-nc-nd"}
RANGO = {"especie": "species", "genero": "genus", "familia": "family"}
CHILE = 7182


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


def buscar_taxon(cliente, nombre: str, nivel: str) -> int | None:
    rango = RANGO[nivel]
    datos = cliente.json("/taxa", {"q": nombre, "rank": rango, "per_page": 10})
    for t in datos["results"]:
        if t["name"].lower() == nombre.lower() and t["rank"] == rango:
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
    base = {"taxon_id": taxon_id, "quality_grade": "research", "photos": "true",
            "order_by": "votes", "per_page": 30}
    fotos = seleccionar_fotos(cliente.json("/observations", base | {"place_id": CHILE})["results"], maximo)
    if not fotos:
        fotos = seleccionar_fotos(cliente.json("/observations", base)["results"], maximo)
    for f in fotos:
        f["bytes"] = cliente.bytes(f["url_media"])
    return fotos
```

- [ ] **Step 4: Ejecutar las pruebas**

Run: `pytest -q tools/tests/test_inaturalist.py`
Expected: `5 passed`

- [ ] **Step 5: Prueba real de humo (una especie, con red)**

Run:
```bash
PYTHONPATH=tools python3 -c "
from flora.inaturalist import Cliente, buscar_taxon, fotos_para
c = Cliente('data/cache')
t = buscar_taxon(c, 'Cordia decandra', 'especie'); f = fotos_para(c, t)
print(t, len(f), [x['licencia'] for x in f], len(f[0]['bytes']))"
```
Expected: id de taxón `563983`, entre 1 y 6 fotos, licencias `cc-*`, más de 20 000 bytes en la primera.

- [ ] **Step 6: Commit**

```bash
git add tools/flora/inaturalist.py tools/tests/test_inaturalist.py
git commit -m "Pipeline: cliente de iNaturalist con caché" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TYRxdE3Enu9eAVFiapHpSx"
```

---

### Task 7: Paquete ZIP y verificación

**Files:**
- Create: `tools/flora/paquete.py`
- Test: `tools/tests/test_paquete.py`

**Interfaces:**
- Produces:
  - `construir_zip(ruta_zip, registros, fotos, generado: str) -> None`. Elimina las claves que empiezan por `_` de los registros y las claves `blob` y `miniatura` de `fotos.json`.
  - `verificar(registros, fotos, esperado=426, max_sin_foto=5) -> list[str]`: lista de errores; vacía si todo cumple.
  - `sin_foto(registros, fotos) -> list[str]`: nombres sin foto.
  - `verificar_zip(ruta_zip) -> list[str]`: relee el ZIP y comprueba manifest, formato y que cada foto tenga archivo y miniatura.

- [ ] **Step 1: Escribir las pruebas**

`tools/tests/test_paquete.py`:

```python
import json
import zipfile

from flora.paquete import construir_zip, sin_foto, verificar, verificar_zip


def _reg(i):
    return {"id": f"id-{i}", "nombre": f"Especie {i}", "sitios": ["STP"], "_filas": [i]}


def _foto(i, esp):
    return {"id": f"f-{i}", "especieId": esp, "orden": 0, "ancho": 1, "alto": 1, "tipo": "image/webp",
            "fuente": "planilla", "autor": "", "licencia": "", "url": "", "creadoEn": "x",
            "blob": b"BLOB", "miniatura": b"MINI"}


def test_verificar_detecta_conteo_duplicados_y_sin_foto():
    regs = [_reg(1), _reg(2), {"id": "id-3", "nombre": "especie 1", "sitios": []}]
    fotos = [_foto(1, "id-1")]
    errores = verificar(regs, fotos, esperado=3, max_sin_foto=1)
    assert any("repetidos" in e for e in errores)
    assert any("sin foto" in e for e in errores)
    assert verificar([_reg(1)], [_foto(1, "id-1")], esperado=1) == []
    assert verificar([_reg(1)], [_foto(1, "id-1")], esperado=2)[0].startswith("1 registros")


def test_verificar_detecta_fotos_huerfanas():
    errores = verificar([_reg(1)], [_foto(1, "id-1"), _foto(2, "id-9")], esperado=1)
    assert any("sin especie" in e for e in errores)


def test_sin_foto():
    assert sin_foto([_reg(1), _reg(2)], [_foto(1, "id-1")]) == ["Especie 2"]


def test_construir_zip_y_verificar_zip(tmp_path):
    ruta = tmp_path / "s.zip"
    construir_zip(ruta, [_reg(1)], [_foto(1, "id-1")], "2026-09-05T00:00:00+00:00")
    with zipfile.ZipFile(ruta) as z:
        nombres = set(z.namelist())
        assert {"manifest.json", "especies.json", "fotos.json", "fotos/f-1.webp", "miniaturas/f-1.webp"} <= nombres
        m = json.loads(z.read("manifest.json"))
        assert m == {"formato": 1, "generado": "2026-09-05T00:00:00+00:00", "especies": 1, "fotos": 1}
        esp = json.loads(z.read("especies.json"))
        assert esp[0]["nombre"] == "Especie 1" and "_filas" not in esp[0]
        f = json.loads(z.read("fotos.json"))[0]
        assert "blob" not in f and f["tipo"] == "image/webp"
        assert z.read("fotos/f-1.webp") == b"BLOB" and z.read("miniaturas/f-1.webp") == b"MINI"
    assert verificar_zip(ruta) == []


def test_verificar_zip_detecta_faltantes(tmp_path):
    ruta = tmp_path / "s.zip"
    with zipfile.ZipFile(ruta, "w") as z:
        z.writestr("manifest.json", json.dumps({"formato": 1, "generado": "x", "especies": 0, "fotos": 1}))
        z.writestr("especies.json", "[]")
        z.writestr("fotos.json", json.dumps([{"id": "f-1"}]))
    errores = verificar_zip(ruta)
    assert any("f-1" in e for e in errores)
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `pytest -q tools/tests/test_paquete.py`
Expected: FAIL con `ModuleNotFoundError`

- [ ] **Step 3: Implementar**

`tools/flora/paquete.py`:

```python
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


def verificar(registros: list[dict], fotos: list[dict], esperado: int = 426, max_sin_foto: int = 5) -> list[str]:
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
```

- [ ] **Step 4: Ejecutar las pruebas**

Run: `pytest -q tools/tests/test_paquete.py`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/flora/paquete.py tools/tests/test_paquete.py
git commit -m "Pipeline: paquete ZIP y verificación" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TYRxdE3Enu9eAVFiapHpSx"
```

---

### Task 8: Orquestador, ejecución real y paquete inicial

**Files:**
- Create: `tools/migrar.py`, `semilla/semilla.zip` (generado), `docs/informe-migracion.md` (copia del informe)
- Test: `tools/tests/test_migrar.py`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `asignar_fotos_planilla(registros, imagenes, ahora, informe) -> list[dict]` y `completar_con_inaturalist(registros, fotos, cliente, ahora, informe) -> list[dict]` (puras salvo el cliente), y el comando `python tools/migrar.py [--sin-descarga] [--salida data/build]`.

- [ ] **Step 1: Escribir las pruebas de las funciones de asignación**

`tools/tests/test_migrar.py`:

```python
import io

from PIL import Image

from flora.informe import Informe
from migrar import asignar_fotos_planilla, completar_con_inaturalist


def _png(ancho, alto, color="red"):
    buf = io.BytesIO()
    Image.new("RGB", (ancho, alto), color).save(buf, "PNG")
    return buf.getvalue()


def _tira6():
    im = Image.new("RGB", (6 * 400 + 5 * 30, 320), "white")
    for i in range(6):
        im.paste((200, 40 * i, 50), (i * 430, 0, i * 430 + 400, 320))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def test_asignar_fotos_planilla_corta_columna_o_y_no_columna_q():
    regs = [{"id": "a", "nombre": "A", "_filas": [2]}, {"id": "b", "nombre": "B", "_filas": [3, 4]}]
    imagenes = {("O", 2): _tira6(), ("Q", 2): _png(800, 600), ("O", 3): _png(300, 300), ("O", 9): _png(10, 10)}
    inf = Informe()
    fotos = asignar_fotos_planilla(regs, imagenes, "x", inf)
    de_a = [f for f in fotos if f["especieId"] == "a"]
    de_b = [f for f in fotos if f["especieId"] == "b"]
    assert len(de_a) == 7 and [f["orden"] for f in de_a] == list(range(7))
    assert de_a[6]["ancho"] == 800  # la foto de la columna Q va al final, sin cortar
    assert len(de_b) == 1 and de_b[0]["ancho"] == 300
    assert inf.secciones["Tiras con corte anómalo"] == ["B (fila 3): 1 segmentos"]
    assert inf.secciones["Imágenes sin fila"] == ["O9"]


def test_completar_con_inaturalist_solo_registros_sin_foto():
    class ClienteFalso:
        def __init__(self): self.consultas = []
    regs = [{"id": "a", "nombre": "Con foto", "nivel": "especie"}, {"id": "b", "nombre": "Cordia decandra", "nivel": "especie"}, {"id": "c", "nombre": "Nadie", "nivel": "especie"}]
    fotos = [{"id": "f", "especieId": "a"}]
    def buscar(cliente, nombre, nivel):
        return 7 if nombre == "Cordia decandra" else None
    def descargar(cliente, taxon_id):
        return [{"bytes": _png(500, 400), "autor": "(c) x", "licencia": "cc-by", "url": "https://i/1"}]
    inf = Informe()
    salida = completar_con_inaturalist(regs, fotos, ClienteFalso(), "x", inf, buscar=buscar, descargar=descargar)
    nuevas = [f for f in salida if f["especieId"] == "b"]
    assert len(salida) == 2 and len(nuevas) == 1
    assert nuevas[0]["fuente"] == "inaturalist" and nuevas[0]["licencia"] == "cc-by" and nuevas[0]["orden"] == 0
    assert inf.secciones["Sin taxón en iNaturalist"] == ["Nadie"]
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `pytest -q tools/tests/test_migrar.py`
Expected: FAIL con `ModuleNotFoundError: No module named 'migrar'`

- [ ] **Step 3: Implementar el orquestador**

`tools/migrar.py`:

```python
"""Orquestador del pipeline de migración. Uso: python tools/migrar.py [--sin-descarga] [--salida data/build]"""
import argparse
import collections
import io
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

from flora import inaturalist
from flora.imagenes import cortar_tira, crear_foto, mapa_celdas_imagen
from flora.informe import Informe
from flora.lectura import leer_base, leer_prefactibilidad
from flora.paquete import construir_zip, sin_foto, verificar, verificar_zip
from flora.union import fusionar_duplicados, registro_desde_base, unir

RUTA_BASE = Path("data/source/stp y las tortolas.xlsx")
RUTA_PREF = Path("data/source/Flora potencial (prefactibilidad).xlsx")
COLUMNA_TIRAS = "O"


def asignar_fotos_planilla(registros, imagenes, ahora, informe) -> list[dict]:
    por_fila = {fila: r for r in registros for fila in r.get("_filas", [])}
    fotos, contador = [], collections.Counter()
    # Columna O primero (tiras), luego las demás, ordenadas por fila.
    for (col, fila), png in sorted(imagenes.items(), key=lambda kv: (kv[0][0] != COLUMNA_TIRAS, kv[0][1])):
        r = por_fila.get(fila)
        if r is None:
            informe.agregar("Imágenes sin fila", f"{col}{fila}")
            continue
        if col == COLUMNA_TIRAS:
            piezas = cortar_tira(png)
            if len(piezas) != 6:
                informe.agregar("Tiras con corte anómalo", f"{r['nombre']} (fila {fila}): {len(piezas)} segmentos")
                piezas = [Image.open(io.BytesIO(png)).convert("RGB")]
        else:
            piezas = [Image.open(io.BytesIO(png)).convert("RGB")]
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
        taxon = buscar(cliente, r["nombre"], r["nivel"])
        if taxon is None:
            informe.agregar("Sin taxón en iNaturalist", r["nombre"])
            continue
        descargadas = descargar(cliente, taxon)
        if not descargadas:
            informe.agregar("Sin fotos con licencia en iNaturalist", r["nombre"])
            continue
        for i, f in enumerate(descargadas):
            im = Image.open(io.BytesIO(f["bytes"]))
            salida.append(crear_foto(r["id"], im, "inaturalist", i, ahora, f["autor"], f["licencia"], f["url"]))
        informe.agregar("Fotos descargadas de iNaturalist", f"{r['nombre']}: {len(descargadas)} fotos")
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
    base = [registro_desde_base(f, ahora) for f in leer_base(RUTA_BASE)]
    base = fusionar_duplicados(base, informe)
    registros = unir(base, leer_prefactibilidad(RUTA_PREF), ahora, informe)
    print(f"{len(registros)} registros")

    print("Extrayendo imágenes de la planilla...")
    fotos = asignar_fotos_planilla(registros, mapa_celdas_imagen(RUTA_BASE), ahora, informe)
    print(f"{len(fotos)} fotos de la planilla")

    if not args.sin_descarga:
        print("Descargando fotos faltantes desde iNaturalist...")
        fotos = completar_con_inaturalist(registros, fotos, inaturalist.Cliente("data/cache"), ahora, informe)
        print(f"{len(fotos)} fotos en total")

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
```

- [ ] **Step 4: Ejecutar las pruebas**

Run: `pytest -q`
Expected: `34 passed` (1 entorno, 8 limpieza, 2 lectura, 6 unión, 5 imágenes, 5 iNaturalist, 5 paquete, 2 migrar).

- [ ] **Step 5: Ejecutar el pipeline sin descarga y revisar el informe**

Run: `python tools/migrar.py --sin-descarga`
Expected: el comando termina con código 1 porque hay 42 registros sin foto, imprime el tamaño del paquete y escribe `data/build/informe-migracion.md`. Revisar en el informe que "Tiras con corte anómalo" tenga pocas entradas (menos de 10) y que "Imágenes sin fila" esté vacía. Si hay muchas tiras anómalas, abrir dos de las imágenes originales con `Read` y ajustar `umbral` o `ancho_min` en `cortar_tira` antes de continuar.

- [ ] **Step 6: Ejecutar el pipeline completo**

Run: `python tools/migrar.py`
Expected: unos 42 registros consultados a un ritmo de una solicitud por segundo (entre 5 y 10 minutos con descargas). Termina con código 0 y un paquete de entre 40 y 80 MB. Si termina con código 1, leer los errores del informe. Un registro sin taxón o sin fotos es aceptable hasta 5; un conteo distinto de 426 no lo es y hay que volver a la Task 4.

- [ ] **Step 7: Copiar el paquete y el informe al repositorio**

```bash
mkdir -p semilla
cp data/build/semilla.zip semilla/semilla.zip
cp data/build/informe-migracion.md docs/informe-migracion.md
ls -la semilla/
```

- [ ] **Step 8: Commit**

```bash
git add tools/migrar.py tools/tests/test_migrar.py semilla/semilla.zip docs/informe-migracion.md
git commit -m "Pipeline: orquestador y paquete inicial de 426 registros" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TYRxdE3Enu9eAVFiapHpSx"
```
