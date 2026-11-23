// Valores derivados de la especie que no se guardan: grupo, formas de vida, hidrófila y sigla de categoría.
// No importa db.js, para que db.js y filtros.js puedan usarlo sin ciclos.

const plano = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const GRUPOS = ['Helechos y licófitas', 'Gimnospermas', 'Monocotiledóneas', 'Dicotiledóneas'];

const HELECHOS = new Set(['Aspleniaceae', 'Athyriaceae', 'Azollaceae', 'Blechnaceae', 'Cystopteridaceae', 'Dennstaedtiaceae',
  'Dicksoniaceae', 'Dryopteridaceae', 'Equisetaceae', 'Gleicheniaceae', 'Hymenophyllaceae', 'Isoetaceae', 'Lindsaeaceae',
  'Lophosoriaceae', 'Lycopodiaceae', 'Marsileaceae', 'Ophioglossaceae', 'Osmundaceae', 'Polypodiaceae', 'Pteridaceae',
  'Salviniaceae', 'Schizaeaceae', 'Selaginellaceae', 'Thelypteridaceae', 'Woodsiaceae']);
const GIMNOSPERMAS = new Set(['Araucariaceae', 'Cupressaceae', 'Ephedraceae', 'Pinaceae', 'Podocarpaceae', 'Taxaceae']);
const MONOCOTILEDONEAS = new Set(['Alismataceae', 'Alliaceae', 'Alstroemeriaceae', 'Amaryllidaceae', 'Araceae', 'Arecaceae',
  'Asparagaceae', 'Asphodelaceae', 'Asteliaceae', 'Bromeliaceae', 'Commelinaceae', 'Cyperaceae', 'Dioscoreaceae',
  'Hydrocharitaceae', 'Iridaceae', 'Juncaceae', 'Juncaginaceae', 'Lemnaceae', 'Liliaceae', 'Luzuriagaceae', 'Orchidaceae',
  'Philesiaceae', 'Poaceae', 'Potamogetonaceae', 'Restionaceae', 'Ruppiaceae', 'Smilacaceae', 'Tecophilaeaceae',
  'Themidaceae', 'Typhaceae', 'Xanthorrhoeaceae', 'Zannichelliaceae']);

export function grupoDe(e) {
  const f = (e.familia ?? '').trim();
  if (!f) return '';
  if (HELECHOS.has(f)) return 'Helechos y licófitas';
  if (GIMNOSPERMAS.has(f)) return 'Gimnospermas';
  if (MONOCOTILEDONEAS.has(f)) return 'Monocotiledóneas';
  return 'Dicotiledóneas';
}

export const FORMAS_VIDA = ['Trepadora', 'Rastrera', 'Epífita', 'Parásita'];
const RAICES_FORMA = [['trepador', 'Trepadora'], ['rastrer', 'Rastrera'], ['epifit', 'Epífita'], ['parasit', 'Parásita']];

export function formasVida(e) {
  const t = plano(e.habitoDetalle);
  return RAICES_FORMA.filter(([raiz]) => t.includes(raiz)).map(([, forma]) => forma);
}

export function esHidrofila(e) {
  return Boolean(e.hidrofila) || plano(e.notas).includes('especie hidrofila');
}

const SIGLAS = {
  'Preocupación Menor': 'LC', 'Casi amenazada': 'NT', Vulnerable: 'VU', 'En peligro': 'EN', 'En peligro crítico': 'CR',
  'Datos insuficientes': 'DD', Rara: 'R',
};

export function siglaCategoria(categoria) {
  return SIGLAS[categoria] ?? '';
}

export function nivelCategoria(categoria) {
  if (!categoria) return '';
  if (['Vulnerable', 'En peligro', 'En peligro crítico'].includes(categoria)) return 'amenazada';
  if (categoria === 'Casi amenazada') return 'casi';
  return 'otra';
}
