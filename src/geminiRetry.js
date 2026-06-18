import { log } from './logger.js';

// Détecte si une erreur Gemini correspond à un quota JOURNALIER épuisé.
// Dans ce cas, retenter dans la même journée ne sert à rien.
function isQuotaJournalierEpuise(error) {
  const message = error?.message || '';
  return (
    message.includes('GenerateRequestsPerDayPerProjectPerModel') ||
    message.includes('PerDay')
  );
}

// Détecte une erreur temporaire (surcharge 503, ou rate limit par minute 429)
// pour laquelle un retry après un court délai a du sens.
function isErreurTemporaire(error) {
  const message = error?.message || '';
  return message.includes('503') || message.includes('429');
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

// Exécute un appel Gemini avec retry automatique :
// - 503 ou 429 "par minute" → attend et retente (jusqu'à MAX_TENTATIVES fois)
// - 429 "quota journalier épuisé" → abandonne immédiatement avec un message clair
//
// Utilisation :
//   const result = await callGeminiWithRetry(
//     () => model.generateContent(prompt),
//     'findTopics'
//   );
export async function callGeminiWithRetry(fn, etapeNom, maxTentatives = 3) {
  let derniereErreur;

  for (let tentative = 1; tentative <= maxTentatives; tentative++) {
    try {
      return await fn();
    } catch (error) {
      derniereErreur = error;

      if (isQuotaJournalierEpuise(error)) {
        await log(
          etapeNom,
          'Quota journalier Gemini épuisé pour ce modèle, abandon (pas de retry possible avant demain)',
          'error',
          { message: error.message }
        );
        throw new Error(`Quota journalier Gemini épuisé (${etapeNom}), nouvelle tentative inutile aujourd'hui.`);
      }

      if (isErreurTemporaire(error) && tentative < maxTentatives) {
        const delai = extraireDelaiAttente(error, 5000 * tentative);
        await log(
          etapeNom,
          `Erreur temporaire Gemini (tentative ${tentative}/${maxTentatives}), nouvelle tentative dans ${Math.round(delai / 1000)}s`,
          'info',
          { message: error.message }
        );
        await new Promise((resolve) => setTimeout(resolve, delai));
        continue;
      }

      // Erreur non temporaire, ou dernière tentative épuisée : on relance telle quelle
      throw error;
    }
  }

  throw derniereErreur;
}
