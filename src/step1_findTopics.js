import { readFileSync } from 'fs';
import { log } from './logger.js';
import { callGeminiWithRetry } from './geminiRetry.js';

const CHEMIN_SCRAPING = process.env.SCRAPED_TOPICS_PATH || './scraped_topics.json';

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
    await log('findTopics', 'Aucun résultat scrapé disponible, impossible de proposer des sujets', 'error');
    return [];
  }

  const prompt = `
Tu es rédacteur en chef de "Le Fil du Lord", un média numérique francophone
destiné principalement aux jeunes générations.

Nous sommes en ${annee}.

Voici une liste de résultats de recherche web bruts, déjà collectés par un outil
de scraping (titre, extrait, url, catégorie de recherche). Ta mission est d'identifier,
PARMI CES RÉSULTATS UNIQUEMENT, jusqu'à 5 sujets d'actualité RÉELS, RÉCENTS, IMPORTANTS
et VÉRIFIABLES qui peuvent devenir de vrais articles journalistiques pour un public jeune.

Résultats scrapés :
${JSON.stringify(resultatsScrapes, null, 2)}

RÈGLE FONDAMENTALE :

Tu ne dois PAS inventer de sujet. Tu dois UNIQUEMENT t'appuyer sur les résultats
scrapés ci-dessus. Si un résultat est vague, hors-sujet, ou ne décrit pas un
événement précis, ignore-le.

Le média couvre principalement :
- gaming
- anime
- manga
- webtoon
- culture internet
- streaming
- cinéma et séries
- nouvelles technologies
- intelligence artificielle
- réseaux sociaux
- créateurs de contenu
- esport
- innovations numériques

Pour chaque sujet retenu, utilise le titre/extrait/url du résultat scrapé correspondant
comme source, et rédige :

TITRE :
- doit annoncer un événement précis
- doit être accrocheur pour un public jeune
- doit éviter les titres vagues

DESCRIPTION :
Entre 300 et 500 mots maximum. Ce résumé doit contenir TOUTES les informations
importantes présentes dans l'extrait scrapé, afin qu'un journaliste puisse rédiger
un article complet sans avoir besoin d'aller chercher d'autres sources.

Il doit inclure :
- l'événement principal et son contexte
- les acteurs concernés (noms précis, entreprises, studios, plateformes)
- les dates et chiffres mentionnés
- les conséquences ou implications importantes
- tout détail factuel présent dans l'extrait, même secondaire

Ne pas résumer de manière vague. Chaque information concrète de l'extrait
doit apparaître dans la description.

SOURCE :
Reprends l'url du résultat scrapé correspondant.

EXTRAIT_BRUT :
Reprends EXACTEMENT et INTÉGRALEMENT le champ "extrait" du résultat scrapé
correspondant, sans le résumer, le raccourcir ni le reformuler. Ce texte brut
sera utilisé plus tard pour ne perdre aucun détail que ta description aurait omis.

CATEGORIE :
Une des catégories listées ci-dessus.

Il est autorisé de retourner MOINS de 5 sujets si moins de 5 résultats scrapés
correspondent à un événement réel et précis. Ne crée jamais un sujet pour
atteindre le nombre de 5.

Réponds UNIQUEMENT en JSON valide :

[
 {
  "titre": "",
  "description": "",
  "source": "",
  "extrait_brut": "",
  "categorie": ""
 }
]

Aucun texte avant ou après.
`;

  const result = await callGeminiWithRetry(
    async (genAI) => {
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite'
        // Pas de googleSearch ici : la recherche a déjà été faite par le scraping.
      });
      const r = await model.generateContent(prompt);
      const t = r.response.text().trim();
      if (!t) {
        const candidate = r.response.candidates?.[0];
        await log('findTopics', 'Réponse Gemini vide (aucun texte généré), nouvelle tentative', 'info', {
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

  await log('findTopics', `${topics.length} sujets trouvés à partir de ${resultatsScrapes.length} résultats scrapés`, 'success', topics);
  return topics;
}
