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
