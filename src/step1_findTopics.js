import { genAI } from './clients.js';
import { log } from './logger.js';

export async function findTopics() {
  const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',
  tools: [{ googleSearch: {} }],
  generationConfig: {
    responseMimeType: "application/json"
  }
});

  const annee = new Date().getFullYear();

  const prompt = `
Tu es rédacteur en chef de "Le Fil du Lord", un média numérique francophone
destiné principalement aux jeunes générations.

Nous sommes en ${annee}.

Tu as accès à Google Search.

IMPORTANT :
Avant de proposer un sujet, tu dois effectuer une recherche réelle
pour vérifier que l'information existe.

Tu ne dois jamais inventer un événement.

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
de 1000 à 1500 mots intéressant pour un lecteur jeune.


RÈGLE DE VÉRIFICATION ABSOLUE :

Pour chaque sujet proposé, tu dois vérifier :

1. L'événement existe réellement.
2. L'acteur cité existe réellement.
3. La date correspond à un événement confirmé.
4. Une source récente confirme l'information.
5. L'annonce vient d'un acteur officiel ou d'une source fiable.


Si tu ne trouves pas de preuve claire :

SUPPRIME LE SUJET.

Il vaut mieux proposer 2 vrais sujets que 5 sujets inventés.


INTERDICTION ABSOLUE :

Ne jamais créer :

- faux projets
- faux noms de produits
- faux événements
- fausses annonces
- fausses dates
- faux chiffres
- fausses citations
- annonces supposées officielles
- rumeurs présentées comme des faits


Ne jamais transformer :

- une rumeur en annonce
- une fuite en confirmation
- une tendance en événement
- un concept en produit disponible
- un prototype en lancement officiel


Chaque sujet doit correspondre à un événement précis survenu en ${annee} :

- annonce officielle
- sortie importante
- lancement d'un produit ou service
- nouvelle d'un studio ou d'une entreprise
- événement esport
- publication officielle
- changement majeur d'une plateforme
- phénomène viral confirmé
- découverte technologique confirmée
- décision ayant un impact concret


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
- nouveaux projets confirmés
- succès majeurs
- événements liés aux licences populaires
- plateformes de diffusion


3. Culture web & divertissement

- YouTube
- Twitch
- TikTok
- créateurs de contenu
- tendances internet confirmées
- communautés en ligne
- événements viraux vérifiés


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
- doit être accrocheur
- doit donner envie de cliquer
- ne doit jamais exagérer


Exemple interdit :
"L'avenir du gaming change"


Exemple accepté :
"Riot Games annonce une nouvelle mise à jour majeure de Valorant le 12 juin 2026"



DESCRIPTION :

Entre 100 et 500 mots.

La première phrase doit obligatoirement :

- annoncer l'événement principal
- contenir une date précise
- citer l'acteur principal concerné


La description doit contenir obligatoirement :

- Qui ?
- Quoi ?
- Quand ?
- Où ?
- Pourquoi ?
- Comment ?
- Conséquences immédiates
- Impact pour les jeunes
- Chiffres importants vérifiés
- Acteurs concernés
- Sources utilisées


La description doit contenir toutes les informations nécessaires
pour qu'une autre IA puisse écrire un article complet
sans effectuer de recherche supplémentaire.


IMPORTANT POUR L'AUTRE IA :

L'article sera écrit uniquement avec les informations présentes ici.

Donc :

Ne jamais inventer :
- détails manquants
- chiffres
- citations
- réactions
- conséquences


Si une information n'est pas confirmée :

ne pas la compléter.


Le sujet doit permettre de rédiger :

- une introduction dynamique
- le contexte
- les explications
- les réactions
- l'impact communauté
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


IMPORTANT :
Ne donne aucune explication.
Ne donne aucune phrase avant le JSON.
Retourne uniquement le tableau JSON demandé.
Toutes les chaînes de texte doivent être échappées correctement.

Aucun texte avant ou après le JSON.
`;

  let result;

  for (let i = 0; i < 3; i++) {
    try {
      result = await model.generateContent(prompt);
      break;
    } catch (error) {
      if (i === 2) throw error;
  
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  const text = result.response.text().trim();

const cleaned = text
  .replace(/```json/g, '')
  .replace(/```/g, '')
  .trim();

let topics;

try {

  topics = JSON.parse(cleaned);

} catch (e) {

  await log(
    'findTopics',
    'Erreur JSON Gemini : ' + e.message,
    'error',
    {
      raw: text.substring(0, 3000)
    }
  );

  throw new Error('Gemini a retourné un JSON invalide');

}
