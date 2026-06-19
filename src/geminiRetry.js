import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEYS } from './clients.js';
import { log } from './logger.js';

// Ordre de fallback : clé 1 flash-lite → clé 1 flash → clé 2 flash-lite → clé 2 flash
// Généré dynamiquement à partir des clés disponibles et des modèles de fallback.
const MODELES_FALLBACK = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];

function getCombinations() {
  const combos = [];
  for (const key of GEMINI_API_KEYS) {
    for (const model of MODELES_FALLBACK) {
      combos.push({ key, model });
    }
  }
  return combos;
}

function isQuotaJournalierEpuise(error) {
  const message = error?.message || '';
  return (
    message.includes('GenerateRequestsPerDay') ||
    message.includes('PerDayPerProject') ||
    message.includes('PerDayPerModel') ||
    (
      message.includes('429') &&
      (
        message.includes('quota') ||
        message.includes('Too Many Requests') ||
        message.includes('exceeded your current quota')
      )
    )
  );
}

function isErreurTemporaire(error) {
  const message = error?.message || '';
  return (
    message.includes('503') ||
    message.includes('429') ||
    message.includes('Too Many Requests') ||
    message.includes('REPONSE_VIDE')
  );
}

function extraireDelaiAttente(error, delaiParDefautMs) {
  const message = error?.message || '';
  const match = message.match(/retryDelay["']?\s*:\s*["']?(\d+)s/);
  if (match) {
    return parseInt(match[1], 10) * 1000 + 1000;
  }
  return delaiParDefautMs;
}

// Appel Gemini avec rotation automatique clé + modèle.
//
// buildAndCall reçoit maintenant (genAI, modelName) — le nom du modèle actif
// dans la combinaison en cours. Chaque fichier l'utilise pour créer le bon modèle :
//
//   const result = await callGeminiWithRetry(
//     async (genAI, modelName) => {
//       const model = genAI.getGenerativeModel({ model: modelName });
//       return model.generateContent(prompt);
//     },
//     'findTopics'
//   );
//
// Pour les fichiers qui ont besoin de googleSearch, idem mais avec tools :
//
//   const result = await callGeminiWithRetry(
//     async (genAI, modelName) => {
//       const model = genAI.getGenerativeModel({ model: modelName, tools: [{ googleSearch: {} }] });
//       return model.generateContent(prompt);
//     },
//     'verifyTopics'
//   );
//
export async function callGeminiWithRetry(
  buildAndCall,
  etapeNom,
  maxTentativesParCombo = 5
) {
  if (!GEMINI_API_KEYS.length) {
    throw new Error('Aucune clé Gemini configurée (GEMINI_API_KEY / GEMINI_API_KEY_2)');
  }

  const combos = getCombinations();
  let derniereErreur;

  for (let i = 0; i < combos.length; i++) {
    const { key, model: modelName } = combos[i];
    const genAI = new GoogleGenerativeAI(key);
    const label = `clé #${Math.floor(i / MODELES_FALLBACK.length) + 1} / ${modelName}`;

    for (let tentative = 1; tentative <= maxTentativesParCombo; tentative++) {
      try {
        return await buildAndCall(genAI, modelName);
      } catch (error) {
        derniereErreur = error;

        // Quota journalier épuisé → combo suivant immédiat
        if (isQuotaJournalierEpuise(error)) {
          await log(
            etapeNom,
            `Quota dépassé sur ${label}, passage au suivant`,
            'warning',
            { message: error.message }
          );
          break;
        }

        // Erreur temporaire → retry avec délai
        if (isErreurTemporaire(error) && tentative < maxTentativesParCombo) {
          const delai = extraireDelaiAttente(error, 5000 * tentative);
          await log(
            etapeNom,
            `Erreur temporaire ${label} tentative ${tentative}/${maxTentativesParCombo}, retry dans ${Math.round(delai / 1000)}s`,
            'info',
            { message: error.message }
          );
          await new Promise(resolve => setTimeout(resolve, delai));
          continue;
        }

        // Dernière tentative de ce combo → combo suivant
        if (tentative === maxTentativesParCombo) {
          await log(
            etapeNom,
            `${label} abandonné après ${maxTentativesParCombo} essais, passage au suivant`,
            'warning',
            { message: error.message }
          );
          break;
        }

        throw error;
      }
    }
  }

  await log(etapeNom, `Toutes les combinaisons clé/modèle ont échoué (${combos.length})`, 'error');
  throw derniereErreur || new Error(`Aucune combinaison clé/modèle disponible (${etapeNom})`);
}
