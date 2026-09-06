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


def test_votar_colores_exige_al_menos_la_mitad_de_las_fotos_analizadas():
    # Una sola foto analizada nunca alcanza el umbral (mínimo 2 votos): no se infiere color.
    assert votar_colores([["rojo"]]) == []
    # Tres fotos, dos coinciden en rojo: alcanza max(2, ceil(3/2)) = 2 votos.
    assert votar_colores([["azul"], ["rojo"], ["rojo"]]) == ["rojo"]
    # Cuatro fotos con dos colores empatados en 2 votos cada uno: se conservan ambos (máximo dos).
    assert votar_colores([["rojo"], ["rojo"], ["amarillo"], ["amarillo"]]) == ["rojo", "amarillo"]


def test_aplicar_rasgos_combina_csv_fotos_y_reglas():
    registros = [
        {"id": "a", "nombre": "Adesmia confusa", "familia": "Fabaceae", "nivel": "especie"},
        {"id": "b", "nombre": "Poa gayana", "familia": "Poaceae", "nivel": "especie"},
        {"id": "c", "nombre": "Mutisia cana", "familia": "Asteraceae", "nivel": "especie"},
    ]
    fotos = [
        # Dos fotos por especie: con una sola foto no se infiere color (umbral mínimo 2 votos).
        {"especieId": "b", "blob": _webp((220, 30, 30))},
        {"especieId": "b", "blob": _webp((220, 30, 30))},
        {"especieId": "c", "blob": _webp((60, 80, 220))},
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
    assert a["colorFlor"] == ["amarillo"] and a["petalos"] == "5" and a["petalosNota"] == "Pétalos. papilionada"
    assert "https://x/a" in a["rasgosFuente"] and "https://x/f" in a["rasgosFuente"]
    assert b["colorFlor"] == ["rojo"] and b["petalos"] == "" and b["petalosNota"] == ""
    assert "Color estimado desde las fotos" in b["rasgosFuente"]
    assert c["colorFlor"] == ["rosado"]
    assert inf.secciones["Color desde fotos"] == ["Poa gayana: rojo"]
    assert inf.secciones["Color en desacuerdo"] == ["Mutisia cana: csv rosado, fotos azul"]
    assert inf.secciones["Sin regla de pétalos"] == ["Poa gayana", "Mutisia cana"]
    assert any(l.startswith("Color desde CSV: 2") for l in inf.secciones["Rasgos"])


def test_aplicar_rasgos_no_contradice_sin_flor_vistosa_con_fotos():
    registros = [{"id": "d", "nombre": "Poa gayana", "familia": "Poaceae", "nivel": "especie"}]
    fotos = [{"especieId": "d", "blob": _webp((220, 30, 30))}]
    colores = {"poa gayana": {"colores": ["sin_flor_vistosa"], "fuente": "https://x/q", "nota": ""}}
    inf = Informe()
    aplicar_rasgos(registros, fotos, colores, {}, inf)
    assert registros[0]["colorFlor"] == ["sin_flor_vistosa"]
    assert inf.secciones.get("Color en desacuerdo", []) == []
