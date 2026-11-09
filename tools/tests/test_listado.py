from flora.informe import Informe
from flora.listado import registro_desde_listado, registros_del_listado, separar_existentes
from flora.union import id_para

SITIO = "Nevado Tres Cruces"


def _fila(**extra):
    base = {
        "ESPECIE": "Adesmia echinus ", "Familia": "Fabaceae", "Especie_Autor": "Adesmia echinus C. Presl",
        "Habito de crecimiento": "Hierba Perenne", "Origen": "Nativa",
        "Distribución en Chile": " ANT- ATA- COQ", "Rango altitudinal": "2800-4400 m.",
        "D.S. N° 68/2009": "x", "MMA": "-", "D.S.": "-", "Boletín N°47": "-", "Atacama": "-",
        "Especie hidrófila": 0, "Tipo": 0, "Proceso 19 ECC": 0, "_fila": 5,
    }
    return base | extra


def test_registro_mapea_columnas_y_sitio():
    r = registro_desde_listado(_fila(), SITIO, "t")
    assert r["nombre"] == "Adesmia echinus"
    assert r["id"] == id_para("Adesmia echinus")
    assert r["habito"] == "Hierba perenne"
    assert r["distribucion"] == ["ANT", "ATA", "COQ"]
    assert r["ds68"] is True
    assert r["sitios"] == [SITIO]
    assert r["categoriaMMA"] == "" and r["decreto"] == "" and r["notas"] == ""


def test_notas_y_categorias_fuera_de_la_lista():
    r = registro_desde_listado(_fila(MMA="Extinta", Atacama="Vulnerable", **{"Especie hidrófila": "X", "Tipo": "Helófita leñosa"}), SITIO, "t")
    assert r["categoriaMMA"] == ""
    assert r["notas"].split("\n") == [
        "Categoría MMA en la planilla: Extinta", "Categoría en Atacama: Vulnerable", "Especie hidrófila: Helófita leñosa"]
    r = registro_desde_listado(_fila(MMA="Chile Continental: Preocupación  menor. Islas Desventuradas: En peligro"), SITIO, "t")
    assert r["categoriaMMA"] == "Preocupación Menor"
    assert "Islas Desventuradas" in r["notas"]
    assert registro_desde_listado(_fila(MMA="vulnerable"), SITIO, "t")["categoriaMMA"] == "Vulnerable"


def test_duplicados_se_fusionan_y_se_separan_existentes():
    informe = Informe()
    filas = [_fila(), _fila(_fila=6), _fila(ESPECIE="Viola gelida", _fila=7)]
    registros = registros_del_listado(filas, SITIO, "t", informe)
    assert [r["nombre"] for r in registros] == ["Adesmia echinus", "Viola gelida"]
    assert registros[0]["_filas"] == [5, 6]
    nuevos, existentes = separar_existentes(registros, {id_para("Viola gelida")})
    assert [r["nombre"] for r in nuevos] == ["Adesmia echinus"]
    assert [r["nombre"] for r in existentes] == ["Viola gelida"]
