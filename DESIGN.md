---
name: Flora
description: Catálogo offline de flora como una carta de vegetación moderna; la foto manda y la interfaz es la leyenda.
colors:
  fondo: "#f6f7f4"
  superficie: "#ffffff"
  superficie-2: "#eef1ec"
  relleno: "#f0f2ee"
  borde: "#e2e7e0"
  texto: "#0f1a13"
  texto-suave: "#4f5d54"
  texto-tenue: "#5f6b63"
  acento: "#1d5a36"
  acento-suave: "#e6f0e8"
  tinta: "#163a24"
  ambar: "#8a5300"
  ambar-suave: "#fbf1de"
  rojo: "#b42318"
  rojo-suave: "#fdecea"
  azul: "#1c5d99"
  azul-suave: "#e7f0f9"
  fondo-noche: "#0b100d"
  superficie-noche: "#121915"
  acento-noche: "#7fd6a0"
  texto-noche: "#e8efe9"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'calt', 'kern'"
  label:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 550
    lineHeight: 1.3
rounded:
  insignia: "9999px"
  pildora: "9999px"
  ctrl: "14px"
  alternativa: "18px"
  diagnostico: "20px"
  tarjeta: "24px"
  hoja: "28px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.tinta}"
    textColor: "#ffffff"
    rounded: "{rounded.pildora}"
    height: "48px"
    padding: "0 20px"
  button-secondary:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.pildora}"
    height: "48px"
    padding: "0 20px"
  input:
    backgroundColor: "{colors.relleno}"
    textColor: "{colors.texto}"
    rounded: "{rounded.ctrl}"
    height: "48px"
    padding: "10px 14px"
  input-buscador:
    backgroundColor: "{colors.relleno}"
    textColor: "{colors.texto}"
    rounded: "{rounded.pildora}"
    height: "52px"
  pildora-filtro:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.pildora}"
    height: "44px"
    padding: "0 16px 0 12px"
  pildora-filtro-activo:
    backgroundColor: "{colors.acento-suave}"
    textColor: "{colors.acento}"
  tarjeta:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.tarjeta}"
    padding: "18px"
  insignia:
    backgroundColor: "{colors.superficie-2}"
    textColor: "{colors.texto-suave}"
    rounded: "{rounded.insignia}"
    padding: "4px 8px"
  alternativa:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.alternativa}"
    padding: "12px 18px"
  alternativa-correcta:
    backgroundColor: "{colors.tinta}"
    textColor: "#ffffff"
---

# Design System: Flora

## Overview

**Creative North Star: "La carta de vegetación"**

Flora se lee como una carta de vegetación moderna: la fotografía de la planta es el mapa y la interfaz es la leyenda que lo acompaña. El lienzo es un blanco verdoso muy claro, sin crema; la tinta es un verde bosque casi negro; hay un solo acento, bosque profundo. Todo es sobrio y exacto: bordes de 1 px, una sombra mínima, tarjetas amplias y controles en píldora. La referencia vinculante es shadcn/ui (peso mayor) con Raycast, con tintes verdes de naturaleza.

El color de flor no es una franja ni un fondo: es un cuadrado de leyenda de 10 px con su palabra al lado, como en la clave de un mapa. La densidad es baja y cada texto se gana su lugar. De noche el sistema pasa a un bosque nocturno (#0b100d) con acento menta, sin cambiar de estructura.

**Key Characteristics:**
- Lienzo claro neutro-verdoso, tinta bosque, un único acento.
- Tarjetas de 24 px, controles en píldora, inputs rellenos sin borde visible.
- Profundidad por borde de 1 px y sombra leve; casi plana.
- Iconos SVG de trazo 1.75 en línea; nombres científicos en cursiva.
- Todo objetivo táctil de 44 a 48 px; contraste AA en ambos temas.

## Colors

Paleta de un solo acento verde sobre neutros con matiz verde; ámbar, rojo y azul son solo semánticos.

### Primary
- **Bosque profundo** (`acento` #1d5a36; menta #7fd6a0 de noche): enlaces, píldora activa, indicadores, progreso, foco, texto de estado "correcto".
- **Tinta bosque** (`tinta` #163a24; menta de noche): relleno de botón primario, botón flotante y alternativa correcta. Es el único relleno oscuro y macizo.
- **Musgo claro** (`acento-suave` #e6f0e8): fondo del filtro activo, de la sección activa en la barra, del cuadro "Para reconocerla" y de los chips.

### Neutral
- **Lienzo** (`fondo` #f6f7f4) y **Superficie** (`superficie` #ffffff): lienzo de página y tarjetas. **Superficie 2** (#eef1ec): hover, miniaturas, insignia neutra. **Relleno** (#f0f2ee): inputs y control segmentado.
- **Borde** (#e2e7e0): todas las líneas de 1 px.
- **Tinta de texto** (`texto` #0f1a13), **texto-suave** (#4f5d54) y **texto-tenue** (#5f6b63): jerarquía de lectura; tenue es el mínimo AA para metadatos.
- **Noche**: fondo #0b100d, superficie #121915, texto #e8efe9; el resto de tokens tienen su par en `:root[data-tema="oscuro"]` y en `prefers-color-scheme`.

### Semántico
- **Ámbar** (#8a5300 / suave #fbf1de): faltantes, casi amenazada, aviso. **Rojo** (#b42318 / suave #fdecea): amenazada, error, respuesta incorrecta. **Azul** (#1c5d99 / suave #e7f0f9): hidrófila.

### Named Rules
**The Una Sola Tinta Rule.** El verde bosque es el único acento; ámbar, rojo y azul solo significan estado o categoría, nunca decoran.
**The Leyenda Rule.** El color de flor se muestra como cuadrado de 10 px (12 px en la ficha) con su palabra; nunca como fondo, franja ni borde de tarjeta.

## Typography

**Display / Body Font:** Inter variable, latín, empaquetada en `vendor/inter` (con system-ui, Roboto como respaldo). Sin red.

**Character:** una sola familia, pesos 400 a 650 y tracking apretado en títulos. Las alternativas estilísticas de Inter no se usan: `font-feature-settings: 'calt', 'kern'`. Los nombres científicos van en cursiva.

### Hierarchy
- **Display** (650, 2.25rem, 1.15, -0.04em): "Flora" en Lista y carga; marcador de resultados.
- **Headline** (650, 1.9rem, -0.035em): nombre de la especie en la ficha. h1 genérico 1.75rem.
- **Title** (600 a 650, 1.05 a 1.3rem, -0.01 a -0.02em): h2 de secciones, enunciado de pregunta (1.3rem), respuesta de repaso (1.4rem).
- **Body** (400 a 550, 1rem, 1.5): texto corrido y nombres en filas (1.02rem, 550).
- **Label** (500 a 650, .72 a .9rem): leyenda de fila (.85rem), insignias (.72rem, 650, +.02em), barra inferior (.75rem), conteos con `tabular-nums`.

### Named Rules
**The Cursiva Científica Rule.** Todo nombre científico va en cursiva; es la señal de especie, no un adorno.
**The Cifras Tabulares Rule.** Contadores, avance, indicadores e insignias usan `font-variant-numeric: tabular-nums`.

## Layout

Una columna centrada de máximo 720 px con 16 px de margen lateral y espacio inferior para la barra (68 px) más un flotante. Ritmo de 4/8/16/20/28 px. La Lista es una sola tarjeta con filas de 76 px mínimo (foto de 56 px, nombre, línea de leyenda separada por puntos medios) y divisores que arrancan bajo la foto (left 86 px). Los filtros son una fila de píldoras con desplazamiento horizontal sin barra. La galería de la ficha se desliza con snap (alto hasta 56vh); en Estudio es más baja (38vh). Alternativas del cuestionario a ancho completo, apiladas. Objetivos táctiles: 48 px en botones e inputs, 44 px en píldoras y segmentos.

## Elevation & Depth

Casi plano: la jerarquía viene del borde de 1 px y del contraste superficie sobre lienzo, con una sombra leve para elevar.

- **Sombra 1** (`0 1px 2px rgb(15 26 19 / .05), 0 1px 3px rgb(15 26 19 / .06)`): tarjetas, botones secundarios, píldoras, alternativas.
- **Sombra 2** (`0 8px 24px -6px rgb(15 26 19 / .18), 0 2px 6px rgb(15 26 19 / .08)`): solo lo que flota: botón flotante, aviso, hoja de filtros.
- La barra inferior y los grupos sticky usan la superficie al 90 a 94% con desenfoque; en oscuro las sombras son negras y más densas.

**The Plano en Reposo Rule.** El botón primario y los elementos rellenos de color no llevan sombra; la sombra 2 es solo para superficies flotantes.

## Shapes

Familia redonda y suave. Tarjetas y listas 24 px; hoja inferior 28 px arriba; bloque diagnóstico 20 px; alternativas 18 px; inputs 14 px; miniaturas 14 px (56 px) y 12 px (44 px); fotos de galería 24 px. Botones, píldoras, buscador, insignias, segmentos y progreso son totalmente redondos (9999 px). Muestra de color: cuadrado de 3 px de radio con un anillo interior de 1 px. Iconos: trazo 1.75, 24x24, extremos redondeados, hechos con `ui/iconos.js` y color `currentColor`.

## Components

### Buttons
- **Shape:** píldora (9999 px), 48 px de alto, 0 20 px de padding, peso 550.
- **Primario:** relleno `tinta`, texto blanco (oscuro: menta con texto #062012), sin sombra; hover mezcla 12% con el texto.
- **Secundario:** superficie con borde de 1 px y sombra 1; hover superficie 2. Variantes de estado `se`, `falta`, `no` solo cambian el color de texto y borde.
- **Icono:** círculo de 48 px transparente. Activo: escala .98.

### Chips y píldoras de filtro
- Píldora de 44 px, superficie con borde y sombra 1; activa en musgo claro con texto acento y borde al 45%. Los selects se estilan como píldoras. Chips de filtros aplicados de 36 px en musgo sin borde.

### Cards / Containers
- Superficie blanca, borde de 1 px, 24 px de radio, sombra 1, padding 18 px. La Lista y `.campos` (definiciones en dos columnas 5/7 con divisores) siguen el mismo patrón.

### Inputs / Fields
- Relleno `relleno`, borde transparente, 14 px de radio, 48 px de alto. Foco: fondo superficie, borde acento y halo de 3 px en musgo claro. Buscador: píldora de 52 px con lupa a la izquierda.

### Navigation
- Barra inferior fija de 68 px, translúcida con desenfoque y borde superior. Icono sobre texto de .75rem; la sección activa pone el icono en una píldora musgo con tinta de texto. Un punto ámbar marca avisos.

### Leyenda de fila (componente de firma)
- Línea bajo el nombre: familia · cuadrado de color + palabra · insignias, separadas por puntos medios. Insignias en píldora: neutra, amenazada (rojo), casi (ámbar), hidrófila (azul), AI (musgo).

### Alternativa de Estudio
- Botón de 52 px, 18 px de radio, superficie con borde y sombra 1. Correcta: relleno tinta con texto claro. Incorrecta: fondo rojo suave y borde rojo. Las demás se atenúan al 45%.

### Motion
- Transiciones de 150 ms en color y fondo; hoja y aviso entran con `cubic-bezier(.16, 1, .3, 1)` en 300 ms; `prefers-reduced-motion` lo anula todo.

## Do's and Don'ts

### Do:
- **Do** dejar que la foto de la planta sea lo más grande y la interfaz se retire.
- **Do** usar un solo acento bosque (`acento`) y reservar el relleno macizo (`tinta`) para la acción principal y la respuesta correcta.
- **Do** mostrar el color de flor como cuadrado de leyenda con su palabra.
- **Do** mantener objetivos de 44 a 48 px y contraste AA en claro y oscuro (verificar con `tools/contraste.py`).
- **Do** definir cada color nuevo con su par oscuro en los dos bloques de tema.

### Don't:
- **Don't** usar fondos crema, tarjetas verdes saturadas ni franjas de color (rechazo explícito de la app de plantas típica).
- **Don't** usar color de flor como fondo, borde o franja de tarjeta.
- **Don't** agregar iconos de glifo o emoji; los iconos son SVG de trazo 1.75.
- **Don't** reintroducir el ornamento de contorno (`--contorno`), retirado en la revisión final, ni las alternativas ss01/cv11 de Inter.
- **Don't** meter texto de relleno: si no ayuda a reconocer o estudiar, no va.
