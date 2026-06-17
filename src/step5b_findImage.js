import { PEXELS_API_KEY, UNSPLASH_ACCESS_KEY, PIXABAY_API_KEY } from './clients.js';
import { log } from './logger.js';

// Mapping catégorie -> mots-clés de recherche d'image.
// Adapte/complète cette liste selon les catégories réellement renvoyées par findTopics.js.
const CATEGORY_KEYWORDS = {
  gaming: 'video games esports',
  anime: 'anime art japan',
  manga: 'manga art japan',
  webtoon: 'comic art illustration',
  'culture internet': 'internet culture social media',
  streaming: 'streaming live content',
  cinema: 'cinema movie theater',
  series: 'tv series streaming',
  technologie: 'technology computer',
  'intelligence artificielle': 'artificial intelligence technology',
  'reseaux sociaux': 'social media phone',
  'createurs de contenu': 'content creator camera',
  esport: 'esports gaming tournament',
  innovation: 'technology innovation'
};

const DEFAULT_KEYWORDS = 'news technology';

function getKeywords(categorie) {
  if (!categorie) return DEFAULT_KEYWORDS;
  const normalise = categorie.toLowerCase().trim();
  return CATEGORY_KEYWORDS[normalise] || DEFAULT_KEYWORDS;
}

async function searchPexels(keywords) {
  if (!PEXELS_API_KEY) return null;

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(keywords)}&per_page=1&orientation=landscape`;
  const response = await fetch(url, {
    headers: { Authorization: PEXELS_API_KEY }
  });

  if (!response.ok) {
    throw new Error(`Pexels: statut HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.photos && data.photos.length > 0) {
    return data.photos[0].src.large;
  }
  return null;
}

async function searchUnsplash(keywords) {
  if (!UNSPLASH_ACCESS_KEY) return null;

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keywords)}&per_page=1&orientation=landscape`;
  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
  });

  if (!response.ok) {
    throw new Error(`Unsplash: statut HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.results && data.results.length > 0) {
    return data.results[0].urls.regular;
  }
  return null;
}

async function searchPixabay(keywords) {
  if (!PIXABAY_API_KEY) return null;

  const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keywords)}&per_page=3&orientation=horizontal&image_type=photo`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Pixabay: statut HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.hits && data.hits.length > 0) {
    return data.hits[0].largeImageURL;
  }
  return null;
}

// Essaie chaque source dans l'ordre Pexels -> Unsplash -> Pixabay.
// Retourne dès qu'une source trouve une image (le 1er résultat gagne).
export async function findImage(categorie) {
  const keywords = getKeywords(categorie);
  const sources = [
    { name: 'Pexels', fn: searchPexels },
    { name: 'Unsplash', fn: searchUnsplash },
    { name: 'Pixabay', fn: searchPixabay }
  ];

  for (const source of sources) {
    try {
      const imageUrl = await source.fn(keywords);
      if (imageUrl) {
        await log('findImage', `Image trouvée via ${source.name} pour catégorie "${categorie}" (mots-clés: "${keywords}")`, 'success', { imageUrl });
        return imageUrl;
      }
      await log('findImage', `Aucune image via ${source.name} pour "${keywords}", on tente la source suivante`, 'info');
    } catch (e) {
      await log('findImage', `Erreur ${source.name}: ${e.message}`, 'error');
    }
  }

  await log('findImage', `Aucune image trouvée sur les 3 sources pour catégorie "${categorie}" (mots-clés: "${keywords}")`, 'error');
  return null;
}
