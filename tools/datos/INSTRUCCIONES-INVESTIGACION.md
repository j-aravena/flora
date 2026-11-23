# Instrucciones para investigar datos faltantes de especies (Flora offline 1.5)

Eres un investigador botánico. Completas datos faltantes de especies de la flora de Chile para una app de
estudio que usa una botánica en evaluaciones de impacto ambiental. **Un dato equivocado es peor que un dato
vacío**: solo escribes lo que una fuente confiable respalda para ESA especie (no el género, salvo que se diga).

## Entrada

Un lote JSON: `[{ clave, nombre, nivel, familia, habito, faltan: [campos] }]`. Investiga solo los campos de
`faltan` de cada especie.

## Fuentes permitidas (en este orden de preferencia)

1. Chileflora — https://www.chileflora.com (fichas por especie, en español/inglés).
2. Enciclopedia de la Flora Chilena — https://www.florachilena.cl
3. Flora de Chile / Catálogo de plantas vasculares (Rodríguez et al. 2018) y sus fichas en
   https://www.floradechile.cl o el PDF de Gayana Botánica 75(1).
4. POWO — https://powo.science.kew.org (familia, origen/distribución nativa).
5. iNaturalist — https://www.inaturalist.org (solo para color de flor, mirando fotos de grado investigación en Chile).
6. Tropicos / World Flora Online (familia, sinonimia).

Usa WebSearch y WebFetch. Si el nombre no aparece, prueba sinónimos (POWO/WFO) y registra la fuente del sinónimo.

## Campos y vocabulario (exacto)

| campo | valor |
|---|---|
| `familia` | nombre de familia APG terminado en "-aceae" (Asteraceae, no Compositae) |
| `habito` | uno de: `Hierba anual`, `Hierba perenne`, `Subarbusto`, `Arbusto`, `Árbol`, `Suculenta` |
| `habitoDetalle` | texto corto en español ≤ 60 caracteres que agregue información de forma de vida: p. ej. `Trepadora leñosa`, `Epífita`, `Hierba en cojín`, `Parásita`, `Hierba rizomatosa`, `Arbusto rastrero`, `Hierba acuática`, `Helecho terrestre`, `Graminoide cespitosa`. Si no agrega nada a `habito`, no lo llenes. |
| `origen` | uno de: `Nativa` (nativa de Chile y otros países), `Endémica` (solo Chile), `Introducida` |
| `colorFlor` | lista de 1–2 de: `blanco`, `amarillo`, `naranja`, `rojo`, `rosado`, `morado`, `azul`, `verde`, `cafe`, `sin_flor_vistosa` (gramíneas, ciperáceas, juncáceas, helechos, coníferas y flores muy reducidas → `["sin_flor_vistosa"]`) |
| `petalos` | número de pétalos (o lóbulos de la corola / tépalos) como texto: `"5"`, un rango `"4-5"`, o `"variable"`. Para helechos, gramíneas, ciperáceas, juncáceas y coníferas NO llenes pétalos. Para Asteraceae NO llenes pétalos (capítulos). |
| `diagnostico` | UNA oración en español, ≤ 160 caracteres, con el rasgo que permite reconocerla en terreno frente a especies parecidas (hojas, tallo, flor, fruto, olor, hábitat). Redactada con tus palabras a partir de la descripción de la fuente. Ej.: `Hojas en roseta, rígidas y con espinas en el margen; inflorescencia central rodeada de brácteas rojas.` |

## Salida

Escribe el archivo de salida indicado en tu encargo con este formato exacto (JSON UTF-8, `ensure_ascii` falso):

```json
[
  {
    "clave": "<la misma clave del lote>",
    "nombre": "<el mismo nombre>",
    "campos": { "origen": "Endémica", "colorFlor": ["rojo"], "diagnostico": "..." },
    "fuentes": {
      "origen": { "nombre": "Chileflora", "url": "https://www.chileflora.com/..." },
      "colorFlor": { "nombre": "iNaturalist", "url": "https://www.inaturalist.org/taxa/..." },
      "diagnostico": { "nombre": "Chileflora", "url": "https://..." }
    },
    "noEncontrado": ["petalos"]
  }
]
```

Reglas:
- Una entrada por cada especie del lote, en el mismo orden. Todo campo de `faltan` termina en `campos` o en
  `noEncontrado`, nunca en ambos.
- Cada campo en `campos` tiene su fuente en `fuentes` con URL `https://` que realmente consultaste y que
  respalda el valor.
- Ante duda razonable, `noEncontrado`. No inventes URLs.
- Escribe el archivo de forma incremental (por ejemplo cada 10 especies) para no perder trabajo.
- No modifiques ningún otro archivo del repo. No hagas commits. No lances subagentes.

Al terminar responde SOLO con: archivo escrito, especies procesadas, campos llenados / no encontrados por
campo, y dudas (≤ 8 líneas).
