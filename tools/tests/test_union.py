from flora.informe import Informe
from flora.union import (
    id_para, registro_desde_base, registro_desde_prefactibilidad, fusionar_duplicados, unir,
    inferir_familias,
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
    assert r["_filas"] == [7] and r["_filas_pref"] == []


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
    assert por_nombre["Adesmia confusa"]["_filas"] == [7]
    assert por_nombre["Adesmia confusa"]["_filas_pref"] == [2]
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


def test_registro_desde_base_anota_correccion_de_nombre_en_informe():
    inf = Informe()
    registro_desde_base(_fila_base(Especie="Schinus montanas"), AHORA, inf)
    assert inf.secciones["Correcciones de nombre"] == ["Schinus montanas -> Schinus montanus"]


def test_registro_desde_base_no_anota_nada_si_no_hay_correccion():
    inf = Informe()
    registro_desde_base(_fila_base(), AHORA, inf)
    assert "Correcciones de nombre" not in inf.secciones


def test_registro_desde_prefactibilidad_anota_correccion_de_nombre_en_informe():
    inf = Informe()
    fila = {"Especie": "Tetraglochin alata", "Origen": "-", "Hábito": "-",
            "D.S.N°68/2009": "-", "RCE": "-", "_fila": 3}
    registro_desde_prefactibilidad(fila, AHORA, inf)
    assert inf.secciones["Correcciones de nombre"] == ["Tetraglochin alata -> Tetraglochin alatum"]


def test_inferir_familias_por_genero_nivel_familia_y_genero_ambiguo():
    registros = [
        {"nombre": "Adesmia confusa", "nivel": "especie", "familia": "Fabaceae"},
        {"nombre": "Adesmia viscida", "nivel": "especie", "familia": ""},
        {"nombre": "Fabaceae", "nivel": "familia", "familia": ""},
        {"nombre": "Senecio precatorius", "nivel": "especie", "familia": "Asteraceae"},
        {"nombre": "Senecio francisci", "nivel": "especie", "familia": "Compositae"},
        {"nombre": "Senecio bustillosii", "nivel": "especie", "familia": ""},
    ]
    inf = Informe()
    inferir_familias(registros, inf)
    por_nombre = {r["nombre"]: r for r in registros}
    assert por_nombre["Adesmia viscida"]["familia"] == "Fabaceae"
    assert por_nombre["Fabaceae"]["familia"] == "Fabaceae"
    assert por_nombre["Senecio bustillosii"]["familia"] == ""
    inferidas = inf.secciones["Familias inferidas"]
    assert "Adesmia viscida: Fabaceae" in inferidas
    assert "Fabaceae: Fabaceae" in inferidas
    assert not any("Senecio bustillosii" in x for x in inferidas)
