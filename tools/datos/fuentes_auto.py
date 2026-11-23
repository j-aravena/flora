#!/usr/bin/env python
"""Rellena datos faltantes de especies desde fuentes web con indices locales en cache.

Uso (desde la raiz del repo):
    python -I tools/datos/fuentes_auto.py indices      # descarga/lee cache: Chileflora, RBGE, GBIF, fichas
    python -I tools/datos/fuentes_auto.py https         # migra URLs http:// de Chileflora a https:// (verifica)
    python -I tools/datos/fuentes_auto.py rellenar      # fusiona en tools/datos/complementos/lote-NN.json
    python -I tools/datos/fuentes_auto.py todo

Fuentes: Chileflora (indice de familias PIC_FAMILIES_*, clave PIC_PLANT_FLOWER_*, ficha EH####.htm),
GBIF species/match + distributions (WCVP), RBGE Plantas endemicas de Chile.
Reglas: solo se llenan los campos de `faltan`; cada valor lleva una URL https que respalda ESA especie;
ante duda el campo queda en noEncontrado (un dato equivocado es peor que uno vacio).
Cache en tools/datos/cache/ (no versionar). Pedidos secuenciales con pausa y reintentos.
"""
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
CACHE = RAIZ / 'tools' / 'datos' / 'cache'
COMPLEMENTOS = RAIZ / 'tools' / 'datos' / 'complementos'
LOTES = RAIZ / 'data' / 'build' / 'lotes'
FALTANTES = RAIZ / 'data' / 'build' / 'faltantes.json'
UA = 'flora-offline-datos/1.0'
PAUSA = 0.35

CF = 'https://www.chileflora.com/Florachilena/FloraEnglish/'
RBGE_INDICE = 'https://chileanendemics.rbge.org.uk/es/indexes/taxa'
GBIF = 'https://api.gbif.org/v1/'

FAMILIAS_SIN_FLOR = {
    'Poaceae', 'Cyperaceae', 'Juncaceae', 'Pinaceae', 'Cupressaceae', 'Podocarpaceae', 'Araucariaceae',
    # helechos y licofitas
    'Hymenophyllaceae', 'Blechnaceae', 'Gleicheniaceae', 'Dryopteridaceae', 'Polypodiaceae', 'Pteridaceae',
    'Aspleniaceae', 'Dennstaedtiaceae', 'Lophosoriaceae', 'Cyatheaceae', 'Dicksoniaceae', 'Osmundaceae',
    'Lycopodiaceae', 'Selaginellaceae', 'Isoetaceae', 'Ophioglossaceae', 'Equisetaceae', 'Marsileaceae',
    'Salviniaceae', 'Azollaceae', 'Thelypteridaceae', 'Woodsiaceae', 'Athyriaceae', 'Cystopteridaceae',
    'Anemiaceae', 'Schizaeaceae', 'Lomariopsidaceae', 'Rumohraceae', 'Hypolepidaceae', 'Onocleaceae',
    'Lindsaeaceae', 'Grammitidaceae', 'Culcitaceae', 'Plagiogyriaceae', 'Tectariaceae', 'Pteridaceae',
}
FAMILIAS_SIN_PETALOS = FAMILIAS_SIN_FLOR | {'Asteraceae'}
GENEROS_SIN_PETALOS = {'Acaena'}

COLORES = {'white': 'blanco', 'yellow': 'amarillo', 'orange': 'naranja', 'red': 'rojo', 'pink': 'rosado',
           'purple': 'morado', 'violet': 'morado', 'lilac': 'morado', 'blue': 'azul', 'green': 'verde',
           'brown': 'cafe'}
HABITOS = {'Annual': 'Hierba anual', 'Perennial': 'Hierba perenne', 'Shrub': 'Arbusto', 'Tree': 'Árbol',
           'Cactus': 'Suculenta'}
ORIGENES_CF = {'Native': 'Nativa', 'Endemic': 'Endémica', 'Introduced': 'Introducida'}
TDWG_CHILE = {'CLC', 'CLN', 'CLS', 'JNF', 'JUF'}  # Chile Central/North/South, Juan Fernandez


# ---------------------------------------------------------------- descarga con cache
def get(url: str, binario=False, pausa=PAUSA):
    """GET con cache en disco, pausa y reintentos. Devuelve texto (cp1252 si no es utf-8) o None si 404."""
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / (hashlib.sha1(url.encode()).hexdigest() + '.bin')
    if f.exists():
        datos = f.read_bytes()
    else:
        datos = None
        for intento in range(4):
            time.sleep(pausa * (1 + intento))
            try:
                req = urllib.request.Request(url, headers={'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=40) as r:
                    datos = r.read()
                break
            except urllib.error.HTTPError as e:
                if e.code in (404, 410):
                    datos = b'__404__'
                    break
                if e.code not in (429, 500, 502, 503, 504):
                    datos = b'__ERR%d__' % e.code
                    break
            except Exception:
                pass
        if datos is None:
            return None  # no se cachea el fallo de red
        f.write_bytes(datos)
    if datos.startswith(b'__404__') or datos.startswith(b'__ERR'):
        return None
    if binario:
        return datos
    try:
        return datos.decode('utf-8')
    except UnicodeDecodeError:
        return datos.decode('cp1252', errors='replace')


def gbif_json(ruta):
    t = get(GBIF + ruta)
    return json.loads(t) if t else None


def bin_(nombre):
    return ' '.join(str(nombre).lower().split())


# ---------------------------------------------------------------- Chileflora
def indice_familias():
    """nombre -> {'familia', 'eh': set, 'paginas': [n]}"""
    out = {}
    for n in range(281):
        t = get(f'{CF}PIC_FAMILIES_{n}.php')
        if not t:
            continue
        m = re.search(r'<H2 class="mainsubcat">\s*([^<(]+?)\s*\(', t)
        fam = m.group(1).strip() if m else None
        for eh, nom in re.findall(r'href="HighResPages/(EH\d+)\.htm"><img[^>]*><br>\s*([^<]+?)\s*<br>', t):
            e = out.setdefault(bin_(nom), {'familia': fam, 'eh': set(), 'paginas': []})
            e['eh'].add(eh)
            e['paginas'].append(n)
    return out


def indice_flor():
    """nombre -> {'tipos': set, 'cats': [(color_en, petalos_txt)], 'paginas': [n]}"""
    out = {}
    for n in range(217):
        t = get(f'{CF}PIC_PLANT_FLOWER_{n}.php')
        if not t:
            continue
        m1 = re.search(r'<H1 class="maincat">.*?alt="([^"]*)"', t, re.S)
        m2 = re.search(r'<H2 class="mainsubcat">(.*?)</H2>', t, re.S)
        if not m1 or not m2:
            continue
        tipo = m1.group(1).strip()
        alt2 = re.search(r'alt="([^"]*)"', m2.group(1))
        cat = alt2.group(1).strip() if alt2 else ''
        for eh, nom in re.findall(r'href="HighResPages/(EH\d+)\.htm"><img[^>]*><br>\s*([^<]+?)\s*<br>', t):
            e = out.setdefault(bin_(nom), {'tipos': set(), 'cats': [], 'paginas': [], 'eh': set()})
            e['tipos'].add(tipo)
            e['cats'].append(cat)
            e['paginas'].append(n)
            e['eh'].add(eh)
    return out


def ficha(eh):
    """Parsea una ficha EH####: origen, categorias de flor (alt de iconos)."""
    t = get(f'{CF}HighResPages/{eh}.htm')
    if not t:
        return None
    t = re.sub(r'<script.*?</script>', '', t, flags=re.S | re.I)
    mt = re.search(r'<TITLE>\s*Description and images of\s+([^(]+?)\s*\(', t, re.I)
    mo = re.search(r'<b>\s*(Native|Endemic|Introduced)\b', t)
    cats = re.findall(r'alt="([^"]*)"\s+src="\.\./\.\./ServiceImages/Flower\w+\.gif"', t)
    return {'titulo': mt.group(1).strip() if mt else None, 'origen': mo.group(1) if mo else None, 'cats': cats}


def parse_cat(cat):
    """'Green, 7 - 14 petals' -> ('green', '7-14'); sin dato de petalos -> (color, None); raro -> (None, None)."""
    if ',' not in cat:
        return (cat.strip().lower() or None, None)
    col, resto = [x.strip() for x in cat.split(',', 1)]
    col = col.lower()
    r = resto.lower()
    m = re.fullmatch(r'(\d+) petals?', r)
    if m:
        return col, m.group(1)
    m = re.fullmatch(r'(\d+) - (\d+) petals', r)
    if m:
        return col, f'{m.group(1)}-{m.group(2)}'
    return col, None  # "without information", "14 petals or more": no sirve para petalos


# ---------------------------------------------------------------- RBGE
def indice_rbge():
    """binomio normalizado -> slug (solo taxones aceptados, no sinonimos ni infraespecificos)."""
    t = get(RBGE_INDICE)
    out = {}
    for cls, slug, txt in re.findall(r'<li class="([^"]*)">\s*<a href="https://chileanendemics\.rbge\.org\.uk/es/taxa/([^"]+)">(.*?)</a>',
                                     t or '', re.S):
        if 'synonym' in cls.split():
            continue
        nombre = re.sub(r'<[^>]+>', ' ', txt)
        nombre = ' '.join(nombre.split())
        if re.search(r'\b(var|subsp|ssp|f|fo|forma)\.\s', nombre) or ' × ' in nombre or nombre.startswith('×'):
            continue
        p = nombre.split()
        if len(p) >= 2:
            out.setdefault(bin_(p[0] + ' ' + p[1]), slug)
    return out


# ---------------------------------------------------------------- GBIF
def gbif_match(nombre):
    d = gbif_json('species/match?name=' + urllib.parse.quote(nombre))
    if (d and d.get('matchType') == 'EXACT' and d.get('rank') == 'SPECIES' and d.get('status') == 'ACCEPTED'
            and d.get('usageKey') and bin_(d.get('canonicalName', '')) == bin_(nombre)):
        return {'key': d['usageKey'], 'familia': d.get('family')}
    return None


def gbif_origen(key):
    d = gbif_json(f'species/{key}/distributions?limit=200')
    if not d:
        return None
    wcvp = [r for r in d.get('results', []) if 'WCVP' in str(r.get('source', '')) or 'World Checklist' in str(r.get('source', ''))]
    if not wcvp:
        return None
    nativos, intro = set(), set()
    for r in wcvp:
        cod = str(r.get('locationId', '')).split(':')[-1].upper()
        med = str(r.get('establishmentMeans') or '').upper()
        (intro if med in ('INTRODUCED', 'NATURALISED', 'INVASIVE') else nativos).add(cod)
    if intro & TDWG_CHILE and not (nativos & TDWG_CHILE):
        return 'Introducida'
    if not (nativos & TDWG_CHILE):
        return None
    if nativos <= TDWG_CHILE:
        return 'Endémica'
    return 'Nativa'


# ---------------------------------------------------------------- relleno
def cargar_indices(verbose=True):
    if verbose:
        print('Chileflora familias...', flush=True)
    fam = indice_familias()
    if verbose:
        print(f'  {len(fam)} nombres; flor...', flush=True)
    flor = indice_flor()
    if verbose:
        print(f'  {len(flor)} nombres; RBGE...', flush=True)
    rb = indice_rbge()
    if verbose:
        print(f'  {len(rb)} endemicas', flush=True)
    return fam, flor, rb


def evidencia(nombre, familia_conocida, fam, flor, rb, faltan):
    """Devuelve (campos, fuentes) para una especie (binomio)."""
    campos, fuentes = {}, {}
    n = bin_(nombre)
    gen = nombre.split()[0]
    cfam = fam.get(n)
    cflor = flor.get(n)
    ehs = set()
    if cfam:
        ehs |= cfam['eh']
    if cflor:
        ehs |= cflor['eh']
    fi = None
    fi_url = None
    if len(ehs) == 1:
        eh = next(iter(ehs))
        f = ficha(eh)
        if f and f['titulo'] and bin_(f['titulo']) == n:
            fi = f
            fi_url = f'{CF}HighResPages/{eh}.htm'

    gm = None
    if {'familia', 'colorFlor', 'petalos', 'origen'} & set(faltan):
        gm = gbif_match(nombre)
    gurl = f"https://www.gbif.org/species/{gm['key']}" if gm else None

    # familia
    familia = familia_conocida or None
    if 'familia' in faltan and gm and gm['familia'] and re.fullmatch(r'[A-Z][a-z]+aceae', gm['familia']):
        campos['familia'] = gm['familia']
        fuentes['familia'] = {'nombre': 'GBIF (WCVP)', 'url': gurl}
        familia = gm['familia']
    elif not familia and gm:
        familia = gm['familia']
    fam_ok = bool(gm and gm['familia'] and (not familia_conocida or gm['familia'] == familia_conocida))

    # origen
    if 'origen' in faltan:
        o = None
        slug = rb.get(n)
        cf_o = ORIGENES_CF.get(fi['origen']) if fi else None
        if slug:
            if cf_o in (None, 'Nativa', 'Endémica'):
                o, src = 'Endémica', ('The Endemic Plants of Chile (RBGE)', f'https://chileanendemics.rbge.org.uk/es/taxa/{slug}')
        elif cf_o:
            o, src = cf_o, ('Chileflora', fi_url)
        elif gm:
            go = gbif_origen(gm['key'])
            if go:
                o, src = go, ('GBIF (WCVP)', gurl)
        if o:
            campos['origen'] = o
            fuentes['origen'] = {'nombre': src[0], 'url': src[1]}

    # colorFlor
    if 'colorFlor' in faltan:
        if familia in FAMILIAS_SIN_FLOR and fam_ok:
            campos['colorFlor'] = ['sin_flor_vistosa']
            fuentes['colorFlor'] = {'nombre': 'GBIF (WCVP), familia ' + familia, 'url': gurl}
        elif fi and cflor:
            cols = []
            ok = True
            for c in fi['cats']:
                col, _ = parse_cat(c)
                if col not in COLORES:
                    ok = False
                    break
                if COLORES[col] not in cols:
                    cols.append(COLORES[col])
            clave_cols = {parse_cat(c)[0] for c in cflor['cats']} - {''}
            if ok and cols and len(cols) <= 2 and {parse_cat(c)[0] for c in fi['cats']} == clave_cols:
                campos['colorFlor'] = cols
                fuentes['colorFlor'] = {'nombre': 'Chileflora', 'url': fi_url}

    # petalos
    if 'petalos' in faltan and fi and cflor and familia not in FAMILIAS_SIN_PETALOS and gen not in GENEROS_SIN_PETALOS:
        ps = {parse_cat(c)[1] for c in fi['cats']}
        pk = {parse_cat(c)[1] for c in cflor['cats']}
        if len(ps) == 1 and None not in ps and ps == pk:
            campos['petalos'] = next(iter(ps))
            fuentes['petalos'] = {'nombre': 'Chileflora', 'url': fi_url}

    # habito (solo categoria unica y clara)
    if 'habito' in faltan and cflor and len(cflor['tipos']) == 1:
        h = HABITOS.get(next(iter(cflor['tipos'])))
        if h and fi_url:
            campos['habito'] = h
            fuentes['habito'] = {'nombre': 'Chileflora', 'url': fi_url}
    return campos, fuentes


def rellenar(verbose=True):
    fam, flor, rb = cargar_indices(verbose)
    falt = {f['clave']: f for f in json.loads(FALTANTES.read_text(encoding='utf-8'))}
    total = {c: 0 for c in ('familia', 'habito', 'origen', 'colorFlor', 'petalos')}
    for ruta in sorted(LOTES.glob('lote-*.json')):
        lote = json.loads(ruta.read_text(encoding='utf-8'))
        dest = COMPLEMENTOS / ruta.name
        previo = {r['clave']: r for r in json.loads(dest.read_text(encoding='utf-8'))} if dest.exists() else {}
        salida = []
        for it in lote:
            r = previo.get(it['clave']) or {'clave': it['clave'], 'nombre': it['nombre'], 'campos': {}, 'fuentes': {},
                                            'noEncontrado': []}
            r.setdefault('campos', {})
            r.setdefault('fuentes', {})
            r.setdefault('noEncontrado', [])
            pend = [c for c in it['faltan'] if c in total and c not in r['campos']]
            if pend and len(it['nombre'].split()) == 2 and it['nivel'] == 'especie' and it['nombre'][0].isupper():
                cs, fs = evidencia(it['nombre'], it.get('familia'), fam, flor, rb, pend)
                for c, v in cs.items():
                    r['campos'][c] = v
                    r['fuentes'][c] = fs[c]
                    if c in r['noEncontrado']:
                        r['noEncontrado'].remove(c)
                    total[c] += 1
            for c in it['faltan']:
                if c not in r['campos'] and c not in r['noEncontrado']:
                    r['noEncontrado'].append(c)
            salida.append(r)
        dest.write_text(json.dumps(salida, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        if verbose:
            print(ruta.name, 'listo', total, flush=True)
    return total


def migrar_https(verbose=True):
    """http://(www.)chileflora.com -> https:// si la pagina https responde igual; si no, el campo pasa a noEncontrado."""
    cambiados = quitados = 0
    verif = {}
    for ruta in sorted(COMPLEMENTOS.glob('lote-*.json')):
        datos = json.loads(ruta.read_text(encoding='utf-8'))
        for r in datos:
            for c in list(r['campos']):
                u = (r['fuentes'].get(c) or {}).get('url', '')
                if not u.startswith('http://'):
                    continue
                nuevo = 'https://' + u[len('http://'):]
                if 'chileflora.com' in nuevo and '://chileflora.com' in nuevo:
                    nuevo = nuevo.replace('://chileflora.com', '://www.chileflora.com')
                if nuevo not in verif:
                    a, b = get(u), get(nuevo)
                    verif[nuevo] = bool(a and b and a == b)
                if verif[nuevo]:
                    r['fuentes'][c]['url'] = nuevo
                    cambiados += 1
                else:
                    del r['campos'][c]
                    del r['fuentes'][c]
                    r['noEncontrado'].append(c)
                    quitados += 1
        ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    if verbose:
        print(f'https: {cambiados} URLs migradas, {quitados} campos pasados a noEncontrado')
    return cambiados, quitados


def main(argv):
    cmd = argv[0] if argv else 'todo'
    if cmd in ('https', 'todo'):
        migrar_https()
    if cmd in ('rellenar', 'indices', 'todo'):
        if cmd == 'indices':
            cargar_indices()
        else:
            print(rellenar())
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
