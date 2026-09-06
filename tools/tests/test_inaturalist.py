from flora.inaturalist import Cliente, buscar_taxon, fotos_para, nombre_consulta, seleccionar_fotos


class ClienteFalso:
    def __init__(self, respuestas):
        self.respuestas = respuestas
        self.llamadas = []

    def json(self, ruta, params):
        self.llamadas.append((ruta, dict(params)))
        return self.respuestas[(ruta, params.get("place_id"))]

    def bytes(self, url):
        return b"IMG:" + url.encode()


def _obs(id_, fotos):
    return {"id": id_, "photos": [{"url": f"https://x/photos/{i}/square.jpg", "license_code": lic, "attribution": f"(c) autor {i}"} for i, lic in fotos]}


def test_seleccionar_fotos_filtra_licencias_y_una_por_observacion():
    obs = [
        _obs(1, [(10, None), (11, "cc-by")]),
        _obs(2, [(20, "cc-by-nc"), (21, "cc0")]),
        _obs(3, [(30, None)]),
    ]
    fotos = seleccionar_fotos(obs, maximo=6)
    assert [f["url_media"] for f in fotos] == ["https://x/photos/11/medium.jpg", "https://x/photos/20/medium.jpg"]
    assert fotos[0]["licencia"] == "cc-by" and fotos[0]["autor"] == "(c) autor 11"
    assert fotos[0]["url"] == "https://www.inaturalist.org/observations/1"


def test_seleccionar_fotos_respeta_maximo():
    obs = [_obs(i, [(i, "cc0")]) for i in range(10)]
    assert len(seleccionar_fotos(obs, maximo=6)) == 6


def test_buscar_taxon_exige_coincidencia_exacta():
    c = ClienteFalso({("/taxa", None): {"results": [
        {"id": 1, "name": "Cordia decandra", "rank": "species"},
        {"id": 2, "name": "Cordia", "rank": "genus"},
    ]}})
    assert buscar_taxon(c, "Cordia decandra", "especie") == 1
    assert buscar_taxon(c, "Cordia", "genero") == 2
    assert buscar_taxon(c, "Cordia decandra", "genero") is None
    assert c.llamadas[0][1]["rank"] == "species"


def test_buscar_taxon_usa_matched_term_como_segunda_pasada():
    c = ClienteFalso({("/taxa", None): {"results": [
        {"id": 9, "name": "Aristolochia bridgesii", "rank": "species", "matched_term": "Aristolochia bridgesii"},
        {"id": 3, "name": "Aristolochia vaginans", "rank": "species", "matched_term": "Aristolochia chilensis"},
    ]}})
    assert buscar_taxon(c, "Aristolochia chilensis", "especie") == 3


def test_buscar_taxon_acepta_rango_section_para_genero():
    c = ClienteFalso({("/taxa", None): {"results": [
        {"id": 5, "name": "Eriosyce", "rank": "genus"},
        {"id": 4, "name": "Pyrrhocactus", "rank": "section"},
    ]}})
    assert buscar_taxon(c, "Pyrrhocactus", "genero") == 4
    assert c.llamadas[0][1]["rank"] == "genus,subgenus,section"


def test_fotos_para_reintenta_sin_chile():
    c = ClienteFalso({
        ("/observations", 7182): {"results": []},
        ("/observations", None): {"results": [_obs(5, [(50, "cc-by")])]},
    })
    fotos = fotos_para(c, 99)
    assert len(fotos) == 1 and fotos[0]["url_media"] == "https://x/photos/50/medium.jpg"
    assert "bytes" not in fotos[0]  # la descarga la hace quien llama, foto por foto
    assert c.llamadas[0][1]["place_id"] == 7182 and "place_id" not in c.llamadas[1][1]
    assert c.llamadas[0][1]["quality_grade"] == "research"


def test_nombre_consulta_usa_el_mapa_o_el_nombre_original():
    assert nombre_consulta("Pentaphorus foliolosus") == "Gochnatia foliolosa"
    assert nombre_consulta("Cordia decandra") == "Cordia decandra"


def test_buscar_taxon_usa_el_nombre_mapeado_en_nombres_consulta():
    c = ClienteFalso({("/taxa", None): {"results": [
        {"id": 8, "name": "Gochnatia foliolosa", "rank": "species"},
    ]}})
    assert buscar_taxon(c, "Pentaphorus foliolosus", "especie") == 8
    assert c.llamadas[0][1]["q"] == "Gochnatia foliolosa"


def test_cliente_cachea_en_disco(tmp_path):
    class Resp:
        content = b'{"ok": 1}'
        def raise_for_status(self): pass
    class Sesion:
        n = 0
        def get(self, url, params=None, headers=None, timeout=None):
            self.n += 1
            return Resp()
    s = Sesion()
    c = Cliente(tmp_path, pausa=0, sesion=s)
    assert c.json("/taxa", {"q": "a"}) == {"ok": 1}
    assert c.json("/taxa", {"q": "a"}) == {"ok": 1}
    assert s.n == 1
