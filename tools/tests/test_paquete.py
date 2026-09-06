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
