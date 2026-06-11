import { genAI } from './clients.js';
import { log } from './logger.js';

export async function scoreArticle(article) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const prompt = `Tu es relecteur éditorial pour un média d'actualité.
Évalue cet article sur 4 critères : cohérence, pertinence, lisibilité, qualité globale.

Titre: ${article.titre}
Contenu: ${article.contenu}

Réponds UNIQUEMENT en JSON, sans markdown :
{
  "score": <note sur 10, nombre décimal>,
  "commentaire": "..."
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
