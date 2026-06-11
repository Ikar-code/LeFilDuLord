import { genAI } from './clients.js';
import { log } from './logger.js';

export async function findTopics() {
  const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',
  tools: [{ googleSearch: {} }]
});

const annee = new Date().getFullYear();

const prompt = `
Tu es rédacteur en chef d'un média francophone spécialisé dans l'actualité.

Nous sommes en ${annee}.

Mission :
Identifier 5 sujets d'actualité RÉELS, IMPORTANTS et VÉRIFIABLES de l'année ${annee}.

Règles obligatoires :

- Utilise Google Search pour vérifier chaque sujet.
- N'utilise AUCUNE information antérieure à ${annee}, sauf pour apporter du contexte.
- N'invente aucun fait, chiffre ou déclaration.
- Privilégie les sujets reposant sur un événement concret :
  - décision politique,
  - vote,
  - loi,
  - crise,
  - étude,
  - rapport,
  - innovation,
  - enquête,
  - scandale,
  - polémique documentée,
  - phénomène viral mesurable.

Pays autorisés :
France, Belgique, Suisse, Luxembourg, Québec, Canada francophone,
Maroc, Algérie, Tunisie, Sénégal, Côte d'Ivoire, Cameroun et autres pays francophones.

Mix obligatoire :

1 sujet politique ou géopolitique majeur.
1 sujet économique ou énergétique.
1 sujet technologie / IA.
1 sujet société ou culture.
1 sujet viral, insolite ou fortement débattu sur les réseaux.

Pour chaque sujet :

- créer un titre journalistique attractif mais factuel ;
- fournir un résumé de 80 à 120 mots ;
- expliquer pourquoi le sujet fait l'actualité ;
- inclure au moins un élément concret (date, chiffre, décision, déclaration, étude, vote ou événement) ;
- éviter les formulations vagues comme :
  "suscite des débats",
  "fait polémique",
  "au cœur des discussions"
  sans expliquer précisément pourquoi.

Le titre doit refléter exactement le contenu.

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
