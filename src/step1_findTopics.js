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

RÈGLE FONDAMENTALE :
Chaque sujet doit être déclenché par un événement précis : une décision, une annonce,
un vote, une étude, une publication officielle, un chiffre publié, ou une mesure
entrée en vigueur en ${annee}.
Interdiction de proposer un simple thème, un débat général ou une tendance de fond.
Le lecteur doit pouvoir répondre immédiatement à la question : "Qu'est-ce qui s'est passé,
quand, et qui est concerné ?"

Règles obligatoires :
- Utilise Google Search pour vérifier chaque sujet.
- N'utilise AUCUNE information antérieure à ${annee}, sauf pour apporter du contexte.
- N'invente aucun fait, chiffre ou déclaration.
- Avant de retenir un sujet, vérifie qu'au moins une source récente de ${annee} décrit explicitement l'événement.
- Rejette tout sujet qui n'est qu'une tendance, un contexte, une stratégie, une intention politique ou un débat récurrent.
- Ne transforme jamais un thème général en événement d'actualité.
- Si tu ne peux pas identifier un fait précis, daté et vérifiable, rejette le sujet.
- Chaque sujet doit correspondre à un événement réellement survenu en ${annee}.
- Avant de valider un sujet, vérifie :
  1. Quel événement précis a eu lieu ?
  2. Quelle est la date de l'événement ?
  3. Quel acteur identifié est directement concerné ?
  4. Quelle source récente confirme ce fait ?
- Si une seule de ces informations manque, ne propose pas le sujet.

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
- Le TITRE doit annoncer le fait précis (qui, quoi, quand), pas un thème vague.
  Mauvais exemple : "La France donne le coup d'envoi au Règlement Européen"
  Bon exemple : "IA : les premières obligations du règlement européen entrent en
  application le [date]"
- La DESCRIPTION (80-120 mots) doit OBLIGATOIREMENT commencer par le fait
  d'actualité principal, avec une date et/ou un chiffre précis dès la première phrase.
- INTERDICTION de commencer la description par : "Dans un contexte...",
  "Alors que...", "Cette initiative...", "Le débat autour de...",
  "Face à..."
- Citer au moins un acteur identifié (institution, entreprise, personnalité,
  organisation) directement impliqué dans l'événement.
- Inclure au moins un élément concret et vérifiable : date exacte, chiffre,
  nom de loi/règlement, déclaration, résultat de vote ou d'étude.
- INTERDIT : formulations vagues type "suscite des débats", "fait polémique",
  "au cœur des discussions" sans préciser immédiatement qui débat, depuis quand,
  et sur quel point précis.

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
