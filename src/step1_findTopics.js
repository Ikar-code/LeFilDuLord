import { genAI } from './clients.js';
import { log } from './logger.js';

export async function findTopics() {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `Tu es un veilleur d'actualité francophone.
Propose 3 sujets d'actualité RÉCENTE et pertinente (derniers jours), variés (pas uniquement politique).
Réponds UNIQUEMENT en JSON, format strict :
[
  {"titre": "...", "description": "...", "source": "..."},
  ...
]
Pas de texte avant/après, pas de markdown.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const cleaned = text.replace(/```json|```/g, '').trim();

  let topics;
  try {
    topics = JSON.parse(cleaned);
  } catch (e) {
    await log('findTopics', 'Erreur de parsing JSON: ' + e.message, 'error', { raw: text });
    throw e;
  }

  await log('findTopics', `${topics.length} sujets trouvés`, 'success', topics);
  return topics;
}
