# Rasgos florales (color y pétalos). Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporar al paquete inicial y a la aplicación los campos `colorFlor`, `petalos`, `petalosNota` y `rasgosFuente`, con dos filtros nuevos en la lista, edición en la ficha y una etapa nueva del pipeline que los calcula desde los CSV de investigación y desde las fotos.

**Architecture:** Un módulo nuevo `tools/flora/rasgos.py` (funciones puras más una heurística de color sobre imágenes) que `tools/migrar.py` invoca después de inferir familias y de asignar fotos. En la aplicación, `db.js` suma valores por defecto y dos filtros; `ui/lista.js`, `ui/ficha.js` y `ui/editar.js` los exponen. El paquete inicial se regenera una vez.

**Tech Stack:** los mismos del proyecto (Python 3.14 con Pillow y numpy; JavaScript sin compilación; Vitest).

**Spec:** `docs/superpowers/specs/2026-09-05-flora-pwa-design.md`, sección 13 (y los cambios en 4.1, 6.1, 6.2, 6.3 y 8.1 que la acompañan).

## Global Constraints

- Español neutro con tildes en código, comentarios, interfaz y commits. Sin chilenismos ni argentinismos.
- Cada commit termina con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_01TYRxdE3Enu9eAVFiapHpSx`.
- Paleta cerrada: `blanco`, `amarillo`, `naranja`, `rojo`, `rosado`, `morado`, `azul`, `verde`, `cafe`, `sin_flor_vistosa`.
- Entradas del pipeline: `data/rasgos/color-flor.csv` y `data/rasgos/petalos-reglas.csv` (fuera de git). Si faltan, el pipeline sigue con campos vacíos y lo anota.
- El paquete se regenera una sola vez (68 MB por regeneración en el historial). Verificación del pipeline sin cambios (425 registros, tope 5 sin foto).
- Escapes Unicode con secuencias ASCII solo dentro de expresiones regulares; el resto de la prosa lleva tildes. Archivos terminados en un salto de línea.

---

### Task R1: Etapa de rasgos en el pipeline y paquete regenerado

**Files:**
- Create: `tools/flora/rasgos.py`, `tools/tests/test_rasgos.py`
- Modify: `tools/flora/union.py` (`_base_registro`), `tools/migrar.py` (`main`), `semilla/semilla.zip`, `docs/informe-migracion.md`

**Interfaces:**
- Consumes: `flora.limpieza.clave`, `flora.informe.Informe`, registros y fotos de `migrar.main`.
- Produces: `PALETA`, `normalizar_colores(texto) -> list[str]`, `leer_colores(ruta) -> dict[str, dict]`, `leer_reglas_petalos(ruta) -> dict[tuple[str, str], dict]`, `petalos_para(registro, reglas) -> dict | None`, `color_desde_imagen(im) -> list[str]`, `votar_colores(listas) -> list[str]`, `aplicar_rasgos(registros, fotos, colores, reglas, informe) -> None`.

- [ ] **Step 1: Escribir las pruebas**

`tools/tests/test_rasgos.py`:

```python
import io

from PIL import Image

from flora.informe import Informe
from flora.rasgos import (
    aplicar_rasgos, color_desde_imagen, leer_colores, leer_reglas_petalos, normalizar_colores,
    petalos_para, votar_colores,
)


def _webp(color, tam=(120, 120)):
    buf = io.BytesIO()
    Image.new("RGB", tam, color).save(buf, "WEBP")
    return buf.getvalue()


def test_normalizar_colores_aplica_paleta_y_sinonimos():
    assert normalizar_colores("Violeta; Blanco") == ["morado", "blanco"]
    assert normalizar_colores("amarillo,amarillo") == ["amarillo"]
    assert normalizar_colores("sin dato") == []
    assert normalizar_colores("turquesa") == []


def test_leer_colores_y_reglas(tmp_path):
    (tmp_path / "c.csv").write_text(
        "nombre,colores,fuente,nota\nAdesmia confusa,amarillo,https://x/a,flores amarillas\nPoa gayana,sin dato,,\n",
        encoding="utf-8")
    (tmp_path / "p.csv").write_text(
        "ambito,taxon,petalos,tipo,fuente,nota\nfamilia,Fabaceae,5,petalos,https://x/f,papilionada\n"
        "genero,Adesmia,5,petalos,https://x/g,\nespecie,Poa gayana,0,sin_petalos,https://x/p,glumas\n",
        encoding="utf-8")
    colores = leer_colores(tmp_path / "c.csv")
    assert colores["adesmia confusa"] == {"colores": ["amarillo"], "fuente": "https://x/a", "nota": "flores amarillas"}
    assert colores["poa gayana"]["colores"] == []
    reglas = leer_reglas_petalos(tmp_path / "p.csv")
    assert reglas[("genero", "adesmia")]["petalos"] == "5"
    assert reglas[("especie", "poa gayana")]["tipo"] == "sin_petalos"


def test_petalos_para_respeta_precedencia():
    reglas = {
        ("familia", "fabaceae"): {"petalos": "5", "tipo": "petalos", "fuente": "f", "nota": ""},
        ("genero", "adesmia"): {"petalos": "5", "tipo": "petalos", "fuente": "g", "nota": "género"},
        ("especie", "adesmia confusa"): {"petalos": "5", "tipo": "petalos", "fuente": "e", "nota": "especie"},
    }
    assert petalos_para({"nombre": "Adesmia confusa", "familia": "Fabaceae", "nivel": "especie"}, reglas)["fuente"] == "e"
    assert petalos_para({"nombre": "Adesmia tenella", "familia": "Fabaceae", "nivel": "especie"}, reglas)["fuente"] == "g"
    assert petalos_para({"nombre": "Otholobium glandulosum", "familia": "Fabaceae", "nivel": "especie"}, reglas)["fuente"] == "f"
    assert petalos_para({"nombre": "Fabaceae", "familia": "", "nivel": "familia"}, reglas)["fuente"] == "f"
    assert petalos_para({"nombre": "Zea mays", "familia": "Poaceae", "nivel": "especie"}, reglas) is None


def test_color_desde_imagen_detecta_tonos_y_omite_verde():
    assert color_desde_imagen(Image.new("RGB", (100, 100), (220, 30, 30))) == ["rojo"]
    assert color_desde_imagen(Image.new("RGB", (100, 100), (250, 200, 30))) == ["amarillo"]
    assert color_desde_imagen(Image.new("RGB", (100, 100), (40, 160, 60))) == []
    assert color_desde_imagen(Image.new("RGB", (100, 100), (245, 170, 200))) == ["rosado"]
    mitad = Image.new("RGB", (100, 100), (40, 160, 60))
    mitad.paste((60, 80, 220), (0, 0, 100, 50))
    assert color_desde_imagen(mitad) == ["azul"]


def test_votar_colores_ordena_por_frecuencia():
    assert votar_colores([["rojo"], ["rojo", "amarillo"], ["amarillo"], []]) == ["rojo", "amarillo"]
    assert votar_colores([]) == []


def test_aplicar_rasgos_combina_csv_fotos_y_reglas():
    registros = [
        {"id": "a", "nombre": "Adesmia confusa", "familia": "Fabaceae", "nivel": "especie"},
        {"id": "b", "nombre": "Poa gayana", "familia": "Poaceae", "nivel": "especie"},
        {"id": "c", "nombre": "Mutisia cana", "familia": "Asteraceae", "nivel": "especie"},
    ]
    fotos = [
        {"especieId": "b", "blob": _webp((220, 30, 30))},
        {"especieId": "c", "blob": _webp((60, 80, 220))},
    ]
    colores = {
        "adesmia confusa": {"colores": ["amarillo"], "fuente": "https://x/a", "nota": ""},
        "poa gayana": {"colores": [], "fuente": "", "nota": ""},
        "mutisia cana": {"colores": ["rosado"], "fuente": "https://x/m", "nota": ""},
    }
    reglas = {("familia", "fabaceae"): {"petalos": "5", "tipo": "petalos", "fuente": "https://x/f", "nota": "papilionada"}}
    inf = Informe()
    aplicar_rasgos(registros, fotos, colores, reglas, inf)
    a, b, c = registros
    assert a["colorFlor"] == ["amarillo"] and a["petalos"] == "5" and "papilionada" in a["petalosNota"]
    assert "https://x/a" in a["rasgosFuente"] and "https://x/f" in a["rasgosFuente"]
    assert b["colorFlor"] == ["rojo"] and b["petalos"] == "" and b["petalosNota"] == ""
    assert c["colorFlor"] == ["rosado"]
    assert inf.secciones["Color desde fotos"] == ["Poa gayana: rojo"]
    assert inf.secciones["Color en desacuerdo"] == ["Mutisia cana: csv rosado, fotos azul"]
    assert inf.secciones["Sin regla de pétalos"] == ["Poa gayana", "Mutisia cana"]
    assert any(l.startswith("Color desde CSV: 2") for l in inf.secciones["Rasgos"])
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `pytest -q tools/tests/test_rasgos.py`
Expected: FAIL con `ModuleNotFoundError: No module named 'flora.rasgos'`

- [ ] **Step 3: Implementar `tools/flora/rasgos.py`**

```python
"""Rasgos florales: color de flor y número de pétalos desde los CSV de investigación y desde las fotos."""
import collections
import csv
import io

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
FOTOS_POR_ESPECIE = 6
MIN_PIXELES_VIVOS = 0.01
MIN_FRACCION_COLOR = 0.25


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
    vivos = (sat > 0.35) & (val > 0.35) & ~((tono >= 60) & (tono <= 170))
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


def votar_colores(listas: list[list[str]]) -> list[str]:
    votos = collections.Counter(c for lista in listas for c in lista)
    return [c for c, _ in votos.most_common()]


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
        de_fotos = _colores_de_fotos(por_especie.get(r["id"], []))
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
            informe.agregar("Color desde fotos", f"{r['nombre']}: {', '.join(de_fotos)}")
        else:
            r["colorFlor"] = []
            sin_color += 1
        regla = petalos_para(r, reglas)
        if regla:
            r["petalos"] = regla["petalos"]
            r["petalosNota"] = ". ".join(p for p in (regla["tipo"].replace("_", " "), regla["nota"]) if p)
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
```

- [ ] **Step 4: Ejecutar las pruebas**

Run: `pytest -q tools/tests/test_rasgos.py`
Expected: `6 passed`. Si `test_color_desde_imagen_detecta_tonos_y_omite_verde` falla por un tono límite, ajusta los umbrales de los cubos y anótalo en el reporte; no cambies la prueba.

- [ ] **Step 5: Valores por defecto en los registros y llamada desde el orquestador**

En `tools/flora/union.py`, dentro de `_base_registro`, agrega tras `"notas": ""`:

```python
        "colorFlor": [], "petalos": "", "petalosNota": "", "rasgosFuente": "",
```

En `tools/migrar.py`: importa `from flora.rasgos import aplicar_rasgos, leer_colores, leer_reglas_petalos`, define `RUTA_COLORES = Path("data/rasgos/color-flor.csv")` y `RUTA_PETALOS = Path("data/rasgos/petalos-reglas.csv")`, y en `main()`, después de la descarga de iNaturalist (o de su omisión) y antes de `resumen(...)`, agrega:

```python
    if RUTA_COLORES.exists() and RUTA_PETALOS.exists():
        print("Aplicando rasgos florales...")
        aplicar_rasgos(registros, fotos, leer_colores(RUTA_COLORES), leer_reglas_petalos(RUTA_PETALOS), informe)
    else:
        informe.agregar("Rasgos", "sin archivos en data/rasgos/; campos vacíos")
```

- [ ] **Step 6: Suite completa y pipeline**

Run: `pytest -q` → todas en verde (55 pruebas). Luego `python tools/migrar.py` (la caché hace rápida la descarga; el análisis de color tarda alrededor de un minuto). Expected: código 0, 425 registros, y en el informe la sección "Rasgos" con los conteos, más "Color desde fotos", "Color en desacuerdo" y "Sin regla de pétalos".

- [ ] **Step 7: Copiar el paquete y el informe, y commit**

```bash
cp data/build/semilla.zip semilla/semilla.zip
cp data/build/informe-migracion.md docs/informe-migracion.md
git add tools/flora/rasgos.py tools/tests/test_rasgos.py tools/flora/union.py tools/migrar.py semilla/semilla.zip docs/informe-migracion.md
git commit -m "Pipeline: rasgos florales (color y pétalos) y paquete regenerado" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TYRxdE3Enu9eAVFiapHpSx"
```

---

### Task R2: Campos y filtros nuevos en la capa de datos

**Files:**
- Modify: `db.js`, `tests/db.test.js`

**Interfaces:**
- Produces: `COLORES_FLOR` (lista de pares `[valor, etiqueta]`), `nuevaEspecie` con `colorFlor: [], petalos: '', petalosNota: '', rasgosFuente: ''`, `listarEspecies` con `filtro.colorFlor` (la lista contiene el valor) y `filtro.petalos` (igualdad exacta), `valoresPetalos(db) -> Promise<string[]>` (valores distintos no vacíos, ordenados: números crecientes, luego rangos, luego texto).

- [ ] **Step 1: Añadir las pruebas** (al final del bloque `describe('especies')` de `tests/db.test.js`, ampliando el `import` con `valoresPetalos`)

```js
  it('nuevaEspecie trae los rasgos florales vacíos', () => {
    expect(nuevaEspecie()).toMatchObject({ colorFlor: [], petalos: '', petalosNota: '', rasgosFuente: '' });
  });

  it('listarEspecies filtra por color de flor y por pétalos; valoresPetalos ordena', async () => {
    await guardarEspecie(db, nuevaEspecie({ nombre: 'A b', colorFlor: ['amarillo', 'blanco'], petalos: '5' }));
    await guardarEspecie(db, nuevaEspecie({ nombre: 'C d', colorFlor: ['rojo'], petalos: '4-5' }));
    await guardarEspecie(db, nuevaEspecie({ nombre: 'E f', colorFlor: [], petalos: '0' }));
    await guardarEspecie(db, nuevaEspecie({ nombre: 'G h', colorFlor: ['amarillo'], petalos: '' }));
    const nombres = async f => (await listarEspecies(db, f)).map(e => e.nombre);
    expect(await nombres({ colorFlor: 'amarillo' })).toEqual(['A b', 'G h']);
    expect(await nombres({ colorFlor: 'blanco', petalos: '5' })).toEqual(['A b']);
    expect(await nombres({ petalos: '0' })).toEqual(['E f']);
    expect(await nombres({ colorFlor: '', petalos: '' })).toHaveLength(4);
    expect(await valoresPetalos(db)).toEqual(['0', '5', '4-5']);
  });
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `npx vitest run tests/db.test.js` → FAIL (`valoresPetalos` no exportada; `colorFlor` ausente).

- [ ] **Step 3: Implementar en `db.js`**

Añadir la constante junto a las demás:

```js
export const COLORES_FLOR = [
  ['blanco', 'Blanco'], ['amarillo', 'Amarillo'], ['naranja', 'Naranja'], ['rojo', 'Rojo'], ['rosado', 'Rosado'],
  ['morado', 'Morado'], ['azul', 'Azul'], ['verde', 'Verde'], ['cafe', 'Café'], ['sin_flor_vistosa', 'Sin flor vistosa'],
];
```

En `nuevaEspecie`, tras `notas: ''`: `colorFlor: [], petalos: '', petalosNota: '', rasgosFuente: '',`.

En `listarEspecies`, antes del filtro de texto:

```js
    .filter(e => !filtro.colorFlor || (e.colorFlor ?? []).includes(filtro.colorFlor))
    .filter(e => !filtro.petalos || e.petalos === filtro.petalos)
```

Añadir al final:

```js
function ordenPetalos(v) {
  const n = Number(v);
  if (Number.isFinite(n)) return [0, n, v];
  const rango = v.match(/^(\d+)-(\d+)$/);
  if (rango) return [1, Number(rango[1]), v];
  return [2, 0, v];
}

export async function valoresPetalos(db) {
  const todas = await db.especies.toArray();
  const valores = [...new Set(todas.map(e => e.petalos).filter(Boolean))];
  return valores.sort((a, b) => {
    const [ga, na, ta] = ordenPetalos(a);
    const [gb, nb, tb] = ordenPetalos(b);
    return ga - gb || na - nb || ta.localeCompare(tb, 'es');
  });
}
```

- [ ] **Step 4: Ejecutar las pruebas**

Run: `npm test` → todas en verde (31 pruebas).

- [ ] **Step 5: Commit**

```bash
git add db.js tests/db.test.js
git commit -m "PWA: campos y filtros de color de flor y pétalos en la capa de datos" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TYRxdE3Enu9eAVFiapHpSx"
```

---

### Task R3: Filtros en la lista y campos en ficha y edición

**Files:**
- Modify: `ui/lista.js`, `ui/ficha.js`, `ui/editar.js`

**Interfaces:**
- Consumes: `COLORES_FLOR`, `valoresPetalos` de `db.js`.

- [ ] **Step 1: `ui/lista.js`**

Ampliar el `import` con `COLORES_FLOR, valoresPetalos`. En `filtro`, agregar `colorFlor: '', petalos: ''`. En `render`, tras `const minis = ...`, agregar `const petalos = await valoresPetalos(db);`. En `filtros`, agregar dos selectores al final:

```js
    selector('colorFlor', COLORES_FLOR, 'Color de flor', pintar),
    selector('petalos', petalos.map(v => [v, `${v} pétalos`.replace('1 pétalos', '1 pétalo')]), 'Pétalos', pintar));
```

- [ ] **Step 2: `ui/ficha.js`**

Ampliar el `import` con `COLORES_FLOR`. En `CAMPOS`, después de `['rangoAltitudinal', ...]`, agregar `['colorFlor', 'Color de flor'], ['petalos', 'Pétalos'], ['petalosNota', 'Pétalos según clave'],`. En `valorTexto`, antes de la rama `Array.isArray`:

```js
  if (clave === 'colorFlor') return (v ?? []).map(c => (COLORES_FLOR.find(([valor]) => valor === c) ?? [c, c])[1]).join(', ');
```

Si `e.rasgosFuente` no está vacío, agregar tras las notas una sección "Fuentes de rasgos" con cada URL en un enlace `el('a', { href: url, target: '_blank', rel: 'noopener' }, url)` dentro de un `el('p', { class: 'notas' }, ...)`, una por línea (`rasgosFuente.split('\n')`). Recuerda filtrar nulos en `cont.append`.

- [ ] **Step 3: `ui/editar.js`**

Ampliar el `import` con `COLORES_FLOR`. En el formulario, después del `fieldset` de sitios, agregar:

```js
    el('fieldset', {}, el('legend', {}, 'Color de flor'), ...COLORES_FLOR.map(([valor, texto]) => el('label', { class: 'casilla' },
      el('input', { type: 'checkbox', checked: (borrador.colorFlor ?? []).includes(valor), onchange: ev => {
        const actual = borrador.colorFlor ?? [];
        borrador.colorFlor = ev.target.checked ? [...actual, valor] : actual.filter(x => x !== valor);
      } }), texto))),
    campoTexto(borrador, 'petalos', 'Pétalos (número, rango como 4-5, 0 o variable)'),
    campoTexto(borrador, 'petalosNota', 'Pétalos según clave (tipo y aclaración)'),
```

`structuredClone` conserva `colorFlor`; para especies creadas antes de esta versión (sin el campo) el `?? []` evita errores.

- [ ] **Step 4: Verificar en Chrome de escritorio**

Con `npm run servir`: en Ajustes, "Volver a cargar el paquete inicial" (o borrar el sitio en DevTools) para tomar la semilla regenerada. Lista: aparecen los selectores "Color de flor" y "Pétalos"; "Amarillo" reduce la lista y el contador; "5 pétalos" combinado con "Amarillo" reduce más; limpiar ambos vuelve a 425. Ficha de Adesmia confusa: muestra "Color de flor", "Pétalos" y "Pétalos según clave", y la sección de fuentes con enlaces. Edición: marcar "Rojo" y guardar; la ficha lo muestra; volver a desmarcarlo. `npm test` sigue en verde.

- [ ] **Step 5: Commit**

```bash
git add ui/lista.js ui/ficha.js ui/editar.js
git commit -m "PWA: filtros y campos de color de flor y pétalos" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TYRxdE3Enu9eAVFiapHpSx"
```
