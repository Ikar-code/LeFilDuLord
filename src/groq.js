import { GROQ_API_KEY } from './clients.js';
import { log } from './logger.js';

// Modèles Groq, dans l'ordre de secours.
export const MODELES_GROQ = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];

// Appel Groq avec retry (rate limit TPM) et bascule sur le modèle de secours
// (limite journalière, erreurs persistantes). Retourne le texte brut de la réponse.
export async function callGroq(prompt, etapeNom, maxTentativesParModele = 3) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY manquante');

  let derniereErreur;

  for (const modele of MODELES_GROQ) {
    for (let tentative = 1; tentative <= maxTentativesParModele; tentative++) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: modele,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0].message.content.trim();
      }

      const errorText = await response.text();
      derniereErreur = new Error(`Groq (${modele}): statut HTTP ${response.status} — ${errorText}`);

      if (response.status === 429) {
        const estLimiteJournaliere = /requests per day|RPD|daily/i.test(errorText);
        if (estLimiteJournaliere) {
          await log(etapeNom, `Limite journalière atteinte sur ${modele}, passage au modèle de secours`, 'warning');
          break;
        }
        if (tentative < maxTentativesParModele) {
          const match = errorText.match(/try again in ([\d.]+)s/);
          const delaiMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : 3000;
          await log(etapeNom, `Rate limit TPM sur ${modele}, retry dans ${Math.round(delaiMs / 1000)}s`, 'info');
          await new Promise((resolve) => setTimeout(resolve, delaiMs));
          continue;
        }
        await log(etapeNom, `${modele} abandonné après ${maxTentativesParModele} essais (TPM), passage au modèle de secours`, 'warning');
        break;
      }

      // Erreur serveur temporaire : on retente, sinon modèle suivant.
      if (response.status >= 500 && tentative < maxTentativesParModele) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * tentative));
        continue;
      }
      break;
    }
  }

  throw derniereErreur || new Error('Groq: tous les modèles de secours ont échoué');
}

// Nettoie la réponse (balises <think>, blocs ```json) et la parse en JSON.
export function parseJsonLoose(text) {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/```json|```/g, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const debut = cleaned.indexOf('{');
    const fin = cleaned.lastIndexOf('}');
    if (debut !== -1 && fin > debut) return JSON.parse(cleaned.substring(debut, fin + 1));
    throw e;
  }
}

// Appel Groq qui renvoie directement l'objet JSON parsé.
export async function callGroqJson(prompt, etapeNom) {
  const text = await callGroq(prompt, etapeNom);
  try {
    return parseJsonLoose(text);
  } catch (e) {
    await log(etapeNom, 'Erreur de parsing JSON Groq: ' + e.message, 'error', { raw: text.substring(0, 1500) });
    throw e;
  }
}
