import { genAI } from './clients.js';
import { log } from './logger.js';

export async function scoreArticle(article) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

const prompt = `Tu es rédacteur en chef d'un média d'actualité.

Évalue cet article selon des critères journalistiques stricts.

Titre: ${article.titre}
Contenu: ${article.contenu}

Critères :

1. Existence d'un événement réel et identifiable.
2. Présence d'une date ou d'un repère temporel précis.
3. Présence d'acteurs clairement identifiés.
4. Présence de faits vérifiables (chiffres, décision, décret, étude, vote, publication officielle).
5. Absence de spéculation, projection ou généralités.
6. Qualité rédactionnelle et lisibilité.

Pénalités importantes :

- Sujet basé sur une tendance générale : -3 points.
- Sujet basé sur une prévision ou un futur hypothétique : -4 points.
- Absence d'événement précis : score maximum 4/10.
- Absence d'acteur identifié : -2 points.
- Absence de date précise : -2 points.
- Absence de fait vérifiable : score maximum 5/10.
- Article principalement composé de contexte ou d'analyse : score maximum 6/10.

Un article d'actualité doit répondre clairement à :
- Que s'est-il passé ?
- Qui est concerné ?
- Quand cela s'est-il produit ?
- Comment le vérifier ?

Si une de ces réponses manque, réduis fortement la note.

Réponds UNIQUEMENT en JSON :

{
  "score": <note sur 10>,
  "commentaire": "explication courte"
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json|```/g, '').trim();

  let evaluation;
  try {
    evaluation = JSON.parse(cleaned);
  } catch (e) {
    await log('scoreArticle', 'Erreur de parsing JSON: ' + e.message, 'error', { raw: text });
    throw e;
  }

  await log('scoreArticle', `Score obtenu: ${evaluation.score}/10`, 'success', evaluation);
  return evaluation;
}
