import { log } from './logger.js';
import { callGeminiWithRetry } from './geminiRetry.js';

// Vérifie un seul sujet via un appel Gemini dédié (avec recherche web active).
// Retourne le sujet (inchangé) s'il est validé, ou null s'il est rejeté.
async function verifierUnSujet(topic) {
  const prompt = `
Tu es vérificateur de faits pour "Le Fil du Lord", un média numérique francophone.

Voici un sujet proposé pour devenir un article. Ta mission est de vérifier s'il
correspond à un événement RÉEL, RÉCENT et CONFIRMÉ par une source identifiable.

Sujet à vérifier :
${JSON.stringify(topic, null, 2)}

MÉTHODE DE VÉRIFICATION OBLIGATOIRE, dans cet ordre :

1. Recherche l'événement décrit dans le titre/la description via la recherche web.
2. Identifie une source précise (site officiel, communiqué de presse, compte officiel
   vérifié, média reconnu) qui confirme EXACTEMENT cet événement — pas un événement
   similaire, pas une rumeur, pas une déduction.
3. Vérifie que les détails (acteur, date, produit/œuvre, studio, plateforme) cités dans
   le sujet correspondent PRÉCISÉMENT à ce que dit la source trouvée. Une seule erreur
   factuelle (mauvais studio, mauvaise date, mauvais acteur) invalide le sujet entier.
4. Si tu ne trouves AUCUNE source qui confirme explicitement cet événement précis,
   REJETTE le sujet — même s'il te semble plausible ou cohérent avec d'autres
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
Si tu n'es pas certain à 100% que ce sujet est réel ET que ses détails sont exacts,
REJETTE-LE. Il vaut mieux rejeter un sujet valable que d'en valider un seul
invérifiable, inventé, ou partiellement faux.

Avant de répondre, pose-toi mentalement ces questions :
- Quelle source précise confirme cet événement exact (pas un événement similaire) ?
- Tous les détails (acteur, date, nom du produit/œuvre, plateforme) correspondent-ils
  exactement à cette source ?
- Si un journaliste publiait cet article tel quel demain, risquerait-il de publier une
  information fausse ou inexacte sur un détail ?
Si la réponse à la dernière question est "oui" ou "peut-être" : REJETTE le sujet.

Réponds UNIQUEMENT en JSON valide :

{
  "valide": true ou false,
  "raison": "explication courte de ta décision",

  "titreCorrige": "titre corrigé si nécessaire",

  "descriptionCorrigee": "description corrigée si nécessaire",

  "faitsVerifies": [
    "fait vérifié 1",
    "fait vérifié 2",
    "fait vérifié 3"
  ]
}

RÈGLES :

- Si le sujet est valide mais contient une erreur mineure, corrige-la.
- Si le titre est déjà correct, recopier le titre original.
- Si la description est déjà correcte, recopier la description originale.
- faitsVerifies doit contenir uniquement des informations confirmées par des sources fiables.
- Aucun texte avant ou après le JSON.
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
        await log('verifyTopics', `Réponse Gemini vide pour "${topic.titre}", nouvelle tentative`, 'info', {
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

  let verdict;
  try {
    verdict = JSON.parse(cleaned);
  } catch (e) {
    await log('verifyTopics', `Erreur de parsing JSON pour "${topic.titre}": ` + e.message, 'error', { raw: text.substring(0, 2000) });
    return null; // en cas de doute sur le parsing, on rejette par sécurité
  }

  if (verdict.valide) {
  const correctedTopic = {
    ...topic,
    titre:
      verdict.titreCorrige ||
      topic.titre,
    description:
      verdict.descriptionCorrigee ||
      topic.description,
    faitsVerifies:
      verdict.faitsVerifies || []
  };

  await log(
    'verifyTopics',
    `Sujet validé: "${correctedTopic.titre}" — ${verdict.raison}`,
    'success'
  );

  return correctedTopic;
}

  await log('verifyTopics', `Sujet rejeté: "${topic.titre}" — ${verdict.raison}`, 'info');
  return null;
}

// Vérifie une liste de sujets, un appel Gemini dédié par sujet (avec recherche web active),
// et ne retourne que ceux jugés réellement confirmés par une source vérifiable.
export async function verifyTopics(topics) {
  if (!topics || topics.length === 0) {
    return [];
  }

  const validatedTopics = [];

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];

    // Pause entre chaque appel pour rester sous le RPM (15/min pour gemini-3.1-flash-lite)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    try {
      const resultat = await verifierUnSujet(topic);
      if (resultat) {
        validatedTopics.push(resultat);
      }
    } catch (e) {
      await log('verifyTopics', `Échec de vérification pour "${topic.titre}": ${e.message}`, 'error');
      // En cas d'échec technique (quota épuisé sur toutes les clés, etc.), on arrête
      // la boucle plutôt que de continuer à essayer les sujets restants en vain.
      if (e.message.includes('Quota journalier')) {
        throw e;
      }
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
