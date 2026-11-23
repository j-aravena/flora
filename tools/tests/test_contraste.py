from contraste import contraste, tokens_de_css, verificar

def test_contraste_conocido():
    assert round(contraste('#000000', '#ffffff'), 1) == 21.0
    assert round(contraste('#2f6b3a', '#ffffff'), 2) > 4.5

def test_tokens_de_css_lee_claro_y_oscuro():
    css = (":root { --fondo: #f3f5f0; --texto: #18211a; }\n"
           ":root[data-tema=\"oscuro\"] { --fondo: #0a0d0b; --texto: #eef3ee; }\n")
    t = tokens_de_css(css)
    assert t['claro']['--fondo'] == '#f3f5f0'
    assert t['oscuro']['--texto'] == '#eef3ee'

def test_styles_css_cumple_aa():
    assert verificar('styles.css') == []
