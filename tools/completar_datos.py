"""Relleno de datos faltantes con procedencia (spec 1.5, sección 5).

Uso, desde la raíz del repo:
  PYTHONPATH=tools .venv/Scripts/python tools/completar_datos.py faltantes
      Une las especies de los paquetes como lo hace la app y escribe data/build/faltantes.json
      y los lotes data/build/lotes/lote-NN.json para la investigación.
"""
import json
import sys
import unicodedata
import zipfile
from pathlib import Path

PAQUETES = ['semilla/semilla.zip', 'semilla/nevado-tres-cruces.zip', 'semilla/chacao-chonchi.zip']
# Campos que se investigan por lote. categoriaMMA se cruza aparte contra el listado del RCE.
CAMPOS = ['familia', 'habito', 'habitoDetalle', 'origen', 'colorFlor', 'petalos', 'diagnostico']
TAMANO_LOTE = 50
SALIDA = Path('data/build')


def normalizar(texto) -> str:
    """Igual que normalizar() de db.js: sin tildes, minúsculas, espacios simples."""
    s = unicodedata.normalize('NFD', str(texto or ''))
    s = ''.join(c for c in s if not ('̀' <= c <= 'ͯ'))
    return ' '.join(s.lower().split())


def vacio(valor) -> bool:
    return valor in ('', None, [], {})


def unir_especies(paquetes=PAQUETES) -> list[dict]:
    """Une los paquetes en orden: un registro posterior con el mismo id o nombre normalizado solo
    completa los campos vacíos del anterior (como completarExistente de db.js). Cada especie lleva
    'clave' (id del primer paquete) e 'ids' (todos sus ids en los paquetes)."""
    especies: list[dict] = []
    por_id: dict[str, dict] = {}
    por_nombre: dict[str, dict] = {}
    for ruta in paquetes:
        with zipfile.ZipFile(ruta) as z:
            registros = json.loads(z.read('especies.json'))
        for r in registros:
            existente = por_id.get(r['id']) or por_nombre.get(normalizar(r['nombre']))
            if existente is None:
                e = dict(r, clave=r['id'], ids=[r['id']])
                especies.append(e)
                por_id[r['id']] = e
                por_nombre[normalizar(r['nombre'])] = e
                continue
            if r['id'] not in existente['ids']:
                existente['ids'].append(r['id'])
                por_id[r['id']] = existente
            for campo, valor in r.items():
                if campo in ('id', 'ids', 'clave'):
                    continue
                if vacio(existente.get(campo)) and not vacio(valor):
                    existente[campo] = valor
    return especies


def faltantes(especies: list[dict]) -> list[dict]:
    salida = []
    for e in especies:
        # Las determinaciones a nivel de género o familia no tienen color, pétalos ni rasgo propios.
        campos = CAMPOS if e.get('nivel', 'especie') == 'especie' else ['familia', 'habito', 'origen']
        faltan = [c for c in campos if vacio(e.get(c))]
        if faltan:
            salida.append({
                'clave': e['clave'], 'nombre': e['nombre'], 'nivel': e.get('nivel', 'especie'),
                'familia': e.get('familia', ''), 'habito': e.get('habito', ''), 'faltan': faltan,
            })
    return salida


def comando_faltantes() -> int:
    especies = unir_especies()
    lista = faltantes(especies)
    SALIDA.mkdir(parents=True, exist_ok=True)
    (SALIDA / 'faltantes.json').write_text(json.dumps(lista, ensure_ascii=False, indent=1), encoding='utf-8')
    (SALIDA / 'especies-unidas.json').write_text(json.dumps(
        [{'clave': e['clave'], 'nombre': e['nombre'], 'nivel': e.get('nivel', 'especie'),
          'categoriaMMA': e.get('categoriaMMA', ''), 'decreto': e.get('decreto', '')} for e in especies],
        ensure_ascii=False, indent=1), encoding='utf-8')
    lotes = SALIDA / 'lotes'
    lotes.mkdir(exist_ok=True)
    for viejo in lotes.glob('lote-*.json'):
        viejo.unlink()
    for i in range(0, len(lista), TAMANO_LOTE):
        n = i // TAMANO_LOTE + 1
        (lotes / f'lote-{n:02d}.json').write_text(
            json.dumps(lista[i:i + TAMANO_LOTE], ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{len(especies)} especies, {len(lista)} con faltantes, {-(-len(lista) // TAMANO_LOTE)} lotes')
    return 0


def main(argv: list[str]) -> int:
    if argv[:1] == ['faltantes']:
        return comando_faltantes()
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
