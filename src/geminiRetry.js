import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEYS } from './clients.js';
import { log } from './logger.js';

// Détecte si une erreur Gemini correspond à un quota JOURNALIER épuisé.
// Dans ce cas, retenter avec la MÊME clé ne sert à rien avant demain,
// mais une AUTRE clé peut encore avoir du quota disponible.
function isQuotaJournalierEpuise(error) {
  const message = error?.message || '';
  return (
    message.includes('GenerateRequestsPerDayPerProjectPerModel') ||
    message.includes('PerDay')
  );
}

// Détecte une erreur temporaire (surcharge 503, rate limit par minute 429,
// ou réponse vide de Gemini) pour laquelle un retry après un court délai a du sens.
function isErreurTemporaire(error) {
  const message = error?.message || '';
  return message.includes('503') || message.includes('429') || message.includes('REPONSE_VIDE');
}

// Essaie d'extraire le délai suggéré par Gemini dans son erreur (retryDelay), sinon utilise un défaut.
function extraireDelaiAttente(error, delaiParDefautMs) {
  const message = error?.message || '';
  const match = message.match(/retryDelay["']?\s*:\s*["']?(\d+)s/);
  if (match) {
    return parseInt(match[1], 10) * 1000 + 1000; // +1s de marge
  }
  return delaiParDefautMs;
}

// Exécute un appel Gemini avec :
// - bascule automatique vers la clé API suivante si le quota journalier de la clé actuelle est épuisé
// - retry avec backoff sur erreurs temporaires (503, 429 par minute, réponse vide)
// - abandon uniquement si TOUTES les clés ont leur quota journalier épuisé
//
// `buildAndCall(genAI)` doit créer le modèle à partir de l'instance genAI fournie et appeler generateContent.
//
// Utilisation :
//   const result = await callGeminiWithRetry(
//     (genAI) => {
//       const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', tools: [{ googleSearch: {} }] });
//       return model.generateContent(prompt);
//     },
//     'findTopics'
//   );
export async function callGeminiWithRetry(buildAndCall, etapeNom, maxTentativesParCle = 3) {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error('Aucune clé Gemini configurée (GEMINI_API_KEY / GEMINI_API_KEY_2)');
  }

  let derniereErreur;

  for (let cleIndex = 0; cleIndex < GEMINI_API_KEYS.length; cleIndex++) {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEYS[cleIndex]);

    for (let tentative = 1; tentative <= maxTentativesParCle; tentative++) {
      try {
        return await buildAndCall(genAI);
      } catch (error) {
        derniereErreur = error;

        if (isQuotaJournalierEpuise(error)) {
          const ySuivante = cleIndex + 1 < GEMINI_API_KEYS.length;
          await log(
            etapeNom,
            `Quota journalier épuisé sur la clé Gemini #${cleIndex + 1}` +
              (ySuivante ? ', bascule vers la clé suivante' : ', plus aucune clé disponible'),
            ySuivante ? 'info' : 'error',
            { message: error.message }
          );
          break; // on sort de la boucle de tentatives pour passer à la clé suivante (ou abandonner)
        }

        if (isErreurTemporaire(error) && tentative < maxTentativesParCle) {
          const delai = extraireDelaiAttente(error, 5000 * tentative);
          await log(
            etapeNom,
            `Erreur temporaire Gemini (clé #${cleIndex + 1}, tentative ${tentative}/${maxTentativesParCle}), nouvelle tentative dans ${Math.round(delai / 1000)}s`,
            'info',
            { message: error.message }
          );
          await new Promise((resolve) => setTimeout(resolve, delai));
          continue;
        }

        // Erreur non temporaire et non liée au quota : inutile d'essayer une autre clé, on relance direct
        throw error;
      }
    }
  }

  await log(etapeNom, `Quota journalier épuisé sur toutes les clés Gemini disponibles (${GEMINI_API_KEYS.length})`, 'error');
  throw new Error(`Quota journalier Gemini épuisé sur toutes les clés (${etapeNom}), nouvelle tentative inutile aujourd'hui.`);
}
