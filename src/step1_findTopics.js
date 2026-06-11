import { genAI } from './clients.js';
import { log } from './logger.js';

export async function findTopics() {
  const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',
  tools: [{ googleSearch: {} }]
});

const annee = new Date().getFullYear();

const prompt = `Tu es un veilleur d'actualité francophone expert en tendances et buzz.
Nous sommes en ${annee}. Propose 5 sujets d'actualité de l'année ${annee} uniquement, variés et percutants.
Concentre-toi UNIQUEMENT sur les pays francophones : France, Belgique, Suisse, Canada (Québec), Maroc, Tunisie, Sénégal, Côte d'Ivoire, etc.
N'utilise JAMAIS des événements antérieurs à ${annee}.
N'invente rien — base-toi uniquement sur des actualités réelles et vérifiables.
Mix obligatoire :
- 1 sujet politique ou géopolitique chaud dans un pays francophone
- 1 sujet technologie ou IA avec impact francophone
- 1 sujet société ou fait divers marquant en France ou ailleurs dans la francophonie
- 1 sujet polémique ou débat en cours (réseau sociaux, culture, sport) francophone
- 1 sujet viral ou insolite du moment dans un pays francophone
Pour chaque sujet, choisis l'angle le plus accrocheur et potentiellement clivant sans être mensonger.
Réponds UNIQUEMENT en JSON, format strict :
[
  {"titre": "...", "description": "...", "source": "...", "categorie": "..."},
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
