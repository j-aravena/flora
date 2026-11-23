import json
import zipfile

import pytest

from completar_datos import validar_registro, construir, VOCAB, normalizar


def reg(campos, fuentes=None, clave='k1', nombre='Greigia sphacelata', no=None):
    f = fuentes if fuentes is not None else {c: {'nombre': 'Chileflora', 'url': 'https://www.chileflora.com/x'} for c in campos}
    return {'clave': clave, 'nombre': nombre, 'campos': campos, 'fuentes': f, 'noEncontrado': no or []}


@pytest.mark.parametrize('campos', [
    {'habito': 'Arbusto'}, {'origen': 'Endémica'}, {'colorFlor': ['rojo', 'blanco']}, {'petalos': '5'},
    {'petalos': '4-5'}, {'petalos': 'variable'}, {'familia': 'Bromeliaceae'}, {'habitoDetalle': 'Epífita'},
    {'diagnostico': 'Roseta espinosa con brácteas rojas.'},
    {'categoriaMMA': 'Vulnerable', 'decreto': 'D.S. N° 52/2014'},
])
def test_valores_validos(campos):
    assert validar_registro(reg(campos), permitidos=set(campos)) == []


@pytest.mark.parametrize('campos', [
    {'habito': 'Liana'}, {'origen': 'Nativo'}, {'colorFlor': ['fucsia']}, {'colorFlor': ['rojo', 'azul', 'blanco']},
    {'colorFlor': []}, {'petalos': 'cinco'}, {'familia': 'Compositae'}, {'habitoDetalle': 'x' * 61},
    {'diagnostico': 'x' * 161}, {'categoriaMMA': 'Amenazada', 'decreto': 'D.S. N° 52/2014'},
    {'categoriaMMA': 'Vulnerable', 'decreto': 'DS 52/2014'}, {'categoriaMMA': 'Vulnerable'},
])
def test_valores_invalidos(campos):
    assert validar_registro(reg(campos), permitidos=set(campos)) != []


def test_fuente_obligatoria_y_https():
    assert validar_registro(reg({'habito': 'Arbusto'}, fuentes={}), permitidos={'habito'})
    assert validar_registro(reg({'habito': 'Arbusto'}, fuentes={'habito': {'nombre': 'X', 'url': 'http://a'}}), permitidos={'habito'})
    assert validar_registro(reg({'habito': 'Arbusto'}, fuentes={'habito': {'nombre': '', 'url': 'https://a'}}), permitidos={'habito'})


def test_campo_no_pedido_y_doble_estado():
    assert validar_registro(reg({'habito': 'Arbusto'}), permitidos={'origen'})
    assert validar_registro(reg({'habito': 'Arbusto'}, no=['habito']), permitidos={'habito'})


def test_vocabulario_igual_a_db_js():
    texto = open('db.js', encoding='utf-8').read()
    for nombre in ('HABITOS', 'ORIGENES', 'CATEGORIAS'):
        for v in VOCAB[nombre]:
            assert f"'{v}'" in texto


def test_construir_arma_el_zip(tmp_path):
    lotes = tmp_path / 'lotes'
    lotes.mkdir()
    (lotes / 'lote-01.json').write_text(json.dumps([
        reg({'origen': 'Endémica'}, clave='k1'),
        reg({}, clave='k2', nombre='Carex erinacea', no=['origen']),
    ]), encoding='utf-8')
    faltantes = [{'clave': 'k1', 'nombre': 'Greigia sphacelata', 'faltan': ['origen']},
                 {'clave': 'k2', 'nombre': 'Carex erinacea', 'faltan': ['origen']}]
    destino = tmp_path / 'complementos.zip'
    informe = tmp_path / 'informe.md'
    errores = construir(lotes, faltantes, destino, informe, generado='2026-11-23')
    assert errores == []
    with zipfile.ZipFile(destino) as z:
        m = json.loads(z.read('manifest.json'))
        c = json.loads(z.read('complementos.json'))
    assert m == {'formato': 1, 'tipo': 'complementos', 'version': 1, 'creado': '2026-11-23'}
    assert c == [{'id': 'k1', 'nombre': 'Greigia sphacelata', 'campos': {'origen': 'Endémica'},
                  'fuentes': {'origen': 'Chileflora — https://www.chileflora.com/x'}}]
    assert 'origen' in informe.read_text(encoding='utf-8')


def test_construir_no_escribe_con_errores(tmp_path):
    lotes = tmp_path / 'lotes'
    lotes.mkdir()
    (lotes / 'lote-01.json').write_text(json.dumps([reg({'origen': 'Nativo'})]), encoding='utf-8')
    destino = tmp_path / 'c.zip'
    errores = construir(lotes, [{'clave': 'k1', 'nombre': 'x', 'faltan': ['origen']}], destino, tmp_path / 'i.md', generado='x')
    assert errores and not destino.exists() and not (tmp_path / 'c.zip.tmp').exists()
