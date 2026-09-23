import { readFileSync } from 'fs';
import { log } from './logger.js';
import { callGeminiWithRetry } from './geminiRetry.js';

const CHEMIN_SCRAPING = process.env.SCRAPED_TOPICS_PATH || './scraped_topics.json';
const MAX_RESULTATS_PROMPT = 30;

// Liste officielle des catégories autorisées — doit être identique partout
export const CATEGORIES_AUTORISEES = [
  'gaming',
  'anime',
  'manga',
  'webtoon',
  'cinema',
  'streaming',
  'culture-internet',
  'intelligence-artificielle',
  'reseaux-sociaux',
  'esport',
  'reunion',
  'evenements',
];

function chargerResultatsScrapes() {
  const raw = readFileSync(CHEMIN_SCRAPING, 'utf-8');
  const data = JSON.parse(raw);
  return data.resultats || [];
}

export async function findTopics() {
  const annee = new Date().getFullYear();

  let resultatsScrapes;
  try {
    resultatsScrapes = chargerResultatsScrapes();
  } catch (e) {
    throw new Error(`Impossible de lire les résultats scrapés (${CHEMIN_SCRAPING}): ${e.message}`);
  }

  if (resultatsScrapes.length === 0) {
    await log('findTopics', 'Aucun résultat scrapé disponible', 'error');
    return [];
  }

  const resultatsPourPrompt = resultatsScrapes.slice(0, MAX_RESULTATS_PROMPT).map(r => ({
    titre: r.titre,
    extrait: r.extrait,
    url: r.url,
    categorie: r.categorie,
  }));

  await log('findTopics', `${resultatsScrapes.length} résultats scrapés, ${resultatsPourPrompt.length} envoyés à Gemini`, 'info');

  const prompt = `
Tu es rédacteur en chef de "Le Fil du Lord", un média numérique francophone
destiné principalement aux jeunes générations, avec un focus particulier sur
l'actualité locale de La Réunion (île française dans l'océan Indien) et la culture jeune.

Nous sommes en ${annee}.

Voici une liste de résultats de recherche web bruts. Ta mission est d'identifier,
PARMI CES RÉSULTATS UNIQUEMENT, jusqu'à 5 sujets d'actualité RÉELS, RÉCENTS, IMPORTANTS
et VÉRIFIABLES qui peuvent devenir de vrais articles journalistiques.

Résultats scrapés :
${JSON.stringify(resultatsPourPrompt)}

RÈGLE FONDAMENTALE :
Tu ne dois PAS inventer de sujet. Tu dois UNIQUEMENT t'appuyer sur les résultats scrapés.
Si un résultat est vague, hors-sujet, ou ne décrit pas un événement précis, ignore-le.

CATÉGORIES AUTORISÉES (utilise UNIQUEMENT ces valeurs exactes, sans majuscule, sans accent, sans variation) :
${CATEGORIES_AUTORISEES.join('\n')}

Description des catégories :
- gaming : jeux vidéo, annonces, sorties, industrie du jeu
- anime : séries animées japonaises
- manga : bandes dessinées japonaises
- webtoon : comics numériques coréens
- cinema : films et séries TV
- streaming : plateformes de streaming, contenus
- culture-internet : tendances web, mèmes, créateurs de contenu, réseaux sociaux, influenceurs
- intelligence-artificielle : IA, tech, innovations numériques
- reseaux-sociaux : actualités des plateformes sociales (Twitter/X, TikTok, Instagram, etc.)
- esport : compétitions, tournois, équipes de jeux vidéo compétitifs
- reunion : actualité générale de La Réunion (politique, société, économie locale)
- evenements : événements, concerts, festivals, sorties culturelles (à La Réunion ou ailleurs)

IMPORTANT : La catégorie doit être EXACTEMENT une des valeurs listées ci-dessus.
Par exemple : "cinema" et NON "cinéma et séries" ou "Cinéma".

Pour chaque sujet retenu, rédige :

TITRE : accrocheur, précis, pour un public jeune
DESCRIPTION : 300 à 500 mots avec TOUTES les informations de l'extrait
SOURCE : url du résultat scrapé
EXTRAIT_BRUT : le champ "extrait" EXACTEMENT et INTÉGRALEMENT, sans modification
CATEGORIE : une des catégories listées ci-dessus, EXACTEMENT comme écrite

Réponds UNIQUEMENT en JSON valide :
[{ "titre": "", "description": "", "source": "", "extrait_brut": "", "categorie": "" }]
Aucun texte avant ou après.
`;

  const result = await callGeminiWithRetry(
    async (genAI, modelName) => {
      const model = genAI.getGenerativeModel({ model: modelName });
      const r = await model.generateContent(prompt);
      const t = r.response.text().trim();
      if (!t) {
        const candidate = r.response.candidates?.[0];
        await log('findTopics', 'Réponse Gemini vide, nouvelle tentative', 'info', {
          finishReason: candidate?.finishReason,
          safetyRatings: candidate?.safetyRatings,
          promptFeedback: r.response.promptFeedback
        });
        throw new Error('REPONSE_VIDE: Gemini a renvoyé une réponse sans texte');
      }
      return r;
    },
    'findTopics'
  );

  const text = result.response.text().trim();
  const cleaned = text.replace(/```json|```/g, '').trim();

  let topics;
  try {
    topics = JSON.parse(cleaned);
  } catch (e) {
    await log('findTopics', 'Erreur de parsing JSON: ' + e.message, 'error', { raw: text.substring(0, 3000) });
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
      try {
        topics = JSON.parse(cleaned.substring(start, end + 1));
      } catch {
        throw new Error('Gemini a retourné un JSON tronqué');
      }
    } else {
      throw new Error('Gemini a retourné une réponse sans JSON');
    }
  }

  // Normalisation de sécurité : forcer les catégories non reconnues vers la plus proche
  topics = topics.map(topic => {
    if (!CATEGORIES_AUTORISEES.includes(topic.categorie)) {
      const original = topic.categorie;
      // Tentative de mapping des variantes connues
      const mapping = {
        'cinéma': 'cinema', 'cinéma et séries': 'cinema', 'cinema series': 'cinema',
        'technologie': 'intelligence-artificielle', 'nouvelles technologies': 'intelligence-artificielle',
        'technologie intelligence artificielle': 'intelligence-artificielle',
        'créateurs de contenu': 'culture-internet', 'createurs de contenu': 'culture-internet',
        'réseaux sociaux': 'reseaux-sociaux', 'culture internet': 'culture-internet',
        'événements': 'evenements', 'réunion': 'reunion',
      };
      topic.categorie = mapping[original.toLowerCase()] || 'culture-internet';
      // On log la correction mais on ne bloque pas
    }
    return topic;
  });

  await log('findTopics', `${topics.length} sujets trouvés à partir de ${resultatsScrapes.length} résultats scrapés`, 'success', topics);
  return topics;
}
