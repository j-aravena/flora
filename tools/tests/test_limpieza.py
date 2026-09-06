from flora.limpieza import (
    limpiar_texto, clave, normalizar_categoria, normalizar_habito, normalizar_ciclo,
    normalizar_ds68, dividir_distribucion, nivel_y_nombre,
)


def test_limpiar_texto_recorta_y_vacia_guion():
    assert limpiar_texto("  Hierba ") == "Hierba"
    assert limpiar_texto("-") == ""
    assert limpiar_texto(None) == ""


def test_limpiar_texto_reemplaza_espacio_de_no_separacion():
    assert limpiar_texto("Hierba perenne") == "Hierba perenne"
    assert limpiar_texto("  Arbusto ") == "Arbusto"


def test_clave_ignora_mayusculas_tildes_y_espacios():
    assert clave("  Adesmia  CONFUSA ") == "adesmia confusa"
    assert clave("Árbol") == "arbol"


def test_normalizar_categoria_unifica_variantes():
    assert normalizar_categoria("LC") == "Preocupación Menor"
    assert normalizar_categoria(" Preocupación menor") == "Preocupación Menor"
    assert normalizar_categoria("Casi amenazada") == "Casi amenazada"
    assert normalizar_categoria("-") == ""


def test_normalizar_habito_pone_minuscula_en_segunda_palabra():
    assert normalizar_habito("Hierba Anual") == "Hierba anual"
    assert normalizar_habito("Hierba Perenne") == "Hierba perenne"
    assert normalizar_habito("Árbol") == "Árbol"
    assert normalizar_habito(None) == ""


def test_normalizar_ciclo():
    assert normalizar_ciclo(" Anual o bienal") == "Anual o bienal"
    assert normalizar_ciclo("Perenne") == "Perenne"
    assert normalizar_ciclo(None) == ""


def test_normalizar_ds68_acepta_x_y_originaria():
    assert normalizar_ds68("X") is True
    assert normalizar_ds68("Originaria") is True
    assert normalizar_ds68("-") is False
    assert normalizar_ds68(None) is False


def test_dividir_distribucion():
    assert dividir_distribucion(" COQ- VAL- RME- LBO") == ["COQ", "VAL", "RME", "LBO"]
    assert dividir_distribucion(" AYP- TAR- MAG-") == ["AYP", "TAR", "MAG"]
    assert dividir_distribucion(None) == []


def test_nivel_y_nombre_detecta_genero_familia_y_corrige():
    assert nivel_y_nombre("Adesmia confusa") == ("especie", "Adesmia confusa")
    assert nivel_y_nombre("Dioscorea sp.") == ("genero", "Dioscorea")
    assert nivel_y_nombre("Lycium sp") == ("genero", "Lycium")
    assert nivel_y_nombre("Pyrrhocactus ") == ("genero", "Pyrrhocactus")
    assert nivel_y_nombre("Fabaceae") == ("familia", "Fabaceae")
    assert nivel_y_nombre("Schinus montanas") == ("especie", "Schinus montanus")


def test_nivel_y_nombre_corrige_nombres_sucios():
    assert nivel_y_nombre("Populus alba L.") == ("especie", "Populus alba")
    assert nivel_y_nombre("cistanthe arenaria") == ("especie", "Cistanthe arenaria")
