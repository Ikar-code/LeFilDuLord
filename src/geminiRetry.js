import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEYS } from './clients.js';
import { log } from './logger.js';

// Détecte une erreur de quota épuisé.
// Si une clé est bloquée, on passe immédiatement à la suivante.
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

// Erreurs où un retry temporaire peut aider
function isErreurTemporaire(error) {
  const message = error?.message || '';

  return (
    message.includes('503') ||
    message.includes('429') ||
    message.includes('Too Many Requests') ||
    message.includes('REPONSE_VIDE')
  );
}

// Récupère le délai conseillé par Gemini
function extraireDelaiAttente(error, delaiParDefautMs) {
  const message = error?.message || '';

  const match = message.match(/retryDelay["']?\s*:\s*["']?(\d+)s/);

  if (match) {
    return parseInt(match[1], 10) * 1000 + 1000;
  }

  return delaiParDefautMs;
}


// Appel Gemini avec rotation automatique des clés
export async function callGeminiWithRetry(
  buildAndCall,
  etapeNom,
  maxTentativesParCle = 5
) {

  if (!GEMINI_API_KEYS.length) {
    throw new Error(
      'Aucune clé Gemini configurée (GEMINI_API_KEY / GEMINI_API_KEY_2)'
    );
  }


  let derniereErreur;


  for (
    let cleIndex = 0;
    cleIndex < GEMINI_API_KEYS.length;
    cleIndex++
  ) {


    const genAI = new GoogleGenerativeAI(
      GEMINI_API_KEYS[cleIndex]
    );


    for (
      let tentative = 1;
      tentative <= maxTentativesParCle;
      tentative++
    ) {


      try {

        return await buildAndCall(genAI);


      } catch (error) {


        derniereErreur = error;


        // QUOTA => changement de clé immédiat
        if (isQuotaJournalierEpuise(error)) {


          await log(
            etapeNom,
            `Quota dépassé sur clé Gemini #${cleIndex + 1}, passage à la suivante`,
            'warning',
            {
              message: error.message
            }
          );


          break;
        }



        // RETRY TEMPORAIRE
        if (
          isErreurTemporaire(error) &&
          tentative < maxTentativesParCle
        ) {


          const delai = extraireDelaiAttente(
            error,
            5000 * tentative
          );


          await log(
            etapeNom,
            `Erreur Gemini clé #${cleIndex + 1} tentative ${tentative}/${maxTentativesParCle}, retry dans ${Math.round(delai / 1000)}s`,
            'info',
            {
              message: error.message
            }
          );


          await new Promise(resolve =>
            setTimeout(resolve, delai)
          );


          continue;
        }



        // DERNIER ESSAI DE CETTE CLÉ
        // On passe quand même à la clé suivante
        if (tentative === maxTentativesParCle) {


          await log(
            etapeNom,
            `Clé Gemini #${cleIndex + 1} abandonnée après ${maxTentativesParCle} essais, passage à la suivante`,
            'warning',
            {
              message: error.message
            }
          );


          break;
        }



        // Erreur inconnue
        throw error;

      }
    }
  }


  await log(
    etapeNom,
    `Toutes les clés Gemini ont échoué (${GEMINI_API_KEYS.length})`,
    'error'
  );


  throw derniereErreur || new Error(
    `Aucune clé Gemini disponible (${etapeNom})`
  );
}
