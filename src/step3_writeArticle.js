import { genAI } from './clients.js';
import { log } from './logger.js';

export async function writeArticle(topic) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const prompt = `Tu es journaliste pour "Le Fil du Lord", un média d'actualité en ligne.
Rédige un article complet en français à partir de ce sujet :

Titre proposé: ${topic.titre}
Description: ${topic.description}
Source: ${topic.source}

Consignes :
- Ton journalistique, neutre et informatif
- Structure claire avec plusieurs paragraphes
- Longueur : environ 300-400 mots
- Propose un titre accrocheur (peut différer du titre proposé)
- Propose un angle éditorial en une phrase

Réponds UNIQUEMENT en JSON, format strict, sans markdown :
{
  "titre": "...",
  "angle": "...",
  "contenu": "..."
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json|```/g, '').trim();

  let article;
  try {
    article = JSON.parse(cleaned);
  } catch (e) {
    await log('writeArticle', 'Erreur de parsing JSON: ' + e.message, 'error', { raw: text });
    throw e;
  }

  await log('writeArticle', `Article rédigé: "${article.titre}"`, 'success');
  return article;
}
