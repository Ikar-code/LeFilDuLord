import { log } from './logger.js';
import { callGeminiWithRetry } from './geminiRetry.js';

export async function scoreArticle(article, topic) {
  const aujourdHui = new Date().toLocaleDateString('fr-FR');

  const prompt = `

Nous sommes le ${aujourdHui}.

Tu es rédacteur en chef et responsable qualité du média "Le Fil du Lord".

Ta mission est d'évaluer uniquement la qualité de l'article généré
à partir d'un sujet déjà vérifié par un système de fact-checking.

IMPORTANT :

Le sujet fourni ci-dessous a déjà été vérifié en amont.

Tu ne dois PAS refaire une recherche.
Tu ne dois PAS rejeter un article simplement parce que l'événement est récent,
peu connu ou absent de tes connaissances.

Le dossier vérifié fourni est la source de vérité.

Ton rôle est uniquement de vérifier :
- si l'article respecte les faits validés
- si l'article ajoute des informations absentes
- si l'article déforme l'événement
- si l'article est bien écrit et publiable


Article :

Titre :
${article.titre}

Contenu :
${article.contenu}


Sujet vérifié utilisé :

Titre :
${topic.titre}

Description :
${topic.description}


Faits validés :

${
topic.faitsVerifies && topic.faitsVerifies.length > 0
? topic.faitsVerifies.map(f => "- " + f).join("\n")
: "Aucun fait supplémentaire"
}


Résumé de vérification :

${topic.verification || "Aucune vérification disponible"}



Évalue l'article selon ces critères :


1. Respect des informations vérifiées

L'article doit :

- respecter les faits validés
- utiliser les bonnes dates
- utiliser les bons acteurs
- utiliser les bons projets, œuvres ou entreprises
- ne pas inventer de détails absents du dossier


Pénalise fortement :

- contradiction avec les faits validés
- invention de chiffres
- invention de citations
- ajout d'événements inexistants
- modification importante de l'information vérifiée


2. Qualité journalistique

Évalue :

- titre clair et précis
- introduction efficace
- structure logique
- paragraphes lisibles
- ton professionnel
- absence de répétitions
- absence de formulation marketing


3. Richesse de l'article

L'article doit :

- expliquer le contexte
- expliquer pourquoi le sujet est intéressant
- présenter les acteurs concernés
- donner des informations concrètes
- aider le lecteur à comprendre l'impact


4. Respect du média "Le Fil du Lord"

L'article doit :

- informer sans donner d'opinion
- rester neutre
- être accessible aux jeunes générations
- éviter le sensationnalisme
- éviter les phrases exagérées


Pénalités :

- Contradiction avec les faits validés : -6 points
- Informations inventées absentes du dossier : -5 points
- Ajout de détails non vérifiés : -3 points
- Article trop vague : -3 points
- Article trop court ou résumé simple : -2 points
- Ton promotionnel ou subjectif : -2 points
- Manque de contexte : -2 points


Score :

10/10 :
Article publiable directement.

7-9/10 :
Article correct avec petites améliorations possibles.

5-6/10 :
Article nécessitant une réécriture.

0-4/10 :
Article non publiable.


Avant de noter, vérifie uniquement :

- L'article correspond-il au dossier vérifié ?
- Des informations ont-elles été inventées ?
- L'écriture ressemble-t-elle à un vrai article ?


Réponds UNIQUEMENT en JSON valide :

{
  "score": <note sur 10>,
  "commentaire": "explication courte"
}

`;

  const result = await callGeminiWithRetry(
    async (genAI) => {
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite'
      });

      const r = await model.generateContent(prompt);

      const t = r.response.text().trim();

      if (!t) {
        const candidate = r.response.candidates?.[0];

        await log(
          'scoreArticle',
          'Réponse Gemini vide, nouvelle tentative',
          'info',
          {
            finishReason: candidate?.finishReason,
            safetyRatings: candidate?.safetyRatings
          }
        );

        throw new Error('REPONSE_VIDE');
      }

      return r;
    },
    'scoreArticle'
  );


  const text = result.response.text().trim();
  const cleaned = text.replace(/```json|```/g, '').trim();


  let evaluation;

  try {
    evaluation = JSON.parse(cleaned);
  } catch (e) {

    await log(
      'scoreArticle',
      'Erreur parsing JSON : ' + e.message,
      'error',
      { raw: text }
    );

    throw e;
  }


  await log(
    'scoreArticle',
    `Score obtenu: ${evaluation.score}/10`,
    'success',
    evaluation
  );


  return evaluation;
}
