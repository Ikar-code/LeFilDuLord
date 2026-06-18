import { log } from './logger.js';
import { callGeminiWithRetry } from './geminiRetry.js';

// Vérifie une liste de sujets en un seul appel Gemini (avec recherche web active)
// et ne retourne que ceux jugés réellement confirmés par une source vérifiable.
export async function verifyTopics(topics) {
  if (!topics || topics.length === 0) {
    return [];
  }

  const prompt = `
Tu es vérificateur de faits pour "Le Fil du Lord", un média numérique francophone.

Voici une liste de sujets proposés pour devenir des articles. Ta mission est de vérifier
CHAQUE sujet individuellement et de dire s'il correspond à un événement RÉEL, RÉCENT et
CONFIRMÉ par une source identifiable.

Sujets à vérifier :
${JSON.stringify(topics, null, 2)}

Pour chaque sujet, vérifie :
1. Est-ce que cette annonce, ce produit ou cet événement existe réellement ?
2. Est-ce qu'une entreprise, un studio, une organisation ou une personne l'a réellement annoncé ?
3. La date mentionnée est-elle cohérente et vérifiable ?
4. Existe-t-il une source crédible (site officiel, communiqué, compte officiel vérifié) qui confirme l'information ?

RÈGLE PRIORITAIRE :
Si tu n'es pas certain à 100% qu'un sujet est réel, EXCLUS-LE.
Il vaut mieux retourner une liste plus courte que d'inclure un sujet invérifiable ou inventé.

Réponds UNIQUEMENT en JSON valide, sous la forme d'un tableau contenant uniquement
les sujets validés (reprends exactement les mêmes champs que ceux fournis en entrée,
sans rien modifier ni ajouter) :

[
  {
    "titre": "",
    "description": "",
    "source": "",
    "categorie": ""
  }
]

Si aucun sujet n'est validé, réponds avec un tableau vide : []
Aucun texte avant ou après le JSON.
`;

  const result = await callGeminiWithRetry(
    async (genAI) => {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        tools: [{ googleSearch: {} }]
      });
      const r = await model.generateContent(prompt);
      const t = r.response.text().trim();
      if (!t) {
        const candidate = r.response.candidates?.[0];
        await log('verifyTopics', 'Réponse Gemini vide (aucun texte généré), nouvelle tentative', 'info', {
          finishReason: candidate?.finishReason,
          safetyRatings: candidate?.safetyRatings,
          promptFeedback: r.response.promptFeedback
        });
        throw new Error('REPONSE_VIDE: Gemini a renvoyé une réponse sans texte');
      }
      return r;
    },
    'verifyTopics'
  );

  const text = result.response.text().trim();
  const cleaned = text.replace(/```json|```/g, '').trim();

  let validatedTopics;
  try {
    validatedTopics = JSON.parse(cleaned);
  } catch (e) {
    await log('verifyTopics', 'Erreur de parsing JSON: ' + e.message, 'error', { raw: text.substring(0, 3000) });

    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
      try {
        validatedTopics = JSON.parse(cleaned.substring(start, end + 1));
      } catch {
        throw new Error('Gemini a retourné un JSON tronqué lors de la vérification des sujets');
      }
    } else {
      throw new Error('Gemini a retourné une réponse sans JSON lors de la vérification des sujets');
    }
  }

  await log(
    'verifyTopics',
    `${validatedTopics.length} sujets validés sur ${topics.length} proposés`,
    'success',
    validatedTopics
  );

  return validatedTopics;
}
