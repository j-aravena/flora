"""Contraste WCAG de los tokens de styles.css en tema claro y oscuro (spec 1.5 §3.1)."""
import re
import sys
from pathlib import Path

PARES = [  # (texto, fondo) que deben cumplir 4.5:1
    ('--texto', '--fondo'), ('--texto', '--superficie'), ('--texto-suave', '--fondo'),
    ('--texto-suave', '--superficie'), ('--acento', '--superficie'), ('--acento-texto', '--acento'),
    ('--ambar', '--ambar-suave'), ('--rojo', '--rojo-suave'), ('--azul', '--azul-suave'), ('--acento', '--acento-suave'),
    ('--texto-tenue', '--fondo'), ('--texto-tenue', '--superficie'), ('--texto-tenue', '--superficie-2'), ('--tinta-texto', '--tinta'), ('--texto-suave', '--relleno'), ('--texto-tenue', '--relleno'),
]


def _lineal(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminancia(hex_: str) -> float:
    h = hex_.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * _lineal(r) + 0.7152 * _lineal(g) + 0.0722 * _lineal(b)


def contraste(a: str, b: str) -> float:
    la, lb = sorted((luminancia(a), luminancia(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def _bloque(css: str, selector_regex: str) -> dict:
    m = re.search(selector_regex + r'\s*\{([^}]*)\}', css)
    return dict(re.findall(r'(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})', m.group(1))) if m else {}


def tokens_de_css(css: str) -> dict:
    claro = _bloque(css, r'(?m)^:root')
    oscuro = {**claro, **_bloque(css, r':root\[data-tema="oscuro"\]')}
    return {'claro': claro, 'oscuro': oscuro}


def verificar(ruta='styles.css') -> list[str]:
    errores = []
    for tema, t in tokens_de_css(Path(ruta).read_text(encoding='utf-8')).items():
        for texto, fondo in PARES:
            if texto not in t or fondo not in t:
                errores.append(f'{tema}: falta {texto} o {fondo}')
                continue
            c = contraste(t[texto], t[fondo])
            if c < 4.5:
                errores.append(f'{tema}: {texto} sobre {fondo} = {c:.2f} < 4.5')
    return errores


if __name__ == '__main__':
    e = verificar(sys.argv[1] if len(sys.argv) > 1 else 'styles.css')
    print('\n'.join(e) or 'Contraste AA: OK')
    sys.exit(1 if e else 0)
