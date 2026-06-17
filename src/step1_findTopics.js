import { genAI } from './clients.js';
import { log } from './logger.js';

export async function findTopics() {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    tools: [{ googleSearch: {} }]
  });

  const annee = new Date().getFullYear();

  const prompt = `
Tu es rédacteur en chef de "Le Fil du Lord", un média numérique francophone
destiné principalement aux jeunes générations.

Nous sommes en ${annee}.

Mission :
Identifier 5 sujets d'actualité RÉELS, RÉCENTS, IMPORTANTS et VÉRIFIABLES
qui peuvent devenir de vrais articles journalistiques pour un public jeune.

Le média couvre principalement :
- gaming
- anime
- manga
- webtoon
- culture internet
- streaming
- cinéma et séries
- nouvelles technologies
- intelligence artificielle
- réseaux sociaux
- créateurs de contenu
- esport
- innovations numériques

Les sujets politiques, économiques ou internationaux ne doivent apparaître
que s'ils ont un impact direct sur les jeunes, internet, les technologies,
les loisirs numériques ou la culture populaire.

Objectif :
Sélectionner des événements capables de produire un article complet
de 800 à 1200 mots intéressant pour un lecteur jeune.

RÈGLE FONDAMENTALE :

Chaque sujet doit correspondre à un événement précis survenu en ${annee} :

- annonce officielle
- sortie importante
- lancement d'un produit ou service
- nouvelle d'un studio ou d'une entreprise
- événement esport
- publication officielle
- changement majeur d'une plateforme
- phénomène viral confirmé
- découverte technologique
- décision ayant un impact concret

Interdiction :

- proposer un simple thème
- proposer une tendance sans événement précis
- parler d'une œuvre ancienne sans actualité récente
- inventer une information
- transformer une rumeur en fait
- créer un sujet uniquement parce qu'il est populaire

Avant de retenir un sujet, vérifie :

1. Qu'est-ce qui s'est réellement passé ?
2. Quelle est la date exacte ?
3. Qui est concerné ?
4. Quelle source récente confirme l'information ?
5. Pourquoi ce sujet intéresserait un public jeune ?

Si une information n'est pas vérifiable, rejette le sujet.

Domaines prioritaires :

1. Gaming & jeux vidéo
- nouveaux jeux annoncés
- sorties majeures
- studios de développement
- Nintendo, PlayStation, Xbox, PC
- événements gaming
- esport
- mises à jour importantes
- rachats ou changements dans l'industrie

2. Anime, manga & webtoon
- nouvelles saisons annoncées
- adaptations importantes
- nouveaux projets
- succès majeurs
- événements liés aux licences populaires
- plateformes de diffusion

3. Culture web & divertissement
- YouTube
- Twitch
- TikTok
- créateurs de contenu
- tendances internet
- communautés en ligne
- événements viraux

4. Technologie & intelligence artificielle
- nouvelles IA
- outils utilisés par les créateurs
- innovations accessibles au public
- nouvelles applications
- impact de l'IA sur les jeunes

5. Films, séries & streaming
- Netflix
- Disney+
- Prime Video
- grandes sorties
- annonces importantes
- changements des plateformes

6. Société & actualité importante pour les jeunes
- nouvelles pratiques numériques
- éducation
- emploi numérique
- décisions ayant un impact sur internet ou les libertés numériques

7. Sport & esport
- compétitions majeures
- records
- événements esport
- joueurs ou équipes ayant un impact culturel

Pour chaque sujet :

TITRE :

- doit annoncer un événement précis
- doit être accrocheur pour un public jeune
- doit éviter les titres vagues
- doit donner envie de cliquer sans être mensonger

Exemple interdit :
"L'avenir du gaming change"

Exemple accepté :
"Riot Games annonce une nouvelle mise à jour majeure de Valorant le [date]"

DESCRIPTION :

Entre 80 et 120 mots.

La première phrase doit obligatoirement :
- annoncer l'événement principal
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
- pourquoi les jeunes pourraient être intéressés
- une information vérifiable
- une source récente

Le sujet doit permettre ensuite de rédiger un article contenant :
- une introduction dynamique
- le contexte
- les explications
- les réactions
- l'impact sur la communauté
- les conséquences possibles

Réponds UNIQUEMENT en JSON valide :

[
 {
  "titre": "",
  "description": "",
  "source": "",
  "categorie": ""
 }
]

absolument Aucun texte avant ou après.
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
