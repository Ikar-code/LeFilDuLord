import { supabase, PEXELS_API_KEY, UNSPLASH_ACCESS_KEY, PIXABAY_API_KEY } from './clients.js';
import { log } from './logger.js';

const RESULTATS_PAR_RECHERCHE = 15;
const MIN_RESULTATS_RECHERCHE_TITRE = 3; // en dessous, la recherche par titre est jugée peu pertinente
const IMAGES_RECENTES_A_EVITER = 40;

// Mapping catégorie -> mots-clés de recherche d'image (les banques d'images répondent mieux en anglais).
// Les clés sont EXACTEMENT les slugs de CATEGORIES_AUTORISEES (step1_findTopics.js).
const CATEGORY_KEYWORDS = {
  vulnerabilites: 'software vulnerability source code security',
  cyberattaques: 'cyber attack computer security',
  'ransomware-malwares': 'ransomware malware locked computer',
  'fuites-donnees': 'data breach privacy security',
  'arnaques-phishing': 'phishing email scam laptop',
  'ia-securite': 'artificial intelligence cybersecurity',
  reglementation: 'data protection law regulation',
  'geopolitique-cyber': 'cyber warfare network world map',
  'outils-bonnes-pratiques': 'password security two factor authentication',
  evenements: 'technology conference event',
  reunion: 'Reunion Island landscape'
};

const DEFAULT_KEYWORDS = 'cybersecurity technology';

// Mots trop courants pour être utiles dans une recherche d'image.
const MOTS_VIDES = new Set([
  'avec', 'dans', 'pour', 'sans', 'sous', 'vers', 'chez', 'sont', 'être', 'etre', 'cette', 'cettes',
  'leurs', 'leur', 'nous', 'vous', 'elle', 'elles', 'ainsi', 'après', 'apres', 'avant', 'depuis',
  'entre', 'contre', 'selon', 'plus', 'moins', 'très', 'tres', 'tout', 'tous', 'toute', 'toutes',
  'comme', 'mais', 'donc', 'alors', 'aussi', 'encore', 'déjà', 'deja', 'nouvelle', 'nouveau',
  'nouvelles', 'nouveaux', 'fait', 'faire', 'peut', 'peuvent', 'sera', 'serait', 'aurait', 'comment',
  'pourquoi', 'quand', 'quels', 'quelle', 'quelles', 'dont', 'ceux', 'celui', 'après', 'cyberattaque',
  'cyberattaques', 'piratage', 'faille', 'failles', 'sécurité', 'securite'
]);

function getKeywords(categorie) {
  if (!categorie) return DEFAULT_KEYWORDS;
  const normalise = categorie.toLowerCase().trim();
  return CATEGORY_KEYWORDS[normalise] || DEFAULT_KEYWORDS;
}

// Extrait 3 mots significatifs du titre (noms propres en priorité : Microsoft, LockBit, CVE...).
export function motsClesDuTitre(titre, max = 3) {
  const mots = (titre || '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((m) => m.length >= 4 && !/^\d+$/.test(m) && !MOTS_VIDES.has(m.toLowerCase()));

  const propres = mots.filter((m) => /^\p{Lu}/u.test(m));
  const autres = mots.filter((m) => !/^\p{Lu}/u.test(m));
  return [...new Set([...propres, ...autres])].slice(0, max).join(' ');
}

async function searchPexels(keywords) {
  if (!PEXELS_API_KEY) return [];

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(keywords)}&per_page=${RESULTATS_PAR_RECHERCHE}&orientation=landscape`;
  const response = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
  if (!response.ok) throw new Error(`Pexels: statut HTTP ${response.status}`);

  const data = await response.json();
  return (data.photos || []).map((p) => p.src.large).filter(Boolean);
}

async function searchUnsplash(keywords) {
  if (!UNSPLASH_ACCESS_KEY) return [];

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keywords)}&per_page=${RESULTATS_PAR_RECHERCHE}&orientation=landscape`;
  const response = await fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } });
  if (!response.ok) throw new Error(`Unsplash: statut HTTP ${response.status}`);

  const data = await response.json();
  return (data.results || []).map((p) => p.urls.regular).filter(Boolean);
}

async function searchPixabay(keywords) {
  if (!PIXABAY_API_KEY) return [];

  const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keywords)}&per_page=${RESULTATS_PAR_RECHERCHE}&orientation=horizontal&image_type=photo`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Pixabay: statut HTTP ${response.status}`);

  const data = await response.json();
  return (data.hits || []).map((h) => h.largeImageURL).filter(Boolean);
}

// Images déjà utilisées par les derniers articles : on les évite pour ne pas afficher la même photo.
async function imagesRecentes() {
  const { data, error } = await supabase
    .from('articles')
    .select('image_url')
    .not('image_url', 'is', null)
    .order('date_creation', { ascending: false })
    .limit(IMAGES_RECENTES_A_EVITER);

  if (error) return new Set();
  return new Set((data || []).map((a) => a.image_url));
}

function choisirAuHasard(urls, aEviter) {
  const neuves = urls.filter((u) => !aEviter.has(u));
  const pool = neuves.length > 0 ? neuves : urls;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Cherche une image : d'abord avec les mots-clés du titre, puis avec ceux de la catégorie.
// Pour chaque recherche, on essaie Pexels -> Unsplash -> Pixabay, et on tire UNE image au hasard
// parmi une quinzaine de résultats (hors images récemment utilisées).
export async function findImage(categorie, titre = '') {
  const sources = [
    { name: 'Pexels', fn: searchPexels },
    { name: 'Unsplash', fn: searchUnsplash },
    { name: 'Pixabay', fn: searchPixabay }
  ];

  const recherches = [];
  const motsTitre = categorie === 'reunion' ? '' : motsClesDuTitre(titre);
  if (motsTitre) {
    recherches.push({ type: 'titre', keywords: `${motsTitre} cybersecurity`, minResultats: MIN_RESULTATS_RECHERCHE_TITRE });
  }
  recherches.push({ type: 'categorie', keywords: getKeywords(categorie), minResultats: 1 });

  const aEviter = await imagesRecentes();

  for (const recherche of recherches) {
    for (const source of sources) {
      try {
        const urls = await source.fn(recherche.keywords);
        if (urls.length >= recherche.minResultats) {
          const imageUrl = choisirAuHasard(urls, aEviter);
          await log('findImage', `Image trouvée via ${source.name} (recherche ${recherche.type}: "${recherche.keywords}") pour catégorie "${categorie}"`, 'success', { imageUrl, resultats: urls.length });
          return imageUrl;
        }
        await log('findImage', `${urls.length} résultat(s) via ${source.name} pour "${recherche.keywords}", on tente la suite`, 'info');
      } catch (e) {
        await log('findImage', `Erreur ${source.name}: ${e.message}`, 'error');
      }
    }
  }

  await log('findImage', `Aucune image trouvée sur les 3 sources pour catégorie "${categorie}"`, 'error');
  return null;
}
