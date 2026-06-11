import { genAI } from './clients.js';
import { log } from './logger.js';

async function generateArticle(topic) {
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
  return JSON.parse(cleaned);
}

export async function writeArticle(topic, scoreArticleFn) {
  const MAX_TENTATIVES = 3;
  const SEUIL = 7;
  let tentative = 0;
  let article = null;
  let evaluation = null;

  while (tentative < MAX_TENTATIVES) {
    tentative++;
    try {
      article = await generateArticle(topic);
      await log('writeArticle', `Tentative ${tentative} — Article rédigé: "${article.titre}"`, 'success');
    } catch (e) {
      await log('writeArticle', `Tentative ${tentative} — Erreur parsing JSON: ${e.message}`, 'error');
      continue;
    }

    evaluation = await scoreArticleFn(article);

    if (evaluation.score >= SEUIL) {
      await log('writeArticle', `Tentative ${tentative} — Score suffisant: ${evaluation.score}/10`, 'success');
      return { article, evaluation };
    }

    await log('writeArticle', `Tentative ${tentative} — Score insuffisant: ${evaluation.score}/10, on réessaie`, 'info');
  }

  await log('writeArticle', `Échec après ${MAX_TENTATIVES} tentatives — meilleur score: ${evaluation?.score}/10`, 'error');
  return { article, evaluation, rejeté: true };
}
