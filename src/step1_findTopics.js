import { genAI } from './clients.js';
import { log } from './logger.js';

export async function findTopics() {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    tools: [{ googleSearch: {} }]
  });

  const annee = new Date().getFullYear();

  const prompt = `
Tu es rédacteur en chef d'un média francophone numérique spécialisé dans l'actualité récente.

Nous sommes en ${annee}.

Mission :
Identifier 5 sujets d'actualité RÉELS, RÉCENTS, IMPORTANTS et VÉRIFIABLES
qui peuvent faire l'objet d'un véritable article journalistique complet.

Le but est de sélectionner des événements capables de produire un article média
professionnel de 800 à 1200 mots.

RÈGLE FONDAMENTALE :
Chaque sujet doit correspondre à un événement précis survenu en ${annee} :
- annonce officielle
- décision politique
- lancement de produit
- publication d'étude
- changement de loi
- découverte scientifique
- événement économique
- événement culturel majeur
- sortie importante dans le gaming
- événement sportif majeur
- incident ou phénomène viral confirmé

Interdiction :
- proposer un simple thème
- proposer une tendance sans événement précis
- reprendre un débat ancien
- inventer des informations
- transformer une idée générale en actualité

Avant de retenir un sujet, vérifie :

1. Quel événement précis a eu lieu ?
2. Quelle est sa date exacte ?
3. Qui est directement concerné ?
4. Quelle source récente confirme l'information ?
5. Pourquoi cet événement mérite un article ?

Si une information n'est pas vérifiable, rejette le sujet.

Domaines recherchés :

1. Technologie & Intelligence artificielle
- nouveaux modèles IA
- annonces importantes des entreprises tech
- nouvelles réglementations
- innovations majeures
- cybersécurité
- robotique

2. Monde & géopolitique
- décisions internationales
- conflits
- accords
- changements diplomatiques
- événements ayant un impact mondial

3. Économie & entreprises
- résultats financiers
- nouveaux marchés
- rachats
- crises économiques
- innovations industrielles
- décisions importantes d'entreprises

4. Science, espace & environnement
- découvertes scientifiques
- études importantes
- missions spatiales
- climat
- environnement
- santé publique

5. Gaming & industrie du jeu vidéo
- annonces de studios
- nouveaux jeux majeurs
- sorties importantes
- rachats d'entreprises gaming
- événements esport
- changements dans l'industrie
- polémiques liées au jeu vidéo

6. Culture & divertissement
- cinéma
- séries
- musique
- plateformes streaming
- événements culturels importants

7. Sport
- compétitions majeures
- records
- transferts importants
- décisions de fédérations
- événements sportifs internationaux

8. Société & phénomènes internet
- tendances virales liées à un événement précis
- réseaux sociaux
- changements de comportement numérique
- événements fortement discutés en ligne

Pour chaque sujet :

TITRE :
- doit annoncer un événement précis
- doit contenir qui/quoi/quand si possible
- doit donner envie de lire un article complet
- interdit les titres vagues

Exemple interdit :
"La révolution de l'intelligence artificielle continue"

Exemple accepté :
"OpenAI annonce le lancement de son nouveau modèle IA le [date] avec une nouvelle capacité"

DESCRIPTION :
Entre 80 et 120 mots.

La première phrase doit obligatoirement :
- annoncer le fait principal
- contenir une date ou un chiffre précis
- citer l'acteur principal concerné

Interdiction de commencer par :
"Dans un contexte..."
"Alors que..."
"Cette initiative..."
"Le débat autour de..."
"Face à..."

La description doit contenir :
- l'événement précis
- les acteurs concernés
- pourquoi cet événement est important
- une information vérifiable
- une source récente

Le sujet sélectionné doit permettre ensuite de rédiger un article complet contenant :
- une introduction journalistique
- le contexte
- les explications
- les réactions des acteurs concernés
- les conséquences possibles
- une conclusion

Réponds UNIQUEMENT en JSON valide :

[
 {
  "titre": "",
  "description": "",
  "source": "",
  "categorie": ""
 }
]

Aucun texte avant ou après.
`;

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
