"""Genera icons/icon-192.png e icons/icon-512.png: fondo verde con una hoja clara."""
from pathlib import Path

from PIL import Image, ImageDraw

VERDE = (47, 107, 58, 255)
CLARO = (244, 246, 242, 255)


def icono(tam: int) -> Image.Image:
    fondo = Image.new("RGBA", (tam, tam), VERDE)
    hoja = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    d = ImageDraw.Draw(hoja)
    d.ellipse((tam * 0.32, tam * 0.16, tam * 0.68, tam * 0.84), fill=CLARO)
    d.line((tam * 0.5, tam * 0.2, tam * 0.5, tam * 0.82), fill=VERDE, width=max(2, tam // 48))
    hoja = hoja.rotate(-35, resample=Image.BICUBIC, center=(tam / 2, tam / 2))
    fondo.alpha_composite(hoja)
    return fondo.convert("RGB")


if __name__ == "__main__":
    Path("icons").mkdir(exist_ok=True)
    for tam in (192, 512):
        icono(tam).save(f"icons/icon-{tam}.png", optimize=True)
    print("íconos generados")
