import { genAI } from './clients.js';
import { log } from './logger.js';

export async function scoreArticle(article) {

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite'
  });

  const prompt = `
Tu es rédacteur en chef et responsable qualité du média "Le Fil du Lord".
Ta mission est d'évaluer la qualité journalistique de cet article avant publication.

Article :

Titre :
${article.titre}

Contenu :
${article.contenu}


Évalue l'article selon les critères suivants :


1. Pertinence du sujet

- L'article traite-t-il d'un événement réel, récent et identifiable ?
- Le sujet présente-t-il un intérêt pour les lecteurs ?
- L'événement est-il suffisamment important pour justifier un article ?


2. Fiabilité journalistique (CRITÈRE PRIORITAIRE)

Avant de noter l'article, vérifie que l'événement décrit semble réellement exister.

L'article doit être fortement pénalisé si :

- l'annonce n'est pas confirmée officiellement
- le projet, produit, événement ou acteur semble inventé
- la source fournie ne permet pas de vérifier l'information
- l'article présente une rumeur comme une annonce officielle
- une date précise existe mais aucun élément ne prouve que l'événement a réellement eu lieu
- les chiffres, citations ou détails semblent ajoutés sans preuve
- l'article transforme une hypothèse, une fuite ou une rumeur en fait confirmé

Un article bien écrit basé sur une fausse information doit recevoir une mauvaise note.

La qualité rédactionnelle ne compense jamais un manque de fiabilité.

Questions obligatoires avant de noter :

- Que s'est-il réellement passé ?
- Existe-t-il une preuve concrète de cet événement ?
- L'acteur concerné a-t-il réellement annoncé cela ?
- La date correspond-elle à un événement identifiable ?
- La source est-elle crédible ?
- Le sujet ressemble-t-il à une rumeur, une invention ou une confusion ?


3. Qualité rédactionnelle

- Le texte ressemble-t-il à un véritable article de média ?
- L'introduction présente-t-elle rapidement le fait principal ?
- Les paragraphes sont-ils organisés et compréhensibles ?
- Le style est-il neutre et professionnel ?


4. Richesse de l'article

- Présence de contexte utile
- Explication des conséquences
- Présence d'informations concrètes
- Développement suffisant du sujet
- Le lecteur comprend-il pourquoi l'événement est important ?


5. Respect du format Le Fil du Lord

L'article doit :

- informer et non donner une opinion
- éviter les spéculations
- éviter les affirmations non vérifiées
- rester accessible au grand public
- ne pas exagérer l'importance d'une annonce
- ne pas utiliser de formulation marketing


Pénalités importantes :

- Sujet vague ou simple tendance sans événement précis : -3 points
- Informations non vérifiables ou inventées : -5 points
- Annonce non confirmée ou probablement inventée : -6 points
- Projet, produit ou événement inexistant : score maximum 3/10
- Source absente ou non crédible : score maximum 4/10
- Absence totale de date ou contexte temporel : -2 points
- Absence d'acteurs ou éléments concrets : -2 points
- Article trop court ou ressemblant à un résumé : -2 points
- Article principalement composé de généralités : -3 points
- Ton trop subjectif ou promotionnel : -2 points


Score :

10/10 :
Article publiable directement, clair, précis, fiable et journalistique.

7-9/10 :
Article acceptable avec quelques améliorations possibles.

5-6/10 :
Article nécessitant une réécriture avant publication.

0-4/10 :
Article non publiable.


Avant de noter, réponds mentalement à ces questions :

- Que s'est-il passé ?
- Quand ?
- Qui est concerné ?
- Pourquoi est-ce important ?
- Quelles preuves ou éléments vérifiables existent ?
- La source permet-elle réellement de confirmer l'événement ?


Réponds UNIQUEMENT en JSON valide :

{
  "score": <note sur 10>,
  "commentaire": "explication courte"
}
`;
  const result = await model.generateContent(prompt);

const text = result.response.text().trim();

const cleaned = text.replace(/```json|```/g, '').trim();

let evaluation;

try {
  evaluation = JSON.parse(cleaned);
} catch (e) {
  await log(
    'scoreArticle',
    'Erreur de parsing JSON: ' + e.message,
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
