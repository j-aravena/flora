"""Relleno de datos faltantes con procedencia (spec 1.5, sección 5).

Uso, desde la raíz del repo:
  PYTHONPATH=tools .venv/Scripts/python tools/completar_datos.py faltantes
      Une las especies de los paquetes como lo hace la app y escribe data/build/faltantes.json
      y los lotes data/build/lotes/lote-NN.json para la investigación.
  PYTHONPATH=tools .venv/Scripts/python tools/completar_datos.py construir
      Valida los lotes investigados (tools/datos/complementos) y arma semilla/complementos.zip
      y docs/informe-complementos.md. Si hay errores no escribe nada.
"""
import json
import os
import re
import sys
from collections import Counter
from datetime import date
import unicodedata
import zipfile
from pathlib import Path

PAQUETES = ['semilla/semilla.zip', 'semilla/nevado-tres-cruces.zip', 'semilla/chacao-chonchi.zip']
# Campos que se investigan por lote. categoriaMMA se cruza aparte contra el listado del RCE.
CAMPOS = ['familia', 'habito', 'habitoDetalle', 'origen', 'colorFlor', 'petalos', 'diagnostico']
TAMANO_LOTE = 50
SALIDA = Path('data/build')
LOTES_INVESTIGADOS = Path('tools/datos/complementos')

# Copiado de db.js (test_vocabulario_igual_a_db_js lo vigila).
VOCAB = {
    'HABITOS': ['Hierba anual', 'Hierba perenne', 'Subarbusto', 'Arbusto', 'Árbol', 'Suculenta'],
    'ORIGENES': ['Nativa', 'Endémica', 'Introducida'],
    'CATEGORIAS': ['Preocupación Menor', 'Casi amenazada', 'Vulnerable', 'En peligro', 'En peligro crítico',
                   'Datos insuficientes', 'Rara'],
    'COLORES': ['blanco', 'amarillo', 'naranja', 'rojo', 'rosado', 'morado', 'azul', 'verde', 'cafe',
                'sin_flor_vistosa'],
}
CAMPOS_COMPLEMENTO = CAMPOS + ['categoriaMMA', 'decreto']


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


def _error_campo(campo, v) -> str | None:
    """Mensaje si el valor no cumple el formato del campo; None si es válido."""
    if campo == 'familia':
        ok = isinstance(v, str) and re.fullmatch(r'[A-Z][a-z]+aceae', v)
    elif campo == 'habito':
        ok = v in VOCAB['HABITOS']
    elif campo == 'habitoDetalle':
        ok = isinstance(v, str) and 1 <= len(v) <= 60
    elif campo == 'origen':
        ok = v in VOCAB['ORIGENES']
    elif campo == 'colorFlor':
        ok = (isinstance(v, list) and 1 <= len(v) <= 2 and len(set(v)) == len(v)
              and all(c in VOCAB['COLORES'] for c in v))
    elif campo == 'petalos':
        ok = isinstance(v, str) and re.fullmatch(r'\d+|\d+-\d+|variable', v)
    elif campo == 'diagnostico':
        ok = isinstance(v, str) and 1 <= len(v) <= 160
    elif campo == 'categoriaMMA':
        ok = v in VOCAB['CATEGORIAS']
    elif campo == 'decreto':
        ok = isinstance(v, str) and re.fullmatch(r'D\.S\. N° \d+/\d{4}', v)
    else:
        return f'campo desconocido {campo}'
    return None if ok else f'valor inválido en {campo}: {v!r}'


def validar_registro(r: dict, permitidos: set) -> list[str]:
    errores = []
    campos = r.get('campos') or {}
    fuentes = r.get('fuentes') or {}
    no = r.get('noEncontrado') or []
    for campo, valor in campos.items():
        if campo not in permitidos:
            errores.append(f'{campo} no fue pedido')
            continue
        e = _error_campo(campo, valor)
        if e:
            errores.append(e)
        f = fuentes.get(campo)
        if (not isinstance(f, dict) or not str(f.get('nombre') or '').strip()
                or not str(f.get('url') or '').startswith('https://')):
            errores.append(f'{campo} sin fuente válida (nombre y url https://)')
        if campo in no:
            errores.append(f'{campo} está en campos y en noEncontrado')
    if 'categoriaMMA' in campos and 'decreto' not in campos:
        errores.append('categoriaMMA exige decreto')
    return errores


def _leer_lotes(dir_lotes: Path, faltantes_: list[dict]):
    """Devuelve (registros_por_clave, errores). categorias.json se fusiona sobre los demás."""
    errores = []
    pedidos = {f['clave']: set(f['faltan']) for f in faltantes_}
    vistos: dict[str, str] = {}
    registros: dict[str, dict] = {}
    archivos = sorted(Path(dir_lotes).glob('lote-*.json'))
    cat = Path(dir_lotes) / 'categorias.json'
    if cat.exists():
        archivos.append(cat)
    for ruta in archivos:
        es_cat = ruta.name == 'categorias.json'
        try:
            datos = json.loads(ruta.read_text(encoding='utf-8'))
        except ValueError as e:
            errores.append(f'{ruta.name}: JSON ilegible ({e})')
            continue
        for r in datos:
            clave = r.get('clave')
            if clave not in pedidos and not (es_cat and clave in {f['clave'] for f in faltantes_}):
                errores.append(f'{ruta.name}: clave desconocida {clave}')
                continue
            if es_cat:
                permitidos = {'categoriaMMA', 'decreto'}
            else:
                if clave in vistos:
                    errores.append(f'{ruta.name}: clave repetida {clave} (también en {vistos[clave]})')
                    continue
                vistos[clave] = ruta.name
                permitidos = pedidos[clave]
            for e in validar_registro(r, permitidos):
                errores.append(f'{ruta.name}: {clave}: {e}')
            if clave in registros:
                dst = registros[clave]
                dst['campos'].update(r.get('campos') or {})
                dst['fuentes'].update(r.get('fuentes') or {})
                dst['noEncontrado'] += r.get('noEncontrado') or []
            else:
                registros[clave] = {'campos': dict(r.get('campos') or {}), 'fuentes': dict(r.get('fuentes') or {}),
                                    'noEncontrado': list(r.get('noEncontrado') or [])}
    return registros, errores


def _informe(registros, faltantes_, generado) -> str:
    llenos = {c: 0 for c in CAMPOS_COMPLEMENTO}
    no_enc = {c: 0 for c in CAMPOS_COMPLEMENTO}
    pedidos = {c: 0 for c in CAMPOS_COMPLEMENTO}
    fuentes = Counter()
    for f in faltantes_:
        for c in f['faltan']:
            pedidos[c] += 1
    por_especie = []
    for f in faltantes_:
        r = registros.get(f['clave'])
        if not r:
            continue
        for c in r['campos']:
            llenos[c] += 1
        for c in r['noEncontrado']:
            no_enc[c] += 1
        for fu in r['fuentes'].values():
            fuentes[fu['nombre']] += 1
        if r['campos']:
            por_especie.append((f['nombre'], sorted(r['campos'])))
    total = sum(llenos.values())
    L = [f'# Informe de complementos ({generado})', '',
         f'{len(por_especie)} especies con datos nuevos, {total} campos llenados.', '',
         '| campo | llenados | no encontrados | sin investigar |', '|---|---|---|---|']
    for c in CAMPOS_COMPLEMENTO:
        sin = max(pedidos[c] - llenos[c] - no_enc[c], 0)
        if pedidos[c] or llenos[c] or no_enc[c]:
            L.append(f'| {c} | {llenos[c]} | {no_enc[c]} | {sin} |')
    L += ['', '## Fuentes más usadas', '']
    L += [f'- {n}: {k}' for n, k in fuentes.most_common()] or ['- (ninguna)']
    L += ['', '## Especies', '']
    L += [f'- {n}: {", ".join(cs)}' for n, cs in por_especie] or ['- (ninguna)']
    return '\n'.join(L) + '\n'


def construir(dir_lotes, faltantes_, destino, informe, generado) -> list[str]:
    registros, errores = _leer_lotes(dir_lotes, faltantes_)
    if errores:
        return errores
    destino = Path(destino)
    salida = []
    for f in faltantes_:
        r = registros.get(f['clave'])
        if r and r['campos']:
            salida.append({'id': f['clave'], 'nombre': f['nombre'], 'campos': r['campos'],
                           'fuentes': {c: f"{r['fuentes'][c]['nombre']} — {r['fuentes'][c]['url']}" for c in r['campos']}})
    manifest = {'formato': 1, 'tipo': 'complementos', 'version': 1, 'creado': generado}
    tmp = destino.with_suffix('.zip.tmp')
    destino.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False))
        z.writestr('complementos.json', json.dumps(salida, ensure_ascii=False, indent=1))
    os.replace(tmp, destino)
    informe = Path(informe)
    informe.parent.mkdir(parents=True, exist_ok=True)
    informe.write_text(_informe(registros, faltantes_, generado), encoding='utf-8')
    return []


def comando_construir() -> int:
    lista = json.loads((SALIDA / 'faltantes.json').read_text(encoding='utf-8'))
    errores = construir(LOTES_INVESTIGADOS, lista, Path('semilla/complementos.zip'),
                        Path('docs/informe-complementos.md'), generado=date.today().isoformat())
    if errores:
        print('\n'.join(errores))
        print(f'{len(errores)} errores; no se escribió nada')
        return 1
    print('semilla/complementos.zip y docs/informe-complementos.md escritos')
    return 0


def main(argv: list[str]) -> int:
    if argv[:1] == ['faltantes']:
        return comando_faltantes()
    if argv[:1] == ['construir']:
        return comando_construir()
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
