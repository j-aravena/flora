# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Una botánica que hace evaluaciones de impacto ambiental en Chile (Chiloé, Chacao Chonchi y otros sitios). La usa en dos escenas: en terreno, de pie, a pleno sol, con guantes o una mano ocupada y sin señal, para identificar una especie y saber si está en el listado del sitio o registrada antes en el AI; y en casa, con calma, para estudiar y memorizar especies. Ahora también se mostrará a otras personas del rubro, que mostraron entusiasmo.

## Product Purpose
Catálogo offline de flora (unas 740 especies con fotos) con filtros de terreno, ficha por especie y un cuestionario de estudio por rondas. El éxito es reconocer una especie rápido en terreno y aprenderlas de verdad con el estudio.

## Positioning
Funciona completo sin conexión en el teléfono, con los listados reales de los sitios de trabajo (orden del listado, registro AI, categorías de conservación) y fotos propias; no es una guía genérica de flora.

## Operating Context
PWA instalada en un teléfono Android; uso a una mano; luz solar directa y también de noche. Datos en IndexedDB; respaldo por archivo exportado. Publicada en GitHub Pages.

## Capabilities and Constraints
Vanilla ES modules sin build, Dexie/IndexedDB, service worker con caché por versión. Pantallas: Lista (búsqueda, filtros principales y "Más filtros", orden), Ficha, Editar, Estudio (cuestionario por rondas y Repasar), Ajustes (tema, respaldo, datos). Tema claro y oscuro. Sin dependencias de red en tiempo de uso: fuentes y recursos van en el repo.

## Brand Commitments
Nombre "Flora". Referencias visuales que el usuario hizo vinculantes: el DESIGN.md de Raycast y el DESIGN.md de shadcn/ui ("sobrio y elegante"), pesando más shadcn, con tintes verdes modernos de naturaleza. Mostrar solo lo esencial: nada de texto o detalle de relleno.

## Evidence on Hand
Fotos reales de especies (semilla/), listados de sitios, categorías MMA. No hay testimonios ni métricas; no inventarlos.

## Product Principles
- Terreno primero: legible al sol, objetivos táctiles grandes, una mano.
- Solo lo esencial: cada texto en pantalla se gana su lugar.
- La foto de la planta es la protagonista; la interfaz se retira.
- Offline siempre: nada depende de la red.
- Datos completados se distinguen y se pueden revisar.

## Accessibility & Inclusion
Contraste AA en ambos temas (verificado por tools/contraste.py); objetivos táctiles de 48 px.
