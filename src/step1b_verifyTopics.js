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

MÉTHODE DE VÉRIFICATION OBLIGATOIRE, pour CHAQUE sujet, dans cet ordre :

1. Recherche l'événement décrit dans le titre/la description via la recherche web.
2. Identifie une source précise (site officiel, communiqué de presse, compte officiel
   vérifié, média reconnu) qui confirme EXACTEMENT cet événement — pas un événement
   similaire, pas une rumeur, pas une déduction.
3. Vérifie que les détails (acteur, date, produit/œuvre, studio, plateforme) cités dans
   le sujet correspondent PRÉCISÉMENT à ce que dit la source trouvée. Une seule erreur
   factuelle (mauvais studio, mauvaise date, mauvais acteur) invalide le sujet entier.
4. Si tu ne trouves AUCUNE source qui confirme explicitement cet événement précis,
   EXCLUS LE SUJET — même s'il te semble plausible ou cohérent avec d'autres
   informations que tu connais.

ERREURS À NE JAMAIS COMMETTRE :
- Valider un sujet parce qu'il "sonne plausible" sans avoir trouvé de source qui le
  confirme explicitement.
- Confondre une œuvre, un studio ou un produit existant avec celui mentionné dans le
  sujet (ex: un studio qui existe et qui a déjà produit d'autres œuvres ne prouve pas
  qu'il a annoncé CE projet précis).
- Combler un manque d'information avec une déduction ou une supposition logique.
- Valider un sujet basé sur une seule mention non officielle (forum, réseau social non
  vérifié, blog non officiel).

RÈGLE PRIORITAIRE :
Si tu n'es pas certain à 100% qu'un sujet est réel ET que ses détails sont exacts,
EXCLUS-LE. Il vaut mieux retourner une liste vide que d'inclure un seul sujet
invérifiable, inventé, ou partiellement faux.

Avant de répondre, pour chaque sujet, pose-toi mentalement ces questions :
- Quelle source précise confirme cet événement exact (pas un événement similaire) ?
- Tous les détails (acteur, date, nom du produit/œuvre, plateforme) correspondent-ils
  exactement à cette source ?
- Si un journaliste publiait cet article tel quel demain, risquerait-il de publier une
  information fausse ou inexacte sur un détail ?
Si la réponse à la dernière question est "oui" ou "peut-être" : EXCLUS LE SUJET.

Réponds UNIQUEMENT en JSON valide, sous la forme d'un tableau contenant uniquement
les sujets validés (reprends EXACTEMENT et INTÉGRALEMENT les mêmes champs que ceux
fournis en entrée, y compris extrait_brut sans le modifier, sans rien ajouter) :

[
  {
    "titre": "",
    "description": "",
    "source": "",
    "extrait_brut": "",
    "categorie": ""
  }
]

Si aucun sujet n'est validé, réponds avec un tableau vide : []
Aucun texte avant ou après le JSON.
`;

  const result = await callGeminiWithRetry(
    async (genAI) => {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
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
