# Spike de fuentes (10 especies de lote-01: Acaena x3, Adesmia x7)

Campos faltantes en esas 10: solo `habitoDetalle` (9) y `diagnostico` (10). En los 15 lotes: diagnostico 724, habitoDetalle 623,
colorFlor 193, petalos 182, origen 176, familia 14, habito 8. Por eso las fuentes se probaron tambien para esos campos.
Todo con `curl` (User-Agent Mozilla) por Bash; WebFetch resume y no sirve para crawl.

## Resultado en las 10 especies
- diagnostico: 1/10 (Adesmia confusa, Wikipedia es). habitoDetalle: 0/10. Resto en noEncontrado.
- origen (no faltaba, medido como prueba): WCVP via GBIF 8/10; RBGE 4/10 (todas endemicas); Chileflora 3/10 (ficha por especie).

## Fuentes
| fuente | busqueda por nombre | campos | fiabilidad | acierto (10 sp.) |
|---|---|---|---|---|
| Chileflora indice | `https://www.chileflora.com/Florachilena/FloraEnglish/PIC_FAMILIES_{0..280}.php` (281 pag., 2278 nombres -> `HighResPages/EH####.htm`). Ficha: `.../FloraEnglish/HighResPages/EH####.htm` | origen (Native/Endemic/Introduced), altura, nombres comunes. SIN descripcion morfologica | alta para origen | 3/10 en indice (Acaena pinnatifida, A. sericea, Adesmia confusa) |
| Chileflora clave tipo/color/petalos | `.../FloraEnglish/PIC_PLANT_FLOWER_{0..216}.php` (214 pag. utiles, 1706 especies). Tipo y color/petalos estan en `alt` de las imagenes de H1/H2 | habito (Shrub/Perennial...), colorFlor, petalos | media: una especie sale en varias categorias (A. pinnatifida: Green 6, Red, Green 7-14; Acaena no tiene petalos reales) -> usar solo si hay UNA categoria; "No info" -> vacio | 2/10 (A. confusa: Shrub, Yellow, 5 petals; A. sericea: No info) |
| GBIF -> WCVP (sustituye POWO) | `https://api.gbif.org/v1/species/match?name=<Genero%20especie>` -> usageKey; `https://api.gbif.org/v1/species/<key>/distributions?limit=200` (fuente "World Checklist of Vascular Plants", localidades TDWG: "Chile Central/North/South", etc.). Enlace citable: `https://www.gbif.org/species/<key>` | familia (en la respuesta match), origen: solo Chile => Endemica; Chile + vecinos => Nativa | familia: alta. Origen: buena pero NO distingue introducido (A. pinnatifida lista "California", que es introducida alli) y varias vacias | 8/10 con distribucion; vacios: Adesmia confusa, A. viscida |
| POWO | CLOUDFLARE 403 para curl y WebFetch (API y paginas) | - | inutilizable | 0/10 |
| RBGE "Plantas endemicas de Chile" | indice `https://chileanendemics.rbge.org.uk/es/indexes/taxa` (805 slugs con autor); ficha `https://chileanendemics.rbge.org.uk/es/taxa/<slug>` | confirma Endemica (si esta en la lista, es endemica); regiones; sin descripcion en estas fichas | alta (RBGE) | 4/10 (A. bracteata, confusa, tenella, viscida) |
| Wikipedia es | `https://es.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&redirects=1&titles=<Nombre_especie>` (REST summary tambien). Limite 429 si se manda rafaga: 1 req/2 s | diagnostico solo si hay seccion "Descripcion" | media (copias de Flora; ok como cita) | existe 9/10 pero casi todos stubs de 1 linea; descripcion real solo A. confusa (1/10) |
| Wikipedia en | misma API en en.wikipedia.org | idem | stub | 0 morfologia (A. pinnatifida: solo distribucion) |
| iNaturalist API | `https://api.inaturalist.org/v1/taxa?q=<nombre>&rank=species` funciona (curl); paginas web dan 403 | enlace a wikipedia_url; sin descripcion propia; color de flor no es consultable por API | util solo como indice | n/a |
| IPNI | `https://www.ipni.org/api/1/search?q=<nombre>` | familia (sinonimo Leguminosae), autores; sin distribucion | alta para familia | 10/10 |
| florachilena.cl | vivo: TLS no confiable (curl 60) y http da 406. Wayback: `http://web.archive.org/web/2015/http://www.florachilena.cl/especies.php?id=N` SI trae ficha rica (habito, hojas, flores, origen) | habito, color, origen, descripcion | alta, pero NO escalable: solo la pagina 1 del indice (A-Aca...) esta archivada (`especiesporfiltro.php?idtag=2&idopcion=2`; `&cur=N` da 404), ids dispersos, y archive.org bloquea rafagas (error 7/offline) | 0/10 (Adesmia confusa/aegiceras no localizables por nombre) |
| MMA clasificacionespecies | buscador WP `?s=` no devuelve fichas; solo especies clasificadas | nada util | - | 0/10 |
| floradechile.cl | DOMINIO SECUESTRADO (sitio de casinos). NO USAR, estaba en las instrucciones | - | peligrosa | - |
| worldfloradb.net | Anubis (anti-bot) | - | bloqueado | 0 |
| Flora de Chile (Rodriguez 2018), SciELO/Gayana, Darwinion | no probados a fondo; PDFs sin busqueda por nombre | descripciones (candidato para diagnostico) | alta | no medido |

## Llamadas por especie (estimado)
- Preparacion unica (crawl): ~500 GET (281 + 217 Chileflora) + 1 RBGE -> indices locales name->origen/tipo/color/petalos. 0 por especie despues.
- Por especie: GBIF match + distributions = 2; Chileflora ficha = 1 (origen); Wikipedia es = 1; total ~4 por especie con script, o ~1 si se usa solo el crawl local.
- diagnostico/habitoDetalle por navegacion manual con WebSearch+WebFetch: 3-6 llamadas/especie y rendimiento ~0-10%.

## Receta recomendada
1. Script (no agente) con indices locales: familia (GBIF match/IPNI), origen (RBGE endemica -> Endemica; WCVP solo Chile -> Endemica; Chile + vecinos -> Nativa, revisar introducidas; Chileflora Native/Endemic/Introduced como confirmacion y para Introducida), habito/colorFlor/petalos de la clave Chileflora solo si hay una unica categoria no ambigua (nunca petalos para Acaena/Asteraceae/graminoides).
2. diagnostico y habitoDetalle: NO hay fuente web escalable en estas especies (descripciones morfologicas casi inexistentes en fuentes indexables). Rendimiento esperado: ~10% via seccion "Descripcion" de Wikipedia es. Aceptar el vacio, o ingresar a mano desde Flora de Chile/Marticorena si se quiere cobertura.
3. Pausar 2 s entre pedidos a Wikipedia y archive.org; Chileflora tolera 8 en paralelo.
